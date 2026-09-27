---
title: Plan compte professeur
tags:
  - plan
  - implementation
statut: exécuté
date: 2026-09-25
---

# Compte professeur au premier lancement — Plan d'implémentation

> **Exécution :** en ligne, tâche par tâche, un commit par tâche. Les cases `- [ ]` servent au
> suivi.

**Goal:** Plus aucun secret dans le `.env` : l'instance tire sa clé de jetons en base, et `/prof` propose de créer le compte professeur tant qu'il n'en existe pas.

**Architecture:** Une table `reglage` (clé, valeur) porte la clé des jetons et l'empreinte scrypt du mot de passe. Trois routes publiques (`GET/POST /prof/compte`, `POST /prof/connexion`) rendent un jeton professeur signé, valable douze heures, qui remplace l'en-tête `X-Code-Prof` par `X-Jeton-Prof`. Côté front, la porte de `/prof` demande d'abord à l'API si le compte existe, puis affiche la création ou la connexion.

**Tech Stack:** FastAPI · SQLModel · SQLite · `hashlib.scrypt` (bibliothèque standard) · React 19 · TypeScript · Vitest · Docker Compose

Décision de référence : [[ADR-014 Le compte professeur se crée au premier lancement]].

## Global Constraints

- **Aucune dépendance nouvelle**, ni en Python ni en JavaScript. scrypt vient de `hashlib`.
- **Aucun secret dans l'environnement** : ni `DOJO_SECRET` ni `DOJO_CODE_PROF` ne sont plus lus nulle part.
- Mot de passe : **12 caractères au minimum, 200 au maximum**, validé **côté serveur** ([[ADR-008 Validation serveur des champs libres]]).
- Jeton professeur : **douze heures**, signé avec la clé de l'instance **et l'empreinte du mot de passe**.
- En-tête des routes professeur : `X-Jeton-Prof`. Clé de `sessionStorage` : `dojo.jeton-prof`.
- Premier arrivé : la création est ouverte tant qu'aucun compte n'existe, sans limite de temps.
- Commande de secours : `docker compose exec api python -m app.oublier_prof`.
- Le Python de l'API reste en ASCII dans ses commentaires et ses messages, comme le reste de `api/`.
- Français correctement accentué dans tout ce que lit le professeur.
- Aucun mot de passe tapé par l'agent dans un navigateur : la vérification visuelle passe par des réponses simulées, et le compte réel est créé par le professeur.

---

### Tâche 1 : la clé des jetons vit en base

**Files:**
- Modify: `plateforme/api/app/modeles.py`
- Modify: `plateforme/api/app/securite.py` (réécrit)
- Modify: `plateforme/api/app/routes_eleve.py:87-117`
- Create: `plateforme/api/tests/test_securite.py`

**Interfaces:**
- Produces: `Reglage(cle: str, valeur: str)` ; `lire_reglage(session, cle) -> str | None` ; `ecrire_reglage_neuf(session, cle, valeur) -> bool` ; `secret(session) -> bytes` ; `creer_jeton(session, code_acces) -> str` ; `lire_jeton(session, jeton) -> str | None` ; constantes `CLE_SECRET = "secret"`, `CLE_EMPREINTE = "empreinte_prof"`.

- [x] **Étape 1 : écrire les tests qui échouent** — `tests/test_securite.py`

```python
"""Les secrets de l'instance. Voir ADR-014."""

from app.modeles import Reglage
from app.securite import CLE_SECRET, creer_jeton, ecrire_reglage_neuf, lire_jeton, secret


def test_la_cle_est_tiree_au_premier_besoin_puis_gardee(session_test):
    assert session_test.get(Reglage, CLE_SECRET) is None
    premiere = secret(session_test)
    assert len(premiere) == 32
    assert secret(session_test) == premiere


def test_un_jeton_eleve_se_relit_avec_la_cle_de_la_base(session_test):
    jeton = creer_jeton(session_test, "DOJO-K7M2")
    assert lire_jeton(session_test, jeton) == "DOJO-K7M2"


def test_changer_la_cle_invalide_les_jetons(session_test):
    jeton = creer_jeton(session_test, "DOJO-K7M2")
    ligne = session_test.get(Reglage, CLE_SECRET)
    ligne.valeur = "00" * 32
    session_test.add(ligne)
    session_test.commit()
    assert lire_jeton(session_test, jeton) is None


def test_une_valeur_deja_ecrite_n_est_jamais_remplacee(session_test):
    assert ecrire_reglage_neuf(session_test, "essai", "premiere") is True
    assert ecrire_reglage_neuf(session_test, "essai", "seconde") is False
    assert session_test.get(Reglage, "essai").valeur == "premiere"


def test_la_cle_ne_vient_plus_de_l_environnement(monkeypatch, session_test):
    monkeypatch.setenv("DOJO_SECRET", "ceci-ne-doit-plus-servir")
    assert secret(session_test) != b"ceci-ne-doit-plus-servir"
```

- [x] **Étape 2 : les lancer** — `cd plateforme/api && python -m pytest tests/test_securite.py -q`
  Attendu : échec à l'import (`Reglage`, `ecrire_reglage_neuf` n'existent pas).

- [x] **Étape 3 : la table** — ajouter à la fin de `modeles.py` :

```python
class Reglage(SQLModel, table=True):
    """Ce que l'instance tire ou recoit une fois pour toutes.

    La cle qui signe les jetons, tiree au premier besoin, et l'empreinte du
    mot de passe professeur, ecrite a la creation du compte. Rien de tout cela
    ne vient plus de l'environnement : voir ADR-014.
    """

    cle: str = Field(primary_key=True)
    valeur: str
```

- [x] **Étape 4 : réécrire `securite.py`** (la partie jetons élèves ; le mot de passe arrive en tâche 2)

```python
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
```

- [x] **Étape 5 : `routes_eleve.py` passe la session** — `eleve_courant` reçoit la session et la transmet ; `ouvrir_session` appelle `creer_jeton(session, demande.code_acces)`.

```python
def eleve_courant(
    session: Annotated[Session, Depends(obtenir_session)],
    authorization: Annotated[str | None, Header()] = None,
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Jeton absent")
    code = lire_jeton(session, authorization.removeprefix("Bearer "))
    if not code:
        raise HTTPException(401, "Jeton invalide")
    return code
```

- [x] **Étape 6 : lancer toute la suite** — `python -m pytest -q`. Attendu : tout passe (les tests professeur utilisent encore `X-Code-Prof`, inchangé à ce stade).

- [x] **Étape 7 : commit** — `feat(api): la cle des jetons est tiree en base, plus lue dans l'environnement`

---

### Tâche 2 : le compte professeur côté API

**Files:**
- Modify: `plateforme/api/app/securite.py` (ajouts)
- Create: `plateforme/api/app/compte.py`
- Create: `plateforme/api/app/oublier_prof.py`
- Modify: `plateforme/api/app/routes_prof.py:1-42`
- Modify: `plateforme/api/app/main.py`
- Modify: `plateforme/api/tests/conftest.py`, `tests/test_eleves.py`, `tests/test_routes_prof.py`
- Create: `plateforme/api/tests/test_compte.py`

**Interfaces:**
- Consumes: `lire_reglage`, `ecrire_reglage_neuf`, `secret`, `signer`, `CLE_EMPREINTE` (tâche 1).
- Produces: `hacher(mot_de_passe) -> str` ; `verifier_mot_de_passe(mot_de_passe, empreinte) -> bool` ; `creer_jeton_prof(session, maintenant: float | None = None) -> str` ; `jeton_prof_valide(session, jeton, maintenant: float | None = None) -> bool` ; `DUREE_JETON_PROF_S = 12 * 3600` ; routes `GET /prof/compte -> {"existe": bool}`, `POST /prof/compte {mot_de_passe} -> 201 {"jeton"}` (409 si un compte existe), `POST /prof/connexion {mot_de_passe} -> {"jeton"}` (401 faux, 404 aucun compte) ; `verifier_prof` lit l'en-tête `X-Jeton-Prof` ; `oublier(session) -> bool`.

- [x] **Étape 1 : la fixture** — dans `conftest.py`, retirer le `os.environ.setdefault("DOJO_CODE_PROF", ...)` et son commentaire, et ajouter :

```python
MOT_DE_PASSE_TEST = "mot-de-passe-de-test"


@pytest.fixture(name="entetes_prof")
def fixture_entetes_prof(client):
    """Cree le compte professeur, comme au premier lancement, et rend l'en-tete."""
    reponse = client.post("/prof/compte", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    return {"X-Jeton-Prof": reponse.json()["jeton"]}
```

- [x] **Étape 2 : les tests du compte** — `tests/test_compte.py`

```python
"""Le compte professeur : premier lancement, connexion, oubli. Voir ADR-014."""

from app.oublier_prof import oublier
from app.securite import (
    DUREE_JETON_PROF_S,
    creer_jeton_prof,
    hacher,
    jeton_prof_valide,
    verifier_mot_de_passe,
)
from conftest import MOT_DE_PASSE_TEST


def test_au_premier_lancement_aucun_compte_n_existe(client):
    assert client.get("/prof/compte").json() == {"existe": False}


def test_creer_le_compte_rend_un_jeton_qui_ouvre_le_tableau(client):
    reponse = client.post("/prof/compte", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    assert reponse.status_code == 201
    entetes = {"X-Jeton-Prof": reponse.json()["jeton"]}
    assert client.get("/prof/seance", headers=entetes).status_code == 200
    assert client.get("/prof/compte").json() == {"existe": True}


def test_un_second_compte_est_refuse(client, entetes_prof):
    reponse = client.post("/prof/compte", json={"mot_de_passe": "un-autre-mot-de-passe"})
    assert reponse.status_code == 409


def test_un_mot_de_passe_trop_court_est_refuse_par_le_serveur(client):
    assert client.post("/prof/compte", json={"mot_de_passe": "a" * 11}).status_code == 422
    assert client.get("/prof/compte").json() == {"existe": False}


def test_un_mot_de_passe_demesure_est_refuse(client):
    assert client.post("/prof/compte", json={"mot_de_passe": "a" * 201}).status_code == 422


def test_un_champ_inconnu_est_refuse(client):
    corps = {"mot_de_passe": MOT_DE_PASSE_TEST, "role": "admin"}
    assert client.post("/prof/compte", json=corps).status_code == 422


def test_le_bon_mot_de_passe_ouvre_une_session(client, entetes_prof):
    reponse = client.post("/prof/connexion", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    assert reponse.status_code == 200
    entetes = {"X-Jeton-Prof": reponse.json()["jeton"]}
    assert client.get("/prof/eleves", headers=entetes).status_code == 200


def test_un_mauvais_mot_de_passe_est_refuse(client, entetes_prof):
    reponse = client.post("/prof/connexion", json={"mot_de_passe": "ce-n-est-pas-le-bon"})
    assert reponse.status_code == 401


def test_se_connecter_sans_compte_renvoie_a_la_creation(client):
    reponse = client.post("/prof/connexion", json={"mot_de_passe": MOT_DE_PASSE_TEST})
    assert reponse.status_code == 404


def test_le_mot_de_passe_n_est_jamais_stocke_en_clair(session_test, entetes_prof):
    from app.modeles import Reglage

    for ligne in session_test.exec(__import__("sqlmodel").select(Reglage)).all():
        assert MOT_DE_PASSE_TEST not in ligne.valeur


def test_l_empreinte_se_verifie_et_ne_se_repete_pas():
    premiere, seconde = hacher("mot-de-passe-long"), hacher("mot-de-passe-long")
    assert premiere != seconde  # sel different a chaque fois
    assert verifier_mot_de_passe("mot-de-passe-long", premiere)
    assert not verifier_mot_de_passe("mot-de-passe-lonG", premiere)


def test_un_jeton_prof_expire_au_bout_de_douze_heures(session_test, entetes_prof):
    jeton = creer_jeton_prof(session_test, maintenant=1_000_000.0)
    assert jeton_prof_valide(session_test, jeton, maintenant=1_000_000.0 + DUREE_JETON_PROF_S - 1)
    assert not jeton_prof_valide(session_test, jeton, maintenant=1_000_000.0 + DUREE_JETON_PROF_S + 1)


def test_un_jeton_prof_retouche_est_refuse(client, entetes_prof):
    prefixe, expire, signature = entetes_prof["X-Jeton-Prof"].split(".")
    plus_tard = f"{prefixe}.{int(expire) + 86400}.{signature}"
    assert client.get("/prof/seance", headers={"X-Jeton-Prof": plus_tard}).status_code == 401


def test_un_jeton_eleve_n_ouvre_pas_le_tableau(client, inscrire, entetes_prof):
    inscrire("DOJO-K7M2")
    jeton = client.post("/session", json={"code_acces": "DOJO-K7M2"}).json()["jeton"]
    assert client.get("/prof/seance", headers={"X-Jeton-Prof": jeton}).status_code == 401


def test_oublier_le_compte_ferme_les_sessions_et_rouvre_la_creation(client, session_test, entetes_prof):
    assert oublier(session_test) is True
    assert client.get("/prof/compte").json() == {"existe": False}
    assert client.get("/prof/seance", headers=entetes_prof).status_code == 401


def test_un_compte_recree_n_accepte_pas_les_anciens_jetons(client, session_test, entetes_prof):
    oublier(session_test)
    client.post("/prof/compte", json={"mot_de_passe": "nouveau-mot-de-passe"})
    assert client.get("/prof/seance", headers=entetes_prof).status_code == 401


def test_oublier_sans_compte_ne_fait_rien(session_test):
    assert oublier(session_test) is False


def test_oublier_laisse_les_eleves_en_place(client, session_test, inscrire, entetes_prof):
    inscrire("DOJO-K7M2")
    oublier(session_test)
    assert client.post("/session", json={"code_acces": "DOJO-K7M2"}).status_code == 200
```

- [x] **Étape 3 : les lancer** — `python -m pytest tests/test_compte.py -q`. Attendu : échec à l'import (`app.oublier_prof`, `hacher`…).

- [x] **Étape 4 : le mot de passe et le jeton professeur** — ajouter à `securite.py` (et `import time`) :

```python
# scrypt, fourni par hashlib : lent et gourmand en memoire expres. 2**14 et 8
# font 16 Mio et quelques dizaines de millisecondes par essai : rien pour une
# connexion, beaucoup pour qui essaierait un dictionnaire.
SCRYPT_N, SCRYPT_R, SCRYPT_P = 2**14, 8, 1

DUREE_JETON_PROF_S = 12 * 3600


def _scrypt(mot_de_passe: str, sel: bytes, n: int, r: int, p: int) -> bytes:
    return hashlib.scrypt(mot_de_passe.encode(), salt=sel, n=n, r=r, p=p, dklen=32)


def hacher(mot_de_passe: str) -> str:
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
```

- [x] **Étape 5 : les routes** — `app/compte.py`

```python
"""Le compte professeur : le creer au premier lancement, puis s'y connecter.

Ce sont les seules routes de /prof ouvertes sans jeton : on ne peut pas en
avoir un avant d'avoir un compte. Tant qu'aucun compte n'existe, le premier
qui ouvre /prof le cree — un risque accepte et documente dans ADR-014.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session

from .bdd import obtenir_session
from .securite import (
    CLE_EMPREINTE,
    creer_jeton_prof,
    ecrire_reglage_neuf,
    hacher,
    lire_reglage,
    verifier_mot_de_passe,
)

routeur = APIRouter(prefix="/prof")

MIN_MOT_DE_PASSE = 12
MAX_MOT_DE_PASSE = 200


class DemandeCreation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mot_de_passe: str = Field(min_length=MIN_MOT_DE_PASSE, max_length=MAX_MOT_DE_PASSE)


class DemandeConnexion(BaseModel):
    """Pas de longueur minimale ici : un mot de passe trop court est simplement faux."""

    model_config = ConfigDict(extra="forbid")

    mot_de_passe: str = Field(min_length=1, max_length=MAX_MOT_DE_PASSE)


@routeur.get("/compte")
def etat_du_compte(session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    return {"existe": lire_reglage(session, CLE_EMPREINTE) is not None}


@routeur.post("/compte", status_code=201)
def creer_le_compte(
    demande: DemandeCreation, session: Annotated[Session, Depends(obtenir_session)]
) -> dict:
    if not ecrire_reglage_neuf(session, CLE_EMPREINTE, hacher(demande.mot_de_passe)):
        raise HTTPException(409, "Un compte professeur existe deja")
    return {"jeton": creer_jeton_prof(session)}


@routeur.post("/connexion")
def se_connecter(
    demande: DemandeConnexion, session: Annotated[Session, Depends(obtenir_session)]
) -> dict:
    empreinte = lire_reglage(session, CLE_EMPREINTE)
    if empreinte is None:
        raise HTTPException(404, "Aucun compte professeur")
    if not verifier_mot_de_passe(demande.mot_de_passe, empreinte):
        raise HTTPException(401, "Mot de passe incorrect")
    return {"jeton": creer_jeton_prof(session)}
```

- [x] **Étape 6 : la commande de secours** — `app/oublier_prof.py`

```python
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
    creer_schema()
    with Session(moteur) as session:
        if oublier(session):
            print("Compte professeur efface. Ouvre /prof pour en creer un nouveau, sans attendre.")
        else:
            print("Aucun compte professeur : rien a effacer.")


if __name__ == "__main__":
    main()
```

- [x] **Étape 7 : la porte des routes professeur** — dans `routes_prof.py`, supprimer le bloc `CODE_PROF` et les imports `os`, `secrets`, `warnings`, `hmac`, puis :

```python
from .securite import jeton_prof_valide


def verifier_prof(
    session: Annotated[Session, Depends(obtenir_session)],
    x_jeton_prof: Annotated[str | None, Header()] = None,
) -> None:
    if not x_jeton_prof or not jeton_prof_valide(session, x_jeton_prof):
        raise HTTPException(401, "Session professeur absente ou expiree")
```

  Et dans `main.py` : `from .compte import routeur as routeur_compte` puis `application.include_router(routeur_compte)`.

- [x] **Étape 8 : les tests existants passent au jeton** — dans `test_eleves.py` et `test_routes_prof.py` : supprimer `ENTETES`, remplacer `headers=ENTETES` par `headers=entetes_prof`, ajouter `entetes_prof` aux paramètres de chaque test qui l'emploie ou qui appelle `creer(`, et donner au helper `creer` la signature `creer(client, entetes, prenom="Camille", **champs)` (appels : `creer(client, entetes_prof, ...)`). Remplacer `{"X-Code-Prof": "faux"}` par `{"X-Jeton-Prof": "prof.9999999999.faux"}`. Supprimer `test_le_code_prof_par_defaut_n_est_pas_devinable` : il n'y a plus de code par défaut.

- [x] **Étape 9 : toute la suite** — `python -m pytest -q`. Attendu : tout passe.

- [x] **Étape 10 : commit** — `feat(api): le compte professeur se cree au premier lancement`

---

### Tâche 3 : la porte de `/prof`

**Files:**
- Create: `plateforme/web/src/prof/compte.ts`
- Modify: `plateforme/web/src/ui/EcranProf.tsx` (la porte réécrite), `EcranProf.css`
- Modify: `plateforme/web/src/ui/TableauDeBord.tsx` (`codeProf` → `jetonProf`, `onRefuse`)
- Modify: `plateforme/web/src/ui/Classe.tsx`, `src/prof/classe.ts` (`codeProf` → `jetonProf`, en-tête `X-Jeton-Prof`)
- Test: `tests/prof/compte.test.ts` (nouveau), `tests/ui/EcranProf.test.tsx` (réécrit), `tests/ui/TableauDeBord.test.tsx`, `tests/ui/Classe.test.tsx`, `tests/ui/app.test.tsx`

**Interfaces:**
- Consumes: les routes de la tâche 2.
- Produces: `compteExiste(): Promise<boolean>` ; `creerCompte(motDePasse): Promise<string>` ; `seConnecter(motDePasse): Promise<string>` ; `LONGUEUR_MIN = 12` ; `TableauDeBord({ jetonProf, onApercu?, onRefuse? })` ; `Classe({ jetonProf })`.

- [x] **Étape 1 : le client** — `src/prof/compte.ts`

```ts
/**
 * Le compte professeur : savoir s'il existe, le créer, s'y connecter.
 *
 * Le mot de passe ne part que d'ici, et une seule fois : tout le reste du
 * tableau de bord voyage avec le jeton rendu. Voir ADR-014.
 */

/** Doit rester égal à MIN_MOT_DE_PASSE côté API. Le serveur tranche. */
export const LONGUEUR_MIN = 12

export async function compteExiste(): Promise<boolean> {
  const reponse = await fetch('/api/prof/compte')
  if (!reponse.ok) throw new Error('La plateforme ne répond pas.')
  const donnees = (await reponse.json()) as { existe?: unknown }
  if (typeof donnees?.existe !== 'boolean') throw new Error('Réponse inattendue de la plateforme.')
  return donnees.existe
}

async function demanderJeton(chemin: 'compte' | 'connexion', motDePasse: string): Promise<string> {
  const reponse = await fetch(`/api/prof/${chemin}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mot_de_passe: motDePasse }),
  })
  if (reponse.status === 401) throw new Error('Mot de passe incorrect.')
  if (reponse.status === 404) throw new Error("Aucun compte professeur n'existe. Recharge la page pour le créer.")
  if (reponse.status === 409) throw new Error('Un compte professeur existe déjà. Recharge la page pour te connecter.')
  if (reponse.status === 422) throw new Error(`Le mot de passe doit faire au moins ${LONGUEUR_MIN} caractères.`)
  if (!reponse.ok) throw new Error(`La plateforme a refusé (erreur ${reponse.status}).`)
  const donnees = (await reponse.json()) as { jeton?: unknown }
  if (typeof donnees?.jeton !== 'string') throw new Error('Réponse inattendue de la plateforme.')
  return donnees.jeton
}

export function creerCompte(motDePasse: string): Promise<string> {
  return demanderJeton('compte', motDePasse)
}

export function seConnecter(motDePasse: string): Promise<string> {
  return demanderJeton('connexion', motDePasse)
}
```

  Tests `tests/prof/compte.test.ts` : un cas par statut (200 `existe` vrai/faux, réponse non booléenne, 500 ; pour `demanderJeton` : 201, 401, 404, 409, 422, 500, jeton absent), et le corps envoyé contient `mot_de_passe`.

- [x] **Étape 2 : la porte** — `EcranProf.tsx` : `CLE_PROF = 'dojo.jeton-prof'`. Sans jeton mémorisé, `compteExiste()` décide entre `FormulaireCreation` et `FormulaireConnexion` ; en échec, une carte « La plateforme ne répond pas » avec un bouton « Réessayer ». `fermer` est stable (`useCallback`) parce qu'il part dans les dépendances de l'effet du tableau de bord.
  - Création : titre « Créer le compte professeur », deux champs `type="password"` (`autoComplete="new-password"`), règle « 12 caractères au minimum », « Les deux mots de passe diffèrent » dès que la confirmation diverge, bouton « Créer le compte » désactivé tant que la règle ou l'égalité manque.
  - Connexion : titre « Tableau de bord », champ « Mot de passe » (`autoComplete="current-password"`), bouton « Ouvrir », erreur en `role="alert"`, aide « Mot de passe oublié ? » avec la commande `oublier_prof`.
  - L'onglet garde le **jeton**, jamais le mot de passe.

- [x] **Étape 3 : le refus ramène à la porte** — `TableauDeBord` : prop `onRefuse?: () => void` ; sur un 401 de `/api/prof/seance`, appeler `onRefuse` et ne rien afficher d'autre. `classe.ts` : sur 401, « Session professeur refusée ou expirée : reconnecte-toi. »

- [x] **Étape 4 : les tests** — `EcranProf.test.tsx` réécrit : création proposée sans compte ; règle des 12 caractères ; confirmation différente ; création qui ouvre le tableau et mémorise le jeton ; connexion avec le bon mot de passe ; « Mot de passe incorrect » ; réouverture sur jeton mémorisé sans appeler `/compte` ; fermeture qui efface le jeton ; 401 du tableau qui ramène à la porte ; plateforme injoignable puis « Réessayer » ; stockage refusé en écriture et en lecture. `sessionStorage` ne contient jamais le mot de passe. `TableauDeBord`, `Classe`, `app` : renommer la prop et l'en-tête, adapter les tests de `/prof`.

- [x] **Étape 5 : vérifier** — `pnpm exec tsc --noEmit`, `pnpm exec eslint .`, `pnpm exec vitest run --coverage`. Attendu : tout passe, seuils de couverture tenus.

- [x] **Étape 6 : vérifier dans le navigateur** — serveur de développement, `fetch` simulé pour `/api/prof/compte` : capture de l'écran de création et de l'écran de connexion. Aucun mot de passe tapé.

- [x] **Étape 7 : commit** — `feat(web): /prof propose de creer le compte professeur au premier lancement`

---

### Tâche 4 : un déploiement sans secret, et le coffre

**Files:**
- Modify: `docker-compose.yml` (plus de bloc `environment` pour `api`)
- Modify: `.env.example` (ne garde que `DOJO_DOMAINE`)
- Modify: `README.md` (« Avant un déploiement »)
- Modify: `docs/vault/3-architecture/Déploiement UNIGE.md`, `Pièges et invariants.md`, `Tableau de bord.md`
- Modify: `docs/vault/2-decisions/Journal de décisions.md`, `docs/vault/Accueil.md`

- [x] **Étape 1** — `docker-compose.yml` : supprimer `environment:` et ses deux lignes sous `api`, avec un commentaire qui renvoie à ADR-014.
- [x] **Étape 2** — `.env.example` : un seul réglage, `DOJO_DOMAINE=localhost`, facultatif, et une ligne qui dit qu'aucun secret ne s'écrit plus ici.
- [x] **Étape 3** — `README.md` : « Avant un déploiement » devient « Premier lancement » : `docker compose up -d --build`, puis ouvrir `/prof` **tout de suite** et créer le compte ; la commande `oublier_prof`.
- [x] **Étape 4** — coffre : ADR-014 au journal ; Déploiement UNIGE (section « Premier lancement », case « Créer le compte professeur juste après le déploiement ») ; Pièges et invariants (la clé tirée en base, le premier arrivé, le jeton signé avec l'empreinte) ; Tableau de bord (la porte) ; Accueil (état et nombres de tests).
- [x] **Étape 5** — `docker compose config` sans `.env` : aucune variable exigée.
- [x] **Étape 6 : commit** — `docs: plus aucun secret dans le .env, le compte professeur se cree dans l'application`

---

### Tâche 5 : remettre en route sur cet ordinateur

- [x] **Étape 1** — sauvegarder la base du conteneur (`docker compose cp api:/app/donnees/dojo.db` vers le scratchpad) avant toute reconstruction.
- [x] **Étape 2** — retirer `DOJO_SECRET` et `DOJO_CODE_PROF` du `.env` local, sans en afficher les valeurs.
- [x] **Étape 3** — `docker compose up -d --build` depuis la racine.
- [x] **Étape 4** — vérifier : `GET http://localhost/api/prof/compte` rend `{"existe": false}` ; `/contenu/exercices.json` contient 112 exercices ; la base garde ses 4 élèves.
- [x] **Étape 5** — ouvrir `http://localhost/prof` : l'écran de création s'affiche. Le professeur crée lui-même le compte.
