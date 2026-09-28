"""Verrouille la tolerance de l'echeance entre l'API et le navigateur.

Le serveur refuse une reponse arrivee apres `fin_a + TOLERANCE` et deduit la
correction du meme instant ; l'ecran relit a `fin_a + TOLERANCE_MS` pour la
trouver. Si les deux valeurs divergent, l'ecran relit trop tot et reste sur
une question close, ou verrouille ses boutons alors que le serveur accepte
encore. C'est la seconde duplication deliberee du projet, apres les deux
normaliseurs : ce test la garde honnete.
"""

import re
from pathlib import Path

from app.quiz import TOLERANCE

HORLOGE = Path(__file__).resolve().parents[2] / "web" / "src" / "quiz" / "horloge.ts"


def test_la_tolerance_est_la_meme_des_deux_cotes():
    trouvee = re.search(r"export const TOLERANCE_MS = (\d+)", HORLOGE.read_text(encoding="utf-8"))
    assert trouvee, "TOLERANCE_MS introuvable dans horloge.ts"
    assert int(trouvee.group(1)) == TOLERANCE.total_seconds() * 1000
