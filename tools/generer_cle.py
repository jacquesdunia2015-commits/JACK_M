#!/usr/bin/env python3
"""Générateur de clés de licence QualiCode (outil du VENDEUR — ne pas distribuer).

Usage :
    python3 tools/generer_cle.py <formule> [licencié] [--debut AAAA-MM-JJ]

Formules : day (1 jour), week (7 jours), month (31 jours), year (366 jours),
           life (à vie).

Exemples :
    python3 tools/generer_cle.py month "marie@exemple.com"
    python3 tools/generer_cle.py year "Université de Parakou" --debut 2026-09-01

Le secret ci-dessous DOIT être identique à LICENSE_SECRET dans js/license.js.
Changez-le dans les deux fichiers avant toute vente (puis reconstruisez le
fichier standalone avec tools/build_standalone.py).
"""
import base64
import hashlib
import hmac
import sys
from datetime import date, timedelta

LICENSE_SECRET = "QualiCode-2026-CHANGEZ-MOI-avant-vente"
DUREES = {"day": 1, "week": 7, "month": 31, "year": 366, "life": 36500}


def make_key(plan: str, exp_iso: str, licensee: str = "") -> str:
    payload = f"{plan}|{exp_iso}|{licensee}"
    sig = hmac.new(LICENSE_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:20]
    b64 = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"QC1-{b64}-{sig}"


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--debut")]
    debut = date.today()
    for a in sys.argv[1:]:
        if a.startswith("--debut="):
            debut = date.fromisoformat(a.split("=", 1)[1])
    if not args or args[0] not in DUREES:
        raise SystemExit(__doc__)
    plan = args[0]
    licensee = args[1] if len(args) > 1 else ""
    exp = (debut + timedelta(days=DUREES[plan])).isoformat()
    key = make_key(plan, exp, licensee)
    print(f"Formule   : {plan}")
    print(f"Expire le : {exp}")
    print(f"Licencié  : {licensee or '(non renseigné)'}")
    print(f"\nClé à envoyer au client :\n{key}")


if __name__ == "__main__":
    main()
