"""Vérifie moyenne.py. Lance-le avec `python test_moyenne.py`."""

from moyenne import moyenne

assert moyenne([10, 20]) == 15, "la moyenne de 10 et 20 doit valoir 15"
assert moyenne([12, 15, 9, 17]) == 13.2, "la moyenne arrondie à une décimale doit valoir 13.2"

print("Tout est bon.")
