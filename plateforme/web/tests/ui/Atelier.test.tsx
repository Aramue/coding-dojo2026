import { EditorView } from '@codemirror/view'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Atelier } from '../../src/ui/Atelier'
import type { Executeur } from '../../src/execution/executeur'
import type { ResultatExecution } from '../../src/execution/types'
import { dossier, fichier, type FauxFichier } from '../atelier/poignees'

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

  it('garde les modifications dans le bon fichier quand on retire celui qui le précède', async () => {
    // Le rail désignait le fichier courant par son rang : retirer le premier
    // faisait pointer le courant dans le vide, et les modifications suivantes
    // n'allaient plus nulle part — ou dans le fichier ouvert ensuite.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    lacher([
      { nom: 's3-07.yaml', texte: FICHIER },
      { nom: 's3-08.yaml', texte: FICHIER.replace('s3-07', 's3-08') },
    ])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir s3-08.yaml' }))

    await userEvent.click(screen.getByRole('button', { name: 'Retirer s3-07.yaml' }))
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Retouché' } })

    const courant = screen.getByRole('button', { name: 'Ouvrir s3-08.yaml' })
    expect(courant).toHaveAttribute('aria-current', 'true')
    expect(courant).toHaveAccessibleDescription('modifié')
  })

  it("dit « fichier illisible » pour un fichier qui ne suit pas le modèle", async () => {
    // `tests: 3` passe le YAML mais pas la lecture : ce n'est pas un refus de
    // schéma nommé, et le fichier doit rester marqué quand même.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    lacher([
      {
        nom: 's3-07.yaml',
        texte: FICHIER.replace('tests:\n  - type: interdit\n    motif: xyzzy\n', 'tests: 3\n'),
      },
    ])

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

const LECON = `id: c2-comparer
notion: comparer
ordre: 7
titre: Comparer
duree_min: 4
blocs:
  - type: paragraphe
    texte: >-
      Une comparaison pose une question à Python.
  - type: code
    legende: Deux questions
    executable: true
    python: |
      print(12 > 7)
`

describe("Atelier — écrire une leçon", () => {
  async function passerEnLecon() {
    await userEvent.click(screen.getByRole('radio', { name: 'Une leçon' }))
  }

  it('bascule du formulaire d exercice à celui de leçon', async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    expect(screen.getByLabelText('Type')).toBeInTheDocument()

    await passerEnLecon()

    expect(screen.queryByLabelText('Type')).toBeNull()
    expect(screen.getByLabelText(/Durée de lecture/)).toBeInTheDocument()
  })

  it("monte l'écran de cours de l'élève dans l'aperçu", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    await passerEnLecon()

    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'c2-comparer' } })
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Comparer' } })
    fireEvent.change(screen.getByLabelText('Notion'), { target: { value: 'comparer' } })
    await userEvent.click(screen.getByRole('button', { name: '+ Paragraphe' }))
    fireEvent.change(screen.getByLabelText('Texte'), { target: { value: 'Une comparaison.' } })

    const apercu = document.querySelector('.atelier__apercu') as HTMLElement
    expect(within(apercu).getByRole('heading', { name: 'Comparer' })).toBeInTheDocument()
    expect(within(apercu).getByText('Une comparaison.')).toBeInTheDocument()
  })

  it("réclame ce qui manque avant d'exporter une leçon", async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    await passerEnLecon()

    expect(screen.getByText(/À compléter d'abord : un identifiant bien formé/)).toBeInTheDocument()
    expect(screen.getByText(/au moins un bloc/)).toBeInTheDocument()
  })

  it('éprouve les exemples de code de la leçon', async () => {
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('19\n')} />)
    await screen.findByLabelText('Identifiant')
    await passerEnLecon()
    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 'c2-comparer' } })
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Comparer' } })
    fireEvent.change(screen.getByLabelText('Notion'), { target: { value: 'comparer' } })
    await userEvent.click(screen.getByRole('button', { name: '+ Code' }))
    fireEvent.change(screen.getByLabelText('Légende'), { target: { value: 'Additionner' } })

    await userEvent.click(screen.getByRole('tab', { name: 'Essais' }))
    await userEvent.click(screen.getByRole('button', { name: /Lancer les essais/ }))

    expect(await screen.findByText("L'exemple « Additionner » tourne")).toBeInTheDocument()
  })

  it("charge une leçon déposée, et bascule dessus tout seul", async () => {
    // Le nom du fichier annonce la sorte : `c…` pour une leçon.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')

    lacher([{ nom: 'c2-comparer.yaml', texte: LECON }])

    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('c2-comparer'))
    expect(screen.getByRole('radio', { name: 'Une leçon' })).toBeChecked()
    expect(screen.getByLabelText(/Durée de lecture/)).toHaveValue(4)
    expect(screen.getByLabelText('Légende')).toHaveValue('Deux questions')
  })

  it("réexporte une leçon reprise sans en changer le sens", async () => {
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
    lacher([{ nom: 'c2-comparer.yaml', texte: LECON }])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('c2-comparer'))

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le fichier/ }))

    await waitFor(() => expect(ecrit).toHaveLength(1))
    expect(ecrit[0]).toContain('ordre: 7')
    expect(ecrit[0]).toContain('duree_min: 4')
    expect(ecrit[0]).toContain('texte: >-')
  })

  it("quitte le fichier ouvert en changeant de sorte", async () => {
    // Garder le fichier courant enregistrerait une leçon dans un exercice.
    poserLeReseau()
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    lacher([{ nom: 's3-07.yaml', texte: FICHIER }])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))

    await passerEnLecon()
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Une leçon' } })

    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' }))
    expect(screen.getByLabelText('Titre')).toHaveValue('La boucle qui compte mal')
  })

  it("exporte une leçon dont la notion n'est pas encore publiée", async () => {
    // On peut écrire la leçon d'une notion du chapitre 2 avant que la table
    // ne la déclare. L'ordre retombe alors sur 1, et la construction
    // tranchera.
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
    lacher([
      { nom: 'c4-inconnue.yaml', texte: LECON.replace('notion: comparer', 'notion: fantome') },
    ])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('c2-comparer'))

    await userEvent.click(screen.getByRole('button', { name: /Enregistrer le fichier/ }))

    await waitFor(() => expect(ecrit).toHaveLength(1))
    expect(ecrit[0]).toContain('ordre: 1')
  })
})

describe("Atelier — le marqueur « modifié » hors du dépôt", () => {
  async function deposerDeuxEtRetoucher() {
    render(<Atelier executeur={executeurQuiRend('')} />)
    await screen.findByLabelText('Identifiant')
    lacher([
      { nom: 's3-07.yaml', texte: FICHIER },
      { nom: 's3-08.yaml', texte: FICHIER.replace('s3-07', 's3-08') },
    ])
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Retouché' } })
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveAccessibleDescription(
      'modifié',
    )
  }

  it("s'efface une fois le fichier enregistré", async () => {
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
    await deposerDeuxEtRetoucher()

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le fichier' }))

    await waitFor(() => expect(ecrit).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).not.toHaveAttribute(
      'aria-describedby',
    )
  })

  it("reste quand on referme la fenêtre d'enregistrement", async () => {
    poserLeReseau()
    const abandon = new Error('fermé')
    abandon.name = 'AbortError'
    const selecteur = vi.fn(async () => {
      throw abandon
    })
    vi.stubGlobal('showSaveFilePicker', selecteur)
    await deposerDeuxEtRetoucher()

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le fichier' }))

    await waitFor(() => expect(selecteur).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveAccessibleDescription(
      'modifié',
    )
  })

  it("s'efface une fois le fichier téléchargé", async () => {
    poserLeReseau()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:essai'), revokeObjectURL: vi.fn() })
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await deposerDeuxEtRetoucher()

    await userEvent.click(screen.getByRole('button', { name: 'Télécharger le fichier' }))

    expect(clic).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).not.toHaveAttribute(
      'aria-describedby',
    )
    clic.mockRestore()
  })
})

describe("Atelier — corriger depuis le dossier du dépôt", () => {
  const CHEMIN = 'chapitre-1/seance-3/s3-07.yaml'

  /** Le dossier `contenu/` tel que le dépôt le range : par séance. */
  function poserLeDepot(...fichiers: FauxFichier[]) {
    const racine = dossier('contenu', [
      dossier('chapitre-1', [
        dossier('seance-2', [dossier('lecons', fichiers.filter((f) => f.name.startsWith('c')))]),
        dossier('seance-3', fichiers.filter((f) => f.name.startsWith('s'))),
      ]),
    ])
    const selecteur = vi.fn(async () => racine)
    vi.stubGlobal('showDirectoryPicker', selecteur)
    return selecteur
  }

  async function monterEtOuvrir(...fichiers: FauxFichier[]) {
    poserLeReseau()
    poserLeDepot(...fichiers)
    render(<Atelier executeur={executeurQuiRend('')} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Ouvrir le dossier du dépôt' }))
    await screen.findByRole('button', { name: 'Changer de dossier' })
  }

  function catalogue() {
    return within(screen.getByRole('region', { name: 'Dépôt' }))
  }

  async function reprendre(id: string) {
    await userEvent.click(catalogue().getByRole('button', { name: new RegExp(`^${id} `) }))
  }

  async function reprendreS307(s307: FauxFichier, ...autres: FauxFichier[]) {
    await monterEtOuvrir(s307, ...autres)
    await reprendre('s3-07')
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
  }

  function enregistrer() {
    return userEvent.click(screen.getByRole('button', { name: 'Enregistrer dans le dépôt' }))
  }

  it("liste les exercices et les leçons du dépôt, avec leurs titres", async () => {
    await monterEtOuvrir(fichier('s3-07.yaml', FICHIER), fichier('c2-comparer.yaml', LECON))

    expect(screen.getByRole('region', { name: 'Dépôt' })).toHaveTextContent('contenu — 2 fichiers')
    expect(
      catalogue().getByRole('button', { name: 's3-07 La boucle qui compte mal' }),
    ).toBeInTheDocument()
    expect(catalogue().getByRole('button', { name: 'c2-comparer Comparer' })).toBeInTheDocument()
  })

  it('reprend un exercice entier, solution comprise', async () => {
    // Les solutions ne sont jamais publiées : seul le dépôt peut la rendre.
    await reprendreS307(fichier('s3-07.yaml', FICHIER))

    const solution = document.querySelectorAll('.atelier .cm-editor')[1]!
    expect(solution.textContent).toContain('for i in range(4):')
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByText(/à sa place/)).toHaveTextContent(`Réécrit ${CHEMIN}, à sa place.`)
  })

  it("prévient quand la mise en page d'origine va changer, puis cesse une fois réécrit", async () => {
    // Un titre entre guillemets qui n'en a pas besoin : l'atelier les retire.
    // Même sens, mais le diff dépassera la correction.
    const s307 = fichier(
      's3-07.yaml',
      FICHIER.replace('titre: La boucle qui compte mal', 'titre: "La boucle qui compte mal"'),
    )
    await reprendreS307(s307)
    const note = screen.getByText(/à sa place/)
    expect(note).toHaveTextContent("Il n'est pas écrit dans la mise en page de l'atelier")

    await enregistrer()

    await waitFor(() => expect(s307.ecrits).toEqual([FICHIER]))
    expect(screen.getByText(/à sa place/)).not.toHaveTextContent(/mise en page/)
  })

  it("ne le dit pas d'un fichier déjà écrit comme l'atelier l'écrit", async () => {
    await reprendreS307(fichier('s3-07.yaml', FICHIER))
    expect(screen.getByText(/à sa place/)).not.toHaveTextContent(/mise en page/)
  })

  it("n'est pas marqué modifié tant qu'on n'a rien changé", async () => {
    await reprendreS307(fichier('s3-07.yaml', FICHIER))
    expect(screen.queryByText('modifié')).toBeNull()
  })

  it('réécrit le fichier à sa place, sans passer par une fenêtre de choix', async () => {
    const s307 = fichier('s3-07.yaml', FICHIER)
    const selecteurDeFichier = vi.fn()
    vi.stubGlobal('showSaveFilePicker', selecteurDeFichier)
    // Un second fichier ouvert, qui ne doit pas bouger.
    await monterEtOuvrir(s307, fichier('s3-08.yaml', FICHIER.replace('s3-07', 's3-08')))
    await reprendre('s3-08')
    await reprendre('s3-07')
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'La boucle corrigée' } })
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveAccessibleDescription(
      'modifié',
    )

    await enregistrer()

    const confirme = await screen.findByText(`Enregistré dans ${CHEMIN}.`)
    expect(confirme).toHaveAttribute('role', 'status')
    expect(s307.ecrits).toEqual([
      FICHIER.replace('La boucle qui compte mal', 'La boucle corrigée'),
    ])
    expect(selecteurDeFichier).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).not.toHaveAttribute(
      'aria-describedby',
    )
  })

  it("demande avant d'effacer des commentaires, et réécrit une fois confirmé", async () => {
    const s307 = fichier('s3-07.yaml', '# Pourquoi cet exercice existe\n' + FICHIER)
    await reprendreS307(s307)

    await enregistrer()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce fichier porte des commentaires : l'enregistrer les efface.",
    )
    expect(s307.ecrits).toEqual([])

    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer quand même' }))

    await waitFor(() => expect(s307.ecrits).toEqual([FICHIER]))
    expect(screen.queryByRole('button', { name: 'Enregistrer quand même' })).toBeNull()
    // Les commentaires sont partis avec la réécriture : le rail cesse de les
    // annoncer, et la fois suivante n'a plus rien à confirmer.
    expect(screen.queryByText(/l'export ne les rendra pas/)).toBeNull()
    await enregistrer()
    await waitFor(() => expect(s307.ecrits).toHaveLength(2))
  })

  it('ne touche à rien quand on annule', async () => {
    const s307 = fichier('s3-07.yaml', '# Pourquoi cet exercice existe\n' + FICHIER)
    await reprendreS307(s307)
    await enregistrer()
    await screen.findByRole('alert')

    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(screen.queryByRole('alert')).toBeNull()
    expect(s307.ecrits).toEqual([])
  })

  it('oublie la confirmation dès que la correction change', async () => {
    // Ce qu'on s'apprêtait à confirmer valait pour l'état d'avant.
    await reprendreS307(fichier('s3-07.yaml', '# Pourquoi\n' + FICHIER))
    await enregistrer()
    await screen.findByRole('alert')

    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Autre' } })

    expect(screen.queryByRole('button', { name: 'Enregistrer quand même' })).toBeNull()
  })

  it("demande avant d'écraser un fichier changé sur le disque entre-temps", async () => {
    const s307 = fichier('s3-07.yaml', FICHIER)
    await reprendreS307(s307)
    // Une correction faite entre-temps dans l'éditeur du professeur.
    s307.contenu = FICHIER.replace('Répare la boucle.', 'Corrige la boucle.')

    await enregistrer()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Il a changé sur le disque depuis que tu l'as ouvert",
    )
    expect(s307.ecrits).toEqual([])
  })

  it('envoie un identifiant changé vers un fichier neuf, et laisse l original tel quel', async () => {
    // `s3-07.yaml` qui contiendrait `s3-09` serait un exercice sous le nom
    // d'un autre.
    const s307 = fichier('s3-07.yaml', FICHIER)
    const ecrit: string[] = []
    const selecteur = vi.fn(async () => ({
      createWritable: async () => ({
        write: async (t: string) => void ecrit.push(t),
        close: vi.fn(),
      }),
    }))
    vi.stubGlobal('showSaveFilePicker', selecteur)
    await reprendreS307(s307)

    fireEvent.change(screen.getByLabelText('Identifiant'), { target: { value: 's3-09' } })

    expect(screen.getByText(/L'identifiant a changé/)).toHaveTextContent(
      "L'identifiant a changé : ce sera un nouveau fichier, s3-09.yaml. s3-07.yaml reste tel quel.",
    )
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer le fichier' }))
    await waitFor(() => expect(ecrit).toHaveLength(1))
    expect(selecteur).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 's3-09.yaml' }))
    expect(s307.ecrits).toEqual([])
    // Le sien, sur le disque, n'a pas bougé : il reste « modifié ».
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveAccessibleDescription(
      'modifié',
    )
  })

  it('retourne à un fichier déjà ouvert sans le relire', async () => {
    // Le relire écraserait ce qu'on y a changé.
    await reprendreS307(
      fichier('s3-07.yaml', FICHIER),
      fichier('s3-08.yaml', FICHIER.replace('s3-07', 's3-08')),
    )
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'En cours' } })
    await reprendre('s3-08')
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-08'))

    await reprendre('s3-07')

    expect(screen.getByLabelText('Titre')).toHaveValue('En cours')
    expect(screen.getAllByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveLength(1)
  })

  it("ne l'ouvre qu'une fois sur un double-clic", async () => {
    await monterEtOuvrir(fichier('s3-07.yaml', FICHIER))
    const bouton = catalogue().getByRole('button', { name: /^s3-07 / })

    fireEvent.click(bouton)
    fireEvent.click(bouton)

    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
    expect(screen.getAllByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveLength(1)
  })

  it("relit un fichier refusé qu'on vient de réparer", async () => {
    const s307 = fichier('s3-07.yaml', FICHIER + 'surnom: x\n')
    await monterEtOuvrir(s307)
    await reprendre('s3-07')
    expect(await screen.findByText(/champ inconnu : surnom/)).toBeInTheDocument()
    expect(screen.getByLabelText('Identifiant')).toHaveValue('')

    s307.contenu = FICHIER
    await reprendre('s3-07')

    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('s3-07'))
    expect(screen.getAllByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveLength(1)
    expect(screen.queryByText(/champ inconnu/)).toBeNull()
  })

  it('garde dans le rail, marqué, un fichier du dépôt qui ne se lit pas', async () => {
    const verrouille = fichier('s3-07.yaml', FICHIER)
    verrouille.getFile = async () => {
      throw new Error('verrouillé')
    }
    await monterEtOuvrir(verrouille)
    expect(catalogue().getByRole('button', { name: 's3-07 titre illisible' })).toBeInTheDocument()

    await reprendre('s3-07')

    expect(await screen.findByText('fichier illisible.')).toBeInTheDocument()
  })

  it('reprend une leçon, et la réécrit en leçon', async () => {
    const c2 = fichier('c2-comparer.yaml', LECON)
    await monterEtOuvrir(c2)
    await reprendre('c2-comparer')
    await waitFor(() => expect(screen.getByLabelText('Identifiant')).toHaveValue('c2-comparer'))
    expect(screen.getByRole('radio', { name: 'Une leçon' })).toBeChecked()
    // Écrite comme l'atelier l'écrit : rien à craindre pour sa mise en page.
    expect(screen.getByText(/à sa place/)).not.toHaveTextContent(/mise en page/)

    fireEvent.change(screen.getByLabelText(/Durée de lecture/), { target: { value: '5' } })
    await enregistrer()

    await waitFor(() => expect(c2.ecrits).toHaveLength(1))
    expect(c2.ecrits[0]).toContain('duree_min: 5')
    expect(c2.ecrits[0]).toContain('ordre: 7')
    expect(
      screen.getByText('Enregistré dans chapitre-1/seance-2/lecons/c2-comparer.yaml.'),
    ).toBeInTheDocument()
  })

  it('dit quand le fichier a disparu du disque', async () => {
    const s307 = fichier('s3-07.yaml', FICHIER)
    await reprendreS307(s307)
    s307.getFile = async () => {
      throw new Error('introuvable')
    }

    await enregistrer()

    expect(await screen.findByRole('alert')).toHaveTextContent(`${CHEMIN} est introuvable`)
  })

  it("dit quand l'écriture échoue, sans rien perdre", async () => {
    const s307 = fichier('s3-07.yaml', FICHIER)
    await reprendreS307(s307)
    s307.createWritable = async () => {
      throw new Error('disque plein')
    }
    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Corrigé' } })

    await enregistrer()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      `L'enregistrement de ${CHEMIN} a échoué`,
    )
    expect(screen.getByLabelText('Titre')).toHaveValue('Corrigé')
    expect(screen.getByRole('button', { name: 'Ouvrir s3-07.yaml' })).toHaveAccessibleDescription(
      'modifié',
    )
  })

  it('retient la fermeture de l onglet tant qu une correction attend', async () => {
    const s307 = fichier('s3-07.yaml', FICHIER)
    await reprendreS307(s307)
    function fermerLOnglet() {
      const evenement = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(evenement)
      return evenement.defaultPrevented
    }
    expect(fermerLOnglet()).toBe(false)

    fireEvent.change(screen.getByLabelText('Titre'), { target: { value: 'Corrigé' } })
    expect(fermerLOnglet()).toBe(true)

    await enregistrer()
    await waitFor(() => expect(s307.ecrits).toHaveLength(1))
    expect(fermerLOnglet()).toBe(false)
  })

  it('garde le catalogue quand on referme la fenêtre de choix', async () => {
    await monterEtOuvrir(fichier('s3-07.yaml', FICHIER))
    const abandon = new Error('fermé')
    abandon.name = 'AbortError'
    vi.stubGlobal(
      'showDirectoryPicker',
      vi.fn(async () => {
        throw abandon
      }),
    )

    await userEvent.click(screen.getByRole('button', { name: 'Changer de dossier' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Changer de dossier' })).toBeEnabled(),
    )
    expect(catalogue().getByRole('button', { name: /^s3-07 / })).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it("dit pourquoi le dossier ne s'ouvre pas", async () => {
    poserLeReseau()
    vi.stubGlobal(
      'showDirectoryPicker',
      vi.fn(async () => {
        throw new Error('NotAllowedError')
      }),
    )
    render(<Atelier executeur={executeurQuiRend('')} />)

    await userEvent.click(await screen.findByRole('button', { name: 'Ouvrir le dossier du dépôt' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le dossier n'a pas pu être ouvert",
    )
    expect(screen.getByRole('button', { name: 'Ouvrir le dossier du dépôt' })).toBeEnabled()
  })
})
