"""Jetons de session. Pas de mot de passe : le code d'agent EST le secret."""

from __future__ import annotations

import hashlib
import hmac
import os

SECRET = os.environ.get("QG_SECRET", "dev-uniquement-a-remplacer-en-production").encode()


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
