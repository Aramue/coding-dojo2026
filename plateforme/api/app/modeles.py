"""Tables. Aucune donnee personnelle : ni nom, ni prenom, ni adresse."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def maintenant() -> datetime:
    return datetime.now(timezone.utc)


class Agent(SQLModel, table=True):
    """Un eleve, connu uniquement par son code pseudonyme."""

    code_agent: str = Field(primary_key=True)
    cree_le: datetime = Field(default_factory=maintenant)
    vu_le: datetime = Field(default_factory=maintenant)


class Tentative(SQLModel, table=True):
    """Une soumission. Ne contient jamais le code ecrit par l'eleve."""

    id: int | None = Field(default=None, primary_key=True)
    code_agent: str = Field(foreign_key="agent.code_agent", index=True)
    exercice_id: str = Field(index=True)
    verdict: str  # vert | bleu | rouge
    type_erreur: str | None = None  # "TypeError", "NameError", ...
    duree_ms: int = 0
    horodatage: datetime = Field(default_factory=maintenant, index=True)


class Verrou(SQLModel, table=True):
    """Un concept ouvert ou ferme pour toute la classe."""

    concept: str = Field(primary_key=True)
    ouvert: bool = True
