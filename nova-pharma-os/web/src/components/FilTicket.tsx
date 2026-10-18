import { dateTime } from '@/lib/format';

export interface DetailTicket {
  ticket: {
    id: string; reference: string; subject: string; category: string; priority: string;
    status: string; created_at: string; sla_due_at: string | null; organization_name?: string;
  };
  messages: {
    id: string; author_kind: string; body: string; is_internal_note: boolean;
    created_at: string; author_name: string | null;
  }[];
}

/** Échanges d'un ticket, du plus ancien au plus récent. */
export default function FilTicket({ messages, espace }: { messages: DetailTicket['messages']; espace: 'pharmacie' | 'plateforme' }) {
  return (
    <div className="fil-ticket">
      {messages.map((m) => {
        const pharmacie = m.author_kind === 'customer';
        return (
          <div key={m.id} className={`message-ticket ${pharmacie ? 'pharmacie' : 'support'}${m.is_internal_note ? ' interne' : ''}`}>
            <div className="small muted">
              <strong>{m.author_name ?? (pharmacie ? 'Pharmacie' : 'Support NOVA PHARMA OS')}</strong>
              {' · '}{dateTime(m.created_at)}
              {m.is_internal_note && espace === 'plateforme' && <span className="tag warn" style={{ marginLeft: '0.35rem' }}>Note interne</span>}
            </div>
            <p style={{ margin: '0.3rem 0 0', whiteSpace: 'pre-wrap' }}>{m.body}</p>
          </div>
        );
      })}
    </div>
  );
}
