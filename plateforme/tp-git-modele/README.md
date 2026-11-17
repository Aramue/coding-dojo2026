# TP git — Coding Dojo

Ce dépôt sert à **un seul TP** : apprendre à travailler avec git et GitHub. Tu ne l'utilises pas
directement : tu en fais ta propre copie (un *fork*), et tu travailles dessus.

> **Pseudonyme obligatoire.** Sur GitHub, n'utilise ni ton nom, ni ton prénom, ni une photo de toi.
> Ce dépôt est public.

## Avant de commencer

Il faut git installé sur ta machine :

```
git --version
```

Si la commande répond par un numéro de version, c'est bon. Sinon, dis-le au professeur.

Dis ensuite à git qui tu es. Ces deux réglages s'ajoutent à chaque commit que tu fais. Remplace `ton-pseudo`
par ton pseudonyme GitHub, et `ton-adresse` par l'adresse de ton compte GitHub.

```
git config --global user.name "ton-pseudo"
git config --global user.email "ton-adresse"
```

## Ce que tu dois faire

### 1. Forker le dépôt

Sur la page GitHub de ce dépôt, clique sur **Fork**, puis **Create fork**. Tu obtiens une copie dans ton compte,
sur le site. Rien n'est encore sur ta machine.

### 2. Cloner ton fork

Sur la page de **ton** fork (l'adresse contient ton pseudonyme), clique sur **Code**, copie l'adresse HTTPS, puis :

```
git clone adresse-de-ton-fork
cd tp-git
```

### 3. Regarder où tu en es

```
git status
git log --oneline
```

Tu dois voir : « nothing to commit, working tree clean », et l'historique du dépôt.

### 4. Corriger `moyenne.py`

Ouvre `moyenne.py` dans ton éditeur. Le programme affiche la moyenne sans l'arrondir. Fais-le arrondir à
une décimale : `return round(sum(notes) / len(notes), 1)`.

Lance `python test_moyenne.py`. Il doit répondre « Tout est bon. »

Regarde ensuite ce qui a changé :

```
git diff
```

Tu dois voir une ligne en `-` (l'ancienne) et une ligne en `+` (la nouvelle).

### 5. Faire ton premier commit

```
git add moyenne.py
git status
git commit -m "fix: arrondit la moyenne à une décimale"
```

Vérifie avec `git log --oneline` : ton commit est en haut de la liste.

### 6. Ajouter ta fiche

Crée le fichier `eleves/ton-pseudo.md` (lis `eleves/LISEZMOI.md` pour savoir quoi y mettre). Puis :

```
git status
```

Ton fichier est en « Untracked files » : git le voit, mais ne le suit pas. Ajoute-le et committe :

```
git add eleves/ton-pseudo.md
git commit -m "docs: ajoute ma fiche"
```

### 7. Envoyer sur GitHub

```
git push
```

La première fois, GitHub te demande de te connecter. Quand c'est fini, ouvre la page de **ton fork** : tu dois
y voir ton commit `docs: ajoute ma fiche` et ton fichier dans `eleves/`.

## Si ça bloque

- `rejected ... fetch first` : fais `git pull`, puis recommence `git push`.
- `nothing added to commit` : tu as oublié `git add`.
- `Authentication failed` : GitHub n'accepte plus les mots de passe. Reconnecte-toi avec la fenêtre du navigateur
  que git ouvre, ou depuis la connexion GitHub de ton éditeur.
- Un doute sur ce qui se passe : lance `git status`. Il dit presque toujours quoi faire.

## Bonus

À faire dans l'ordre, sur ton propre fork.

### A. Ignorer des fichiers

Lance `python test_moyenne.py`, puis `git status`. Si un dossier `__pycache__/` est apparu, c'est Python qui
l'a créé tout seul. Si ton éditeur a ajouté un dossier `.idea/` ou `.vscode/`, il apparaît aussi. Aucun de
ces dossiers n'a sa place dans le dépôt.

Crée un fichier `.gitignore` qui contient, une règle par ligne :

```
__pycache__/
.idea/
.vscode/
```

Vérifie avec `git status` que ces dossiers ont disparu de la liste, puis committe `.gitignore`
(`chore: ignore les fichiers de l'éditeur`).

### B. Une branche et une pull request

```
git switch -c feat-mediane
```

Ajoute à `moyenne.py` une fonction `mediane(notes)`, puis committe (`feat: ajoute la médiane`) et pousse :

```
git push -u origin feat-mediane
```

Sur GitHub, ouvre une **pull request** de `feat-mediane` vers `main`.

> **Attention.** GitHub propose par défaut d'envoyer la pull request vers le dépôt du professeur. Change
> le **base repository** pour choisir **ton propre fork**. Les pull requests de ce TP restent chez toi.

Fusionne-la sur GitHub, puis reviens sur `main` et récupère le résultat :

```
git switch main
git pull
```

### C. Un conflit

Tu vas t'en créer un à toi tout seul, avec deux branches qui modifient la même ligne de `equipe.md`.

1. `git switch -c devise-a`, écris ta devise après `Devise de la classe :`, puis committe.
2. `git switch main`, puis `git switch -c devise-b`, écris une autre devise sur **la même ligne**, puis committe.
3. `git merge devise-a`. Git annonce un conflit.
4. Ouvre `equipe.md` : les marqueurs `<<<<<<<`, `=======` et `>>>>>>>` entourent les deux versions. Garde celle
   que tu veux, **efface les trois lignes de marqueurs**, puis `git add equipe.md` et `git commit`.

Tu peux aussi le faire à deux : chacun écrit une devise sur la même ligne dans sa branche, et l'un des deux
fusionne celle de l'autre.
