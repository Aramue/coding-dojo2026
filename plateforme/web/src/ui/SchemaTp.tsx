import type { ReactNode } from 'react'
import './SchemaTp.css'

/**
 * Les schémas des consignes de TP, redessinés d'après les slides.
 *
 * En SVG et en React, pas en image : ils suivent la police et les couleurs de
 * la charte, restent nets à tout zoom, et leurs nombres sont du vrai texte —
 * un lecteur d'écran les lit, et la `description` de chaque schéma dit en
 * une phrase ce qu'il montre.
 *
 * Le contenu ne choisit qu'un NOM. Les dessins vivent ici, pas dans le YAML :
 * des coordonnées SVG dans un fichier de consignes seraient illisibles en
 * revue, et un schéma cassé ne s'y verrait pas.
 */
export const SCHEMAS = ['pixels', 'binaire', 'masque', 'octet', 'ligne'] as const
export type NomSchema = (typeof SCHEMAS)[number]

const ROUGE = '#C8372D'
const VERT = '#2E8B57'
const BLEU = '#3A6BC9'

export function SchemaTp({ nom, legende }: { nom: NomSchema; legende: string }) {
  const { dessin, description } = DESSINS[nom]
  return (
    <figure className="schema">
      <div className="schema__cadre">
        <svg viewBox={dessin.viewBox} role="img" aria-label={description}>
          {dessin.contenu}
        </svg>
      </div>
      <figcaption className="schema__legende">{legende}</figcaption>
    </figure>
  )
}

type Dessin = { viewBox: string; contenu: ReactNode }

/* ---------------------------------------------------------------- pixels */

function Pixels(): Dessin {
  const cote = 46
  const x0 = 110
  const y0 = 56
  const colonnes = 6
  const lignes = 3
  const cases = []
  for (let i = 0; i < lignes; i++) {
    for (let j = 0; j < colonnes; j++) {
      const cible = i === 1 && j === 4
      cases.push(
        <rect
          key={`${i}-${j}`}
          x={x0 + j * cote}
          y={y0 + i * cote}
          width={cote - 4}
          height={cote - 4}
          rx={6}
          className={cible ? 'schema__pixel schema__pixel--cible' : 'schema__pixel'}
        />,
      )
    }
  }
  return {
    viewBox: '0 0 720 250',
    contenu: (
      <>
        {/* numéros de colonnes : j */}
        {Array.from({ length: colonnes }, (_, j) => (
          <text key={`j${j}`} x={x0 + j * cote + 21} y={y0 - 12} className="schema__indice">
            {j}
          </text>
        ))}
        <text x={x0 + (colonnes * cote) / 2} y={20} className="schema__axe">
          colonne j →
        </text>
        {/* numéros de lignes : i */}
        {Array.from({ length: lignes }, (_, i) => (
          <text key={`i${i}`} x={x0 - 18} y={y0 + i * cote + 27} className="schema__indice">
            {i}
          </text>
        ))}
        <text x={4} y={y0 + (lignes * cote) / 2 + 4} className="schema__axe schema__axe--vertical">
          ligne i ↓
        </text>
        {cases}

        {/* la flèche vers le détail du pixel */}
        <path
          d={`M ${x0 + 4 * cote + 42} ${y0 + cote + 21} C 440 ${y0 + cote + 21}, 440 110, 470 110`}
          className="schema__fleche"
          markerEnd="url(#pointe-pixels)"
        />
        <defs>
          <marker id="pointe-pixels" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" className="schema__pointe" />
          </marker>
        </defs>

        <text x={480} y={62} className="schema__code">pixels_image[1][4]</text>
        {[
          ['R', 153, ROUGE],
          ['G', 50, VERT],
          ['B', 204, BLEU],
        ].map(([lettre, valeur, couleur], k) => (
          <g key={lettre as string} transform={`translate(${480 + k * 62} 80)`}>
            <rect width={54} height={54} rx={8} fill={couleur as string} />
            <text x={27} y={24} className="schema__canal">
              {lettre}
            </text>
            <text x={27} y={44} className="schema__canal schema__canal--valeur">
              {valeur}
            </text>
          </g>
        ))}
        <text x={480} y={160} className="schema__note">[r, g, b] — le rouge est en</text>
        <text x={480} y={180} className="schema__note">position 0 de la liste</text>
        <text x={480} y={214} className="schema__code schema__code--petit">
          pixels_image[1][4][0] → 153
        </text>
      </>
    ),
  }
}

/* --------------------------------------------------------------- binaire */

function Binaire(): Dessin {
  const bits = [1, 0, 1, 0, 1, 1, 0, 1]
  const poids = [128, 64, 32, 16, 8, 4, 2, 1]
  const cote = 64
  const x0 = 64
  return {
    viewBox: '0 0 640 300',
    contenu: (
      <>
        {poids.map((p, k) => {
          const x = x0 + k * cote
          const allume = bits[k] === 1
          return (
            <g key={p}>
              <text x={x + 30} y={28} className="schema__puissance">
                2<tspan dy={-8} className="schema__exposant">{7 - k}</tspan>
              </text>
              <text x={x + 30} y={56} className="schema__poids">
                {p}
              </text>
              <rect
                x={x}
                y={70}
                width={cote - 6}
                height={cote - 6}
                rx={8}
                className={allume ? 'schema__bit schema__bit--un' : 'schema__bit'}
              />
              <text x={x + 29} y={110} className={allume ? 'schema__chiffre schema__chiffre--un' : 'schema__chiffre'}>
                {bits[k]}
              </text>
              {allume && (
                <>
                  <path d={`M ${x + 29} 136 L ${x + 29} 160`} className="schema__fleche" markerEnd="url(#pointe-binaire)" />
                  <text x={x + 30} y={184} className="schema__ajout">
                    {p}
                  </text>
                </>
              )}
            </g>
          )
        })}
        <defs>
          <marker id="pointe-binaire" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" className="schema__pointe" />
          </marker>
        </defs>
        <text x={320} y={232} className="schema__somme">
          128 + 32 + 8 + 4 + 1 = <tspan className="schema__resultat">173</tspan>
        </text>
        <text x={320} y={270} className="schema__note schema__note--centre">
          Chaque case vaut le double de sa voisine de droite. On additionne les cases qui valent 1.
        </text>
      </>
    ),
  }
}

/* ---------------------------------------------------------------- masque */

function Masque(): Dessin {
  const rangs: [string, number[], string][] = [
    ['25', [0, 0, 0, 1, 1, 0, 0, 1], 'valeur du rouge'],
    ['masque 0b11', [0, 0, 0, 0, 0, 0, 1, 1], 'garde les 2 derniers bits'],
    ['25 & 0b11', [0, 0, 0, 0, 0, 0, 0, 1], 'résultat du ET'],
  ]
  const cote = 40
  const x0 = 150
  return {
    viewBox: '0 0 720 250',
    contenu: (
      <>
        {/* le bandeau des deux bits de poids faible */}
        <rect x={x0 + 6 * cote - 6} y={14} width={2 * cote + 8} height={190} rx={10} className="schema__bandeau" />
        <text x={x0 + 7 * cote} y={226} className="schema__note schema__note--centre">
          les 2 LSB
        </text>
        {rangs.map(([nom, bits, aide], r) => {
          const y = 26 + r * 60
          return (
            <g key={nom}>
              <text x={x0 - 16} y={y + 26} className="schema__nom">
                {nom}
              </text>
              {bits.map((b, k) => (
                <g key={k}>
                  <rect
                    x={x0 + k * cote}
                    y={y}
                    width={cote - 6}
                    height={cote - 2}
                    rx={6}
                    className={b ? 'schema__bit schema__bit--un' : 'schema__bit'}
                  />
                  <text x={x0 + k * cote + 17} y={y + 26} className={b ? 'schema__chiffre schema__chiffre--un schema__chiffre--petit' : 'schema__chiffre schema__chiffre--petit'}>
                    {b}
                  </text>
                </g>
              ))}
              <text x={x0 + 8 * cote + 22} y={y + 26} className="schema__note">
                {aide}
              </text>
              {r === 1 && <line x1={x0 - 4} x2={x0 + 8 * cote - 2} y1={y + 50} y2={y + 50} className="schema__trait" />}
            </g>
          )
        })}
      </>
    ),
  }
}

/* ----------------------------------------------------------------- octet */

function Octet(): Dessin {
  const pixels: [number, string][] = [
    [25, '00011001'],
    [203, '11001011'],
    [59, '00111011'],
    [121, '01111001'],
  ]
  return {
    viewBox: '0 0 640 300',
    contenu: (
      <>
        <text x={34} y={24} className="schema__titre-colonne">rouge</text>
        <text x={110} y={24} className="schema__titre-colonne">en binaire</text>
        <text x={300} y={24} className="schema__titre-colonne">2 LSB</text>
        {pixels.map(([valeur, binaire], k) => {
          const y = 40 + k * 52
          return (
            <g key={valeur}>
              <rect x={20} y={y} width={60} height={38} rx={8} fill={ROUGE} />
              <text x={50} y={y + 25} className="schema__canal schema__canal--valeur">
                {valeur}
              </text>
              <text x={110} y={y + 26} className="schema__mono">
                {binaire.slice(0, 6)}
                <tspan className="schema__mono--allume">{binaire.slice(6)}</tspan>
              </text>
              <path d={`M 262 ${y + 19} L 292 ${y + 19}`} className="schema__fleche" markerEnd="url(#pointe-octet)" />
              <rect x={300} y={y + 2} width={50} height={34} rx={8} className="schema__bit schema__bit--un" />
              <text x={325} y={y + 25} className="schema__chiffre schema__chiffre--un schema__chiffre--petit">
                {binaire.slice(6)}
              </text>
              <path
                d={`M 356 ${y + 19} C 390 ${y + 19}, 380 140, 410 140`}
                className="schema__fleche schema__fleche--fine"
              />
            </g>
          )
        })}
        <defs>
          <marker id="pointe-octet" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" className="schema__pointe" />
          </marker>
        </defs>
        <rect x={410} y={118} width={150} height={44} rx={10} className="schema__bit schema__bit--un" />
        <text x={485} y={147} className="schema__chiffre schema__chiffre--un schema__chiffre--petit">
          01110101
        </text>
        <path d="M 485 168 L 485 192" className="schema__fleche" markerEnd="url(#pointe-octet)" />
        <text x={485} y={214} className="schema__code schema__code--centre">int("01110101", 2) → 117</text>
        <path d="M 485 224 L 485 246" className="schema__fleche" markerEnd="url(#pointe-octet)" />
        <text x={485} y={276} className="schema__code schema__code--centre">chr(117) → "u"</text>
      </>
    ),
  }
}

/* ----------------------------------------------------------------- ligne */

function Ligne(): Dessin {
  const cases = 16
  const cote = 34
  const x0 = 40
  const couleurs = ['#E8C9A0', '#D9B48A', '#C9A57E', '#E2BE92']
  return {
    viewBox: '0 0 640 200',
    contenu: (
      <>
        <text x={x0} y={22} className="schema__nom schema__nom--gauche">
          ligne 0 de l'image
        </text>
        {Array.from({ length: cases }, (_, k) => (
          <rect
            key={k}
            x={x0 + k * cote}
            y={36}
            width={cote - 3}
            height={cote - 3}
            rx={4}
            fill={couleurs[k % couleurs.length]}
          />
        ))}
        <text x={x0 + cases * cote + 4} y={58} className="schema__note">…</text>
        {[0, 1, 2, 3].map((g) => {
          const x = x0 + g * 4 * cote
          return (
            <g key={g}>
              <path
                d={`M ${x + 2} 80 L ${x + 2} 88 L ${x + 4 * cote - 5} 88 L ${x + 4 * cote - 5} 80`}
                className="schema__accolade"
              />
              <text x={x + 2 * cote - 2} y={110} className="schema__lettre">
                lettre {g + 1}
              </text>
            </g>
          )
        })}
        <text x={x0} y={148} className="schema__note">
          4 pixels × 2 bits = 8 bits = 1 lettre
        </text>
        <text x={x0} y={174} className="schema__note">
          960 pixels → 1920 bits → 240 lettres, lues de la colonne 0 à la colonne 959
        </text>
      </>
    ),
  }
}

const DESSINS: Record<NomSchema, { dessin: Dessin; description: string }> = {
  pixels: {
    dessin: Pixels(),
    description:
      "Une image est une grille de pixels, repérés par leur ligne i et leur colonne j. Le pixel ligne 1, colonne 4 vaut [153, 50, 204] : rouge 153, vert 50, bleu 204.",
  },
  binaire: {
    dessin: Binaire(),
    description:
      'Le nombre binaire 10101101 : chaque case vaut 128, 64, 32, 16, 8, 4, 2, 1. Les cases à 1 font 128 + 32 + 8 + 4 + 1 = 173.',
  },
  masque: {
    dessin: Masque(),
    description:
      '25 vaut 00011001. Le ET avec le masque 00000011 met tout à 0 sauf les deux derniers bits : le résultat est 00000001.',
  },
  octet: {
    dessin: Octet(),
    description:
      'Quatre rouges, 25, 203, 59 et 121, donnent les paires 01, 11, 01, 01. Collées : 01110101, soit 117, soit la lettre u.',
  },
  ligne: {
    dessin: Ligne(),
    description:
      "La première ligne de l'image, découpée par groupes de quatre pixels : chaque groupe donne huit bits, donc une lettre.",
  },
}
