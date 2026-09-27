import type { Test } from '../../validation/types'

/**
 * Les cartes de tests, une par test.
 *
 * Une carte n'affiche que les champs de SON type : un test `interdit` n'a pas
 * d'entrées, un `qcm` n'a pas de motif. Un formulaire qui montrerait tout
 * laisserait remplir des champs que le schéma refuse ensuite.
 */

const SORTES: { type: Test['type']; libelle: string; aide: string }[] = [
  { type: 'sortie', libelle: 'Sortie', aide: "Compare ce que le programme affiche." },
  { type: 'variable', libelle: 'Variable', aide: "Relit une variable après l'exécution." },
  { type: 'qcm', libelle: 'QCM', aide: 'Une question à choix, pour un exercice à prédire.' },
  { type: 'interdit', libelle: 'Interdit', aide: "Refuse un code qui contient ce texte." },
  { type: 'contient', libelle: 'Contient', aide: 'Exige ce texte dans le code.' },
]

function neuf(type: Test['type']): Test {
  if (type === 'sortie') return { type, entrees: [], attendu: '' }
  if (type === 'variable') return { type, nom: '' }
  if (type === 'qcm') return { type, options: ['', ''], bonneReponse: 0 }
  return { type, motif: '' }
}

export function Tests({
  tests,
  onChange,
  onRemplir,
}: {
  tests: Test[]
  onChange: (tests: Test[]) => void
  /** Remplit l'`attendu` de ce test depuis la solution. */
  onRemplir: (index: number) => void
}) {
  function modifier(index: number, test: Test) {
    onChange(tests.map((t, i) => (i === index ? test : t)))
  }

  return (
    <section className="atelier__bloc">
      <h2 className="atelier__titre">Tests</h2>

      <ul className="cartes">
        {tests.map((test, index) => (
          <li key={index} className="carte-test" data-sorte={test.type}>
            <header className="carte-test__tete">
              <span className="carte-test__sorte">
                {SORTES.find((s) => s.type === test.type)?.libelle}
              </span>
              <button
                type="button"
                className="carte-test__retirer"
                onClick={() => onChange(tests.filter((_, i) => i !== index))}
              >
                Retirer
              </button>
            </header>

            {test.type === 'sortie' && (
              <>
                <label className="champ">
                  <span>Entrées simulées, une par ligne</span>
                  <textarea
                    rows={2}
                    value={test.entrees.join('\n')}
                    onChange={(e) =>
                      modifier(index, {
                        ...test,
                        entrees: e.target.value === '' ? [] : e.target.value.split('\n'),
                      })
                    }
                  />
                </label>
                <label className="champ">
                  <span>Attendu</span>
                  <textarea rows={3} value={test.attendu} readOnly className="champ--calcule" />
                </label>
                <p className="carte-test__aide">
                  <button type="button" className="bouton" onClick={() => onRemplir(index)}>
                    Remplir depuis la solution
                  </button>{' '}
                  L'attendu ne se tape pas : il se calcule en exécutant la solution.
                </p>
                <label className="champ champ--case">
                  <input
                    type="checkbox"
                    checked={test.exigeExact ?? false}
                    onChange={(e) => modifier(index, { ...test, exigeExact: e.target.checked })}
                  />
                  <span>Exiger le format exact — accents, espaces et majuscules compris</span>
                </label>
              </>
            )}

            {test.type === 'variable' && (
              <>
                <label className="champ">
                  <span>Nom de la variable</span>
                  <input
                    value={test.nom}
                    onChange={(e) => modifier(index, { ...test, nom: e.target.value })}
                  />
                </label>
                <label className="champ">
                  <span>Valeur attendue, telle que Python l'écrit</span>
                  <input
                    value={test.valeurAttendue ?? ''}
                    onChange={(e) =>
                      modifier(index, { ...test, valeurAttendue: e.target.value || undefined })
                    }
                  />
                </label>
                <label className="champ">
                  <span>Type attendu</span>
                  <select
                    value={test.typeAttendu ?? ''}
                    onChange={(e) =>
                      modifier(index, { ...test, typeAttendu: e.target.value || undefined })
                    }
                  >
                    <option value="">peu importe</option>
                    {['int', 'float', 'str', 'bool'].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}

            {test.type === 'qcm' && (
              <>
                <label className="champ">
                  <span>Options, une par ligne</span>
                  <textarea
                    rows={4}
                    value={test.options.join('\n')}
                    onChange={(e) =>
                      modifier(index, { ...test, options: e.target.value.split('\n') })
                    }
                  />
                </label>
                <label className="champ">
                  <span>Numéro de la bonne réponse, à partir de 1</span>
                  <input
                    type="number"
                    min={1}
                    max={test.options.length}
                    value={test.bonneReponse + 1}
                    onChange={(e) =>
                      modifier(index, { ...test, bonneReponse: Number(e.target.value) - 1 })
                    }
                  />
                </label>
              </>
            )}

            {(test.type === 'interdit' || test.type === 'contient') && (
              <>
                <label className="champ">
                  <span>Motif</span>
                  <input
                    value={test.motif}
                    onChange={(e) => modifier(index, { ...test, motif: e.target.value })}
                  />
                </label>
                <p className="carte-test__aide">
                  Sans guillemets : un motif qui en contient ne bloque que cette ponctuation-là, et
                  se contourne en changeant de guillemets.
                </p>
                <label className="champ">
                  <span>Message pour l'élève, s'il en faut un</span>
                  <input
                    value={test.message ?? ''}
                    onChange={(e) =>
                      modifier(index, { ...test, message: e.target.value || undefined })
                    }
                  />
                </label>
                {test.type === 'contient' && (
                  <label className="champ champ--case">
                    <input
                      type="checkbox"
                      checked={test.maitrise ?? false}
                      onChange={(e) => modifier(index, { ...test, maitrise: e.target.checked })}
                    />
                    <span>
                      Critère de maîtrise — il donne la seconde coche, il ne bloque pas la première
                    </span>
                  </label>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="cartes__ajout">
        {SORTES.map(({ type, libelle, aide }) => (
          <button
            key={type}
            type="button"
            className="bouton"
            title={aide}
            onClick={() => onChange([...tests, neuf(type)])}
          >
            + {libelle}
          </button>
        ))}
      </div>
    </section>
  )
}
