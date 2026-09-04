import { diffInformatif } from '../validation/diff'
import type { ResultatTest, SegmentDiff } from '../validation/types'
import './PanneauVerdict.css'

const CLASSES: Record<ResultatTest['verdict'], string> = {
  vert: 'verdict--vert',
  bleu: 'verdict--bleu',
  rouge: 'verdict--rouge',
}

const MARQUES: Record<ResultatTest['verdict'], string> = { vert: '✓', bleu: '≈', rouge: '✕' }

export function PanneauVerdict({ resultat }: { resultat: ResultatTest | null }) {
  if (!resultat) return null
  return (
    <div role="status" aria-live="polite" className={`verdict ${CLASSES[resultat.verdict]}`}>
      <span className="verdict__marque" aria-hidden="true">
        {MARQUES[resultat.verdict]}
      </span>
      <div className="verdict__texte">
        <b>{resultat.titre}</b>
        {resultat.detail && <span className="verdict__detail">{resultat.detail}</span>}
        {resultat.diff && <Comparaison segments={resultat.diff} />}
      </div>
    </div>
  )
}

/**
 * Les deux sorties, chacune sur sa ligne, en entier.
 *
 * L'affichage entrelacé qui les fondait en une seule chaîne se lisait bien
 * quand elles ne différaient que d'un espace, et ne se lisait plus du tout
 * autrement : « banane » face à « Bonjour tout le monde » donnait un hybride
 * qui n'était ni l'un ni l'autre. Ici l'élève voit ==ce qu'il devait afficher
 * et ce qu'il a affiché==, l'un sous l'autre, et le surlignage ne fait que
 * pointer — quand il a quelque chose à pointer.
 */
function Comparaison({ segments }: { segments: SegmentDiff[] }) {
  const marquer = diffInformatif(segments)
  return (
    <div className="comparaison" data-testid="diff">
      <Ligne libelle="Attendu" segments={segments} propre="manque" marquer={marquer} />
      <Ligne libelle="Obtenu" segments={segments} propre="ajout" marquer={marquer} />
    </div>
  )
}

/**
 * Une des deux sorties, reconstituée depuis les segments : ce qui est commun,
 * plus ce qui n'appartient qu'à elle.
 */
function Ligne({
  libelle,
  segments,
  propre,
  marquer,
}: {
  libelle: string
  segments: SegmentDiff[]
  propre: 'manque' | 'ajout'
  marquer: boolean
}) {
  const titre = propre === 'ajout' ? 'en trop' : 'manquant'
  return (
    <div className="comparaison__ligne">
      <span className="comparaison__libelle">{libelle}</span>
      <pre className="comparaison__texte">
        {segments
          .filter((segment) => segment.type === 'egal' || segment.type === propre)
          .map((segment, index) =>
            segment.type === 'egal' || !marquer ? (
              <span key={index}>{segment.texte}</span>
            ) : (
              <mark
                key={index}
                data-testid={`diff-${segment.type}`}
                className={`diff diff--${segment.type}`}
                title={titre}
              >
                {segment.texte}
              </mark>
            ),
          )}
      </pre>
    </div>
  )
}
