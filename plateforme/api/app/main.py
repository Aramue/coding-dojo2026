from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .bdd import creer_schema
from .routes_eleve import routeur as routeur_eleve


@asynccontextmanager
async def cycle_de_vie(app: FastAPI):
    creer_schema()
    yield


application = FastAPI(title="Quartier General", lifespan=cycle_de_vie)
application.include_router(routeur_eleve)


@application.get("/sante")
def sante() -> dict:
    return {"etat": "ok"}
