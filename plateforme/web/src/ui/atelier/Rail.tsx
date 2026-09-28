import { useState, type DragEvent } from 'react'

/**
 * Le rail des fichiers ouverts, et la zone où on les dépose.
 *
 * Un fichier refusé **reste dans le rail**, marqué, avec sa raison : le
 * retirer en silence laisserait croire qu'on ne l'a jamais lâché. Les autres
 * se chargent quand même — déposer une séance entière ne doit pas échouer en
 * bloc pour un fichier de travers.
 */
export type Ouvert = {
  nom: string
  /** `null` quand le fichier a été refusé ; la raison est alors dans `refus`. */
  brouillon: unknown | null
  refus?: string
  /** Le fichier portait des commentaires, que l'export ne rendra pas. */
  commente?: boolean
}

export function Rail({
  ouverts,
  courant,
  onChoisir,
  onDeposer,
  onFermer,
}: {
  ouverts: Ouvert[]
  courant: number | null
  onChoisir: (rang: number) => void
  onDeposer: (fichiers: File[]) => void
  onFermer: (rang: number) => void
}) {
  const [survole, setSurvole] = useState(false)

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
          des exercices déjà écrits — ou remplis le formulaire pour en commencer un neuf.
        </p>
      ) : (
        <ul className="rail__liste">
          {ouverts.map((ouvert, rang) => (
            <li key={`${ouvert.nom}-${rang}`}>
              <button
                type="button"
                className="rail__fichier"
                // Nommé explicitement : le bouton « Retirer » porte le même
                // nom de fichier, et rien ne les distinguerait.
                aria-label={`Ouvrir ${ouvert.nom}`}
                aria-current={rang === courant}
                data-refuse={Boolean(ouvert.refus)}
                disabled={Boolean(ouvert.refus)}
                onClick={() => onChoisir(rang)}
              >
                <span className="mono">{ouvert.nom}</span>
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
                onClick={() => onFermer(rang)}
                aria-label={`Retirer ${ouvert.nom}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
