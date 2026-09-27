import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { ErrorBox, Field } from '../components/ui';

function Shell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-50 to-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/favicon.svg" alt="" className="h-14 w-14" />
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">LocaGest</h1>
          <p className="text-sm text-slate-500">La gestion de vos locataires, sans rien oublier</p>
        </div>
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Connexion">
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Mot de passe">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Bailleur sans compte ? <Link to="/inscription" className="font-medium text-brand-700 hover:underline">Créer un compte</Link>
      </p>
    </Shell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(form);
      navigate('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Créer un compte bailleur">
      <form onSubmit={submit} className="space-y-4">
        <ErrorBox error={error} />
        <Field label="Nom complet"><input className="input" required value={form.fullName} onChange={set('fullName')} /></Field>
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></Field>
        <Field label="Téléphone (optionnel)"><input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="+243 …" /></Field>
        <Field label="Mot de passe" hint="8 caractères minimum">
          <input className="input" type="password" autoComplete="new-password" minLength={8} required value={form.password} onChange={set('password')} />
        </Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
        <p className="text-center text-xs text-slate-500">Offre Starter gratuite pour démarrer : 3 propriétés, 10 locataires.</p>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Déjà inscrit ? <Link to="/" className="font-medium text-brand-700 hover:underline">Se connecter</Link>
      </p>
    </Shell>
  );
}
