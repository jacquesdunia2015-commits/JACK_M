import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Marque de NOVA PHARMA OS.
 *
 * Si un fichier `web/public/logo.png` existe, il est affiché. Sinon, le
 * monogramme « NP » dessiné en CSS prend le relais.
 *
 * Ce repli n'est pas une commodité de développement : une pharmacie
 * cliente qui n'a pas encore fourni son logo doit voir une interface
 * finie, pas un carré vide ou une image cassée. Poser le fichier suffit à
 * changer la marque partout — barre latérale, pages de connexion,
 * application mobile — sans toucher au code.
 *
 * Formats acceptés, par ordre de préférence : .png, .svg, .jpg. Une image
 * carrée d'au moins 256 px donne le meilleur résultat.
 */
const CANDIDATS = ['logo.png', 'logo.svg', 'logo.jpg', 'logo.jpeg', 'logo.webp'];

/**
 * Cherché une seule fois par processus : `existsSync` sur chaque rendu de
 * page coûterait un accès disque pour un fichier qui ne change pas en
 * cours d'exécution.
 */
let cheminCache: string | null | undefined;

export function cheminLogo(): string | null {
  if (cheminCache !== undefined) return cheminCache;
  const dossier = join(process.cwd(), 'public');
  cheminCache = CANDIDATS.find((nom) => existsSync(join(dossier, nom))) ?? null;
  return cheminCache ? `/${cheminCache}` : null;
}

export default function Logo({
  taille = 34,
  alt = 'NOVA PHARMA OS',
}: {
  taille?: number;
  alt?: string;
}) {
  const chemin = cheminLogo();

  if (chemin) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- le fichier est
      // fourni par la pharmacie et ses dimensions ne sont pas connues à
      // l'avance ; `next/image` exigerait de les déclarer.
      <img
        className="marque-logo"
        src={chemin}
        alt={alt}
        width={taille}
        height={taille}
      />
    );
  }

  return (
    <span className="brand-mark" style={{ width: taille, height: taille }} aria-hidden>
      NP
    </span>
  );
}
