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
export const SCHEMAS = [
  'pixels',
  'binaire',
  'masque',
  'octet',
  'ligne',
  // Les leçons de git (séance 7)
  'versions',
  'github',
  'fork',
  'zones',
  'commits',
  'etats',
  'branches',
  'pullrequest',
] as const
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

/* ------------------------------------------------------------------- git */

/*
 * Les schémas de la séance 7. Des boîtes, des flèches et du texte : les mêmes
 * que les slides, dans les couleurs de la charte. `Boite` écrit un titre en gras
 * puis des lignes de précision ; `Fleche` trace un trait terminé par une pointe.
 */
const ETAT_NON_SUIVI = '#FF5F56'
const ETAT_INDEXE = '#8BE9FD'
const ETAT_VALIDE = '#27C93F'
const ETAT_MODIFIE = '#FFBD2E'
const ENCRE_ETAT = '#1E1B16'

function Pointe({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
        <path d="M0 0 L10 5 L0 10 z" className="schema__pointe" />
      </marker>
    </defs>
  )
}

function Boite({
  x,
  y,
  w,
  h,
  lignes,
  accent = false,
  fond,
}: {
  x: number
  y: number
  w: number
  h: number
  lignes: string[]
  accent?: boolean
  fond?: string
}) {
  const interligne = 18
  const haut = y + h / 2 - ((lignes.length - 1) * interligne) / 2 + 5
  const texte = fond ? ENCRE_ETAT : accent ? '#fff' : undefined
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        className={accent ? 'schema__boite schema__boite--accent' : 'schema__boite'}
        style={fond ? { fill: fond, stroke: fond } : undefined}
      />
      {lignes.map((ligne, i) => (
        <text
          key={i}
          x={x + w / 2}
          y={haut + i * interligne}
          className={i === 0 ? 'schema__titre-boite' : 'schema__sous-boite'}
          style={texte ? { fill: texte } : undefined}
        >
          {ligne}
        </text>
      ))}
    </g>
  )
}

function Fleche({ id, depuis, vers }: { id: string; depuis: [number, number]; vers: [number, number] }) {
  return (
    <path
      d={`M ${depuis[0]} ${depuis[1]} L ${vers[0]} ${vers[1]}`}
      className="schema__fleche"
      markerEnd={`url(#${id})`}
    />
  )
}

function Etiquette({ x, y, children }: { x: number; y: number; children: string }) {
  return (
    <text x={x} y={y} className="schema__etiquette">
      {children}
    </text>
  )
}

function Versions(): Dessin {
  const fichiers = ['rendu.py', 'rendu_v2.py', 'rendu_final.py', 'rendu_final_VRAI.py']
  const commits: [string, string][] = [
    ['c3d9f21', 'fix: corrige le calcul'],
    ['8a41b07', 'feat: ajoute la médiane'],
    ['5e2c6aa', 'feat: ajoute la moyenne'],
  ]
  return {
    viewBox: '0 0 720 270',
    contenu: (
      <>
        <text x={170} y={24} className="schema__axe">
          Sans git
        </text>
        {fichiers.map((nom, i) => (
          <g key={nom}>
            <rect x={40} y={44 + i * 50} width={260} height={36} rx={8} className="schema__boite" />
            <text x={56} y={67 + i * 50} className="schema__code schema__code--petit">
              {nom}
            </text>
          </g>
        ))}
        <text x={170} y={256} className="schema__note schema__note--g schema__note--centre">
          laquelle est la bonne ?
        </text>

        <text x={540} y={24} className="schema__axe">
          Avec git
        </text>
        <path d="M 430 62 L 430 186" className="schema__trait" />
        {commits.map(([hash, message], i) => (
          <g key={hash}>
            <circle cx={430} cy={62 + i * 62} r={11} className="schema__noeud" />
            <text x={454} y={59 + i * 62} className="schema__code schema__code--petit">
              {hash}
            </text>
            <text x={454} y={78 + i * 62} className="schema__note schema__note--g">
              {message}
            </text>
          </g>
        ))}
        <text x={540} y={256} className="schema__note schema__note--g schema__note--centre">
          un seul fichier, toutes ses versions
        </text>
      </>
    ),
  }
}

function Github(): Dessin {
  const id = 'pointe-github'
  return {
    viewBox: '0 0 720 200',
    contenu: (
      <>
        <Pointe id={id} />
        <Boite x={20} y={40} w={240} h={120} lignes={['Mon ordinateur', 'git, le logiciel', 'marche sans internet']} />
        <Boite x={460} y={40} w={240} h={120} lignes={['GitHub', 'un site web', 'héberge les dépôts']} accent />
        <Etiquette x={360} y={72}>git push</Etiquette>
        <Fleche id={id} depuis={[272, 84]} vers={[448, 84]} />
        <Fleche id={id} depuis={[448, 122]} vers={[272, 122]} />
        <Etiquette x={360} y={150}>git pull</Etiquette>
      </>
    ),
  }
}

function Fork(): Dessin {
  const id = 'pointe-fork'
  return {
    viewBox: '0 0 720 210',
    contenu: (
      <>
        <Pointe id={id} />
        <Boite x={0} y={50} w={160} h={110} lignes={['Dépôt du', 'professeur', 'sur GitHub']} />
        <Boite x={280} y={50} w={160} h={110} lignes={['Mon fork', 'sur GitHub,', 'dans mon compte']} accent />
        <Boite x={560} y={50} w={160} h={110} lignes={['Ma machine', 'un dossier,', 'chez moi']} />
        <Etiquette x={220} y={96}>Fork</Etiquette>
        <Fleche id={id} depuis={[168, 105]} vers={[272, 105]} />
        <Etiquette x={500} y={96}>git clone</Etiquette>
        <Fleche id={id} depuis={[448, 105]} vers={[552, 105]} />
        <text x={360} y={196} className="schema__note schema__note--g schema__note--centre">
          on clone son fork, jamais l'original
        </text>
      </>
    ),
  }
}

function Zones(): Dessin {
  const id = 'pointe-zones'
  const xs = [0, 203, 406, 609] as const
  const col = (i: number): number => xs[i] ?? 0
  return {
    viewBox: '0 0 720 250',
    contenu: (
      <>
        <Pointe id={id} />
        <Boite x={xs[0]} y={40} w={110} h={100} lignes={['Dossier', 'de travail', 'mes fichiers']} />
        <Boite x={xs[1]} y={40} w={110} h={100} lignes={['Index', 'ce que je', 'choisis']} />
        <Boite x={xs[2]} y={40} w={110} h={100} lignes={['Dépôt local', 'mon historique']} />
        <Boite x={xs[3]} y={40} w={110} h={100} lignes={['GitHub', 'le dépôt', 'distant']} accent />
        {['git add', 'git commit', 'git push'].map((nom, i) => (
          <g key={nom}>
            <Etiquette x={col(i) + 156} y={76}>{nom}</Etiquette>
            <Fleche id={id} depuis={[col(i) + 116, 92]} vers={[col(i) + 197, 92]} />
          </g>
        ))}
        <path d="M 664 146 L 664 200 L 55 200 L 55 148" className="schema__fleche" markerEnd={`url(#${id})`} />
        <Etiquette x={360} y={224}>git pull</Etiquette>
      </>
    ),
  }
}

function Commits(): Dessin {
  const id = 'pointe-commits'
  return {
    viewBox: '0 0 720 200',
    contenu: (
      <>
        <Pointe id={id} />
        <text x={80} y={32} className="schema__note schema__note--g schema__note--centre">
          le plus ancien
        </text>
        <text x={640} y={32} className="schema__note schema__note--g schema__note--centre">
          le plus récent
        </text>
        <Boite x={0} y={46} w={160} h={90} lignes={['5e2c6aa', 'feat: ajoute', 'la moyenne']} />
        <Boite x={280} y={46} w={160} h={90} lignes={['8a41b07', 'feat: ajoute', 'la médiane']} />
        <Boite x={560} y={46} w={160} h={90} lignes={['c3d9f21', 'fix: corrige', 'le calcul']} accent />
        <Fleche id={id} depuis={[552, 91]} vers={[448, 91]} />
        <Fleche id={id} depuis={[272, 91]} vers={[168, 91]} />
        <text x={360} y={176} className="schema__note schema__note--g schema__note--centre">
          chaque commit se souvient du précédent
        </text>
      </>
    ),
  }
}

function Etats(): Dessin {
  const id = 'pointe-etats'
  const xs = [0, 203, 406, 609] as const
  const col = (i: number): number => xs[i] ?? 0
  return {
    viewBox: '0 0 720 270',
    contenu: (
      <>
        <Pointe id={id} />
        <Boite x={xs[0]} y={40} w={110} h={110} lignes={['Non suivi', 'git le voit,', 'ne le suit pas']} fond={ETAT_NON_SUIVI} />
        <Boite x={xs[1]} y={40} w={110} h={110} lignes={['Indexé', 'prêt pour le', 'commit']} fond={ETAT_INDEXE} />
        <Boite x={xs[2]} y={40} w={110} h={110} lignes={['Validé', 'dans', "l'historique"]} fond={ETAT_VALIDE} />
        <Boite x={xs[3]} y={40} w={110} h={110} lignes={['Modifié', 'changé depuis', 'le dernier', 'commit']} fond={ETAT_MODIFIE} />
        {['git add', 'git commit', 'je modifie'].map((nom, i) => (
          <g key={nom}>
            <Etiquette x={col(i) + 156} y={90}>{nom}</Etiquette>
            <Fleche id={id} depuis={[col(i) + 116, 105]} vers={[col(i) + 197, 105]} />
          </g>
        ))}
        <path d="M 664 156 L 664 210 L 258 210 L 258 158" className="schema__fleche" markerEnd={`url(#${id})`} />
        <Etiquette x={460} y={236}>git add</Etiquette>
      </>
    ),
  }
}

function Branches(): Dessin {
  return {
    viewBox: '0 0 720 240',
    contenu: (
      <>
        <path d="M 60 170 L 660 170" className="schema__trait schema__trait--epais" />
        <path d="M 190 170 L 320 70 L 430 70 L 540 170" className="schema__trait schema__trait--epais" />
        {[60, 190, 660].map((x) => (
          <circle key={x} cx={x} cy={170} r={13} className="schema__noeud" />
        ))}
        <circle cx={540} cy={170} r={13} className="schema__noeud schema__noeud--fusion" />
        {[320, 430].map((x) => (
          <circle key={x} cx={x} cy={70} r={13} className="schema__noeud" />
        ))}
        <text x={60} y={208} className="schema__code schema__code--centre">
          main
        </text>
        <text x={375} y={42} className="schema__code schema__code--centre">
          ma-fonction
        </text>
        <text x={190} y={228} className="schema__note schema__note--g schema__note--centre">
          git switch -c ma-fonction
        </text>
        <text x={540} y={228} className="schema__note schema__note--g schema__note--centre">
          pull request, puis fusion
        </text>
      </>
    ),
  }
}

function PullRequest(): Dessin {
  const id = 'pointe-pr'
  const xs = [0, 190, 380, 570] as const
  const col = (i: number): number => xs[i] ?? 0
  const etapes: string[][] = [
    ['1', 'Je pousse', 'ma branche'],
    ['2', "J'ouvre une", 'pull request'],
    ['3', 'On relit et', 'on commente'],
    ['4', 'On fusionne', 'dans main'],
  ]
  return {
    viewBox: '0 0 720 190',
    contenu: (
      <>
        <Pointe id={id} />
        {etapes.map((lignes, i) => (
          <Boite key={lignes[0]} x={col(i)} y={30} w={150} h={100} lignes={lignes} accent={i === 3} />
        ))}
        {[0, 1, 2].map((i) => (
          <Fleche key={i} id={id} depuis={[col(i) + 154, 80]} vers={[col(i) + 186, 80]} />
        ))}
        <text x={360} y={164} className="schema__note schema__note--g schema__note--centre">
          sur GitLab : merge request, c'est la même idée
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
  versions: {
    dessin: Versions(),
    description:
      'Sans git, quatre fichiers rendu, rendu_v2, rendu_final et rendu_final_VRAI : on ne sait pas lequel est le bon. Avec git, un seul fichier et une liste de commits, du plus récent au plus ancien.',
  },
  github: {
    dessin: Github(),
    description:
      'Git est un logiciel sur mon ordinateur, GitHub est un site. git push envoie mes commits vers GitHub, git pull rapporte ceux des autres.',
  },
  fork: {
    dessin: Fork(),
    description:
      "Le fork copie le dépôt du professeur dans mon compte GitHub. git clone copie ensuite mon fork sur ma machine. On clone son fork, jamais l'original.",
  },
  zones: {
    dessin: Zones(),
    description:
      "Quatre endroits : le dossier de travail, l'index, le dépôt local et GitHub. git add va du dossier à l'index, git commit de l'index au dépôt local, git push du dépôt local à GitHub, et git pull ramène GitHub dans le dossier.",
  },
  commits: {
    dessin: Commits(),
    description:
      'Trois commits reliés, du plus ancien au plus récent : 5e2c6aa ajoute la moyenne, 8a41b07 ajoute la médiane, c3d9f21 corrige le calcul. Chaque commit se souvient du précédent.',
  },
  etats: {
    dessin: Etats(),
    description:
      "Les états d'un fichier : non suivi, puis indexé avec git add, puis validé avec git commit. Un fichier validé qu'on modifie devient modifié, et git add le remet dans l'index.",
  },
  branches: {
    dessin: Branches(),
    description:
      "La branche main est une ligne de commits. La branche ma-fonction part de main, reçoit deux commits, puis revient dans main par une fusion, pendant que main n'a pas bougé entre-temps.",
  },
  pullrequest: {
    dessin: PullRequest(),
    description:
      "Une pull request en quatre étapes : je pousse ma branche, j'ouvre la pull request, on relit et on commente, puis on fusionne dans main.",
  },
}
