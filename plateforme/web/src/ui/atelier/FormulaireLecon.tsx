import { blocNeuf, type BrouillonLecon } from '../../atelier/lecon'
import type { Bloc, Notion } from '../../contenu/types'
import { Editeur } from '../Editeur'

/**
 * Les champs d'une leçon, et ses blocs.
 *
 * L'`ordre` ne se saisit pas : c'est celui de la notion, et le schéma refuse
 * le désaccord. Le montrer en lecture seule évite de faire croire qu'on peut
 * ranger une leçon ailleurs que là où sa notion la met.
 */
const SORTES: { type: Bloc['type']; libelle: string }[] = [
  { type: 'paragraphe', libelle: 'Paragraphe' },
  { type: 'attention', libelle: 'Attention' },
  { type: 'code', libelle: 'Code' },
]

export function FormulaireLecon({
  brouillon,
  notions,
  onChange,
}: {
  brouillon: BrouillonLecon
  notions: Notion[]
  onChange: (brouillon: BrouillonLecon) => void
}) {
  const notion = notions.find((n) => n.id === brouillon.notion)

  function modifier(champs: Partial<BrouillonLecon>) {
    onChange({ ...brouillon, ...champs })
  }

  function modifierBloc(index: number, bloc: Bloc) {
    modifier({ blocs: brouillon.blocs.map((b, i) => (i === index ? bloc : b)) })
  }

  function deplacer(index: number, pas: number) {
    const voisin = index + pas
    const blocs = [...brouillon.blocs]
    const [retire] = blocs.splice(index, 1)
    blocs.splice(voisin, 0, retire!)
    modifier({ blocs })
  }

  return (
    <>
      <section className="atelier__bloc">
        <h2 className="atelier__titre">Identité</h2>

        <div className="atelier__paire">
          <label className="champ">
            <span>Identifiant</span>
            <input
              value={brouillon.id}
              placeholder="c2-comparer"
              className="mono"
              onChange={(e) => modifier({ id: e.target.value.trim() })}
            />
          </label>
          <p className="champ__note">
            {notion
              ? `Ordre ${notion.ordre}, celui de sa notion.`
              : 'Forme attendue : c2-comparer.'}
          </p>
        </div>

        <label className="champ">
          <span>Titre</span>
          <input value={brouillon.titre} onChange={(e) => modifier({ titre: e.target.value })} />
        </label>

        <div className="atelier__paire">
          <label className="champ">
            <span>Notion</span>
            <select value={brouillon.notion} onChange={(e) => modifier({ notion: e.target.value })}>
              <option value="">à choisir</option>
              {notions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.titre}
                </option>
              ))}
            </select>
          </label>

          <label className="champ">
            <span>Durée de lecture, en minutes</span>
            <input
              type="number"
              min={1}
              max={30}
              value={brouillon.dureeMin}
              onChange={(e) => modifier({ dureeMin: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      <section className="atelier__bloc">
        <h2 className="atelier__titre">Blocs</h2>

        <ul className="cartes">
          {brouillon.blocs.map((bloc, index) => (
            <li key={index} className="carte-test" data-sorte={bloc.type}>
              <header className="carte-test__tete">
                <span className="carte-test__sorte">
                  {SORTES.find((s) => s.type === bloc.type)?.libelle}
                </span>
                <span>
                  <button
                    type="button"
                    className="carte-test__retirer"
                    disabled={index === 0}
                    aria-label={`Monter le bloc ${index + 1}`}
                    onClick={() => deplacer(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="carte-test__retirer"
                    disabled={index === brouillon.blocs.length - 1}
                    aria-label={`Descendre le bloc ${index + 1}`}
                    onClick={() => deplacer(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="carte-test__retirer"
                    onClick={() =>
                      modifier({ blocs: brouillon.blocs.filter((_, i) => i !== index) })
                    }
                  >
                    Retirer
                  </button>
                </span>
              </header>

              {bloc.type !== 'code' && (
                <label className="champ">
                  <span>Texte</span>
                  <textarea
                    rows={4}
                    value={bloc.texte}
                    onChange={(e) => modifierBloc(index, { ...bloc, texte: e.target.value })}
                  />
                </label>
              )}

              {bloc.type === 'code' && (
                <>
                  <label className="champ">
                    <span>Légende</span>
                    <input
                      value={bloc.legende}
                      onChange={(e) => modifierBloc(index, { ...bloc, legende: e.target.value })}
                    />
                  </label>
                  <Editeur
                    valeur={bloc.python}
                    onChange={(python) => modifierBloc(index, { ...bloc, python })}
                  />
                  <label className="champ champ--case">
                    <input
                      type="checkbox"
                      checked={bloc.executable}
                      disabled={bloc.entrees.length > 0}
                      onChange={(e) => modifierBloc(index, { ...bloc, executable: e.target.checked })}
                    />
                    <span>
                      Exécutable — l'élève peut le modifier et le lancer, sans verdict ni
                      progression
                    </span>
                  </label>
                  <label className="champ">
                    <span>Entrées simulées, une par ligne</span>
                    <textarea
                      rows={2}
                      value={bloc.entrees.join('\n')}
                      onChange={(e) => {
                        const entrees = e.target.value === '' ? [] : e.target.value.split('\n')
                        // Un bloc qui déclare des entrées ne peut pas être
                        // exécutable : le bac à sable ne sait pas les
                        // fournir, et l'élève tomberait sur une EOFError.
                        modifierBloc(index, {
                          ...bloc,
                          entrees,
                          executable: entrees.length > 0 ? false : bloc.executable,
                        })
                      }}
                    />
                  </label>
                  <p className="carte-test__aide">
                    Un bloc qui déclare des entrées ne peut pas être exécutable : le bac à sable
                    ne sait pas les fournir.
                  </p>
                </>
              )}
            </li>
          ))}
        </ul>

        <div className="cartes__ajout">
          {SORTES.map(({ type, libelle }) => (
            <button
              key={type}
              type="button"
              className="bouton"
              onClick={() => modifier({ blocs: [...brouillon.blocs, blocNeuf(type)] })}
            >
              + {libelle}
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
