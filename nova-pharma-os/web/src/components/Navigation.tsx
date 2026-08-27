'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface LienNav {
  href: string;
  label: string;
  icone: string;
  groupe?: string;
}

export default function Navigation({ liens }: { liens: LienNav[] }) {
  const chemin = usePathname();
  const groupes = liens.reduce<Record<string, LienNav[]>>((acc, lien) => {
    const clef = lien.groupe ?? '';
    (acc[clef] ??= []).push(lien);
    return acc;
  }, {});

  return (
    <nav className="nav">
      {Object.entries(groupes).map(([groupe, items]) => (
        <div key={groupe}>
          {groupe && <div className="nav-group-title">{groupe}</div>}
          {items.map((lien) => {
            // Le lien racine ne doit s'activer que sur correspondance exacte,
            // sans quoi il resterait allumé sur toutes les sous-pages.
            const actif =
              chemin === lien.href ||
              (lien.href !== '/pharmacie' &&
                lien.href !== '/admin' &&
                chemin.startsWith(`${lien.href}/`));
            return (
              <Link key={lien.href} href={lien.href} className={actif ? 'actif' : ''}>
                <span className="nav-icon" aria-hidden>
                  {lien.icone}
                </span>
                {lien.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
