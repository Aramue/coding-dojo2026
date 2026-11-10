"""Le requests du dojo : ses bornes sont ce qui protege le quota de toute la classe."""

import json

import pytest

import api_enregistree
import requests_dojo as rq


class Transport:
    """Un faux reseau qui compte ce qu'on lui demande."""

    def __init__(self, statut=200, corps=None, panne=None):
        self.appels = []
        self.statut = statut
        self.corps = json.dumps(corps if corps is not None else {"ok": 1})
        self.panne = panne

    def __call__(self, url):
        self.appels.append(url)
        if self.panne:
            raise self.panne
        return self.statut, self.corps, {"Content-Type": "application/json"}


@pytest.fixture(autouse=True)
def propre():
    rq.vider()
    yield
    rq.configurer(transport=None, secours=None, limite_minute=rq.APPELS_PAR_MINUTE)
    rq.vider()


@pytest.fixture
def reseau():
    t = Transport()
    rq.configurer(transport=t, limite_minute=rq.APPELS_PAR_MINUTE)
    return t


URL = "https://api.open-meteo.com/v1/forecast"


def test_une_reponse_se_lit_comme_avec_requests(reseau):
    r = rq.get(URL, params={"latitude": 46.2})
    assert r.status_code == 200 and r.ok
    assert r.json() == {"ok": 1}
    assert r.text == '{"ok": 1}'
    assert r.headers["content-type"] == "application/json"
    assert r.reason == "OK" and repr(r) == "<Response [200]>"
    assert r.raise_for_status() is None


def test_les_parametres_sont_tries_et_encodes(reseau):
    rq.get(URL, params={"timezone": "Europe/Zurich", "latitude": 46.2, "current_weather": True})
    assert reseau.appels == [
        URL + "?current_weather=True&latitude=46.2&timezone=Europe%2FZurich"
    ]


def test_un_parametre_none_n_est_pas_envoye_et_une_liste_se_repete(reseau):
    rq.get(URL, params={"a": None, "b": [1, 2]})
    assert reseau.appels == [URL + "?b=1&b=2"]


def test_une_requete_deja_dans_l_url_est_conservee(reseau):
    rq.get(URL + "?latitude=46.2", params={"longitude": 6.1})
    assert reseau.appels == [URL + "?latitude=46.2&longitude=6.1"]


def test_http_est_remonte_en_https(reseau):
    rq.get("http://api.open-meteo.com/v1/forecast")
    assert reseau.appels == [URL]


@pytest.mark.parametrize(
    "url", ["https://exemple.com/x", "https://api.open-meteo.com.evil.fr/v1", "ftp://api.open-meteo.com"]
)
def test_seul_open_meteo_repond(reseau, url):
    with pytest.raises(rq.RequestException):
        rq.get(url)
    assert reseau.appels == []


def test_une_adresse_sans_schema_est_refusee(reseau):
    with pytest.raises(rq.RequestException, match="https://"):
        rq.get("api.open-meteo.com/v1/forecast")
    with pytest.raises(rq.RequestException):
        rq.get(None)


def test_deux_appels_identiques_ne_partent_qu_une_fois(reseau):
    rq.get(URL, params={"a": 1, "b": 2})
    rq.get(URL, params={"b": 2, "a": 1})  # autre ordre, meme requete
    assert len(reseau.appels) == 1


def test_le_cache_expire(reseau, monkeypatch):
    rq.get(URL)
    monkeypatch.setattr(rq, "DUREE_CACHE", -1)
    rq.get(URL)
    assert len(reseau.appels) == 2


def test_au_plus_six_appels_par_execution(reseau):
    for i in range(rq.APPELS_PAR_EXECUTION):
        rq.get(URL, params={"i": i})
    with pytest.raises(rq.RequestException, match="trop de requêtes"):
        rq.get(URL, params={"i": 99})
    # Le cache ne dispense pas du plafond : une boucle de 1000 appels identiques
    # est exactement ce qu'il faut arreter.
    with pytest.raises(rq.RequestException):
        rq.get(URL, params={"i": 0})


def test_reinitialiser_rend_un_nouveau_programme(reseau):
    for i in range(rq.APPELS_PAR_EXECUTION):
        rq.get(URL, params={"i": i})
    rq.reinitialiser()
    assert rq.get(URL, params={"i": 100}).status_code == 200


def test_au_dela_de_la_limite_par_minute_le_service_repond_429(reseau):
    for i in range(rq.APPELS_PAR_MINUTE):
        rq.reinitialiser()
        assert rq.get(URL, params={"i": i}).status_code == 200
    rq.reinitialiser()
    limite = rq.get(URL, params={"i": 1000})
    assert limite.status_code == 429 and not limite.ok
    assert "attends" in limite.json()["reason"]
    assert len(reseau.appels) == rq.APPELS_PAR_MINUTE  # le 21e n'est pas parti
    # Une reponse 429 ne se garde pas : l'eleve qui reessaie doit pouvoir passer.
    assert (rq._cache.get(limite.url) is None)


def test_sans_limite_par_minute_la_construction_n_est_jamais_bridee():
    t = Transport()
    rq.configurer(transport=t, limite_minute=None)
    for i in range(rq.APPELS_PAR_MINUTE + 5):
        rq.reinitialiser()
        assert rq.get(URL, params={"i": i}).status_code == 200


def test_un_service_lent_leve_timeout_avant_le_minuteur(reseau, monkeypatch):
    monkeypatch.setattr(rq, "BUDGET_RESEAU", -1)
    with pytest.raises(rq.Timeout):
        rq.get(URL)
    assert rq.Timeout.__name__ == "Timeout"  # le nom que erreurs.ts traduit


def test_raise_for_status_leve_http_error_avec_la_reponse():
    rq.configurer(transport=Transport(statut=404), limite_minute=None)
    r = rq.get(URL)
    with pytest.raises(rq.HTTPError, match="404 Not Found") as e:
        r.raise_for_status()
    assert e.value.response is r
    assert rq.exceptions.HTTPError is rq.HTTPError


def test_une_erreur_du_serveur_ne_se_met_pas_en_cache():
    t = Transport(statut=503)
    rq.configurer(transport=t, limite_minute=None)
    rq.get(URL)
    rq.reinitialiser()
    rq.get(URL)
    assert len(t.appels) == 2


def test_une_erreur_400_se_met_en_cache():
    t = Transport(statut=400, corps={"error": True, "reason": "Latitude must be..."})
    rq.configurer(transport=t, limite_minute=None)
    rq.get(URL)
    rq.reinitialiser()
    assert rq.get(URL).json()["error"] is True
    assert len(t.appels) == 1


def test_reseau_coupe_sans_secours_leve_connection_error():
    rq.configurer(transport=Transport(panne=OSError("coupe")), secours=None, limite_minute=None)
    with pytest.raises(rq.ConnectionError, match="ne répond pas"):
        rq.get(URL)


def test_reseau_coupe_avec_secours_rejoue_la_reponse_enregistree():
    enregistre = (200, '{"vu": "avant"}', {})
    rq.configurer(
        transport=Transport(panne=OSError("coupe")), secours=lambda url: enregistre, limite_minute=None
    )
    r = rq.get(URL)
    assert r.json() == {"vu": "avant"} and r.enregistree is True


def test_une_reponse_reelle_n_est_pas_marquee_enregistree(reseau):
    assert rq.get(URL).enregistree is False


def test_secours_sans_enregistrement_leve_connection_error():
    rq.configurer(transport=Transport(panne=OSError()), secours=lambda url: None, limite_minute=None)
    with pytest.raises(rq.ConnectionError):
        rq.get(URL)


def test_une_erreur_du_dojo_n_est_pas_prise_pour_une_panne_reseau():
    def refus(url):
        raise rq.RequestException("aucune reponse enregistree")

    rq.configurer(transport=refus, secours=lambda url: (200, "{}", {}), limite_minute=None)
    with pytest.raises(rq.RequestException, match="aucune reponse") as e:
        rq.get(URL)
    assert not isinstance(e.value, rq.ConnectionError)


@pytest.mark.parametrize("verbe", ["post", "put", "delete", "patch"])
def test_seul_get_est_propose(reseau, verbe):
    with pytest.raises(rq.RequestException, match="seule la méthode GET"):
        getattr(rq, verbe)(URL)


# --- Le transport de la construction ---------------------------------------


def test_le_transport_enregistre_rejoue_une_reponse(tmp_path, monkeypatch):
    chemin = tmp_path / "open-meteo.json"
    chemin.write_text(json.dumps({URL: {"statut": 200, "texte": '{"a": 1}'}}), encoding="utf-8")
    monkeypatch.setattr(api_enregistree, "CHEMIN", chemin)
    assert api_enregistree.transport(URL) == (200, '{"a": 1}', {})


def test_une_requete_inconnue_dit_comment_l_enregistrer(tmp_path, monkeypatch):
    monkeypatch.setattr(api_enregistree, "CHEMIN", tmp_path / "vide.json")
    monkeypatch.delenv("DOJO_ENREGISTRER", raising=False)
    with pytest.raises(rq.RequestException, match="DOJO_ENREGISTRER=1"):
        api_enregistree.transport(URL + "?x=1")


def test_enregistrer_ecrit_la_reponse_du_service(tmp_path, monkeypatch):
    chemin = tmp_path / "dossier" / "open-meteo.json"
    monkeypatch.setattr(api_enregistree, "CHEMIN", chemin)
    monkeypatch.setenv("DOJO_ENREGISTRER", "1")

    class Reponse:
        status = 200

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def read(self):
            return '{"temperature": 11}'.encode()

    monkeypatch.setattr(api_enregistree.urllib.request, "urlopen", lambda url, timeout: Reponse())
    assert api_enregistree.transport(URL + "?y=2") == (200, '{"temperature": 11}', {})
    assert json.loads(chemin.read_text(encoding="utf-8"))[URL + "?y=2"]["statut"] == 200


def test_enregistrer_garde_aussi_une_reponse_400(tmp_path, monkeypatch):
    import io
    import urllib.error

    chemin = tmp_path / "open-meteo.json"
    monkeypatch.setattr(api_enregistree, "CHEMIN", chemin)
    monkeypatch.setenv("DOJO_ENREGISTRER", "1")

    def refuse(url, timeout):
        raise urllib.error.HTTPError(url, 400, "Bad Request", {}, io.BytesIO(b'{"error": true}'))

    monkeypatch.setattr(api_enregistree.urllib.request, "urlopen", refuse)
    assert api_enregistree.transport(URL + "?z=3")[0] == 400


def test_le_fichier_publie_est_celui_de_la_construction():
    # Le navigateur lit exactement ce que la construction rejoue.
    assert isinstance(api_enregistree.charger(), dict)
