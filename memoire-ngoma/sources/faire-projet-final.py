# Projet QualiCode « MEMOIRE VERSION FINALE MUKAKI DUNIA JACQUES » : analyse reprise depuis zéro.
# Part du projet vierge du protocole (58 codes, variables, mémos de méthode), sans aucune donnée.
# Les fichiers sont importés un par un, après contrôle contre la table de répartition.
#
# Usage : python3 faire-projet-final.py sortie.projx
# Fichier unique : QC_PROJET=sortie.projx QC_REMPLACE=memoire-ngoma-donnees-reelles python3 tools/build_standalone.py
import json, os, re, sys

ICI = os.path.dirname(os.path.abspath(__file__))
VIERGE = os.path.join(ICI, "..", "kit-donnees-reelles", "Memoire_Ngoma_DONNEES_REELLES_vierge.projx")
SORTIE = sys.argv[1]
MAINTENANT = "2026-11-03T08:00:00.000Z"

p = json.load(open(VIERGE, encoding="utf-8"))
p["id"] = "memoire-version-finale-mukaki-dunia-jacques"
p["name"] = "MEMOIRE VERSION FINALE MUKAKI DUNIA JACQUES"
p["versionSimulation"] = "version-finale-2026-10-29"
p["created"] = p["modified"] = MAINTENANT
assert not p["documents"] and not p["segments"], "le gabarit doit être vide"


def sans_tirets(texte, titre=False):
    texte = texte.replace(" — ", " : " if titre else ", ").replace("—", ", ").replace(" – ", ", ")
    return re.sub(r"(?m)^\s*[-–—]\s+", "", texte)


p["memo"] = (
    "MEMOIRE VERSION FINALE\n"
    "L’équité d’accès au dépistage capacitant de l’hypertension artérielle et du diabète en consultation prénatale : "
    "perceptions et pratiques déclarées des infirmiers et sages-femmes de Ngoma (Rwanda).\n"
    "MUKAKI DUNIA Jacques, Master en Santé publique, option Promotion de la santé, ENATSE, Université de Parakou (Bénin).\n"
    "Directrice : Professeure N. Fanny M. HOUNKPONOU AHOUINGNAN.\n\n"
    "Analyse reprise le 29 octobre 2026. Chaque fichier est importé après contrôle contre la table de répartition "
    "(participant, centre, fiche), puis codé avant de passer au suivant.\n\n"
    "Question centrale : comment les infirmiers et sages-femmes exerçant en consultation prénatale dans les centres de santé "
    "du district de Ngoma perçoivent-ils le dépistage de l’hypertension artérielle et du diabète chez la femme enceinte, "
    "quelles pratiques déclarent-ils, et quelle portée y reconnaissent-ils en matière d’équité d’accès au dépistage ?\n"
    "Objectif spécifique 1 : familles 1, 2 et 3. Objectif spécifique 2 : familles 4 à 9. Famille 10 : corpus d’observation."
)

for c in p["codes"]:
    c["name"] = sans_tirets(c["name"], titre=True)
for m in p["memos"]:
    m["title"] = sans_tirets(m.get("title", ""), titre=True)
    m["text"] = sans_tirets(m["text"])
    m["created"] = MAINTENANT

compteur = [0]


def memo(titre, texte):
    compteur[0] += 1
    p["memos"].append({"id": f"mf{compteur[0]:04d}", "targetType": "project", "targetId": p["id"],
                       "created": MAINTENANT, "title": titre, "text": texte})


memo("Piste d’audit : reprise de l’analyse (29 octobre 2026)",
     "L’analyse est reprise depuis un projet vide. Motif : des confusions entre participants et centres de santé, et entre "
     "grilles d’observation, dans les fichiers transmis le 27 octobre 2026 (fiches P02, P10, CS01, CS09 notamment). Les "
     "contenus transmis à partir de cette reprise priment sur les anciens. L’ancien projet « Mémoire Ngoma : données réelles » "
     "est remplacé par celui-ci. Tout écart entre les résultats repris ici et le rapport de mémoire déposé est noté dans ce mémo.")

memo("Échantillon réalisé (déclaré par le chercheur le 3 novembre 2026)",
     "Seize participants dans neuf centres de santé : six centres à un participant, un centre à deux, deux centres à quatre. "
     "Quatorze infirmiers et deux sages-femmes ; treize femmes et trois hommes ; dix de 30 à 39 ans, cinq de 40 à 49 ans, un de "
     "50 ans et plus. Un centre urbain et huit ruraux. À confirmer par la table de répartition. Dans les deux centres à quatre "
     "participants, vérifier la diversité des profils (règle du protocole, section 4.2.3.1).")

memo("Table de répartition de référence",
     "Source unique pour les attributions. À recevoir avant tout entretien.\n"
     "Colonnes : code participant (P..), code centre (CS..), milieu (rural ou urbain), qualification, sexe, tranche d’âge, "
     "ancienneté en CPN, formation aux MNT, date de l’entretien, durée de l’enregistrement, langue, citation autorisée.\n"
     "Règle : un fichier dont l’en-tête ne correspond pas à cette table n’est pas importé tant que l’écart n’est pas levé.\n"
     "Règle d’anonymat : le district ne compte qu’un centre urbain ; aucun résultat ni aucune citation n’est rattaché à ce "
     "milieu, et les citations sont identifiées par le seul code P.")

memo("Registre de réception des fichiers",
     "Une ligne par fichier reçu : date de réception ; nom du fichier ; code ; contrôle de l’en-tête (conforme ou écart) ; "
     "importé (oui ou non) ; codé (oui ou non) ; nouveaux codes inductifs.")

memo("Suffisance informationnelle : suivi après chaque entretien (§ 4.2.3.1)",
     "Le protocole retient la suffisance informationnelle (Malterud et al., 2016), et non la saturation des données "
     "(Braun et Clarke, 2021). Après chaque entretien codé, chaque dimension est cotée : faible, moyenne ou riche, avec la "
     "variation des profils et le nombre de centres qui la renseignent.\n"
     "Dimensions : 1. Sens ; 2. Pratiques techniques ; 3. Pratique informative et éducative ; 4. Conditions individuelles ; "
     "5. Conditions organisationnelles ; 6. Conditions systémiques ; 7. Conditions sociales perçues ; 8. Portée en équité ; "
     "9. Transformations proposées.\n"
     "Clôture : toutes les dimensions sont au moins moyennes, les principales sont riches, chacune est portée par plusieurs "
     "centres, et les deux derniers entretiens n’ont apporté aucun code nouveau. Tous les entretiens réalisés sont analysés.")

memo("Faits de contexte confirmés par le chercheur",
     "30 octobre 2026 : la fiche de transfert signée par le centre de santé est gratuite ; le transfert lui-même n’a pas de coût. "
     "Les obstacles financiers cités par les participants portent sur les soins à l’hôpital (ticket modérateur) et sur le "
     "transport ou l’ambulance, que le centre prend parfois en charge. Ne jamais coder ni écrire « coût du transfert ».")

memo("Décisions méthodologiques pour le mémoire (3 novembre 2026)",
     "Logiciel : écrire « les transcriptions ont été codées à l’aide d’un logiciel d’aide à l’analyse qualitative », sans le "
     "nommer. Double codage : écrire « Le double codage par un pair extérieur, prévu au protocole, n’a pu être réalisé faute de "
     "moyens ; la cohérence du codage a été contrôlée par un recodage répété et par les discussions critiques avec la directrice "
     "sur l’arbre de codage. » Pas de coefficient kappa. Pré-test : une infirmière de CS02 (deux prévues), le 16 octobre 2026 ; relances ajoutées ensuite sur le rôle des ASM et sur la contre-référence de l’hôpital. Au codage, distinguer ce que le participant dit spontanément de ce qui répond à ces relances (thème inductif des ASM). Collecte du 16 octobre au 2 novembre 2026. Autorisation du district : REF.5355/07.05.06. Aucun comité d’éthique saisi ; accord oral pour l’enregistrement, recueilli avant chaque enregistrement ; aucun exemplaire du consentement laissé aux participants. Traduction : par le "
     "chercheur, termes difficiles clarifiés avec les participants pendant l’entretien ; pas de vérification bilingue "
     "indépendante. Outils traduits par écrit en kinyarwanda ; les participants lisaient les questions du guide. Observation : "
     "une grille dans chacun des neuf centres d’entretien. À régler : le formulaire de consentement en kinyarwanda annonce un "
     "entretien sans enregistrement (point 3) et n’a pas de case pour l’enregistrement.")

# Table de répartition reçue (repartition.json, hors dépôt) : codes et profils, sans aucun nom.
REP = os.path.join(ICI, "repartition.json")
if os.path.exists(REP):
    R = json.load(open(REP, encoding="utf-8"))
    lignes = [f"{x['code']} : {x['cs']} ; {x['sexe']} ; {x['age']} ans ; {x['qualification']} ; CPN {x['anciennete_cpn']} ; "
              f"MNT {x['formation_mnt']} ; {x['milieu']}" for x in R["participants"]]
    memo(f"Table de répartition reçue le {R['recu_le']}",
         "\n".join(lignes) + "\nCentres sans participant : " + ", ".join(R["centres_sans_participant"]) + ".")

p["modified"] = MAINTENANT
json.dump(p, open(SORTIE, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
reste = [t for t in [p["memo"]] + [c["name"] for c in p["codes"]] + [m["title"] + m["text"] for m in p["memos"]]
         if re.search(r"[—–]|^\s*-\s", t, re.M)]
print(f"écrit : {SORTIE} ; {len(p['codes'])} codes ; {len(p['memos'])} mémos ; textes avec tirets : {len(reste)}")
