import { useFetch } from '../lib/useFetch';
import { LEVELS, PAYMENT_STATE_CLS, address, date, money, month, type Level } from '../lib/format';
import { Badge, Empty, ErrorBox, Loading, PageHeader, Row } from '../components/ui';
import { useT } from '../i18n';

/** Espace locataire : son bail, l'état de sa garantie, ses loyers. */
export function Portal() {
  const t = useT();
  const { data, error, loading } = useFetch<{ landlord: any; leases: any[] }>('/portal/leases');
  if (loading && !data) return <Loading />;
  if (!data) return <ErrorBox error={error} />;
  const ll = data.landlord;
  return (
    <>
      <PageHeader
        title={t('nav.myLease')}
        subtitle={ll ? t('portal.landlord', { name: ll.full_name, contact: [ll.phone, ll.email].filter(Boolean).join(' · ') }) : undefined}
      />
      {data.leases.length === 0 && <Empty title={t('portal.noLease')} />}
      <div className="space-y-6">
        {data.leases.map((l) => {
          const lvl = l.guarantee.level ? LEVELS[l.guarantee.level as Level] : null;
          return (
            <section key={l.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{l.property_title}</h2>
                  <p className="text-sm text-slate-500">{address(l)}</p>
                </div>
                <Badge className="bg-slate-100 text-slate-700 ring-slate-300">{t(`leaseStatus.${l.status as 'actif'}`)}</Badge>
              </div>
              {lvl && (
                <div className={`mt-4 rounded-lg p-4 ring-1 ${lvl.badge} ${lvl.pulse}`}>
                  <p className="font-semibold">
                    {lvl.emoji}{' '}
                    {l.guarantee.daysRemaining > 0
                      ? t('portal.guaranteeValid', { n: l.guarantee.daysRemaining, date: date(l.guarantee_expires_on) })
                      : t('portal.guaranteeExpired', { date: date(l.guarantee_expires_on) })}
                  </p>
                  {l.guarantee.daysRemaining < 60 && <p className="mt-1 text-sm">{t('portal.contactLandlord')}</p>}
                </div>
              )}
              <dl className="mt-4 grid gap-x-8 md:grid-cols-2">
                <div>
                  <Row label={t('lease.field.start')}>{date(l.start_date)}</Row>
                  <Row label={t('lease.field.end')}>{date(l.end_date)}</Row>
                </div>
                <div>
                  <Row label={t('field.rent')}>{t('common.perMonth', { amount: money(l.monthly_rent, l.currency) })}</Row>
                  <Row label={t('portal.guaranteePaid')}>{money(l.guarantee_amount, l.currency)}</Row>
                </div>
              </dl>
              {l.schedule.length > 0 && (
                <>
                  <h3 className="mb-2 mt-5 text-sm font-medium text-slate-600">{t('portal.myRents')}</h3>
                  <ul className="divide-y divide-slate-100">
                    {[...l.schedule].reverse().map((s: any) => (
                      <li key={s.period} className="flex items-center justify-between py-2 text-sm">
                        <span className="capitalize">{month(s.period)}</span>
                        <span className="text-slate-500">{money(s.paid, l.currency)} / {money(s.rent, l.currency)}</span>
                        <Badge className={PAYMENT_STATE_CLS[s.state]}>{t(`payState.${s.state as 'paye'}`)}</Badge>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
