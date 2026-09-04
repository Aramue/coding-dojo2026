import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Classe } from '../../src/ui/Classe'
import type { EleveInscrit } from '../../src/prof/classe'

function inscrit(surcharge: Partial<EleveInscrit> = {}): EleveInscrit {
  return {
    code_acces: 'DOJO-K7M2',
    prenom: 'Camille',
    nom: 'Rey',
    etablissement: 'Calvin',
    cree_le: '2026-09-04T10:00:00+00:00',
    vu_le: '2026-09-04T10:00:00+00:00',
    tentatives: 0,
    ...surcharge,
  }
}

/**
 * Le réseau du professeur. `ecritures` retient chaque appel modifiant, pour
 * vérifier ce qui part réellement plutôt que ce que l'écran affiche.
 */
function poserLeReseau(liste: EleveInscrit[], options: { echec?: number } = {}) {
  const ecritures: { methode: string; url: string; corps: unknown }[] = []
  const appel = vi.fn(async (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET'
    if (methode !== 'GET') {
      ecritures.push({ methode, url, corps: init?.body ? JSON.parse(String(init.body)) : null })
      if (options.echec) return { ok: false, status: options.echec, json: async () => ({}) }
      return { ok: true, status: 200, json: async () => ({}) }
    }
    return { ok: true, status: 200, json: async () => ({ eleves: liste }) }
  })
  vi.stubGlobal('fetch', appel)
  return { ecritures, appel }
}

beforeEach(() => vi.unstubAllGlobals())

describe('Classe — la liste', () => {
  it('annonce une classe vide sans faire croire à une panne', async () => {
    poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    expect(await screen.findByText(/Aucun élève pour l'instant/)).toBeInTheDocument()
  })

  it("montre le code, l'identité et l'établissement", async () => {
    poserLeReseau([inscrit()])
    render(<Classe codeProf="code-prof-test" />)
    expect(await screen.findByText('DOJO-K7M2')).toBeInTheDocument()
    expect(screen.getByText('Camille Rey')).toBeInTheDocument()
    expect(screen.getByText('Calvin')).toBeInTheDocument()
  })

  it('distingue celui qui ne s est jamais connecté', async () => {
    poserLeReseau([inscrit({ tentatives: 0 }), inscrit({ code_acces: 'DOJO-A3B9', tentatives: 5 })])
    render(<Classe codeProf="code-prof-test" />)
    expect(await screen.findByText('pas encore connecté')).toBeInTheDocument()
    expect(screen.getByText('5 tentatives')).toBeInTheDocument()
  })

  it('accorde l effectif', async () => {
    poserLeReseau([inscrit()])
    render(<Classe codeProf="code-prof-test" />)
    expect(await screen.findByText('1 élève inscrit')).toBeInTheDocument()
  })

  it('dit ce qui ne va pas plutôt que de rendre une liste vide', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401, json: async () => ({}) })))
    render(<Classe codeProf="faux" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/refus/i)
  })

  it("ne met jamais un non-tableau dans l'état", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ pasCeQuOnAttend: 1 }) })),
    )
    render(<Classe codeProf="code-prof-test" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/inattendue/i)
  })
})

describe('Classe — ajouter un élève', () => {
  it('envoie la fiche saisie, sans jamais choisir le code', async () => {
    // Un code devine d'avance, c'est la progression de quelqu'un d'autre.
    const { ecritures } = poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)

    await userEvent.type(screen.getByLabelText(/Prénom/), 'Camille')
    await userEvent.type(screen.getByLabelText(/^Nom/), 'Rey')
    await userEvent.type(screen.getByLabelText(/Établissement/), 'Calvin')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() => expect(ecritures).toHaveLength(1))
    expect(ecritures[0]!.methode).toBe('POST')
    expect(ecritures[0]!.corps).toEqual({
      prenom: 'Camille',
      nom: 'Rey',
      etablissement: 'Calvin',
    })
  })

  it("n'ajoute rien sans prénom", async () => {
    poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)
    expect(screen.getByRole('button', { name: 'Ajouter' })).toBeDisabled()
  })

  it('vide le formulaire après un ajout', async () => {
    poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)
    await userEvent.type(screen.getByLabelText(/Prénom/), 'Camille')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    await waitFor(() => expect(screen.getByLabelText(/Prénom/)).toHaveValue(''))
  })
})

describe('Classe — coller une liste', () => {
  async function ouvrirLeLot() {
    await userEvent.click(screen.getByRole('tab', { name: 'Coller une liste' }))
  }

  it('compte les élèves reconnus avant de créer quoi que ce soit', async () => {
    poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)
    await ouvrirLeLot()

    await userEvent.type(
      screen.getByLabelText(/Une ligne par élève/),
      'Camille;Rey;Calvin\nEnzo;Poupard;Rousseau',
    )
    expect(screen.getByText(/2 élèves reconnus : Camille, Enzo/)).toBeInTheDocument()
  })

  it('crée un élève par ligne, dans l ordre', async () => {
    const { ecritures } = poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)
    await ouvrirLeLot()

    await userEvent.type(screen.getByLabelText(/Une ligne par élève/), 'Camille;Rey\nIziz;Gaston')
    await userEvent.click(screen.getByRole('button', { name: /Créer/ }))

    await waitFor(() => expect(ecritures).toHaveLength(2))
    expect(ecritures.map((e) => (e.corps as { prenom: string }).prenom)).toEqual([
      'Camille',
      'Iziz',
    ])
  })

  it('ne crée rien sur un texte vide', async () => {
    poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)
    await ouvrirLeLot()
    expect(screen.getByRole('button', { name: /Créer/ })).toBeDisabled()
  })
})

describe('Classe — corriger et retirer', () => {
  it('modifie un élève sans toucher à son code', async () => {
    // Le code est deja distribue : le changer couperait l'eleve de sa progression.
    const { ecritures } = poserLeReseau([inscrit({ prenom: 'Camile' })])
    render(<Classe codeProf="code-prof-test" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }))

    const edition = screen.getByRole('form', { name: /Modifier Camile Rey/ })
    const champ = within(edition).getByLabelText(/Prénom/)
    await userEvent.clear(champ)
    await userEvent.type(champ, 'Camille')
    await userEvent.click(within(edition).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(ecritures).toHaveLength(1))
    expect(ecritures[0]!.methode).toBe('PATCH')
    expect(ecritures[0]!.url).toContain('/eleves/DOJO-K7M2')
    expect((ecritures[0]!.corps as { prenom: string }).prenom).toBe('Camille')
  })

  it('renonce à la modification sur Annuler', async () => {
    const { ecritures } = poserLeReseau([inscrit()])
    render(<Classe codeProf="code-prof-test" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Modifier' }))
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }))
    expect(ecritures).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Modifier' })).toBeInTheDocument()
  })

  it('nomme ce qui sera perdu avant de retirer', async () => {
    // Jamais un « Confirmer ? » nu : la suppression emporte les tentatives.
    const demande = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { ecritures } = poserLeReseau([inscrit({ tentatives: 12 })])
    render(<Classe codeProf="code-prof-test" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))

    expect(demande).toHaveBeenCalledWith(expect.stringContaining('Camille Rey'))
    expect(demande).toHaveBeenCalledWith(expect.stringContaining('12 tentatives'))
    await waitFor(() => expect(ecritures[0]!.methode).toBe('DELETE'))
    demande.mockRestore()
  })

  it('ne retire rien si le professeur renonce', async () => {
    const demande = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { ecritures } = poserLeReseau([inscrit()])
    render(<Classe codeProf="code-prof-test" />)
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))
    expect(ecritures).toHaveLength(0)
    demande.mockRestore()
  })

  it("dit pourquoi une écriture a échoué", async () => {
    poserLeReseau([], { echec: 422 })
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)
    await userEvent.type(screen.getByLabelText(/Prénom/), 'Camille')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/prénom est obligatoire/i)
  })

  it('relit la liste après une écriture', async () => {
    const { appel } = poserLeReseau([])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText(/Aucun élève/)
    const avant = appel.mock.calls.filter(([, i]) => (i as RequestInit)?.method === undefined).length

    await userEvent.type(screen.getByLabelText(/Prénom/), 'Camille')
    await userEvent.click(screen.getByRole('button', { name: 'Ajouter' }))

    await waitFor(() => {
      const apres = appel.mock.calls.filter(
        ([, i]) => (i as RequestInit)?.method === undefined,
      ).length
      expect(apres).toBeGreaterThan(avant)
    })
  })
})

describe('Classe — la porte reste fermée', () => {
  it('envoie le code professeur sur chaque appel', async () => {
    const { appel } = poserLeReseau([inscrit()])
    render(<Classe codeProf="code-prof-test" />)
    await screen.findByText('Camille Rey')
    for (const [, init] of appel.mock.calls) {
      expect((init as RequestInit).headers).toMatchObject({ 'X-Code-Prof': 'code-prof-test' })
    }
  })

  it('ne montre aucun élève tant que la liste n a pas répondu', () => {
    poserLeReseau([inscrit()])
    const { container } = render(<Classe codeProf="code-prof-test" />)
    expect(within(container).queryByText('Camille Rey')).toBeNull()
  })
})
