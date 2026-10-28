import { useState } from 'react'
import type { BlocTp, Tp } from '../contenu/types'
import type { Executeur } from '../execution/executeur'
import { BacASable } from './BacASable'
import { CarteCode } from './CarteCode'
import { formaterTexte } from './texte'
import './PageTp.css'

/**
 * Les consignes d'un TP, étape par étape.
 *
 * Le TP se fait dans un vrai Python, sur la machine de l'élève : la page ne
 * valide rien. Elle guide — un objectif par étape, ce qu'il faut voir à
 * l'écran avant de continuer, des indices repliés qu'on ouvre quand on bloque —
 * et retient les étapes cochées, le temps de l'onglet.
 *
 * `sessionStorage`, jamais `localStorage` : les machines des salles sont
 * partagées, et l'élève suivant ne doit pas trouver le TP à moitié coché.
 */
function cle(tp: Tp): string {
  return `dojo.tp.${tp.id}`
}

function lireCochees(tp: Tp): number[] {
  try {
    const brut: unknown = JSON.parse(sessionStorage.getItem(cle(tp)) ?? '[]')
    return Array.isArray(brut) ? brut.filter((n): n is number => typeof n === 'number') : []
  } catch {
    return []
  }
}

function memoriser(tp: Tp, cochees: number[]): void {
  try {
    sessionStorage.setItem(cle(tp), JSON.stringify(cochees))
  } catch {
    // Sans mémoire, les coches se perdent au rechargement. Rien de plus.
  }
}

export function PageTp({ tp, executeur }: { tp: Tp; executeur: Executeur }) {
  const [cochees, setCochees] = useState<number[]>(() => lireCochees(tp))
  const faites = tp.etapes.filter((_, rang) => cochees.includes(rang)).length

  function basculer(rang: number) {
    const suivantes = cochees.includes(rang)
      ? cochees.filter((n) => n !== rang)
      : [...cochees, rang]
    setCochees(suivantes)
    memoriser(tp, suivantes)
  }

  return (
    // Une couleur fixe : un TP réunit plusieurs notions, il n'en a pas une à lui.
    <main className="page tp" data-famille="boucles">
      <header className="page__entete">
        <p className="page__notion">Travail pratique</p>
        <h1 className="page__titre">{tp.titre}</h1>
        <p className="page__meta">
          Environ {tp.dureeMin} min · {tp.etapes.length} étapes · {faites} terminée
          {faites > 1 ? 's' : ''}
        </p>
      </header>

      <div className="page__corps carte tp__intro">
        {tp.introduction.map((bloc, index) => (
          <BlocRendu key={index} bloc={bloc} executeur={executeur} />
        ))}
        {tp.materiel.length > 0 && (
          <section className="tp__materiel" aria-label="Ce qu'il te faut">
            <h2>Ce qu'il te faut</h2>
            <ul>
              {tp.materiel.map((element) => (
                <li key={element}>{formaterTexte(element)}</li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <ol className="tp__etapes">
        {tp.etapes.map((etape, rang) => {
          const faite = cochees.includes(rang)
          return (
            <li key={etape.titre} className="tp__etape carte" data-faite={faite}>
              <h2 className="tp__titre" aria-label={`Étape ${rang + 1} : ${etape.titre}`}>
                <span className="tp__rang" aria-hidden="true">
                  {rang + 1}
                </span>
                <span>{etape.titre}</span>
              </h2>
              <p className="tp__objectif">
                <strong>Objectif :</strong> {formaterTexte(etape.objectif)}
              </p>
              {etape.blocs.map((bloc, index) => (
                <BlocRendu key={index} bloc={bloc} executeur={executeur} />
              ))}
              <label className="tp__coche">
                <input type="checkbox" checked={faite} onChange={() => basculer(rang)} />
                J'ai terminé l'étape {rang + 1}
              </label>
            </li>
          )
        })}
      </ol>
    </main>
  )
}

function BlocRendu({ bloc, executeur }: { bloc: BlocTp; executeur: Executeur }) {
  const [ouvert, setOuvert] = useState(false)

  if (bloc.type === 'paragraphe') return <p>{formaterTexte(bloc.texte)}</p>
  if (bloc.type === 'attention') {
    return (
      <aside className="attention">
        <p>{formaterTexte(bloc.texte)}</p>
      </aside>
    )
  }
  if (bloc.type === 'verifier') {
    return (
      <aside className="tp__verifier">
        <p>
          <strong>À vérifier avant de continuer :</strong> {formaterTexte(bloc.texte)}
        </p>
      </aside>
    )
  }
  if (bloc.type === 'indice') {
    return (
      <details className="tp__indice">
        <summary>Indice, si tu bloques</summary>
        <p>{formaterTexte(bloc.texte)}</p>
      </details>
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
