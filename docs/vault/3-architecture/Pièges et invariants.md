---
title: Pièges et invariants
tags:
  - architecture
  - maintenance
mis-a-jour: 2026-10-01
---

# Pièges et invariants

Cette note existe pour une seule raison : ==plusieurs choix du code ont l'air arbitraires et ne le
sont pas.== Chacun a été payé par un défaut réel, trouvé en exécutant. Les défaire les fait
revenir.

Chaque entrée dit **ce qu'il ne faut pas faire** et **ce qui casse si on le fait quand même**.

## Exécution

### Ne pas passer le worker en `{ type: 'module' }`

Le worker charge Pyodide par `importScripts('/pyodide/pyodide.js')`. En module, `importScripts`
n'existe pas, et l'`import()` équivalent est refusé par le serveur de développement Vite, qui
interdit d'importer un fichier de `public/` depuis le graphe de modules.

**Ce qui casse :** le worker ne démarre jamais en développement. L'élève attend cinq secondes et
reçoit un message de boucle infinie sans rapport. Détail :
[[ADR-007 Worker classique et chargement de Pyodide]].

### Ne pas déplacer le minuteur dans le worker

Le minuteur de 5 secondes vit dans `Executeur`, sur le fil principal.

**Ce qui casse :** un worker bloqué dans une boucle `while True` ne traite plus aucun message, y
compris un ordre d'arrêt. Le seul recours est `terminate()` **depuis l'extérieur**. Un minuteur
interne au worker ne se déclencherait jamais. Or le chapitre 1 enseigne `while` : il y **aura**
des boucles infinies.

### Ne pas lancer deux exécutions en parallèle

`Executeur` réaffecte `worker.onmessage` à chaque appel.

**Ce qui casse :** un second appel concurrent écrase le gestionnaire de réponse du premier, qui
expire alors en silence et affiche un faux message de boucle infinie. `EcranExercice` enchaîne
donc les exécutions avec `await`, jamais un `Promise.all`.

### Un `postMessage` par `print` noie le fil principal

`_QgSortie.write` accumule et n'envoie qu'au-delà de **400 caractères ou 50 ms**.

**Ce qui casse :** un `print` fait *deux* appels à `write()` — le texte, puis le saut de ligne. Un
message par appel, c'est mille rendus React pour une boucle de cinq cents lignes : le fil
principal passe son temps à redessiner au lieu d'afficher. Le tampon doit aussi être **vidé avant
que l'exécution ne rende la main**, sinon la fin de la sortie n'arrive jamais.

### Se souvenir que l'invite d'`input()` part dans la sortie

Le harnais Python écrit l'invite, puis la réponse simulée, puis un saut de ligne.

**Ce qui casse :** un `attendu` écrit sans tenir compte de l'invite ne correspond jamais.
L'exercice devient impossible à valider — et une classe entière lève la main en même temps.
C'est précisément pour ça qu'on n'écrit **jamais** un `attendu` à la main : voir plus bas.

## Validation

### Les deux `normaliser` doivent rester rigoureusement identiques

`web/src/validation/normaliser.ts` et `outils/valider_contenu.py::_normaliser` font la même
chose. `tests/test_normaliser_parite.py` rejoue les dix cas de la suite TypeScript.

**Ce qui casse :** le Python décide si la solution de référence passe ses tests **au déploiement**,
le TypeScript rend le verdict bleu **dans le navigateur**. Une divergence produit un exercice qui
valide à la construction et recale un élève qui a juste, le mercredi à 14 h.

> [!important] Toute modification de l'un exige la même dans l'autre
> Et la mise à jour du test de parité. C'est le seul endroit du projet où une duplication est
> délibérée.

### Une exécution par test, pas une pour l'exercice

Un exercice peut déclarer plusieurs tests `sortie` avec des entrées différentes, pour vérifier que
la solution généralise.

**Ce qui casse :** une exécution partagée compare la sortie obtenue avec les entrées A à l'attendu
écrit pour les entrées B. Une solution correcte est refusée. Détail dans [[Moteur de validation]].

### `VERT` est gelé

`const VERT = Object.freeze({...})` dans `evaluer.ts`, renvoyé par référence depuis six points.

**Ce qui casse :** un appelant qui enrichirait le résultat en place contaminerait silencieusement
tous les verdicts verts suivants de la session.

### Un message d'erreur ne mentionne que des notions déjà enseignées

Le message `TypeError` conseille `str()`, et **pas** le f-string.

**Ce qui casse :** cette erreur se rencontre en `s1-21`, dont le test exige `str(`. Le f-string
n'est enseigné qu'en `s1-23`. Un élève qui suivait le conseil de l'application se faisait recaler
pour l'avoir suivi — le scénario d'abandon exact décrit dans [[Bilan 2025-2026]].

## Contenu

### Ne jamais écrire un champ `attendu` à la main

`generer_attendu.py` exécute la solution de référence et écrit la sortie réelle.

**Ce qui casse :** l'`attendu` faux tapé à la main est la classe d'erreur la plus probable de la
production de contenu. Un seul suffit à rendre un exercice invalidable.

### `generer_attendu.py` utilise ruamel.yaml, jamais PyYAML

Avec `preserve_quotes` **et** `indent(mapping=2, sequence=4, offset=2)`.

**Ce qui casse :** `yaml.safe_dump` supprime tous les commentaires du fichier et transforme chaque
bloc littéral `|` en chaîne échappée sur une ligne. Or `enonce:` et `solution:` sont écrits en
blocs `|`, et ces fichiers sont édités à la main. Sans `indent()`, ruamel réaligne en plus les
tirets de **toutes** les listes, y compris celles qu'on ne modifie pas.

### Un motif `interdit` ne contient jamais de guillemet

Le validateur le refuse désormais.

**Ce qui casse :** un motif terminé par un guillemet ne bloque que cette ponctuation. L'élève
écrit la même réponse en dur avec des guillemets simples, triples ou un f-string, et passe au
vert sans rien résoudre. ==Vérifié : `print("""Agent en poste : Merle""")` traversait le motif
`Merle")`.==

### Un exercice dont l'objectif est le format exact porte `exige_exact: true`

**Ce qui casse :** sans lui, la normalisation du verdict bleu absorbe l'erreur que l'exercice
cherche justement à faire remarquer. L'exercice ne teste plus rien.

### Le validateur compte les tours de boucle, il ne trace pas l'exécution

`_executer` réécrit le programme avant de l'exécuter : un appel à `__tour__()` en tête de chaque
boucle, qui lève `TimeoutError` au-delà de 100 000 tours.

**Ce qui casse :** sans compteur, la boucle infinie d'un exercice `debug` de la séance 3 bloque la
validation et la construction de l'image, sans un message. Et un compteur installé avec
`sys.settrace` prend la place du traceur de coverage : la mesure des fonctions qui appellent
`_executer` s'arrête net après chaque exécution. `generer_attendu.py` était tombé de 77 % à 65 %
sans qu'une ligne de test ait changé.

## Serveur

### La validation vit côté serveur, jamais seulement côté navigateur

**Ce qui casse :** tout ce que le JavaScript filtre, un élève le contourne en ouvrant la console.
Démontré en conditions réelles. Détail dans [[ADR-008 Validation serveur des champs libres]].

### Aucun secret n'a de valeur par défaut devinable

La clé des jetons est **tirée au hasard** par l'instance, au premier besoin, et rangée dans la
table `reglage`. Aucune valeur n'est écrite dans le dépôt, et depuis le 25 septembre 2026 aucune
ne vient plus de l'environnement ([[ADR-014 Le compte professeur se crée au premier lancement]]).

**Ce qui casse :** une valeur par défaut publiée dans le dépôt laisse forger un jeton pour
n'importe quel élève, ou obtenir l'accès professeur. Une clé publiée échoue en silence et
gravement.

### La clé se tire une seule fois, même sous deux requêtes simultanées

`ecrire_reglage_neuf` n'écrit que si la clé manque, et la **clé primaire** tranche quand deux
requêtes ont constaté l'absence en même temps : la seconde écriture échoue et relit la première.

**Ce qui casse :** deux clés tirées au premier démarrage — un élève dont le jeton est signé avec la
perdante est déconnecté au rafraîchissement suivant, sans raison visible.

### Le compte professeur revient au premier qui ouvre `/prof`

Tant qu'aucun compte n'existe, `POST /prof/compte` est ouvert à tous. C'est voulu : c'est ce qui
permet de démarrer sans rien préparer.

**Ce qui casse :** un serveur déployé et laissé sans compte. ==Créer le compte dans la minute qui
suit chaque déploiement.== `python -m app.oublier_prof` le rend si quelqu'un l'a pris avant.

### Le jeton professeur est signé avec l'empreinte du mot de passe

La signature couvre `prof.<expiration>.<empreinte>`. Un compte effacé puis recréé change
l'empreinte, et **toutes** les sessions ouvertes avec l'ancien mot de passe tombent — sans table
de sessions à tenir.

**Ce qui casse :** signer sans l'empreinte. Un mot de passe réinitialisé parce qu'il a fuité
laisserait ouvertes, douze heures durant, les sessions de celui qui l'avait.

### Renommer une variable d'environnement casse le déploiement, pas les tests

Le 4 septembre 2026, `QG_SECRET`, `QG_CODE_PROF`, `QG_BDD` et `QG_DOMAINE` sont devenues
`DOJO_*`. ==Aucun test n'aurait signalé un `.env` oublié== : le fichier est hors dépôt, et
`docker compose` refuse alors de démarrer avec un message qui ne nomme que la nouvelle variable.

Depuis le 25 septembre 2026, `DOJO_SECRET` et `DOJO_CODE_PROF` ne sont plus lues du tout, et
`docker compose` n'exige plus aucun secret. Un `.env` de serveur qui les porte encore ne casse
rien : les lignes sont simplement ignorées.

Le 28 septembre 2026, `DOJO_DOMAINE` a disparu avec le TLS de Caddy, et deux réglages
d'exploitation sont apparus : `DOJO_VERSION`, le tag déployé, et `DOJO_PUBLICATION`, l'adresse où
le conteneur web publie son port. ==Le second est le seul qui casse quelque chose s'il manque== :
sans lui, la valeur par défaut est `80`, et sur une machine où nginx tient déjà ce port le
conteneur refuse de démarrer. `deployer.sh` vérifie sa présence avant tout le reste, plutôt que
d'échouer à moitié.

### La sonnette du quiz est silencieuse, donc un proxy la ferme

`proxy_read_timeout` vaut 60 s par défaut dans nginx, et la sonnette ne transmet rien entre deux
questions : sans un `location /api/quiz/flux` à part qui monte ce délai, chaque élève se rebranche
une fois par minute pendant toute la partie.

**Ce qui casse :** rien de visible, et c'est le piège. Le repli par relecture
([[ADR-016 Temps réel par sonnette WebSocket]]) rattrape la coupure, donc le quiz a l'air de
marcher ; on ne le découvre qu'en lisant les journaux, ou en se demandant pourquoi vingt-quatre
connexions se rouvrent en boucle. Le même raisonnement vaut pour tout proxy d'établissement.

### Sur un serveur partagé, c'est à nous de nous borner

La VM de production fait tourner un autre service. Il n'y a **pas** de
`/etc/docker/daemon.json`, donc rien ne limite les journaux de conteneur par défaut ; et l'OOM
killer du noyau choisit sa victime sur la mémoire consommée, pas sur l'ancienneté.

**Ce qui casse :** un `docker system prune` global, ou un `daemon.json` ajouté pour nous, toucherait
le voisin. `docker-compose.yml` borne donc nos journaux, `production.yml` borne notre mémoire, et
`deployer.sh` ne supprime que des images de notre propre dépôt. ==Aucune commande de ce dépôt n'agit
à l'échelle du démon Docker.==

### Une route ouverte dont le calcul est cher se borne, et ne hache qu'à la fin

`POST /prof/compte` et `POST /prof/connexion` hachent le mot de passe reçu avec scrypt, lent et
gourmand en mémoire **par construction** — c'est ce qui le protège d'un dictionnaire. Ce sont
aussi les deux seules routes joignables sans jeton dont le coût ne se décide pas chez nous.

Deux gestes, et il faut les deux : `creer_le_compte` ne hache ==qu'après== avoir constaté que le
compte manque, et `nginx-dojo.aramue.com.conf` borne le débit des deux routes, comme celui de
`/session` dont le code d'accès tient en quatre caractères.

**Ce qui casse :** hacher avant de savoir, c'est payer le calcul à chaque appel pour jeter le
résultat et répondre 409. Sans borne par-dessus, l'API — un seul processus
([[ADR-016 Temps réel par sonnette WebSocket]]) limité à 512 Mo — se fait tuer par l'OOM killer,
et `restart: unless-stopped` la relance pour que la suite recommence. Les bornes mémoire qui
protègent le voisin de la VM garantissent que la victime, c'est nous.

### Un plafond global se remplit par n'importe qui

Le registre de la sonnette accepte deux cents connexions, et **six par élève** — comptées sur le
code d'accès du jeton présenté, pas sur l'adresse IP, que toute la classe partage.

Six et pas deux : sur la page du quiz, ==un onglet tient deux sonnettes==, celle de la coquille
et celle de la partie. Et vingt-quatre élèves au plafond en occupent cent quarante-quatre, ce qui
laisse toujours sa place au professeur — `test_flux_quiz.py` tient cet invariant.

**Ce qui casse :** avec le seul plafond global, un jeton suffit à prendre toutes les places. Rien
ne tombe — le repli par relecture rattrape ([[ADR-016 Temps réel par sonnette WebSocket]]) — mais
la classe entière relit chaque seconde pendant toute la partie. L'onglet de trop, lui, est refusé
en 1013 et relit en attendant : il marche, sans sonnette.

### Le bloc nginx part avec le déploiement, et jamais sans `nginx -t`

`deployer.sh` compare `deploiement/nginx-dojo.aramue.com.conf` au fichier de `/etc/nginx/` et, s'il
a changé, garde l'ancien, pose le nouveau, lance `nginx -t`, puis recharge. Si le test échoue, il
==remet l'ancien== avant de sortir en erreur.

**Ce qui casse, sans l'installation automatique :** rien, et c'était le piège. Le script ne
recopiait pas ce fichier ; le dépôt et la machine divergeaient en silence, et une protection
qu'on croyait déployée n'existait que dans Git.

**Ce qui casse, sans le test ni la remise en place :** un fichier refusé laissé dans
`sites-available` fait échouer le prochain rechargement de nginx — le nôtre, celui des autres
sites de la machine, celui de certbot. Voir [[Déploiement UNIGE]], « Déployer, ensuite ».

## Interface

### Le compteur du menu se dérive, il ne se stocke pas

`groupes` est calculé par `useMemo` à partir de `reussis`. Une première version le stockait dans
un `useState` rempli à la connexion.

**Ce qui casse :** valider un exercice affichait bien son verdict, mais ==le menu restait sur son
compteur d'origine== — 0/6 après une réussite. Aucun test unitaire ne l'aurait vu : le bug n'existe
qu'à l'assemblage. Trouvé en résolvant un exercice à la main dans le conteneur.

### Un enfant de grille repliée ne porte ni marge intérieure ni bordure

Le repli du sommaire s'anime sur `grid-template-rows: 1fr -> 0fr`, seule façon d'animer vers une
hauteur *automatique* sans la mesurer en JavaScript. L'enfant direct porte `overflow: hidden` et
`min-height: 0`, et ==zéro `padding`, zéro `border`==. L'espacement se met sur les enfants, à
l'intérieur de la boîte de contenu.

**Ce qui casse :** `min-height: 0` annule la hauteur du *contenu* ; le padding, lui, reste dans la
boîte et s'ajoute par-dessus. Un `padding-bottom: 1rem` laissait une bande de 16 px visible sous
le chapitre replié, avec le haut de la première notion qui dépassait.

### L'API ne peut pas compter les exercices d'un élève sur un total

`GET /prof/seance` renvoie la **liste** des identifiants réussis, pas leur compte.

**Ce qui casse :** l'API ignore quels exercices sont obligatoires — le contenu est construit côté
front — donc tout décompte qu'elle produirait mélangerait chemin minimal, renforts et bonus, et
ne se comparerait à aucun total. Le faire remonter par le client reviendrait à faire confiance au
navigateur d'un élève pour une donnée qui pilote l'affichage professeur. C'est la même raison qui
interdit un statut « terminé ». Voir [[Tableau de bord]].

### La couleur de notion est un accent, jamais un fond de page

Le canevas est neutre (`--ground`), le contenu vit sur `--surface`, et la couleur de la famille
tient le sur-titre, la pastille, l'état actif du menu et le filet des blocs « attention ».

**Ce qui casse :** une première version peignait toute la zone de contenu avec le `tint` de la
notion. ==Le résultat ressemblait à une maquette== — la couleur ne portait plus d'information,
elle remplissait de l'espace, et le texte flottait sans surface ni profondeur. La règle de la
charte (« pastel = j'apprends ») parle de l'ambiance d'une carte, pas d'un aplat plein écran.

### Un écran sombre ne se teinte pas avec la couleur `deep` de la famille

`.exercice` prend `--nuit` (#1A1B23), le même pour les cinq notions. La notion s'y lit dans les
accents, en **pastel** (`--tint`).

**Ce qui casse :** les couleurs `deep` de la palette donnent un brun (#3C2500) et un vert très
sombre (#022016). Elles fonctionnent en petit aplat sur une carte, pas sur un écran entier — le
résultat était boueux. ==Sur fond sombre, l'accent lisible est le pastel, pas l'encre== : `--encre`
y disparaît.

### Aucune page ne doit être un cul-de-sac

`PiedNavigation` donne l'étape d'avant et celle d'après en bas de chaque page : le cours mène aux
exercices, chaque exercice a son voisin, la liste ramène au cours et propose la notion suivante
une fois terminée.

**Ce qui casse :** sans elles, il fallait repasser par le menu à chaque changement de page. Rien
ne plantait — c'est justement le problème : ==l'application marchait et ressemblait à une
maquette==, parce qu'un parcours d'apprentissage est un chemin et ne se lisait pas comme tel.

### Le tableau de bord ne suppose jamais la forme de la réponse

`TableauDeBord` vérifie `Array.isArray(donnees?.eleves)` avant de rendre.

**Ce qui casse :** une réponse sans `eleves` mettait `undefined` dans l'état, et le rendu plantait
sur `.length`. ==Le tableau du professeur devenait un écran blanc== en pleine séance, sans rien
qui explique pourquoi. Trouvé par un test, pas en classe.

### Une colonne de grille `1fr` prend la largeur de son contenu

En mise en page mobile, la grille de `.appli` déclare `minmax(0, 1fr)`.

**Ce qui casse :** avec `1fr`, la bande de menu horizontale (quatre cartes de 12 rem) impose sa
largeur minimale à toute la grille. La page débordait de 17 px vers la droite sur un écran de
375 px, et tout le site se décalait au défilement horizontal.

### Les retours à la ligne d'un énoncé ne veulent pas tous dire la même chose

`decouperEnonce` distingue trois genres de bloc : prose (réenroulée), liste de consignes (retours
gardés, typographie normale) et sortie attendue (retours gardés, chasse fixe).

**Ce qui casse :** rendre l'énoncé entier en `white-space: pre-line` coupait les phrases là où
l'auteur avait coupé son fichier YAML, vers 75 colonnes — une largeur qui n'a aucun rapport avec
l'écran de l'élève. Tout supprimer écraserait au contraire les sorties attendues sur une ligne,
alors que ces exercices se jouent au caractère près.

### Le fil d'Ariane touche `EcranExercice`, sa logique reste interdite

`EcranExercice` orchestre **une exécution par test**, séquentiellement, avec cache par jeu
d'entrées. ==Seul le JSX du `return` a été modifié== pour ajouter le fil d'Ariane ; `valider()`
n'a pas bougé d'une ligne.

**Ce qui casse :** un exercice comme `s1-30`, `s1-31` ou `s1-34` déclare plusieurs tests `sortie`
avec des entrées différentes. Réutiliser une exécution partagée compare la sortie obtenue avec les
entrées A à l'attendu écrit pour les entrées B. Trois rondes de correction.

### Un diff caractère par caractère suppose deux textes voisins

`diffInformatif` exige au moins trois dixièmes de caractères communs avant de surligner.

**Ce qui casse :** rien ne plante, mais sur deux sorties sans rapport la plus longue sous-séquence
commune se réduit à des lettres isolées. Le surlignage découpe alors les lignes en confettis et
l'élève n'a plus rien de lisible sous les yeux. Vu en séance de vérification sur « banane » face à
« Bonjour tout le monde ».

### Le rappel de réussite s'efface dès la première validation de la visite

`EcranExercice` n'affiche le bandeau daté que si `dejaFait` existe **et** que `resultat` est
encore nul.

**Ce qui casse :** rien ne plante, mais deux encadrés qui disent la même chose se répondent en
haut et en bas de l'écran, et l'élève ne sait plus lequel parle de l'essai qu'il vient de faire.

### Une lecture directe de `executions[i]` suppose l'alignement 1:1

`evaluer` indexe `executions` par le rang du test, avec un `!` non nul.

**Ce qui casse :** un appelant qui fournit moins d'exécutions que de tests fait planter
`evaluerUn` sur un `undefined`. `EcranExercice` maintient l'alignement en poussant une exécution
vide pour les tests qui n'exécutent rien (`interdit`, `contient`, `qcm`).

### Tab indente dans l'éditeur, de quatre espaces

`Editeur.tsx` ajoute `indentWithTab` au clavier et fixe `indentUnit` à quatre espaces.

**Ce qui casse :** sans `indentWithTab`, CodeMirror laisse la touche Tab au navigateur, qui
déplace le focus. L'élève qui voulait décaler le corps d'un `if` envoyait le focus sur le bouton
Valider, et son code ne bougeait pas — constaté le 14 septembre 2026, en préparant la séance 2.
Sans `indentUnit`, CodeMirror décale de deux espaces : une ligne indentée au clavier et une ligne
tapée avec quatre espaces, comme la leçon le demande, ne s'alignent plus, et Python lève une
`IndentationError` sur un bloc qui a l'air juste.

Au clavier, on sort toujours de l'éditeur : Échap, puis Tab dans les deux secondes.

## Quiz

### Un quiz n'entre jamais dans `web/public`

Les quiz sont construits par `construire_quiz.py`, dans l'image de l'API seulement.
`construire_quiz.py` refuse d'écrire sous un dossier `public` ou `contenu`.

**Ce qui casse :** tout ce que sert Caddy est lisible par n'importe quel élève. Un quiz publié là
donne les bonnes réponses à qui ouvre l'onglet réseau — dans une partie avec un classement. Les
exercices, eux, y sont à leur place : on s'y entraîne seul.

### L'API reste un seul processus

`Dockerfile.api` lance uvicorn sans `--workers`.

**Ce qui casse :** le registre des WebSocket de la sonnette vit en mémoire. Avec deux processus,
une réponse reçue par l'un ne fait pas sonner l'écran du professeur branché sur l'autre : le
compteur « 18 réponses sur 21 » reste figé jusqu'à la relecture de sûreté, dix secondes plus
tard. Rien ne plante — c'est ce qui le rend difficile à voir. Voir
[[ADR-016 Temps réel par sonnette WebSocket]].

### La correction ne s'écrit pas

`PartieQuiz.phase` ne vaut que `attente`, `question` ou `terminee`. `phase_effective` déduit la
correction de `fin_a` et de l'heure de la lecture ; « Corriger maintenant » recule `fin_a`.

**Ce qui casse :** une phase `correction` écrite par un minuteur serveur serait perdue au
redémarrage du conteneur en pleine question, et la partie resterait bloquée sur une question
close. Deux façons d'entrer en correction divergeraient au premier changement.

### La tolérance de 500 ms existe deux fois

`TOLERANCE` dans `api/app/quiz.py`, `TOLERANCE_MS` dans `web/src/quiz/horloge.ts`.
`api/tests/test_parite_tolerance.py` vérifie qu'elles sont égales.

**Ce qui casse :** l'écran relit à l'échéance plus sa tolérance pour trouver la correction. Trop
tôt, il retombe sur une question close et attend la relecture suivante ; trop tard, la correction
arrive en retard sur tous les écrans à la fois. C'est la seconde duplication délibérée du projet,
après les deux normaliseurs.

### Une lecture partie avant une action est écartée

`FluxQuiz` retient l'envoi de la dernière action appliquée, et ignore toute lecture partie avant.

**Ce qui casse :** le professeur crée une partie, une relecture partie une fraction de seconde
plus tôt revient **après** la réponse de la création, et remet le catalogue à l'écran. Trouvé par
un test qui échouait une fois sur quatre, pas en classe.

### L'écran projeté ne retombe jamais sur le code d'accès

`nommer()` du tableau de bord affiche le code d'accès d'un élève sans prénom — utile au
professeur seul. L'écran du quiz utilise `nomProjete()`, dont le repli est « Élève », et l'API
fait de même (`nom_affiche`) pour la salle d'attente des élèves.

**Ce qui casse :** le code d'accès est le secret de l'élève. Projeté au mur, ou envoyé dans la
salle d'attente d'un autre, il donne sa progression à qui le recopie.

### Le jeton ne passe jamais dans l'URL de la sonnette

Le WebSocket se présente par son premier message, `{"jeton": ...}` ou `{"jeton_prof": ...}`.

**Ce qui casse :** une URL finit dans les journaux du proxy et du serveur, et le jeton professeur
ouvre la progression de toute la classe pendant douze heures. C'est aussi pourquoi le quiz n'utilise pas les
Server-Sent Events : `EventSource` ne sait pas envoyer d'en-tête.

## Déploiement

### Le WebAssembly doit être servi en `application/wasm`

Règle explicite du `Caddyfile`.

**Ce qui casse :** Pyodide refuse de démarrer. Rien ne fonctionne, sans message clair.

### Le contenu ne doit PAS être mis en cache comme les ressources immuables

`Caddyfile` sépare deux régimes : `/pyodide/*`, `/polices/*` et `/assets/*` sont immuables et
gardés un an ; `/contenu/*` est en `Cache-Control: no-cache`, donc revalidé à chaque chargement.

**Ce qui casse :** les fichiers d'`assets` portent un nom haché, qui change à chaque construction —
le cache long est sans danger. ==`/contenu/exercices.json` garde le même chemin d'une construction
à l'autre.== Sans revalidation, tu corriges une faute dans un énoncé, tu reconstruis, tu déploies,
et les navigateurs qui ont déjà ouvert la page continuent d'afficher l'ancien texte. En séance,
c'est indétectable : chacun voit autre chose, personne ne comprend pourquoi.

Vérifié le 4 septembre 2026 en conditions réelles : la correction ne se voyait qu'après un
`fetch(..., {cache: 'reload'})` forcé.

### Aucune ressource externe à l'exécution

Pyodide (**13,1 Mo**) et les cinq polices sont servis depuis l'image. Aucun `<link>` vers
`fonts.googleapis.com` ni `api.fontshare.com` dans le code livré ; un test le vérifie.

**Ce qui casse :** au-delà de la dépendance réseau, hotlinker un service tiers transmet l'adresse
IP de chaque élève. Public mineur, hébergement universitaire.

### `plateforme/contenu/` doit rester commité

`Dockerfile.web` fait `COPY contenu ./contenu`.

**Ce qui casse :** `docker compose build` échoue à froid sur un clone frais, avant même d'atteindre
la construction du contenu, avec un message qui ne dit pas qu'il manque un dossier.

## Voir aussi

[[Journal de décisions]] · [[Moteur d'exécution]] · [[Moteur de validation]] · [[Modèle de contenu]] · [[Déploiement UNIGE]]
