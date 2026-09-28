import { describe, expect, it, vi } from 'vitest'
import { eprouverLecon } from '../../src/atelier/controles'
import { leconEnYaml } from '../../src/atelier/yaml'
import {
  blocNeuf,
  champsManquantsLecon,
  LECON_VIDE,
  versLecon,
  type BrouillonLecon,
} from '../../src/atelier/lecon'
import type { Executeur } from '../../src/execution/executeur'
import type { ResultatExecution } from '../../src/execution/types'
import type { Notion } from '../../src/contenu/types'

const NOTIONS: Notion[] = [
  { id: 'comparer', ordre: 7, titre: 'Comparer', famille: 'types', chapitre: 'decisions' },
]

function executeur(parCode: Record<string, Partial<ResultatExecution>> = {}): Executeur {
  return {
    executer: async ({ code }: { code: string }): Promise<ResultatExecution> => ({
      stdout: '',
      erreur: null,
      variables: {},
      dureeMs: 1,
      timeout: false,
      ...(parCode[code] ?? {}),
    }),
    detruire: vi.fn(),
  } as unknown as Executeur
}

const COMPLETE: BrouillonLecon = {
  ...LECON_VIDE,
  id: 'c2-comparer',
  notion: 'comparer',
  titre: 'Comparer',
  blocs: [{ type: 'paragraphe', texte: 'Un paragraphe.' }],
}

describe('champsManquantsLecon', () => {
  it('ne réclame rien sur une leçon complète', () => {
    expect(champsManquantsLecon(COMPLETE)).toEqual([])
  })

  it('réclame tout sur une leçon vide, dans l ordre du formulaire', () => {
    expect(champsManquantsLecon(LECON_VIDE)).toEqual([
      'un identifiant bien formé',
      'une notion',
      'un titre',
      'au moins un bloc',
    ])
  })

  it.each(['c0-variables', 'c01-variables', 'c1-Variables', 's1-01', 'c1-'])(
    'refuse l identifiant %j',
    (id) => {
      expect(champsManquantsLecon({ ...COMPLETE, id })).toContain('un identifiant bien formé')
    },
  )

  it('accepte une leçon de la séance 12', () => {
    expect(champsManquantsLecon({ ...COMPLETE, id: 'c12-boucles' })).toEqual([])
  })

  it('réclame un titre fait d espaces', () => {
    expect(champsManquantsLecon({ ...COMPLETE, titre: '  ' })).toEqual(['un titre'])
  })
})

describe('versLecon', () => {
  it("prend l'ordre et la famille de sa notion", () => {
    // L'ordre décide quelles notions les exemples ont le droit d'employer.
    const lecon = versLecon(COMPLETE, NOTIONS)
    expect(lecon.ordre).toBe(7)
    expect(lecon.famille).toBe('types')
  })

  it("retombe sur des valeurs sûres tant qu'aucune notion n'est choisie", () => {
    const lecon = versLecon({ ...COMPLETE, notion: '' }, NOTIONS)
    expect(lecon.ordre).toBe(1)
    expect(lecon.famille).toBe('variables')
  })
})

describe('blocNeuf', () => {
  it('donne à un bloc de code tous ses champs', () => {
    expect(blocNeuf('code')).toEqual({
      type: 'code',
      legende: '',
      python: '',
      executable: false,
      entrees: [],
    })
  })

  it.each(['paragraphe', 'attention'] as const)('donne un texte vide à un bloc %s', (sorte) => {
    expect(blocNeuf(sorte)).toEqual({ type: sorte, texte: '' })
  })
})

describe('eprouverLecon', () => {
  function avecBlocs(blocs: BrouillonLecon['blocs']): BrouillonLecon {
    return { ...COMPLETE, blocs }
  }

  it('rend vert un exemple qui tourne, et montre sa sortie', async () => {
    const essais = await eprouverLecon(
      avecBlocs([
        {
          type: 'code',
          legende: 'Dire bonjour',
          python: 'print("Bonjour")',
          executable: true,
          entrees: [],
        },
      ]),
      executeur({ 'print("Bonjour")': { stdout: 'Bonjour\n' } }),
    )
    expect(essais[0]).toEqual({
      titre: "L'exemple « Dire bonjour » tourne",
      verdict: 'vert',
      detail: 'Bonjour\n',
    })
  })

  it('ne montre aucun détail quand un exemple n affiche rien', () => {
    return expect(
      eprouverLecon(
        avecBlocs([
          { type: 'code', legende: 'Muet', python: 'x = 1', executable: true, entrees: [] },
        ]),
        executeur(),
      ),
    ).resolves.toEqual([{ titre: "L'exemple « Muet » tourne", verdict: 'vert', detail: undefined }])
  })

  it("nomme l'erreur d'un exemple qui plante", async () => {
    // Un exemple qui plante, c'est une leçon qui ne marche pas au tableau.
    const essais = await eprouverLecon(
      avecBlocs([
        { type: 'code', legende: 'Cassé', python: 'print(x)', executable: true, entrees: [] },
      ]),
      executeur({
        'print(x)': { erreur: { type: 'NameError', message: "x n'existe pas", ligne: 1 } },
      }),
    )
    expect(essais[0]?.verdict).toBe('rouge')
    expect(essais[0]?.detail).toMatch(/NameError/)
  })

  it('signale un exemple qui tourne en rond', async () => {
    const essais = await eprouverLecon(
      avecBlocs([
        {
          type: 'code',
          legende: 'Boucle',
          python: 'while True:\n    pass',
          executable: false,
          entrees: [],
        },
      ]),
      executeur({ 'while True:\n    pass': { timeout: true } }),
    )
    expect(essais[0]?.verdict).toBe('rouge')
    expect(essais[0]?.detail).toMatch(/ne s’arrête pas/)
  })

  it('fournit les entrées simulées du bloc', async () => {
    const espion = vi.fn(async () => ({
      stdout: '',
      erreur: null,
      variables: {},
      dureeMs: 1,
      timeout: false,
    }))
    await eprouverLecon(
      avecBlocs([
        {
          type: 'code',
          legende: 'Question',
          python: 'input()',
          executable: false,
          entrees: ['Camille'],
        },
      ]),
      { executer: espion, detruire: vi.fn() } as unknown as Executeur,
    )
    expect(espion).toHaveBeenCalledWith(expect.objectContaining({ entrees: ['Camille'] }))
  })

  it('numérote un bloc sans légende par son rang', async () => {
    const essais = await eprouverLecon(
      avecBlocs([
        { type: 'paragraphe', texte: 'Avant.' },
        { type: 'code', legende: '', python: 'pass', executable: false, entrees: [] },
      ]),
      executeur(),
    )
    expect(essais[0]?.titre).toMatch(/bloc 2/)
  })

  it("le dit quand il n'y a aucun exemple à éprouver", async () => {
    await expect(eprouverLecon(COMPLETE, executeur())).resolves.toEqual([
      { titre: 'Aucun exemple de code à éprouver', verdict: 'vert' },
    ])
  })
})

describe('leconEnYaml — un texte à plusieurs paragraphes', () => {
  it('garde la ligne vide qui les sépare', () => {
    // Dans un scalaire replié, c'est la ligne vide qui marque le saut de
    // paragraphe : la perdre collerait les deux en un seul pavé.
    const sortie = leconEnYaml(
      {
        id: 'c2-comparer',
        notion: 'comparer',
        titre: 'Comparer',
        dureeMin: 4,
        blocs: [{ type: 'paragraphe', texte: 'Avant.\n\nAprès.' }],
      },
      7,
    )
    expect(sortie).toContain('texte: >-\n      Avant.\n\n      Après.\n')
  })
})
