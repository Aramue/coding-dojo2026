import { useEffect, useState } from 'react'

export type Destination =
  | { vue: 'connexion' }
  /** Espace professeur. Sa porte est son mot de passe, pas un code eleve. */
  | { vue: 'prof'; onglet: OngletProf }
  | { vue: 'cours'; notion: string }
  | { vue: 'exercices'; notion: string }
  | { vue: 'exercice'; notion: string; numero: number }
  | { vue: 'inconnue' }

// Le routeur valide la FORME d'un identifiant de notion, jamais son
// vocabulaire : la liste des notions vit dans le contenu publié
// (notions.json), et la recopier ici la ferait diverger.
/**
 * Les onglets de l'espace professeur. « Séance » n'a pas de suffixe : c'est
 * `/prof` tout court, l'écran qu'on ouvre en séance et qu'on garde en signet.
 */
export type OngletProf = 'seance' | 'classe' | 'atelier'

// `seance` n'y figure pas : il n'a pas de chemin à lui. Et seuls ces deux
// noms sont interceptés après `/prof`, pour qu'une notion qui s'appellerait
// « prof » garde ses pages `/prof/cours` et `/prof/exercices`.
const ONGLETS_PROF: Record<string, OngletProf> = { classe: 'classe', atelier: 'atelier' }

const MOTIF_NOTION = /^[a-z]{2,20}$/
const NUMERO_MAX = 99

/**
 * Traduit un chemin en destination. Fonction pure : c'est elle qui porte toute
 * la logique, le hook plus bas n'est qu'un abonnement à `popstate`.
 */
export function analyser(chemin: string): Destination {
  const morceaux = chemin.split('/').filter(Boolean)
  if (morceaux.length === 0) return { vue: 'connexion' }
  if (morceaux[0] === 'prof') {
    if (morceaux.length === 1) return { vue: 'prof', onglet: 'seance' }
    const onglet = morceaux.length === 2 ? ONGLETS_PROF[morceaux[1]!] : undefined
    if (onglet) return { vue: 'prof', onglet }
  }

  const [notion, page, numero] = morceaux
  if (!notion || !MOTIF_NOTION.test(notion)) return { vue: 'inconnue' }

  if (morceaux.length === 2 && page === 'cours') return { vue: 'cours', notion }
  if (morceaux.length === 2 && page === 'exercices') return { vue: 'exercices', notion }

  if (morceaux.length === 3 && page === 'exercices' && numero !== undefined) {
    if (!/^[0-9]{1,2}$/.test(numero)) return { vue: 'inconnue' }
    const n = Number(numero)
    if (n < 1 || n > NUMERO_MAX) return { vue: 'inconnue' }
    return { vue: 'exercice', notion, numero: n }
  }

  return { vue: 'inconnue' }
}

export function versChemin(destination: Destination): string {
  switch (destination.vue) {
    case 'cours':
      return `/${destination.notion}/cours`
    case 'exercices':
      return `/${destination.notion}/exercices`
    case 'exercice':
      return `/${destination.notion}/exercices/${destination.numero}`
    case 'prof':
      return destination.onglet === 'seance' ? '/prof' : `/prof/${destination.onglet}`
    default:
      return '/'
  }
}

/**
 * Change de page sans rechargement. `pushState` ne déclenche aucun événement
 * de lui-même : sans le `popstate` émis à la main, l'URL changerait mais
 * l'écran resterait le même.
 */
export function naviguer(destination: Destination): void {
  history.pushState(null, '', versChemin(destination))
  dispatchEvent(new PopStateEvent('popstate'))
}

export function useRoute(): Destination {
  const [destination, setDestination] = useState<Destination>(() => analyser(location.pathname))
  useEffect(() => {
    const relire = () => setDestination(analyser(location.pathname))
    addEventListener('popstate', relire)
    return () => removeEventListener('popstate', relire)
  }, [])
  return destination
}
