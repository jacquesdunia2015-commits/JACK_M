import { formatAddress } from './leases.js';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const frDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

/** Montant avec sa monnaie (« 1 500 $ », « 25 000 FC », « 300 € », « 45 000 F CFA »…). */
export function fmtMoney(n: number, cur: string) {
  const s = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol' }).format(n);
  return s.replace('CDF', 'FC').replace(/\bXAF\b|\bXOF\b/, 'F CFA');
}

const TYPES: Record<string, string> = {
  maison: 'Maison', appartement: 'Appartement', studio: 'Studio', villa: 'Villa', chambre: 'Chambre', bureau: 'Bureau', autre: 'Bien',
};

/** Contrat de bail simple, généré depuis un modèle (cahier des charges §3.3). */
export function renderContract({ lease, landlord, tenant, property }: any): string {
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Contrat de bail n° ${lease.id}</title>
<style>
 body{font-family:Georgia,serif;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.55;color:#111}
 h1{text-align:center;font-size:22px;letter-spacing:.05em} h2{font-size:16px;margin-top:28px;border-bottom:1px solid #999}
 table{width:100%;border-collapse:collapse} td{padding:4px 0;vertical-align:top} td:first-child{width:45%;color:#444}
 .sign{display:flex;justify-content:space-between;margin-top:60px} .sign div{width:45%;border-top:1px solid #000;padding-top:6px;text-align:center}
 .no-print{text-align:center;margin-bottom:24px} @media print{.no-print{display:none}}
</style></head><body>
<div class="no-print"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
<h1>CONTRAT DE BAIL À USAGE D'HABITATION</h1>
<p style="text-align:center">Contrat n° ${lease.id}</p>

<h2>Entre les soussignés</h2>
<p><strong>Le bailleur :</strong> ${esc(landlord.full_name)}${landlord.phone ? `, tél. ${esc(landlord.phone)}` : ''}, email ${esc(landlord.email)}</p>
<p><strong>Le locataire :</strong> ${esc(tenant.first_name)} ${esc(tenant.last_name)}${tenant.nationality ? `, de nationalité ${esc(tenant.nationality)}` : ''}${tenant.id_number ? `, pièce d'identité n° ${esc(tenant.id_number)}` : ''}${tenant.profession ? `, ${esc(tenant.profession)}` : ''}${tenant.phone ? `, tél. ${esc(tenant.phone)}` : ''}</p>

<h2>Article 1 — Objet</h2>
<p>Le bailleur donne en location au locataire, qui accepte, le bien suivant : <strong>${esc(TYPES[property.type] ?? property.type)} « ${esc(property.title)} »</strong>, situé ${esc(formatAddress(property))}.</p>
<table>
<tr><td>Chambres</td><td>${property.bedrooms}</td></tr>
<tr><td>Salons</td><td>${property.living_rooms}</td></tr>
<tr><td>Toilettes internes / externes</td><td>${property.toilets_internal} / ${property.toilets_external}</td></tr>
<tr><td>Cuisines</td><td>${property.kitchens}</td></tr>
</table>

<h2>Article 2 — Durée</h2>
<p>Le bail prend effet le <strong>${frDate(lease.start_date)}</strong> et prend fin le <strong>${frDate(lease.end_date)}</strong>.
${lease.auto_renew ? 'Il sera renouvelé par tacite reconduction pour une durée identique, sauf dénonciation par l’une des parties avant son terme.' : 'Il pourra être renouvelé d’un commun accord entre les parties.'}</p>

<h2>Article 3 — Loyer</h2>
<p>Le loyer mensuel est fixé à <strong>${fmtMoney(lease.monthly_rent, lease.currency)}</strong>, payable d'avance chaque mois.</p>

<h2>Article 4 — Garantie</h2>
<p>Le locataire verse au bailleur une garantie de <strong>${fmtMoney(lease.guarantee_amount, lease.currency)}</strong>,
valable jusqu'au <strong>${frDate(lease.guarantee_expires_on)}</strong>. Elle sera restituée en fin de bail, déduction faite des sommes dues et des éventuelles réparations locatives constatées.</p>

${lease.terms ? `<h2>Article 5 — Conditions particulières</h2><p>${esc(lease.terms).replace(/\n/g, '<br>')}</p>` : ''}

<p style="margin-top:32px">Fait en deux exemplaires, le ${frDate(new Date().toISOString().slice(0, 10))}.</p>
<div class="sign"><div>Le bailleur</div><div>Le locataire</div></div>
</body></html>`;
}

const METHODS: Record<string, string> = { especes: 'Espèces', mobile_money: 'Mobile Money', virement: 'Virement', autre: 'Autre' };
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Reçu de paiement de loyer imprimable (§3.5). */
export function renderReceipt({ payment, lease, landlord, tenant, property }: any): string {
  const [y, m] = payment.period.split('-');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>Reçu n° ${String(payment.id).padStart(6, '0')}</title>
<style>
 body{font-family:Georgia,serif;max-width:640px;margin:40px auto;padding:0 24px;color:#111;line-height:1.5}
 .box{border:2px solid #111;padding:28px} h1{margin:0 0 4px;font-size:22px;letter-spacing:.05em}
 .amount{font-size:26px;font-weight:bold;margin:18px 0} table{width:100%;border-collapse:collapse;margin-top:12px}
 td{padding:5px 0;vertical-align:top} td:first-child{color:#444;width:40%}
 .sign{margin-top:48px;text-align:right} .no-print{text-align:center;margin-bottom:20px} @media print{.no-print{display:none}}
</style></head><body>
<div class="no-print"><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></div>
<div class="box">
<h1>REÇU DE LOYER</h1>
<div>N° ${String(payment.id).padStart(6, '0')} — émis le ${frDate(payment.paid_on)}</div>
<p>Je soussigné(e) <strong>${esc(landlord.full_name)}</strong>, bailleur, reconnais avoir reçu de
<strong>${esc(tenant.first_name)} ${esc(tenant.last_name)}</strong> la somme de :</p>
<div class="amount">${fmtMoney(payment.amount, lease.currency)}</div>
<table>
<tr><td>Au titre du loyer de</td><td>${MONTHS[Number(m) - 1]} ${y}</td></tr>
<tr><td>Loyer mensuel</td><td>${fmtMoney(lease.monthly_rent, lease.currency)}</td></tr>
<tr><td>Logement</td><td>${esc(property.title)} — ${esc(formatAddress(property))}</td></tr>
<tr><td>Mode de paiement</td><td>${METHODS[payment.method] ?? esc(payment.method)}${payment.reference ? ` (réf. ${esc(payment.reference)})` : ''}</td></tr>
<tr><td>Bail</td><td>n° ${lease.id}</td></tr>
</table>
${payment.amount < lease.monthly_rent ? `<p><em>Paiement partiel : ce reçu ne vaut pas quittance pour la totalité du mois.</em></p>` : ''}
<div class="sign">Le bailleur<br><br>${esc(landlord.full_name)}</div>
</div>
</body></html>`;
}
