'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { envoyer } from '@/lib/envoi';

/** Douze mois de ventes en petites barres (une seule série : le titre de la colonne la nomme). */
export function MiniHistorique({ valeurs, mois }: { valeurs: number[]; mois: string[] }) {
  const max = Math.max(...valeurs, 0);
  const H = 22;
  return (
    <svg width={12 * 6} height={H} role="img" aria-label={`Ventes des 12 derniers mois : ${valeurs.map((v, i) => `${mois[i]} ${v}`).join(', ')}`} className="mini-historique">
      {valeurs.map((v, i) => {
        const h = max > 0 ? Math.max(v > 0 ? 2 : 0, (v / max) * (H - 2)) : 0;
        return <rect key={i} x={i * 6} y={H - h} width={4} height={h} rx={1}><title>{`${mois[i]} : ${v}`}</title></rect>;
      })}
    </svg>
  );
}

/** Crée une réquisition avec les quantités suggérées, puis l'ouvre pour la compléter. */
export function PreparerRequisition({ lignes }: { lignes: { productId: string; product: string; quantity: number }[] }) {
  const router = useRouter();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!lignes.length) return null;
  return (
    <>
      <button type="button" disabled={envoi} onClick={async () => {
        setEnvoi(true);
        setErreur(null);
        const r = await envoyer<{ id: string }>('/purchasing/requisitions', {
          notes: 'Préparée à partir des prévisions de NOVA (quantités suggérées, à ajuster).',
          lines: lignes.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        });
        setEnvoi(false);
        if (!r.ok) { setErreur(r.message); return; }
        router.push(`/pharmacie/requisitions/${r.body.id}`);
      }}>
        {envoi ? 'Préparation…' : `Préparer une réquisition (${lignes.length} produit${lignes.length > 1 ? 's' : ''})`}
      </button>
      {erreur && <span className="small" style={{ color: 'var(--alerte)', marginLeft: '0.5rem' }}>{erreur}</span>}
    </>
  );
}
