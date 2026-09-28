import { useEffect, useState } from 'react'

export type Destination =
  | { vue: 'connexion' }
  /** Tableau de bord professeur. Sa porte est le code prof, pas un code eleve. */
  | { vue: 'prof' }
  /** L'écran du quiz projeté par le professeur, derrière la même porte. */
  | { vue: 'prof-quiz' }
  /** La partie de quiz en cours, côté élève. */
  | { vue: 'quiz' }
  | { vue: 'cours'; notion: string }
  | { vue: 'exercices'; notion: string }
  | { vue: 'exercice'; notion: string; numero: number }
  | { vue: 'inconnue' }

// Le routeur valide la FORME d'un identifiant de notion, jamais son
// vocabulaire : la liste des notions vit dans le contenu publié
// (notions.json), et la recopier ici la ferait diverger.
const MOTIF_NOTION = /^[a-z]{2,20}$/
const NUMERO_MAX = 99

/**
 * Traduit un chemin en destination. Fonction pure : c'est elle qui porte toute
 * la logique, le hook plus bas n'est qu'un abonnement à `popstate`.
 */
export function analyser(chemin: string): Destination {
  const morceaux = chemin.split('/').filter(Boolean)
  if (morceaux.length === 0) return { vue: 'connexion' }
  if (morceaux.length === 1 && morceaux[0] === 'prof') return { vue: 'prof' }
  if (morceaux.length === 1 && morceaux[0] === 'quiz') return { vue: 'quiz' }
  if (morceaux.length === 2 && morceaux[0] === 'prof' && morceaux[1] === 'quiz') {
    return { vue: 'prof-quiz' }
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
      return '/prof'
    case 'prof-quiz':
      return '/prof/quiz'
    case 'quiz':
      return '/quiz'
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
