'use client';

import { useEffect, useRef, useState } from 'react';

type Detecteur = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
type ConstructeurDetecteur = new (options?: { formats?: string[] }) => Detecteur;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'qr_code', 'data_matrix'];

/** Petit bip de confirmation, sans fichier son. */
function bip() {
  try {
    const Contexte = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Contexte();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1400;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  } catch {
    // Pas de son : le code s'affiche quand même.
  }
}

/**
 * Bouton « Scanner » : ouvre la caméra arrière du téléphone (ou la webcam)
 * et lit le code-barres de la boîte. Le lecteur intégré du navigateur est
 * utilisé quand il existe (Chrome sur Android) ; sinon une bibliothèque de
 * lecture est chargée à la demande. Une douchette USB reste utilisable :
 * elle tape le code dans le champ de recherche.
 */
export default function ScanCodeBarres({
  onCode,
  libelle = 'Scanner',
  className = 'secondaire',
}: {
  onCode: (code: string) => void;
  libelle?: string;
  className?: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  // Le dernier rappel reçu, sans redémarrer la caméra quand la page se redessine.
  const rappel = useRef(onCode);
  rappel.current = onCode;

  useEffect(() => {
    if (!ouvert) return;
    let fini = false;
    let flux: MediaStream | null = null;
    let arreterZxing: (() => void) | null = null;
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    const trouve = (code: string) => {
      if (fini || !code) return;
      fini = true;
      bip();
      if (navigator.vibrate) navigator.vibrate(80);
      setOuvert(false);
      rappel.current(code.trim());
    };

    (async () => {
      setErreur(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setErreur('Ce navigateur ne donne pas accès à la caméra. Utilisez Chrome, ou une douchette.');
        return;
      }
      const Natif = (window as unknown as { BarcodeDetector?: ConstructeurDetecteur & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
      try {
        if (Natif) {
          const pris = (await Natif.getSupportedFormats?.()) ?? FORMATS;
          const detecteur = new Natif({ formats: FORMATS.filter((f) => pris.includes(f)) });
          flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
          if (fini || !video.current) return;
          video.current.srcObject = flux;
          await video.current.play();
          const lire = async () => {
            if (fini || !video.current) return;
            try {
              const codes = await detecteur.detect(video.current);
              if (codes[0]?.rawValue) { trouve(codes[0].rawValue); return; }
            } catch {
              // Image pas encore prête : on réessaie.
            }
            minuteur = setTimeout(lire, 180);
          };
          void lire();
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser');
          if (fini || !video.current) return;
          const lecteur = new BrowserMultiFormatReader();
          const controles = await lecteur.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            video.current,
            (resultat) => { if (resultat) trouve(resultat.getText()); },
          );
          arreterZxing = () => controles.stop();
          if (fini) arreterZxing();
        }
      } catch (e) {
        const nom = (e as { name?: string }).name;
        setErreur(
          nom === 'NotAllowedError'
            ? 'Accès à la caméra refusé. Autorisez la caméra pour ce site dans les réglages du navigateur.'
            : nom === 'NotFoundError'
              ? 'Aucune caméra trouvée sur cet appareil.'
              : 'Impossible de démarrer la caméra.',
        );
      }
    })();

    return () => {
      fini = true;
      if (minuteur) clearTimeout(minuteur);
      arreterZxing?.();
      flux?.getTracks().forEach((piste) => piste.stop());
    };
  }, [ouvert]);

  return (
    <>
      <button type="button" className={className} onClick={() => setOuvert(true)} aria-label="Scanner un code-barres avec la caméra">
        {libelle}
      </button>
      {ouvert && (
        <div className="scan-fond" role="dialog" aria-modal="true" aria-label="Scanner un code-barres">
          <div className="scan-fenetre">
            <video ref={video} className="scan-video" muted playsInline />
            <div className="scan-viseur" aria-hidden="true" />
            <p className="small" style={{ margin: '0.5rem 0' }}>
              {erreur ?? 'Placez le code-barres de la boîte dans le cadre.'}
            </p>
            <button type="button" className="secondaire" onClick={() => setOuvert(false)}>Fermer</button>
          </div>
        </div>
      )}
    </>
  );
}
