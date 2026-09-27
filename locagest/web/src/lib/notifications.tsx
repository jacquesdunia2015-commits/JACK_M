import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';
import { useAuth } from './auth';

interface Counts {
  unreadMessages: number;
  urgentGuarantees: number;
}
const Ctx = createContext<{ counts: Counts; refresh: () => void }>({ counts: { unreadMessages: 0, urgentGuarantees: 0 }, refresh: () => {} });

/** Notifications in-app : compteurs rafraîchis toutes les 30 secondes et au retour sur l'onglet. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Counts>({ unreadMessages: 0, urgentGuarantees: 0 });
  const refresh = useCallback(() => {
    if (!user || user.role === 'admin') return;
    api<Counts>('/notifications').then(setCounts, () => {});
  }, [user]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return <Ctx.Provider value={{ counts, refresh }}>{children}</Ctx.Provider>;
}

export const useNotifications = () => useContext(Ctx);
