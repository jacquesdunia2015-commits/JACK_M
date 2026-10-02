'use client';

import { useState } from 'react';

/**
 * Un document PDF à remettre : l'ouvrir pour l'imprimer, le partager depuis
 * le téléphone (WhatsApp, e-mail…), ou écrire directement au destinataire
 * avec un résumé.
 */
export default function PartagePdf({
  url,
  nomFichier,
  titre,
  texte,
  telephone,
  email,
}: {
  /** Adresse du PDF, via le relais /api/proxy. */
  url: string;
  nomFichier: string;
  titre: string;
  /** Message joint au partage, à WhatsApp et à l'e-mail. */
  texte: string;
  telephone?: string | null;
  email?: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const chiffres = telephone?.replace(/\D/g, '');

  async function partager() {
    setMessage(null);
    try {
      const reponse = await fetch(url);
      if (!reponse.ok) throw new Error();
      const blob = await reponse.blob();
      const fichier = new File([blob], nomFichier, { type: 'application/pdf' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.canShare?.({ files: [fichier] })) {
        await nav.share({ files: [fichier], title: titre, text: texte });
        return;
      }
      // Sans partage de fichiers (ordinateur), on enregistre le PDF : il
      // reste à le joindre au message WhatsApp ou à l'e-mail.
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(blob);
      lien.download = nomFichier;
      lien.click();
      URL.revokeObjectURL(lien.href);
      setMessage('PDF enregistré : joignez-le à votre message.');
    } catch (erreur) {
      if ((erreur as Error)?.name !== 'AbortError') setMessage('Partage impossible pour le moment.');
    }
  }

  return (
    <div className="row" style={{ gap: '0.4rem' }}>
      <a className="btn secondaire petit" href={url} target="_blank" rel="noreferrer">Ouvrir le PDF / imprimer</a>
      <button type="button" className="secondaire petit" onClick={partager}>Partager le PDF</button>
      {chiffres && (
        <a className="btn secondaire petit" href={`https://wa.me/${chiffres}?text=${encodeURIComponent(texte)}`}
          target="_blank" rel="noreferrer">WhatsApp</a>
      )}
      {email && (
        <a className="btn secondaire petit"
          href={`mailto:${email}?subject=${encodeURIComponent(titre)}&body=${encodeURIComponent(texte)}`}>
          E-mail
        </a>
      )}
      {message && <span className="small muted">{message}</span>}
    </div>
  );
}
