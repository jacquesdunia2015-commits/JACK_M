import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useFetch } from '../lib/useFetch';
import { useNotifications } from '../lib/notifications';
import { Empty, ErrorBox, Loading, PageHeader } from '../components/ui';
import { dateTime } from '../lib/format';
import { useT } from '../i18n';

interface Message {
  id: number;
  sender_role: 'bailleur' | 'locataire';
  body: string;
  read_at: string | null;
  created_at: string;
}


/** Fil de discussion : rechargé toutes les 15 secondes, les messages reçus sont marqués lus. */
function Thread({ path, me, emptyHint }: { path: string; me: 'bailleur' | 'locataire'; emptyHint: string }) {
  const t = useT();
  const { refresh } = useNotifications();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ messages: Message[] }>(path).then(
        (r) => {
          if (!alive) return;
          setMessages(r.messages);
          refresh();
        },
        (e) => alive && setError(e.message),
      );
    setMessages(null);
    void load();
    const id = setInterval(load, 15_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [path, refresh]);

  useEffect(() => bottom.current?.scrollIntoView({ block: 'end' }), [messages?.length]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const m = await api<Message>(path, { method: 'POST', body: { body: draft } });
      setMessages((prev) => [...(prev ?? []), m]);
      setDraft('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[60vh] min-h-96 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages === null ? <Loading /> : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">{emptyHint}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === me;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${mine ? 'rounded-ee-sm bg-brand-700 text-white' : 'rounded-es-sm bg-slate-100 text-slate-800'}`}>
                  <p className="whitespace-pre-line break-words">{m.body}</p>
                  <p className={`mt-1 text-end text-[11px] ${mine ? 'text-brand-100' : 'text-slate-500'}`}>
                    {dateTime(m.created_at)}
                    {mine && (m.read_at ? ` · ✓✓ ${t('msg.read')}` : ` · ✓ ${t('msg.sent')}`)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="border-t border-slate-200 p-3">
        <ErrorBox error={error} />
        <div className="flex gap-2">
          <textarea
            className="input min-h-11 flex-1 resize-none"
            rows={2}
            maxLength={5000}
            placeholder={t('msg.placeholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          />
          <button className="btn-primary self-end" disabled={sending || !draft.trim()}>{t('msg.send')}</button>
        </div>
      </form>
    </div>
  );
}

/** Messagerie du bailleur : liste des conversations et fil sélectionné. */
export function Messages() {
  const t = useT();
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const { counts } = useNotifications();
  const convs = useFetch<any[]>(`/messages?u=${counts.unreadMessages}`);
  const tenants = useFetch<any[]>('/tenants');
  const selected = tenants.data?.find((t) => String(t.id) === tenantId);

  const list = (
    <div className="flex flex-col">
      <div className="border-b border-slate-200 p-3">
        <select className="input" value="" onChange={(e) => e.target.value && navigate(`/messages/${e.target.value}`)} aria-label={t('msg.writeTo')}>
          <option value="">+ {t('msg.writeTo')}</option>
          {tenants.data?.map((t) => <option key={t.id} value={t.id}>{t.last_name} {t.first_name}</option>)}
        </select>
      </div>
      {convs.loading && !convs.data ? <Loading /> : !convs.data?.length ? (
        <p className="p-4 text-sm text-slate-500">{t('msg.noConversations')}</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {convs.data.map((c) => (
            <li key={c.tenant_id}>
              <Link
                to={`/messages/${c.tenant_id}`}
                className={`flex items-start justify-between gap-2 px-4 py-3 hover:bg-slate-50 ${String(c.tenant_id) === tenantId ? 'bg-brand-50' : ''}`}
              >
                <div className="min-w-0">
                  <p className={`truncate text-sm ${c.unread ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>{c.first_name} {c.last_name}</p>
                  <p className="truncate text-xs text-slate-500">{c.last_sender === 'bailleur' ? t('msg.you', { text: c.last_body }) : c.last_body}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-slate-400">{dateTime(c.last_at)}</span>
                  {c.unread > 0 && <span className="rounded-full bg-red-500 px-2 text-xs font-semibold text-white">{c.unread}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <>
      <PageHeader title={t('nav.messages')} subtitle={t('msg.subtitle')} />
      <ErrorBox error={convs.error ?? tenants.error} />
      <div className="card grid overflow-hidden p-0 md:grid-cols-3">
        <aside className={`border-slate-200 md:border-e ${tenantId ? 'hidden md:block' : ''}`}>{list}</aside>
        <section className={`md:col-span-2 ${tenantId ? '' : 'hidden md:block'}`}>
          {tenantId ? (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Link to="/messages" className="text-sm text-brand-700 md:hidden" aria-label={t('common.back')}>←</Link>
                  <Link to={`/locataires/${tenantId}`} className="font-semibold text-slate-900 hover:underline">
                    {selected ? `${selected.first_name} ${selected.last_name}` : t('field.tenant')}
                  </Link>
                </div>
                {selected && !selected.user_id && (
                  <span className="text-xs text-orange-700">{t('msg.noPortal')}</span>
                )}
              </div>
              <Thread path={`/messages/${tenantId}`} me="bailleur" emptyHint={t('msg.emptyLandlord')} />
            </>
          ) : (
            <div className="p-8"><Empty title={t('msg.choose')}>{t('msg.chooseHint')}</Empty></div>
          )}
        </section>
      </div>
    </>
  );
}

/** Messagerie du locataire : un seul fil, avec son bailleur. */
export function PortalMessages() {
  const t = useT();
  return (
    <>
      <PageHeader title={t('nav.messages')} subtitle={t('msg.portalSubtitle')} />
      <div className="card overflow-hidden p-0">
        <Thread path="/portal/messages" me="locataire" emptyHint={t('msg.emptyTenant')} />
      </div>
    </>
  );
}
