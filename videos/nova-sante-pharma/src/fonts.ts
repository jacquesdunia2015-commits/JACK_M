import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Poppins servie localement depuis public/fonts/ (sous-jeu latin) : le
// rendu Chromium de cet environnement ne peut pas récupérer
// fonts.gstatic.com pendant le rendu, on évite donc tout appel réseau.
export const brandFont = "Poppins Local";

Promise.all([
  loadFont({
    family: brandFont,
    url: staticFile("fonts/Poppins-Regular.woff2"),
    weight: "400",
  }),
  loadFont({
    family: brandFont,
    url: staticFile("fonts/Poppins-SemiBold.woff2"),
    weight: "600",
  }),
  loadFont({
    family: brandFont,
    url: staticFile("fonts/Poppins-Bold.woff2"),
    weight: "700",
  }),
]);
