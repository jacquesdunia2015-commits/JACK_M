import { formatAddress } from './leases.js';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const frDate = (d: string) => {
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

export const fmtMoney = (n: number, cur: string) =>
  `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)} ${cur === 'CDF' ? 'FC' : '$'}`;

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
