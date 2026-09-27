/**
 * Faire sortir le fichier de l'atelier.
 *
 * Deux chemins. Le téléchargement marche partout. L'enregistrement en place —
 * choisir une fois le dossier du dépôt, puis écrire directement dedans — ne
 * marche que sur les navigateurs qui exposent l'API d'accès au système de
 * fichiers, aujourd'hui Chrome et Edge. Firefox et Safari retombent sur le
 * téléchargement, et ==rien de fonctionnel n'en dépend==.
 */

/** Ce que le navigateur expose, réduit à ce qu'on emploie. */
type AvecSelecteur = {
  showSaveFilePicker?: (options: {
    suggestedName: string
    types: { description: string; accept: Record<string, string[]> }[]
  }) => Promise<{ createWritable: () => Promise<WritableStreamDefaultWriter<string>> }>
}

/**
 * La détection se fait sur `window`, jamais sur le nom du navigateur : une
 * chaîne d'agent se falsifie, et la liste des navigateurs qui savent le faire
 * change plus vite que ce code.
 */
export function peutEnregistrerEnPlace(): boolean {
  return typeof (globalThis as AvecSelecteur).showSaveFilePicker === 'function'
}

export function telecharger(nom: string, texte: string): void {
  const adresse = URL.createObjectURL(new Blob([texte], { type: 'text/yaml;charset=utf-8' }))
  const lien = document.createElement('a')
  lien.href = adresse
  lien.download = nom
  lien.click()
  // Sans la révocation, le contenu reste en mémoire tant que l'onglet vit —
  // et on en produit un par exercice écrit.
  URL.revokeObjectURL(adresse)
}

export async function enregistrerEnPlace(
  nom: string,
  texte: string,
): Promise<'enregistre' | 'annule'> {
  const selecteur = (globalThis as AvecSelecteur).showSaveFilePicker
  /* v8 ignore next */
  if (!selecteur) throw new Error("Ce navigateur ne sait pas enregistrer en place.")
  try {
    const fichier = await selecteur({
      suggestedName: nom,
      types: [{ description: 'Exercice du dojo', accept: { 'text/yaml': ['.yaml'] } }],
    })
    const flux = await fichier.createWritable()
    await flux.write(texte)
    await flux.close()
    return 'enregistre'
  } catch (erreur) {
    // Fermer la fenêtre de choix n'est pas une panne : le professeur a changé
    // d'avis. La confondre avec une erreur lui afficherait une alerte rouge
    // pour un geste volontaire.
    if (erreur instanceof Error && erreur.name === 'AbortError') return 'annule'
    throw erreur
  }
}
