import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Polices Google Fonts servies localement depuis public/fonts/ (sous-jeu
// latin) : le rendu Chromium de cet environnement ne peut pas récupérer
// fonts.gstatic.com directement pendant le rendu, on évite donc tout appel
// réseau au moment du render.
export const headlineFont = "Bebas Neue Local";
export const bodyFont = "Poppins Local";

// L'appel à loadFont() suspend automatiquement le rendu (delayRender /
// continueRender) jusqu'à ce que chaque police soit prête.
Promise.all([
  loadFont({
    family: headlineFont,
    url: staticFile("fonts/BebasNeue-Regular.woff2"),
    weight: "400",
  }),
  loadFont({
    family: bodyFont,
    url: staticFile("fonts/Poppins-Regular.woff2"),
    weight: "400",
  }),
  loadFont({
    family: bodyFont,
    url: staticFile("fonts/Poppins-SemiBold.woff2"),
    weight: "600",
  }),
]);
