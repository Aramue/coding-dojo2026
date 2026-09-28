"""Test de charge du quiz : une classe simulee joue quelques questions.

A lancer HORS SEANCE, contre une instance deployee ou locale :

    python deploiement/charge_quiz.py --url http://localhost/api --mot-de-passe ...

Le mot de passe est celui du compte professeur (ADR-014) : le script ouvre une
session comme le ferait /prof, et n'envoie ensuite que le jeton rendu.

Le script inscrit N eleves d'essai (« Essai Charge 01 »...), ouvre leurs
sessions et leurs sonnettes, cree une partie, la fait jouer, puis TERMINE la
partie et RETIRE les eleves d'essai — leurs reponses partent avec eux. Il
refuse de demarrer si une partie est deja en cours : il ne derange jamais une
vraie seance.

Ce qu'il mesure, et ce qui compte en salle :

- le temps de reponse des POST /quiz/reponse quand toute la classe clique a
  la fois ;
- le delai entre « Question suivante » et la sonnette recue par chaque eleve —
  c'est ce que la salle percoit comme « la question arrive » ;
- les erreurs, qui doivent etre zero.

Ne remplace pas l'essai depuis une vraie salle : un proxy d'etablissement qui
refuse le WebSocket ne se simule pas d'ici. Voir ADR-016.

Dependances : httpx et websockets, deja installes avec l'API.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import statistics
import sys
import time

import httpx
import websockets

PREFIXE = "Essai"


def _ws(url: str) -> str:
    return url.replace("https://", "wss://").replace("http://", "ws://") + "/quiz/flux"


def _centiles(valeurs: list[float]) -> str:
    if not valeurs:
        return "aucune mesure"
    ordonnees = sorted(valeurs)
    p95 = ordonnees[min(len(ordonnees) - 1, round(0.95 * (len(ordonnees) - 1)))]
    return f"mediane {statistics.median(ordonnees):.0f} ms, p95 {p95:.0f} ms, max {ordonnees[-1]:.0f} ms"


class Sonnette:
    """La sonnette d'un eleve simule : note l'instant de chaque « changement »."""

    def __init__(self, url: str, presentation: dict) -> None:
        self.url, self.presentation = url, presentation
        self.sonneries: list[float] = []
        self.prete = asyncio.Event()
        self._tache: asyncio.Task | None = None

    async def _ecouter(self) -> None:
        async with websockets.connect(self.url, open_timeout=10) as ws:
            await ws.send(json.dumps(self.presentation))
            async for brut in ws:
                message = json.loads(brut)
                if message.get("type") == "pret":
                    self.prete.set()
                elif message.get("type") == "changement":
                    self.sonneries.append(time.perf_counter())

    def brancher(self) -> None:
        self._tache = asyncio.create_task(self._ecouter())

    async def debrancher(self) -> None:
        if self._tache:
            self._tache.cancel()
            await asyncio.gather(self._tache, return_exceptions=True)


async def jouer(url: str, mot_de_passe: str, nombre: int, questions: int) -> int:
    erreurs: list[str] = []
    codes: list[str] = []

    async with httpx.AsyncClient(base_url=url, timeout=15) as http:
        connexion = await http.post("/prof/connexion", json={"mot_de_passe": mot_de_passe})
        if connexion.status_code != 200:
            print(f"Connexion professeur refusee ({connexion.status_code}) : {connexion.text[:80]}")
            return 2
        prof = {"X-Jeton-Prof": connexion.json()["jeton"]}

        courante = (await http.get("/prof/quiz/partie", headers=prof)).raise_for_status().json()
        if courante.get("partie") and courante.get("phase") != "terminee":
            print("Une partie est en cours : le test de charge ne la derange pas. Abandon.")
            return 2

        catalogue = (await http.get("/prof/quiz", headers=prof)).raise_for_status().json()["quiz"]
        if not catalogue:
            print("Aucun quiz construit sur cette instance. Abandon.")
            return 2
        quiz = catalogue[0]
        questions = min(questions, quiz["questions"])

        sonnettes: list[Sonnette] = []
        try:
            for i in range(1, nombre + 1):
                cree = await http.post(
                    "/prof/eleves", json={"prenom": PREFIXE, "nom": f"Charge {i:02d}"}, headers=prof
                )
                codes.append(cree.raise_for_status().json()["code_acces"])
            jetons = [
                (await http.post("/session", json={"code_acces": c})).raise_for_status().json()["jeton"]
                for c in codes
            ]
            eleves = [{"Authorization": f"Bearer {j}"} for j in jetons]

            sonnettes = [Sonnette(_ws(url), {"jeton": j}) for j in jetons]
            for s in sonnettes:
                s.brancher()
            await asyncio.wait_for(asyncio.gather(*(s.prete.wait() for s in sonnettes)), 15)
            print(f"{nombre} eleves d'essai inscrits, sonnettes branchees.")

            partie = (
                await http.post("/prof/quiz/parties", json={"quiz_id": quiz["id"]}, headers=prof)
            ).raise_for_status().json()["partie"]
            await asyncio.gather(*(http.post("/quiz/rejoindre", headers=e) for e in eleves))

            durees_reponse: list[float] = []
            delais_sonnette: list[float] = []

            async def repondre(entetes: dict, rang: int, nb_options: int) -> None:
                await asyncio.sleep(random.uniform(0.2, 2.0))
                debut = time.perf_counter()
                r = await http.post(
                    "/quiz/reponse",
                    json={"partie": partie, "question": rang, "choix": random.randrange(nb_options)},
                    headers=entetes,
                )
                durees_reponse.append((time.perf_counter() - debut) * 1000)
                if r.status_code != 200:
                    erreurs.append(f"reponse {rang} : {r.status_code} {r.text[:80]}")

            for rang in range(questions):
                for s in sonnettes:
                    s.sonneries.clear()
                debut = time.perf_counter()
                vue = (
                    await http.post(
                        "/prof/quiz/partie/suivante", json={"question": rang - 1}, headers=prof
                    )
                ).raise_for_status().json()
                await asyncio.sleep(0.5)
                for s in sonnettes:
                    if s.sonneries:
                        delais_sonnette.append((s.sonneries[0] - debut) * 1000)
                    else:
                        erreurs.append(f"question {rang} : une sonnette n'a pas sonne")

                nb_options = len(vue["question"]["options"])
                await asyncio.gather(*(repondre(e, rang, nb_options) for e in eleves))
                phase = (await http.get("/prof/quiz/partie", headers=prof)).json()["phase"]
                if phase != "correction":
                    erreurs.append(f"question {rang} : phase {phase} au lieu de correction")
                print(f"question {rang + 1} jouee")

            print()
            print(f"Reponses (POST /quiz/reponse, {len(durees_reponse)}) : {_centiles(durees_reponse)}")
            print(f"Sonnette apres « suivante » ({len(delais_sonnette)}) : {_centiles(delais_sonnette)}")
        finally:
            for s in sonnettes:
                await s.debrancher()
            await http.post("/prof/quiz/partie/terminer", headers=prof)
            for code in codes:
                await http.delete(f"/prof/eleves/{code}", headers=prof)
            print(f"Nettoye : partie terminee, {len(codes)} eleves d'essai retires.")

    for e in erreurs:
        print(f"  ERREUR  {e}")
    print("Aucune erreur." if not erreurs else f"{len(erreurs)} erreur(s).")
    return 1 if erreurs else 0


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Test de charge du quiz en direct.")
    parseur.add_argument("--url", default="http://localhost/api", help="racine de l'API")
    parseur.add_argument("--mot-de-passe", required=True, help="mot de passe du compte professeur")
    parseur.add_argument("--eleves", type=int, default=24)
    parseur.add_argument("--questions", type=int, default=3)
    arguments = parseur.parse_args()
    return asyncio.run(
        jouer(arguments.url.rstrip("/"), arguments.mot_de_passe, arguments.eleves, arguments.questions)
    )


if __name__ == "__main__":
    sys.exit(principal())
