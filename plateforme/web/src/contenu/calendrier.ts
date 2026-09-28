import type { Chapitre, ContenuPublie } from './types'

/**
 * Le jour de l'élève, au format des dates d'ouverture : `AAAA-MM-JJ`.
 *
 * En heure LOCALE : `toISOString()` rend l'heure UTC, et à Genève il serait
 * encore la veille jusqu'à deux heures du matin.
 */
export function aujourdhui(maintenant = new Date()): string {
  const mois = String(maintenant.getMonth() + 1).padStart(2, '0')
  const jour = String(maintenant.getDate()).padStart(2, '0')
  return `${maintenant.getFullYear()}-${mois}-${jour}`
}

/** Sans date, un chapitre est ouvert d'emblée ; daté, il s'ouvre dès le matin de ce jour. */
export function estDisponible(chapitre: Chapitre, jour: string): boolean {
  return chapitre.ouverture === undefined || chapitre.ouverture <= jour
}

/** Les chapitres qui ne sont pas encore ouverts ce jour-là. */
export function chapitresAVenir(
  chapitres: Chapitre[],
  jour: string,
): (Chapitre & { ouverture: string })[] {
  return chapitres.filter((c): c is Chapitre & { ouverture: string } => !estDisponible(c, jour))
}

/**
 * Le contenu tel que l'élève le voit ce jour-là : sans les chapitres qui ne
 * sont pas encore ouverts, ni rien de ce qui leur appartient.
 *
 * Une séance publiée d'avance ne doit rien changer à celle qui se déroule —
 * ni le menu, ni le dénominateur de la jauge, ni la médiane du professeur.
 * Voir ADR-013.
 *
 * On retire ce qui est fermé, plutôt que de ne garder que ce qui est ouvert :
 * une notion dont le chapitre manque au contenu reste où elle était. Rien de
 * ce qui s'affichait avant cette règle ne disparaît à cause d'elle.
 */
export function contenuDisponible(contenu: ContenuPublie, jour: string): ContenuPublie {
  const fermes = new Set(chapitresAVenir(contenu.chapitres, jour).map((c) => c.id))
  const cachees = new Set(contenu.notions.filter((n) => fermes.has(n.chapitre)).map((n) => n.id))
  return {
    chapitres: contenu.chapitres.filter((c) => !fermes.has(c.id)),
    notions: contenu.notions.filter((n) => !cachees.has(n.id)),
    exercices: contenu.exercices.filter((e) => !cachees.has(e.notion)),
    lecons: contenu.lecons.filter((l) => !cachees.has(l.notion)),
  }
}

/** « mercredi 23 septembre » : la date comme on la dit dans une salle. */
export function dateLongue(iso: string): string {
  // Avec une heure, la chaîne se lit en heure locale. Sans heure, elle se lit
  // en UTC, et la veille s'afficherait partout à l'ouest de Greenwich.
  return new Date(`${iso}T12:00:00`).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}
