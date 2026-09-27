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

from sqlalchemy import UniqueConstraint
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


class PartieQuiz(SQLModel, table=True):
    """Une partie de quiz en direct. Une seule est en cours a la fois.

    `phase` ne s'ecrit qu'en trois valeurs : attente, question, terminee. La
    correction ne s'ecrit PAS : elle se deduit de `fin_a` et de l'heure de la
    lecture (voir quiz.py). Aucun minuteur serveur, donc rien a perdre si le
    conteneur redemarre en pleine partie. Voir ADR-014.
    """

    id: int | None = Field(default=None, primary_key=True)
    quiz_id: str
    phase: str = "attente"
    # Rang de la question courante, -1 tant que la premiere n'est pas ouverte.
    question: int = -1
    ouverte_le: datetime | None = None
    fin_a: datetime | None = None
    creee_le: datetime = Field(default_factory=maintenant)
    terminee_le: datetime | None = None


class ParticipantQuiz(SQLModel, table=True):
    """Un eleve entre dans une partie. Son identite est son code, rien d'autre."""

    partie_id: int = Field(foreign_key="partiequiz.id", primary_key=True)
    code_acces: str = Field(foreign_key="eleve.code_acces", primary_key=True)
    rejoint_le: datetime = Field(default_factory=maintenant)


class ReponseQuiz(SQLModel, table=True):
    """Une reponse a une question : un numero d'option, jamais du texte.

    La contrainte d'unicite porte la regle du jeu — une reponse par eleve et
    par question, la premiere compte — la ou deux requetes simultanees
    passeraient toutes deux une verification faite en Python.
    """

    __table_args__ = (UniqueConstraint("partie_id", "question", "code_acces"),)

    id: int | None = Field(default=None, primary_key=True)
    partie_id: int = Field(foreign_key="partiequiz.id", index=True)
    question: int
    code_acces: str = Field(foreign_key="eleve.code_acces", index=True)
    choix: int
    delai_ms: int
    correcte: bool
    points: int
    recue_le: datetime = Field(default_factory=maintenant)
