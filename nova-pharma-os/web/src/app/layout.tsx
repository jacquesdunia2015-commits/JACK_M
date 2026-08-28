import type { Metadata } from 'next';
import { langueActive } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'NOVA PHARMA OS',
  description:
    'Plateforme SaaS de gestion pharmaceutique, commerciale et logistique.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // `lang` et `dir` sont posés ici, à la racine : c'est ce qui fait basculer
  // toute la page en écriture de droite à gauche pour l'arabe, et ce sur quoi
  // les lecteurs d'écran s'appuient pour choisir la bonne prononciation.
  const langue = await langueActive();
  return (
    <html lang={langue.code} dir={langue.direction}>
      <body>{children}</body>
    </html>
  );
}
