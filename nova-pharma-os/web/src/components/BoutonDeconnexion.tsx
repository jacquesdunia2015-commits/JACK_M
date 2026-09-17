'use client';

import { useRouter } from 'next/navigation';

export default function BoutonDeconnexion({ libelle }: { libelle: string }) {
  const router = useRouter();

  async function deconnecter() {
    await fetch('/api/session', { method: 'DELETE' });
    router.push('/connexion');
    router.refresh();
  }

  return (
    <button className="secondaire petit" onClick={deconnecter}>
      {libelle}
    </button>
  );
}
