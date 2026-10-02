'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const TAILLE_MAX = 500 * 1024;

/**
 * Logo de la pharmacie, imprimé en tête de ses réquisitions. PNG ou JPEG,
 * 500 Ko au plus : un logo net n'en demande pas davantage, et le document
 * reste léger à envoyer par WhatsApp.
 */
export default function LogoPharmacie({ logo }: { logo: string | null }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ ton: string; texte: string } | null>(null);
  const [envoi, setEnvoi] = useState(false);

  async function envoyer(dataUrl: string | null) {
    setEnvoi(true);
    setMessage(null);
    try {
      const response = await fetch('/api/proxy/admin/logo', {
        method: dataUrl ? 'PUT' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: dataUrl ? JSON.stringify({ dataUrl }) : undefined,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const texte = Array.isArray(body.message) ? body.message.join(' ') : body.message;
        setMessage({ ton: 'danger', texte: texte ?? 'Logo refusé.' });
        return;
      }
      setMessage({ ton: 'info', texte: dataUrl ? 'Logo enregistré : il figurera sur vos réquisitions.' : 'Logo retiré.' });
      router.refresh();
    } catch {
      setMessage({ ton: 'danger', texte: 'Service injoignable. Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  }

  function choisir(event: React.ChangeEvent<HTMLInputElement>) {
    const fichier = event.target.files?.[0];
    event.target.value = '';
    if (!fichier) return;
    if (!['image/png', 'image/jpeg'].includes(fichier.type)) {
      setMessage({ ton: 'danger', texte: 'Choisissez une image PNG ou JPEG.' });
      return;
    }
    if (fichier.size > TAILLE_MAX) {
      setMessage({ ton: 'danger', texte: `Image trop lourde (${Math.round(fichier.size / 1024)} Ko) : 500 Ko au plus.` });
      return;
    }
    const lecteur = new FileReader();
    lecteur.onload = () => envoyer(String(lecteur.result));
    lecteur.readAsDataURL(fichier);
  }

  return (
    <div className="logo-pharmacie">
      {message && <div className={`banner ${message.ton}`}>{message.texte}</div>}
      <div className="row" style={{ alignItems: 'center' }}>
        <div className="logo-apercu" aria-label="Aperçu du logo">
          {logo ? <img src={logo} alt="Logo de la pharmacie" /> : <span className="small muted">Aucun logo</span>}
        </div>
        <label className="btn secondaire" htmlFor="logo-fichier" aria-disabled={envoi}>
          {logo ? 'Changer le logo' : 'Ajouter le logo'}
        </label>
        <input id="logo-fichier" type="file" accept="image/png,image/jpeg" onChange={choisir} hidden disabled={envoi} />
        {logo && (
          <button type="button" className="secondaire petit" onClick={() => envoyer(null)} disabled={envoi}>
            Retirer
          </button>
        )}
        <span className="small muted">PNG ou JPEG, carré de préférence, 500 Ko au plus.</span>
      </div>
    </div>
  );
}
