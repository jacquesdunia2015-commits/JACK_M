import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useNotifications } from '../lib/notifications';
import { useT } from '../i18n';
import type { Key } from '../i18n/locales/fr';
import { api } from '../lib/api';
import { LanguagePicker } from './LanguagePicker';

const NAV: Record<string, [string, Key, string][]> = {
  bailleur: [
    ['/', 'nav.dashboard', '📊'],
    ['/proprietes', 'nav.properties', '🏠'],
    ['/locataires', 'nav.tenants', '👥'],
    ['/baux', 'nav.leases', '📄'],
    ['/messages', 'nav.messages', '💬'],
    ['/rapports', 'nav.reports', '📈'],
    ['/alertes', 'nav.alerts', '🔔'],
  ],
  locataire: [
    ['/', 'nav.myLease', '📄'],
    ['/messages', 'nav.messages', '💬'],
  ],
  admin: [
    ['/', 'nav.admin', '⚙️'],
    ['/alertes', 'nav.alerts', '🔔'],
  ],
};

export function Layout() {
  const { user, logout, setUser } = useAuth();
  const { counts } = useNotifications();
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const links = NAV[user.role];

  // La langue choisie suit le compte, d'un appareil à l'autre.
  const saveLocale = (locale: string) => {
    api('/auth/me', { method: 'PATCH', body: { locale } }).then((r) => setUser(r.user), () => {});
  };

  const nav = (
    <nav className="flex flex-col gap-1">
      {links.map(([to, label, icon]) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`
          }
        >
          <span aria-hidden>{icon}</span>
          {t(label)}
          <NavBadge to={to} counts={counts} />
        </NavLink>
      ))}
    </nav>
  );

  const footer = (
    <div className="space-y-2 border-t border-slate-200 pt-4 text-sm">
      <LanguagePicker className="px-3" onChange={saveLocale} />
      <NavLink to="/compte" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 hover:bg-slate-100">
        <p className="font-medium text-slate-800">{user.fullName}</p>
        <p className="text-xs text-slate-500">
          {user.role === 'bailleur' ? t('layout.plan', { plan: user.planInfo.label }) : user.role === 'admin' ? t('role.admin') : t('role.tenant')}
        </p>
      </NavLink>
      <button onClick={logout} className="w-full rounded-lg px-3 py-2 text-start text-slate-600 hover:bg-slate-100">
        {t('layout.logout')}
      </button>
    </div>
  );

  const brand = (
    <div className="flex items-center gap-2 px-3">
      <img src="/favicon.svg" alt="" className="h-8 w-8" />
      <span className="text-lg font-semibold text-slate-900">LocaGest</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        {brand}
        <button className="btn-secondary relative px-3" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={t('layout.menu')}>
          ☰
          {counts.unreadMessages + counts.urgentGuarantees > 0 && (
            <span className="absolute -end-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" aria-hidden />
          )}
        </button>
      </header>
      {open && (
        <div className="fixed inset-0 z-30 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/30" />
          <aside className="absolute start-0 top-0 flex h-full w-72 flex-col justify-between overflow-y-auto bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-6">{brand}{nav}</div>
            {footer}
          </aside>
        </div>
      )}
      {/* Bureau */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 flex-col justify-between overflow-y-auto border-e border-slate-200 bg-white p-4 lg:flex">
        <div className="space-y-6">{brand}{nav}</div>
        {footer}
      </aside>
      <main className="px-4 py-6 lg:ms-64 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavBadge({ to, counts }: { to: string; counts: { unreadMessages: number; urgentGuarantees: number } }) {
  const t = useT();
  const n = to === '/messages' ? counts.unreadMessages : to === '/baux' ? counts.urgentGuarantees : 0;
  if (!n) return null;
  const label = to === '/messages' ? t('layout.unreadMessages', { n }) : t('layout.urgentGuarantees', { n });
  return (
    <span className="ms-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white" title={label}>
      {n}
      <span className="sr-only"> — {label}</span>
    </span>
  );
}
