export default function Stat({
  label,
  valeur,
  note,
  ton,
}: {
  label: string;
  valeur: string | number;
  note?: string;
  ton?: 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className={`stat${ton ? ` ${ton}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{valeur}</div>
      {note && <div className="stat-note">{note}</div>}
    </div>
  );
}
