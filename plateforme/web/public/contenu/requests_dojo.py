# DOJO-REQUESTS
"""Un `requests` minimal pour le dojo. SEULE SOURCE de ce module.

L'eleve ecrit `import requests` et `requests.get(url, params=...)` comme dans
n'importe quel cours. Ce fichier est ce qui repond :

- dans le navigateur, le worker le charge (construire_contenu.py le publie dans
  /contenu/requests_dojo.py) et l'installe sous le nom `requests` ;
- a la construction, valider_contenu.py l'installe de meme, avec un transport
  qui rejoue des reponses ENREGISTREES : une construction ne depend jamais du
  reseau, et un exercice se valide toujours de la meme facon.

Pourquoi pas le vrai `requests` de Pyodide : il n'est pas livre avec nos
fichiers, il exige un patch de pyodide-http, et surtout il ne nous laisserait
aucune borne. Or toute une classe sort par UNE adresse IP, et Open-Meteo limite
par adresse IP : 600 appels par minute pour 24 eleves. Un `while True` qui
appelle le service epuiserait le quota de toute la salle en quelques secondes.

D'ou quatre bornes, toutes ici :

- seuls les hotes d'Open-Meteo repondent ;
- au plus APPELS_PAR_EXECUTION appels par programme ;
- au plus APPELS_PAR_MINUTE appels REELS par minute et par navigateur — au-dela,
  une reponse 429, comme le ferait le service lui-meme ;
- un cache : deux appels identiques ne partent qu'une fois, ce qui absorbe une
  exercice evalue en plusieurs executions (une par test) et un eleve qui
  relance dix fois le meme code.

Ce module n'importe que la bibliotheque standard : il doit tourner a
l'identique sous Pyodide et en Python natif.
"""

import json as _json
import time as _temps
import types as _types
from urllib.parse import parse_qsl as _parse_qsl
from urllib.parse import urlencode as _urlencode
from urllib.parse import urlsplit as _urlsplit

HOTES_AUTORISES = ("api.open-meteo.com", "geocoding-api.open-meteo.com")
APPELS_PAR_EXECUTION = 6
APPELS_PAR_MINUTE = 20
DELAI_APPEL = 2.0  # secondes, pour UN appel
BUDGET_RESEAU = 3.5  # secondes de reseau cumulees, pour UN programme
DUREE_CACHE = 300.0  # secondes

# Le minuteur de l'Executeur coupe a 5 s et affiche « ton programme tourne en
# rond ». Un service lent ne doit JAMAIS produire ce message : BUDGET_RESEAU
# laisse la main a une erreur nommee avant que le minuteur ne tranche.


class RequestException(Exception):
    """Toute erreur de ce module."""


class ConnectionError(RequestException):  # noqa: A001 — meme nom que dans requests
    """Le service n'a pas repondu."""


class Timeout(RequestException):
    """Les appels de ce programme ont pris trop de temps."""


class HTTPError(RequestException):
    def __init__(self, message, response=None):
        super().__init__(message)
        self.response = response


exceptions = _types.SimpleNamespace(
    RequestException=RequestException,
    ConnectionError=ConnectionError,
    Timeout=Timeout,
    HTTPError=HTTPError,
)

_RAISONS = {
    200: "OK",
    201: "Created",
    204: "No Content",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    429: "Too Many Requests",
    500: "Internal Server Error",
    503: "Service Unavailable",
}


class Response:
    def __init__(self, url, statut, texte, entetes=None, enregistree=False):
        self.url = url
        self.status_code = statut
        self.text = texte
        self.headers = {str(k).lower(): v for k, v in (entetes or {}).items()}
        self.encoding = "utf-8"
        # Vrai quand le reseau a echoue et qu'on a rejoue une reponse enregistree.
        self.enregistree = enregistree

    @property
    def ok(self):
        return self.status_code < 400

    @property
    def reason(self):
        return _RAISONS.get(self.status_code, "")

    def json(self):
        return _json.loads(self.text)

    def raise_for_status(self):
        if not self.ok:
            raise HTTPError(
                f"Le service a répondu {self.status_code} {self.reason}".strip(), response=self
            )

    def __repr__(self):
        return f"<Response [{self.status_code}]>"


# --- Ce que l'hote regle ----------------------------------------------------
# `_transport` : fonction(url) -> (statut, texte, entetes). None = navigateur.
# `_secours`   : fonction(url) -> (statut, texte, entetes) ou None, essayee quand
#                le transport echoue. None = pas de secours.
_transport = None
_secours = None
_limite_minute = APPELS_PAR_MINUTE

_cache = {}  # url -> (instant, statut, texte, entetes, enregistree)
_instants = []  # instants des appels reels, pour la limite par minute
_etat = {"appels": 0, "reseau": 0.0}


def configurer(transport=None, secours=None, limite_minute=APPELS_PAR_MINUTE):
    global _transport, _secours, _limite_minute
    _transport, _secours, _limite_minute = transport, secours, limite_minute


def reinitialiser():
    """Remet a zero les compteurs d'UN programme. Appelee avant chaque execution."""
    _etat["appels"] = 0
    _etat["reseau"] = 0.0


def vider():
    """Remet tout a zero, cache compris. Pour les tests."""
    reinitialiser()
    _cache.clear()
    del _instants[:]


def _url_complete(url, params):
    if not isinstance(url, str) or not url.startswith(("http://", "https://")):
        raise RequestException("L'adresse doit commencer par https://")
    morceaux = _urlsplit(url)
    if morceaux.hostname not in HOTES_AUTORISES:
        raise RequestException(
            "Dans le dojo, les requêtes ne partent que vers Open-Meteo "
            "(api.open-meteo.com ou geocoding-api.open-meteo.com)."
        )
    paires = _parse_qsl(morceaux.query, keep_blank_values=True)
    for cle, valeur in (params or {}).items():
        if valeur is None:
            continue  # comme requests : un parametre None n'est pas envoye
        valeurs = valeur if isinstance(valeur, (list, tuple)) else [valeur]
        paires += [(str(cle), str(v)) for v in valeurs]
    base = "https://" + morceaux.netloc + morceaux.path
    # Tri : l'ordre n'a pas d'effet sur la reponse, et une cle de cache stable
    # evite de payer deux fois la meme requete ecrite dans un autre ordre.
    return base + ("?" + _urlencode(sorted(paires)) if paires else "")


def _transport_navigateur(url):
    import js  # present sous Pyodide uniquement

    xhr = js.XMLHttpRequest.new()
    xhr.open("GET", url, False)  # synchrone : permis dans un worker
    xhr.timeout = int(DELAI_APPEL * 1000)
    xhr.send()
    if xhr.status == 0:
        raise OSError("aucune reponse")
    type_contenu = xhr.getResponseHeader("content-type")
    return xhr.status, str(xhr.responseText), {"content-type": str(type_contenu or "")}


_enregistrements_navigateur = None


def _secours_navigateur(url):
    """Rejoue une reponse enregistree quand le reseau de la salle bloque le service."""
    global _enregistrements_navigateur
    import js

    if _enregistrements_navigateur is None:
        _enregistrements_navigateur = {}
        try:
            xhr = js.XMLHttpRequest.new()
            xhr.open("GET", "/contenu/api_enregistree.json", False)
            xhr.send()
            if xhr.status == 200:
                _enregistrements_navigateur = _json.loads(str(xhr.responseText))
        except Exception:  # noqa: BLE001 — pas de secours, tant pis
            pass
    trouve = _enregistrements_navigateur.get(url)
    if trouve is None:
        return None
    return trouve["statut"], trouve["texte"], {}


def _appeler(url, maintenant):
    """Un appel REEL, borne. Rend (statut, texte, entetes, enregistree)."""
    if _limite_minute is not None:
        _instants[:] = [t for t in _instants if maintenant - t < 60]
        if len(_instants) >= _limite_minute:
            corps = _json.dumps({"error": True, "reason": "Trop de requêtes : attends un instant."})
            return 429, corps, {}, False
    if _etat["reseau"] >= BUDGET_RESEAU:
        raise Timeout("Les requêtes de ton programme prennent trop de temps.")
    _instants.append(maintenant)

    debut = _temps.monotonic()
    try:
        statut, texte, entetes = (_transport or _transport_navigateur)(url)
        return statut, texte, entetes, False
    except RequestException:
        raise
    except Exception:  # noqa: BLE001 — reseau coupe, delai depasse, CORS...
        secours = (_secours or (_secours_navigateur if _transport is None else None))
        trouve = secours(url) if secours else None
        if trouve is None:
            raise ConnectionError("Le service ne répond pas.") from None
        return trouve[0], trouve[1], trouve[2], True
    finally:
        _etat["reseau"] += _temps.monotonic() - debut


def get(url, params=None, timeout=None, **_ignores):
    url_complete = _url_complete(url, params)
    if _etat["appels"] >= APPELS_PAR_EXECUTION:
        raise RequestException(
            f"Ton programme envoie trop de requêtes : {APPELS_PAR_EXECUTION} au plus par exécution."
        )
    _etat["appels"] += 1

    maintenant = _temps.monotonic()
    en_cache = _cache.get(url_complete)
    if en_cache is not None and maintenant - en_cache[0] < DUREE_CACHE:
        _, statut, texte, entetes, enregistree = en_cache
    else:
        statut, texte, entetes, enregistree = _appeler(url_complete, maintenant)
        # Ni une reponse 429 ni une erreur du serveur ne se mettent en cache :
        # l'eleve qui reessaie doit pouvoir obtenir autre chose.
        if statut != 429 and statut < 500:
            _cache[url_complete] = (maintenant, statut, texte, entetes, enregistree)
    return Response(url_complete, statut, texte, entetes, enregistree)


def _non_propose(nom):
    def fonction(*_args, **_kwargs):
        raise RequestException(
            f"Dans le dojo, seule la méthode GET est proposée : {nom}() n'est pas disponible."
        )

    fonction.__name__ = nom
    return fonction


post = _non_propose("post")
put = _non_propose("put")
delete = _non_propose("delete")
patch = _non_propose("patch")
