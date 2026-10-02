import { redirect } from 'next/navigation';
import { readSession } from '@/lib/session';

export default async function Accueil() {
  const session = await readSession();
  if (!session) redirect('/connexion');
  redirect(session.space === 'platform' ? '/admin' : '/pharmacie');
}
