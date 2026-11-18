---
title: Séance 7
tags:
  - pedagogie
  - contenu
statut: écrit
mis-a-jour: 2026-11-17
---

# Séance 7 — Git et GitHub

> [!abstract] Ce que la séance enseigne
> Travailler avec un historique et sur un dépôt partagé : à quoi sert git, forker et cloner un projet,
> faire un commit avec ses conventions, l'envoyer avec un push, savoir quels fichiers git suit, et
> lire une différence. Un **bonus** couvre `.gitignore`, les branches, les pull requests, les
> conflits et le travail en équipe. Le TP de la séance est le **TP git** (`/tp/git`). La séance
> prépare aussi le **TP2**, « Workflow de résolution de problèmes » (API, JSON et git), qui utilise tout ce
> qui précède : [[Séance 5]] (JSON) et [[Séance 6]] (API). Voir [[TP2]].

> [!success] Ouverte le 18 novembre 2026
> `CHAPITRES["versions"]["ouverture"]` vaut `2026-11-18` : la séance est ouverte dès sa publication
> ([[ADR-013 Une séance s'ouvre à sa date]]). « Publication » veut dire le déploiement d'un tag : tant
> qu'il n'est pas fait, rien n'est visible des élèves. La [[Séance 6]], elle, reste fermée (31 décembre 2099).

## Le choix de la méthode

git ne tourne pas dans le navigateur ([[ADR-001 Exécution du code dans le navigateur]]) : la
plateforme ne peut pas valider un `git commit`. La séance combine donc **trois supports** :

| Support | Rôle | État |
|---|---|---|
| Slides, avec des schémas | Le modèle mental : les trois zones, fork et clone, un commit, un diff | ✅ écrites — `docs/slides/git.pptx`, 14 slides (9 + 5 bonus) dans l'ordre du cours, avec notes de présentation, aperçus `git-1.png` à `git-14.png` |
| Exercices et leçons de la plateforme | **Prédire avant d'agir** ; la validation est automatique | ✅ écrits |
| Dépôt modèle | Le geste réel, sur la machine de l'élève, avec son IDE | ✅ écrit dans `plateforme/tp-git-modele/`, **à publier** sur GitHub sous le nom `tp-git` |
| Consignes `/tp/git` sur la plateforme | Les mêmes étapes, avec points de contrôle | ⬜ à faire (le README du dépôt les porte déjà) |

> [!important] Pas de Codespaces
> Les élèves travaillent **sur leur machine**, dans leur IDE, et passent par GitHub pour le fork et
> le push. Il faut donc que git soit installé et que `git push` puisse s'authentifier (voir
> « Avant la séance »).

### Comment un exercice de git s'écrit sur cette plateforme

- **Les leçons** n'ont **aucun exemple Python** : elles montrent des blocs `terminal` (les commandes git et leur
  retour, jamais exécutés) et des blocs `schema` (huit dessins : `versions`, `github`, `fork`, `zones`, `commits`,
  `etats`, `branches`, `pullrequest`). Voir [[Modèle de contenu]].
- **`predire`** : le code affiché est une **transcription de terminal** (`git status`, `git log`…) ou un fichier,
  pas un programme. Le validateur n'exécute que ce qu'il sait juger : un code qui n'est pas du Python plante, ce
  qui le fait passer son tour, et un `predire` **sans programme** (`depart` vide) n'est plus comparé à rien.
- **`question` et `legende_depart`** : un `predire` affichait toujours « Qu'affiche ce programme ? » au-dessus des
  propositions et « Le programme » sur la carte de code. Faux pour un historique git ou une convention de message.
  Deux champs optionnels, réservés au `predire`, les remplacent : `question` pose la vraie question (« Quel commit
  a été fait en premier ? »), `legende_depart` nomme le support (« Le terminal », « Le fichier »). `enonce` ne
  garde que le contexte. Sans eux, l'écran reste celui des séances précédentes.
- **`completer`, `debug`, `ecrire`** : ils exécutent du Python, donc ils **simulent git** avec les
  structures de la séance 5. Un historique est une liste de dictionnaires, un dépôt est un
  dictionnaire de listes, un diff est une comparaison de deux listes de lignes.

## Le volume

| | Séance 7 |
|---|---|
| Exercices | **30** |
| dont obligatoires | **16** |
| dont bonus (`niveau: expert`) | **14** |
| `predire` | 20 |
| `debug` | 2 |
| `completer` | 1 |
| `ecrire` | 7 |

| Notion | Exercices | Leçon | Durée |
|---|---|---|---|
| À quoi sert git | aucun : la leçon suffit | `c7-pourquoi` | 3 min |
| Fork et clone | aucun : la leçon suffit | `c7-fork` | 3 min |
| Les fichiers suivis (`git add`, `git status`) | `s7-01` à `s7-03` | `c7-suivis` | 4 min |
| Le commit et ses conventions (`git log`) | `s7-04` à `s7-09` | `c7-commit` | 5 min |
| Envoyer et recevoir | `s7-10` à `s7-12` | `c7-push` | 4 min |
| Voir la différence | `s7-13` à `s7-16` | `c7-diff` | 3 min |
| *Bonus :* ignorer des fichiers | `s7-17` à `s7-19` | `c7-gitignore` | 3 min |
| *Bonus :* les branches | `s7-20` à `s7-23` | `c7-branches` | 3 min |
| *Bonus :* fusionner et résoudre un conflit | `s7-24` à `s7-27` | `c7-fusion` | 4 min |
| *Bonus :* travailler en équipe | `s7-28` à `s7-30` | `c7-equipe` | 3 min |

> [!important] `git add` s'apprend avant `git commit`
> Les fichiers suivis passent **avant** le commit : un exercice de commit parle de `git add`, donc sa leçon doit
> l'avoir enseigné. Les notions `suivis` (ordre 30) et `commit` (ordre 31) ont été échangées pour cela, et les
> slides suivent le même ordre. La notion `suivis` parle du commit comme d'« une sauvegarde » sans le détailler.

Les bonus sont `obligatoire: false` et `niveau: expert` : ils sont étiquetés « Bonus », ils ne comptent
pas dans le compteur de progression et ne bloquent personne ([[ADR-004 Mode expert en bonus débloqué]]).
Les notions bonus affichent donc `0/0` dans le menu.

## Ce que la séance réutilise

| Notion antérieure | Où elle revient |
|---|---|
| f-string et `split` | découper un message de commit : `s7-08`, `s7-09` |
| dictionnaire ([[Séance 5]]) | l'état des fichiers (`s7-03`), les branches (`s7-23`), le décompte par auteur (`s7-30`) |
| liste de dictionnaires | un historique de commits (`c7-pourquoi`, `s7-30`) |
| `in` et `not in` sur une liste | calculer un diff : `s7-15`, `s7-16` |
| `startswith` et `endswith` | valider un message (`s7-07`), ignorer des fichiers (`s7-19`) |
| `input()` | `s7-09` |

## Les conventions enseignées

**Message de commit** : `type: description`, où le type est `feat`, `fix`, `docs`, `refactor` ou `chore`.
La description commence par un verbe, tient en 50 caractères environ et ne finit pas par un point.

**Push** : un `git pull` avant de se mettre au travail ; de petits commits cohérents poussés souvent ;
jamais de mot de passe ni de fichier personnel (l'historique garde tout) ; jamais de `--force` sur un
dépôt partagé.

## Les schémas du cours (slides)

Dans le style des slides existantes ([[Séance 5]], « Slides à ajouter »).

1. **Les trois zones** — dossier de travail, index, dépôt local, GitHub, avec `add`, `commit`, `push` et
   `pull` ; repris à chaque notion avec la zone concernée en évidence.
2. **Git n'est pas GitHub** — la machine de l'élève face au site.
3. **Fork et clone** — dépôt du professeur, fork, machine.
4. **Le problème** — `rendu_final_VRAI.py` face à une ligne de commits.
5. **Un commit** — une chaîne de photos, chacune avec un message.
6. **Anatomie d'un message** — `feat` · `:` · `ajoute le menu`, et le tableau des types.
7. **Les états d'un fichier** — non suivi, indexé, validé, modifié.
8. **Lire un diff** — les lignes `-` et `+` annotées.
9. **Un push rejeté** — deux personnes qui poussent chacune de leur côté.

Bonus : les branches, le parcours d'une pull request, un conflit annoté, le `.gitignore`, les règles d'équipe.

> [!success] Faites : `docs/slides/git.pptx`
> 14 slides dans la DA du deck (fond `#FFF2C2`, cartes `#282A36` à trois pastilles, flèches `#FFC231`),
> chacune avec ses notes de présentation, qui renvoient aux exercices. Les slides 1 à 9 sont le parcours
> obligatoire, les slides 10 à 14 le bonus. Les aperçus ont été rendus avec PowerPoint, où League Spartan et
> Glacial Indifference ne sont pas installées : à relire sur une machine qui les a. La slide « Les trois zones »
> montre quatre cases, GitHub comprise : les trois zones sont le dossier, l'index et le dépôt local.

## Le TP sur machine

Un dépôt modèle propre à cette séance (il est distinct du dépôt du TP2), écrit dans
`plateforme/tp-git-modele/` : un `README.md` qui porte les consignes (reprises sur la plateforme dans `contenu/chapitre-1/tp/git.yaml`, à garder identiques), un `moyenne.py` à corriger, un
`test_moyenne.py` qui échoue tant qu'il n'est pas corrigé, un dossier `eleves/` où chacun ajoute sa fiche
(ce qui évite tout conflit dans la partie obligatoire), et un `equipe.md` réservé au bonus. Il n'a
volontairement **pas de `.gitignore`** : l'élève l'écrit au bonus.

**Parcours obligatoire** : config de l'identité, fork, clone, `status` et `log`, correction de
`moyenne.py`, `diff`, premier commit, fiche (non suivie, puis ajoutée), push, vérification sur GitHub.
**Bonus** : `.gitignore`, branche et pull request, conflit.

Choix à connaître :

- **Adresse de commit.** Le README fait régler `user.name` sur le pseudonyme et `user.email` sur l'adresse du
  compte GitHub. Pas d'adresse de substitution `noreply` : décision du professeur.
- **Pull request dans son propre fork.** GitHub propose par défaut le dépôt du professeur ; le README demande
  de changer le *base repository*, pour que les productions des élèves ne se retrouvent pas sur un dépôt public.
- **Conflit en solo.** Deux branches modifient la même ligne de `equipe.md`, puis l'une fusionne l'autre : aucun
  voisin nécessaire, aucun accès à partager. La version à deux reste possible.
- Le dépôt doit s'appeler **`tp-git`** : le README fait `cd tp-git`.

Rejoué en entier dans un dépôt temporaire (fork simulé par un dépôt nu, clone, correction, commit, `.gitignore`,
conflit) : chaque commande donne le résultat que le README annonce. L'authentification du `git push` vers
GitHub, elle, n'a pas pu être essayée.

## Le temps

16 obligatoires = 10 `predire` (1,5 min), 1 `completer` (3,5), 2 `debug` (5) et 3 `ecrire` (≈ 4,5) :
**≈ 42 min** de pratique sur la plateforme, pour **22 min** de leçons. Il reste ≈ 55 min pour les slides, le
TP sur machine et une marge, soit les 120 min.

> [!note] Plan de coupe
> Si la salle décroche, couper dans cet ordre : `s7-12`, `s7-14`, `s7-02`. Le bonus se fait à la maison ou
> en fin de séance. Décidé à l'avance, comme pour les séances précédentes ([[Plan de production]]).

## Avant la séance

> [!danger] À essayer depuis une vraie salle
> - **git installé** sur les machines des élèves, et un IDE qui le trouve. Je n'ai pas vérifié ce que
>   leur IDE embarque.
> - **`git push` doit s'authentifier.** GitHub n'accepte plus les mots de passe. Sous Windows, Git
>   Credential Manager (livré avec Git for Windows) ouvre un navigateur ; PyCharm propose aussi une
>   connexion par GitHub. Sans l'un des deux, il faudrait un jeton, ce qui est un vrai frein.
> - **github.com joignable** depuis chaque salle, comme Open-Meteo pour la [[Séance 6]].
> - **Comptes GitHub créés avant la séance** : pseudonyme, pas de nom réel ni de photo, comme pour les
>   codes d'accès ([[ADR-002 Identification par code d'agent]]).

- [x] Date de la séance 7 dans `CHAPITRES["versions"]["ouverture"]` : le 18 novembre 2026
- [x] Écrire le dépôt modèle (`plateforme/tp-git-modele/`)
- [x] Publier le dépôt modèle sur GitHub sous le nom `tp-git`, en public : https://github.com/WolfoNeos/tp-git
      (compte personnel du professeur, publié le 17 novembre 2026 ; copie de `plateforme/tp-git-modele/`, à garder
      synchronisée à la main)
- [ ] Écrire les consignes `/tp/git`
- [x] Faire les slides et leurs schémas (`docs/slides/git.pptx`)
- [ ] Un `git push` depuis chaque salle utilisée

## Outillage touché

Les blocs `terminal` et `schema` des leçons : `BlocTerminal` dans `outils/schema.py`, `Terminal.tsx` et huit
dessins SVG dans `SchemaTp.tsx` (le même composant que les schémas du TP de stéganographie).

`outils/schema.py` : `seance` jusqu'à 7, `MOTIF_ID` en `s[1234567]`, `MOTIF_LECON` en `c[1234567]`, dix notions
(ordres 28 à 37) et un chapitre (`versions`), plus les champs `question` et `legende_depart` du `predire`. Le type
TypeScript `seance` suit, et `EcranExercice` lit les deux nouveaux champs. `valider_contenu.py` ne compare plus un
`predire` sans programme à la sortie d'un code vide. Le dossier reste sous
`chapitre-1/`, comme pour les séances 4 à 6.

## Voir aussi

[[Séance 6]] · [[Séance 5]] · [[Programme d'assemblage]] · [[Types d'exercices]] · [[Plan de production]]
