/**
 * De fausses poignées de fichiers, en mémoire, pour éprouver le dossier du
 * dépôt sans l'API d'accès au système de fichiers — jsdom ne l'a pas.
 *
 * Elles imitent ce qui compte du vrai comportement : ce qu'on écrit ne
 * remplace le contenu qu'à la FERMETURE du flux, comme sur le disque.
 */
import type { PoigneeDossier, PoigneeFichier } from '../../src/atelier/depot'

export type FauxFichier = PoigneeFichier & {
  /** Ce qu'il contient : ce que l'atelier y a écrit, ou ce qu'un test y a mis. */
  contenu: string
  /** Chaque écriture menée jusqu'à la fermeture, dans l'ordre. */
  ecrits: string[]
}

export function fichier(name: string, texte = ''): FauxFichier {
  const poignee: FauxFichier = {
    kind: 'file',
    name,
    contenu: texte,
    ecrits: [],
    getFile: async () => ({ text: async () => poignee.contenu }),
    createWritable: async () => {
      let tampon = ''
      return {
        write: async (t: string) => {
          tampon += t
        },
        close: async () => {
          poignee.contenu = tampon
          poignee.ecrits.push(tampon)
        },
      }
    },
  }
  return poignee
}

export function dossier(
  name: string,
  enfants: (PoigneeFichier | PoigneeDossier)[],
): PoigneeDossier {
  return {
    kind: 'directory',
    name,
    values: async function* () {
      yield* enfants
    },
  }
}
