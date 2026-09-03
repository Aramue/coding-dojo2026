---
title: Plan palier 1
tags:
  - plan
  - implementation
statut: à exécuter
date: 2026-09-03
echeance: 2026-09-16
---

# Plateforme Quartier Général — Plan d'implémentation du palier 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer, pour le mercredi 16 septembre 2026, une plateforme où un élève ouvre une page, saisit un code d'agent, résout les 25 exercices obligatoires de la séance 1, et sait en moins d'une seconde s'il a réussi — sans qu'un professeur intervienne.

**Architecture:** Le Python s'exécute dans un Web Worker Pyodide qui ne fait qu'**exécuter** et renvoie un objet simple (`stdout`, erreur, variables lues). Toute la logique de validation est du TypeScript pur au-dessus de cet objet, donc testable sans Pyodide. Une API FastAPI mince persiste la progression dans SQLite ; elle ne reçoit jamais le code écrit par l'élève. Le contenu est constitué de fichiers YAML validés à la construction par un outillage Python.

**Tech Stack:** TypeScript · React 18 · Vite · Vitest · CodeMirror 6 · Pyodide 0.26 · Python 3.12 · FastAPI · SQLModel · SQLite · pytest · Docker Compose · Caddy

Spécification de référence : [[Spécification chapitre 1]].

## Global Constraints

- **Langue** : toute chaîne visible par un élève ou un professeur est en **français**. Les identifiants de code sont en français également (`ResultatExecution`, `verdict`, `attendu`) — la cohérence prime sur l'usage anglophone.
- **Le code de l'élève ne quitte jamais son navigateur.** Aucune route d'API n'accepte de code source. Violer ce point invalide [[ADR-001 Exécution du code dans le navigateur]] et le dossier de sécurité UNIGE.
- **Aucune donnée personnelle.** La base ne contient que `code_agent`, progression et horodatages. Ni nom, ni prénom, ni adresse.
- **Aucune ressource externe à l'exécution.** Pyodide, les polices et toutes les dépendances sont servis depuis la machine UNIGE. Aucun `<link>` ni `<script>` vers un CDN dans le HTML livré.
- **Verdicts** : `vert` (sortie exacte), `bleu` (correct après normalisation, valide et débloque), `rouge` (échec). Jamais d'autre valeur.
- **Un seul échec affiché à la fois.** L'évaluateur s'arrête au premier test échoué.
- **Timeout d'exécution : 5000 ms.** Au-delà, le worker est terminé et relancé.
- **Polices** : General Sans 400/700, JetBrains Mono. La chasse fixe est réservée au code, aux valeurs hexadécimales et aux identifiants d'agent — jamais de libellé d'interface en monospace, jamais de capitales interlettrées ([[ADR-005 Typographie General Sans]]).
- **Tokens couleur** : voir [[Palette]]. Aucune couleur en dur dans un composant ; tout passe par une variable CSS.
- **`getpass` est banni** de tout exercice, énoncé, corrigé et exemple.
- **Aucun emoji** dans une sortie comparée.
- **Commits** : un par tâche minimum, message en français, préfixe conventionnel (`feat:`, `test:`, `chore:`).

---

## Structure des fichiers

```
plateforme/
  web/                              # front, construit par Vite
    index.html
    package.json
    vite.config.ts
    vitest.config.ts
    public/
      pyodide/                      # Pyodide auto-hébergé (Tâche 5)
      polices/                      # WOFF2 auto-hébergées (Tâche 9)
    src/
      execution/
        types.ts                    # ResultatExecution, ErreurPython
        worker.ts                   # le Web Worker Pyodide — exécute, ne juge pas
        executeur.ts                # API fil principal -> worker, timeout, redémarrage
      validation/
        types.ts                    # Test, Verdict, ResultatTest, SegmentDiff
        normaliser.ts               # normalisation des sorties (verdict bleu)
        diff.ts                      # diff caractère par caractère
        erreurs.ts                  # traceback Python -> message français
        evaluer.ts                  # les 4 types de test -> verdict global
      contenu/
        types.ts                    # Exercice (miroir du schéma YAML)
        chargeur.ts                 # récupère et met en cache les exercices
      api/
        client.ts                   # session, parcours, tentative
      ui/
        tokens.css                  # variables de la charte
        base.css                    # reset, typographie, polices
        CarteCode.tsx               # carte sombre + pastilles macOS
        Editeur.tsx                 # CodeMirror 6, thème Dracula
        PanneauVerdict.tsx          # affichage vert/bleu/rouge + diff
        EcranExercice.tsx
        EcranConnexion.tsx
        Parcours.tsx
        TableauDeBord.tsx
      app.tsx
      main.tsx
    tests/                          # miroir de src/, suffixe .test.ts

  api/                              # backend
    requirements.txt
    app/
      main.py                       # application FastAPI, montage des routeurs
      modeles.py                    # tables SQLModel
      bdd.py                        # moteur, session, création du schéma
      securite.py                   # jetons de session
      routes_eleve.py               # /session, /parcours, /tentative
      routes_prof.py                # /prof/seance, /prof/verrou
    tests/
      conftest.py
      test_session.py
      test_parcours.py
      test_tentative.py
      test_prof.py

  outils/                           # outillage de contenu (Python)
    requirements.txt
    schema.py                       # modèles Pydantic de l'exercice
    valider_contenu.py              # CLI : valide tout le contenu
    generer_attendu.py              # CLI : exécute la solution, écrit 'attendu'
    tests/
      test_schema.py
      test_valider_contenu.py

  contenu/
    chapitre-1/
      seance-1/
        01-print/
        02-execution/
        03-variables/
        04-types/
        05-input/
        99-probleme/

  deploiement/
    docker-compose.yml
    Caddyfile
    Dockerfile.api
    Dockerfile.web
```

**Frontières et responsabilités**

| Unité | Responsabilité unique | Ne fait jamais |
|---|---|---|
| `execution/` | Faire tourner du Python et rapporter un résultat brut | Juger, comparer, formuler un message |
| `validation/` | Transformer un `ResultatExecution` + des tests en verdict | Exécuter du Python, toucher au DOM |
| `contenu/` | Charger et typer les exercices | Valider une réponse |
| `api/client.ts` | Parler au backend | Contenir de la logique métier |
| `ui/` | Afficher | Contenir de la logique de validation |

`validation/` ne dépend d'aucune API navigateur : c'est un ensemble de fonctions pures, testables en Node sans Pyodide ni DOM. ==C'est la propriété qui rend ce plan exécutable en TDD.==

---

## Tâche 1 : Squelette web et normalisation des sorties

Le cœur du verdict bleu. On commence par là parce que c'est la fonction dont dépend tout le reste, et qu'elle est testable sans aucune infrastructure.

**Files:**
- Create: `plateforme/web/package.json`
- Create: `plateforme/web/vite.config.ts`
- Create: `plateforme/web/vitest.config.ts`
- Create: `plateforme/web/tsconfig.json`
- Create: `plateforme/web/src/validation/normaliser.ts`
- Test: `plateforme/web/tests/validation/normaliser.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: `normaliser(texte: string): string` — utilisée par `evaluer.ts` (Tâche 4)

- [ ] **Step 1 : Créer le projet et installer les dépendances**

```bash
mkdir -p plateforme/web/src/validation plateforme/web/tests/validation
cd plateforme/web
pnpm init
pnpm add react react-dom
pnpm add -D typescript vite @vitejs/plugin-react vitest @types/react @types/react-dom
```

- [ ] **Step 2 : Écrire les fichiers de configuration**

`plateforme/web/tsconfig.json` :

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable", "WebWorker"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["src", "tests"]
}
```

`plateforme/web/vite.config.ts` :

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { target: 'es2022', outDir: 'dist' },
})
```

`plateforme/web/vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

Ajouter dans `package.json` :

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  }
}
```

- [ ] **Step 3 : Écrire le test qui échoue**

`plateforme/web/tests/validation/normaliser.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { normaliser } from '../../src/validation/normaliser'

describe('normaliser', () => {
  it('supprime les espaces en fin de ligne', () => {
    expect(normaliser('Agent Corbeau   \nAge 17')).toBe('agent corbeau\nage 17')
  })

  it('supprime les lignes vides finales', () => {
    expect(normaliser('Bonjour\n\n\n')).toBe('bonjour')
  })

  it('reduit les espaces multiples internes a un seul', () => {
    expect(normaliser('Agent    Corbeau')).toBe('agent corbeau')
  })

  it('ignore la casse', () => {
    expect(normaliser('ACCES AUTORISE')).toBe('acces autorise')
  })

  it('retire les accents', () => {
    expect(normaliser('Accès autorisé')).toBe('acces autorise')
  })

  it('unifie les fleches et les deux-points', () => {
    // Diallo a ete recale en 2025 pour avoir ecrit -> au lieu de →
    expect(normaliser('Position 1 → 8')).toBe(normaliser('Position 1 -> 8'))
    expect(normaliser('Position 1 : 8')).toBe(normaliser('Position 1 -> 8'))
  })

  it('unifie les apostrophes droites et typographiques', () => {
    expect(normaliser("Ton code d'acces")).toBe(normaliser('Ton code d’acces'))
  })

  it('supprime les emoji', () => {
    expect(normaliser('Acces autorise ✅')).toBe('acces autorise')
  })

  it('unifie les fins de ligne Windows', () => {
    expect(normaliser('a\r\nb')).toBe('a\nb')
  })

  it('laisse une sortie deja propre inchangee', () => {
    expect(normaliser('agent corbeau\nage 17')).toBe('agent corbeau\nage 17')
  })
})
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il échoue**

Run : `pnpm test`
Expected : FAIL — `Failed to resolve import "../../src/validation/normaliser"`

- [ ] **Step 5 : Écrire l'implémentation**

`plateforme/web/src/validation/normaliser.ts` :

```ts
/**
 * Normalise une sortie de programme pour la comparaison tolerante du verdict BLEU.
 *
 * Ce qui est neutralise ici correspond exactement aux ecarts que le professeur
 * laissait passer en 2025 en ecrivant « BIEN PB AFFICHAGE » sur la copie.
 * En comparaison stricte, 6 eleves sur 17 auraient ete recales automatiquement.
 */
export function normaliser(texte: string): string {
  return texte
    .replace(/\r\n/g, '\n')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques
    .replace(/[‘’‛]/g, "'") // apostrophes typographiques
    .replace(/[“”]/g, '"') // guillemets typographiques
    .replace(/[→➡]|->|:/g, '>') // fleches et deux-points unifies
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
    .toLowerCase()
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
```

- [ ] **Step 6 : Lancer le test pour vérifier qu'il passe**

Run : `pnpm test`
Expected : PASS — 10 tests

- [ ] **Step 7 : Commit**

```bash
git add plateforme/web
git commit -m "feat: normalisation des sorties pour le verdict bleu"
```

---

## Tâche 2 : Diff caractère par caractère

Le verdict bleu affiche l'écart. Sans diff visible, l'élève sait qu'il s'est trompé mais pas où — et il lève la main, ce que tout le projet cherche à éviter.

**Files:**
- Create: `plateforme/web/src/validation/types.ts`
- Create: `plateforme/web/src/validation/diff.ts`
- Test: `plateforme/web/tests/validation/diff.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `type SegmentDiff = { type: 'egal' | 'ajout' | 'manque'; texte: string }`
  - `diffCaracteres(attendu: string, obtenu: string): SegmentDiff[]`
  - `rendreVisible(texte: string): string` — rend espaces et sauts de ligne visibles

- [ ] **Step 1 : Écrire les types partagés**

`plateforme/web/src/validation/types.ts` :

```ts
export type Verdict = 'vert' | 'bleu' | 'rouge'

export type SegmentDiff = {
  /** `ajout` = présent chez l'élève et pas attendu ; `manque` = attendu et absent */
  type: 'egal' | 'ajout' | 'manque'
  texte: string
}

export type Test =
  | { type: 'sortie'; entrees: string[]; attendu: string; exigeExact?: boolean }
  | { type: 'variable'; nom: string; valeurAttendue?: string; typeAttendu?: string }
  | { type: 'qcm'; options: string[]; bonneReponse: number }
  | { type: 'interdit'; motif: string }
  | { type: 'contient'; motif: string }

export type ResultatTest = {
  verdict: Verdict
  /** Phrase affichée à l'élève, toujours en français */
  titre: string
  detail?: string
  diff?: SegmentDiff[]
}
```

- [ ] **Step 2 : Écrire le test qui échoue**

`plateforme/web/tests/validation/diff.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { diffCaracteres, rendreVisible } from '../../src/validation/diff'

describe('diffCaracteres', () => {
  it('renvoie un seul segment egal quand les textes sont identiques', () => {
    expect(diffCaracteres('abc', 'abc')).toEqual([{ type: 'egal', texte: 'abc' }])
  })

  it('signale un caractere en trop', () => {
    expect(diffCaracteres('abc', 'abxc')).toEqual([
      { type: 'egal', texte: 'ab' },
      { type: 'ajout', texte: 'x' },
      { type: 'egal', texte: 'c' },
    ])
  })

  it('signale un caractere manquant', () => {
    expect(diffCaracteres('abc', 'ac')).toEqual([
      { type: 'egal', texte: 'a' },
      { type: 'manque', texte: 'b' },
      { type: 'egal', texte: 'c' },
    ])
  })

  it('signale une espace en trop, le cas le plus frequent', () => {
    expect(diffCaracteres('Agent Corbeau', 'Agent  Corbeau')).toEqual([
      { type: 'egal', texte: 'Agent ' },
      { type: 'ajout', texte: ' ' },
      { type: 'egal', texte: 'Corbeau' },
    ])
  })

  it('gere une chaine obtenue vide', () => {
    expect(diffCaracteres('abc', '')).toEqual([{ type: 'manque', texte: 'abc' }])
  })
})

describe('rendreVisible', () => {
  it('rend les espaces et les sauts de ligne visibles', () => {
    expect(rendreVisible('a b\nc')).toBe('a·b⏎\nc')
  })
})
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run : `pnpm test`
Expected : FAIL — module `diff` introuvable

- [ ] **Step 4 : Écrire l'implémentation**

`plateforme/web/src/validation/diff.ts` :

```ts
import type { SegmentDiff } from './types'

/**
 * Diff caractere par caractere par plus longue sous-sequence commune.
 * Les sorties comparees font quelques centaines de caracteres au maximum :
 * l'algorithme quadratique est largement suffisant et reste lisible.
 */
export function diffCaracteres(attendu: string, obtenu: string): SegmentDiff[] {
  const n = attendu.length
  const m = obtenu.length
  const table: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i]![j] =
        attendu[i] === obtenu[j]
          ? table[i + 1]![j + 1]! + 1
          : Math.max(table[i + 1]![j]!, table[i]![j + 1]!)
    }
  }

  const segments: SegmentDiff[] = []
  const pousser = (type: SegmentDiff['type'], c: string) => {
    const dernier = segments[segments.length - 1]
    if (dernier && dernier.type === type) dernier.texte += c
    else segments.push({ type, texte: c })
  }

  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (attendu[i] === obtenu[j]) {
      pousser('egal', attendu[i]!)
      i++
      j++
    } else if (table[i + 1]![j]! >= table[i]![j + 1]!) {
      pousser('manque', attendu[i]!)
      i++
    } else {
      pousser('ajout', obtenu[j]!)
      j++
    }
  }
  while (i < n) pousser('manque', attendu[i++]!)
  while (j < m) pousser('ajout', obtenu[j++]!)

  return segments
}

/** Rend visibles les caracteres invisibles, pour que l'eleve voie l'espace en trop. */
export function rendreVisible(texte: string): string {
  return texte.replace(/ /g, '·').replace(/\n/g, '⏎\n')
}
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run : `pnpm test`
Expected : PASS — 6 nouveaux tests

- [ ] **Step 6 : Commit**

```bash
git add plateforme/web/src/validation plateforme/web/tests/validation
git commit -m "feat: diff caractere par caractere pour le verdict bleu"
```

---

## Tâche 3 : Traduction des erreurs Python en français

C'est la pièce au plus fort effet sur le nombre de mains levées. Un débutant devant `TypeError: can only concatenate str (not "int") to str` ne peut rien faire d'autre qu'appeler le professeur.

**Files:**
- Create: `plateforme/web/src/execution/types.ts`
- Create: `plateforme/web/src/validation/erreurs.ts`
- Test: `plateforme/web/tests/validation/erreurs.test.ts`

**Interfaces:**
- Consumes: rien
- Produces:
  - `type ErreurPython = { type: string; message: string; ligne: number | null }`
  - `type ResultatExecution = { stdout: string; erreur: ErreurPython | null; variables: Record<string, VariableLue>; dureeMs: number; timeout: boolean }`
  - `type VariableLue = { valeur: string; type: string }`
  - `traduireErreur(erreur: ErreurPython): MessageErreur`
  - `type MessageErreur = { titre: string; explication: string; piste: string }`

- [ ] **Step 1 : Écrire les types d'exécution**

`plateforme/web/src/execution/types.ts` :

```ts
export type ErreurPython = {
  /** Nom de l'exception : "TypeError", "NameError", … */
  type: string
  /** Message brut renvoyé par Python, en anglais */
  message: string
  ligne: number | null
}

export type VariableLue = {
  /** repr() de la valeur, toujours sérialisée en chaîne */
  valeur: string
  /** type(...).__name__ : "int", "str", "bool", "float" */
  type: string
}

export type ResultatExecution = {
  stdout: string
  erreur: ErreurPython | null
  variables: Record<string, VariableLue>
  dureeMs: number
  timeout: boolean
}
```

- [ ] **Step 2 : Écrire le test qui échoue**

`plateforme/web/tests/validation/erreurs.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { traduireErreur } from '../../src/validation/erreurs'

describe('traduireErreur', () => {
  it('traduit NameError en nommant la variable', () => {
    const m = traduireErreur({ type: 'NameError', message: "name 'nom' is not defined", ligne: 3 })
    expect(m.titre).toContain('nom')
    expect(m.explication).toMatch(/existe pas/i)
    expect(m.piste).toMatch(/majuscule|different/i)
  })

  it('traduit la concatenation texte + nombre', () => {
    const m = traduireErreur({
      type: 'TypeError',
      message: 'can only concatenate str (not "int") to str',
      ligne: 5,
    })
    expect(m.explication).toMatch(/nombre.*texte|texte.*nombre/i)
    expect(m.piste).toContain('str(')
  })

  it('traduit int() sur du texte non numerique', () => {
    const m = traduireErreur({
      type: 'ValueError',
      message: "invalid literal for int() with base 10: 'vingt'",
      ligne: 2,
    })
    expect(m.explication).toMatch(/chiffres/i)
    expect(m.titre).toContain('vingt')
  })

  it('traduit le deux-points manquant', () => {
    const m = traduireErreur({ type: 'SyntaxError', message: 'expected \':\'', ligne: 4 })
    expect(m.piste).toContain(':')
  })

  it('traduit IndentationError', () => {
    const m = traduireErreur({
      type: 'IndentationError',
      message: 'expected an indented block',
      ligne: 6,
    })
    expect(m.explication).toMatch(/decal/i)
  })

  it('traduit la division par zero', () => {
    const m = traduireErreur({
      type: 'ZeroDivisionError',
      message: 'division by zero',
      ligne: 1,
    })
    expect(m.explication).toMatch(/zero/i)
  })

  it('ne donne jamais la ligne de code corrigee', () => {
    const m = traduireErreur({ type: 'NameError', message: "name 'age' is not defined", ligne: 1 })
    expect(m.piste).not.toMatch(/age\s*=\s*\d/)
  })

  it('retombe sur un message generique pour une exception inconnue', () => {
    const m = traduireErreur({ type: 'RecursionError', message: 'boom', ligne: null })
    expect(m.titre).toBeTruthy()
    expect(m.explication).toBeTruthy()
    expect(m.piste).toBeTruthy()
  })
})
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run : `pnpm test`
Expected : FAIL — module `erreurs` introuvable

- [ ] **Step 4 : Écrire l'implémentation**

`plateforme/web/src/validation/erreurs.ts` :

```ts
import type { ErreurPython } from '../execution/types'

export type MessageErreur = {
  titre: string
  explication: string
  /** Ce qu'il faut essayer. Ne contient JAMAIS la ligne corrigée. */
  piste: string
}

type Regle = {
  type: string
  motif: RegExp
  construire: (c: RegExpMatchArray) => MessageErreur
}

const REGLES: Regle[] = [
  {
    type: 'NameError',
    motif: /name '(.+?)' is not defined/,
    construire: (c) => ({
      titre: `La variable ${c[1]} n'existe pas encore`,
      explication: `Tu utilises ${c[1]} avant de lui avoir donné une valeur.`,
      piste: `Vérifie que tu l'as bien créée plus haut, et que tu l'écris exactement pareil — Python distingue les majuscules des minuscules.`,
    }),
  },
  {
    type: 'TypeError',
    motif: /can only concatenate str \(not "(\w+)"\) to str/,
    construire: () => ({
      titre: 'Tu essaies de coller un nombre à du texte',
      explication: `Python refuse d'additionner du texte et un nombre : ce sont deux types différents.`,
      piste: `Transforme le nombre en texte avant de le coller : str(age). Ou utilise un f-string.`,
    }),
  },
  {
    type: 'TypeError',
    motif: /unsupported operand type\(s\) for (.+?): '(\w+)' and '(\w+)'/,
    construire: (c) => ({
      titre: `Impossible de faire ${c[1]} entre ${c[2]} et ${c[3]}`,
      explication: `Ces deux valeurs ne sont pas du même type, Python ne sait pas les combiner.`,
      piste: `Regarde d'où vient chaque valeur. Une réponse de input() est toujours du texte, même si elle ressemble à un nombre.`,
    }),
  },
  {
    type: 'ValueError',
    motif: /invalid literal for int\(\) with base 10: '(.*)'/,
    construire: (c) => ({
      titre: `int() n'arrive pas à convertir « ${c[1]} »`,
      explication: `int() attend uniquement des chiffres, pas des lettres.`,
      piste: `Vérifie ce que tu donnes à int(). Si la valeur vient de input(), l'élève doit taper un nombre.`,
    }),
  },
  {
    type: 'SyntaxError',
    motif: /expected ':'/,
    construire: () => ({
      titre: 'Il manque un deux-points',
      explication: `En Python, if, elif, else, for et while finissent toujours par « : ».`,
      piste: `Ajoute « : » à la fin de la ligne signalée.`,
    }),
  },
  {
    type: 'SyntaxError',
    motif: /unterminated string literal|EOL while scanning string literal/,
    construire: () => ({
      titre: 'Un guillemet n\'est pas fermé',
      explication: `Un texte s'ouvre et se ferme avec le même guillemet.`,
      piste: `Compte les guillemets de la ligne signalée : il en faut un nombre pair.`,
    }),
  },
  {
    type: 'IndentationError',
    motif: /.*/,
    construire: () => ({
      titre: 'Cette ligne n\'est pas alignée avec les autres',
      explication: `Tout ce qui est à l'intérieur d'un if, d'un for ou d'un while doit être décalé de la même façon.`,
      piste: `Utilise toujours 4 espaces, et le même décalage pour toutes les lignes d'un même bloc.`,
    }),
  },
  {
    type: 'ZeroDivisionError',
    motif: /.*/,
    construire: () => ({
      titre: 'Division par zéro',
      explication: `Diviser par zéro n'a pas de résultat, Python s'arrête.`,
      piste: `Vérifie la valeur de ton diviseur juste avant la division.`,
    }),
  },
  {
    type: 'IndexError',
    motif: /.*/,
    construire: () => ({
      titre: 'Tu demandes une position qui n\'existe pas',
      explication: `Le premier caractère est à la position 0, pas 1. Le dernier est à la longueur moins 1.`,
      piste: `Affiche la longueur avec len() pour voir jusqu'où tu peux aller.`,
    }),
  },
  {
    type: 'AttributeError',
    motif: /'(\w+)' object has no attribute '(\w+)'/,
    construire: (c) => ({
      titre: `Un ${c[1]} ne sait pas faire ${c[2]}`,
      explication: `Cette opération n'existe pas pour ce type de valeur.`,
      piste: `Vérifie le type de ta variable : un nombre et un texte ne savent pas faire les mêmes choses.`,
    }),
  },
]

const GENERIQUE: MessageErreur = {
  titre: 'Ton programme s\'est arrêté sur une erreur',
  explication: `Python n'a pas réussi à exécuter ton code jusqu'au bout.`,
  piste: `Relis la ligne signalée. Si tu ne vois pas, demande un indice.`,
}

/** Le message obtenu par un élève doit toujours être en français, sans jargon. */
export function traduireErreur(erreur: ErreurPython): MessageErreur {
  if (erreur.type === 'TimeoutError') {
    return {
      titre: 'Ton programme tourne en rond',
      explication: `Il s'exécute depuis plus de 5 secondes sans s'arrêter.`,
      piste: `Vérifie que ta condition de while finit par devenir fausse, et que la variable testée change bien à chaque tour.`,
    }
  }
  for (const regle of REGLES) {
    if (regle.type !== erreur.type) continue
    const capture = erreur.message.match(regle.motif)
    if (capture) return regle.construire(capture)
  }
  return GENERIQUE
}
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run : `pnpm test`
Expected : PASS — 8 nouveaux tests

- [ ] **Step 6 : Commit**

```bash
git add plateforme/web/src plateforme/web/tests
git commit -m "feat: traduction des erreurs Python en francais"
```

---

## Tâche 4 : Évaluateur de tests et verdict global

**Files:**
- Create: `plateforme/web/src/validation/evaluer.ts`
- Test: `plateforme/web/tests/validation/evaluer.test.ts`

**Interfaces:**
- Consumes: `normaliser` (T1), `diffCaracteres` + `rendreVisible` + types (T2), `traduireErreur` + `ResultatExecution` (T3)
- Produces: `evaluer(params: { code: string; tests: Test[]; execution: ResultatExecution; reponseQcm?: number }): ResultatTest`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/web/tests/validation/evaluer.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { evaluer } from '../../src/validation/evaluer'
import type { ResultatExecution } from '../../src/execution/types'

const execution = (p: Partial<ResultatExecution> = {}): ResultatExecution => ({
  stdout: '',
  erreur: null,
  variables: {},
  dureeMs: 12,
  timeout: false,
  ...p,
})

describe('evaluer', () => {
  it('rend VERT quand la sortie est exacte', () => {
    const r = evaluer({
      code: 'print("Agent Corbeau")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Agent Corbeau' }],
      execution: execution({ stdout: 'Agent Corbeau\n' }),
    })
    expect(r.verdict).toBe('vert')
  })

  it('rend BLEU quand seul le format differe, et fournit un diff', () => {
    const r = evaluer({
      code: 'print("agent  corbeau")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Agent Corbeau' }],
      execution: execution({ stdout: 'agent  corbeau\n' }),
    })
    expect(r.verdict).toBe('bleu')
    expect(r.diff).toBeDefined()
    expect(r.titre).toMatch(/logique/i)
  })

  it('rend ROUGE quand la sortie est vraiment differente', () => {
    const r = evaluer({
      code: 'print("Bonjour")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Agent Corbeau' }],
      execution: execution({ stdout: 'Bonjour\n' }),
    })
    expect(r.verdict).toBe('rouge')
  })

  it('exige le VERT quand exigeExact est vrai', () => {
    const r = evaluer({
      code: 'print("agent corbeau")',
      tests: [{ type: 'sortie', entrees: [], attendu: 'Agent Corbeau', exigeExact: true }],
      execution: execution({ stdout: 'agent corbeau\n' }),
    })
    expect(r.verdict).toBe('rouge')
  })

  it('rend ROUGE et traduit l erreur quand le programme leve une exception', () => {
    const r = evaluer({
      code: 'print(nom)',
      tests: [{ type: 'sortie', entrees: [], attendu: 'x' }],
      execution: execution({
        erreur: { type: 'NameError', message: "name 'nom' is not defined", ligne: 1 },
      }),
    })
    expect(r.verdict).toBe('rouge')
    expect(r.titre).toContain('nom')
  })

  it('verifie le type d une variable', () => {
    const r = evaluer({
      code: 'age = 17',
      tests: [{ type: 'variable', nom: 'age', typeAttendu: 'int' }],
      execution: execution({ variables: { age: { valeur: '17', type: 'int' } } }),
    })
    expect(r.verdict).toBe('vert')
  })

  it('signale le piege du nombre ecrit entre guillemets', () => {
    const r = evaluer({
      code: 'age = "17"',
      tests: [{ type: 'variable', nom: 'age', typeAttendu: 'int' }],
      execution: execution({ variables: { age: { valeur: "'17'", type: 'str' } } }),
    })
    expect(r.verdict).toBe('rouge')
    expect(r.detail).toMatch(/guillemets/i)
  })

  it('rejette un motif interdit avant tout autre test', () => {
    const r = evaluer({
      code: 'print("Agent Corbeau")',
      tests: [
        { type: 'interdit', motif: 'print("Agent' },
        { type: 'sortie', entrees: [], attendu: 'Agent Corbeau' },
      ],
      execution: execution({ stdout: 'Agent Corbeau\n' }),
    })
    expect(r.verdict).toBe('rouge')
    expect(r.titre).toMatch(/en dur|directement/i)
  })

  it('exige un motif obligatoire', () => {
    const r = evaluer({
      code: 'print(1)\nprint(2)',
      tests: [{ type: 'contient', motif: 'for ' }],
      execution: execution({ stdout: '1\n2\n' }),
    })
    expect(r.verdict).toBe('rouge')
  })

  it('valide un qcm sur la bonne reponse', () => {
    const tests = [{ type: 'qcm' as const, options: ['a', 'b'], bonneReponse: 1 }]
    expect(evaluer({ code: '', tests, execution: execution(), reponseQcm: 1 }).verdict).toBe('vert')
    expect(evaluer({ code: '', tests, execution: execution(), reponseQcm: 0 }).verdict).toBe('rouge')
  })

  it('n affiche qu un seul echec a la fois', () => {
    const r = evaluer({
      code: 'x = 1',
      tests: [
        { type: 'variable', nom: 'a', typeAttendu: 'int' },
        { type: 'variable', nom: 'b', typeAttendu: 'int' },
      ],
      execution: execution({ variables: {} }),
    })
    expect(r.titre).toContain('a')
    expect(r.titre).not.toContain('b')
  })

  it('rend BLEU global si un test est bleu et les autres verts', () => {
    const r = evaluer({
      code: 'nom = "Corbeau"\nprint("agent corbeau")',
      tests: [
        { type: 'variable', nom: 'nom', typeAttendu: 'str' },
        { type: 'sortie', entrees: [], attendu: 'Agent Corbeau' },
      ],
      execution: execution({
        stdout: 'agent corbeau\n',
        variables: { nom: { valeur: "'Corbeau'", type: 'str' } },
      }),
    })
    expect(r.verdict).toBe('bleu')
  })
})
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run : `pnpm test`
Expected : FAIL — module `evaluer` introuvable

- [ ] **Step 3 : Écrire l'implémentation**

`plateforme/web/src/validation/evaluer.ts` :

```ts
import type { ResultatExecution } from '../execution/types'
import { diffCaracteres, rendreVisible } from './diff'
import { traduireErreur } from './erreurs'
import { normaliser } from './normaliser'
import type { ResultatTest, Test, Verdict } from './types'

const VERT: ResultatTest = { verdict: 'vert', titre: 'Mission accomplie.' }

export function evaluer(params: {
  code: string
  tests: Test[]
  execution: ResultatExecution
  reponseQcm?: number
}): ResultatTest {
  const { code, tests, execution, reponseQcm } = params

  // 1. Le programme s'est-il exécuté ?
  if (execution.timeout) {
    const m = traduireErreur({ type: 'TimeoutError', message: '', ligne: null })
    return { verdict: 'rouge', titre: m.titre, detail: `${m.explication} ${m.piste}` }
  }
  if (execution.erreur) {
    const m = traduireErreur(execution.erreur)
    return { verdict: 'rouge', titre: m.titre, detail: `${m.explication} ${m.piste}` }
  }

  // 2. Les contraintes de méthode passent avant tout : elles disqualifient la réponse.
  for (const test of tests) {
    if (test.type === 'interdit' && code.includes(test.motif)) {
      return {
        verdict: 'rouge',
        titre: 'La réponse ne doit pas être écrite en dur.',
        detail: `Ton programme doit calculer le résultat, pas l'afficher directement.`,
      }
    }
    if (test.type === 'contient' && !code.includes(test.motif)) {
      return {
        verdict: 'rouge',
        titre: `Cet exercice demande d'utiliser « ${test.motif.trim()} ».`,
        detail: `Ta solution fonctionne peut-être, mais elle n'emploie pas ce que l'exercice fait travailler.`,
      }
    }
  }

  // 3. Les tests de contenu. On s'arrête au premier échec.
  let verdictGlobal: Verdict = 'vert'
  for (const test of tests) {
    const resultat = evaluerUn(test, execution, reponseQcm)
    if (resultat.verdict === 'rouge') return resultat
    if (resultat.verdict === 'bleu') verdictGlobal = 'bleu'
  }

  if (verdictGlobal === 'bleu') {
    return {
      verdict: 'bleu',
      titre: 'Ta logique est correcte, le format est à ajuster.',
      detail: `L'exercice est validé et la suite est débloquée. Regarde quand même l'écart ci-dessous : au chapitre 2, le format comptera.`,
      diff: dernierDiff,
    }
  }
  return VERT
}

/** Diff du dernier test `sortie` évalué, réutilisé pour le message bleu global. */
let dernierDiff: ReturnType<typeof diffCaracteres> | undefined

function evaluerUn(
  test: Test,
  execution: ResultatExecution,
  reponseQcm: number | undefined,
): ResultatTest {
  switch (test.type) {
    case 'interdit':
    case 'contient':
      return VERT // déjà traités en amont

    case 'qcm':
      return reponseQcm === test.bonneReponse
        ? VERT
        : { verdict: 'rouge', titre: 'Ce n\'est pas la bonne réponse.', detail: 'Relis le code ligne par ligne, dans l\'ordre.' }

    case 'variable': {
      const lue = execution.variables[test.nom]
      if (!lue) {
        return {
          verdict: 'rouge',
          titre: `La variable ${test.nom} n'a pas été créée.`,
          detail: `Vérifie l'orthographe : Python distingue les majuscules des minuscules.`,
        }
      }
      if (test.typeAttendu && lue.type !== test.typeAttendu) {
        return {
          verdict: 'rouge',
          titre: `La variable ${test.nom} devrait contenir ${nommerType(test.typeAttendu)}, pas ${nommerType(lue.type)}.`,
          detail: detailType(test.typeAttendu, lue),
        }
      }
      if (test.valeurAttendue !== undefined && lue.valeur !== test.valeurAttendue) {
        return {
          verdict: 'rouge',
          titre: `La variable ${test.nom} ne contient pas la bonne valeur.`,
          detail: `Attendu : ${test.valeurAttendue} — obtenu : ${lue.valeur}`,
        }
      }
      return VERT
    }

    case 'sortie': {
      const obtenu = execution.stdout.replace(/\s+$/, '')
      const attendu = test.attendu.replace(/\s+$/, '')
      if (obtenu === attendu) {
        dernierDiff = undefined
        return VERT
      }
      const diff = diffCaracteres(rendreVisible(attendu), rendreVisible(obtenu))
      if (!test.exigeExact && normaliser(obtenu) === normaliser(attendu)) {
        dernierDiff = diff
        return { verdict: 'bleu', titre: 'Format à ajuster.', diff }
      }
      return {
        verdict: 'rouge',
        titre: 'Ton programme n\'affiche pas ce qui est attendu.',
        detail: `Compare les deux sorties caractère par caractère.`,
        diff,
      }
    }
  }
}

function nommerType(type: string): string {
  const noms: Record<string, string> = {
    int: 'un nombre entier',
    float: 'un nombre à virgule',
    str: 'du texte',
    bool: 'un booléen (True ou False)',
  }
  return noms[type] ?? `un ${type}`
}

function detailType(attendu: string, lue: { valeur: string; type: string }): string {
  if (attendu === 'int' && lue.type === 'str') {
    return `Tu as écrit ${lue.valeur} avec des guillemets — pour Python, c'est du texte. Enlève les guillemets, ou utilise int() si la valeur vient de input().`
  }
  if (attendu === 'str' && lue.type === 'int') {
    return `Un texte s'écrit entre guillemets : "..." .`
  }
  return `Vérifie comment tu as créé cette variable.`
}
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il passe**

Run : `pnpm test`
Expected : PASS — 12 nouveaux tests

- [ ] **Step 5 : Corriger l'effet de bord du diff partagé**

La variable `dernierDiff` au niveau module est un état partagé entre deux appels d'`evaluer` — dans une suite de tests parallèle, c'est une source de faux positifs. La remplacer par un passage explicite.

Dans `evaluer.ts`, supprimer la déclaration `let dernierDiff` et modifier la boucle :

```ts
  let verdictGlobal: Verdict = 'vert'
  let diffBleu: ResultatTest['diff']
  for (const test of tests) {
    const resultat = evaluerUn(test, execution, reponseQcm)
    if (resultat.verdict === 'rouge') return resultat
    if (resultat.verdict === 'bleu') {
      verdictGlobal = 'bleu'
      diffBleu = resultat.diff
    }
  }

  if (verdictGlobal === 'bleu') {
    return {
      verdict: 'bleu',
      titre: 'Ta logique est correcte, le format est à ajuster.',
      detail: `L'exercice est validé et la suite est débloquée. Regarde quand même l'écart ci-dessous : au chapitre 2, le format comptera.`,
      diff: diffBleu,
    }
  }
```

Et dans `evaluerUn`, supprimer les deux affectations `dernierDiff = ...`.

- [ ] **Step 6 : Relancer les tests**

Run : `pnpm test`
Expected : PASS — toujours 12 tests, sans état partagé

- [ ] **Step 7 : Commit**

```bash
git add plateforme/web/src/validation plateforme/web/tests/validation
git commit -m "feat: evaluateur de tests et verdict vert/bleu/rouge"
```

---

## Tâche 5 : Worker Pyodide et exécuteur

Le worker **exécute et rapporte**. Il ne juge rien. Le fil principal détient le minuteur : c'est ce qui permet de tuer une boucle infinie sans figer l'onglet.

**Files:**
- Create: `plateforme/web/src/execution/worker.ts`
- Create: `plateforme/web/src/execution/executeur.ts`
- Test: `plateforme/web/tests/execution/executeur.test.ts`
- Modify: `plateforme/web/package.json` (script de récupération de Pyodide)

**Interfaces:**
- Consumes: `ResultatExecution`, `VariableLue` (T3)
- Produces:
  - `type DemandeExecution = { code: string; entrees: string[]; nomsVariables: string[] }`
  - `class Executeur { constructor(fabrique: () => Worker, timeoutMs?: number); executer(d: DemandeExecution): Promise<ResultatExecution>; detruire(): void }`

- [ ] **Step 1 : Récupérer Pyodide en local**

Aucune ressource externe à l'exécution — contrainte globale.

```bash
cd plateforme/web
mkdir -p public/pyodide
curl -L https://github.com/pyodide/pyodide/releases/download/0.26.4/pyodide-0.26.4.tar.bz2 -o /tmp/pyodide.tar.bz2
tar -xjf /tmp/pyodide.tar.bz2 -C /tmp
cp /tmp/pyodide/pyodide.js /tmp/pyodide/pyodide.asm.js /tmp/pyodide/pyodide.asm.wasm \
   /tmp/pyodide/python_stdlib.zip /tmp/pyodide/pyodide-lock.json public/pyodide/
```

Vérifier : `ls -la public/pyodide` doit montrer `pyodide.asm.wasm` d'environ 9 Mo.

- [ ] **Step 2 : Écrire le worker**

`plateforme/web/src/execution/worker.ts` :

```ts
/// <reference lib="webworker" />
declare const loadPyodide: (o: { indexURL: string }) => Promise<PyodideLike>
type PyodideLike = { runPython(code: string): unknown; globals: { get(n: string): unknown } }

importScripts('/pyodide/pyodide.js')

/**
 * Harnais Python. Il capture stdout, simule input() à partir d'une liste fournie,
 * attrape SyntaxError séparément (elle n'a pas de traceback exploitable) et
 * sérialise les variables demandées. Il ne juge jamais la réponse.
 */
const HARNAIS = `
import sys, io, json

def _qg_executer(code, entrees, noms):
    sortie = io.StringIO()
    restantes = list(entrees)

    def _input(invite=""):
        sortie.write(str(invite))
        if not restantes:
            raise EOFError("Ton programme demande plus de reponses que prevu.")
        valeur = restantes.pop(0)
        sortie.write(valeur + "\\n")
        return valeur

    espace = {"__name__": "__main__", "input": _input}
    ancien, sys.stdout = sys.stdout, sortie
    erreur = None
    try:
        exec(compile(code, "<programme>", "exec"), espace)
    except SyntaxError as e:
        erreur = {"type": type(e).__name__, "message": str(e.msg), "ligne": e.lineno}
    except BaseException as e:
        tb, ligne = e.__traceback__, None
        while tb is not None:
            if tb.tb_frame.f_code.co_filename == "<programme>":
                ligne = tb.tb_lineno
            tb = tb.tb_next
        erreur = {"type": type(e).__name__, "message": str(e), "ligne": ligne}
    finally:
        sys.stdout = ancien

    variables = {}
    for nom in noms:
        if nom in espace:
            v = espace[nom]
            variables[nom] = {"valeur": repr(v), "type": type(v).__name__}

    return json.dumps({"stdout": sortie.getvalue(), "erreur": erreur, "variables": variables})
`

let pyodide: PyodideLike | null = null

async function demarrer(): Promise<PyodideLike> {
  if (!pyodide) {
    pyodide = await loadPyodide({ indexURL: '/pyodide/' })
    pyodide.runPython(HARNAIS)
  }
  return pyodide
}

self.onmessage = async (evenement: MessageEvent) => {
  const { id, code, entrees, nomsVariables } = evenement.data
  try {
    const py = await demarrer()
    const appel = py.runPython(
      `_qg_executer(${JSON.stringify(code)}, ${JSON.stringify(entrees)}, ${JSON.stringify(nomsVariables)})`,
    ) as string
    self.postMessage({ id, ok: true, charge: JSON.parse(appel) })
  } catch (e) {
    self.postMessage({ id, ok: false, message: String(e) })
  }
}

self.postMessage({ id: 'pret' })
```

- [ ] **Step 3 : Écrire le test de l'exécuteur**

L'exécuteur est testé avec un faux worker : c'est lui qui porte le minuteur et le redémarrage, la logique qui compte.

`plateforme/web/tests/execution/executeur.test.ts` :

```ts
import { describe, expect, it, vi } from 'vitest'
import { Executeur } from '../../src/execution/executeur'

/** Faux Worker : répond après `delaiMs`, ou jamais si `delaiMs` est null. */
class WorkerFactice {
  onmessage: ((e: { data: unknown }) => void) | null = null
  termine = false
  constructor(
    private charge: unknown,
    private delaiMs: number | null,
  ) {}
  postMessage(demande: { id: string }) {
    if (this.delaiMs === null) return
    setTimeout(() => this.onmessage?.({ data: { id: demande.id, ok: true, charge: this.charge } }), this.delaiMs)
  }
  terminate() {
    this.termine = true
  }
}

const CHARGE = { stdout: 'Bonjour\n', erreur: null, variables: {} }

describe('Executeur', () => {
  it('renvoie le resultat du worker', async () => {
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 1) as unknown as Worker)
    const r = await ex.executer({ code: 'print("Bonjour")', entrees: [], nomsVariables: [] })
    expect(r.stdout).toBe('Bonjour\n')
    expect(r.timeout).toBe(false)
    expect(r.dureeMs).toBeGreaterThanOrEqual(0)
  })

  it('mesure une duree', async () => {
    const ex = new Executeur(() => new WorkerFactice(CHARGE, 5) as unknown as Worker)
    const r = await ex.executer({ code: 'x = 1', entrees: [], nomsVariables: [] })
    expect(r.dureeMs).toBeGreaterThan(0)
  })

  it('rend timeout=true et tue le worker quand le delai est depasse', async () => {
    vi.useFakeTimers()
    let cree: WorkerFactice | null = null
    const ex = new Executeur(() => {
      cree = new WorkerFactice(CHARGE, null)
      return cree as unknown as Worker
    }, 5000)
    const promesse = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    const r = await promesse
    expect(r.timeout).toBe(true)
    expect(r.erreur?.type).toBe('TimeoutError')
    expect(cree!.termine).toBe(true)
    vi.useRealTimers()
  })

  it('recree un worker apres un timeout', async () => {
    vi.useFakeTimers()
    let nombreCreations = 0
    const ex = new Executeur(() => {
      nombreCreations++
      return new WorkerFactice(CHARGE, nombreCreations === 1 ? null : 1) as unknown as Worker
    }, 5000)
    const p1 = ex.executer({ code: 'while True: pass', entrees: [], nomsVariables: [] })
    await vi.advanceTimersByTimeAsync(5001)
    await p1
    vi.useRealTimers()
    const r2 = await ex.executer({ code: 'print("Bonjour")', entrees: [], nomsVariables: [] })
    expect(r2.timeout).toBe(false)
    expect(nombreCreations).toBe(2)
  })
})
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il échoue**

Run : `pnpm test`
Expected : FAIL — module `executeur` introuvable

- [ ] **Step 5 : Écrire l'exécuteur**

`plateforme/web/src/execution/executeur.ts` :

```ts
import type { ResultatExecution } from './types'

export type DemandeExecution = {
  code: string
  entrees: string[]
  /** Variables à relire dans l'espace de noms après exécution */
  nomsVariables: string[]
}

const TIMEOUT_PAR_DEFAUT = 5000

/**
 * Pilote le worker Pyodide depuis le fil principal.
 *
 * Le minuteur est ici et non dans le worker : un worker bloqué dans une boucle
 * infinie ne peut plus traiter aucun message, y compris un ordre d'arrêt.
 * Le seul recours est terminate() depuis l'extérieur.
 */
export class Executeur {
  private worker: Worker | null = null
  private compteur = 0

  constructor(
    private fabrique: () => Worker,
    private timeoutMs: number = TIMEOUT_PAR_DEFAUT,
  ) {}

  private obtenirWorker(): Worker {
    if (!this.worker) this.worker = this.fabrique()
    return this.worker
  }

  executer(demande: DemandeExecution): Promise<ResultatExecution> {
    const worker = this.obtenirWorker()
    const id = `e${++this.compteur}`
    const debut = Date.now()

    return new Promise<ResultatExecution>((resoudre) => {
      const minuteur = setTimeout(() => {
        worker.terminate()
        this.worker = null
        resoudre({
          stdout: '',
          erreur: { type: 'TimeoutError', message: '', ligne: null },
          variables: {},
          dureeMs: Date.now() - debut,
          timeout: true,
        })
      }, this.timeoutMs)

      worker.onmessage = (evenement: MessageEvent) => {
        const message = evenement.data
        if (!message || message.id !== id) return
        clearTimeout(minuteur)
        if (message.ok) {
          resoudre({ ...message.charge, dureeMs: Date.now() - debut, timeout: false })
        } else {
          resoudre({
            stdout: '',
            erreur: { type: 'ErreurInterne', message: String(message.message), ligne: null },
            variables: {},
            dureeMs: Date.now() - debut,
            timeout: false,
          })
        }
      }

      worker.postMessage({ id, ...demande })
    })
  }

  detruire(): void {
    this.worker?.terminate()
    this.worker = null
  }
}
```

- [ ] **Step 6 : Lancer les tests**

Run : `pnpm test`
Expected : PASS — 4 nouveaux tests

- [ ] **Step 7 : Vérification manuelle avec le vrai Pyodide**

Créer `plateforme/web/verif-pyodide.html` :

```html
<!doctype html>
<meta charset="utf-8" />
<title>Vérification Pyodide</title>
<pre id="sortie">chargement…</pre>
<script type="module">
  import { Executeur } from '/src/execution/executeur.ts'
  const ex = new Executeur(() => new Worker('/src/execution/worker.ts', { type: 'module' }))
  const r = await ex.executer({
    code: 'nom = input("Nom : ")\nage = int(input("Age : "))\nprint(f"Agent {nom}, {age} ans")',
    entrees: ['Corbeau', '17'],
    nomsVariables: ['nom', 'age'],
  })
  document.getElementById('sortie').textContent = JSON.stringify(r, null, 2)
</script>
```

Run : `pnpm dev` puis ouvrir `/verif-pyodide.html`
Expected : `stdout` contient `Agent Corbeau, 17 ans`, `variables.age.type` vaut `"int"`, `erreur` vaut `null`.

> [!warning] Si `age.type` vaut `"str"`
> Le harnais n'exécute pas `int()`. Vérifier que `exec` reçoit bien le code complet.

- [ ] **Step 8 : Commit**

```bash
git add plateforme/web/src/execution plateforme/web/tests/execution plateforme/web/public/pyodide plateforme/web/verif-pyodide.html
git commit -m "feat: worker Pyodide et executeur avec timeout"
```

---

## Tâche 6 : Schéma d'exercice et validateur de contenu

Un exercice invalide doit faire échouer la construction, jamais atteindre un élève. Le contrôle décisif : ==la solution de référence passe réellement ses propres tests==.

**Files:**
- Create: `plateforme/outils/requirements.txt`
- Create: `plateforme/outils/schema.py`
- Create: `plateforme/outils/valider_contenu.py`
- Test: `plateforme/outils/tests/test_schema.py`
- Test: `plateforme/outils/tests/test_valider_contenu.py`

**Interfaces:**
- Consumes: rien
- Produces:
  - `class Exercice(BaseModel)` avec les champs du modèle de contenu
  - `charger_exercice(chemin: Path) -> Exercice`
  - `charger_tous(racine: Path) -> list[Exercice]`
  - `verifier_coherence(ex: Exercice) -> list[str]` — liste des problèmes, vide si tout va bien

- [ ] **Step 1 : Préparer l'environnement Python**

```bash
mkdir -p plateforme/outils/tests
cd plateforme/outils
python -m venv .venv
.venv/Scripts/activate    # Windows ; sur Unix : source .venv/bin/activate
printf 'pydantic>=2.7\nPyYAML>=6.0\npytest>=8.0\n' > requirements.txt
pip install -r requirements.txt
```

- [ ] **Step 2 : Écrire le test du schéma**

`plateforme/outils/tests/test_schema.py` :

```python
import pytest
from pydantic import ValidationError

from schema import Exercice, TestSortie, TestVariable


def exercice_minimal(**remplacements):
    base = dict(
        id="s1-01",
        concept="print",
        seance=1,
        niveau="normal",
        type="ecrire",
        titre="Ton indicatif d'appel",
        obligatoire=True,
        enonce="Affiche ton nom de code.",
        depart="",
        indices=["Un texte s'ecrit entre guillemets."],
        tests=[{"type": "sortie", "entrees": [], "attendu": "Corbeau"}],
        solution='print("Corbeau")',
    )
    base.update(remplacements)
    return base


def test_exercice_valide_se_charge():
    ex = Exercice(**exercice_minimal())
    assert ex.id == "s1-01"
    assert isinstance(ex.tests[0], TestSortie)


def test_niveau_inconnu_rejete():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(niveau="intermediaire"))


def test_type_inconnu_rejete():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(type="qcm_libre"))


def test_seance_hors_bornes_rejetee():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(seance=4))


def test_identifiant_mal_forme_rejete():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(id="exercice 1"))


def test_getpass_interdit_partout():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(solution="import getpass\nprint(getpass.getpass())"))
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(enonce="Utilise getpass pour masquer la saisie."))


def test_emoji_interdit_dans_une_sortie_attendue():
    with pytest.raises(ValidationError):
        Exercice(**exercice_minimal(tests=[{"type": "sortie", "entrees": [], "attendu": "Acces ✅"}]))


def test_test_variable_se_charge():
    ex = Exercice(**exercice_minimal(tests=[{"type": "variable", "nom": "age", "type_attendu": "int"}]))
    assert isinstance(ex.tests[0], TestVariable)
    assert ex.tests[0].type_attendu == "int"
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run : `cd plateforme/outils && python -m pytest tests/test_schema.py -v`
Expected : FAIL — `ModuleNotFoundError: No module named 'schema'`

- [ ] **Step 4 : Écrire le schéma**

`plateforme/outils/schema.py` :

```python
"""Modele d'un exercice. Toute violation ici fait echouer la construction."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Annotated, Literal, Union

import yaml
from pydantic import BaseModel, Field, field_validator, model_validator

MOTIF_ID = re.compile(r"^s[123]-[0-9]{2}(-expert)?$")
MOTIF_EMOJI = re.compile(
    "[\U0001f300-\U0001faff☀-➿️⬀-⯿]", flags=re.UNICODE
)


class TestSortie(BaseModel):
    type: Literal["sortie"]
    entrees: list[str] = Field(default_factory=list)
    attendu: str
    exige_exact: bool = False

    @field_validator("attendu")
    @classmethod
    def sans_emoji(cls, v: str) -> str:
        if MOTIF_EMOJI.search(v):
            raise ValueError("aucun emoji dans une sortie comparee")
        return v


class TestVariable(BaseModel):
    type: Literal["variable"]
    nom: str
    valeur_attendue: str | None = None
    type_attendu: Literal["int", "float", "str", "bool"] | None = None


class TestQcm(BaseModel):
    type: Literal["qcm"]
    options: list[str] = Field(min_length=2)
    bonne_reponse: int

    @model_validator(mode="after")
    def indice_dans_les_bornes(self) -> "TestQcm":
        if not 0 <= self.bonne_reponse < len(self.options):
            raise ValueError("bonne_reponse hors des options")
        return self


class TestMotif(BaseModel):
    type: Literal["interdit", "contient"]
    motif: str


TestExercice = Annotated[
    Union[TestSortie, TestVariable, TestQcm, TestMotif], Field(discriminator="type")
]


class Exercice(BaseModel):
    id: str
    concept: str
    seance: int = Field(ge=1, le=3)
    niveau: Literal["normal", "expert"]
    type: Literal["predire", "debug", "completer", "ecrire"]
    titre: str
    obligatoire: bool
    enonce: str
    depart: str = ""
    indices: list[str] = Field(default_factory=list)
    tests: list[TestExercice] = Field(min_length=1)
    solution: str
    expert: str | None = None

    @field_validator("id")
    @classmethod
    def identifiant_bien_forme(cls, v: str) -> str:
        if not MOTIF_ID.match(v):
            raise ValueError(f"identifiant invalide : {v!r} (attendu s1-01 ou s1-01-expert)")
        return v

    @model_validator(mode="after")
    def sans_getpass(self) -> "Exercice":
        # getpass est impossible sous Pyodide et a coute deux rendus en 2025.
        for champ in (self.enonce, self.depart, self.solution):
            if "getpass" in champ:
                raise ValueError("getpass est impossible sous Pyodide, il est banni")
        return self

    @model_validator(mode="after")
    def tests_coherents_avec_le_type(self) -> "Exercice":
        types = {t.type for t in self.tests}
        if self.type == "predire" and "qcm" not in types:
            raise ValueError("un exercice 'predire' exige un test 'qcm'")
        if self.type == "ecrire" and "interdit" not in types:
            raise ValueError(
                "un exercice 'ecrire' exige un motif 'interdit', sinon la reponse peut etre ecrite en dur"
            )
        return self


def charger_exercice(chemin: Path) -> Exercice:
    donnees = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    return Exercice(**donnees)


def charger_tous(racine: Path) -> list[Exercice]:
    return [charger_exercice(p) for p in sorted(racine.rglob("*.yaml"))]
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run : `python -m pytest tests/test_schema.py -v`
Expected : PASS — 8 tests

- [ ] **Step 6 : Écrire le test du validateur de contenu**

`plateforme/outils/tests/test_valider_contenu.py` :

```python
from pathlib import Path

import yaml

from schema import Exercice
from valider_contenu import verifier_coherence


def ecrire(tmp_path: Path, donnees: dict) -> Exercice:
    chemin = tmp_path / f"{donnees['id']}.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")
    from schema import charger_exercice

    return charger_exercice(chemin)


BASE = dict(
    id="s1-02",
    concept="print",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Ton indicatif",
    obligatoire=True,
    enonce="Affiche Corbeau.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": [], "attendu": "Corbeau"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='print("Corbeau")',
)


def test_exercice_correct_ne_remonte_aucun_probleme(tmp_path):
    assert verifier_coherence(ecrire(tmp_path, dict(BASE))) == []


def test_solution_qui_echoue_ses_propres_tests_est_signalee(tmp_path):
    ex = ecrire(tmp_path, dict(BASE, solution='print("Faucon")'))
    problemes = verifier_coherence(ex)
    assert any("solution" in p for p in problemes)


def test_depart_qui_passe_deja_est_signale(tmp_path):
    ex = ecrire(tmp_path, dict(BASE, depart='print("Corbeau")'))
    problemes = verifier_coherence(ex)
    assert any("depart" in p for p in problemes)


def test_solution_violant_son_propre_motif_interdit_est_signalee(tmp_path):
    ex = ecrire(
        tmp_path,
        dict(
            BASE,
            solution='print("Corbeau")',
            tests=[
                {"type": "sortie", "entrees": [], "attendu": "Corbeau"},
                {"type": "interdit", "motif": 'print("Corbeau'},
            ],
        ),
    )
    assert any("interdit" in p for p in verifier_coherence(ex))
```

- [ ] **Step 7 : Lancer le test pour vérifier qu'il échoue**

Run : `python -m pytest tests/test_valider_contenu.py -v`
Expected : FAIL — `ModuleNotFoundError: No module named 'valider_contenu'`

- [ ] **Step 8 : Écrire le validateur**

`plateforme/outils/valider_contenu.py` :

```python
"""Valide tout le contenu. A lancer avant chaque cours et dans la construction.

Le controle qui sauve le plus de temps : executer la solution de reference contre
ses propres tests. Il empeche de publier un exercice impossible a valider, la
panne la plus couteuse en seance parce qu'elle envoie toute la classe lever la main.
"""

from __future__ import annotations

import argparse
import io
import sys
import unicodedata
from contextlib import redirect_stdout
from pathlib import Path

from schema import Exercice, TestMotif, TestSortie, TestVariable, charger_tous


def _executer(code: str, entrees: list[str]) -> tuple[str, dict, str | None]:
    """Exécute du code avec input() simulé. Miroir Python du harnais du worker."""
    restantes = list(entrees)
    sortie = io.StringIO()

    def _input(invite: str = "") -> str:
        sortie.write(str(invite))
        if not restantes:
            raise EOFError("plus d'entree disponible")
        valeur = restantes.pop(0)
        sortie.write(valeur + "\n")
        return valeur

    espace: dict = {"__name__": "__main__", "input": _input}
    try:
        with redirect_stdout(sortie):
            exec(compile(code, "<solution>", "exec"), espace)
    except BaseException as e:  # noqa: BLE001 — on rapporte, on ne relance pas
        return sortie.getvalue(), espace, f"{type(e).__name__}: {e}"
    return sortie.getvalue(), espace, None


def _normaliser(texte: str) -> str:
    """Miroir Python de web/src/validation/normaliser.ts, pour le verdict bleu."""
    t = texte.replace("\r\n", "\n")
    t = "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))
    t = t.replace("’", "'").replace("‘", "'")
    for fleche in ("→", "->", ":"):
        t = t.replace(fleche, ">")
    t = t.lower()
    lignes = [" ".join(ligne.split()) for ligne in t.split("\n")]
    return "\n".join(l for l in lignes if l != "").strip()


def _passe(ex: Exercice, code: str) -> bool:
    """Le code satisfait-il tous les tests de l'exercice ?"""
    for test in ex.tests:
        if isinstance(test, TestMotif):
            if test.type == "interdit" and test.motif in code:
                return False
            if test.type == "contient" and test.motif not in code:
                return False
            continue
        if isinstance(test, TestSortie):
            stdout, _, erreur = _executer(code, test.entrees)
            if erreur:
                return False
            if test.exige_exact:
                if stdout.rstrip() != test.attendu.rstrip():
                    return False
            elif _normaliser(stdout) != _normaliser(test.attendu):
                return False
            continue
        if isinstance(test, TestVariable):
            _, espace, erreur = _executer(code, [])
            if erreur or test.nom not in espace:
                return False
            valeur = espace[test.nom]
            if test.type_attendu and type(valeur).__name__ != test.type_attendu:
                return False
            if test.valeur_attendue is not None and repr(valeur) != test.valeur_attendue:
                return False
    return True


def verifier_coherence(ex: Exercice) -> list[str]:
    problemes: list[str] = []

    for test in ex.tests:
        if isinstance(test, TestMotif) and test.type == "interdit" and test.motif in ex.solution:
            problemes.append(
                f"{ex.id} : la solution contient son propre motif interdit {test.motif!r}"
            )

    if ex.type != "predire" and not _passe(ex, ex.solution):
        problemes.append(f"{ex.id} : la solution de reference ne passe pas ses propres tests")

    if ex.type in ("ecrire", "completer", "debug") and ex.depart and _passe(ex, ex.depart):
        problemes.append(f"{ex.id} : le code de depart passe deja les tests, l'exercice est resolu")

    return problemes


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Valide tout le contenu du dojo.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../../contenu"))
    arguments = parseur.parse_args()

    exercices = charger_tous(arguments.racine)
    identifiants = {ex.id for ex in exercices}
    problemes: list[str] = []

    for ex in exercices:
        problemes += verifier_coherence(ex)
        if ex.expert and ex.expert not in identifiants:
            problemes.append(f"{ex.id} : renvoie vers un expert inexistant {ex.expert!r}")

    print(f"{len(exercices)} exercices charges.")
    for p in problemes:
        print(f"  PROBLEME  {p}")
    print("Contenu valide." if not problemes else f"{len(problemes)} probleme(s).")
    return 1 if problemes else 0


if __name__ == "__main__":
    sys.exit(principal())
```

- [ ] **Step 9 : Lancer tous les tests Python**

Run : `python -m pytest tests/ -v`
Expected : PASS — 12 tests

- [ ] **Step 10 : Commit**

```bash
git add plateforme/outils
git commit -m "feat: schema d'exercice et validateur de contenu"
```

---

## Tâche 7 : Générateur du champ attendu

Deux heures d'outillage qui suppriment la classe d'erreur la plus probable : ==l'`attendu` faux tapé à la main==. Le professeur écrit la solution, l'outil écrit la sortie.

**Files:**
- Create: `plateforme/outils/generer_attendu.py`
- Test: `plateforme/outils/tests/test_generer_attendu.py`

**Interfaces:**
- Consumes: `_executer` de `valider_contenu` (T6), `charger_exercice` (T6)
- Produces: `remplir_attendus(chemin: Path, ecrire_fichier: bool = True) -> list[str]` — renvoie les identifiants des tests modifiés

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/outils/tests/test_generer_attendu.py` :

```python
from pathlib import Path

import yaml

from generer_attendu import remplir_attendus

BASE = dict(
    id="s1-03",
    concept="input",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Interrogatoire",
    obligatoire=True,
    enonce="Demande le nom puis affiche-le.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": ["Corbeau"], "attendu": "A REMPLIR"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='nom = input("Nom : ")\nprint(f"Agent {nom}")',
)


def test_remplit_l_attendu_depuis_la_solution(tmp_path):
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(BASE, allow_unicode=True), encoding="utf-8")

    modifies = remplir_attendus(chemin)

    assert modifies == ["s1-03#0"]
    relu = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    assert relu["tests"][0]["attendu"] == "Nom : Corbeau\nAgent Corbeau"


def test_ne_touche_pas_un_attendu_deja_correct(tmp_path):
    donnees = dict(BASE)
    donnees["tests"] = [
        {"type": "sortie", "entrees": ["Corbeau"], "attendu": "Nom : Corbeau\nAgent Corbeau"},
        {"type": "interdit", "motif": "xyzzy"},
    ]
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")

    assert remplir_attendus(chemin) == []


def test_signale_une_solution_qui_plante(tmp_path):
    donnees = dict(BASE, solution="print(inexistant)")
    chemin = tmp_path / "s1-03.yaml"
    chemin.write_text(yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8")

    modifies = remplir_attendus(chemin)

    assert modifies == []
    relu = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    assert relu["tests"][0]["attendu"] == "A REMPLIR"
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run : `python -m pytest tests/test_generer_attendu.py -v`
Expected : FAIL — `ModuleNotFoundError: No module named 'generer_attendu'`

- [ ] **Step 3 : Écrire le générateur**

`plateforme/outils/generer_attendu.py` :

```python
"""Execute la solution de reference et ecrit lui-meme la sortie dans le YAML.

Le professeur ecrit la solution, jamais l'attendu. C'est le levier de production
numero un : il supprime l'erreur la plus probable, l'attendu tape a la main.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from valider_contenu import _executer


def remplir_attendus(chemin: Path, ecrire_fichier: bool = True) -> list[str]:
    donnees = yaml.safe_load(chemin.read_text(encoding="utf-8"))
    solution = donnees.get("solution", "")
    modifies: list[str] = []

    for index, test in enumerate(donnees.get("tests", [])):
        if test.get("type") != "sortie":
            continue
        stdout, _, erreur = _executer(solution, test.get("entrees", []))
        if erreur:
            print(f"  {donnees['id']}#{index} : la solution plante ({erreur}), attendu inchange")
            continue
        nouveau = stdout.rstrip("\n")
        if test.get("attendu") != nouveau:
            test["attendu"] = nouveau
            modifies.append(f"{donnees['id']}#{index}")

    if modifies and ecrire_fichier:
        chemin.write_text(
            yaml.safe_dump(donnees, allow_unicode=True, sort_keys=False, width=1000),
            encoding="utf-8",
        )
    return modifies


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Remplit le champ attendu depuis la solution.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../../contenu"))
    arguments = parseur.parse_args()

    cibles = [arguments.racine] if arguments.racine.is_file() else sorted(arguments.racine.rglob("*.yaml"))
    total: list[str] = []
    for chemin in cibles:
        total += remplir_attendus(chemin)

    print(f"{len(total)} attendu(s) mis a jour." if total else "Rien a mettre a jour.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
```

- [ ] **Step 4 : Lancer les tests**

Run : `python -m pytest tests/ -v`
Expected : PASS — 15 tests

- [ ] **Step 5 : Commit**

```bash
git add plateforme/outils
git commit -m "feat: generateur du champ attendu depuis la solution"
```

---

## Tâche 8 : API de progression

Mince par conception. ==Aucune route n'accepte de code source== : violer ce point invalide le dossier de sécurité UNIGE.

**Files:**
- Create: `plateforme/api/requirements.txt`
- Create: `plateforme/api/app/modeles.py`
- Create: `plateforme/api/app/bdd.py`
- Create: `plateforme/api/app/securite.py`
- Create: `plateforme/api/app/routes_eleve.py`
- Create: `plateforme/api/app/main.py`
- Test: `plateforme/api/tests/conftest.py`
- Test: `plateforme/api/tests/test_routes_eleve.py`

**Interfaces:**
- Consumes: rien
- Produces (consommées par `web/src/api/client.ts` en T11 et les routes prof en T12) :
  - `POST /session` `{code_agent}` → `{jeton, code_agent}`
  - `GET /parcours` (en-tête `Authorization: Bearer <jeton>`) → `{reussis: [id]}`
  - `POST /tentative` `{exercice_id, verdict, type_erreur|null, duree_ms}` → `{expert_debloque: str|null}`
  - `class Agent`, `class Tentative`, `class Verrou` (SQLModel)

- [ ] **Step 1 : Préparer l'environnement**

```bash
mkdir -p plateforme/api/app plateforme/api/tests
cd plateforme/api
python -m venv .venv
.venv/Scripts/activate
printf 'fastapi>=0.115\nuvicorn[standard]>=0.30\nsqlmodel>=0.0.22\npytest>=8.0\nhttpx>=0.27\n' > requirements.txt
pip install -r requirements.txt
```

- [ ] **Step 2 : Écrire les modèles et la base**

`plateforme/api/app/modeles.py` :

```python
"""Tables. Aucune donnee personnelle : ni nom, ni prenom, ni adresse."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _maintenant() -> datetime:
    return datetime.now(timezone.utc)


class Agent(SQLModel, table=True):
    """Un eleve, connu uniquement par son code pseudonyme."""

    code_agent: str = Field(primary_key=True)
    cree_le: datetime = Field(default_factory=_maintenant)
    vu_le: datetime = Field(default_factory=_maintenant)


class Tentative(SQLModel, table=True):
    """Une soumission. Ne contient jamais le code ecrit par l'eleve."""

    id: int | None = Field(default=None, primary_key=True)
    code_agent: str = Field(foreign_key="agent.code_agent", index=True)
    exercice_id: str = Field(index=True)
    verdict: str  # vert | bleu | rouge
    type_erreur: str | None = None  # "TypeError", "NameError", ...
    duree_ms: int = 0
    horodatage: datetime = Field(default_factory=_maintenant, index=True)


class Verrou(SQLModel, table=True):
    """Un concept ouvert ou ferme pour toute la classe."""

    concept: str = Field(primary_key=True)
    ouvert: bool = True
```

`plateforme/api/app/bdd.py` :

```python
from __future__ import annotations

import os
from collections.abc import Iterator

from sqlmodel import Session, SQLModel, create_engine

URL = os.environ.get("QG_BDD", "sqlite:///./donnees/qg.db")
moteur = create_engine(URL, connect_args={"check_same_thread": False})


def creer_schema() -> None:
    SQLModel.metadata.create_all(moteur)


def obtenir_session() -> Iterator[Session]:
    with Session(moteur) as session:
        yield session
```

`plateforme/api/app/securite.py` :

```python
"""Jetons de session. Pas de mot de passe : le code d'agent EST le secret."""

from __future__ import annotations

import hashlib
import hmac
import os

SECRET = os.environ.get("QG_SECRET", "dev-uniquement-a-remplacer-en-production").encode()


def creer_jeton(code_agent: str) -> str:
    signature = hmac.new(SECRET, code_agent.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{code_agent}.{signature}"


def lire_jeton(jeton: str) -> str | None:
    """Renvoie le code d'agent si la signature est valide, sinon None."""
    code, _, signature = jeton.partition(".")
    if not code or not signature:
        return None
    attendue = hmac.new(SECRET, code.encode(), hashlib.sha256).hexdigest()[:32]
    return code if hmac.compare_digest(signature, attendue) else None
```

- [ ] **Step 3 : Écrire le test qui échoue**

`plateforme/api/tests/conftest.py` :

```python
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app import bdd
from app.main import application


@pytest.fixture(name="client")
def fixture_client():
    moteur = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(moteur)

    def session_de_test():
        with Session(moteur) as session:
            yield session

    application.dependency_overrides[bdd.obtenir_session] = session_de_test
    yield TestClient(application)
    application.dependency_overrides.clear()


@pytest.fixture(name="jeton")
def fixture_jeton(client):
    reponse = client.post("/session", json={"code_agent": "AGENT-K7M2"})
    return reponse.json()["jeton"]
```

`plateforme/api/tests/test_routes_eleve.py` :

```python
def entetes(jeton: str) -> dict:
    return {"Authorization": f"Bearer {jeton}"}


def test_session_cree_l_agent_et_rend_un_jeton(client):
    reponse = client.post("/session", json={"code_agent": "AGENT-K7M2"})
    assert reponse.status_code == 200
    assert reponse.json()["code_agent"] == "AGENT-K7M2"
    assert reponse.json()["jeton"].startswith("AGENT-K7M2.")


def test_session_est_idempotente(client):
    client.post("/session", json={"code_agent": "AGENT-K7M2"})
    reponse = client.post("/session", json={"code_agent": "AGENT-K7M2"})
    assert reponse.status_code == 200


def test_code_agent_mal_forme_refuse(client):
    assert client.post("/session", json={"code_agent": "toto"}).status_code == 422


def test_parcours_sans_jeton_refuse(client):
    assert client.get("/parcours").status_code == 401


def test_jeton_falsifie_refuse(client):
    assert client.get("/parcours", headers=entetes("AGENT-XXXX.faux")).status_code == 401


def test_parcours_vide_au_depart(client, jeton):
    donnees = client.get("/parcours", headers=entetes(jeton)).json()
    assert donnees["reussis"] == []


def test_tentative_verte_marque_l_exercice_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "vert", "type_erreur": None, "duree_ms": 42},
    )
    assert client.get("/parcours", headers=entetes(jeton)).json()["reussis"] == ["s1-01"]


def test_tentative_bleue_marque_aussi_l_exercice_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "bleu", "type_erreur": None, "duree_ms": 50},
    )
    assert client.get("/parcours", headers=entetes(jeton)).json()["reussis"] == ["s1-01"]


def test_tentative_rouge_ne_marque_pas_reussi(client, jeton):
    client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "rouge", "type_erreur": "NameError", "duree_ms": 30},
    )
    assert client.get("/parcours", headers=entetes(jeton)).json()["reussis"] == []


def test_verdict_inconnu_refuse(client, jeton):
    reponse = client.post(
        "/tentative",
        headers=entetes(jeton),
        json={"exercice_id": "s1-01", "verdict": "orange", "type_erreur": None, "duree_ms": 1},
    )
    assert reponse.status_code == 422


def test_la_route_tentative_refuse_tout_champ_de_code(client, jeton):
    """Le code de l'eleve ne doit jamais atteindre le serveur."""
    reponse = client.post(
        "/tentative",
        headers=entetes(jeton),
        json={
            "exercice_id": "s1-01",
            "verdict": "vert",
            "type_erreur": None,
            "duree_ms": 1,
            "code": "print('secret')",
        },
    )
    assert reponse.status_code == 422
```

- [ ] **Step 4 : Lancer le test pour vérifier qu'il échoue**

Run : `cd plateforme/api && python -m pytest tests/ -v`
Expected : FAIL — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 5 : Écrire les routes**

`plateforme/api/app/routes_eleve.py` :

```python
from __future__ import annotations

import re
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, select

from .bdd import obtenir_session
from .modeles import Agent, Tentative
from .securite import creer_jeton, lire_jeton

routeur = APIRouter()
MOTIF_CODE = re.compile(r"^AGENT-[A-Z0-9]{4}$")


class DemandeSession(BaseModel):
    code_agent: str = Field(pattern=MOTIF_CODE.pattern)


class ReponseSession(BaseModel):
    jeton: str
    code_agent: str


class DemandeTentative(BaseModel):
    # extra="forbid" refuse tout champ non declare, en particulier du code source.
    model_config = ConfigDict(extra="forbid")

    exercice_id: str = Field(max_length=32)
    verdict: Literal["vert", "bleu", "rouge"]
    type_erreur: str | None = Field(default=None, max_length=64)
    duree_ms: int = Field(ge=0, le=600_000)


def agent_courant(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Jeton absent")
    code = lire_jeton(authorization.removeprefix("Bearer "))
    if not code:
        raise HTTPException(401, "Jeton invalide")
    return code


@routeur.post("/session", response_model=ReponseSession)
def ouvrir_session(
    demande: DemandeSession, session: Annotated[Session, Depends(obtenir_session)]
) -> ReponseSession:
    agent = session.get(Agent, demande.code_agent)
    if agent is None:
        session.add(Agent(code_agent=demande.code_agent))
        session.commit()
    return ReponseSession(jeton=creer_jeton(demande.code_agent), code_agent=demande.code_agent)


@routeur.get("/parcours")
def lire_parcours(
    code_agent: Annotated[str, Depends(agent_courant)],
    session: Annotated[Session, Depends(obtenir_session)],
) -> dict:
    lignes = session.exec(
        select(Tentative.exercice_id)
        .where(Tentative.code_agent == code_agent)
        .where(Tentative.verdict.in_(("vert", "bleu")))  # type: ignore[attr-defined]
    ).all()
    return {"reussis": sorted(set(lignes))}


@routeur.post("/tentative")
def enregistrer_tentative(
    demande: DemandeTentative,
    code_agent: Annotated[str, Depends(agent_courant)],
    session: Annotated[Session, Depends(obtenir_session)],
) -> dict:
    session.add(Tentative(code_agent=code_agent, **demande.model_dump()))
    session.commit()
    return {"expert_debloque": f"{demande.exercice_id}-expert" if demande.verdict in ("vert", "bleu") else None}
```

`plateforme/api/app/main.py` :

```python
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from .bdd import creer_schema
from .routes_eleve import routeur as routeur_eleve


@asynccontextmanager
async def cycle_de_vie(app: FastAPI):
    creer_schema()
    yield


application = FastAPI(title="Quartier General", lifespan=cycle_de_vie)
application.include_router(routeur_eleve)


@application.get("/sante")
def sante() -> dict:
    return {"etat": "ok"}
```

- [ ] **Step 6 : Lancer les tests**

Run : `python -m pytest tests/ -v`
Expected : PASS — 11 tests

- [ ] **Step 7 : Commit**

```bash
git add plateforme/api
git commit -m "feat: API de progression, sans code source ni donnee personnelle"
```

---

## Tâche 9 : Charte visuelle en CSS et carte de code

**Files:**
- Create: `plateforme/web/public/polices/` (WOFF2 auto-hébergés)
- Create: `plateforme/web/src/ui/tokens.css`
- Create: `plateforme/web/src/ui/base.css`
- Create: `plateforme/web/src/ui/CarteCode.tsx`
- Test: `plateforme/web/tests/ui/tokens.test.ts`

**Interfaces:**
- Consumes: rien
- Produces: variables CSS `--var-tint`/`--var-ink`/`--var-deep` (et les 4 autres familles), `--d-*` Dracula ; composant `<CarteCode legende?, children />`

- [ ] **Step 1 : Récupérer les polices en local**

```bash
cd plateforme/web/public/polices
curl -sL "https://api.fontshare.com/v2/css?f[]=general-sans@400,500,700" -o gs.css
grep -o 'https://cdn.fontshare.com[^)]*\.woff2' gs.css | while read u; do curl -sLO "$u"; done
```

Récupérer aussi JetBrains Mono 400 et 500 en WOFF2 depuis Google Fonts, et les déposer ici.
Vérifier : `ls *.woff2` doit lister 5 fichiers.

> [!warning] Contrainte globale
> Aucun `<link>` vers `fonts.googleapis.com` ni `api.fontshare.com` dans le HTML livré.

- [ ] **Step 2 : Écrire les tokens**

`plateforme/web/src/ui/tokens.css` — valeurs issues de [[Palette]] :

```css
:root {
  --ground: #FBF8F3;
  --ground-2: #F3EEE5;
  --ink: #1E1B16;
  --ink-soft: #6B6459;
  --rule: #E2DACC;

  --var-tint: #C2CCFF; --var-ink: #2C0A71; --var-deep: #1A0640;
  --typ-tint: #D9F4CC; --typ-ink: #053827; --typ-deep: #022016;
  --ope-tint: #C2E8FF; --ope-ink: #004E7A; --ope-deep: #002B43;
  --con-tint: #FFE7C2; --con-ink: #7A4900; --con-deep: #3C2500;
  --bou-tint: #FFD9C2; --bou-ink: #7A2800; --bou-deep: #3C1400;

  --d-bg: #282A36; --d-fg: #F8F8F2; --d-pink: #FF79C6; --d-purple: #BD93F9;
  --d-cyan: #8BE9FD; --d-yellow: #F1FA8C; --d-green: #50FA7B;
  --d-comment: #6272A4; --d-red: #FF5555; --d-line: #44475A;
  --d-label: #B4ADD0; /* 6.67 sur #282A36 — le commentaire Dracula est a 3.03, insuffisant */

  --tl-red: #FF5F56; --tl-yel: #FFBD2E; --tl-grn: #27C93F;
  --py-blue: #4B8BBE; --py-yellow: #FFC331;

  /* Variantes assombries : les pastilles macOS sont illisibles en texte sur clair */
  --ok: #0F5C23;
  --ko: #9C1B15;

  --police-texte: "General Sans", system-ui, sans-serif;
  --police-code: "JetBrains Mono", ui-monospace, Consolas, monospace;
}

/* Famille active, posee par l'ecran selon le concept courant */
[data-famille="variables"] { --tint: var(--var-tint); --encre: var(--var-ink); --profond: var(--var-deep); }
[data-famille="types"]     { --tint: var(--typ-tint); --encre: var(--typ-ink); --profond: var(--typ-deep); }
[data-famille="operateurs"]{ --tint: var(--ope-tint); --encre: var(--ope-ink); --profond: var(--ope-deep); }
[data-famille="conditions"]{ --tint: var(--con-tint); --encre: var(--con-ink); --profond: var(--con-deep); }
[data-famille="boucles"]   { --tint: var(--bou-tint); --encre: var(--bou-ink); --profond: var(--bou-deep); }
```

`plateforme/web/src/ui/base.css` :

```css
@font-face { font-family: "General Sans"; font-weight: 400; font-display: swap; src: url("/polices/general-sans-400.woff2") format("woff2"); }
@font-face { font-family: "General Sans"; font-weight: 500; font-display: swap; src: url("/polices/general-sans-500.woff2") format("woff2"); }
@font-face { font-family: "General Sans"; font-weight: 700; font-display: swap; src: url("/polices/general-sans-700.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 400; font-display: swap; src: url("/polices/jetbrains-mono-400.woff2") format("woff2"); }
@font-face { font-family: "JetBrains Mono"; font-weight: 500; font-display: swap; src: url("/polices/jetbrains-mono-500.woff2") format("woff2"); }

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--ground);
  color: var(--ink);
  font-family: var(--police-texte);
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { font-weight: 700; line-height: 1.05; letter-spacing: -0.025em; text-wrap: balance; margin: 0; }

/*
 * La chasse fixe est reservee au code, aux valeurs hexadecimales et aux
 * identifiants d'agent. Jamais de libelle d'interface en monospace,
 * jamais de capitales interlettrees : voir ADR-005.
 */
.mono { font-family: var(--police-code); }

:where(button, a, [tabindex]):focus-visible { outline: 3px solid var(--py-yellow); outline-offset: 2px; }

@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
```

- [ ] **Step 3 : Écrire le test des tokens**

Un test de non-régression sur les invariants de la charte — ce sont les erreurs qu'on ne voit pas à l'œil.

`plateforme/web/tests/ui/tokens.test.ts` :

```ts
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const tokens = readFileSync('src/ui/tokens.css', 'utf-8')
const base = readFileSync('src/ui/base.css', 'utf-8')

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!)
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x! + 0.05) / (y! + 0.05)
}
const lire = (nom: string) => tokens.match(new RegExp(`${nom}:\\s*(#[0-9A-Fa-f]{6})`))![1]!

describe('charte visuelle', () => {
  const familles = [
    ['--var-tint', '--var-ink'],
    ['--typ-tint', '--typ-ink'],
    ['--ope-tint', '--ope-ink'],
    ['--con-tint', '--con-ink'],
    ['--bou-tint', '--bou-ink'],
  ] as const

  it.each(familles)('%s / %s atteint AA', (tint, ink) => {
    expect(contraste(lire(tint), lire(ink))).toBeGreaterThanOrEqual(4.5)
  })

  it('les libelles sur Dracula atteignent AA', () => {
    expect(contraste(lire('--d-label'), lire('--d-bg'))).toBeGreaterThanOrEqual(4.5)
  })

  it('les couleurs semantiques claires tiennent sur les cinq tints', () => {
    for (const [tint] of familles) {
      expect(contraste(lire('--ok'), lire(tint))).toBeGreaterThanOrEqual(4.5)
      expect(contraste(lire('--ko'), lire(tint))).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('aucune police externe n est chargee', () => {
    expect(base).not.toMatch(/fonts\.googleapis|fontshare|cdn\./)
  })

  it('aucune capitale interlettree dans la feuille de base', () => {
    expect(base).not.toMatch(/text-transform:\s*uppercase/)
  })
})
```

- [ ] **Step 4 : Lancer le test**

Run : `pnpm test`
Expected : PASS — 9 nouveaux tests. Si un contraste échoue, la valeur du token est fausse : la corriger d'après [[Palette]], pas le seuil.

- [ ] **Step 5 : Écrire la carte de code**

`plateforme/web/src/ui/CarteCode.tsx` :

```tsx
import type { ReactNode } from 'react'
import './CarteCode.css'

/** Le composant le plus reconnaissable des slides : carte sombre + pastilles macOS. */
export function CarteCode({ legende, children }: { legende?: ReactNode; children: ReactNode }) {
  return (
    <div className="carte-code">
      <div className="carte-code__barre">
        <span className="carte-code__pastille carte-code__pastille--rouge" />
        <span className="carte-code__pastille carte-code__pastille--jaune" />
        <span className="carte-code__pastille carte-code__pastille--verte" />
        {legende && <span className="carte-code__legende">{legende}</span>}
      </div>
      <div className="carte-code__corps">{children}</div>
    </div>
  )
}
```

`plateforme/web/src/ui/CarteCode.css` :

```css
.carte-code {
  background: var(--d-bg);
  border-radius: 14px;
  overflow: hidden;
  font-family: var(--police-code);
  font-size: 0.86rem;
  line-height: 1.75;
}
.carte-code__barre {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 0.95rem;
  border-bottom: 1px solid rgb(255 255 255 / 6%);
}
.carte-code__pastille { width: 11px; height: 11px; border-radius: 50%; flex: none; }
.carte-code__pastille--rouge { background: var(--tl-red); }
.carte-code__pastille--jaune { background: var(--tl-yel); }
.carte-code__pastille--verte { background: var(--tl-grn); }
/* La legende est en police de texte, comme dans les decks. */
.carte-code__legende {
  margin-left: 0.5rem;
  font-family: var(--police-texte);
  font-size: 0.86rem;
  color: var(--d-label);
}
.carte-code__corps { padding: 1.05rem 1.15rem; overflow-x: auto; color: var(--d-fg); }
.carte-code__corps pre { margin: 0; font: inherit; }
```

- [ ] **Step 6 : Commit**

```bash
git add plateforme/web/src/ui plateforme/web/tests/ui plateforme/web/public/polices
git commit -m "feat: tokens de la charte, polices auto-hebergees et carte de code"
```

---

## Tâche 10 : Éditeur et panneau de verdict

**Files:**
- Create: `plateforme/web/src/ui/Editeur.tsx`
- Create: `plateforme/web/src/ui/PanneauVerdict.tsx`
- Create: `plateforme/web/src/ui/PanneauVerdict.css`
- Test: `plateforme/web/tests/ui/PanneauVerdict.test.tsx`
- Modify: `plateforme/web/vitest.config.ts` (environnement jsdom pour les tests de composants)

**Interfaces:**
- Consumes: `ResultatTest`, `SegmentDiff` (T2)
- Produces:
  - `<Editeur valeur={string} onChange={(v: string) => void} lectureSeule?={boolean} />`
  - `<PanneauVerdict resultat={ResultatTest | null} />`

- [ ] **Step 1 : Installer CodeMirror et l'environnement de test DOM**

```bash
cd plateforme/web
pnpm add @codemirror/lang-python @codemirror/state @codemirror/view @codemirror/commands @codemirror/theme-one-dark
pnpm add -D jsdom @testing-library/react @testing-library/jest-dom
```

Modifier `vitest.config.ts` :

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/preparation.ts'],
  },
})
```

`plateforme/web/tests/preparation.ts` :

```ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 2 : Écrire le test du panneau de verdict**

`plateforme/web/tests/ui/PanneauVerdict.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PanneauVerdict } from '../../src/ui/PanneauVerdict'

describe('PanneauVerdict', () => {
  it('n affiche rien tant qu il n y a pas de resultat', () => {
    const { container } = render(<PanneauVerdict resultat={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('affiche le succes en vert', () => {
    render(<PanneauVerdict resultat={{ verdict: 'vert', titre: 'Mission accomplie.' }} />)
    expect(screen.getByRole('status')).toHaveClass('verdict--vert')
    expect(screen.getByText('Mission accomplie.')).toBeInTheDocument()
  })

  it('affiche le bleu et son diff', () => {
    render(
      <PanneauVerdict
        resultat={{
          verdict: 'bleu',
          titre: 'Ta logique est correcte, le format est à ajuster.',
          diff: [
            { type: 'egal', texte: 'Agent·' },
            { type: 'ajout', texte: '·' },
            { type: 'egal', texte: 'Corbeau' },
          ],
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveClass('verdict--bleu')
    expect(screen.getByTestId('diff')).toBeInTheDocument()
    expect(screen.getAllByTestId('diff-ajout')).toHaveLength(1)
  })

  it('affiche l echec et son detail', () => {
    render(
      <PanneauVerdict
        resultat={{
          verdict: 'rouge',
          titre: "La variable age devrait contenir un nombre entier, pas du texte.",
          detail: 'Tu as écrit \'17\' avec des guillemets.',
        }}
      />,
    )
    expect(screen.getByRole('status')).toHaveClass('verdict--rouge')
    expect(screen.getByText(/guillemets/)).toBeInTheDocument()
  })

  it('annonce le resultat aux lecteurs d ecran', () => {
    render(<PanneauVerdict resultat={{ verdict: 'vert', titre: 'Mission accomplie.' }} />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })
})
```

- [ ] **Step 3 : Lancer le test pour vérifier qu'il échoue**

Run : `pnpm test`
Expected : FAIL — module `PanneauVerdict` introuvable

- [ ] **Step 4 : Écrire les composants**

`plateforme/web/src/ui/PanneauVerdict.tsx` :

```tsx
import type { ResultatTest } from '../validation/types'
import './PanneauVerdict.css'

const CLASSES: Record<ResultatTest['verdict'], string> = {
  vert: 'verdict--vert',
  bleu: 'verdict--bleu',
  rouge: 'verdict--rouge',
}

const MARQUES: Record<ResultatTest['verdict'], string> = { vert: '✓', bleu: '≈', rouge: '✕' }

export function PanneauVerdict({ resultat }: { resultat: ResultatTest | null }) {
  if (!resultat) return null
  return (
    <div role="status" aria-live="polite" className={`verdict ${CLASSES[resultat.verdict]}`}>
      <span className="verdict__marque" aria-hidden="true">
        {MARQUES[resultat.verdict]}
      </span>
      <div className="verdict__texte">
        <b>{resultat.titre}</b>
        {resultat.detail && <span className="verdict__detail">{resultat.detail}</span>}
        {resultat.diff && (
          <pre className="verdict__diff" data-testid="diff">
            {resultat.diff.map((segment, index) =>
              segment.type === 'egal' ? (
                <span key={index}>{segment.texte}</span>
              ) : (
                <mark
                  key={index}
                  data-testid={`diff-${segment.type}`}
                  className={`diff diff--${segment.type}`}
                  title={segment.type === 'ajout' ? 'en trop' : 'manquant'}
                >
                  {segment.texte}
                </mark>
              ),
            )}
          </pre>
        )}
      </div>
    </div>
  )
}
```

`plateforme/web/src/ui/PanneauVerdict.css` :

```css
.verdict {
  display: flex;
  gap: 0.7rem;
  align-items: flex-start;
  padding: 0.8rem 0.95rem;
  border-radius: 10px;
  border-left: 3px solid transparent;
  font-size: 0.94rem;
}
.verdict__marque { font-weight: 700; flex: none; }
.verdict__texte { display: flex; flex-direction: column; gap: 0.3rem; }
.verdict__detail { opacity: 0.9; }
.verdict__diff {
  font-family: var(--police-code);
  font-size: 0.84rem;
  margin: 0.4rem 0 0;
  padding: 0.6rem 0.7rem;
  border-radius: 8px;
  background: rgb(0 0 0 / 22%);
  overflow-x: auto;
  white-space: pre-wrap;
}
.diff { border-radius: 3px; padding: 0 1px; }
.diff--ajout  { background: var(--d-red); color: #fff; }
.diff--manque { background: var(--d-green); color: #10240F; }

.verdict--vert  { background: rgb(80 250 123 / 11%); border-left-color: var(--d-green); color: #D6FFE2; }
.verdict--bleu  { background: rgb(139 233 253 / 12%); border-left-color: var(--d-cyan); color: #DAF6FF; }
.verdict--rouge { background: rgb(255 85 85 / 13%); border-left-color: var(--d-red); color: #FFDCDA; }
```

`plateforme/web/src/ui/Editeur.tsx` :

```tsx
import { python } from '@codemirror/lang-python'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { oneDark } from '@codemirror/theme-one-dark'
import { useEffect, useRef } from 'react'

export function Editeur({
  valeur,
  onChange,
  lectureSeule = false,
}: {
  valeur: string
  onChange: (v: string) => void
  lectureSeule?: boolean
}) {
  const conteneur = useRef<HTMLDivElement>(null)
  const vue = useRef<EditorView | null>(null)
  const rappel = useRef(onChange)
  rappel.current = onChange

  useEffect(() => {
    if (!conteneur.current) return
    const etat = EditorState.create({
      doc: valeur,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        python(),
        oneDark,
        EditorView.editable.of(!lectureSeule),
        EditorView.updateListener.of((maj) => {
          if (maj.docChanged) rappel.current(maj.state.doc.toString())
        }),
        EditorView.theme({
          '&': { fontFamily: 'var(--police-code)', fontSize: '0.88rem', borderRadius: '12px' },
          '.cm-content': { padding: '0.9rem 0' },
          '&.cm-focused': { outline: '3px solid var(--py-yellow)' },
        }),
      ],
    })
    vue.current = new EditorView({ state: etat, parent: conteneur.current })
    return () => vue.current?.destroy()
    // Volontairement monté une seule fois : le contenu est piloté par l'effet suivant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureSeule])

  // Remise à l'état de départ quand on change d'exercice.
  useEffect(() => {
    const v = vue.current
    if (!v || v.state.doc.toString() === valeur) return
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: valeur } })
  }, [valeur])

  return <div ref={conteneur} className="editeur" aria-label="Éditeur de code Python" />
}
```

- [ ] **Step 5 : Lancer les tests**

Run : `pnpm test`
Expected : PASS — 5 nouveaux tests

- [ ] **Step 6 : Commit**

```bash
git add plateforme/web
git commit -m "feat: editeur CodeMirror et panneau de verdict avec diff"
```

---

## Tâche 11 : Connexion, parcours et écran d'exercice

Le premier moment où l'ensemble fonctionne bout à bout : un élève saisit son code, résout un exercice, et la progression est persistée.

**Files:**
- Create: `plateforme/web/src/contenu/types.ts`
- Create: `plateforme/web/src/contenu/chargeur.ts`
- Create: `plateforme/web/src/api/client.ts`
- Create: `plateforme/web/src/ui/EcranConnexion.tsx`
- Create: `plateforme/web/src/ui/EcranExercice.tsx`
- Create: `plateforme/web/src/app.tsx`
- Create: `plateforme/web/src/main.tsx`
- Create: `plateforme/web/index.html`
- Test: `plateforme/web/tests/api/client.test.ts`
- Test: `plateforme/web/tests/contenu/chargeur.test.ts`

**Interfaces:**
- Consumes: `evaluer` (T4), `Executeur` (T5), `Editeur` + `PanneauVerdict` (T10), routes API (T8)
- Produces:
  - `type Exercice` — miroir TypeScript du schéma Python de T6
  - `class ClientApi { ouvrirSession(code): Promise<string>; lireParcours(): Promise<string[]>; enregistrerTentative(t): Promise<void> }`
  - `nomsVariablesRequis(ex: Exercice): string[]`

- [ ] **Step 1 : Écrire les types de contenu et le test du chargeur**

`plateforme/web/src/contenu/types.ts` :

```ts
import type { Test } from '../validation/types'

export type Exercice = {
  id: string
  /** Libre côté schéma Python : sert au regroupement, pas au typage. */
  concept: string
  famille: 'variables' | 'types' | 'operateurs' | 'conditions' | 'boucles'
  seance: 1 | 2 | 3
  niveau: 'normal' | 'expert'
  type: 'predire' | 'debug' | 'completer' | 'ecrire'
  titre: string
  obligatoire: boolean
  enonce: string
  depart: string
  indices: string[]
  tests: Test[]
  expert?: string
}
```

`plateforme/web/tests/contenu/chargeur.test.ts` :

```ts
import { describe, expect, it } from 'vitest'
import { nomsVariablesRequis } from '../../src/contenu/chargeur'
import type { Exercice } from '../../src/contenu/types'

const exercice = (tests: Exercice['tests']): Exercice => ({
  id: 's1-10',
  concept: 'variables',
  famille: 'variables',
  seance: 1,
  niveau: 'normal',
  type: 'completer',
  titre: 'Range le nom de l agent',
  obligatoire: true,
  enonce: '',
  depart: '',
  indices: [],
  tests,
})

describe('nomsVariablesRequis', () => {
  it('collecte les noms des tests variable', () => {
    const ex = exercice([
      { type: 'variable', nom: 'nom', typeAttendu: 'str' },
      { type: 'variable', nom: 'age', typeAttendu: 'int' },
      { type: 'sortie', entrees: [], attendu: 'x' },
    ])
    expect(nomsVariablesRequis(ex)).toEqual(['age', 'nom'])
  })

  it('renvoie un tableau vide sans test variable', () => {
    expect(nomsVariablesRequis(exercice([{ type: 'sortie', entrees: [], attendu: 'x' }]))).toEqual([])
  })

  it('dedoublonne', () => {
    const ex = exercice([
      { type: 'variable', nom: 'age', typeAttendu: 'int' },
      { type: 'variable', nom: 'age', valeurAttendue: '17' },
    ])
    expect(nomsVariablesRequis(ex)).toEqual(['age'])
  })
})
```

- [ ] **Step 2 : Écrire le test du client API**

`plateforme/web/tests/api/client.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ClientApi } from '../../src/api/client'

describe('ClientApi', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('ouvre une session et memorise le jeton', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ jeton: 'AGENT-K7M2.sig', code_agent: 'AGENT-K7M2' }),
    })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('AGENT-K7M2')

    await client.lireParcours()
    const entetes = fetchFactice.mock.calls[1]![1].headers
    expect(entetes.Authorization).toBe('Bearer AGENT-K7M2.sig')
  })

  it('leve une erreur explicite sur un code refuse', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({ ok: false, status: 422, json: async () => ({}) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await expect(client.ouvrirSession('toto')).rejects.toThrow(/code d'agent/i)
  })

  it('n envoie jamais de code source dans une tentative', async () => {
    const fetchFactice = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ jeton: 'j', code_agent: 'a' }) })
    const client = new ClientApi('/api', fetchFactice as unknown as typeof fetch)
    await client.ouvrirSession('AGENT-K7M2')
    await client.enregistrerTentative({ exerciceId: 's1-01', verdict: 'vert', typeErreur: null, dureeMs: 12 })

    const corps = JSON.parse(fetchFactice.mock.calls[1]![1].body)
    expect(Object.keys(corps).sort()).toEqual(['duree_ms', 'exercice_id', 'type_erreur', 'verdict'])
  })
})
```

- [ ] **Step 3 : Lancer les tests pour vérifier qu'ils échouent**

Run : `pnpm test`
Expected : FAIL — modules `chargeur` et `client` introuvables

- [ ] **Step 4 : Écrire le chargeur et le client**

`plateforme/web/src/contenu/chargeur.ts` :

```ts
import type { Exercice } from './types'

/** Variables à relire dans l'espace de noms après exécution, pour les tests `variable`. */
export function nomsVariablesRequis(exercice: Exercice): string[] {
  const noms = new Set<string>()
  for (const test of exercice.tests) if (test.type === 'variable') noms.add(test.nom)
  return [...noms].sort()
}

/** Les exercices sont construits dans l'image et servis en statique. */
export async function chargerParcours(chemin = '/contenu/seance-1.json'): Promise<Exercice[]> {
  const reponse = await fetch(chemin)
  if (!reponse.ok) throw new Error(`Contenu introuvable (${reponse.status})`)
  return (await reponse.json()) as Exercice[]
}
```

`plateforme/web/src/api/client.ts` :

```ts
import type { Verdict } from '../validation/types'

export type TentativeAEnvoyer = {
  exerciceId: string
  verdict: Verdict
  typeErreur: string | null
  dureeMs: number
}

export class ClientApi {
  private jeton: string | null = null

  constructor(
    private base = '/api',
    private executerRequete: typeof fetch = fetch,
  ) {}

  async ouvrirSession(codeAgent: string): Promise<string> {
    const reponse = await this.executerRequete(`${this.base}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code_agent: codeAgent }),
    })
    if (!reponse.ok) {
      throw new Error("Ce code d'agent n'est pas reconnu. Vérifie qu'il est de la forme AGENT-XXXX.")
    }
    const donnees = await reponse.json()
    this.jeton = donnees.jeton
    return donnees.code_agent
  }

  private entetes(): Record<string, string> {
    if (!this.jeton) throw new Error('Session non ouverte.')
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${this.jeton}` }
  }

  async lireParcours(): Promise<string[]> {
    const reponse = await this.executerRequete(`${this.base}/parcours`, { headers: this.entetes() })
    if (!reponse.ok) throw new Error('Progression indisponible.')
    return (await reponse.json()).reussis
  }

  /** N'envoie jamais le code source : contrainte globale du projet. */
  async enregistrerTentative(t: TentativeAEnvoyer): Promise<void> {
    await this.executerRequete(`${this.base}/tentative`, {
      method: 'POST',
      headers: this.entetes(),
      body: JSON.stringify({
        exercice_id: t.exerciceId,
        verdict: t.verdict,
        type_erreur: t.typeErreur,
        duree_ms: t.dureeMs,
      }),
    })
  }
}
```

- [ ] **Step 5 : Lancer les tests**

Run : `pnpm test`
Expected : PASS — 6 nouveaux tests

- [ ] **Step 6 : Écrire les écrans**

`plateforme/web/src/ui/EcranConnexion.tsx` :

```tsx
import { useState } from 'react'

export function EcranConnexion({ onConnecte }: { onConnecte: (code: string) => Promise<void> }) {
  const [code, setCode] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  async function soumettre(evenement: React.FormEvent) {
    evenement.preventDefault()
    setEnCours(true)
    setErreur(null)
    try {
      await onConnecte(code.trim().toUpperCase())
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Connexion impossible.')
    } finally {
      setEnCours(false)
    }
  }

  return (
    <main className="connexion" data-famille="variables">
      <h1>Quartier Général</h1>
      <p>Saisis le code d'agent qu'on t'a remis.</p>
      <form onSubmit={soumettre}>
        <label htmlFor="code">Code d'agent</label>
        <input
          id="code"
          className="mono"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="AGENT-K7M2"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" disabled={enCours || code.trim().length < 4}>
          {enCours ? 'Connexion…' : 'Entrer'}
        </button>
      </form>
      {erreur && <p role="alert">{erreur}</p>}
    </main>
  )
}
```

`plateforme/web/src/ui/EcranExercice.tsx` :

```tsx
import { useEffect, useMemo, useState } from 'react'
import type { Exercice } from '../contenu/types'
import { nomsVariablesRequis } from '../contenu/chargeur'
import { Executeur } from '../execution/executeur'
import { evaluer } from '../validation/evaluer'
import type { ResultatTest } from '../validation/types'
import { Editeur } from './Editeur'
import { PanneauVerdict } from './PanneauVerdict'

const SEUIL_INDICE = 2 // le deuxième indice se débloque après 2 essais infructueux

export function EcranExercice({
  exercice,
  executeur,
  onReussi,
}: {
  exercice: Exercice
  executeur: Executeur
  onReussi: (resultat: ResultatTest, dureeMs: number) => void
}) {
  const [code, setCode] = useState(exercice.depart)
  const [resultat, setResultat] = useState<ResultatTest | null>(null)
  const [essais, setEssais] = useState(0)
  const [reponseQcm, setReponseQcm] = useState<number | undefined>(undefined)
  const [enCours, setEnCours] = useState(false)

  useEffect(() => {
    setCode(exercice.depart)
    setResultat(null)
    setEssais(0)
    setReponseQcm(undefined)
  }, [exercice.id, exercice.depart])

  const noms = useMemo(() => nomsVariablesRequis(exercice), [exercice])
  const qcm = exercice.tests.find((t) => t.type === 'qcm')
  const entrees = exercice.tests.find((t) => t.type === 'sortie')?.entrees ?? []

  async function valider() {
    setEnCours(true)
    const execution =
      exercice.type === 'predire'
        ? { stdout: '', erreur: null, variables: {}, dureeMs: 0, timeout: false }
        : await executeur.executer({ code, entrees, nomsVariables: noms })

    const evalue = evaluer({ code, tests: exercice.tests, execution, reponseQcm })
    setResultat(evalue)
    setEssais((n) => n + 1)
    setEnCours(false)
    onReussi(evalue, execution.dureeMs)
  }

  const indicesVisibles = exercice.indices.slice(0, essais >= SEUIL_INDICE ? exercice.indices.length : 1)

  return (
    <main className="exercice" data-famille={exercice.famille}>
      <header className="exercice__entete">
        <span>{exercice.titre}</span>
        <span>{essais === 0 ? 'aucun essai' : `${essais} essai${essais > 1 ? 's' : ''}`}</span>
      </header>

      <section className="exercice__enonce">
        <p>{exercice.enonce}</p>
        {indicesVisibles.map((indice, i) => (
          <p key={i} className="indice">
            <b>Indice {i + 1}</b> {indice}
          </p>
        ))}
        {exercice.indices.length > indicesVisibles.length && (
          <p className="indice indice--verrouille">
            <b>Indice {indicesVisibles.length + 1}</b> Verrouillé — encore un essai avant de le débloquer.
          </p>
        )}
      </section>

      <section className="exercice__travail">
        {qcm && qcm.type === 'qcm' ? (
          <fieldset>
            <legend>Qu'affiche ce programme ?</legend>
            {qcm.options.map((option, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name="qcm"
                  checked={reponseQcm === i}
                  onChange={() => setReponseQcm(i)}
                />
                <span className="mono">{option}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          <Editeur valeur={code} onChange={setCode} />
        )}

        <div className="exercice__actions">
          <button type="button" onClick={valider} disabled={enCours}>
            {enCours ? 'Exécution…' : 'Valider'}
          </button>
          <span className="exercice__note">exécuté dans ton navigateur</span>
        </div>

        <PanneauVerdict resultat={resultat} />
      </section>
    </main>
  )
}
```

- [ ] **Step 7 : Câbler l'application**

`plateforme/web/src/app.tsx` :

```tsx
import { useEffect, useMemo, useState } from 'react'
import { ClientApi } from './api/client'
import { chargerParcours } from './contenu/chargeur'
import type { Exercice } from './contenu/types'
import { Executeur } from './execution/executeur'
import { EcranConnexion } from './ui/EcranConnexion'
import { EcranExercice } from './ui/EcranExercice'

export function App() {
  const client = useMemo(() => new ClientApi(), [])
  const executeur = useMemo(
    () => new Executeur(() => new Worker(new URL('./execution/worker.ts', import.meta.url), { type: 'module' })),
    [],
  )
  const [connecte, setConnecte] = useState(false)
  const [exercices, setExercices] = useState<Exercice[]>([])
  const [reussis, setReussis] = useState<string[]>([])

  useEffect(() => () => executeur.detruire(), [executeur])

  async function connecter(code: string) {
    await client.ouvrirSession(code)
    setExercices(await chargerParcours())
    setReussis(await client.lireParcours())
    setConnecte(true)
  }

  if (!connecte) return <EcranConnexion onConnecte={connecter} />

  const courant = exercices.find((e) => !reussis.includes(e.id))
  if (!courant) return <main><h1>Séance terminée. Beau travail, agent.</h1></main>

  return (
    <EcranExercice
      exercice={courant}
      executeur={executeur}
      onReussi={async (resultat, dureeMs) => {
        await client.enregistrerTentative({
          exerciceId: courant.id,
          verdict: resultat.verdict,
          typeErreur: resultat.verdict === 'rouge' ? resultat.titre.slice(0, 64) : null,
          dureeMs,
        })
        if (resultat.verdict !== 'rouge') setReussis((liste) => [...liste, courant.id])
      }}
    />
  )
}
```

`plateforme/web/src/main.tsx` :

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app'
import './ui/tokens.css'
import './ui/base.css'

createRoot(document.getElementById('racine')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

`plateforme/web/index.html` :

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Quartier Général</title>
  </head>
  <body>
    <div id="racine"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 8 : Vérifier la construction et les tests**

Run : `pnpm build && pnpm test`
Expected : la construction réussit sans erreur TypeScript, tous les tests passent

- [ ] **Step 9 : Commit**

```bash
git add plateforme/web
git commit -m "feat: connexion par code d'agent et ecran d'exercice complet"
```

---

## Tâche 12 : Tableau de bord professeur

Répond à une seule question : ==lequel des 24 élèves est bloqué, et sur quoi ?== Il n'affiche jamais le code écrit par l'élève — décision explicite de [[ADR-002 Identification par code d'agent]].

**Files:**
- Create: `plateforme/api/app/routes_prof.py`
- Modify: `plateforme/api/app/main.py` (monter le routeur prof)
- Create: `plateforme/web/src/ui/TableauDeBord.tsx`
- Test: `plateforme/api/tests/test_routes_prof.py`

**Interfaces:**
- Consumes: `Tentative`, `Verrou` (T8), `agent_courant` non utilisé ici (auth distincte)
- Produces:
  - `GET /prof/seance` (en-tête `X-Code-Prof`) → `{agents: [{code_agent, exercice_id, statut, echecs_consecutifs, inactif_depuis_s, dernier_type_erreur}]}`
  - `POST /prof/verrou` `{concept, ouvert}` → `{concept, ouvert}`
  - `statut ∈ {"bloque", "inactif", "en_cours", "termine"}`

- [ ] **Step 1 : Écrire le test qui échoue**

`plateforme/api/tests/test_routes_prof.py` :

```python
from datetime import datetime, timedelta, timezone

from sqlmodel import Session

from app.modeles import Agent, Tentative

ENTETES = {"X-Code-Prof": "prof-dev"}


def _tentative(session: Session, code: str, exercice: str, verdict: str, il_y_a_s: int, erreur=None):
    session.add(Agent(code_agent=code)) if session.get(Agent, code) is None else None
    session.add(
        Tentative(
            code_agent=code,
            exercice_id=exercice,
            verdict=verdict,
            type_erreur=erreur,
            duree_ms=40,
            horodatage=datetime.now(timezone.utc) - timedelta(seconds=il_y_a_s),
        )
    )
    session.commit()


def test_sans_code_prof_l_acces_est_refuse(client):
    assert client.get("/prof/seance").status_code == 401


def test_code_prof_errone_refuse(client):
    assert client.get("/prof/seance", headers={"X-Code-Prof": "faux"}).status_code == 401


def test_agent_avec_trois_echecs_consecutifs_est_bloque(client, session_test):
    for _ in range(3):
        _tentative(session_test, "AGENT-M3QP", "s1-21", "rouge", 60, "TypeError")
    donnees = client.get("/prof/seance", headers=ENTETES).json()
    ligne = next(a for a in donnees["agents"] if a["code_agent"] == "AGENT-M3QP")
    assert ligne["statut"] == "bloque"
    assert ligne["echecs_consecutifs"] == 3
    assert ligne["dernier_type_erreur"] == "TypeError"


def test_une_reussite_remet_le_compteur_a_zero(client, session_test):
    for _ in range(3):
        _tentative(session_test, "AGENT-K7M2", "s1-21", "rouge", 300, "TypeError")
    _tentative(session_test, "AGENT-K7M2", "s1-21", "vert", 60)
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["agents"]
        if a["code_agent"] == "AGENT-K7M2"
    )
    assert ligne["echecs_consecutifs"] == 0
    assert ligne["statut"] == "en_cours"


def test_agent_sans_activite_recente_est_inactif(client, session_test):
    _tentative(session_test, "AGENT-R8TV", "s1-02", "rouge", 900, "SyntaxError")
    ligne = next(
        a for a in client.get("/prof/seance", headers=ENTETES).json()["agents"]
        if a["code_agent"] == "AGENT-R8TV"
    )
    assert ligne["statut"] == "inactif"
    assert ligne["inactif_depuis_s"] >= 600


def test_les_bloques_remontent_en_tete(client, session_test):
    _tentative(session_test, "AGENT-AAAA", "s1-01", "vert", 30)
    for _ in range(3):
        _tentative(session_test, "AGENT-ZZZZ", "s1-21", "rouge", 30, "TypeError")
    agents = client.get("/prof/seance", headers=ENTETES).json()["agents"]
    assert agents[0]["code_agent"] == "AGENT-ZZZZ"


def test_la_reponse_ne_contient_jamais_de_code_source(client, session_test):
    _tentative(session_test, "AGENT-K7M2", "s1-01", "vert", 10)
    corps = client.get("/prof/seance", headers=ENTETES).text
    assert "print(" not in corps
    for cle in ("code", "source", "solution"):
        assert f'"{cle}"' not in corps


def test_verrouiller_puis_deverrouiller_un_concept(client):
    r = client.post("/prof/verrou", headers=ENTETES, json={"concept": "types", "ouvert": False})
    assert r.json() == {"concept": "types", "ouvert": False}
    r = client.post("/prof/verrou", headers=ENTETES, json={"concept": "types", "ouvert": True})
    assert r.json()["ouvert"] is True
```

Ajouter la fixture `session_test` dans `plateforme/api/tests/conftest.py`, qui expose la même session que le client :

```python
@pytest.fixture(name="session_test")
def fixture_session_test(client):
    """Session partagée avec le client, pour préparer des données."""
    generateur = application.dependency_overrides[bdd.obtenir_session]()
    session = next(generateur)
    yield session
    session.close()
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run : `cd plateforme/api && python -m pytest tests/test_routes_prof.py -v`
Expected : FAIL — 404 sur `/prof/seance`

- [ ] **Step 3 : Écrire les routes prof**

`plateforme/api/app/routes_prof.py` :

```python
"""Tableau de bord. Ne renvoie jamais le code ecrit par un eleve."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from .bdd import obtenir_session
from .modeles import Tentative, Verrou

routeur = APIRouter(prefix="/prof")

CODE_PROF = os.environ.get("QG_CODE_PROF", "prof-dev")
ECHECS_POUR_BLOQUE = 3
SECONDES_POUR_INACTIF = 600


def verifier_prof(x_code_prof: Annotated[str | None, Header()] = None) -> None:
    if x_code_prof != CODE_PROF:
        raise HTTPException(401, "Code professeur invalide")


class DemandeVerrou(BaseModel):
    concept: str
    ouvert: bool


@routeur.get("/seance", dependencies=[Depends(verifier_prof)])
def lire_seance(session: Annotated[Session, Depends(obtenir_session)]) -> dict:
    tentatives = session.exec(select(Tentative).order_by(Tentative.horodatage)).all()

    par_agent: dict[str, list[Tentative]] = {}
    for t in tentatives:
        par_agent.setdefault(t.code_agent, []).append(t)

    maintenant = datetime.now(timezone.utc)
    agents = []
    for code, liste in par_agent.items():
        derniere = liste[-1]

        echecs = 0
        for t in reversed(liste):
            if t.verdict == "rouge":
                echecs += 1
            else:
                break

        horodatage = derniere.horodatage
        if horodatage.tzinfo is None:
            horodatage = horodatage.replace(tzinfo=timezone.utc)
        inactif_depuis = int((maintenant - horodatage).total_seconds())

        if echecs >= ECHECS_POUR_BLOQUE:
            statut = "bloque"
        elif inactif_depuis >= SECONDES_POUR_INACTIF:
            statut = "inactif"
        else:
            statut = "en_cours"

        agents.append(
            {
                "code_agent": code,
                "exercice_id": derniere.exercice_id,
                "statut": statut,
                "echecs_consecutifs": echecs,
                "inactif_depuis_s": inactif_depuis,
                "dernier_type_erreur": derniere.type_erreur if derniere.verdict == "rouge" else None,
                "reussis": len({t.exercice_id for t in liste if t.verdict in ("vert", "bleu")}),
            }
        )

    ordre = {"bloque": 0, "inactif": 1, "en_cours": 2, "termine": 3}
    agents.sort(key=lambda a: (ordre[a["statut"]], -a["inactif_depuis_s"]))
    return {"agents": agents}


@routeur.post("/verrou", dependencies=[Depends(verifier_prof)])
def basculer_verrou(
    demande: DemandeVerrou, session: Annotated[Session, Depends(obtenir_session)]
) -> dict:
    verrou = session.get(Verrou, demande.concept)
    if verrou is None:
        verrou = Verrou(concept=demande.concept, ouvert=demande.ouvert)
        session.add(verrou)
    else:
        verrou.ouvert = demande.ouvert
        session.add(verrou)
    session.commit()
    return {"concept": demande.concept, "ouvert": demande.ouvert}
```

Modifier `plateforme/api/app/main.py` — ajouter après l'import du routeur élève :

```python
from .routes_prof import routeur as routeur_prof

application.include_router(routeur_prof)
```

- [ ] **Step 4 : Lancer les tests**

Run : `python -m pytest tests/ -v`
Expected : PASS — 19 tests au total

- [ ] **Step 5 : Écrire l'écran du tableau de bord**

`plateforme/web/src/ui/TableauDeBord.tsx` :

```tsx
import { useEffect, useState } from 'react'
import './TableauDeBord.css'

type LigneAgent = {
  code_agent: string
  exercice_id: string
  statut: 'bloque' | 'inactif' | 'en_cours' | 'termine'
  echecs_consecutifs: number
  inactif_depuis_s: number
  dernier_type_erreur: string | null
  reussis: number
}

const LIBELLES: Record<LigneAgent['statut'], string> = {
  bloque: 'Bloqué',
  inactif: 'Inactif',
  en_cours: 'En cours',
  termine: 'Terminé',
}

function minutes(secondes: number): string {
  return `${Math.floor(secondes / 60)} min`
}

export function TableauDeBord({ codeProf }: { codeProf: string }) {
  const [agents, setAgents] = useState<LigneAgent[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    let vivant = true
    async function rafraichir() {
      try {
        const reponse = await fetch('/api/prof/seance', { headers: { 'X-Code-Prof': codeProf } })
        if (!reponse.ok) throw new Error('Accès refusé.')
        const donnees = await reponse.json()
        if (vivant) {
          setAgents(donnees.agents)
          setErreur(null)
        }
      } catch (e) {
        if (vivant) setErreur(e instanceof Error ? e.message : 'Erreur réseau.')
      }
    }
    rafraichir()
    const minuteur = setInterval(rafraichir, 10_000)
    return () => {
      vivant = false
      clearInterval(minuteur)
    }
  }, [codeProf])

  return (
    <main className="tableau">
      <header className="tableau__entete">
        <h1>Séance en cours</h1>
        <p>{agents.length} agents connectés</p>
      </header>
      {erreur && <p role="alert">{erreur}</p>}
      <div className="tableau__lignes">
        {agents.map((a) => (
          <article key={a.code_agent} className={`ligne ligne--${a.statut}`}>
            <span className="mono ligne__agent">{a.code_agent}</span>
            <span className="ligne__ou">{a.exercice_id}</span>
            <span className="ligne__quoi">
              {a.statut === 'bloque' &&
                `${a.echecs_consecutifs} échecs d'affilée${a.dernier_type_erreur ? ` — ${a.dernier_type_erreur}` : ''}`}
              {a.statut === 'inactif' && `aucune soumission depuis ${minutes(a.inactif_depuis_s)}`}
              {a.statut === 'en_cours' && `${a.reussis} exercices validés`}
            </span>
            <span className={`statut statut--${a.statut}`}>
              {LIBELLES[a.statut]}
              {a.statut === 'bloque' && ` ${minutes(a.inactif_depuis_s)}`}
            </span>
          </article>
        ))}
      </div>
    </main>
  )
}
```

`plateforme/web/src/ui/TableauDeBord.css` :

```css
.tableau { max-width: 1080px; margin-inline: auto; padding: 1.5rem; }
.tableau__lignes { display: flex; flex-direction: column; }
.ligne {
  display: grid;
  grid-template-columns: minmax(112px, 0.7fr) minmax(90px, 0.6fr) minmax(190px, 1.6fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 0.85rem 1rem;
  border-top: 1px solid var(--rule);
  border-left: 3px solid transparent;
  font-size: 0.9rem;
}
.ligne--bloque  { border-left-color: var(--ko); background: #FEF6F5; }
.ligne--inactif { border-left-color: var(--ko); background: #FEF6F5; }
.ligne--termine { border-left-color: var(--ok); }
.ligne__agent { font-weight: 500; }
.ligne__ou, .ligne__quoi { color: var(--ink-soft); }
/* La forme encode un etat : c'est le seul endroit ou une pastille est justifiee. */
.statut {
  font-size: 0.86rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  border-radius: 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.statut--bloque, .statut--inactif { background: #FBE3E1; color: var(--ko); }
.statut--en_cours { background: var(--ground-2); color: var(--ink-soft); }
.statut--termine { background: #E2F3E6; color: var(--ok); }
```

- [ ] **Step 6 : Commit**

```bash
git add plateforme/api plateforme/web/src/ui
git commit -m "feat: tableau de bord professeur avec detection de blocage"
```

---

## Tâche 13 : Déploiement

**Files:**
- Create: `plateforme/deploiement/docker-compose.yml`
- Create: `plateforme/deploiement/Caddyfile`
- Create: `plateforme/deploiement/Dockerfile.api`
- Create: `plateforme/deploiement/Dockerfile.web`
- Create: `plateforme/outils/construire_contenu.py`
- Test: `plateforme/outils/tests/test_construire_contenu.py`

**Interfaces:**
- Consumes: `charger_tous`, `verifier_coherence` (T6)
- Produces: `construire(racine: Path, sortie: Path) -> int` — écrit `seance-1.json` consommé par `chargerParcours` (T11)

- [ ] **Step 1 : Écrire le test du constructeur de contenu**

`plateforme/outils/tests/test_construire_contenu.py` :

```python
import json
from pathlib import Path

import pytest
import yaml

from construire_contenu import construire

BASE = dict(
    id="s1-01",
    concept="print",
    seance=1,
    niveau="normal",
    type="ecrire",
    titre="Ton indicatif",
    obligatoire=True,
    enonce="Affiche Corbeau.",
    depart="",
    indices=[],
    tests=[
        {"type": "sortie", "entrees": [], "attendu": "Corbeau"},
        {"type": "interdit", "motif": "xyzzy"},
    ],
    solution='print("Corbeau")',
)


def _ecrire(dossier: Path, donnees: dict) -> None:
    dossier.mkdir(parents=True, exist_ok=True)
    (dossier / f"{donnees['id']}.yaml").write_text(
        yaml.safe_dump(donnees, allow_unicode=True), encoding="utf-8"
    )


def test_construit_le_json_de_la_seance(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    assert construire(tmp_path, sortie) == 1

    exercices = json.loads((sortie / "seance-1.json").read_text(encoding="utf-8"))
    assert exercices[0]["id"] == "s1-01"


def test_la_solution_n_est_jamais_publiee(tmp_path):
    """La solution ne doit pas partir dans le navigateur de l'eleve."""
    _ecrire(tmp_path / "seance-1", dict(BASE))
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    brut = (sortie / "seance-1.json").read_text(encoding="utf-8")
    assert "solution" not in brut
    assert "Corbeau" in brut  # l'attendu, lui, est bien present


def test_un_contenu_incoherent_fait_echouer_la_construction(tmp_path):
    _ecrire(tmp_path / "seance-1", dict(BASE, solution='print("Faucon")'))
    with pytest.raises(SystemExit):
        construire(tmp_path, tmp_path / "sortie")


def test_les_cles_sont_converties_en_camel_case(tmp_path):
    """Le YAML est en snake_case, l'evaluateur TypeScript lit du camelCase."""
    donnees = dict(BASE)
    donnees["tests"] = [
        {"type": "variable", "nom": "age", "type_attendu": "int"},
        {"type": "sortie", "entrees": [], "attendu": "Corbeau", "exige_exact": True},
    ]
    donnees["type"] = "completer"
    _ecrire(tmp_path / "seance-1", donnees)
    sortie = tmp_path / "sortie"
    construire(tmp_path, sortie)

    exercice = json.loads((sortie / "seance-1.json").read_text(encoding="utf-8"))[0]
    assert exercice["tests"][0]["typeAttendu"] == "int"
    assert exercice["tests"][1]["exigeExact"] is True
    assert "type_attendu" not in exercice["tests"][0]
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run : `cd plateforme/outils && python -m pytest tests/test_construire_contenu.py -v`
Expected : FAIL — `ModuleNotFoundError: No module named 'construire_contenu'`

- [ ] **Step 3 : Écrire le constructeur**

`plateforme/outils/construire_contenu.py` :

```python
"""Transforme le contenu YAML en JSON servi au navigateur.

Deux garanties : la construction echoue si un exercice est incoherent, et
la solution de reference n'est jamais publiee.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from schema import charger_tous
from valider_contenu import verifier_coherence

# Familles de couleur par concept — voir la note Palette du coffre.
FAMILLES = {
    "print": "variables",
    "execution": "variables",
    "variable": "variables",
    "variables": "variables",
    "reaffectation": "variables",
    "erreurs": "variables",
    "format exact": "variables",
    "types": "types",
    "conversion": "types",
    "f-string": "types",
    "input": "types",
    "operateurs": "operateurs",
    "conditions": "conditions",
    "boucles": "boucles",
    "probleme narratif": "variables",
}


def _en_camel(nom: str) -> str:
    tete, *reste = nom.split("_")
    return tete + "".join(mot.capitalize() for mot in reste)


def _convertir_cles(valeur):
    """Le YAML est en snake_case, le TypeScript attend du camelCase.

    Sans cette conversion, `type_attendu` arrive dans le navigateur alors que
    l'evaluateur lit `typeAttendu` : tous les tests `variable` echouent en
    silence, et l'exercice devient impossible a valider.
    """
    if isinstance(valeur, dict):
        return {_en_camel(cle): _convertir_cles(v) for cle, v in valeur.items()}
    if isinstance(valeur, list):
        return [_convertir_cles(v) for v in valeur]
    return valeur


def construire(racine: Path, sortie: Path) -> int:
    exercices = charger_tous(racine)

    problemes: list[str] = []
    for ex in exercices:
        problemes += verifier_coherence(ex)
    if problemes:
        for p in problemes:
            print(f"  PROBLEME  {p}", file=sys.stderr)
        raise SystemExit(f"{len(problemes)} probleme(s) : construction interrompue.")

    sortie.mkdir(parents=True, exist_ok=True)
    for seance in (1, 2, 3):
        publiables = [
            {
                **_convertir_cles(ex.model_dump(exclude={"solution"})),
                "famille": FAMILLES.get(ex.concept, "variables"),
            }
            for ex in exercices
            if ex.seance == seance
        ]
        if publiables:
            (sortie / f"seance-{seance}.json").write_text(
                json.dumps(publiables, ensure_ascii=False, indent=2), encoding="utf-8"
            )
    return len(exercices)


def principal() -> int:
    parseur = argparse.ArgumentParser(description="Construit le contenu publiable.")
    parseur.add_argument("racine", type=Path, nargs="?", default=Path("../../contenu/chapitre-1"))
    parseur.add_argument("sortie", type=Path, nargs="?", default=Path("../web/public/contenu"))
    arguments = parseur.parse_args()
    total = construire(arguments.racine, arguments.sortie)
    print(f"{total} exercices publies dans {arguments.sortie}.")
    return 0


if __name__ == "__main__":
    sys.exit(principal())
```

- [ ] **Step 4 : Lancer les tests**

Run : `python -m pytest tests/ -v`
Expected : PASS — 18 tests

- [ ] **Step 5 : Écrire les fichiers de déploiement**

`plateforme/deploiement/Dockerfile.api` :

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY api/app ./app
RUN mkdir -p /app/donnees
ENV QG_BDD=sqlite:////app/donnees/qg.db
EXPOSE 8000
CMD ["uvicorn", "app.main:application", "--host", "0.0.0.0", "--port", "8000"]
```

`plateforme/deploiement/Dockerfile.web` :

```dockerfile
FROM python:3.12-slim AS contenu
WORKDIR /build
COPY outils ./outils
COPY contenu ./contenu
RUN pip install --no-cache-dir -r outils/requirements.txt \
 && cd outils && python construire_contenu.py ../contenu/chapitre-1 /build/public-contenu

FROM node:22-slim AS construction
WORKDIR /build
RUN corepack enable
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web .
COPY --from=contenu /build/public-contenu ./public/contenu
RUN pnpm build

FROM caddy:2-alpine
COPY --from=construction /build/dist /srv
COPY deploiement/Caddyfile /etc/caddy/Caddyfile
```

`plateforme/deploiement/Caddyfile` :

```
{$QG_DOMAINE:localhost} {
	encode zstd gzip

	handle_path /api/* {
		reverse_proxy api:8000
	}

	handle {
		root * /srv
		# Pyodide et les polices : immuables, mis en cache un an.
		@immuables path /pyodide/* /polices/* /assets/*
		header @immuables Cache-Control "public, max-age=31536000, immutable"
		# WebAssembly doit etre servi avec le bon type MIME, sinon Pyodide echoue.
		@wasm path *.wasm
		header @wasm Content-Type "application/wasm"
		try_files {path} /index.html
		file_server
	}
}
```

`plateforme/deploiement/docker-compose.yml` :

```yaml
services:
  api:
    build:
      context: ..
      dockerfile: deploiement/Dockerfile.api
    environment:
      QG_SECRET: ${QG_SECRET:?definir QG_SECRET dans .env}
      QG_CODE_PROF: ${QG_CODE_PROF:?definir QG_CODE_PROF dans .env}
    volumes:
      - donnees:/app/donnees
    restart: unless-stopped

  web:
    build:
      context: ..
      dockerfile: deploiement/Dockerfile.web
    environment:
      QG_DOMAINE: ${QG_DOMAINE:-localhost}
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - api
    volumes:
      - caddy_data:/data
    restart: unless-stopped

volumes:
  donnees:
  caddy_data:
```

- [ ] **Step 6 : Vérifier le déploiement en local**

```bash
cd plateforme/deploiement
printf 'QG_SECRET=%s\nQG_CODE_PROF=%s\n' "$(openssl rand -hex 24)" "$(openssl rand -hex 8)" > .env
docker compose up --build
```

Vérifications, chacune doit passer :

```bash
curl -s localhost/api/sante                     # {"etat":"ok"}
curl -sI localhost/pyodide/pyodide.asm.wasm | grep -i content-type   # application/wasm
curl -sI localhost/polices/general-sans-400.woff2 | grep -i cache-control  # immutable
curl -s localhost/ | grep -c 'fonts.googleapis\|fontshare'   # doit afficher 0
```

- [ ] **Step 7 : Test de charge à 24 onglets**

> [!danger] Le seul risque qui peut faire échouer la séance entière
> 24 navigateurs chargeant Pyodide simultanément sur le réseau du collège.
> À exécuter **depuis la salle**, pas depuis le poste de développement.

```bash
seq 24 | xargs -P 24 -I{} curl -s -o /dev/null -w '{} %{time_total}s\n' https://$QG_DOMAINE/pyodide/pyodide.asm.wasm
```

Expected : toutes les requêtes aboutissent, la plus lente sous 30 s.
Si ce n'est pas le cas, activer le repli en notebooks Jupyter pour la séance 1 ([[Plan de production]]).

- [ ] **Step 8 : Commit**

```bash
git add plateforme/deploiement plateforme/outils
git commit -m "chore: deploiement docker compose et construction du contenu"
```

---

## Tâche 14 : Les 25 exercices obligatoires de la séance 1

Le lot 1 de [[Plan de production]]. Ordre de production **du moins cher au plus cher**, pour qu'un livrable partiel existe à tout moment.

**Files:**
- Create: `plateforme/contenu/chapitre-1/seance-1/01-print/s1-01.yaml` … `s1-07.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/02-execution/s1-04.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/03-variables/s1-09.yaml` … `s1-14.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/04-types/s1-19.yaml` … `s1-24.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/05-input/s1-27.yaml` … `s1-31.yaml`
- Create: `plateforme/contenu/chapitre-1/seance-1/99-probleme/s1-34.yaml`

Liste complète et justification de chaque placement : `5-pedagogie/progression-chapitre-1.json`.

- [ ] **Step 1 : Écrire s1-01, le tout premier exercice (type `predire`)**

`plateforme/contenu/chapitre-1/seance-1/01-print/s1-01.yaml` :

```yaml
id: s1-01
concept: print
seance: 1
niveau: normal
type: predire
titre: Le premier message du QG
obligatoire: true
enonce: |
  Le terminal du Quartier Général affiche ce programme.
  Qu'est-ce qui apparaît à l'écran quand on l'exécute ?
depart: |
  print("Bienvenue au QG")
indices:
  - Les guillemets servent à délimiter le texte, ils ne s'affichent pas.
tests:
  - type: qcm
    options:
      - Bienvenue au QG
      - '"Bienvenue au QG"'
      - print("Bienvenue au QG")
    bonne_reponse: 0
solution: |
  print("Bienvenue au QG")
```

> [!note] Pourquoi celui-ci en premier
> Aucune écriture, aucune erreur possible, une réussite acquise en vingt secondes.
> ==L'élève qui n'a jamais programmé doit avoir gagné avant d'avoir eu le temps d'avoir peur.==

- [ ] **Step 2 : Écrire s1-21, le `debug` de la conversion de type**

C'est l'erreur la plus fréquente des copies 2025.

`plateforme/contenu/chapitre-1/seance-1/04-types/s1-21.yaml` :

```yaml
id: s1-21
concept: conversion
seance: 1
niveau: normal
type: debug
titre: Impossible d'additionner du texte et un nombre
obligatoire: true
enonce: |
  Une transmission d'un agent tombé nous parvient corrompue.
  Le programme devait afficher « Agent Corbeau a 17 ans » mais il refuse de démarrer.
  Répare-le.
depart: |
  nom = "Corbeau"
  age = 17
  print("Agent " + nom + " a " + age + " ans")
indices:
  - Python refuse de coller un nombre à du texte. Lis bien le message d'erreur.
  - La fonction str() transforme un nombre en texte.
tests:
  - type: sortie
    entrees: []
    attendu: Agent Corbeau a 17 ans
  - type: interdit
    motif: '"Agent Corbeau a 17 ans"'
solution: |
  nom = "Corbeau"
  age = 17
  print("Agent " + nom + " a " + str(age) + " ans")
```

- [ ] **Step 3 : Écrire s1-30, `int(input())`**

La micro-notion absente du notebook 2025 alors que les trois problèmes en dépendent.

`plateforme/contenu/chapitre-1/seance-1/05-input/s1-30.yaml` :

```yaml
id: s1-30
concept: conversion
seance: 1
niveau: normal
type: completer
titre: int(input())
obligatoire: true
enonce: |
  Le sas du QG doit comparer l'âge de l'agent à 18.
  Mais input() rend toujours du TEXTE, jamais un nombre.
  Complète la ligne pour que age contienne un vrai nombre.
depart: |
  age = _____(input("Ton age : "))
  print(age + 1)
indices:
  - La fonction int() transforme du texte en nombre entier.
tests:
  - type: variable
    nom: age
    type_attendu: int
  - type: sortie
    entrees:
      - '17'
    attendu: |-
      Ton age : 17
      18
solution: |
  age = int(input("Ton age : "))
  print(age + 1)
```

- [ ] **Step 4 : Écrire les 22 exercices restants**

Suivre l'ordre de production. Pour chaque exercice, la liste `progression-chapitre-1.json` donne `id`, `concept`, `type`, `titre` et `travaille`.

Rappels de forme, à ne pas enfreindre :

- ==Tout exercice `ecrire` porte un test `interdit`==, sinon la réponse peut être codée en dur
- Tout exercice `predire` porte un test `qcm`
- Aucun emoji dans un `attendu`, aucune mention de `getpass`
- Les énoncés sont lisibles sans vocabulaire anglais ni prérequis mathématique

Ne jamais écrire un `attendu` à la main :

```bash
cd plateforme/outils
python generer_attendu.py ../contenu/chapitre-1/seance-1
```

- [ ] **Step 5 : Valider tout le contenu**

Run : `python valider_contenu.py ../contenu/chapitre-1`
Expected : `25 exercices charges.` puis `Contenu valide.`

Si un problème remonte, le corriger avant de continuer — ==un exercice dont la solution ne passe pas ses propres tests envoie toute la classe lever la main en même temps==.

- [ ] **Step 6 : Construire et vérifier bout en bout**

```bash
python construire_contenu.py ../contenu/chapitre-1 ../web/public/contenu
cd ../web && pnpm dev
```

Ouvrir la page, saisir `AGENT-TEST`, et parcourir les 25 exercices en résolvant chacun.
Expected : les 25 se valident, la progression persiste après un rechargement de page.

- [ ] **Step 7 : Commit**

```bash
git add plateforme/contenu
git commit -m "feat: les 25 exercices obligatoires de la seance 1"
```

---

## Ce qui reste après le 16 septembre

Hors périmètre de ce plan, par décision de [[Spécification chapitre 1]] :

- **Écran leçon** — nécessaire avant le 23, pour le travail entre les séances
- **Lots 2, 3 et 4** de contenu — voir [[Plan de production]]
- **Gamification** : XP, classement hebdomadaire, badges
- **Exercices experts** — 23 au total
- **Verrouillage de rythme** côté élève (la route API existe déjà, l'interface non)

Deux corrections au matériel 2025 listées par [[Spécification chapitre 1]] ne relèvent pas de ce
plan, parce qu'elles portent sur du contenu de cours et sur les séances 2 et 3 :

- **Réécrire le corrigé Avancé** qui utilise `enumerate()` — nécessaire avant la séance 3
- **Ajouter `input()` au notebook de cours** — il en est absent alors que les trois problèmes en
  dépendent ; nécessaire avant la séance 1, mais c'est du support pédagogique, pas du logiciel

Les deux autres corrections, elles, sont **appliquées et verrouillées par le schéma** de la
tâche 6 : `getpass` et les emoji font échouer la validation du contenu.
