import { useId, useState, type DragEvent } from 'react'
import type { PoigneeFichier } from '../../atelier/depot'

/**
 * Le rail des fichiers ouverts, et la zone où on les dépose.
 *
 * Un fichier refusé **reste dans le rail**, marqué, avec sa raison : le
 * retirer en silence laisserait croire qu'on ne l'a jamais lâché. Les autres
 * se chargent quand même — déposer une séance entière ne doit pas échouer en
 * bloc pour un fichier de travers.
 */
export type Ouvert = {
  /**
   * Ce qui désigne le fichier, stable tant qu'il est ouvert.
   *
   * Pas son rang : retirer un fichier placé AVANT le courant décalait les
   * rangs, et les modifications suivantes partaient dans le voisin. Avec la
   * réécriture en place, c'était écrire un exercice dans le fichier d'un
   * autre.
   */
  cle: number
  nom: string
  /** Un exercice ou une lecon : le rail bascule l'atelier dessus. */
  sorte: 'exercice' | 'lecon'
  /** `null` quand le fichier a été refusé ; la raison est alors dans `refus`. */
  brouillon: unknown | null
  refus?: string
  /** Le fichier portait des commentaires, que l'export ne rendra pas. */
  commente?: boolean
  /** Changé depuis qu'il a été ouvert ou enregistré. */
  modifie?: boolean
  /**
   * Venu du dossier du dépôt : où il se réécrit, et ce qu'il contenait à la
   * lecture — pour s'apercevoir qu'il a changé sur le disque entre-temps.
   *
   * `horsStyle` : le fichier n'est pas écrit comme l'atelier l'écrirait. Le
   * réécrire change sa mise en page, pas son sens — mais le diff dépassera
   * la correction, et mieux vaut le savoir avant de le relire.
   */
  depot?: { chemin: string; poignee: PoigneeFichier; lu: string; horsStyle: boolean }
}

export function Rail({
  ouverts,
  courant,
  onChoisir,
  onDeposer,
  onFermer,
}: {
  ouverts: Ouvert[]
  /** La clé du fichier en cours d'édition. */
  courant: number | null
  onChoisir: (cle: number) => void
  onDeposer: (fichiers: File[]) => void
  onFermer: (cle: number) => void
}) {
  const [survole, setSurvole] = useState(false)
  const base = useId()

  function lacher(evenement: DragEvent) {
    evenement.preventDefault()
    setSurvole(false)
    const fichiers = [...evenement.dataTransfer.files].filter((f) => f.name.endsWith('.yaml'))
    if (fichiers.length > 0) onDeposer(fichiers)
  }

  return (
    <section
      className="rail"
      data-survole={survole}
      // `onDragOver` avec `preventDefault` est ce qui autorise le dépôt :
      // sans lui, le navigateur ouvre le fichier à la place de la page.
      onDragOver={(e) => {
        e.preventDefault()
        setSurvole(true)
      }}
      onDragLeave={() => setSurvole(false)}
      onDrop={lacher}
      aria-label="Fichiers ouverts"
    >
      {ouverts.length === 0 ? (
        <p className="rail__vide">
          Dépose ici un ou plusieurs fichiers <code className="mono">.yaml</code> pour reprendre
          des exercices ou des leçons déjà écrits — ou remplis le formulaire pour en commencer un
          neuf.
        </p>
      ) : (
        <ul className="rail__liste">
          {ouverts.map((ouvert) => {
            const etat = `${base}-${ouvert.cle}`
            return (
              <li key={ouvert.cle}>
                <button
                  type="button"
                  className="rail__fichier"
                  // Nommé explicitement : le bouton « Retirer » porte le même
                  // nom de fichier, et rien ne les distinguerait.
                  aria-label={`Ouvrir ${ouvert.nom}`}
                  // Le nom explicite masque le contenu du bouton : sans ce
                  // lien, un lecteur d'écran tairait « modifié ».
                  aria-describedby={ouvert.modifie ? etat : undefined}
                  aria-current={ouvert.cle === courant}
                  data-refuse={Boolean(ouvert.refus)}
                  disabled={Boolean(ouvert.refus)}
                  onClick={() => onChoisir(ouvert.cle)}
                >
                  <span className="rail__nom">
                    <span className="mono">{ouvert.nom}</span>
                    {ouvert.modifie && (
                      <span id={etat} className="rail__modifie">
                        modifié
                      </span>
                    )}
                  </span>
                  {ouvert.refus && <span className="rail__refus">{ouvert.refus}</span>}
                  {ouvert.commente && !ouvert.refus && (
                    <span className="rail__note">
                      Porte des commentaires : l'export ne les rendra pas.
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="rail__retirer"
                  onClick={() => onFermer(ouvert.cle)}
                  aria-label={`Retirer ${ouvert.nom}`}
                >
                  ×
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
