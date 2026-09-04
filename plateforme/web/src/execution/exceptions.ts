/**
 * Liste blanche des noms d'exception autorisés à quitter le navigateur.
 *
 * Tout le reste devient `AutreErreur` : un élève peut définir sa propre classe
 * d'exception et en choisir le nom, ce qui ferait sortir du texte de son cru.
 * Le tableau de bord n'a besoin que de la catégorie, jamais du détail.
 */
const EXCEPTIONS_DU_LANGAGE = new Set([
  'SyntaxError',
  'IndentationError',
  'TabError',
  'NameError',
  'UnboundLocalError',
  'TypeError',
  'ValueError',
  'ZeroDivisionError',
  'ArithmeticError',
  'OverflowError',
  'IndexError',
  'KeyError',
  'AttributeError',
  'ImportError',
  'ModuleNotFoundError',
  'EOFError',
  'RecursionError',
  'AssertionError',
  'StopIteration',
  'TimeoutError',
])

export function categorieErreur(nom: string | null | undefined): string | null {
  if (!nom) return null
  return EXCEPTIONS_DU_LANGAGE.has(nom) ? nom : 'AutreErreur'
}
