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

# Sur la page du quiz, UN onglet tient DEUX sonnettes : celle de la coquille,
# qui garde le cours ferme, et celle de la partie. Six laissent donc trois
# onglets a un eleve, ou deux et un rechargement dont l'ancienne connexion
# n'est pas encore oubliee.
#
# Le plafond global ne suffisait pas : il se remplit par n'importe qui, donc un
# seul jeton pouvait prendre les deux cents places et laisser la classe entiere
# au repli, a relire chaque seconde. Avec six par eleve, vingt-quatre eleves au
# plafond en occupent cent quarante-quatre : personne ne peut plus priver les
# autres, ni le professeur, de leur sonnette.
MAX_PAR_ELEVE = 6

SONNERIE = {"type": "changement"}


class Diffuseur:
    def __init__(self, maximum: int = MAX_CONNEXIONS, par_eleve: int = MAX_PAR_ELEVE) -> None:
        self.maximum = maximum
        self.par_eleve = par_eleve
        # Indexe par id() : un WebSocket de Starlette est un Mapping, donc
        # non hachable, et ne peut pas servir de cle lui-meme.
        self._abonnes: dict[int, tuple[WebSocket, Role, str | None]] = {}

    def __len__(self) -> int:
        return len(self._abonnes)

    def inscrire(self, ws: WebSocket, role: Role, code_acces: str | None = None) -> bool:
        """Faux si le registre est plein, ou si cet eleve y a deja sa part.

        `code_acces` est celui du jeton presente : c'est lui qu'on compte, pas
        l'adresse IP, que toute la classe partage. Le professeur n'en a pas et
        n'est borne que par le plafond global — il a un tableau de bord, un
        ecran projete, et il a deja donne son mot de passe.
        """
        if len(self._abonnes) >= self.maximum:
            return False
        if code_acces is not None:
            siennes = sum(1 for _, _, code in self._abonnes.values() if code == code_acces)
            if siennes >= self.par_eleve:
                return False
        self._abonnes[id(ws)] = (ws, role, code_acces)
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
        for ws, role, _ in list(self._abonnes.values()):
            if role not in cibles:
                continue
            try:
                await ws.send_json(SONNERIE)
            except Exception:  # noqa: BLE001 — connexion morte, quelle que soit la forme
                # Un onglet ferme sans au revoir : on l'oublie. Sonner les
                # autres compte plus que savoir pourquoi celui-ci est tombe.
                self.retirer(ws)


diffuseur = Diffuseur()
