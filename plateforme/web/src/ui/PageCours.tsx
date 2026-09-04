import { useState } from 'react'
import type { GroupeNotion } from '../contenu/notions'
import type { Bloc } from '../contenu/types'
import type { Executeur } from '../execution/executeur'
import { BacASable } from './BacASable'
import { CarteCode } from './CarteCode'
import { formaterTexte } from './texte'
import './PageCours.css'

export function PageCours({
  groupe,
  executeur,
}: {
  groupe: GroupeNotion
  executeur: Executeur
}) {
  const { lecon } = groupe

  return (
    <main className="page" data-famille={groupe.famille}>
      <header className="page__entete">
        <p className="page__notion">{groupe.titre}</p>
        <h1 className="page__titre">{lecon ? lecon.titre : groupe.titre}</h1>
        {lecon && <p className="page__meta">{lecon.dureeMin} min de lecture</p>}
      </header>

      <div className="page__corps carte">
        {lecon ? (
          <article className="cours__corps">
            {lecon.blocs.map((bloc, index) => (
              <BlocRendu key={index} bloc={bloc} executeur={executeur} />
            ))}
          </article>
        ) : (
          <p className="cours__vide">
            Il n'y a pas encore de cours pour cette notion. Va directement aux exercices.
          </p>
        )}
      </div>
    </main>
  )
}

function BlocRendu({ bloc, executeur }: { bloc: Bloc; executeur: Executeur }) {
  const [ouvert, setOuvert] = useState(false)

  if (bloc.type === 'paragraphe') return <p>{formaterTexte(bloc.texte)}</p>
  if (bloc.type === 'attention') {
    return (
      <aside className="attention">
        <p>{formaterTexte(bloc.texte)}</p>
      </aside>
    )
  }

  return (
    <div className="cours__exemple">
      <CarteCode legende={bloc.legende}>
        <pre>{bloc.python.trimEnd()}</pre>
      </CarteCode>
      {bloc.executable && !ouvert && (
        <button type="button" className="bouton" onClick={() => setOuvert(true)}>
          Essayer
        </button>
      )}
      {bloc.executable && ouvert && <BacASable code={bloc.python} executeur={executeur} />}
    </div>
  )
}
