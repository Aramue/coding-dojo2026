"""Modele d'un exercice. Toute violation ici fait echouer la construction."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated, Literal, Union

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

MOTIF_ID = re.compile(r"^s[123]-[0-9]{2}(-expert)?$")

# Construit a partir de points de code explicites plutot que recopie depuis des
# emoji litteraux : un selecteur de variation invisible (U+FE0F) s'etait glisse
# dans la forme "☀-➿️⬀-⯿" et cassait la borne superieure de la plage ☀-➿.
MOTIF_EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0000FE0F\U00002B00-\U00002BFF]"
)


class TestSortie(BaseModel):
    type: Literal["sortie"]
    entrees: list[str] = Field(default_factory=list)
    attendu: str
    exige_exact: bool = False

    @field_validator("attendu")
    @classmethod
    def sans_emoji(cls, v: str) -> str:
        if MOTIF_EMOJI.search(v):
            raise ValueError("aucun emoji dans une sortie comparee")
        return v


class TestVariable(BaseModel):
    type: Literal["variable"]
    nom: str
    valeur_attendue: str | None = None
    type_attendu: Literal["int", "float", "str", "bool"] | None = None


class TestQcm(BaseModel):
    type: Literal["qcm"]
    options: list[str] = Field(min_length=2)
    bonne_reponse: int

    @model_validator(mode="after")
    def indice_dans_les_bornes(self) -> "TestQcm":
        if not 0 <= self.bonne_reponse < len(self.options):
            raise ValueError("bonne_reponse hors des options")
        return self


class TestMotif(BaseModel):
    type: Literal["interdit", "contient"]
    motif: str


TestExercice = Annotated[
    Union[TestSortie, TestVariable, TestQcm, TestMotif], Field(discriminator="type")
]


class Exercice(BaseModel):
    id: str
    concept: str
    seance: int = Field(ge=1, le=3)
    niveau: Literal["normal", "expert"]
    type: Literal["predire", "debug", "completer", "ecrire"]
    titre: str
    obligatoire: bool
    enonce: str
    depart: str = ""
    indices: list[str] = Field(default_factory=list)
    tests: list[TestExercice] = Field(min_length=1)
    solution: str
    expert: str | None = None

    @field_validator("id")
    @classmethod
    def identifiant_bien_forme(cls, v: str) -> str:
        if not MOTIF_ID.match(v):
            raise ValueError(f"identifiant invalide : {v!r} (attendu s1-01 ou s1-01-expert)")
        return v

    @model_validator(mode="after")
    def sans_getpass(self) -> "Exercice":
        # getpass est impossible sous Pyodide et a coute deux rendus en 2025.
        for champ in (self.enonce, self.depart, self.solution):
            if "getpass" in champ:
                raise ValueError("getpass est impossible sous Pyodide, il est banni")
        return self

    @model_validator(mode="after")
    def tests_coherents_avec_le_type(self) -> "Exercice":
        types = {t.type for t in self.tests}
        if self.type == "predire" and "qcm" not in types:
            raise ValueError("un exercice 'predire' exige un test 'qcm'")
        if self.type == "ecrire" and "interdit" not in types:
            raise ValueError(
                "un exercice 'ecrire' exige un motif 'interdit', sinon la reponse peut etre ecrite en dur"
            )
        return self


def charger_exercice(chemin: Path) -> Exercice:
    donnees = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    return Exercice(**donnees)


def charger_tous(racine: Path) -> list[Exercice]:
    return [charger_exercice(p) for p in sorted(racine.rglob("*.yaml"))]
