import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useContenuPublie } from '../../src/prof/contenu'

function Sonde({ surContenu }: { surContenu: (n: number) => void }) {
  const contenu = useContenuPublie()
  surContenu(contenu ? contenu.exercices.length : -1)
  return null
}

function poserLeReseau(exercices: unknown[], tarde = false) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (tarde) await new Promise((r) => setTimeout(r, 5))
      return {
        ok: true,
        json: async () => (url.includes('exercices') ? exercices : []),
      }
    }),
  )
}

beforeEach(() => vi.unstubAllGlobals())

describe('useContenuPublie', () => {
  it('rend le contenu une fois charge', async () => {
    poserLeReseau([{ id: 's1-01' }])
    const vus: number[] = []
    render(<Sonde surContenu={(n) => vus.push(n)} />)

    await waitFor(() => expect(vus.at(-1)).toBe(1))
  })

  it("reste a null quand le contenu ne vient pas, sans faire disparaitre l'ecran", async () => {
    // Sans contenu, le tableau de bord affiche des identifiants bruts :
    // dégradé, jamais cassé.
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => [] })))
    const vus: number[] = []
    render(<Sonde surContenu={(n) => vus.push(n)} />)

    await new Promise((r) => setTimeout(r, 10))
    expect(vus.every((n) => n === -1)).toBe(true)
  })

  it("n ecrit plus dans l etat d un composant demonte", async () => {
    // React avertit — et en production, c'est une fuite : le chargement
    // continue après la fermeture de l'aperçu.
    poserLeReseau([{ id: 's1-01' }], true)
    const vus: number[] = []
    const { unmount } = render(<Sonde surContenu={(n) => vus.push(n)} />)
    unmount()

    await new Promise((r) => setTimeout(r, 20))
    expect(vus).toEqual([-1])
  })
})
