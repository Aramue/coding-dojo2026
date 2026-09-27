"""Efface le compte professeur. Les eleves et leur progression restent.

    docker compose exec api python -m app.oublier_prof

Apres, /prof propose de nouveau de creer le compte : a faire tout de suite,
puisque le premier arrive le prend. Voir ADR-014.
"""

from __future__ import annotations

from sqlmodel import Session

from .bdd import creer_schema, moteur
from .modeles import Reglage
from .securite import CLE_EMPREINTE


def oublier(session: Session) -> bool:
    ligne = session.get(Reglage, CLE_EMPREINTE)
    if ligne is None:
        return False
    session.delete(ligne)
    session.commit()
    return True


def main() -> None:
    # `moteur` est relu ici plutot que capture en argument par defaut : les
    # tests le remplacent par une base jetable.
    creer_schema(moteur)
    with Session(moteur) as session:
        if oublier(session):
            print("Compte professeur efface. Ouvre /prof pour en creer un nouveau, sans attendre.")
        else:
            print("Aucun compte professeur : rien a effacer.")


if __name__ == "__main__":
    main()
