import Link from 'next/link';
import FormulaireConnexion from '@/components/FormulaireConnexion';

export const metadata = { title: 'Connexion — NOVA PHARMA OS' };

export default function Connexion() {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: '1.25rem', padding: 0 }}>
          <span className="brand-mark">NP</span>
          <span>
            <span className="brand-name">NOVA PHARMA OS</span>
            <br />
            <span className="brand-sub">Espace pharmacie</span>
          </span>
        </div>

        <h1>Connexion à votre officine</h1>
        <p className="sous-titre">
          Gérez vos stocks, vos ventes et vos clients depuis un seul endroit.
        </p>

        <FormulaireConnexion space="pharmacy" />

        <p className="auth-switch">
          Vous administrez la plateforme ?{' '}
          <Link href="/admin/connexion">Back-office NOVA PHARMA OS</Link>
        </p>
      </div>
    </main>
  );
}
