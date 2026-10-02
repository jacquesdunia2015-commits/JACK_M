import { NIVEAUX_INTERACTION } from '@/lib/interactions';
import { BasculeInteraction } from '@/components/Interactions';

export interface LigneInteraction {
  id: string; label_a: string; label_b: string; severity: string; effect: string; advice: string | null; source: string | null; is_active: boolean;
}

const majuscule = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** Table des interactions, commune à la pharmacie (consultation) et au back-office (gestion). */
export default function TableInteractions({ lignes, gestion = false }: { lignes: LigneInteraction[]; gestion?: boolean }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr><th>Association</th><th>Niveau</th><th>Effet et conduite à tenir</th><th>Source</th>{gestion && <th />}</tr></thead>
        <tbody>
          {lignes.map((i) => (
            <tr key={i.id} className={i.is_active ? undefined : 'muted'}>
              <td><strong>{majuscule(i.label_a)}</strong> + <strong>{majuscule(i.label_b)}</strong></td>
              <td><span className={`tag ${NIVEAUX_INTERACTION[i.severity]?.ton ?? 'muted'}`}>{NIVEAUX_INTERACTION[i.severity]?.libelle ?? i.severity}</span></td>
              <td className="small">{i.effect}{i.advice && <div className="muted">Conduite : {i.advice}</div>}</td>
              <td className="small">{i.source ?? '—'}</td>
              {gestion && <td style={{ textAlign: 'right' }}><BasculeInteraction id={i.id} active={i.is_active} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
