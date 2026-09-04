from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

URL = os.environ.get("DOJO_BDD", "sqlite:///./donnees/dojo.db")

# SQLite ne cree pas le dossier parent : sans cela, le premier demarrage echoue,
# y compris sous TestClient qui declenche le cycle de vie de l'application.
if URL.startswith("sqlite:///") and ":memory:" not in URL:
    Path(URL.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)

moteur = create_engine(URL, connect_args={"check_same_thread": False})


def creer_schema(sur=None) -> None:
    cible = sur if sur is not None else moteur
    SQLModel.metadata.create_all(cible)
    ajouter_colonnes_manquantes(cible)


# Colonnes ajoutees apres coup, avec leur type SQLite et leur valeur par defaut.
# `create_all` ne cree que les tables ABSENTES : sur une base deja peuplee, une
# table existante n'est jamais modifiee, et la premiere requete echouerait sur
# « no such column ». Une seance perdue pour trois colonnes.
COLONNES_AJOUTEES: dict[str, dict[str, str]] = {
    "eleve": {
        "prenom": "TEXT NOT NULL DEFAULT ''",
        "nom": "TEXT NOT NULL DEFAULT ''",
        "etablissement": "TEXT NOT NULL DEFAULT ''",
    },
}


def ajouter_colonnes_manquantes(cible=None) -> None:
    """Migration minimale, idempotente : ALTER TABLE ADD COLUMN si la colonne manque.

    Il n'y a pas d'outil de migration dans ce projet, et il n'en faut pas un
    pour trois colonnes. Ce qu'il faut, c'est qu'un deploiement sur une base
    existante ==ne demande aucune intervention manuelle== : personne ne se
    connecte au serveur de l'UNIGE le matin du 16 septembre.
    """
    with (cible if cible is not None else moteur).begin() as connexion:
        for table, colonnes in COLONNES_AJOUTEES.items():
            existantes = {
                ligne[1] for ligne in connexion.exec_driver_sql(f"PRAGMA table_info({table})")
            }
            if not existantes:
                continue  # La table vient d'etre creee : elle a deja tout.
            for nom, definition in colonnes.items():
                if nom not in existantes:
                    connexion.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {nom} {definition}")


def obtenir_session() -> Iterator[Session]:
    with Session(moteur) as session:
        yield session
