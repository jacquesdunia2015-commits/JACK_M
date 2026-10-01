import { dessiner } from '@/lib/codes-barres';

/**
 * Code-barres vectoriel, net à l'impression quelle que soit la taille de
 * l'étiquette, avec ses marges de silence et le code en clair dessous.
 */
export default function CodeBarresSvg({ code, hauteur = 34 }: { code: string; hauteur?: number }) {
  let dessin;
  try {
    dessin = dessiner(code);
  } catch {
    return <span className="small mono">{code}</span>;
  }
  const { bits, texte } = dessin;
  const marge = 11;
  const largeur = bits.length + 2 * marge;
  const hauteurTexte = 9;
  const barres: { x: number; l: number }[] = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== '1') continue;
    const precedente = barres[barres.length - 1];
    if (precedente && precedente.x + precedente.l === i + marge) precedente.l++;
    else barres.push({ x: i + marge, l: 1 });
  }
  return (
    <svg
      viewBox={`0 0 ${largeur} ${hauteur + hauteurTexte}`}
      className="code-barres"
      role="img"
      aria-label={`Code-barres ${texte}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={largeur} height={hauteur + hauteurTexte} fill="#fff" />
      {barres.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.l} height={hauteur} fill="#000" />
      ))}
      <text
        x={largeur / 2}
        y={hauteur + hauteurTexte - 1}
        textAnchor="middle"
        fontFamily="ui-monospace, Menlo, monospace"
        fontSize={8}
        fill="#000"
      >
        {texte}
      </text>
    </svg>
  );
}
