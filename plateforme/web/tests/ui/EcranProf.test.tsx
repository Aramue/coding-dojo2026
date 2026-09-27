import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EcranProf } from '../../src/ui/EcranProf'

const CLE = 'dojo.jeton-prof'
const JETON = 'prof.4102444800.signature'
const MOT_DE_PASSE = 'un-mot-de-passe-long'

type Reseau = {
  /** `null` : la plateforme ne répond pas. */
  existe?: boolean | null
  creation?: number
  connexion?: number
  seance?: number
  /** Sert le contenu publié : sans lui, aucun exercice n'est cliquable. */
  contenu?: boolean
  /** Les élèves que rend /prof/seance. */
  eleves?: unknown[]
}

const CHAPITRES = [{ id: 'bases', ordre: 1, titre: 'Les bases de Python', seance: 1 }]
const NOTIONS = [
  {
    id: 'saisie',
    ordre: 1,
    titre: 'Demander une information',
    famille: 'operateurs',
    chapitre: 'bases',
  },
]
const EXERCICES = [
  {
    id: 's1-29',
    concept: 'input',
    notion: 'saisie',
    famille: 'operateurs',
    seance: 1,
    niveau: 'normal',
    type: 'debug',
    titre: "L'âge qui refuse de s'additionner",
    obligatoire: true,
    enonce: 'Répare le programme.',
    depart: 'age = input()',
    indices: [],
    tests: [{ type: 'interdit', motif: 'xyzzy' }],
  },
]

function reponse(status: number, corps: unknown) {
  return { ok: status < 400, status, json: async () => corps }
}

/** Le réseau du professeur, route par route. */
function poserLeReseau(r: Reseau = {}) {
  const appel = vi.fn(async (url: string, init?: RequestInit) => {
    const methode = init?.method ?? 'GET'
    if (url === '/api/prof/compte' && methode === 'GET') {
      return r.existe === null ? reponse(502, {}) : reponse(200, { existe: r.existe ?? true })
    }
    if (url === '/api/prof/compte') return reponse(r.creation ?? 201, { jeton: JETON })
    if (url === '/api/prof/connexion') return reponse(r.connexion ?? 200, { jeton: JETON })
    if (url.includes('prof/seance')) return reponse(r.seance ?? 200, { eleves: r.eleves ?? [] })
    if (url.includes('prof/eleves')) return reponse(200, { eleves: [] })
    if (url.includes('chapitres')) return reponse(200, r.contenu ? CHAPITRES : [])
    if (url.includes('notions')) return reponse(200, r.contenu ? NOTIONS : [])
    if (url.includes('exercices')) return reponse(200, r.contenu ? EXERCICES : [])
    return reponse(200, [])
  })
  vi.stubGlobal('fetch', appel)
  return appel
}

function corpsEnvoye(appel: ReturnType<typeof poserLeReseau>, url: string): unknown {
  const trouve = appel.mock.calls.find(([u, init]) => u === url && init?.method === 'POST')
  return trouve ? JSON.parse(String((trouve[1] as RequestInit).body)) : undefined
}

beforeEach(() => {
  sessionStorage.clear()
  localStorage.clear()
  vi.unstubAllGlobals()
})

describe('EcranProf — premier lancement', () => {
  it("propose de créer le compte quand aucun n'existe", async () => {
    poserLeReseau({ existe: false })
    render(<EcranProf />)
    expect(
      await screen.findByRole('heading', { name: 'Créer le compte professeur' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /séance en cours/i })).toBeNull()
  })

  it('exige douze caractères avant de permettre la création', async () => {
    poserLeReseau({ existe: false })
    render(<EcranProf />)
    const champ = await screen.findByLabelText(/^mot de passe$/i)
    await userEvent.type(champ, 'a'.repeat(11))
    await userEvent.type(screen.getByLabelText(/confirme/i), 'a'.repeat(11))
    const bouton = screen.getByRole('button', { name: 'Créer le compte' })
    expect(bouton).toBeDisabled()
    await userEvent.type(champ, 'a')
    await userEvent.type(screen.getByLabelText(/confirme/i), 'a')
    expect(bouton).toBeEnabled()
  })

  it('signale deux mots de passe différents, sans crier pendant la frappe', async () => {
    poserLeReseau({ existe: false })
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)
    const confirmation = screen.getByLabelText(/confirme/i)
    await userEvent.type(confirmation, 'un-mot')
    expect(screen.queryByText(/diffèrent/)).toBeNull()
    await userEvent.type(confirmation, 'X')
    expect(screen.getByText('Les deux mots de passe diffèrent.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer le compte' })).toBeDisabled()
  })

  it('crée le compte, ouvre le tableau, et ne garde que le jeton', async () => {
    const appel = poserLeReseau({ existe: false })
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)
    await userEvent.type(screen.getByLabelText(/confirme/i), MOT_DE_PASSE)
    await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))

    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
    expect(corpsEnvoye(appel, '/api/prof/compte')).toEqual({ mot_de_passe: MOT_DE_PASSE })
    expect(sessionStorage.getItem(CLE)).toBe(JETON)
    expect(localStorage.getItem(CLE)).toBeNull()
    for (let i = 0; i < sessionStorage.length; i++) {
      expect(sessionStorage.getItem(sessionStorage.key(i)!)).not.toContain(MOT_DE_PASSE)
    }
  })

  it('dit pourquoi la création a échoué', async () => {
    poserLeReseau({ existe: false, creation: 409 })
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)
    await userEvent.type(screen.getByLabelText(/confirme/i), MOT_DE_PASSE)
    await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/existe déjà/)
  })
})

describe('EcranProf — la porte', () => {
  it('demande le mot de passe quand le compte existe', async () => {
    poserLeReseau()
    render(<EcranProf />)
    expect(await screen.findByLabelText(/^mot de passe$/i)).toHaveAttribute('type', 'password')
    expect(screen.getByRole('heading', { name: 'Tableau de bord' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /séance en cours/i })).toBeNull()
  })

  it("n'ouvre pas sur un champ vide", async () => {
    poserLeReseau()
    render(<EcranProf />)
    await screen.findByLabelText(/^mot de passe$/i)
    expect(screen.getByRole('button', { name: 'Ouvrir' })).toBeDisabled()
  })

  it('ouvre le tableau avec le bon mot de passe', async () => {
    const appel = poserLeReseau()
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
    expect(corpsEnvoye(appel, '/api/prof/connexion')).toEqual({ mot_de_passe: MOT_DE_PASSE })
    expect(sessionStorage.getItem(CLE)).toBe(JETON)
  })

  it('envoie le jeton, jamais le mot de passe, au tableau de bord', async () => {
    const appel = poserLeReseau()
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    await screen.findByRole('heading', { name: /séance en cours/i })
    const seance = appel.mock.calls.find(([u]) => u.includes('prof/seance'))!
    expect((seance[1] as RequestInit).headers).toMatchObject({ 'X-Jeton-Prof': JETON })
  })

  it('dit que le mot de passe est faux et reste sur la porte', async () => {
    poserLeReseau({ connexion: 401 })
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), 'pas-le-bon-du-tout')
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mot de passe incorrect.')
    expect(screen.queryByRole('heading', { name: /séance en cours/i })).toBeNull()
    expect(sessionStorage.getItem(CLE)).toBeNull()
  })

  it('dit comment retrouver l accès quand le mot de passe est perdu', async () => {
    poserLeReseau()
    render(<EcranProf />)
    await screen.findByLabelText(/^mot de passe$/i)
    expect(screen.getByText(/python -m app\.oublier_prof/)).toBeInTheDocument()
  })
})

describe('EcranProf — la session', () => {
  it('rouvre tout seul sur un jeton mémorisé, sans redemander', async () => {
    const appel = poserLeReseau()
    sessionStorage.setItem(CLE, JETON)
    render(<EcranProf />)
    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
    expect(appel.mock.calls.some(([u]) => u === '/api/prof/compte')).toBe(false)
  })

  it('referme la session et efface le jeton', async () => {
    poserLeReseau()
    sessionStorage.setItem(CLE, JETON)
    render(<EcranProf />)
    await userEvent.click(await screen.findByRole('button', { name: /fermer la session/i }))
    expect(sessionStorage.getItem(CLE)).toBeNull()
    expect(await screen.findByLabelText(/^mot de passe$/i)).toBeInTheDocument()
  })

  it('revient à la porte quand le jeton est refusé', async () => {
    // Un jeton expiré après douze heures : un « Accès refusé » ne dirait pas
    // quoi faire, la porte le dit.
    poserLeReseau({ seance: 401 })
    sessionStorage.setItem(CLE, JETON)
    render(<EcranProf />)
    expect(await screen.findByLabelText(/^mot de passe$/i)).toBeInTheDocument()
    expect(sessionStorage.getItem(CLE)).toBeNull()
  })
})

describe('EcranProf — ce qui peut mal tourner', () => {
  it('dit quand la plateforme ne répond pas, et laisse réessayer', async () => {
    poserLeReseau({ existe: null })
    render(<EcranProf />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/ne répond pas/)
    poserLeReseau({ existe: true })
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(await screen.findByLabelText(/^mot de passe$/i)).toBeInTheDocument()
  })

  it("s'ouvre quand même si le navigateur refuse d'écrire", async () => {
    // Navigation privée, cookies bloqués : sans ce filet, la porte reste close
    // et le professeur n'a aucun moyen de comprendre pourquoi.
    poserLeReseau()
    const ecrire = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('refus')
    })
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))
    expect(await screen.findByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
    ecrire.mockRestore()
  })

  it('se referme même si le navigateur refuse d effacer', async () => {
    poserLeReseau()
    sessionStorage.setItem(CLE, JETON)
    const effacer = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('refus')
    })
    render(<EcranProf />)
    await userEvent.click(await screen.findByRole('button', { name: /fermer la session/i }))
    expect(await screen.findByLabelText(/^mot de passe$/i)).toBeInTheDocument()
    effacer.mockRestore()
  })

  it('ne plante pas quand le navigateur refuse même de lire', async () => {
    poserLeReseau()
    const lire = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('refus')
    })
    render(<EcranProf />)
    await waitFor(() => expect(screen.getByLabelText(/^mot de passe$/i)).toBeInTheDocument())
    lire.mockRestore()
  })
})

describe("EcranProf — l'aperçu de l'espace élève", () => {
  it("s'ouvre par-dessus le tableau, qui attend derrière", async () => {
    poserLeReseau()
    sessionStorage.setItem(CLE, JETON)
    render(<EcranProf />)
    await screen.findByRole('heading', { name: /séance en cours/i })

    await userEvent.click(screen.getByRole('button', { name: /voir l'espace élève/i }))

    const fenetre = await screen.findByRole('dialog', { name: /aperçu de l'espace élève/i })
    expect(fenetre).toBeInTheDocument()
    // Le tableau n'est pas démonté : il est simplement derrière.
    expect(screen.getByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
  })

  it('se referme et rend la main au tableau', async () => {
    poserLeReseau()
    sessionStorage.setItem(CLE, JETON)
    render(<EcranProf />)
    await screen.findByRole('heading', { name: /séance en cours/i })
    await userEvent.click(screen.getByRole('button', { name: /voir l'espace élève/i }))
    await screen.findByRole('dialog')

    await userEvent.keyboard('{Escape}')

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('heading', { name: /séance en cours/i })).toBeInTheDocument()
  })

  it("dit que rien n'est enregistré dans l'aperçu", async () => {
    poserLeReseau()
    sessionStorage.setItem(CLE, JETON)
    render(<EcranProf />)
    await screen.findByRole('heading', { name: /séance en cours/i })
    expect(screen.getByText(/Rien n'y est enregistré/)).toBeInTheDocument()
  })
})

describe("EcranProf — l'aperçu s'ouvre sur l'exercice cliqué", () => {
  it("relaie au tableau de bord la page que le professeur demande", async () => {
    // Le tableau sait sur quoi un élève bute ; c'est l'aperçu qui sait le
    // montrer. Sans ce relais, le clic dans le parcours ne ferait rien.
    poserLeReseau({
      contenu: true,
      eleves: [
        {
          code_acces: 'DOJO-K7M2',
          prenom: 'Enzo',
          nom: 'Poupard',
          exercice_id: 's1-29',
          statut: 'en_cours',
          echecs_consecutifs: 0,
          inactif_depuis_s: 0,
          dernier_type_erreur: null,
          reussis: [],
        },
      ],
    })
    sessionStorage.setItem(CLE, JETON)
    render(<EcranProf />)

    await userEvent.click(await screen.findByRole('button', { name: /Déplier le parcours/ }))
    await userEvent.click(
      screen.getByRole('button', { name: /L'âge qui refuse de s'additionner/ }),
    )

    expect(await screen.findByRole('dialog', { name: /aperçu/i })).toBeInTheDocument()
  })
})

describe("EcranProf — les formulaires de la porte refusent le vide", () => {
  it("n'appelle pas la création tant que les deux mots de passe ne concordent pas", async () => {
    const appel = poserLeReseau({ existe: false })
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)

    // La confirmation est vide : la touche Entrée ne doit rien déclencher.
    fireEvent.submit(document.querySelector('form.prof__carte')!)

    await new Promise((r) => setTimeout(r, 10))
    expect(appel.mock.calls.some(([u, i]) => u === '/api/prof/compte' && i?.method === 'POST')).toBe(
      false,
    )
  })

  it("n'appelle pas la connexion sur un mot de passe vide", async () => {
    const appel = poserLeReseau()
    render(<EcranProf />)
    await screen.findByLabelText(/^mot de passe$/i)

    fireEvent.submit(document.querySelector('form.prof__carte')!)

    await new Promise((r) => setTimeout(r, 10))
    expect(appel.mock.calls.some(([u]) => u === '/api/prof/connexion')).toBe(false)
  })
})

describe("EcranProf — quand ce qui est lancé n'est pas une Error", () => {
  it('replie sur « Création impossible »', async () => {
    poserLeReseau({ existe: false })
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)
    await userEvent.type(screen.getByLabelText(/confirme/i), MOT_DE_PASSE)

    vi.stubGlobal('fetch', vi.fn(async () => { throw 'coupure' }))
    await userEvent.click(screen.getByRole('button', { name: 'Créer le compte' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Création impossible.')
  })

  it('replie sur « Connexion impossible »', async () => {
    poserLeReseau()
    render(<EcranProf />)
    await userEvent.type(await screen.findByLabelText(/^mot de passe$/i), MOT_DE_PASSE)

    vi.stubGlobal('fetch', vi.fn(async () => { throw 'coupure' }))
    await userEvent.click(screen.getByRole('button', { name: 'Ouvrir' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Connexion impossible.')
  })
})

describe('EcranProf — démonté pendant la question au serveur', () => {
  function reseauLent(reponse: () => unknown) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 15))
        return reponse()
      }),
    )
  }

  it("n'ouvre pas la porte d'un écran déjà parti", async () => {
    reseauLent(() => ({ ok: true, status: 200, json: async () => ({ existe: true }) }))
    const { unmount } = render(<EcranProf />)
    unmount()
    await new Promise((r) => setTimeout(r, 40))
  })

  it("ne signale pas une plateforme injoignable après le démontage", async () => {
    reseauLent(() => { throw new Error('coupure') })
    const { unmount } = render(<EcranProf />)
    unmount()
    await new Promise((r) => setTimeout(r, 40))
  })
})
