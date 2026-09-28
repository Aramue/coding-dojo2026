import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import type { EtatEleve } from '../../src/quiz/types'
import { BandeauQuiz, partieOuverte } from '../../src/ui/BandeauQuiz'
import { etatEleve, question } from './quiz-outillage'

beforeEach(() => {
  history.pushState(null, '', '/variables/cours')
})

describe('BandeauQuiz', () => {
  it('invite à rejoindre une partie qui commence', async () => {
    render(<BandeauQuiz etat={etatEleve({ rejoint: false })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Un quiz a commencé · Les bases de la séance 1')
    expect(screen.getByRole('status')).toHaveTextContent("Le cours est fermé jusqu'à la fin de la partie")
    await userEvent.click(screen.getByRole('button', { name: 'Rejoindre' }))
    expect(location.pathname).toBe('/quiz')
  })

  it('ramène à sa partie l élève qui en est sorti', () => {
    render(<BandeauQuiz etat={etatEleve({ phase: 'question', question: question() })} />)
    expect(screen.getByRole('button', { name: 'Revenir au quiz' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Ta partie de quiz continue')
  })

  it.each([
    ['avant toute lecture', null],
    ['sans partie', { partie: null, maintenant: new Date().toISOString() } as EtatEleve],
    ['quand la partie est terminée', etatEleve({ phase: 'terminee' })],
  ])('ne dit rien %s', (_cas, etat) => {
    render(<BandeauQuiz etat={etat} />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(partieOuverte(etat)).toBe(false)
  })
})
