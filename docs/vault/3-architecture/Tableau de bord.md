---
title: Tableau de bord
tags:
  - architecture
  - professeur
mis-a-jour: 2026-09-04
---

# Tableau de bord

L'écran du professeur pendant la séance. Il répond à trois questions, dans cet ordre, et rien
d'autre : **qui bloque**, **sur quoi plusieurs élèves butent en même temps**, et **où en est la
classe**.

> [!quote] Le seul juge
> Ce tableau se juge à la même question que le reste de la plateforme : *est-ce qu'il réduit le
> nombre de fois où un élève doit lever la main pour avancer ?* Voir [[Bilan 2025-2026]].

## Ce qui bloque plusieurs élèves

Le bandeau regroupe les exercices sur lesquels ==au moins deux élèves sont bloqués en même temps==,
du plus encombré au moins encombré, avec les types d'exception les plus fréquents et les codes
concernés.

> [!important] C'est le seul signal qui change ce qu'on fait dans la minute
> Un élève bloqué, on va le voir. **Quatre élèves bloqués au même endroit, on arrête la salle et
> on réexplique.** L'information était déjà dans le tableau, mais il fallait la reconstituer de
> tête en lisant vingt-quatre lignes — c'est-à-dire jamais, en séance.

Un élève seul n'y apparaît pas : il est déjà en tête de la liste, et le signaler deux fois
diluerait celui qui compte.

## Où en est la classe

Une bande porte **un trait par élève**, posé là où il en est, plus la médiane.

> [!note] Pourquoi pas une moyenne
> Une moyenne dirait « la classe est à 12 » et laisserait croire à un groupe homogène. ==C'est
> l'écart qui se pilote== : six traits collés à gauche pendant que trois touchent la fin, c'est
> savoir qu'il faut aller au fond de la salle plutôt que ralentir tout le monde. Les traits se
> superposent là où plusieurs élèves sont au même point, et la densité se lit comme un aplat.

## Chaque ligne

| Colonne | Contenu |
|---|---|
| Élève | **« Camille R. »** — le prénom et l'initiale ; le code en chasse fixe tant que rien n'est saisi. Dessous, sa **jauge** |
| Où | le **titre** de l'exercice, et sa notion en dessous |
| Quoi | échecs d'affilée et type d'erreur · délai d'inactivité · `8 / 25 réussis` |
| Statut | Bloqué · Inactif · Pas commencé · En cours |

`s1-29` ne dit rien à personne, pas même à celui qui a écrit l'exercice. « L'âge qui refuse de
s'additionner », dans « Demander une information », se lit d'un coup d'œil et **se dit à voix
haute dans la salle**. De même pour l'élève : le professeur cherche quelqu'un dans une salle, pas
une chaîne dans une base — ==« Camille R. » se dit à voix haute, « DOJO-K7M2 » non==. Le nom de
famille est abrégé : vingt-quatre élèves de huit établissements tiennent dans un prénom et une
initiale, et la ligne reste lisible.

Un quatrième statut, **« pas commencé »**, pour les inscrits qui n'ont encore rien soumis. Ils
étaient invisibles tant que la liste se construisait depuis les tentatives — or c'est justement
ce qu'on cherche dans le premier quart d'heure.

### La jauge, celle de l'élève

Sous chaque nom, la même barre que l'élève a en haut de son écran. Le dépliant en porte une par
notion, avec son compte — exactement ce que l'élève lit dans son sommaire.

> [!note] Pourquoi une barre à côté d'un chiffre
> ==Le chiffre se lit ligne par ligne, la barre se lit en balayant la colonne.== C'est ainsi qu'on
> repère qui traîne sans lire vingt-quatre nombres.
>
> Les deux décomptes ne comptent que les **obligatoires**, comme chez l'élève
> ([[ADR-004 Mode expert en bonus débloqué]]). S'ils divergeaient, le professeur annoncerait à la
> classe une avance qu'elle ne voit nulle part.

## Déplier une ligne

Chaque ligne s'ouvre sur le **parcours complet** de l'élève : les notions côte à côte, chaque
exercice avec son état — un point, une coche, deux coches — et celui sur lequel il travaille en ce
moment, marqué comme tel. Les facultatifs y figurent, étiquetés. Chaque titre est cliquable et
ouvre l'aperçu sur cet exercice.

> [!danger] Ce que ce panneau ne montre pas, et ne montrera pas
> ==Rien de ce que l'élève a tapé.== Ni son code, ni ses réponses, ni les valeurs qu'il a saisies.
> L'API n'en transporte aucune — [[ADR-001 Exécution du code dans le navigateur]] : le code
> s'exécute dans le navigateur de l'élève et n'en sort jamais.
>
> Un test fixe la forme des étapes (`id`, `titre`, `coches`, `courant`, `obligatoire`) pour qu'un
> champ ajouté par inadvertance fasse échouer la suite plutôt que d'arriver à l'écran. Et le
> panneau le dit en toutes lettres à celui qui le lit.

## L'aperçu de l'espace élève

Chaque exercice du dépliant **s'ouvre**. Le professeur savait qu'on bute sur « L'âge qui refuse de
s'additionner » ; il peut maintenant relire ce que l'énoncé demande, les indices, le code de
départ. Un bouton ouvre aussi l'espace au départ, pour parcourir la séance avant de la faire.

> [!important] Ce ne sont ni des captures ni une maquette
> ==Ce sont les composants de l'élève, avec le contenu publié==, montés tels quels. Ce que le
> professeur lit est exactement ce que la classe lira, y compris la faute de frappe d'un énoncé et
> la longueur réelle d'une leçon. Le bac à sable des leçons fonctionne : on peut exécuter un
> exemple pour le vérifier.

La progression affichée est **vide** et rien n'est enregistré : ce n'est la copie de personne, et
une validation ne part nulle part. La solution de référence n'y figure pas non plus — elle n'est
jamais publiée, voir [[Modèle de contenu]].

C'est une **fenêtre par-dessus tout le reste** : Échap ferme, le focus y entre, le fond ne défile
plus, et le tableau attend derrière, intact — dépliant compris.

> [!warning] Pourquoi en plein écran, et pas dans un cadre
> Encadré sous le tableau, il s'ouvrait tout en bas de la page : le professeur cliquait sur un
> exercice et ==rien ne semblait se passer==. Et la fenêtre de 70 vh, avec ses deux barres de
> défilement imbriquées, rendait un écran d'exercice illisible.

> [!danger] Trois pièges, dans l'ordre où ils se sont présentés
> **La fenêtre est montée sur `<body>` par un portail**, pas là où elle est écrite. `.appli > main`
> porte une animation d'entrée qui déclare un `transform` ; un ancêtre transformé devient le bloc
> conteneur de ses descendants `position: fixed` et crée un contexte d'empilement. L'aperçu se
> posait donc à huit pixels du haut, sous l'en-tête collant, malgré `inset: 0` et `z-index: 50`.
>
> **Les composants élève naviguent par `pushState`.** L'aperçu intercepte le clic *avant* eux et lit
> la destination dans le `href`. Sans cela, un clic dans le cadre ferait quitter le tableau de bord
> au professeur, sans qu'il comprenne pourquoi.
>
> **La numérotation doit rester en parité avec `grouper()`**, et un test la verrouille : les deux
> parcourent les exercices dans l'ordre de publication, filtré par notion. Si l'un des deux se met
> à trier, le lien ouvre un autre exercice sans que rien ne le signale.

## La classe

Sous le tableau, « Ma classe » : créer, corriger, retirer. C'est ici que **naissent les codes
d'accès**, tirés par le serveur — voir [[ADR-012 Le professeur tient la liste de sa classe]].

Deux façons d'ajouter. Une fiche à la fois, ou **une liste collée** : vingt-quatre élèves saisis un
par un font soixante-douze champs et vingt-quatre clics, alors que le professeur a déjà sa liste
quelque part. Une ligne par élève, colonnes séparées par tabulation, point-virgule ou virgule — la
tabulation d'abord, parce qu'un nom composé contient une virgule bien plus souvent qu'une
tabulation. ==L'aperçu compte les élèves reconnus avant d'écrire quoi que ce soit== : sur
vingt-quatre lignes, une colonne mal devinée doit se voir avant, pas après.

Retirer un élève emporte ses tentatives. La confirmation nomme l'élève **et** le nombre de
tentatives perdues, jamais un « Confirmer ? » nu.

## Le pouls

Un point qui bat, et le temps écoulé depuis la dernière réponse. En classe, ==un tableau figé et
une classe silencieuse se ressemblent trait pour trait== : sans lui, le professeur ne peut pas
distinguer « personne ne soumet rien » de « la page ne se met plus à jour ». La liaison rompue
s'affiche en rouge, explicitement.

## Ce que l'API renvoie, et ce qu'elle ne sait pas

`GET /prof/seance` rend une ligne par élève **inscrit**, qu'il ait soumis quelque chose ou
non. Elle part de la classe, pas des tentatives.

> [!danger] L'API ne connaît pas le contenu
> Elle ignore quels exercices sont **obligatoires** — le contenu est construit côté front — donc
> elle ne peut produire aucun décompte comparable à un total. Elle renvoie la **liste** des
> exercices réussis, chacun avec son verdict, et le tableau de bord fait le tri selon
> [[ADR-004 Mode expert en bonus débloqué]].
>
> Le faire remonter par le client reviendrait à faire confiance au navigateur d'un élève pour une
> donnée qui pilote l'affichage professeur. C'est aussi pourquoi il n'existe **pas de statut
> « terminé »** : il supposerait ce même total.

Le code source de l'élève ne remonte jamais — seulement le verdict et le **type** d'exception.
Voir [[ADR-002 Identification par code d'agent]].

## Deux pièges corrigés

> [!warning] « Bloqué 0 min »
> Le délai affiché était `inactif_depuis_s`, c'est-à-dire le temps depuis la **dernière
> soumission** — souvent quelques secondes chez un élève qui enchaîne les essais. « Bloqué
> 0 min » ne veut rien dire. Le délai ne s'affiche plus qu'au-delà d'une minute.

> [!warning] Un compte sans dénominateur
> « 24 exercices validés » ne dit pas si c'est beaucoup. Et le compte incluait les renforts et les
> bonus, qui n'entrent dans aucune progression. C'est ce qui a motivé le passage de `reussis`
> d'un entier à une liste.

## La porte

Le code professeur ne passe **jamais dans l'URL** : il finirait dans l'historique et dans les
captures d'une projection en classe. Il se tape, et se garde le temps de l'onglet —
`sessionStorage`, jamais `localStorage`, parce que la machine de la salle est partagée.

## Voir aussi

[[Vue d'ensemble]] · [[Pièges et invariants]] · [[Bilan 2025-2026]] · [[ADR-004 Mode expert en bonus débloqué]]
