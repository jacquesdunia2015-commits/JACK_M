import { statusLabel, statusTone } from '@/lib/format';

export default function Etiquette({ statut }: { statut: unknown }) {
  return <span className={`tag ${statusTone(statut)}`}>{statusLabel(statut)}</span>;
}
