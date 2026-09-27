import { seanceDeLIdentifiant, type Brouillon } from '../../atelier/brouillon'
import { valeursDe, type SchemaPublie } from '../../atelier/schema'
import type { Notion } from '../../contenu/types'
import { Editeur } from '../Editeur'

/**
 * Les champs d'un exercice.
 *
 * Les énumérations viennent du schéma publié, la liste des notions de
 * `notions.json` : ==aucune des deux n'est recopiée ici==, elles divergeraient
 * au premier ajout et le professeur écrirait un fichier que la construction
 * refuserait.
 */
export function Formulaire({
  brouillon,
  notions,
  schema,
  onChange,
}: {
  brouillon: Brouillon
  notions: Notion[]
  schema: SchemaPublie
  onChange: (brouillon: Brouillon) => void
}) {
  const seance = seanceDeLIdentifiant(brouillon.id)

  function modifier(champs: Partial<Brouillon>) {
    const suivant = { ...brouillon, ...champs }
    // La séance suit l'identifiant, toujours. Les deux se sont suivis à la
    // main sur 112 fichiers, et le schéma refuse désormais le désaccord.
    suivant.seance = seanceDeLIdentifiant(suivant.id) ?? suivant.seance
    onChange(suivant)
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
              placeholder="s2-14"
              className="mono"
              onChange={(e) => modifier({ id: e.target.value.trim() })}
            />
          </label>
          <p className="champ__note">
            {seance === null
              ? 'Forme attendue : s2-14, ou s2-14-expert.'
              : `Séance ${seance}, déduite de l'identifiant.`}
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
            <span>Concept</span>
            <input
              value={brouillon.concept}
              placeholder="booleens"
              onChange={(e) => modifier({ concept: e.target.value })}
            />
          </label>
        </div>

        <div className="atelier__paire">
          <label className="champ">
            <span>Type</span>
            <select
              value={brouillon.type}
              onChange={(e) => modifier({ type: e.target.value as Brouillon['type'] })}
            >
              {valeursDe(schema, 'type').map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="champ">
            <span>Niveau</span>
            <select
              value={brouillon.niveau}
              onChange={(e) => modifier({ niveau: e.target.value as Brouillon['niveau'] })}
            >
              {valeursDe(schema, 'niveau').map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="champ champ--case">
          <input
            type="checkbox"
            checked={brouillon.obligatoire}
            onChange={(e) => modifier({ obligatoire: e.target.checked })}
          />
          <span>Obligatoire — il compte dans la progression de l'élève</span>
        </label>
      </section>

      <section className="atelier__bloc">
        <h2 className="atelier__titre">Énoncé</h2>
        <label className="champ">
          <span className="champ__invisible">Énoncé</span>
          <textarea
            rows={6}
            value={brouillon.enonce}
            onChange={(e) => modifier({ enonce: e.target.value })}
          />
        </label>
        <p className="champ__note">
          <code className="mono">**gras**</code>, <code className="mono">*italique*</code> et{' '}
          <code className="mono">`code`</code> sont rendus. Une ligne qui commence par un tiret
          devient une liste ; un bloc indenté devient une sortie.
        </p>
      </section>

      <section className="atelier__bloc">
        <h2 className="atelier__titre">Code de départ</h2>
        <Editeur valeur={brouillon.depart} onChange={(depart) => modifier({ depart })} />
        <p className="champ__note">
          Laissé vide pour un exercice à écrire de zéro. Sinon, il doit <strong>échouer</strong> —
          les essais le vérifient.
        </p>
      </section>

      <section className="atelier__bloc">
        <h2 className="atelier__titre">Solution de référence</h2>
        <Editeur valeur={brouillon.solution} onChange={(solution) => modifier({ solution })} />
        <p className="champ__note">Elle n'est jamais publiée : l'élève ne la reçoit pas.</p>
      </section>

      <section className="atelier__bloc">
        <h2 className="atelier__titre">Indices</h2>
        <label className="champ">
          <span className="champ__invisible">Indices, un par ligne</span>
          <textarea
            rows={3}
            value={brouillon.indices.join('\n')}
            onChange={(e) =>
              modifier({ indices: e.target.value === '' ? [] : e.target.value.split('\n') })
            }
          />
        </label>
        <p className="champ__note">
          Un par ligne, en <strong>texte brut</strong> : les indices ne sont pas formatés, et un{' '}
          <code className="mono">**</code> y resterait littéral.
        </p>
      </section>
    </>
  )
}
