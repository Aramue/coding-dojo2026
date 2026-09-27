import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientApi } from '../../src/api/client'
import type { EtatEleve } from '../../src/quiz/types'
import { BandeauQuiz, PERIODE_BANDEAU_MS } from '../../src/ui/BandeauQuiz'
import { etatEleve, question } from './quiz-outillage'

function client(lire: () => Promise<EtatEleve>) {
  return { lireQuiz: vi.fn(lire) } as unknown as ClientApi & { lireQuiz: ReturnType<typeof vi.fn> }
}

beforeEach(() => {
  history.pushState(null, '', '/variables/cours')
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BandeauQuiz', () => {
  it('invite à rejoindre une partie qui commence', async () => {
    render(<BandeauQuiz client={client(async () => etatEleve({ rejoint: false }))} masque={false} />)
    expect(await screen.findByRole('status')).toHaveTextContent('Un quiz a commencé · Les bases de la séance 1')
    await userEvent.click(screen.getByRole('button', { name: 'Rejoindre' }))
    expect(location.pathname).toBe('/quiz')
  })

  it('ramène à sa partie l élève qui en est sorti', async () => {
    const enCours = etatEleve({ phase: 'question', question: question() })
    render(<BandeauQuiz client={client(async () => enCours)} masque={false} />)
    expect(await screen.findByRole('button', { name: 'Revenir au quiz' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ta partie de quiz continue')
  })

  it.each([
    ['sans partie', { partie: null, maintenant: new Date().toISOString() } as EtatEleve],
    ['partie terminée', etatEleve({ phase: 'terminee' })],
  ])('ne dit rien %s', async (_cas, etat) => {
    const c = client(async () => etat)
    render(<BandeauQuiz client={c} masque={false} />)
    await vi.waitFor(() => expect(c.lireQuiz).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('se tait quand la plateforme ne répond pas : l alerte générale suffit', async () => {
    const c = client(async () => {
      throw new Error('La plateforme ne répond pas.')
    })
    render(<BandeauQuiz client={c} masque={false} />)
    await vi.waitFor(() => expect(c.lireQuiz).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('ne relit rien sur la page du quiz elle-même', () => {
    const c = client(async () => etatEleve())
    render(<BandeauQuiz client={c} masque />)
    expect(c.lireQuiz).not.toHaveBeenCalled()
  })

  it('relit toutes les dix secondes, et apparaît quand la partie est créée', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let etat: EtatEleve = { partie: null, maintenant: new Date().toISOString() }
    const c = client(async () => etat)
    render(<BandeauQuiz client={c} masque={false} />)
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(screen.queryByRole('status')).toBeNull()

    etat = etatEleve({ rejoint: false })
    await act(() => vi.advanceTimersByTimeAsync(PERIODE_BANDEAU_MS))
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(c.lireQuiz).toHaveBeenCalledTimes(2)
  })
})
