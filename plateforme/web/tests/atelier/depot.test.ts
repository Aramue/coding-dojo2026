import { readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cataloguer,
  choisirDossier,
  ecrireFichier,
  estUnFichierDeContenu,
  lireFichier,
  listerFichiers,
  peutOuvrirUnDossier,
  titreDe,
  type PoigneeDossier,
  type PoigneeFichier,
} from '../../src/atelier/depot'
import { dossier, fichier } from './poignees'

/** `feuille` enfouie sous `n` dossiers. */
function enfoui(n: number, feuille: PoigneeFichier): PoigneeDossier {
  let courant: PoigneeFichier | PoigneeDossier = feuille
  for (let i = n; i >= 1; i--) courant = dossier(`d${i}`, [courant])
  return courant as PoigneeDossier
}

beforeEach(() => vi.unstubAllGlobals())

describe('estUnFichierDeContenu', () => {
  it.each([
    ['s1-01.yaml', true],
    ['s12-34-expert.yaml', true],
    ['c2-comparer.yaml', true],
    // Les tables du chapitre commencent aussi par une lettre de contenu.
    ['chapitres.yaml', false],
    ['notions.yaml', false],
    ['s1-1.yaml', false],
    ['s0-01.yaml', false],
    ['c2-Comparer.yaml', false],
    ['s1-01.yml', false],
    ['s1-01.yaml.bak', false],
  ])('%s → %s', (nom, attendu) => {
    expect(estUnFichierDeContenu(nom)).toBe(attendu)
  })
})

describe('peutOuvrirUnDossier', () => {
  it('suit ce que le navigateur expose', () => {
    expect(peutOuvrirUnDossier()).toBe(false)
    vi.stubGlobal('showDirectoryPicker', vi.fn())
    expect(peutOuvrirUnDossier()).toBe(true)
  })
})

describe('choisirDossier', () => {
  it("demande la lecture ET l'écriture", async () => {
    // Sans l'écriture, chaque correction rouvrirait une fenêtre de choix.
    const racine = dossier('depot', [])
    const selecteur = vi.fn(async () => racine)
    vi.stubGlobal('showDirectoryPicker', selecteur)

    expect(await choisirDossier()).toBe(racine)
    expect(selecteur).toHaveBeenCalledWith({ mode: 'readwrite' })
  })

  it('rend null quand le professeur ferme la fenêtre', async () => {
    const abandon = new Error('fermé')
    abandon.name = 'AbortError'
    vi.stubGlobal('showDirectoryPicker', vi.fn(async () => { throw abandon }))

    expect(await choisirDossier()).toBeNull()
  })

  it('laisse passer les vraies pannes', async () => {
    vi.stubGlobal('showDirectoryPicker', vi.fn(async () => { throw new Error('refusé') }))

    await expect(choisirDossier()).rejects.toThrow('refusé')
  })
})

describe('listerFichiers', () => {
  it('trouve les exercices et les leçons, à toute profondeur raisonnable', async () => {
    const racine = dossier('coding-dojo2026', [
      dossier('plateforme', [
        dossier('contenu', [
          dossier('chapitre-1', [
            fichier('chapitres.yaml'),
            fichier('notions.yaml'),
            dossier('seance-10', [fichier('s10-01.yaml')]),
            dossier('seance-2', [
              fichier('s2-01-expert.yaml'),
              fichier('s2-01.yaml'),
              dossier('lecons', [fichier('c2-comparer.yaml')]),
            ]),
          ]),
        ]),
      ]),
    ])

    expect((await listerFichiers(racine)).map((f) => f.chemin)).toEqual([
      // La leçon d'abord, l'exercice avant sa variante experte, et la séance
      // 2 avant la séance 10 : l'ordre où on les lit dans le cours.
      'plateforme/contenu/chapitre-1/seance-2/lecons/c2-comparer.yaml',
      'plateforme/contenu/chapitre-1/seance-2/s2-01.yaml',
      'plateforme/contenu/chapitre-1/seance-2/s2-01-expert.yaml',
      'plateforme/contenu/chapitre-1/seance-10/s10-01.yaml',
    ])
  })

  it('garde la poignée de chaque fichier, pour le réécrire', async () => {
    const poignee = fichier('s1-01.yaml')
    const [trouve] = await listerFichiers(dossier('contenu', [poignee]))
    expect(trouve!.poignee).toBe(poignee)
  })

  it('ne descend ni dans les dossiers cachés ni dans les dépendances', async () => {
    // node_modules tout seul ferait patienter une minute.
    const racine = dossier('depot', [
      dossier('.git', [fichier('s1-01.yaml')]),
      dossier('.venv', [fichier('s1-02.yaml')]),
      dossier('node_modules', [fichier('s1-03.yaml')]),
      dossier('dist', [fichier('s1-04.yaml')]),
      dossier('public', [fichier('s1-05.yaml')]),
      dossier('coverage', [fichier('s1-06.yaml')]),
      dossier('__pycache__', [fichier('s1-07.yaml')]),
      dossier('htmlcov', [fichier('s1-08.yaml')]),
      fichier('.s1-09.yaml'),
      fichier('s1-10.yaml'),
    ])

    expect((await listerFichiers(racine)).map((f) => f.chemin)).toEqual(['s1-10.yaml'])
  })

  it("s'arrête à huit niveaux de dossiers", async () => {
    // Au-delà, ce n'est plus un dépôt de contenu : c'est le mauvais dossier.
    const racine = dossier('depot', [enfoui(8, fichier('s1-01.yaml')), enfoui(9, fichier('s1-02.yaml'))])

    expect((await listerFichiers(racine)).map((f) => f.poignee.name)).toEqual(['s1-01.yaml'])
  })
})

describe('cataloguer', () => {
  it('donne à chaque fichier son titre', async () => {
    const racine = dossier('contenu', [
      fichier('s3-07.yaml', 'id: s3-07\ntitre: La boucle qui compte mal\n'),
      fichier('c2-comparer.yaml', "id: c2-comparer\ntitre: 'Comparer : l''essentiel'\n"),
    ])

    expect(
      (await cataloguer(racine)).map(({ chemin, nom, titre }) => ({ chemin, nom, titre })),
    ).toEqual([
      { chemin: 'c2-comparer.yaml', nom: 'c2-comparer.yaml', titre: "Comparer : l'essentiel" },
      { chemin: 's3-07.yaml', nom: 's3-07.yaml', titre: 'La boucle qui compte mal' },
    ])
  })

  it("n'échoue pas en bloc pour un fichier qui ne se lit pas", async () => {
    const illisible = fichier('s1-02.yaml')
    illisible.getFile = async () => {
      throw new Error('déplacé')
    }
    const racine = dossier('contenu', [fichier('s1-01.yaml', 'titre: Afficher\n'), illisible])

    expect((await cataloguer(racine)).map((e) => e.titre)).toEqual(['Afficher', null])
  })
})

/** Un vrai dossier du disque, vu à travers des poignées — en lecture seule. */
function surLeDisque(chemin: string): PoigneeDossier {
  return {
    kind: 'directory',
    name: basename(chemin),
    values: async function* () {
      for (const entree of readdirSync(chemin, { withFileTypes: true })) {
        const complet = join(chemin, entree.name)
        if (entree.isDirectory()) yield surLeDisque(complet)
        else {
          yield {
            kind: 'file' as const,
            name: entree.name,
            getFile: async () => ({ text: async () => readFileSync(complet, 'utf-8') }),
            createWritable: async () => {
              throw new Error('lecture seule')
            },
          }
        }
      }
    },
  }
}

describe('cataloguer — sur le vrai dépôt', () => {
  const RACINE = join(__dirname, '..', '..', '..', '..')
  const CHAPITRE = join(RACINE, 'plateforme', 'contenu', 'chapitre-1')

  /** Ce que le corpus range, relevé à la main : les séances et leurs leçons. */
  function attendus(): string[] {
    const chemins: string[] = []
    for (const seance of readdirSync(CHAPITRE).filter((d) => d.startsWith('seance-'))) {
      for (const nom of readdirSync(join(CHAPITRE, seance))) {
        if (nom.endsWith('.yaml')) chemins.push(`${seance}/${nom}`)
      }
      for (const nom of readdirSync(join(CHAPITRE, seance, 'lecons'))) {
        chemins.push(`${seance}/lecons/${nom}`)
      }
    }
    return chemins.map((c) => `plateforme/contenu/chapitre-1/${c}`).sort()
  }

  it('trouve chaque exercice et chaque leçon depuis la racine, et rien d autre', async () => {
    // La racine, pas `contenu/` : c'est ce que le professeur choisira le plus
    // souvent, avec node_modules, .git et .venv sur le chemin.
    const catalogue = await cataloguer(surLeDisque(RACINE))

    expect(catalogue.map((e) => e.chemin).sort()).toEqual(attendus())
    expect(catalogue.length).toBeGreaterThanOrEqual(126)
  })

  it('lit le titre de chacun', async () => {
    const catalogue = await cataloguer(surLeDisque(join(RACINE, 'plateforme', 'contenu')))
    expect(catalogue.filter((e) => e.titre === null).map((e) => e.chemin)).toEqual([])
  })
})

describe('titreDe', () => {
  it('lit le titre', () => {
    expect(titreDe('id: s1-01\ntitre: Afficher un message\n')).toBe('Afficher un message')
  })

  it("rend null pour un YAML cassé, un fichier vide, ou un titre qui n'est pas du texte", () => {
    expect(titreDe('titre: "pas fermé\n')).toBeNull()
    expect(titreDe('')).toBeNull()
    expect(titreDe('titre: 42\n')).toBeNull()
    expect(titreDe('- une liste\n')).toBeNull()
  })
})

describe('lire et écrire un fichier', () => {
  it('lit le texte du fichier', async () => {
    expect(await lireFichier(fichier('s1-01.yaml', 'id: s1-01\n'))).toBe('id: s1-01\n')
  })

  it('écrit, puis ferme — sans fermeture, rien ne touche le disque', async () => {
    // La fausse poignée ne remplace son contenu qu'à la fermeture du flux.
    const poignee = fichier('s1-01.yaml', 'ancien')

    await ecrireFichier(poignee, 'nouveau')

    expect(poignee.ecrits).toEqual(['nouveau'])
    expect(await lireFichier(poignee)).toBe('nouveau')
  })
})
