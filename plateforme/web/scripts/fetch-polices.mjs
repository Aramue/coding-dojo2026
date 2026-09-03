// Récupère les polices auto-hébergées (WOFF2) nécessaires à la charte
// visuelle et les place dans public/polices/. Ces fichiers sont versionnés
// dans le dépôt : aucune requête vers fonts.googleapis.com ni
// api.fontshare.com ne doit avoir lieu au chargement de l'application
// (public mineur, hébergement UNIGE — on ne transmet pas les adresses IP
// des élèves à un tiers).
//
// Usage : pnpm run polices:fetch
//
// Principe : les deux fournisseurs (Fontshare, Google Fonts) ne livrent pas
// des fichiers aux noms stables — ce sont des feuilles CSS @font-face dont
// les URL pointent vers des noms opaques, différents à chaque génération.
// On récupère la feuille, on en extrait les URL et la graisse de chaque
// @font-face, on télécharge le binaire, puis on le renomme d'après la
// graisse pour obtenir les noms attendus par base.css.

import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ICI = path.dirname(fileURLToPath(import.meta.url))
const DEST = path.join(ICI, '..', 'public', 'polices')

// Un User-Agent de navigateur récent est indispensable : Google Fonts choisit
// le format renvoyé (WOFF2, WOFF ou TTF) selon l'en-tête User-Agent, et sans
// en-tête moderne il renvoie du TTF, inutilisable ici.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

/** Découpe une feuille CSS en blocs `@font-face { ... }`. */
function blocsFontFace(css) {
  const blocs = []
  const re = /@font-face\s*\{([^}]*)\}/g
  let m
  while ((m = re.exec(css))) blocs.push(m[1])
  return blocs
}

function poidsDuBloc(bloc) {
  const m = bloc.match(/font-weight:\s*(\d+)/)
  return m ? Number(m[1]) : null
}

/** Première URL `.woff2` référencée dans le bloc, protocole forcé en https. */
function urlWoff2DuBloc(bloc) {
  const m = bloc.match(/url\((['"]?)([^'")]+\.woff2)\1\)/)
  if (!m) return null
  const url = m[2]
  return url.startsWith('//') ? `https:${url}` : url
}

async function telecharger(url, cible) {
  const reponse = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!reponse.ok) {
    throw new Error(`Échec du téléchargement de ${url} (${reponse.status} ${reponse.statusText})`)
  }
  const octets = Buffer.from(await reponse.arrayBuffer())
  await writeFile(cible, octets)
  console.log(`  ${path.basename(cible)} : ${octets.length.toLocaleString('fr-FR')} octets`)
}

/** General Sans 400/500/700 depuis l'API Fontshare. */
async function recupererGeneralSans() {
  const url = 'https://api.fontshare.com/v2/css?f[]=general-sans@400,500,700'
  console.log(`Récupération de General Sans depuis ${url}`)
  const reponse = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!reponse.ok) {
    throw new Error(`Échec de récupération de la feuille Fontshare (${reponse.status} ${reponse.statusText})`)
  }
  const css = await reponse.text()

  const graisses = [400, 500, 700]
  for (const graisse of graisses) {
    const bloc = blocsFontFace(css).find((b) => poidsDuBloc(b) === graisse)
    if (!bloc) throw new Error(`Aucun @font-face General Sans ${graisse} dans la feuille Fontshare`)
    const url2 = urlWoff2DuBloc(bloc)
    if (!url2) throw new Error(`Aucune URL .woff2 pour General Sans ${graisse}`)
    await telecharger(url2, path.join(DEST, `general-sans-${graisse}.woff2`))
  }
}

/**
 * JetBrains Mono 400/500 depuis Google Fonts. Google renvoie un bloc
 * @font-face par sous-ensemble Unicode (cyrillic, greek, vietnamese...) pour
 * chaque graisse ; on ne veut que le sous-ensemble latin de base
 * (U+0000-00FF), qui couvre l'ASCII et les caractères accentués français.
 *
 * Piège constaté : une requête combinée `wght@400;500` fait renvoyer par
 * Google **la même URL** (donc le même binaire) pour les deux graisses —
 * l'instanciation statique du fonte variable dédoublonne apparemment les
 * deux sorties dans ce cas précis. Une requête séparée par graisse
 * (`wght@400` puis `wght@500`) renvoie bien deux fichiers distincts : c'est
 * donc une requête par graisse qu'on émet ici, pas la requête combinée.
 */
async function recupererJetBrainsMono() {
  const graisses = [400, 500]
  for (const graisse of graisses) {
    const url = `https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@${graisse}`
    console.log(`Récupération de JetBrains Mono ${graisse} depuis ${url}`)
    const reponse = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (!reponse.ok) {
      throw new Error(`Échec de récupération de la feuille Google Fonts (${reponse.status} ${reponse.statusText})`)
    }
    const css = await reponse.text()
    const bloc = blocsFontFace(css).find((b) => poidsDuBloc(b) === graisse && b.includes('U+0000-00FF'))
    if (!bloc) throw new Error(`Aucun sous-ensemble latin pour JetBrains Mono ${graisse}`)
    const url2 = urlWoff2DuBloc(bloc)
    if (!url2) throw new Error(`Aucune URL .woff2 pour JetBrains Mono ${graisse}`)
    await telecharger(url2, path.join(DEST, `jetbrains-mono-${graisse}.woff2`))
  }
}

async function main() {
  await mkdir(DEST, { recursive: true })
  await recupererGeneralSans()
  await recupererJetBrainsMono()
  console.log('\nTerminé. public/polices/ contient les 5 fichiers WOFF2 attendus par base.css.')
}

main().catch((erreur) => {
  console.error(erreur.message)
  process.exit(1)
})
