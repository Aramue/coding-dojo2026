from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .bdd import creer_schema
from .eleves import routeur as routeur_eleves_prof
from .routes_eleve import routeur as routeur_eleve
from .routes_prof import routeur as routeur_prof


@asynccontextmanager
async def cycle_de_vie(app: FastAPI):
    creer_schema()
    yield


application = FastAPI(title="Coding Dojo", lifespan=cycle_de_vie)
application.include_router(routeur_eleve)
application.include_router(routeur_prof)
application.include_router(routeur_eleves_prof)


@application.get("/sante")
def sante() -> dict:
    return {"etat": "ok"}
