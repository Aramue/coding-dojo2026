/**
 * Normalise une sortie de programme pour la comparaison tolerante du verdict BLEU.
 *
 * Ce qui est neutralise ici correspond exactement aux ecarts que le professeur
 * laissait passer en 2025 en ecrivant « BIEN PB AFFICHAGE » sur la copie.
 * En comparaison stricte, 6 eleves sur 17 auraient ete recales automatiquement.
 */
export function normaliser(texte: string): string {
  return texte
    .replace(/\r\n/g, '\n')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacritiques
    .replace(/[‘’‛]/g, "'") // apostrophes typographiques
    .replace(/[“”]/g, '"') // guillemets typographiques
    .replace(/[→➡]|->|:/g, '>') // fleches et deux-points unifies
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, '')
    .toLowerCase()
    .split('\n')
    .map((ligne) => ligne.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{2,}/g, '\n')
    .trim()
}
