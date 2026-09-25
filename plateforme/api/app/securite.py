"""Les secrets de l'instance et les jetons de session.

Aucun secret ne vient de l'environnement. La cle qui signe les jetons est
tiree au premier besoin et rangee en base : elle survit aux redemarrages et
part avec la sauvegarde du fichier SQLite. Voir ADR-014.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from .modeles import Reglage

CLE_SECRET = "secret"
CLE_EMPREINTE = "empreinte_prof"


def lire_reglage(session: Session, cle: str) -> str | None:
    ligne = session.get(Reglage, cle)
    return ligne.valeur if ligne is not None else None


def ecrire_reglage_neuf(session: Session, cle: str, valeur: str) -> bool:
    """Ecrit la valeur si la cle n'existe pas. Faux si elle existait deja.

    Deux requetes simultanees peuvent toutes deux constater l'absence : la
    cle primaire tranche, et la seconde perd sans rien ecraser.
    """
    if lire_reglage(session, cle) is not None:
        return False
    session.add(Reglage(cle=cle, valeur=valeur))
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        return False
    return True


def secret(session: Session) -> bytes:
    valeur = lire_reglage(session, CLE_SECRET)
    if valeur is None:
        ecrire_reglage_neuf(session, CLE_SECRET, secrets.token_hex(32))
        valeur = lire_reglage(session, CLE_SECRET)
    assert valeur is not None
    return bytes.fromhex(valeur)


def signer(cle: bytes, message: str) -> str:
    return hmac.new(cle, message.encode(), hashlib.sha256).hexdigest()[:32]


def creer_jeton(session: Session, code_acces: str) -> str:
    return f"{code_acces}.{signer(secret(session), code_acces)}"


def lire_jeton(session: Session, jeton: str) -> str | None:
    """Renvoie le code d'acces si la signature est valide, sinon None."""
    code, _, signature = jeton.partition(".")
    if not code or not signature:
        return None
    attendue = signer(secret(session), code)
    return code if hmac.compare_digest(signature, attendue) else None
