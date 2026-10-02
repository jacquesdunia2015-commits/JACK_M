import { ChangerMotDePasse, DoubleAuthentification } from '@/components/MonCompte';
import { readSession } from '@/lib/session';

/** Mon compte : mot de passe et double authentification. */
export default async function PageCompte() {
  const session = await readSession();
  return (
    <>
      <div className="page-head">
        <h1>Mon compte</h1>
        <p>{session?.name} · {session?.email}</p>
      </div>
      <section className="card">
        <div className="card-head"><h2>Mot de passe</h2></div>
        <ChangerMotDePasse />
      </section>
      <section className="card">
        <div className="card-head">
          <h2>Double authentification</h2>
          <span className="hint">Recommandée pour le gérant et toute personne qui voit les chiffres</span>
        </div>
        <DoubleAuthentification />
      </section>
    </>
  );
}
