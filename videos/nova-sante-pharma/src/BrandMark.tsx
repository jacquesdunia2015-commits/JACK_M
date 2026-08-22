// Marque visuelle recréée en code pour NOVA SANTÉ PHARMA : une croix
// pharmaceutique arrondie, un arc bleu en mouvement et une étincelle,
// dans le même esprit que l'identité de la marque (croix, arc, étoile,
// bleu/vert) — sans reproduire le fichier logo original.
export const BrandMark: React.FC<{ size: number }> = ({ size }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      style={{ overflow: "visible" }}
    >
      <circle
        cx="100"
        cy="100"
        r="90"
        fill="none"
        stroke="#1f6fb2"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray="360 500"
        transform="rotate(-125 100 100)"
      />
      <rect x="72" y="34" width="56" height="132" rx="16" fill="#1f9d55" />
      <rect x="34" y="72" width="132" height="56" rx="16" fill="#1f9d55" />
      <path
        d="M 158 34 L 164 48 L 178 54 L 164 60 L 158 74 L 152 60 L 138 54 L 152 48 Z"
        fill="#1f6fb2"
      />
    </svg>
  );
};
