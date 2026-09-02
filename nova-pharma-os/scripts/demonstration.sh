#!/usr/bin/env bash
# =====================================================================
# NOVA PHARMA OS — démonstration de bout en bout
#
# Déroule le parcours complet sur une API en fonctionnement :
# création d'une pharmacie cliente, mise en route, réception avec lots,
# vente FEFO, facturation SaaS, impayé, suspension, réactivation.
#
#   ./scripts/demonstration.sh [http://localhost:3001/api]
# =====================================================================
set -euo pipefail

API="${1:-http://localhost:3001/api}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@novapharmaos.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-NovaPharma2026!}"
SLUG="demo-$(date +%s)"

titre() { printf '\n\033[1;36m▸ %s\033[0m\n' "$1"; }
# Extrait une valeur d'une réponse JSON : valeur organization id
valeur() {
  python3 -c '
import sys, json
donnees = json.load(sys.stdin)
for clef in sys.argv[1:]:
    donnees = donnees[int(clef) if clef.lstrip("-").isdigit() else clef]
print(donnees)
' "$@"
}

titre "Connexion au back-office SaaS"
ADMIN_TOKEN=$(curl -s -X POST "$API/auth/platform/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | valeur accessToken)
echo "  Super administrateur connecté."

titre "Création de la pharmacie cliente « $SLUG »"
CREATION=$(curl -s -X POST "$API/platform/organizations" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"slug\":\"$SLUG\",\"legalName\":\"PHARMACIE DE DÉMONSTRATION\",\"countryCode\":\"CD\",
       \"city\":\"Bukavu\",\"planCode\":\"professional\",\"startTrial\":true,
       \"owner\":{\"fullName\":\"Gérant\",\"email\":\"gerant@$SLUG.cd\",\"password\":\"Pharmacie2026!\"}}")
ORG_ID=$(echo "$CREATION" | valeur organization id)
echo "  Organisation, abonnement d'essai, branche principale, rôles et administrateur créés."

titre "Connexion de la pharmacie"
PHARMA_TOKEN=$(curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"gerant@$SLUG.cd\",\"password\":\"Pharmacie2026!\"}" | valeur accessToken)
echo "  Administrateur pharmacie connecté."

titre "Import du catalogue"
curl -s -X POST "$API/catalog/products/import" -H "Authorization: Bearer $PHARMA_TOKEN" \
  -H 'Content-Type: application/json' -d '{"products":[
    {"sku":"PARA500","name":"Paracétamol 500 mg","salePrice":1.5,"costPrice":0.85,"reorderPoint":40}]}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"  {d['created']} produit(s) importé(s).\")"
PRODUIT=$(curl -s "$API/catalog/products" -H "Authorization: Bearer $PHARMA_TOKEN" | valeur data 0 id)

titre "Réception fournisseur — deux lots de péremptions différentes"
FOURNISSEUR=$(curl -s -X POST "$API/purchasing/suppliers" -H "Authorization: Bearer $PHARMA_TOKEN" \
  -H 'Content-Type: application/json' -d '{"code":"UBI","name":"Ubipharm RDC"}' | valeur id)
curl -s -X POST "$API/purchasing/receipts" -H "Authorization: Bearer $PHARMA_TOKEN" \
  -H 'Content-Type: application/json' -d "{\"supplierId\":\"$FOURNISSEUR\",\"lines\":[
    {\"productId\":\"$PRODUIT\",\"lotNumber\":\"PROCHE\",\"expiryDate\":\"2026-11-30\",\"quantity\":60,\"unitCost\":0.85},
    {\"productId\":\"$PRODUIT\",\"lotNumber\":\"LOINTAIN\",\"expiryDate\":\"2028-04-30\",\"quantity\":240,\"unitCost\":0.80}]}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"  Bon {d['receipt']['number']} validé.\")"

titre "Ouverture de caisse et vente de 80 unités"
curl -s -X POST "$API/cash/sessions" -H "Authorization: Bearer $PHARMA_TOKEN" \
  -H 'Content-Type: application/json' -d '{"openingFloat":50}' > /dev/null
curl -s -X POST "$API/sales" -H "Authorization: Bearer $PHARMA_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"lines\":[{\"productId\":\"$PRODUIT\",\"quantity\":80}],\"payments\":[{\"method\":\"cash\",\"amount\":120}]}" \
  | python3 -c "
import sys,json;d=json.load(sys.stdin)
print(f\"  Vente {d['sale']['number']} — {d['sale']['total']} USD\")
print('  Répartition FEFO :')
for l in d['lines']: print(f\"    lot {l['lot_number']:<10} exp {l['expiry_date'][:10]}  ×{l['quantity']}\")"

titre "Facturation de l'abonnement"
curl -s -X POST "$API/platform/jobs/billing-cycle/run" -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null
curl -s "$API/platform/billing/invoices?organizationId=$ORG_ID" -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys,json;d=json.load(sys.stdin)['data']
print('  Aucune facture (période non échue).') if not d else [print(f\"  {f['number']} — {f['total']} {f['currency']} — {f['status']}\") for f in d]"

titre "Terminé"
echo "  Pharmacie : $SLUG"
echo "  Interface : http://localhost:3000 — gerant@$SLUG.cd / Pharmacie2026!"
