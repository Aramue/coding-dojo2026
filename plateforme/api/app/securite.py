"""Les secrets de l'instance et les jetons de session.

Aucun secret ne vient de l'environnement. La cle qui signe les jetons est
tiree au premier besoin et rangee en base : elle survit aux redemarrages et
part avec la sauvegarde du fichier SQLite. Voir ADR-014.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from .modeles import Reglage

CLE_SECRET = "secret"
CLE_EMPREINTE = "empreinte_prof"

# scrypt, fourni par hashlib : lent et gourmand en memoire expres. 2**14 et 8
# font 16 Mio et quelques dizaines de millisecondes par essai : rien pour une
# connexion, beaucoup pour qui essaierait un dictionnaire.
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1

DUREE_JETON_PROF_S = 12 * 3600


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


def _scrypt(mot_de_passe: str, sel: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(mot_de_passe.encode(), salt=sel, n=n, r=r, p=p, dklen=32)


def hacher(mot_de_passe: str) -> str:
    """L'empreinte porte ses parametres : on pourra les durcir sans rien casser."""
    sel = secrets.token_bytes(16)
    empreinte = _scrypt(mot_de_passe, sel, SCRYPT_N, SCRYPT_R, SCRYPT_P)
    return f"scrypt${SCRYPT_N}${SCRYPT_R}${SCRYPT_P}${sel.hex()}${empreinte.hex()}"


def verifier_mot_de_passe(mot_de_passe: str, stockee: str) -> bool:
    _, n, r, p, sel, attendue = stockee.split("$")
    calculee = _scrypt(mot_de_passe, bytes.fromhex(sel), int(n), int(r), int(p))
    return hmac.compare_digest(calculee.hex(), attendue)


def creer_jeton_prof(session: Session, maintenant: float | None = None) -> str:
    """Un jeton de douze heures, signe avec l'empreinte du mot de passe.

    L'empreinte dans la signature : un compte efface puis recree ferme toutes
    les sessions ouvertes avec l'ancien mot de passe, sans rien stocker de plus.
    """
    instant = time.time() if maintenant is None else maintenant
    expire = int(instant + DUREE_JETON_PROF_S)
    empreinte = lire_reglage(session, CLE_EMPREINTE) or ""
    return f"prof.{expire}.{signer(secret(session), f'prof.{expire}.{empreinte}')}"


def jeton_prof_valide(session: Session, jeton: str, maintenant: float | None = None) -> bool:
    prefixe, _, reste = jeton.partition(".")
    expire, _, signature = reste.partition(".")
    if prefixe != "prof" or not expire.isdigit() or not signature:
        return False
    instant = time.time() if maintenant is None else maintenant
    if int(expire) < instant:
        return False
    empreinte = lire_reglage(session, CLE_EMPREINTE)
    if empreinte is None:
        return False
    attendue = signer(secret(session), f"prof.{expire}.{empreinte}")
    return hmac.compare_digest(signature, attendue)
