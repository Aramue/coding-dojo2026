/**
 * Le client des routes de gestion de classe. Toutes portent le jeton
 * professeur, aucune ne passe par le jeton élève.
 */

export type EleveInscrit = {
  code_acces: string
  prenom: string
  nom: string
  etablissement: string
  cree_le: string
  vu_le: string
  /** Nombre de tentatives enregistrées : ce qu'une suppression emporterait. */
  tentatives: number
}

/** Ce que le professeur saisit. Le code, lui, est tiré par le serveur. */
export type Fiche = { prenom: string; nom: string; etablissement: string }

export const FICHE_VIDE: Fiche = { prenom: '', nom: '', etablissement: '' }

async function appeler(
  jetonProf: string,
  chemin: string,
  options: RequestInit = {},
): Promise<unknown> {
  const reponse = await fetch(`/api/prof${chemin}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'X-Jeton-Prof': jetonProf },
  })
  if (reponse.status === 401) {
    throw new Error('Session professeur refusée ou expirée : reconnecte-toi.')
  }
  if (reponse.status === 422) throw new Error('Le prénom est obligatoire.')
  if (reponse.status === 404) throw new Error("Cet élève n'existe plus.")
  if (!reponse.ok) throw new Error(`La plateforme a refusé (erreur ${reponse.status}).`)
  return reponse.json()
}

export async function listerEleves(jetonProf: string): Promise<EleveInscrit[]> {
  const donnees = (await appeler(jetonProf, '/eleves')) as { eleves?: unknown }
  // Même garde que sur la séance : un non-tableau dans l'état ferait planter le
  // premier `.map` du rendu, et l'écran du professeur deviendrait blanc.
  if (!Array.isArray(donnees?.eleves)) throw new Error('Réponse inattendue de la plateforme.')
  return donnees.eleves as EleveInscrit[]
}

export function creerEleve(jetonProf: string, fiche: Fiche): Promise<unknown> {
  return appeler(jetonProf, '/eleves', { method: 'POST', body: JSON.stringify(fiche) })
}

export function modifierEleve(jetonProf: string, code: string, fiche: Fiche): Promise<unknown> {
  return appeler(jetonProf, `/eleves/${code}`, { method: 'PATCH', body: JSON.stringify(fiche) })
}

export function retirerEleve(jetonProf: string, code: string): Promise<unknown> {
  return appeler(jetonProf, `/eleves/${code}`, { method: 'DELETE' })
}

/**
 * Découpe une liste collée depuis un tableur ou une feuille d'appel.
 *
 * Vingt-quatre élèves saisis un par un dans un formulaire, c'est vingt-quatre
 * fois trois champs et un bouton. ==Le professeur a déjà sa liste quelque
 * part== : il la colle.
 *
 * Une ligne par élève. Les colonnes se séparent par une tabulation, un
 * point-virgule ou une virgule — dans cet ordre de priorité, parce qu'un nom
 * composé contient une virgule bien plus souvent qu'une tabulation. Sans
 * séparateur, le premier mot est le prénom et le reste le nom.
 */
export function decouperListe(colle: string): Fiche[] {
  const fiches: Fiche[] = []
  for (const brute of colle.split('\n')) {
    const ligne = brute.trim()
    if (!ligne) continue

    const separateur = ['\t', ';', ','].find((s) => ligne.includes(s))
    const morceaux = (separateur ? ligne.split(separateur) : ligne.split(/\s+/)).map((m) => m.trim())

    // Un copier-coller de tableur amene souvent une colonne vide en tete. Sans
    // ce retrait, la ligne donnerait un prenom vide et serait silencieusement
    // ignoree : un eleve de moins, sans que rien ne le signale.
    while (morceaux.length > 0 && morceaux[0] === '') morceaux.shift()

    const [prenom = '', ...reste] = morceaux
    if (!prenom) continue
    fiches.push({
      prenom,
      // Sans séparateur, tout ce qui suit le premier mot est le nom : « Marie
      // Anne Dupont » donne « Marie » et « Anne Dupont ».
      nom: separateur ? (reste[0] ?? '') : reste.join(' '),
      etablissement: separateur ? (reste[1] ?? '') : '',
    })
  }
  return fiches
}
