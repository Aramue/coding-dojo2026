"""La sonnette du quiz : le registre des WebSocket ouverts. Voir ADR-016.

Elle ne transporte qu'un message, `{"type": "changement"}`, qui dit « relis ».
Les donnees passent toujours par les GET ordinaires : une sonnette perdue
coute au pire une relecture de surete, jamais un etat faux.

> [!danger] Un seul processus uvicorn
> Le registre vit en memoire. Avec plusieurs processus, une ecriture recue par
> l'un ne ferait pas sonner les ecrans branches sur l'autre.
"""

from __future__ import annotations

from typing import Literal

from fastapi import WebSocket

Role = Literal["eleve", "prof"]

# Vingt-quatre eleves, un professeur, quelques onglets rouverts : deux cents
# laisse de la marge sans laisser quiconque ouvrir des milliers de connexions.
MAX_CONNEXIONS = 200

SONNERIE = {"type": "changement"}


class Diffuseur:
    def __init__(self, maximum: int = MAX_CONNEXIONS) -> None:
        self.maximum = maximum
        # Indexe par id() : un WebSocket de Starlette est un Mapping, donc
        # non hachable, et ne peut pas servir de cle lui-meme.
        self._abonnes: dict[int, tuple[WebSocket, Role]] = {}

    def __len__(self) -> int:
        return len(self._abonnes)

    def inscrire(self, ws: WebSocket, role: Role) -> bool:
        if len(self._abonnes) >= self.maximum:
            return False
        self._abonnes[id(ws)] = (ws, role)
        return True

    def retirer(self, ws: WebSocket) -> None:
        self._abonnes.pop(id(ws), None)

    async def sonner(self, *roles: Role) -> None:
        """Previent les abonnes des roles donnes, ou tout le monde.

        Les reponses des eleves ne sonnent que chez le professeur : un eleve
        n'a pas besoin de savoir que son voisin a repondu, et vingt-quatre
        relectures par reponse ne serviraient a personne.
        """
        cibles = roles or ("eleve", "prof")
        for ws, role in list(self._abonnes.values()):
            if role not in cibles:
                continue
            try:
                await ws.send_json(SONNERIE)
            except Exception:  # noqa: BLE001 — connexion morte, quelle que soit la forme
                # Un onglet ferme sans au revoir : on l'oublie. Sonner les
                # autres compte plus que savoir pourquoi celui-ci est tombe.
                self.retirer(ws)


diffuseur = Diffuseur()
