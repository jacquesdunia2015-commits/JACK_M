#!/usr/bin/env python3
"""Gestion des clients et des abonnements QualiCode — outil du VENDEUR.

Ne jamais distribuer ce fichier : il contient le secret de signature des clés.

Tout est stocké dans un simple fichier `clients.json` à côté de ce script
(sauvegardez-le : c'est votre fichier commercial). Aucun serveur, aucun compte.

Commandes
---------
  vendre    Enregistre une vente, génère la clé et l'affiche
  liste     Affiche tous les clients (état de l'abonnement)
  rappels   Liste les abonnements qui expirent bientôt (relances)
  cle       Régénère la clé d'un client (perte, réinstallation)
  revoquer  Marque un client comme résilié (mémo commercial)

Exemples
--------
  python3 tools/gestion_clients.py vendre "Marie Uwase" marie@mail.com month \\
      --appareil K7QP-3M2X --montant 15 --canal "MTN MoMo"
  python3 tools/gestion_clients.py liste
  python3 tools/gestion_clients.py rappels --jours 7
  python3 tools/gestion_clients.py cle marie@mail.com
"""
import argparse
import base64
import hashlib
import hmac
import json
import sys
from datetime import date, timedelta
from pathlib import Path

# ⚠️ DOIT être identique à LICENSE_SECRET dans js/license.js
LICENSE_SECRET = "QualiCode-2026-CHANGEZ-MOI-avant-vente"

DUREES = {"day": 1, "week": 7, "month": 31, "year": 366, "life": 36500}
NOMS = {"day": "Jour", "week": "Semaine", "month": "Mois", "year": "An", "life": "À vie"}
FICHIER = Path(__file__).resolve().parent.parent / "clients.json"


def fabriquer_cle(plan: str, exp_iso: str, licencie: str = "", appareil: str = "") -> str:
    """Même algorithme que js/license.js : HMAC-SHA256 tronqué à 20 caractères."""
    payload = f"{plan}|{exp_iso}|{licencie}|{appareil}"
    sig = hmac.new(LICENSE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
    b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"QC1-{b64}-{sig}"


def charger() -> list:
    if FICHIER.exists():
        return json.loads(FICHIER.read_text(encoding="utf-8"))
    return []


def enregistrer(clients: list) -> None:
    FICHIER.write_text(json.dumps(clients, ensure_ascii=False, indent=2), encoding="utf-8")


def etat(client: dict) -> str:
    if client.get("resilie"):
        return "résilié"
    reste = (date.fromisoformat(client["expire"]) - date.today()).days
    if reste < 0:
        return f"EXPIRÉ depuis {-reste} j"
    if reste <= 7:
        return f"expire dans {reste} j ⚠️"
    return f"actif ({reste} j)"


def cmd_vendre(a) -> None:
    debut = date.fromisoformat(a.debut) if a.debut else date.today()
    exp = (debut + timedelta(days=DUREES[a.formule])).isoformat()
    cle = fabriquer_cle(a.formule, exp, a.email, a.appareil or "")

    clients = charger()
    client = next((c for c in clients if c["email"].lower() == a.email.lower()), None)
    vente = {"date": date.today().isoformat(), "formule": a.formule,
             "montant": a.montant, "canal": a.canal, "expire": exp}
    if client:
        client.update({"nom": a.nom, "formule": a.formule, "expire": exp,
                       "appareil": a.appareil or client.get("appareil", ""),
                       "cle": cle, "resilie": False})
        client.setdefault("ventes", []).append(vente)
    else:
        clients.append({"nom": a.nom, "email": a.email, "formule": a.formule,
                        "expire": exp, "appareil": a.appareil or "", "cle": cle,
                        "resilie": False, "ventes": [vente], "note": a.note or ""})
    enregistrer(clients)

    print(f"\n✅ Vente enregistrée — {a.nom} <{a.email}>")
    print(f"   Formule  : {NOMS[a.formule]}   ·   expire le {exp}")
    if a.montant:
        print(f"   Montant  : {a.montant} $ ({a.canal or 'canal non précisé'})")
    print(f"   Appareil : {a.appareil or 'AUCUN — la clé fonctionnera sur tout appareil'}")
    print(f"\n📩 Message à envoyer au client :\n")
    print(f"Bonjour {a.nom}, merci pour votre achat de QualiCode ({NOMS[a.formule]}).")
    print(f"Votre clé de licence, valable jusqu'au {exp} :\n")
    print(f"   {cle}\n")
    print("Ouvrez QualiCode → 💳 Abonnement → collez la clé → Activer.")
    if a.appareil:
        print("Cette clé est réservée à votre appareil ; elle ne fonctionnera pas ailleurs.")
    print()


def cmd_liste(a) -> None:
    clients = charger()
    if not clients:
        print("Aucun client enregistré pour l'instant.")
        return
    total = sum(v.get("montant") or 0 for c in clients for v in c.get("ventes", []))
    print(f"\n{len(clients)} client(s) · chiffre d'affaires cumulé : {total:.2f} $\n")
    print(f"{'NOM':<24}{'EMAIL':<28}{'FORMULE':<10}{'ÉTAT':<22}APPAREIL")
    print("-" * 100)
    for c in sorted(clients, key=lambda c: c["expire"]):
        print(f"{c['nom'][:23]:<24}{c['email'][:27]:<28}{NOMS.get(c['formule'], c['formule']):<10}"
              f"{etat(c):<22}{c.get('appareil') or '—'}")
    print()


def cmd_rappels(a) -> None:
    clients = charger()
    limite = date.today() + timedelta(days=a.jours)
    a_relancer = [c for c in clients
                  if not c.get("resilie") and date.fromisoformat(c["expire"]) <= limite]
    if not a_relancer:
        print(f"Aucun abonnement n'expire dans les {a.jours} prochains jours. 👍")
        return
    print(f"\n⏰ {len(a_relancer)} abonnement(s) à relancer :\n")
    for c in sorted(a_relancer, key=lambda c: c["expire"]):
        print(f"— {c['nom']} <{c['email']}> · {NOMS.get(c['formule'])} · {etat(c)}")
        print(f"  Message : « Bonjour {c['nom']}, votre abonnement QualiCode se termine "
              f"le {c['expire']}. Souhaitez-vous le renouveler ? »\n")


def cmd_cle(a) -> None:
    clients = charger()
    c = next((c for c in clients if c["email"].lower() == a.email.lower()), None)
    if not c:
        sys.exit(f"Client introuvable : {a.email}")
    appareil = a.appareil if a.appareil is not None else c.get("appareil", "")
    cle = fabriquer_cle(c["formule"], c["expire"], c["email"], appareil)
    c["cle"], c["appareil"] = cle, appareil
    enregistrer(clients)
    print(f"\nClé de {c['nom']} (expire le {c['expire']}) :\n\n   {cle}\n")
    if appareil:
        print(f"Verrouillée sur l'appareil {appareil}.\n")


def cmd_revoquer(a) -> None:
    clients = charger()
    c = next((c for c in clients if c["email"].lower() == a.email.lower()), None)
    if not c:
        sys.exit(f"Client introuvable : {a.email}")
    c["resilie"] = True
    enregistrer(clients)
    print(f"{c['nom']} marqué comme résilié.")
    print("⚠️ Rappel : la clé déjà délivrée reste valable jusqu'à sa date d'expiration —")
    print("   une application hors ligne ne peut pas être coupée à distance.")
    print("   Concrètement : vous ne renouvellerez simplement pas cette licence.")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = p.add_subparsers(dest="cmd", required=True)

    v = sp.add_parser("vendre", help="enregistrer une vente et générer la clé")
    v.add_argument("nom"); v.add_argument("email")
    v.add_argument("formule", choices=list(DUREES))
    v.add_argument("--appareil", default="", help="code appareil du client (recommandé)")
    v.add_argument("--montant", type=float, default=None)
    v.add_argument("--canal", default="", help="MTN MoMo, Orange Money, Stripe…")
    v.add_argument("--debut", default=None, help="AAAA-MM-JJ (défaut : aujourd'hui)")
    v.add_argument("--note", default="")
    v.set_defaults(func=cmd_vendre)

    l = sp.add_parser("liste", help="afficher tous les clients"); l.set_defaults(func=cmd_liste)

    r = sp.add_parser("rappels", help="abonnements à relancer")
    r.add_argument("--jours", type=int, default=7)
    r.set_defaults(func=cmd_rappels)

    k = sp.add_parser("cle", help="régénérer la clé d'un client")
    k.add_argument("email"); k.add_argument("--appareil", default=None)
    k.set_defaults(func=cmd_cle)

    x = sp.add_parser("revoquer", help="marquer un client comme résilié")
    x.add_argument("email"); x.set_defaults(func=cmd_revoquer)

    a = p.parse_args()
    a.func(a)


if __name__ == "__main__":
    main()
