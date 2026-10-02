import {
  CLASSE_PEREMPTION, dateCourte, LIBELLES_PEREMPTION, NiveauPeremption,
} from '@/lib/peremption';

/**
 * Date d'expiration et sa pastille de couleur. Le nombre de jours restants
 * s'affiche au survol, et en toutes lettres pour une date proche.
 */
export default function Peremption({
  date,
  niveau,
  jours,
  libelles = LIBELLES_PEREMPTION,
  suffixeJours = 'j',
}: {
  date: string | null | undefined;
  niveau: NiveauPeremption | null | undefined;
  jours?: number | null;
  libelles?: Record<NiveauPeremption, string>;
  suffixeJours?: string;
}) {
  if (!date) return <>—</>;
  const detail =
    jours === null || jours === undefined
      ? undefined
      : jours < 0
        ? `${-jours} ${suffixeJours}`
        : `${jours} ${suffixeJours}`;
  return (
    <span className="peremption">
      <span>{dateCourte(date)}</span>
      {niveau && (
        <span className={`niveau ${CLASSE_PEREMPTION[niveau]}`} title={detail}>
          {libelles[niveau]}
          {detail && (niveau === 'proche' || niveau === 'perime') && (
            <span className="peremption-jours">{niveau === 'perime' ? `−${detail}` : detail}</span>
          )}
        </span>
      )}
    </span>
  );
}
