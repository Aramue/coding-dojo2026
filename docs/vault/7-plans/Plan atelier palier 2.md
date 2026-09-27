---
title: Plan atelier palier 2
tags:
  - plan
  - implementation
  - contenu
statut: exécuté
date: 2026-09-27
---

# Atelier des exercices — Plan d'implémentation

> **Exécution :** en ligne, tâche par tâche, un commit par tâche.

**Goal:** Composer un exercice neuf de bout en bout dans l'onglet Atelier, l'éprouver par le moteur de l'élève, et en ressortir un fichier YAML au style de la maison.

**Architecture:** Un brouillon vit dans l'état de la page. Trois modules purs le servent — un émetteur YAML, une batterie de contrôles, une sortie de fichier — et l'interface n'est qu'un formulaire au-dessus. L'aperçu monte `EcranExercice` avec le brouillon ; les essais passent par `Executeur` et `evaluer()`, c'est-à-dire par le moteur de l'élève.

**Tech Stack:** React 19 · TypeScript · Vitest · Pyodide (via l'`Executeur` existant)

Spécification : [[Spécification atelier de contenu]], section 5. Décision : [[ADR-015 L'atelier écrit des fichiers, pas des lignes de base]].

## Global Constraints

- **Cette tranche ne fait pas le glisser-déposer**, ni les leçons. Reprendre un fichier existant vient juste après ; la dépendance `yaml` n'arrive donc pas encore.
- **Aucune dépendance nouvelle** dans cette tranche.
- **Couverture à 100 %** sur les quatre métriques, seuil déjà verrouillé. Une ligne inatteignable porte un `/* v8 ignore next */` **et sa raison**.
- **Aucun appel à l'API.** L'atelier lit `schema.json` et `notions.json`, rien d'autre.
- Français correctement accentué dans tout ce que lit le professeur.
- Messages de commit : `type: sujet`, sans scope, en ASCII, au présent descriptif. Aucune ligne d'attribution.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/atelier/brouillon.ts` | Le type du brouillon, ses valeurs de départ, et sa conversion en `Exercice` pour l'aperçu |
| `src/atelier/yaml.ts` | L'émetteur : un brouillon devient le texte d'un fichier, au style du dépôt |
| `src/atelier/controles.ts` | La batterie d'essais — les deux règles de chaîne, et l'orchestration des exécutions |
| `src/atelier/fichiers.ts` | Faire sortir le fichier : téléchargement, et enregistrement en place quand le navigateur le permet |
| `src/ui/Atelier.tsx` + `.css` | La page : deux colonnes, deux onglets à droite |
| `src/ui/atelier/Formulaire.tsx` | Les champs simples et les éditeurs |
| `src/ui/atelier/Tests.tsx` | Les cartes de tests, une par type |
| `src/ui/atelier/Essais.tsx` | Le panneau des résultats |

---

### Tâche 1 : le brouillon, et l'émetteur YAML

**Files:**
- Create: `src/atelier/brouillon.ts`, `src/atelier/yaml.ts`
- Modify: `src/contenu/types.ts` (`seance: 1 | 2 | 3` → `number`)
- Test: `tests/atelier/yaml.test.ts`

**Interfaces:**
- Produces: `type Brouillon` (les champs d'un exercice, `famille` exclue — elle se déduit de la notion) ; `BROUILLON_VIDE: Brouillon` ; `versExercice(b: Brouillon, notions: Notion[]): Exercice` ; `enYaml(b: Brouillon): string` ; `nomDeFichier(b: Brouillon): string`.

- [x] **Étape 1 : élargir le type de séance.** `src/contenu/types.ts` porte encore `seance: 1 | 2 | 3`, resté de l'époque où le schéma s'arrêtait à trois. Le mettre à `number`, avec un commentaire renvoyant à ADR-015.

- [x] **Étape 2 : écrire les épreuves de l'émetteur** — `tests/atelier/yaml.test.ts`. Le cœur est un exercice complet dont on compare le texte produit, **caractère par caractère**, au style du dépôt :

```ts
it('écrit un exercice au style de la maison', () => {
  expect(enYaml(exemple())).toBe(`id: s2-14
concept: booleens
notion: comparer
seance: 2
niveau: normal
type: debug
titre: "= range, == compare"
obligatoire: true
enonce: |
  Ce programme demande le code d'un casier.
depart: |
  ouvert = (code = 4321)
indices:
  - Le message parle de la ligne 2.
tests:
  - type: sortie
    entrees: ["4321"]
    attendu: |-
      Casier ouvert : True
solution: |
  ouvert = (code == 4321)
`)
})
```

  Et les règles une par une : un titre sans caractère spécial n'est pas mis entre guillemets ; un titre qui contient `:` ou commence par un chiffre l'est ; un texte multiligne sort en `|` ; un `attendu` sans saut final sort en `|-` ; `entrees` sort en liste courte sur une ligne ; une liste vide et un champ vide **ne sortent pas du tout** ; les clés gardent l'ordre du modèle.

- [x] **Étape 3 : les lancer.** Attendu : échec à l'import.

- [x] **Étape 4 : écrire `brouillon.ts`**, puis `yaml.ts`. L'émetteur est une suite de petites fonctions — `scalaire`, `bloc`, `listeCourte` — et une table qui fixe l'ordre des clés. Il ne connaît que le modèle de l'exercice : ==c'est un émetteur de ce format-là, pas un émetteur YAML général==, et le dire en tête du fichier évite qu'on l'étende un jour sans raison.

- [x] **Étape 5 : la suite entière, avec couverture.** Attendu : `src/atelier/**` à 100 %.

- [x] **Étape 6 : commit** — `feat: un brouillon d'exercice s'ecrit en YAML au style du depot`

---

### Tâche 2 : la batterie d'essais

**Files:**
- Create: `src/atelier/controles.ts`
- Test: `tests/atelier/controles.test.ts`

**Interfaces:**
- Consumes: `evaluer` de `../validation/evaluer`, `Executeur`, `versExercice` (tâche 1).
- Produces: `type Essai = { titre: string; verdict: 'vert' | 'rouge'; detail?: string }` ; `eprouver(b: Brouillon, notions: Notion[], executeur: Executeur): Promise<Essai[]>` ; `remplirAttendu(b: Brouillon, index: number, executeur: Executeur): Promise<string>`.

- [x] **Étape 1 : écrire les épreuves.** Un exécuteur simulé, comme dans `tests/ui/EcranExercice.test.tsx`. Les cas :
  - la solution passe ses tests → un essai vert ;
  - la solution échoue → rouge, et le détail dit lequel des tests ;
  - le code de départ échoue → vert (c'est ce qu'on veut) ;
  - **le code de départ passe déjà** → rouge, « l'exercice est déjà résolu » ;
  - un départ vide → l'essai du départ est **absent**, il n'y a rien à éprouver ;
  - un motif interdit présent dans la solution → rouge ;
  - un motif contenant un guillemet → rouge, « il se contourne en changeant de ponctuation » ;
  - `remplirAttendu` exécute la solution avec les entrées du test visé et rend la sortie ;
  - `remplirAttendu` sur une solution qui plante **lève**, et n'écrit rien.

- [x] **Étape 2 : les lancer.** Attendu : échec à l'import.

- [x] **Étape 3 : écrire `controles.ts`.** Deux parties. Les deux règles de chaîne, recopiées de `verifier_coherence` — ==un miroir assumé, qui porte le nom de sa contrepartie en commentaire==, comme `evaluer` l'est déjà de `_passe`. Puis l'orchestration : pour chaque test, exécuter le code avec **ses** entrées, jamais une exécution partagée, et mettre en cache les jeux d'entrées identiques.

  Pour le départ, `evaluer` est appelé sans exiger les critères de maîtrise : un `contient` marqué `maitrise` qui manque ne rend pas un départ « non résolu ». C'est la distinction que fait `_passe(exiger_maitrise=False)`.

- [x] **Étape 4 : la suite entière.** Attendu : tout passe, `src/atelier/**` à 100 %.

- [x] **Étape 5 : commit** — `feat: l'atelier eprouve un exercice par le moteur de l'eleve`

---

### Tâche 3 : faire sortir le fichier

**Files:**
- Create: `src/atelier/fichiers.ts`
- Test: `tests/atelier/fichiers.test.ts`

**Interfaces:**
- Produces: `peutEnregistrerEnPlace(): boolean` ; `telecharger(nom: string, texte: string): void` ; `enregistrerEnPlace(nom: string, texte: string): Promise<'enregistre' | 'annule'>`.

- [x] **Étape 1 : écrire les épreuves.** `showSaveFilePicker` et `URL.createObjectURL` se simulent. Les cas : le téléchargement crée un lien et le révoque ; l'enregistrement en place écrit le contenu ; **l'annulation de la fenêtre de fichier n'est pas une erreur** — le professeur a simplement changé d'avis ; l'API absente rend `false`.

- [x] **Étape 2 : les lancer.** Attendu : échec à l'import.

- [x] **Étape 3 : écrire `fichiers.ts`.** L'API d'accès au système de fichiers n'existe que sur Chrome et Edge : ==sa détection se fait sur `window`, jamais sur le nom du navigateur==. Une annulation lève une `AbortError`, qu'on distingue d'une vraie panne.

- [x] **Étape 4 : la suite entière.**

- [x] **Étape 5 : commit** — `feat: un exercice compose sort en fichier, telecharge ou enregistre en place`

---

### Tâche 4 : le formulaire et les cartes de tests

**Files:**
- Create: `src/ui/atelier/Formulaire.tsx`, `src/ui/atelier/Tests.tsx`
- Test: `tests/ui/atelier/Formulaire.test.tsx`, `tests/ui/atelier/Tests.test.tsx`

**Interfaces:**
- Produces: `Formulaire({ brouillon, notions, onChange })` ; `Tests({ tests, onChange, onRemplir })` où `onRemplir(index: number)` déclenche le remplissage de l'`attendu`.

- [x] **Étape 1 : écrire les épreuves.** Les cas qui comptent :
  - la liste des notions vient de `notions.json`, ==jamais d'une copie== ;
  - **la séance se déduit de l'identifiant** et ne se saisit pas : taper `s4-12` affiche « séance 4 » ;
  - les énumérations — `type`, `niveau` — viennent de `schema.json` ;
  - ajouter une carte par type ; chaque carte n'affiche que ses propres champs ;
  - le bouton « Remplir depuis la solution » n'existe que sur une carte `sortie` ;
  - retirer une carte ;
  - les indices sont du **texte brut** : un `**` y reste littéral, et l'interface le dit.

- [x] **Étape 2 : les lancer.**

- [x] **Étape 3 : écrire les deux composants.** Les éditeurs de code sont ceux de l'élève, `Editeur`. Les champs simples sont pilotés par `schema.json` : la page le charge et le passe en prop, pour que le composant reste testable sans réseau.

- [x] **Étape 4 : la suite entière.**

- [x] **Étape 5 : commit** — `feat: le formulaire de l'atelier se pilote sur le schema publie`

---

### Tâche 5 : la page, ses deux onglets, et le troisième onglet de l'espace professeur

**Files:**
- Create: `src/ui/Atelier.tsx`, `src/ui/Atelier.css`, `src/ui/atelier/Essais.tsx`
- Modify: `src/ui/EcranProf.tsx` (la table `ONGLETS` gagne `atelier`)
- Test: `tests/ui/Atelier.test.tsx`, `tests/ui/EcranProf.test.tsx`

- [x] **Étape 1 : écrire les épreuves.** Le tour complet, en un test : remplir les champs, remplir l'`attendu` depuis la solution, lancer les essais, les voir verts, et vérifier que le texte exporté est celui qu'on attend. Puis : l'onglet **Aperçu** monte l'écran de l'élève avec ce qu'on tape ; les deux onglets de droite ne s'affichent pas ensemble ; l'export est **refusé tant qu'un champ requis manque**, et dit lequel.

  Côté `EcranProf` : le troisième onglet existe, mène à `/prof/atelier`, et l'atelier s'y affiche.

- [x] **Étape 2 : les lancer.**

- [x] **Étape 3 : écrire la page.** Deux colonnes ; à droite un panneau à deux onglets, **Aperçu** et **Essais**. La troisième entrée de `ONGLETS` dans `EcranProf.tsx`, et le rendu de `<Atelier />` pour `onglet === 'atelier'`.

  ==Attention au piège déjà rencontré== : il y aura une **troisième** `tablist` sur la page quand l'atelier est ouvert. Elle s'annonce « Aperçu et essais ».

- [x] **Étape 4 : la suite entière**, plus `tsc`.

- [x] **Étape 5 : vérifier dans le navigateur.** La pile de développement, `docker compose -f docker-compose.dev.yml up`. Composer un exercice, lancer les essais, lire l'aperçu. Capture à l'appui.

- [x] **Étape 6 : commit** — `feat: l'atelier des exercices ouvre son onglet`

---

### Tâche 6 : le coffre suit

- [x] **Étape 1 : [[Spécification atelier de contenu]]** — marquer ce qui est livré, et ce qui reste (glisser-déposer, leçons).
- [x] **Étape 2 : [[Tableau de bord]]** — la table des onglets gagne sa troisième ligne.
- [x] **Étape 3 : [[Modèle de contenu]]** — dire qu'un exercice peut désormais s'écrire depuis l'atelier, et que le fichier reste la source.
- [x] **Étape 4 : [[Accueil]]** — l'état, et les nombres de tests.
- [x] **Étape 5 : commit** — `docs: le coffre enregistre l'atelier des exercices`

## Ce qui reste après cette tranche

Le **glisser-déposer** d'un YAML existant, avec la dépendance `yaml` et le contrôle des champs
inconnus. Puis le **palier 3**, l'atelier des leçons.
