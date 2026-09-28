/**
 * Le dossier du dépôt, ouvert depuis l'atelier.
 *
 * C'est la seule source complète d'un exercice : ==les solutions ne sont
 * jamais publiées==, donc `/contenu/` ne peut pas servir à reprendre un
 * exercice pour le corriger. Le dépôt, lui, a tout — solution et
 * commentaires compris — et c'est aussi là que la correction doit atterrir.
 *
 * L'API d'accès au système de fichiers n'existe que sur Chrome et Edge. Sur
 * Firefox et Safari, le glisser-déposer reste le chemin, sans réécriture en
 * place.
 */

import { parseDocument } from 'yaml'

/** Ce qu'on emploie d'une poignée de fichier, réduit au nécessaire. */
export type PoigneeFichier = {
  kind: 'file'
  name: string
  getFile(): Promise<{ text(): Promise<string> }>
  createWritable(): Promise<{ write(texte: string): Promise<void>; close(): Promise<void> }>
}

export type PoigneeDossier = {
  kind: 'directory'
  name: string
  values(): AsyncIterable<PoigneeFichier | PoigneeDossier>
}

export type FichierDuDepot = {
  /** Le chemin depuis le dossier choisi, pour le montrer et le trier. */
  chemin: string
  poignee: PoigneeFichier
}

type AvecSelecteurDeDossier = {
  showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<PoigneeDossier>
}

/** Une entrée du catalogue : de quoi la retrouver par ce dont on se souvient. */
export type EntreeDuDepot = FichierDuDepot & {
  nom: string
  /** `null` quand le fichier ne se lit pas : il s'ouvrira quand même, refusé. */
  titre: string | null
}

/**
 * Ce qu'on ne parcourt jamais.
 *
 * Le professeur peut désigner la racine du dépôt plutôt que `contenu/` : sans
 * cette liste, on descendrait dans `node_modules` et ses dizaines de milliers
 * de dossiers, et l'atelier semblerait figé pendant une minute. Tout ce qui
 * commence par un point — `.git`, `.venv`, `.pytest_cache` — est écarté aussi.
 */
const A_ECARTER = new Set(['node_modules', 'dist', 'public', 'coverage', '__pycache__', 'htmlcov'])

/** Au-delà, ce n'est plus un dépôt de contenu, c'est une erreur de dossier. */
const PROFONDEUR_MAX = 8

const EXERCICE = /^s[1-9][0-9]?-[0-9]{2}(-expert)?\.yaml$/
const LECON = /^c[1-9][0-9]?-[a-z]+\.yaml$/

export function estUnFichierDeContenu(nom: string): boolean {
  return EXERCICE.test(nom) || LECON.test(nom)
}

/** La détection se fait sur `window`, jamais sur le nom du navigateur. */
export function peutOuvrirUnDossier(): boolean {
  return typeof (globalThis as AvecSelecteurDeDossier).showDirectoryPicker === 'function'
}

/**
 * Demande le dossier au professeur, en lecture ET écriture : c'est ce qui
 * permettra de réécrire une correction en place, sans rouvrir de sélecteur.
 *
 * Rend `null` s'il ferme la fenêtre — ce n'est pas une panne, il a changé
 * d'avis.
 */
export async function choisirDossier(): Promise<PoigneeDossier | null> {
  const selecteur = (globalThis as AvecSelecteurDeDossier).showDirectoryPicker
  /* v8 ignore next */
  if (!selecteur) throw new Error("Ce navigateur ne sait pas ouvrir un dossier.")
  try {
    return await selecteur({ mode: 'readwrite' })
  } catch (erreur) {
    if (erreur instanceof Error && erreur.name === 'AbortError') return null
    throw erreur
  }
}

/** Tous les fichiers d'exercice et de leçon sous le dossier, triés par chemin. */
export async function listerFichiers(dossier: PoigneeDossier): Promise<FichierDuDepot[]> {
  const trouves: FichierDuDepot[] = []

  async function parcourir(courant: PoigneeDossier, prefixe: string, profondeur: number) {
    if (profondeur > PROFONDEUR_MAX) return
    for await (const entree of courant.values()) {
      if (entree.name.startsWith('.') || A_ECARTER.has(entree.name)) continue
      const chemin = prefixe ? `${prefixe}/${entree.name}` : entree.name
      if (entree.kind === 'directory') await parcourir(entree, chemin, profondeur + 1)
      else if (estUnFichierDeContenu(entree.name)) trouves.push({ chemin, poignee: entree })
    }
  }

  await parcourir(dossier, '', 0)
  // Sans l'extension : `s2-01` passe alors avant `s2-01-expert`, sa variante.
  // `numeric` range la séance 2 avant la séance 10.
  const cle = (f: FichierDuDepot) => f.chemin.replace(/\.yaml$/, '')
  return trouves.sort((a, b) => cle(a).localeCompare(cle(b), 'fr', { numeric: true }))
}

/**
 * Le catalogue : chaque fichier avec son titre.
 *
 * On lit tout, d'un coup, pour le titre seul — on se souvient de « la boucle
 * qui compte mal », rarement de `s3-07`. Le fichier sera RELU quand on
 * l'ouvrira : entre-temps, il a pu changer dans l'éditeur du professeur.
 */
export async function cataloguer(dossier: PoigneeDossier): Promise<EntreeDuDepot[]> {
  const fichiers = await listerFichiers(dossier)
  return Promise.all(
    fichiers.map(async (fichier) => ({
      ...fichier,
      nom: fichier.poignee.name,
      titre: titreDe(await lireFichier(fichier.poignee).catch(() => '')),
    })),
  )
}

export function titreDe(texte: string): string | null {
  const document = parseDocument(texte)
  if (document.errors.length > 0) return null
  const titre = document.get('titre')
  return typeof titre === 'string' ? titre : null
}

export async function lireFichier(poignee: PoigneeFichier): Promise<string> {
  return (await poignee.getFile()).text()
}

export async function ecrireFichier(poignee: PoigneeFichier, texte: string): Promise<void> {
  const flux = await poignee.createWritable()
  await flux.write(texte)
  await flux.close()
}
