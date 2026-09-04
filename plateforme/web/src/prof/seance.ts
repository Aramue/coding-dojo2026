import type { Exercice, Notion } from '../contenu/types'

/**
 * Une ligne du tableau de bord, telle que `GET /prof/seance` la renvoie.
 *
 * Pas de `termine` : le déterminer supposerait de connaître le nombre total
 * d'exercices de la séance, que l'API ne possède pas — le contenu est construit
 * côté front. Le faire remonter par le client reviendrait à faire confiance au
 * navigateur d'un élève pour une donnée qui pilote l'affichage professeur.
 */
export type LigneEleve = {
  code_acces: string
  /** Vides tant que le professeur n'a rien saisi : l'écran retombe sur le code. */
  prenom?: string
  nom?: string
  /** Nul pour un élève inscrit qui n'a encore rien soumis. */
  exercice_id: string | null
  statut: 'bloque' | 'inactif' | 'pas_commence' | 'en_cours'
  echecs_consecutifs: number
  inactif_depuis_s: number
  dernier_type_erreur: string | null
  /** Les identifiants réussis, pas leur compte : seul le front sait lesquels sont obligatoires. */
  reussis: string[]
}

/** Ce qu'un identifiant d'exercice devient à l'écran du professeur. */
export type Repere = { titre: string; notion: string }

/**
 * `s1-29` ne dit rien à personne, pas même à celui qui a écrit l'exercice.
 * « L'âge qui refuse de s'additionner », dans « Demander une information », se
 * lit d'un coup d'œil et se dit à voix haute dans la salle.
 */
export function reperes(exercices: Exercice[], notions: Notion[]): Map<string, Repere> {
  const nomNotion = new Map(notions.map((n) => [n.id, n.titre]))
  return new Map(
    exercices.map((e) => [e.id, { titre: e.titre, notion: nomNotion.get(e.notion) ?? e.notion }]),
  )
}

/** Les exercices que la progression compte — voir ADR-004. */
export function obligatoires(exercices: Exercice[]): Set<string> {
  return new Set(exercices.filter((e) => e.obligatoire).map((e) => e.id))
}

export type Synthese = {
  bloques: number
  inactifs: number
  /** Inscrits qui n'ont encore rien soumis — invisibles avant la liste de classe. */
  pasCommence: number
  enCours: number
  /** Un nombre par élève, trié : la distribution, pas seulement sa moyenne. */
  avancements: number[]
  mediane: number
  total: number
}

/**
 * Où en est la classe, en une ligne.
 *
 * La distribution complète est conservée : elle montre l'écart entre celui qui
 * a fini et celui qui n'a pas commencé, ce qu'une moyenne efface exactement.
 */
export function synthese(eleves: LigneEleve[], comptes: Set<string>): Synthese {
  const avancements = eleves
    .map((e) => e.reussis.filter((id) => comptes.has(id)).length)
    .sort((a, b) => a - b)

  return {
    bloques: eleves.filter((e) => e.statut === 'bloque').length,
    inactifs: eleves.filter((e) => e.statut === 'inactif').length,
    pasCommence: eleves.filter((e) => e.statut === 'pas_commence').length,
    enCours: eleves.filter((e) => e.statut === 'en_cours').length,
    avancements,
    mediane: mediane(avancements),
    total: comptes.size,
  }
}

function mediane(triees: number[]): number {
  if (triees.length === 0) return 0
  const milieu = triees.length / 2
  if (triees.length % 2 === 1) return triees[Math.floor(milieu)]!
  return Math.round((triees[milieu - 1]! + triees[milieu]!) / 2)
}

export type BlocageCollectif = {
  exerciceId: string
  /** Les élèves bloqués là, nommés, dans l'ordre où l'API les a rendus. */
  eleves: string[]
  /** Les types d'exception rencontrés, du plus fréquent au moins fréquent. */
  erreurs: string[]
}

/**
 * Les exercices sur lesquels PLUSIEURS élèves butent en même temps.
 *
 * C'est le seul signal du tableau qui change ce que le professeur fait dans la
 * minute : un élève bloqué, on va le voir ; ==quatre élèves bloqués au même
 * endroit, on arrête la salle et on réexplique==. Sans ce regroupement,
 * l'information est dans le tableau mais il faut la reconstituer de tête, en
 * lisant vingt-quatre lignes.
 */
export function blocagesCollectifs(eleves: LigneEleve[], seuil = 2): BlocageCollectif[] {
  const parExercice = new Map<string, LigneEleve[]>()
  for (const eleve of eleves) {
    if (eleve.statut !== 'bloque' || !eleve.exercice_id) continue
    const liste = parExercice.get(eleve.exercice_id)
    if (liste) liste.push(eleve)
    else parExercice.set(eleve.exercice_id, [eleve])
  }

  return [...parExercice.entries()]
    .filter(([, liste]) => liste.length >= seuil)
    .map(([exerciceId, liste]) => ({
      exerciceId,
      eleves: liste.map(nommer),
      erreurs: frequences(liste.map((e) => e.dernier_type_erreur)),
    }))
    .sort((a, b) => b.eleves.length - a.eleves.length || a.exerciceId.localeCompare(b.exerciceId))
}

/** Les valeurs non nulles, de la plus fréquente à la moins fréquente. */
function frequences(valeurs: (string | null)[]): string[] {
  const compte = new Map<string, number>()
  for (const valeur of valeurs) {
    if (valeur === null) continue
    compte.set(valeur, (compte.get(valeur) ?? 0) + 1)
  }
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([nom]) => nom)
}

/**
 * Le nom qu'on lit à l'écran, ou le code tant qu'il n'y en a pas.
 *
 * Le professeur cherche quelqu'un dans une salle, pas une chaîne dans une
 * base : ==« Camille R. » se dit à voix haute, « DOJO-K7M2 » non==. Le nom de
 * famille est abrégé — vingt-quatre élèves de huit établissements tiennent
 * dans un prénom et une initiale, et la ligne reste lisible.
 */
export function nommer(eleve: LigneEleve): string {
  const prenom = eleve.prenom?.trim()
  if (!prenom) return eleve.code_acces
  const nom = eleve.nom?.trim()
  return nom ? `${prenom} ${nom[0]!.toUpperCase()}.` : prenom
}
