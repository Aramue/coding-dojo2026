// Récupère les fichiers Pyodide nécessaires à l'exécution dans le navigateur
// et les place dans public/pyodide/ (versionnés dans le dépôt : le
// déploiement UNIGE ne doit dépendre d'aucun réseau externe).
//
// Usage : pnpm run pyodide:fetch [version]
// Par défaut, récupère la version 0.26.4 depuis le CDN jsDelivr.

import { mkdir, writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const VERSION = process.argv[2] ?? '0.26.4'
const BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full/`

const FICHIERS = ['pyodide.mjs', 'pyodide.asm.js', 'pyodide.asm.wasm', 'python_stdlib.zip', 'pyodide-lock.json']

const ICI = path.dirname(fileURLToPath(import.meta.url))
const DEST = path.join(ICI, '..', 'public', 'pyodide')

async function telecharger(nom) {
  const url = BASE_URL + nom
  const reponse = await fetch(url)
  if (!reponse.ok) {
    throw new Error(`Échec du téléchargement de ${nom} (${reponse.status} ${reponse.statusText}) depuis ${url}`)
  }
  const octets = Buffer.from(await reponse.arrayBuffer())
  await writeFile(path.join(DEST, nom), octets)
  console.log(`  ${nom} : ${octets.length.toLocaleString('fr-FR')} octets`)
}

async function main() {
  await mkdir(DEST, { recursive: true })
  console.log(`Récupération de Pyodide ${VERSION} depuis ${BASE_URL}`)
  for (const nom of FICHIERS) {
    await telecharger(nom)
  }
  const infos = await stat(path.join(DEST, 'pyodide.asm.wasm'))
  console.log(`\nTerminé. public/pyodide/pyodide.asm.wasm fait ${(infos.size / 1e6).toFixed(1)} Mo.`)
}

main().catch((erreur) => {
  console.error(erreur.message)
  process.exit(1)
})
