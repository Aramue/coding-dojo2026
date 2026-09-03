from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

from sqlmodel import Session, SQLModel, create_engine

URL = os.environ.get("QG_BDD", "sqlite:///./donnees/qg.db")

# SQLite ne cree pas le dossier parent : sans cela, le premier demarrage echoue,
# y compris sous TestClient qui declenche le cycle de vie de l'application.
if URL.startswith("sqlite:///") and ":memory:" not in URL:
    Path(URL.removeprefix("sqlite:///")).parent.mkdir(parents=True, exist_ok=True)

moteur = create_engine(URL, connect_args={"check_same_thread": False})


def creer_schema() -> None:
    SQLModel.metadata.create_all(moteur)


def obtenir_session() -> Iterator[Session]:
    with Session(moteur) as session:
        yield session
