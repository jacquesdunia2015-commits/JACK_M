import Link from 'next/link';
import FormulaireConnexion from '@/components/FormulaireConnexion';

export const metadata = { title: 'Back-office — NOVA PHARMA OS' };

export default function ConnexionAdmin() {
  return (
    <main className="auth">
      <div className="auth-card">
        <div className="brand" style={{ marginBottom: '1.25rem', padding: 0 }}>
          <span className="brand-mark">NP</span>
          <span>
            <span className="brand-name">NOVA PHARMA OS</span>
            <br />
            <span className="brand-sub">Back-office SaaS</span>
          </span>
        </div>

        <h1>Administration de la plateforme</h1>
        <p className="sous-titre">
          Pharmacies clientes, abonnements, facturation et support.
        </p>

        <FormulaireConnexion space="platform" />

        <p className="auth-switch">
          Vous êtes une pharmacie ? <Link href="/connexion">Espace pharmacie</Link>
        </p>
      </div>
    </main>
  );
}
