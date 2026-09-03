"""Jetons de session. Pas de mot de passe : le code d'agent EST le secret."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import warnings

_fourni = os.environ.get("QG_SECRET")
if _fourni:
    SECRET = _fourni.encode()
else:
    # Aucun secret en dur dans le depot. Un secret publie permettrait de forger un
    # jeton valide pour n'importe quel AGENT-XXXX, y compris un agent jamais cree.
    # A defaut de configuration, on tire un secret aleatoire : les jetons ne
    # survivent pas a un redemarrage, ce qui est visible et sans danger,
    # contrairement a une cle que tout le monde peut lire.
    SECRET = secrets.token_bytes(32)
    warnings.warn(
        "QG_SECRET n'est pas defini : un secret aleatoire a ete tire pour cette "
        "execution. Les sessions ne survivront pas a un redemarrage. "
        "Definis QG_SECRET en production.",
        stacklevel=2,
    )


def creer_jeton(code_agent: str) -> str:
    signature = hmac.new(SECRET, code_agent.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{code_agent}.{signature}"


def lire_jeton(jeton: str) -> str | None:
    """Renvoie le code d'agent si la signature est valide, sinon None."""
    code, _, signature = jeton.partition(".")
    if not code or not signature:
        return None
    attendue = hmac.new(SECRET, code.encode(), hashlib.sha256).hexdigest()[:32]
    return code if hmac.compare_digest(signature, attendue) else None
