import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { ErrorBox, Field, PageHeader } from '../components/ui';

export function Account() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ fullName: user?.fullName ?? '', phone: user?.phone ?? '', currentPassword: '', newPassword: '' });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  if (!user) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setOk(false);
    try {
      const body = { fullName: form.fullName, phone: form.phone, ...(form.newPassword ? { currentPassword: form.currentPassword, newPassword: form.newPassword } : {}) };
      const r = await api('/auth/me', { method: 'PATCH', body });
      setUser(r.user);
      setForm({ ...form, currentPassword: '', newPassword: '' });
      setOk(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Mon compte" subtitle={user.email} />
      {user.role === 'bailleur' && (
        <section className="card mb-6">
          <h2 className="font-semibold">Offre {user.planInfo.label}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {user.planInfo.maxProperties ? `Jusqu'à ${user.planInfo.maxProperties} propriétés` : 'Propriétés illimitées'} ·{' '}
            {user.planInfo.maxTenants ? `${user.planInfo.maxTenants} locataires` : 'locataires illimités'} · {user.planInfo.price}
          </p>
          <p className="mt-2 text-xs text-slate-500">Pour changer d'offre, contactez le support LocaGest.</p>
        </section>
      )}
      <form onSubmit={submit} className="card max-w-xl space-y-4">
        <ErrorBox error={error} />
        {ok && <p className="text-sm text-emerald-700">Modifications enregistrées.</p>}
        <Field label="Nom complet"><input className="input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
        <Field label="Téléphone"><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <h3 className="pt-2 text-sm font-semibold text-slate-700">Changer de mot de passe</h3>
        <Field label="Mot de passe actuel"><input className="input" type="password" autoComplete="current-password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} /></Field>
        <Field label="Nouveau mot de passe"><input className="input" type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} /></Field>
        <button className="btn-primary">Enregistrer</button>
      </form>
    </>
  );
}
