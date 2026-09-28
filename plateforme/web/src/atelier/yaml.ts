/**
 * Un brouillon devient le texte d'un fichier d'exercice.
 *
 * ==Ce n'est pas un émetteur YAML général==, et il ne doit pas le devenir :
 * c'est l'émetteur de CE format-là. Il connaît l'ordre des clés du modèle, il
 * sait qu'un énoncé s'écrit en bloc littéral et que des entrées tiennent sur
 * une ligne. Un émetteur général produirait du YAML valide mais illisible en
 * revue — `safe_dump` de PyYAML écrit les textes multilignes avec des `\n`
 * échappés, et trie les clés par ordre alphabétique.
 *
 * Le style reproduit est celui des 112 fichiers écrits à la main.
 */

import type { Test } from '../validation/types'
import type { Brouillon } from './brouillon'

/**
 * Ce qui oblige à mettre un scalaire entre guillemets.
 *
 * On ne cherche pas l'exhaustivité du standard : on attrape ce qui se produit
 * dans un titre d'exercice. Le `: ` a déjà mordu pendant l'écriture de la
 * séance 2 — un indice qui en contenait un se lisait comme une association et
 * cassait le chargement.
 */
const MOTS_RESERVES = new Set(['oui', 'non', 'yes', 'no', 'true', 'false', 'null', '~', 'on', 'off'])

function aBesoinDeGuillemets(valeur: string): boolean {
  if (valeur === '') return true
  if (MOTS_RESERVES.has(valeur.toLowerCase())) return true
  if (/^[-?:,[\]{}#&*!|>'"%@`]/.test(valeur)) return true
  if (/^[0-9.=]/.test(valeur)) return true
  if (/: |\s#|^\s|\s$/.test(valeur)) return true
  // Un guillemet double au milieu d'un scalaire ne gêne pas YAML, et les
  // fichiers du dépôt le laissent nu : `- print("Bonjour")`. L'entourer
  // produirait une forêt d'échappements pour rien.
  return false
}

function scalaire(valeur: string): string {
  if (!aBesoinDeGuillemets(valeur)) return valeur
  // Apostrophes simples quand la valeur porte un guillemet double : c'est ce
  // que fait le dépôt pour une option de QCM comme `'"Bonjour"'`.
  if (valeur.includes('"')) return `'${valeur.replace(/'/g, "''")}'`
  return `"${valeur.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

/**
 * Un texte sur plusieurs lignes, en bloc littéral.
 *
 * `|` garde le saut de ligne final, `|-` le retire. La distinction n'est pas
 * cosmétique : un `attendu` qui gagnerait un saut de ligne ne correspondrait
 * plus à la sortie du programme, et l'exercice deviendrait invalidable.
 */
function bloc(valeur: string, retrait: string): string {
  const finalSaute = valeur.endsWith('\n')
  const corps = finalSaute ? valeur.slice(0, -1) : valeur
  const lignes = corps
    .split('\n')
    // Une ligne vide reste vide : l'indenter laisserait des espaces en fin de
    // ligne, que la plupart des éditeurs retirent au premier enregistrement.
    .map((l) => (l === '' ? '' : `${retrait}  ${l}`))
    .join('\n')
  return `${finalSaute ? '|' : '|-'}\n${lignes}\n`
}

/**
 * `valeur: …`, en choisissant entre une ligne et un bloc.
 *
 * `toujoursEnBloc` force le bloc même sur une seule ligne. C'est le cas de
 * l'`attendu` dans les 112 fichiers du dépôt : une sortie de programme se lit
 * telle quelle, alignée sous sa clé, et jamais entre guillemets — où une
 * espace de fin devient invisible alors qu'elle change le verdict.
 */
function champ(cle: string, valeur: string, retrait = '', toujoursEnBloc = false): string {
  if (toujoursEnBloc || valeur.includes('\n')) return `${retrait}${cle}: ${bloc(valeur, retrait)}`
  return `${retrait}${cle}: ${scalaire(valeur)}\n`
}

/** Une liste courte sur une ligne : `entrees: ["4321"]`. */
function listeCourte(cle: string, valeurs: string[], retrait: string): string {
  const dedans = valeurs.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(', ')
  return `${retrait}${cle}: [${dedans}]\n`
}

/**
 * Une liste longue, un élément par ligne.
 *
 * Une valeur sur PLUSIEURS lignes ne peut pas sortir en scalaire nu : elle
 * produirait des lignes orphelines, sans tiret, et le fichier ne se
 * rechargerait plus. Une option de QCM en porte — s1-24 en a trois, qui
 * comparent trois sorties de programme. Elle s'écrit donc entre guillemets,
 * avec ses sauts échappés, comme le fait le dépôt.
 */
function listeLongue(cle: string, valeurs: string[], retrait: string): string {
  const lignes = valeurs
    .map((v) => {
      const rendu = v.includes('\n')
        ? `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
        : scalaire(v)
      return `${retrait}  - ${rendu}\n`
    })
    .join('')
  return `${retrait}${cle}:\n${lignes}`
}

/**
 * Un test, en entrée de liste. Le premier champ porte le tiret, les suivants
 * s'alignent dessous — c'est l'indentation des fichiers écrits à la main
 * (`sequence: 4, offset: 2` dans generer_attendu.py).
 */
function enTest(test: Test): string {
  const r = '    '
  let sortie = `  - type: ${test.type}\n`

  if (test.type === 'sortie') {
    sortie += listeCourte('entrees', test.entrees, r)
    sortie += champ('attendu', test.attendu, r, true)
    if (test.exigeExact) sortie += `${r}exige_exact: true\n`
    return sortie
  }
  if (test.type === 'variable') {
    sortie += champ('nom', test.nom, r)
    if (test.valeurAttendue !== undefined) sortie += champ('valeur_attendue', test.valeurAttendue, r)
    if (test.typeAttendu !== undefined) sortie += champ('type_attendu', test.typeAttendu, r)
    return sortie
  }
  if (test.type === 'qcm') {
    sortie += listeLongue('options', test.options, r)
    sortie += `${r}bonne_reponse: ${test.bonneReponse}\n`
    return sortie
  }
  sortie += champ('motif', test.motif, r)
  if (test.message !== undefined) sortie += champ('message', test.message, r)
  if (test.type === 'contient' && test.maitrise) sortie += `${r}maitrise: true\n`
  return sortie
}

/**
 * Un texte narratif ou du code : toujours en bloc, et toujours terminé par un
 * saut de ligne.
 *
 * Les 112 fichiers du dépôt écrivent `enonce`, `depart` et `solution` en `|`,
 * ==sans une seule exception==. Une chaîne sur une ligne est possible en YAML,
 * mais elle rompt l'alignement de la relecture — et un jour, quelqu'un y
 * mettra un deux-points.
 *
 * L'`attendu`, lui, garde la distinction `|` / `|-` : il est comparé au
 * caractère près, et un saut de ligne de trop y change le verdict.
 */
function texte(cle: string, valeur: string, retrait = ''): string {
  const termine = valeur.endsWith('\n') ? valeur : `${valeur}\n`
  return champ(cle, termine, retrait, true)
}

export function enYaml(brouillon: Brouillon): string {
  let sortie = ''
  // L'ordre des clés est celui du modèle Pydantic, jamais l'alphabétique :
  // un fichier se relit en revue, et l'identité vient avant le contenu.
  sortie += champ('id', brouillon.id)
  sortie += champ('concept', brouillon.concept)
  sortie += champ('notion', brouillon.notion)
  sortie += `seance: ${brouillon.seance}\n`
  sortie += champ('niveau', brouillon.niveau)
  sortie += champ('type', brouillon.type)
  sortie += champ('titre', brouillon.titre)
  sortie += `obligatoire: ${brouillon.obligatoire}\n`
  sortie += texte('enonce', brouillon.enonce)

  // `depart` s'écrit TOUJOURS, même vide : les 112 fichiers du dépôt le
  // portent tous, et son absence se lirait comme un oubli plutôt que comme un
  // exercice à écrire de zéro.
  sortie += brouillon.depart ? texte('depart', brouillon.depart) : `depart: ''\n`
  if (brouillon.indices.length > 0) sortie += listeLongue('indices', brouillon.indices, '')

  sortie += 'tests:\n'
  for (const test of brouillon.tests) sortie += enTest(test)

  sortie += texte('solution', brouillon.solution)
  if (brouillon.expert) sortie += champ('expert', brouillon.expert)
  return sortie
}

export function nomDeFichier(brouillon: Brouillon): string {
  return `${brouillon.id}.yaml`
}
