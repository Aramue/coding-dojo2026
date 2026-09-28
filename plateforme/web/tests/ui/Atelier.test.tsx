import { EditorView } from '@codemirror/view'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Atelier } from '../../src/ui/Atelier'
import type { Executeur } from '../../src/execution/executeur'
import type { ResultatExecution } from '../../src/execution/types'

const CHAPITRES = [{ id: 'decisions', ordre: 2, titre: 'Décider', seance: 2 }]
const NOTIONS = [
  { id: 'comparer', ordre: 7, titre: 'Comparer', famille: 'types', chapitre: 'decisions' },
]
const SCHEMA = {
  exercice: {
    properties: {
      type: { enum: ['predire', 'debug', 'completer', 'ecrire'] },
      niveau: { enum: ['normal', 'expert'] },
    },
  },
  lecon: {},
}

/** Le réseau de l'atelier : le contenu publié et le schéma, rien d'autre. */
function poserLeReseau(options: { schemaCasse?: boolean } = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('schema.json')) {
        if (options.schemaCasse) return { ok: false, status: 404, json: async () => ({}) }
        return { ok: true, json: async () => SCHEMA }
      }
      return {
        ok: true,
        json: async () => {
          if (url.includes('chapitres')) return CHAPITRES
          if (url.includes('notions')) return NOTIONS
          return []
        },
      }
    }),
  )
}

function executeurQuiRend(stdout: string, surcharge: Partial<ResultatExecution> = {}): Executeur {
  return {
    executer: vi.fn(
      async (): Promise<ResultatExecution> => ({
        stdout,
        erreur: null,
        variables: {},
        dureeMs: 2,
        timeout: false,
        ...surcharge,
      }),
    ),
    detruire: vi.fn(),
  } as unknown as Executeur
}

/** Remplit l'identité, l'énoncé et la solution d'un exercice complet. */
async function composer() {
  fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 's2-14' } })
  fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Comparer' } })
  fireEvent.change(screen.getByLabelText('Concept'), { target: { value: 'booleens' } })
  fireEvent.change(screen.getByLabelText('Notion'), { target: { value: 'comparer' } })
  fireEvent.change(screen.getByLabelText('Énoncé'), { target: { value: 'Compare 3 et 5.' } })

  // La solution vit dans un éditeur CodeMirror : on la pose par son API,
  // comme le fait tests/ui/Editeur.test.tsx.
  const cadres = document.querySelectorAll('.atelier .cm-editor')
  const solution = EditorView.findFromDOM(cadres[1] as HTMLElement)!
  solution.dispatch({ changes: { from: 0, insert: 'print(3 < 5)' } })

  await userEvent.click(screen.getByRole('button', { name: '+ Sortie' }))
}

beforeEach(() => vi.unstubAllGlobals())

describe("Atelier — ce qu'il faut avant de commencer", () => {
  it('attend le schéma publié', async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    expect(screen.getByText(/Chargement du schéma/)).toBeInTheDocument()
    expect(await screen.findByLabelText('Identifiant')).toBeInTheDocument()
  })

  it('dit quoi faire quand le schéma manque, au lieu de rester à charger', async () => {
    // Un contenu jamais reconstruit depuis l'ajout de schema.json : le message
    // doit nommer le remède.
    poserLeReseau({ schemaCasse: true })
    render(<Atelier executeur={executeurQuiRend('')} />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/reconstruis le contenu/)
  })
})

describe("Atelier — l'aperçu est l'écran de l'élève", () => {
  it("montre le titre et l'énoncé pendant qu'on les tape", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    // Dans l'aperçu, pas dans le champ de saisie : les deux portent le texte.
    const apercu = document.querySelector('.atelier__apercu') as HTMLElement
    expect(within(apercu).getByRole('heading', { name: 'Comparer' })).toBeInTheDocument()
    expect(within(apercu).getByText('Compare 3 et 5.')).toBeInTheDocument()
  })

  it("n'affiche pas les essais en même temps que l'aperçu", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    expect(screen.queryByRole('button', { name: /Lancer les essais/ })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))
    expect(screen.queryByRole('heading', { name: 'Comparer' })).toBeNull()
  })

  it("porte un nom distinct des deux autres barres d'onglets de la page", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Aperçu et essais')
  })
})

describe("Atelier — l'attendu se calcule", () => {
  it('exécute la solution et écrit sa sortie', async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    await userEvent.click(screen.getByRole('button', { name: /Remplir depuis la solution/ }))

    await waitFor(() => expect(screen.getByLabelText('Attendu')).toHaveValue('True\n'))
  })

  it("dit pourquoi il ne peut rien écrire quand la solution plante", async () => {
    poserLeReseau()
    const executeur = executeurQuiRend('', {
      erreur: { type: 'NameError', message: 'x', ligne: 1 },
    })
    render(<Atelier executeur={executeur} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    await userEvent.click(screen.getByRole('button', { name: /Remplir depuis la solution/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/NameError/)
  })
})

describe('Atelier — les essais', () => {
  it("réclame les champs qui manquent avant d'éprouver quoi que ce soit", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))

    expect(screen.getByText(/Il manque un identifiant bien formé/)).toBeInTheDocument()
  })

  it('les lance et rend son verdict', async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()
    // Un attendu qui correspond : l'exercice doit passer au vert.
    await userEvent.click(screen.getByRole('button', { name: /Remplir depuis la solution/ }))
    await waitFor(() => expect(screen.getByLabelText('Attendu')).toHaveValue('True\n'))

    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))
    await userEvent.click(screen.getByRole('button', { name: /Lancer les essais/ }))

    expect(await screen.findByText('La solution passe tous ses tests')).toBeInTheDocument()
    expect(screen.getByText('Les motifs interdits tiennent')).toBeInTheDocument()
  })

  it("dit que la construction reste le juge", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()
    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))
    await userEvent.click(screen.getByRole('button', { name: /Lancer les essais/ }))

    expect(await screen.findByText(/la construction tranche/)).toBeInTheDocument()
  })

  it('oublie les essais dès que le brouillon change', async () => {
    // Les garder affichés ferait croire à un exercice éprouvé qu'on vient de
    // modifier.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()
    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))
    await userEvent.click(screen.getByRole('button', { name: /Lancer les essais/ }))
    await screen.findByText('Les motifs interdits tiennent')

    await userEvent.click(screen.getByRole('tab', { name: 'Aperçu' }))
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Autre' } })
    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))

    expect(screen.queryByText('Les motifs interdits tiennent')).toBeNull()
  })
})

describe('Atelier — la sortie du fichier', () => {
  it("refuse l'export tant qu'un champ requis manque, et dit lesquels", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    expect(screen.getByRole('button', { name: /Télécharger le fichier/ })).toBeDisabled()
    expect(screen.getByText(/À compléter d'abord : un identifiant bien formé/)).toBeInTheDocument()
  })

  it('télécharge le fichier quand tout est là', async () => {
    poserLeReseau()
    const creer = vi.fn(() => 'blob:essai')
    vi.stubGlobal('URL', { createObjectURL: creer, revokeObjectURL: vi.fn() })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    await userEvent.click(screen.getByRole('button', { name: /Télécharger le fichier/ }))

    expect(creer).toHaveBeenCalledOnce()
    expect(clic).toHaveBeenCalledOnce()
    clic.mockRestore()
  })

  it("enregistre en place quand le navigateur le sait, et propose le bon nom", async () => {
    poserLeReseau()
    const ecrit: string[] = []
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => ({
        createWritable: async () => ({
          write: async (t: string) => void ecrit.push(t),
          close: vi.fn(),
        }),
      })),
    )
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le fichier/ }))

    await waitFor(() => expect(ecrit).toHaveLength(1))
    expect(ecrit[0]).toContain('id: s2-14')
    expect(ecrit[0]).toContain('notion: comparer')
  })

  it("retombe sur le téléchargement quand l'enregistrement en place échoue", async () => {
    // Un disque plein ou un dossier refusé : le professeur ne doit pas perdre
    // son exercice pour autant.
    poserLeReseau()
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => { throw new Error('disque plein') }))
    const creer = vi.fn(() => 'blob:essai')
    vi.stubGlobal('URL', { createObjectURL: creer, revokeObjectURL: vi.fn() })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le fichier/ }))

    await waitFor(() => expect(creer).toHaveBeenCalledOnce())
    clic.mockRestore()
  })
})

describe("Atelier — démonté pendant le chargement du schéma", () => {
  function reseauLent(reponse: () => unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('schema.json')) {
          await new Promise((r) => setTimeout(r, 15))
          return reponse()
        }
        return { ok: true, json: async () => (url.includes('notions') ? NOTIONS : []) }
      }),
    )
  }

  it("n'écrit plus dans l'état d'un atelier déjà fermé", async () => {
    reseauLent(() => ({ ok: true, json: async () => SCHEMA }))
    const { unmount } = render(<Atelier executeur={executeurQuiRend('')} />)
    unmount()
    await new Promise((r) => setTimeout(r, 40))
  })

  it("ne signale pas un schéma manquant après la fermeture", async () => {
    reseauLent(() => ({ ok: false, status: 404, json: async () => ({}) }))
    const { unmount } = render(<Atelier executeur={executeurQuiRend('')} />)
    unmount()
    await new Promise((r) => setTimeout(r, 40))
  })
})

describe('Atelier — les cas de repli', () => {
  it("ne remplit que l'attendu du test visé", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()
    // Une seconde carte, d'un autre type : elle ne doit pas bouger.
    await userEvent.click(screen.getByRole('button', { name: '+ Interdit' }))
    fireEvent.change(screen.getByLabelText('Motif'), { target: { value: 'xyzzy' } })

    await userEvent.click(screen.getByRole('button', { name: /Remplir depuis la solution/ }))

    await waitFor(() => expect(screen.getByLabelText('Attendu')).toHaveValue('True\n'))
    expect(screen.getByLabelText('Motif')).toHaveValue('xyzzy')
  })

  it("replie sur un message générique quand ce qui est lancé n'est pas une Error", async () => {
    poserLeReseau()
    const executeur = {
      executer: vi.fn(async () => {
        throw 'coupure'
      }),
      detruire: vi.fn(),
    } as unknown as Executeur
    render(<Atelier executeur={executeur} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    await userEvent.click(screen.getByRole('button', { name: /Remplir depuis la solution/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Remplissage impossible.')
  })

  it("éprouve sans notions quand le contenu n'en donne aucune", async () => {
    // L'aperçu perd sa couleur, les essais fonctionnent quand même.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('schema.json')) return { ok: true, json: async () => SCHEMA }
        return { ok: true, json: async () => [] }
      }),
    )
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 's2-14' } })
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Comparer' } })
    fireEvent.change(screen.getByLabelText('Concept'), { target: { value: 'booleens' } })
    fireEvent.change(screen.getByLabelText('Énoncé'), { target: { value: 'Compare.' } })
    const cadres = document.querySelectorAll('.atelier .cm-editor')
    EditorView.findFromDOM(cadres[1] as HTMLElement)!.dispatch({
      changes: { from: 0, insert: 'print(3 < 5)' },
    })
    await userEvent.click(screen.getByRole('button', { name: '+ Interdit' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))

    // Sans notion, le champ requis manque : c'est ce que l'atelier doit dire.
    expect(screen.getByText(/Il manque une notion/)).toBeInTheDocument()
  })

  it("avale la tentative faite dans l'aperçu", async () => {
    // Le professeur peut résoudre son propre exercice pour le vérifier : rien
    // ne doit partir vers la séance de la classe.
    poserLeReseau()
    const appels: string[] = []
    render(<Atelier executeur={executeurQuiRend('True\n')} />)
    await screen.findByLabelText('Identifiant')
    await composer()

    await userEvent.click(within(document.querySelector('.atelier__apercu') as HTMLElement).getByRole('button', { name: 'Valider' }))

    // Le verdict s'affiche — donc `onTentative` a bien été appelé — et rien
    // n'est parti sur le réseau.
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
    expect(appels).toEqual([])
  })
})

const FICHIER = `id: s3-07
concept: boucles
notion: comparer
seance: 3
niveau: normal
type: debug
titre: La boucle qui compte mal
obligatoire: true
enonce: |
  Répare la boucle.
depart: |
  for i in range(3):
indices:
  - Regarde la borne.
tests:
  - type: interdit
    motif: xyzzy
solution: |
  for i in range(4):
`

/** Un lâcher de fichiers, tel que le navigateur le produit. */
function lacher(contenus: { nom: string; texte: string }[]) {
  const fichiers = contenus.map(({ nom, texte }) => new File([texte], nom, { type: 'text/yaml' }))
  fireEvent.drop(screen.getByLabelText('Fichiers ouverts'), { dataTransfer: { files: fichiers } })
}

describe("Atelier — reprendre un exercice déjà écrit", () => {
  it('charge un fichier déposé dans le formulaire', async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    lacher([{ nom: 's3-07.yaml', texte: FICHIER }])

    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
    expect(screen.getByLabelText('Titre')).toHaveValue('La boucle qui compte mal')
    expect(screen.getByText("Séance 3, déduite de l'identifiant.")).toBeInTheDocument()
    expect(screen.getByLabelText('Motif')).toHaveValue('xyzzy')
  })

  it('garde les modifications de chaque fichier en passant de l un à l autre', async () => {
    // Deux exercices ouverts, deux états distincts : revenir au premier doit
    // retrouver ce qu'on y avait tapé.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    lacher([
      { nom: 's3-07.yaml', texte: FICHIER },
      { nom: 's3-08.yaml', texte: FICHIER.replace('s3-07', 's3-08') },
    ])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))

    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Titre retouché' } })
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir s3-08.yaml' }))
    expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-08')

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' }))
    expect(screen.getByLabelText('Titre')).toHaveValue('Titre retouché')
  })

  it('charge les fichiers valides même quand un autre est refusé', async () => {
    // Déposer une séance entière ne doit pas échouer en bloc pour un fichier
    // de travers.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    lacher([
      { nom: 'casse.yaml', texte: 'titre: "pas fermé\n' },
      { nom: 's3-07.yaml', texte: FICHIER },
    ])

    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
    expect(screen.getByText(/YAML valide/)).toBeInTheDocument()
  })

  it("prévient qu'un fichier commenté perdra ses commentaires", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    lacher([{ nom: 's3-07.yaml', texte: '# Pourquoi cet exercice existe\n' + FICHIER }])

    expect(await screen.findByText(/l'export ne les rendra pas/)).toBeInTheDocument()
  })

  it("laisse le formulaire tranquille quand tous les fichiers sont refusés", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'En cours' } })

    lacher([{ nom: 'casse.yaml', texte: 'titre: "pas fermé\n' }])

    await screen.findByText(/YAML valide/)
    expect(screen.getByLabelText('Titre')).toHaveValue('En cours')
  })

  it('retire un fichier du rail', async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    lacher([{ nom: 's3-07.yaml', texte: FICHIER }])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))

    await userEvent.click(screen.getByRole('button', { name: 'Retirer s3-07.yaml' }))

    expect(screen.getByText(/Dépose ici un ou plusieurs fichiers/)).toBeInTheDocument()
  })

  it("réexporte un fichier repris sans en changer le sens", async () => {
    poserLeReseau()
    const ecrit: string[] = []
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn(async () => ({
        createWritable: async () => ({
          write: async (t: string) => void ecrit.push(t),
          close: vi.fn(),
        }),
      })),
    )
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    lacher([{ nom: 's3-07.yaml', texte: FICHIER }])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le fichier/ }))

    await waitFor(() => expect(ecrit).toHaveLength(1))
    expect(ecrit[0]).toBe(FICHIER)
  })
})

describe('Atelier — le rail, cas de bord', () => {
  it("dit « fichier illisible » quand la lecture elle-même échoue", async () => {
    // Un fichier que le navigateur ne sait pas lire — support retiré en
    // pleine lecture, par exemple. Ce n'est pas un refus de schéma.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    const casse = new File([''], 'illisible.yaml')
    Object.defineProperty(casse, 'text', {
      value: () => Promise.reject(new Error('support retiré')),
    })
    fireEvent.drop(screen.getByLabelText('Fichiers ouverts'), {
      dataTransfer: { files: [casse] },
    })

    expect(await screen.findByText('fichier illisible.')).toBeInTheDocument()
  })

  it("garde le fichier courant quand on en retire un autre", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    lacher([
      { nom: 's3-07.yaml', texte: FICHIER },
      { nom: 's3-08.yaml', texte: FICHIER.replace('s3-07', 's3-08') },
    ])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))

    await userEvent.click(screen.getByRole('button', { name: 'Retirer s3-08.yaml' }))

    expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07')
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})
