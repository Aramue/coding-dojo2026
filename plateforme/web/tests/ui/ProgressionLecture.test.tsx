import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ContexteDefilement } from '../../src/ui/defilement'
import { ProgressionLecture } from '../../src/ui/ProgressionLecture'

/** Un faux cadre défilant, comme celui de l'aperçu du professeur. */
function cadre({ scrollTop, scrollHeight, clientHeight }: Record<string, number>) {
  const element = document.createElement('div')
  Object.defineProperties(element, {
    scrollTop: { value: scrollTop, writable: true },
    scrollHeight: { value: scrollHeight },
    clientHeight: { value: clientHeight },
  })
  return element
}

function part(conteneur: HTMLElement | null): string {
  const { container } = render(
    <ContexteDefilement.Provider value={conteneur}>
      <ProgressionLecture />
    </ContexteDefilement.Provider>,
  )
  return container.querySelector<HTMLElement>('.lecture__part')!.style.transform
}

afterEach(() => vi.unstubAllGlobals())

describe('ProgressionLecture — sur la fenêtre', () => {
  it('mesure le défilement de la page', () => {
    vi.stubGlobal('scrollY', 250)
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(1000)
    vi.stubGlobal('innerHeight', 500)
    expect(part(null)).toBe('scaleX(0.5)')
  })

  it('donne une lecture entière sur une page plus courte que la fenêtre', () => {
    // Sans ce cas, on divise par zéro et la barre part à NaN.
    vi.stubGlobal('scrollY', 0)
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(300)
    vi.stubGlobal('innerHeight', 800)
    expect(part(null)).toBe('scaleX(1)')
  })
})

describe('ProgressionLecture — dans un cadre', () => {
  it("mesure le cadre, pas la fenêtre", () => {
    // Dans l'apercu du professeur, la page est figee : en lisant scrollY, la
    // barre mesurait un defilement qui n'a pas lieu et se croyait pleine.
    vi.stubGlobal('scrollY', 0)
    vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(300)
    vi.stubGlobal('innerHeight', 800)

    const defilant = cadre({ scrollTop: 150, scrollHeight: 800, clientHeight: 500 })
    expect(part(defilant)).toBe('scaleX(0.5)')
  })

  it("s'abonne au cadre et se désabonne en partant", () => {
    const defilant = cadre({ scrollTop: 0, scrollHeight: 800, clientHeight: 400 })
    const ecouter = vi.spyOn(defilant, 'addEventListener')
    const oublier = vi.spyOn(defilant, 'removeEventListener')

    const { unmount } = render(
      <ContexteDefilement.Provider value={defilant}>
        <ProgressionLecture />
      </ContexteDefilement.Provider>,
    )
    expect(ecouter).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    unmount()
    expect(oublier).toHaveBeenCalledWith('scroll', expect.any(Function))
  })
})
