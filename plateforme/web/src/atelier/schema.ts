/**
 * Le schéma publié, celui que Pydantic produit lui-même.
 *
 * Le formulaire s'y adosse pour ses énumérations, plutôt que d'en garder une
 * copie : une liste de types d'exercice recopiée en TypeScript divergerait au
 * premier ajout, et le professeur écrirait un fichier que la construction
 * refuserait. Même traitement que `notions.json`.
 */

import { chargerJson } from '../contenu/chargeur'

type Propriete = { enum?: unknown[] }
type SchemaObjet = { properties?: Record<string, Propriete>; required?: string[] }

export type SchemaPublie = { exercice: SchemaObjet; lecon: SchemaObjet }

export async function chargerSchema(): Promise<SchemaPublie> {
  const publie = await chargerJson<SchemaPublie>('/contenu/schema.json')
  if (!publie?.exercice?.properties) throw new Error('Schéma illisible.')
  return publie
}

/**
 * Les valeurs qu'un champ accepte, dans l'ordre du schéma.
 *
 * Rend une liste vide si le champ n'est pas une énumération : le formulaire
 * affiche alors un champ libre, ce qui est dégradé mais jamais cassé.
 */
export function valeursDe(schema: SchemaPublie, champ: string): string[] {
  const enumeration = schema.exercice.properties?.[champ]?.enum
  if (!Array.isArray(enumeration)) return []
  return enumeration.map(String)
}
