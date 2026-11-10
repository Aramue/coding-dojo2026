"""Les reponses d'Open-Meteo enregistrees, pour la construction et le secours.

Un exercice d'API se valide dans le navigateur contre le VRAI service. Mais la
construction rejoue la solution de reference sur le poste de build, et elle ne
doit dependre ni du reseau ni de la meteo du jour. Elle lit donc ces reponses,
enregistrees une fois pour toutes dans `enregistrements/open-meteo.json`.

La meme table est publiee dans /contenu/api_enregistree.json : quand le reseau
d'un etablissement bloque le service, le navigateur rejoue ces reponses et
l'exercice reste jouable. La reponse porte alors `enregistree = True`.

Pour enregistrer une requete nouvelle, avec le reseau :

    DOJO_ENREGISTRER=1 python valider_contenu.py ../contenu/chapitre-1

Ce qui s'enregistre est ce que le service repond AUJOURD'HUI. Un exercice ne doit
donc tester que ce qui ne varie pas avec la date : une unite, la taille d'un
tableau, un code de pays — jamais une temperature. Voir « Exercices d'API » dans
le coffre.
"""

from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

import requests_dojo

CHEMIN = Path(__file__).parent / "enregistrements" / "open-meteo.json"


def charger() -> dict:
    if not CHEMIN.exists():
        return {}
    return json.loads(CHEMIN.read_text(encoding="utf-8"))


def _enregistrer(url: str, enregistrements: dict) -> None:
    try:
        with urllib.request.urlopen(url, timeout=10) as reponse:  # noqa: S310 — hote fixe
            statut, texte = reponse.status, reponse.read().decode("utf-8")
    except urllib.error.HTTPError as e:  # 400 : une reponse valide, a enregistrer aussi
        statut, texte = e.code, e.read().decode("utf-8")
    enregistrements[url] = {"statut": statut, "texte": texte}
    CHEMIN.parent.mkdir(parents=True, exist_ok=True)
    CHEMIN.write_text(
        json.dumps(enregistrements, ensure_ascii=False, indent=1, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def transport(url: str):
    """Transport de la construction : une reponse enregistree, ou une erreur claire."""
    enregistrements = charger()
    if url not in enregistrements and os.environ.get("DOJO_ENREGISTRER") == "1":
        _enregistrer(url, enregistrements)
    trouve = enregistrements.get(url)
    if trouve is None:
        raise requests_dojo.RequestException(
            f"aucune reponse enregistree pour {url} — "
            "lance la validation avec DOJO_ENREGISTRER=1 pour l'enregistrer"
        )
    return trouve["statut"], trouve["texte"], {}
