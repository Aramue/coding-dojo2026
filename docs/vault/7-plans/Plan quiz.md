---
title: Plan quiz
tags:
  - plan
  - implementation
  - quiz
statut: développé
date: 2026-09-27
---

# Quiz en direct — Plan d'implémentation

> **Exécution :** sur la branche `quiz-en-direct`, une tâche après l'autre, au moins un commit par
> tâche, poussé au fil de l'eau. La PR vers `main` se décide à la fin. Les cases `- [ ]` servent
> au suivi.

**But :** le professeur lance une partie depuis son tableau de bord ; les élèves la rejoignent
depuis leur espace, répondent à des questions en temps limité ; l'écran projeté montre la
correction, la répartition des réponses et les cinq premiers ; chaque élève voit son propre rang.

**Architecture :** l'état de la partie vit dans SQLite. Chaque écran le lit par un `GET` qui rend
une photographie calculée pour lui ; un WebSocket ne sert que de sonnette, et sans lui on relit
toutes les secondes ([[ADR-016 Temps réel par sonnette WebSocket]]). Les questions sont écrites
en YAML, validées et construites **dans l'image de l'API**, jamais publiées dans `/contenu`. La
logique du jeu — phases, barème, classement, vues — est une fonction pure, testée sans HTTP.

**Pile :** FastAPI (WebSocket de Starlette) · SQLModel · SQLite · pytest · React 19 · TypeScript ·
Vitest · Testing Library.

Décisions : [[ADR-015 Quiz en direct et classement encadré]] ·
[[ADR-016 Temps réel par sonnette WebSocket]].

## Contraintes globales

- **Tout en français**, identifiants compris, accentué correctement dans ce que lit un élève.
- **Le serveur est l'arbitre.** Une photographie élève ne contient jamais `bonne_reponse`, ni la
  justesse de sa propre réponse, ni des points qui la trahiraient, avant la correction. Un test
  de fuite le vérifie.
- **Tout champ reçu est validé côté serveur** : motifs, bornes, `extra="forbid"`
  ([[ADR-008 Validation serveur des champs libres]]).
- **Garde-fous du classement** ([[ADR-015 Quiz en direct et classement encadré]]) : cinq premiers
  projetés, rang individuel sur l'écran de l'élève seulement, noms « Prénom N. », rien qui
  subsiste d'une partie à l'autre, rien qui compte dans la progression.
- **Un seul processus uvicorn** ([[ADR-016 Temps réel par sonnette WebSocket]]).
- **La logique pure est couverte à 100 %**, côté API comme côté front.
- **Commits** : préfixe conventionnel, message en français, sans accents dans le sujet, qui dit ce
  qui est vrai après le commit.

## Structure des fichiers

```
plateforme/
  contenu/chapitre-1/quiz/
    q1-bases.yaml                 # le premier quiz
  outils/
    schema.py                     # + QuestionQuiz, Quiz, charger_quiz_tous
    valider_contenu.py            # + verifier_quiz : le code d'une question est execute
    construire_quiz.py            # YAML -> JSON, pour l'image de l'API seulement
  api/app/
    modeles.py                    # + PartieQuiz, ParticipantQuiz, ReponseQuiz
    quiz.py                       # logique pure : phases, bareme, classement, vues
    catalogue.py                  # lit les quiz construits
    diffuseur.py                  # la sonnette : registre des WebSocket ouverts
    routes_quiz.py                # routes eleve, routes prof, WS /quiz/flux
  web/src/
    routage.ts                    # + /quiz et /prof/quiz
    quiz/
      types.ts                    # EtatEleve, EtatProf
      horloge.ts                  # ecart avec le serveur, temps restant (pur)
      flux.ts                     # sonnette + releve periodique de repli
    api/client.ts                 # + lireQuiz, rejoindreQuiz, repondreQuiz
    prof/quiz.ts                  # client des routes /prof/quiz
    ui/
      EcranQuiz.tsx               # l'eleve
      QuizProf.tsx                # l'ecran projete
      FormeOption.tsx             # les quatre formes SVG des options
deploiement/Dockerfile.api        # + etape de construction des quiz
```

## Tâche 1 : Décisions et plan

- [x] ADR-015 et ADR-016, ADR-011 marquée comme amendée, [[Journal de décisions]]
- [x] Ce plan
- [x] Commit `docs: ...`

## Tâche 2 : Schéma et validation des quiz

- [x] `QuestionQuiz` : `enonce`, `code` facultatif, `entrees`, 2 à 4 `options` distinctes et
  non vides, `bonne_reponse` dans les bornes, `duree_s` de 10 à 60 (20 par défaut),
  `explication` facultative, `sortie: true` (la bonne réponse est ce que le code affiche) ou
  `erreur: NomDeLException` (le code doit lever cette exception). Pas d'emoji, pas de `getpass`.
- [x] `Quiz` : `id` de la forme `q1-bases`, `titre`, `seance`, 1 à 30 questions.
- [x] `charger_tous` ignore `quiz/` comme il ignore `lecons/`.
- [x] `verifier_quiz` : tout code s'exécute sans erreur sauf s'il déclare `erreur` ; `sortie`
  compare la sortie réelle à `options[bonne_reponse]` ; `erreur` compare le nom de l'exception.
- [x] `verifier_racine` valide aussi les quiz.
- [x] `construire_quiz.py racine sortie` : un JSON par quiz, en snake_case, et refuse d'écrire
  dans un dossier `contenu` publié.
- [x] Tests, puis commit `feat: ...`

## Tâche 3 : Le premier quiz

- [x] `q1-bases.yaml`, tiré des notions de la séance 1, bonnes réponses réparties sur toutes les
  positions, chaque question vérifiée par exécution quand elle montre du code.
- [x] Commit `content: ...`

## Tâche 4 : Construction dans l'image de l'API

- [x] `Dockerfile.api` : une étape valide et construit les quiz, copiés dans `/app/quiz`.
- [x] `api/.gitignore` et `.dockerignore` : `plateforme/api/quiz` est un artefact local.
- [x] Commit `chore: ...`

## Tâche 5 : Modèle de données et logique pure

- [x] Tables `PartieQuiz`, `ParticipantQuiz`, `ReponseQuiz` (une réponse par élève et par
  question : contrainte d'unicité).
- [x] `quiz.py` : `phase_effective` (la correction se déduit de `fin_a`), `points` (barème de
  1000 à 500), `classement` (ex æquo au même rang), `vue_eleve`, `vue_prof`, `bilan`.
- [x] Tests à 100 %, puis commit `feat: ...`

## Tâche 6 : Catalogue et routes

- [x] `catalogue.py` lit `DOJO_QUIZ` (par défaut `api/quiz`), injecté par dépendance pour les
  tests.
- [x] Routes élève : `GET /quiz/etat`, `POST /quiz/rejoindre`, `POST /quiz/reponse`.
- [x] Routes prof : `GET /prof/quiz`, `POST /prof/quiz/parties`, `GET /prof/quiz/partie`,
  `POST /prof/quiz/partie/suivante`, `.../corriger`, `.../terminer`. Chaque action porte le rang
  de la question qu'elle croit courante : un double clic ne saute pas une question.
- [x] Clôture automatique quand tous les participants ont répondu.
- [x] `retirer()` emporte les participations et réponses de l'élève.
- [x] Tests, dont le test de fuite, puis commit `feat: ...`

## Tâche 7 : La sonnette WebSocket

- [x] `diffuseur.py` : inscrire, retirer, sonner (tous, ou le professeur seul), plafond de
  connexions.
- [x] `WS /quiz/flux` : authentification dans le premier message, fermeture 4401 sinon.
- [x] Chaque écriture sonne après sa réponse (tâche de fond).
- [x] Tests avec `websocket_connect`, puis commit `feat: ...`

## Tâche 8 : Le front sans interface

- [x] `routage.ts` : `/quiz` et `/prof/quiz`, couverts à 100 %.
- [x] `quiz/horloge.ts`, `quiz/flux.ts`, clients élève et prof, avec leurs tests.
- [x] Vite : `ws: true` sur le proxy `/api`.
- [x] Commit `feat: ...`

## Tâche 9 : Charte des écrans de quiz

- [x] Proposer au professeur les couleurs des quatre options et les mouvements nouveaux
  (compte à rebours, podium) ; les consigner en amendement de la [[Charte visuelle]].

## Tâche 10 : L'écran du professeur

- [x] Choix du quiz, salle d'attente, question, correction avec répartition et cinq premiers,
  podium, bilan anonyme par question. Lien depuis le tableau de bord.
- [x] Tests, puis commit `feat: ...`

## Tâche 11 : L'écran de l'élève

- [x] Bandeau « Un quiz a commencé » dans l'espace élève.
- [x] `/quiz` : attente, question (touches 1 à 4), réponse enregistrée, correction avec points
  et rang personnel, bilan final. Reprise transparente après un rechargement.
- [x] Tests, puis commit `feat: ...`

## Tâche 12 : Vérification

- [x] Script de charge : 24 élèves simulés rejoignent et répondent en même temps
  (`deploiement/charge_quiz.py` ; à travers Caddy : 75 ms de médiane, aucune erreur).
- [x] Parcours complet à la main, professeur et élève, sur le serveur de développement ; image
  de l'API et pile `docker compose` construites et essayées.
- [ ] À faire en salle : vérifier que le WebSocket passe le réseau d'un établissement.

## Tâche 13 : Documentation

- [x] Note [[Quiz en direct]], [[Vue d'ensemble]], [[Pièges et invariants]], [[Déploiement UNIGE]],
  README, [[Accueil]].
