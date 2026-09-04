"""Tables.

L'eleve porte desormais son identite. C'est un amendement assume a ADR-002 :
le code d'acces reste la CLE — il ne se derive d'aucune donnee personnelle et
c'est lui qui circule dans les jetons et dans les tentatives — mais le
professeur tient la liste de sa classe ici plutot que sur un papier a cote.

Ce qui n'a pas change : aucune adresse, aucune date de naissance, aucun
identifiant scolaire, et surtout ==jamais le code ecrit par l'eleve==.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def maintenant() -> datetime:
    return datetime.now(timezone.utc)


class Eleve(SQLModel, table=True):
    """Un eleve de la classe, cree par le professeur.

    Les trois champs d'identite ont une valeur par defaut vide : la table
    existait avant eux, et une base deja peuplee doit continuer a se lire.
    """

    code_acces: str = Field(primary_key=True)
    prenom: str = ""
    nom: str = ""
    etablissement: str = ""
    cree_le: datetime = Field(default_factory=maintenant)
    vu_le: datetime = Field(default_factory=maintenant)


class Tentative(SQLModel, table=True):
    """Une soumission. Ne contient jamais le code ecrit par l'eleve."""

    id: int | None = Field(default=None, primary_key=True)
    code_acces: str = Field(foreign_key="eleve.code_acces", index=True)
    exercice_id: str = Field(index=True)
    verdict: str  # vert | bleu | rouge
    type_erreur: str | None = None  # "TypeError", "NameError", ...
    duree_ms: int = 0
    horodatage: datetime = Field(default_factory=maintenant, index=True)
