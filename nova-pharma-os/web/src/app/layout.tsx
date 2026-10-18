import type { Metadata, Viewport } from 'next';
import { langueActive } from '@/lib/i18n';
import './globals.css';

export const metadata: Metadata = {
  title: 'NOVA PHARMA OS',
  description:
    'Plateforme SaaS de gestion pharmaceutique, commerciale et logistique.',
  // Le manifeste rend l'application installable sur un téléphone : le
  // vendeur l'ajoute à son écran d'accueil et l'ouvre comme n'importe
  // quelle autre application, sans passer par une boutique.
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'NOVA', statusBarStyle: 'black-translucent' },
};

export const viewport: Viewport = {
  themeColor: '#0d5a4a',
  width: 'device-width',
  initialScale: 1,
  // L'agrandissement reste autorisé : une interface qui l'interdit
  // exclut les personnes qui en ont besoin pour lire.
  maximumScale: 5,
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
