import { CarteCode } from './CarteCode'
import './Terminal.css'

/**
 * Des commandes et leur retour, affichés tels quels : jamais exécutés.
 *
 * Un exemple de leçon est du Python et porte un bouton « Essayer ». Ce qui ne
 * l'est pas — git, un fichier de configuration — s'affiche dans la même carte
 * sombre, sans bouton. Les lignes se colorent d'après leur début, comme un
 * terminal : `$ ` pour une commande, `+` et `-` pour un diff, `!` pour un refus.
 */
type Genre = 'commande' | 'commentaire' | 'plus' | 'moins' | 'erreur' | 'marqueur' | 'texte'

export function genreLigne(ligne: string): Genre {
  if (ligne.startsWith('$ ')) return 'commande'
  if (ligne.startsWith('#') || ligne.startsWith('@@')) return 'commentaire'
  if (/^(<{7}|={7}|>{7})/.test(ligne)) return 'marqueur'
  if (ligne.startsWith('+')) return 'plus'
  if (ligne.startsWith('-')) return 'moins'
  if (ligne.startsWith('!') || ligne.startsWith('error')) return 'erreur'
  return 'texte'
}

export function Terminal({ legende, texte }: { legende: string; texte: string }) {
  const lignes = texte.trimEnd().split('\n')
  return (
    <CarteCode legende={legende}>
      <pre className="terminal">
        {lignes.map((ligne, i) => {
          const genre = genreLigne(ligne)
          return (
            <span key={i} className={`terminal__ligne terminal__ligne--${genre}`}>
              {genre === 'commande' ? (
                <>
                  <span className="terminal__invite">$ </span>
                  {ligne.slice(2)}
                </>
              ) : (
                ligne
              )}
              {'\n'}
            </span>
          )
        })}
      </pre>
    </CarteCode>
  )
}
