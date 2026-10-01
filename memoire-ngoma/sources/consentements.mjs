// consentements.mjs — Annexe 4 : registre de suivi des consentements (SIMULÉ).
//
// ⚠️ Aucune signature n'est simulée, et aucune ne doit l'être. Un formulaire de
// consentement signé est une pièce du dossier éthique : en fabriquer un, même
// pour s'exercer, produirait exactement le document qui ne doit jamais exister.
// Ce registre trace seulement ce que le protocole demande de suivre, accord par
// accord : le § 4.2.7 prévoit que « l'enregistrement et la citation d'extraits
// font l'objet d'accords distincts ».
//
// Deux cas sont volontairement différents des autres, pour s'exercer à en tenir
// compte dans l'analyse :
//   · P05 accepte l'entretien et l'enregistrement, mais REFUSE la citation : ses
//     propos peuvent être analysés, jamais cités dans le mémoire ;
//   · P19 accepte la citation à condition qu'aucun élément ne permette
//     d'identifier son centre.

export const consentements = {
  defaut: {
    ecrit: "oui", enregistrement: "oui", citation: "oui", recontact: "oui",
  },
  P05: {
    citation: "non",
    note: "Accepte l'entretien et l'enregistrement ; refuse la citation d'extraits. Ses propos peuvent être analysés et rapportés de manière agrégée, jamais cités.",
  },
  P08: { recontact: "non", note: "Ne souhaite pas être recontacté pour la vérification des interprétations." },
  P19: {
    citation: "oui, sans élément identifiant le centre",
    note: "Citation acceptée sous condition : aucun extrait ne doit être associé au code de structure, ni contenir d'élément permettant d'identifier le centre.",
  },
  P20: { recontact: "non", note: "Départ à la retraite prévu ; ne sera pas joignable pour la vérification des interprétations." },
};

/** Consentement complet d'un participant (valeurs par défaut + particularités). */
export function consentementDe(code) {
  return { ...consentements.defaut, note: "", ...(consentements[code] || {}) };
}
