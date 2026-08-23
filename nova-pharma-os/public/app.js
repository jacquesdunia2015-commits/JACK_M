/* NOVA PHARMA OS — application cliente (MVP). SPA vanilla JS, aucune
   dépendance, aucun outillage de build. */

'use strict';

/* ============================ État global ============================== */

const etat = {
  token: sessionStorage.getItem('nova_token') || null,
  user: JSON.parse(sessionStorage.getItem('nova_user') || 'null'),
  organisation: null,
};

const $app = document.getElementById('app');

/* ============================ Utilitaires ============================== */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, erreur = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (erreur ? ' erreur' : '');
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

async function api(chemin, options = {}) {
  const res = await fetch('/api' + chemin, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(etat.token ? { Authorization: 'Bearer ' + etat.token } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 401 && chemin !== '/login') {
    deconnecter(false);
    throw new Error('Session expirée, veuillez vous reconnecter');
  }
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/pdf')) return res.blob();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erreur || `Erreur ${res.status}`);
  return data;
}

const fmt = (n) => Number(n ?? 0).toFixed(2);
const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const fmtDateSeule = (iso) => iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';

const LABEL_STATUT_ORDER = {
  brouillon: ['Brouillon', 'gris'], en_attente: ['En attente', 'jaune'], confirmee: ['Confirmée', 'bleu'],
  en_preparation: ['En préparation', 'violet'], prete: ['Prête', 'teal'], en_livraison: ['En livraison', 'orange'],
  partiellement_livree: ['Partiellement livrée', 'orange'], livree: ['Livrée', 'vert'],
  annulee: ['Annulée', 'rouge'], retournee: ['Retournée', 'rouge'],
};
const LABEL_STATUT_PO = {
  brouillon: ['Brouillon', 'gris'], envoyee: ['Envoyée', 'bleu'], partiellement_recue: ['Partiellement reçue', 'orange'],
  recue: ['Reçue', 'vert'], annulee: ['Annulée', 'rouge'],
};
const LABEL_STATUT_LIVRAISON = {
  a_livrer: ['À livrer', 'gris'], en_route: ['En route', 'bleu'], livree: ['Livrée', 'vert'], echec: ['Échec', 'rouge'],
};

function badge(label, couleur) { return `<span class="badge ${couleur}">${esc(label)}</span>`; }
function badgeStatut(map, statut) { const [l, c] = map[statut] || [statut, 'gris']; return badge(l, c); }

function peut(perm) {
  const PERMS = {
    admin_systeme: ['*'],
    admin_pharmacie: ['*org'],
    pharmacien: ['catalogue:read', 'catalogue:write', 'lots:read', 'lots:write', 'lots:quarantaine', 'stock:read', 'achats:read', 'ventes:read', 'commandes:read', 'commandes:valider_sensible', 'rappels:gerer', 'dashboard:read', 'audit:read'],
    gestionnaire: ['catalogue:read', 'catalogue:write', 'fournisseurs:read', 'fournisseurs:write', 'achats:read', 'achats:write', 'stock:read', 'commandes:read', 'commandes:write', 'prix:write', 'dashboard:read', 'rapports:read', 'clients:read', 'clients:write'],
    magasinier: ['catalogue:read', 'stock:read', 'stock:mouvement', 'lots:read', 'reception:write', 'inventaire:write', 'commandes:read', 'commandes:preparer', 'livraisons:read', 'livraisons:write'],
    vendeur: ['catalogue:read', 'stock:read', 'ventes:read', 'ventes:write', 'clients:read', 'clients:write', 'caisse:read', 'caisse:write', 'commandes:read', 'commandes:write'],
    comptable: ['depenses:read', 'depenses:write', 'creances:read', 'paiements:read', 'paiements:write', 'caisse:read', 'caisse:rapprocher', 'rapports:read', 'dashboard:read', 'clients:read'],
    livreur: ['livraisons:read', 'livraisons:write'],
  };
  const p = PERMS[etat.user?.role] || [];
  return p.includes('*') || p.includes('*org') || p.includes(perm);
}

/* ============================ Routage ================================== */

const routes = [];
function route(pattern, vue) { routes.push({ pattern, vue }); }

async function naviguer() {
  if (!etat.token || !etat.user) return vueLogin();
  const hash = location.hash.slice(1) || '/tableau';
  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (m) return r.vue(m);
  }
  location.hash = '/tableau';
}

window.addEventListener('hashchange', naviguer);

/* ============================ Coquille ================================= */

function coquille(titre, corpsHtml, actif) {
  const u = etat.user;
  const liens = [
    ['/tableau', 'Tableau de bord', true],
    ['/produits', 'Produits', peut('catalogue:read')],
    ['/stock', 'Stock & alertes', peut('stock:read')],
    ['/achats', 'Achats', peut('achats:read')],
    ['/ventes', 'Ventes (caisse)', peut('ventes:read')],
    ['/clients', 'Clients', peut('clients:read')],
    ['/commandes', 'Commandes B2B', peut('commandes:read')],
    ['/livraisons', 'Livraisons', peut('livraisons:read')],
    ['/finances', 'Finances', peut('paiements:read') || peut('paiements:write') || peut('creances:read') || peut('depenses:read')],
    ['/admin', 'Administration', u.role === 'admin_pharmacie' || u.role === 'admin_systeme'],
    ['/audit', "Journal d'audit", peut('audit:read')],
  ].filter((l) => l[2]);
  $app.innerHTML = `
  <div class="coquille">
    <aside class="barre-laterale">
      <div class="logo">NOVA <span>PHARMA</span> OS</div>
      <div class="org-nom">${esc(etat.organisation ? etat.organisation.nom : 'Plateforme — toutes organisations')}</div>
      <nav class="nav">
        ${liens.map(([h, l]) => `<a href="#${h}" class="${actif === h ? 'actif' : ''}">${l}</a>`).join('')}
      </nav>
      <div class="pied-nav">
        <div class="qui">${esc(u.nom)}</div>
        <div class="role">${esc(u.roleLabel)}</div>
        <button class="secondaire" id="btn-logout">Se déconnecter</button>
      </div>
    </aside>
    <main class="contenu">
      <div class="entete-page"><h2>${titre}</h2><div id="entete-actions"></div></div>
      <div id="corps">${corpsHtml}</div>
    </main>
  </div>`;
  document.getElementById('btn-logout').onclick = () => deconnecter(true);
}

async function deconnecter(appelServeur) {
  if (appelServeur) { try { await api('/logout', { method: 'POST' }); } catch { /* session déjà close */ } }
  etat.token = null; etat.user = null; etat.organisation = null;
  sessionStorage.removeItem('nova_token');
  sessionStorage.removeItem('nova_user');
  vueLogin();
}

/* ============================ Connexion ================================ */

function vueLogin() {
  $app.innerHTML = `
  <div class="ecran-login">
    <form class="boite-login" id="form-login">
      <h1>NOVA <span>PHARMA</span> OS</h1>
      <p class="sous-titre">Gestion de pharmacie — achats, stocks, ventes, B2B et livraison</p>
      <label class="champ"><span>Identifiant</span><input name="login" autocomplete="username" required autofocus></label>
      <label class="champ"><span>Mot de passe</span><input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit" style="width:100%">Se connecter</button>
      <div class="demo-comptes">
        <b>Comptes de démonstration — NOVA SANTÉ PHARMA</b> (mot de passe <code>demo1234</code>) :<br>
        <code>proprietaire</code> propriétaire · <code>pharmacien</code> pharmacien responsable ·
        <code>gestionnaire</code> achats/stock · <code>magasinier</code> réception/livraison ·
        <code>vendeur</code> caisse/ventes · <code>comptable</code> finances · <code>livreur</code> livraisons.<br>
        Admin plateforme : <code>admin</code> / <code>admin123</code>.
      </div>
    </form>
  </div>`;
  document.getElementById('form-login').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      const r = await api('/login', { method: 'POST', body: { login: fd.get('login'), password: fd.get('password') } });
      etat.token = r.token; etat.user = r.user;
      sessionStorage.setItem('nova_token', r.token);
      sessionStorage.setItem('nova_user', JSON.stringify(r.user));
      const me = await api('/me');
      etat.organisation = me.organisation;
      location.hash = '/tableau';
      naviguer();
    } catch (err) { toast(err.message, true); }
  };
}

/* ============================ Tableau de bord ========================== */

route(/^\/tableau$/, async () => {
  coquille('Tableau de bord', '<div class="chargement">Chargement…</div>', '/tableau');
  try {
    if (!etat.organisation && etat.user.organizationId) {
      const me = await api('/me'); etat.organisation = me.organisation;
    }
    const d = await api('/dashboard');
    if (d.multiOrg) {
      document.getElementById('corps').innerHTML = '<div class="carte"><p>Compte plateforme : sélectionnez une organisation pour voir son tableau de bord.</p></div>';
      return;
    }
    document.getElementById('corps').innerHTML = `
      <div class="grille-stats">
        <div class="stat"><div class="valeur">${fmt(d.aujourdhui.chiffreAffaires)}</div><div class="libelle">CA aujourd'hui (USD)</div></div>
        <div class="stat"><div class="valeur">${fmt(d.aujourdhui.margeBrute)}</div><div class="libelle">Marge brute (USD)</div></div>
        <div class="stat"><div class="valeur">${d.aujourdhui.commandes}</div><div class="libelle">Commandes aujourd'hui</div></div>
        <div class="stat"><div class="valeur">${d.aujourdhui.livraisons}</div><div class="libelle">Livraisons aujourd'hui</div></div>
        <div class="stat"><div class="valeur">${d.aujourdhui.caisse != null ? fmt(d.aujourdhui.caisse) : '—'}</div><div class="libelle">Caisse actuelle (USD)</div></div>
        <div class="stat"><div class="valeur">${fmt(d.valeurStock)}</div><div class="libelle">Valeur du stock (USD)</div></div>
        <div class="stat ${d.creances > 0 ? 'alerte' : ''}"><div class="valeur">${fmt(d.creances)}</div><div class="libelle">Créances clients (USD)</div></div>
        <div class="stat ${d.produitsEnRupture > 0 ? 'alerte' : ''}"><div class="valeur">${d.produitsEnRupture}</div><div class="libelle">Produits en rupture</div></div>
        <div class="stat ${d.produitsARisqueExpiration > 0 ? 'alerte' : ''}"><div class="valeur">${d.produitsARisqueExpiration}</div><div class="libelle">Produits à risque d'expiration</div></div>
        <div class="stat"><div class="valeur">${fmt(d.achatsRecommandes)}</div><div class="libelle">Achats recommandés (USD)</div></div>
      </div>
      <div class="deux-colonnes">
        <div class="carte">
          <h3>Produits en rupture</h3>
          ${d.ruptures.length ? `<table class="donnees"><thead><tr><th>Produit</th><th>Stock</th><th>Seuil</th></tr></thead><tbody>
            ${d.ruptures.map((r) => `<tr><td>${esc(r.nom)} <span class="note">(${esc(r.code)})</span></td><td class="cellule-num">${r.stock}</td><td class="cellule-num">${r.seuil}</td></tr>`).join('')}
          </tbody></table>` : '<div class="vide">Aucune rupture.</div>'}
        </div>
        <div class="carte">
          <h3>Péremptions à risque (&lt; 90 jours)</h3>
          ${d.peremptions.length ? `<table class="donnees"><thead><tr><th>Produit</th><th>Lot</th><th>Expire le</th><th>Jours</th></tr></thead><tbody>
            ${d.peremptions.map((p) => `<tr><td>${esc(p.nom)}</td><td>${esc(p.numeroLot)}</td><td>${fmtDateSeule(p.dateExpiration)}</td><td class="cellule-num flag ${p.joursRestants <= 30 ? 'critique' : 'bas'}">${p.joursRestants}</td></tr>`).join('')}
          </tbody></table>` : '<div class="vide">Aucune péremption à risque.</div>'}
        </div>
      </div>`;
  } catch (e) { toast(e.message, true); }
});

/* ============================ Produits (catalogue) ====================== */

route(/^\/produits$/, async () => {
  coquille('Produits', '<div class="chargement">Chargement…</div>', '/produits');
  if (peut('catalogue:write')) document.getElementById('entete-actions').innerHTML = '<a class="btn" href="#/produits/nouveau">+ Nouveau produit</a>';
  const rendre = async (q = '') => {
    const rows = await api('/products' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.getElementById('liste-produits').innerHTML = rows.length ? `
      <table class="donnees">
        <thead><tr><th>Code</th><th>Nom</th><th>Catégorie</th><th>Stock dispo.</th><th>Prix détail</th><th>Prix min.</th></tr></thead>
        <tbody>${rows.map((p) => `
          <tr class="cliquable" onclick="location.hash='/produits/${p.id}'">
            <td><b>${esc(p.code)}</b></td><td>${esc(p.nom)}</td><td>${esc(p.categorie)}</td>
            <td class="cellule-num ${p.stockDisponible <= p.seuilAlerte ? 'flag critique' : ''}">${p.stockDisponible}</td>
            <td class="cellule-num">${fmt(p.prixDetail)}</td><td class="cellule-num">${fmt(p.prixMin)}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<div class="vide">Aucun produit trouvé.</div>';
  };
  document.getElementById('corps').innerHTML = `
    <div class="carte"><input class="recherche" id="champ-recherche" placeholder="Rechercher (code, nom, DCI)…"></div>
    <div class="carte" id="liste-produits"><div class="chargement">Chargement…</div></div>`;
  let minuterie;
  document.getElementById('champ-recherche').oninput = (e) => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => rendre(e.target.value).catch((err) => toast(err.message, true)), 250);
  };
  rendre().catch((e) => toast(e.message, true));
});

function formulaireProduit(p = {}) {
  return `
  <div class="ligne-champs">
    <label class="champ"><span>Code *</span><input name="code" value="${esc(p.code || '')}" required ${p.id ? 'readonly' : ''}></label>
    <label class="champ"><span>Nom *</span><input name="nom" value="${esc(p.nom || '')}" required></label>
    <label class="champ"><span>DCI</span><input name="dci" value="${esc(p.dci || '')}"></label>
    <label class="champ"><span>Dosage</span><input name="dosage" value="${esc(p.dosage || '')}"></label>
    <label class="champ"><span>Forme</span><input name="forme" value="${esc(p.forme || '')}"></label>
    <label class="champ"><span>Unité</span><input name="unite" value="${esc(p.unite || 'boîte')}"></label>
    <label class="champ"><span>Catégorie</span><input name="categorie" value="${esc(p.categorie || '')}"></label>
  </div>
  <div class="ligne-champs">
    <label class="champ"><span>Prix d'achat</span><input name="prixAchat" type="number" step="0.01" value="${p.prixAchat ?? ''}"></label>
    <label class="champ"><span>Prix détail</span><input name="prixDetail" type="number" step="0.01" value="${p.prixDetail ?? ''}"></label>
    <label class="champ"><span>Prix professionnel</span><input name="prixPro" type="number" step="0.01" value="${p.prixPro ?? ''}"></label>
    <label class="champ"><span>Prix semi-gros</span><input name="prixSemiGros" type="number" step="0.01" value="${p.prixSemiGros ?? ''}"></label>
    <label class="champ"><span>Prix minimum</span><input name="prixMin" type="number" step="0.01" value="${p.prixMin ?? ''}"></label>
  </div>
  <div class="ligne-champs">
    <label class="champ"><span>Stock minimum</span><input name="stockMin" type="number" value="${p.stockMin ?? ''}"></label>
    <label class="champ"><span>Stock maximum</span><input name="stockMax" type="number" value="${p.stockMax ?? ''}"></label>
    <label class="champ"><span>Seuil d'alerte</span><input name="seuilAlerte" type="number" value="${p.seuilAlerte ?? ''}"></label>
  </div>`;
}

route(/^\/produits\/nouveau$/, async () => {
  coquille('Nouveau produit', `
    <form class="carte" id="form-produit">
      ${formulaireProduit()}
      <div class="actions"><button type="submit">Créer le produit</button>
        <a class="btn secondaire" href="#/produits" style="background:#e2e8f0;color:#1e293b">Annuler</a></div>
    </form>`, '/produits');
  document.getElementById('form-produit').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const p = await api('/products', { method: 'POST', body });
      toast(`Produit ${p.code} créé`);
      location.hash = '/produits/' + p.id;
    } catch (err) { toast(err.message, true); }
  };
});

route(/^\/produits\/([\w-]+)$/, async (m) => {
  coquille('Fiche produit', '<div class="chargement">Chargement…</div>', '/produits');
  try {
    const { produit: p, lots, mouvements } = await api('/products/' + m[1]);
    coquille(`${esc(p.code)} — ${esc(p.nom)}`, `
      <div class="deux-colonnes">
        <form class="carte" id="form-produit">
          <h3>Informations produit</h3>
          ${formulaireProduit(p)}
          ${peut('catalogue:write') || peut('prix:write') ? '<div class="actions"><button type="submit">Enregistrer</button></div>' : ''}
        </form>
        <div>
          <div class="carte">
            <h3>Lots (FEFO)</h3>
            ${lots.length ? `<table class="donnees"><thead><tr><th>N° lot</th><th>Quantité</th><th>Expire le</th><th>Statut</th></tr></thead><tbody>
              ${lots.map((l) => `<tr class="cliquable" onclick="location.hash='/lots/${l.id}'">
                <td>${esc(l.numeroLot)}</td><td class="cellule-num">${l.quantite}</td>
                <td>${fmtDateSeule(l.dateExpiration)}</td>
                <td>${l.statut === 'actif' ? badge('Actif', 'vert') : l.statut === 'quarantaine' ? badge('Quarantaine', 'rouge') : badge(l.statut, 'gris')}</td>
              </tr>`).join('')}</tbody></table>` : '<div class="vide">Aucun lot.</div>'}
          </div>
          <div class="carte">
            <h3>Mouvements récents</h3>
            ${mouvements.length ? `<table class="donnees"><tbody>${mouvements.map((mv) => `
              <tr><td><span class="note">${fmtDate(mv.ts)}</span></td><td>${esc(mv.type)}</td>
              <td class="cellule-num ${mv.quantite < 0 ? 'flag critique' : 'flag normal'}">${mv.quantite > 0 ? '+' : ''}${mv.quantite}</td>
              <td class="note">${esc(mv.motif)}</td></tr>`).join('')}</tbody></table>` : '<div class="vide">Aucun mouvement.</div>'}
          </div>
        </div>
      </div>`, '/produits');
    const form = document.getElementById('form-produit');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/products/' + p.id, { method: 'PUT', body: Object.fromEntries(new FormData(form)) });
        toast('Produit mis à jour');
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Stock & alertes ============================ */

route(/^\/stock$/, async () => {
  coquille('Stock & alertes', '<div class="chargement">Chargement…</div>', '/stock');
  try {
    const alertes = await api('/stock/alerts');
    document.getElementById('corps').innerHTML = `
      <div class="deux-colonnes">
        <div class="carte">
          <h3>Ruptures (§16)</h3>
          ${alertes.ruptures.length ? `<table class="donnees"><thead><tr><th>Produit</th><th>Stock</th><th>Seuil</th></tr></thead><tbody>
            ${alertes.ruptures.map((r) => `<tr class="cliquable" onclick="location.hash='/produits/${r.productId}'"><td>${esc(r.nom)} <span class="note">(${esc(r.code)})</span></td><td class="cellule-num">${r.stock}</td><td class="cellule-num">${r.seuil}</td></tr>`).join('')}
          </tbody></table>` : '<div class="vide">Aucune rupture.</div>'}
        </div>
        <div class="carte">
          <h3>Péremptions à risque</h3>
          ${alertes.peremptions.length ? `<table class="donnees"><thead><tr><th>Produit</th><th>Lot</th><th>Expire le</th><th>Jours</th><th>Qté</th></tr></thead><tbody>
            ${alertes.peremptions.map((p) => `<tr class="cliquable" onclick="location.hash='/lots/${p.productId}'"><td>${esc(p.nom)}</td><td>${esc(p.numeroLot)}</td><td>${fmtDateSeule(p.dateExpiration)}</td><td class="cellule-num">${p.joursRestants}</td><td class="cellule-num">${p.quantite}</td></tr>`).join('')}
          </tbody></table>` : '<div class="vide">Aucune péremption à risque.</div>'}
        </div>
      </div>
      <div class="carte">
        <h3>Surstock</h3>
        ${alertes.surstock.length ? `<table class="donnees"><tbody>${alertes.surstock.map((s) => `<tr><td>${esc(s.nom)}</td><td class="cellule-num">${s.stock} / ${s.stockMax}</td></tr>`).join('')}</tbody></table>` : '<div class="vide">Aucun surstock détecté.</div>'}
      </div>`;
  } catch (e) { toast(e.message, true); }
});

route(/^\/lots\/([\w-]+)$/, async (m) => {
  coquille('Détail du lot', '<div class="chargement">Chargement…</div>', '/stock');
  try {
    const { lot, mouvements, ventesAssociees } = await api('/batches/' + m[1]);
    coquille(`Lot ${esc(lot.numeroLot)}`, `
      <div class="carte">
        <div class="ligne-champs">
          <div><b>Quantité</b><br>${lot.quantite}</div>
          <div><b>Expire le</b><br>${fmtDateSeule(lot.dateExpiration)}</div>
          <div><b>Statut</b><br>${lot.statut === 'actif' ? badge('Actif', 'vert') : badge(lot.statut, 'rouge')}</div>
          <div><b>Prix d'achat</b><br>${fmt(lot.prixAchatUnitaire)} USD</div>
        </div>
        ${peut('lots:quarantaine') ? `<div class="actions">
          <button class="danger" id="btn-quarantaine">${lot.statut === 'quarantaine' ? 'Libérer de quarantaine' : 'Mettre en quarantaine'}</button>
        </div>` : ''}
      </div>
      <div class="carte">
        <h3>Mouvements (traçabilité §11)</h3>
        <table class="donnees"><tbody>${mouvements.map((mv) => `
          <tr><td><span class="note">${fmtDate(mv.ts)}</span></td><td>${esc(mv.type)}</td>
          <td class="cellule-num">${mv.quantite > 0 ? '+' : ''}${mv.quantite}</td><td class="note">${esc(mv.motif)}</td></tr>`).join('')}</tbody></table>
      </div>
      <div class="carte">
        <h3>Ventes associées à ce lot</h3>
        ${ventesAssociees.length ? `<ul class="chrono">${ventesAssociees.map((v) => `<li><b>${esc(v.numero)}</b> — ${fmtDate(v.ts)}</li>`).join('')}</ul>` : '<div class="vide">Aucune vente associée.</div>'}
      </div>`, '/stock');
    const btnQ = document.getElementById('btn-quarantaine');
    if (btnQ) btnQ.onclick = async () => {
      const motif = prompt('Motif :');
      if (!motif) return;
      try {
        await api(`/batches/${lot.id}/quarantaine`, { method: 'POST', body: { motif, liberer: lot.statut === 'quarantaine' } });
        toast('Statut du lot mis à jour');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Achats ===================================== */

route(/^\/achats$/, async () => {
  coquille('Achats', '<div class="chargement">Chargement…</div>', '/achats');
  if (peut('achats:write')) document.getElementById('entete-actions').innerHTML = '<a class="btn" href="#/achats/nouvelle">+ Nouvelle commande</a>';
  try {
    const [commandes, fournisseurs] = await Promise.all([api('/purchase-orders'), api('/suppliers')]);
    document.getElementById('corps').innerHTML = `
      <div class="carte">
        <h3>Commandes d'achat</h3>
        ${commandes.length ? `<table class="donnees"><thead><tr><th>N°</th><th>Fournisseur</th><th>Statut</th><th>Créée le</th></tr></thead><tbody>
          ${commandes.map((c) => `<tr class="cliquable" onclick="location.hash='/achats/${c.id}'">
            <td><b>${esc(c.numero)}</b></td><td>${esc(c.fournisseurNom)}</td><td>${badgeStatut(LABEL_STATUT_PO, c.statut)}</td><td>${fmtDate(c.cree)}</td>
          </tr>`).join('')}</tbody></table>` : '<div class="vide">Aucune commande.</div>'}
      </div>
      <div class="carte">
        <h3>Fournisseurs</h3>
        <table class="donnees"><tbody>${fournisseurs.map((f) => `<tr><td><b>${esc(f.nom)}</b></td><td>${esc(f.ville)}</td><td>${esc(f.telephone)}</td><td class="note">délai ${f.delaiJours} j</td></tr>`).join('')}</tbody></table>
        ${peut('fournisseurs:write') ? `<form id="form-fournisseur" style="margin-top:.8rem">
          <div class="ligne-champs">
            <label class="champ"><span>Nom *</span><input name="nom" required></label>
            <label class="champ"><span>Ville</span><input name="ville"></label>
            <label class="champ"><span>Téléphone</span><input name="telephone"></label>
            <label class="champ"><span>Délai (jours)</span><input name="delaiJours" type="number" value="7"></label>
          </div>
          <button type="submit">Ajouter un fournisseur</button>
        </form>` : ''}
      </div>`;
    const ff = document.getElementById('form-fournisseur');
    if (ff) ff.onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/suppliers', { method: 'POST', body: Object.fromEntries(new FormData(ff)) }); toast('Fournisseur ajouté'); naviguer(); }
      catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

route(/^\/achats\/nouvelle$/, async () => {
  coquille('Nouvelle commande d\'achat', '<div class="chargement">Chargement…</div>', '/achats');
  try {
    const [fournisseurs, produits] = await Promise.all([api('/suppliers'), api('/products')]);
    document.getElementById('corps').innerHTML = `
      <form class="carte" id="form-po">
        <label class="champ" style="max-width:400px"><span>Fournisseur *</span>
          <select name="fournisseurId" required>${fournisseurs.map((f) => `<option value="${f.id}">${esc(f.nom)}</option>`).join('')}</select>
        </label>
        <h3>Lignes à commander</h3>
        <div id="lignes-po"></div>
        <button type="button" class="secondaire" id="btn-ajouter-ligne">+ Ajouter une ligne</button>
        <div class="actions"><button type="submit">Créer la commande (brouillon)</button></div>
      </form>`;
    const lignesDiv = document.getElementById('lignes-po');
    const optionsProduits = produits.map((p) => `<option value="${p.id}" data-prix="${p.prixAchat}">${esc(p.code)} — ${esc(p.nom)}</option>`).join('');
    const ajouterLigne = () => {
      const div = document.createElement('div');
      div.className = 'ligne-champs';
      div.style.marginBottom = '.6rem';
      div.innerHTML = `
        <label class="champ"><span>Produit</span><select name="produit">${optionsProduits}</select></label>
        <label class="champ"><span>Quantité</span><input name="quantite" type="number" value="1" min="1"></label>
        <label class="champ"><span>Prix unitaire</span><input name="prix" type="number" step="0.01"></label>`;
      lignesDiv.appendChild(div);
      const select = div.querySelector('select');
      const prixInput = div.querySelector('input[name=prix]');
      const maj = () => { prixInput.value = select.selectedOptions[0]?.dataset.prix || ''; };
      select.onchange = maj; maj();
    };
    ajouterLigne();
    document.getElementById('btn-ajouter-ligne').onclick = ajouterLigne;
    document.getElementById('form-po').onsubmit = async (e) => {
      e.preventDefault();
      const fournisseurId = e.target.fournisseurId.value;
      const lignes = [...lignesDiv.children].map((div) => ({
        productId: div.querySelector('select').value,
        quantiteCommandee: Number(div.querySelector('input[name=quantite]').value),
        prixUnitaire: Number(div.querySelector('input[name=prix]').value),
      }));
      try {
        const po = await api('/purchase-orders', { method: 'POST', body: { fournisseurId, lignes } });
        toast(`Commande ${po.numero} créée`);
        location.hash = '/achats/' + po.id;
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

route(/^\/achats\/([\w-]+)$/, async (m) => {
  coquille('Commande d\'achat', '<div class="chargement">Chargement…</div>', '/achats');
  try {
    const po = await api('/purchase-orders/' + m[1]);
    const receptionOuverte = ['envoyee', 'partiellement_recue'].includes(po.statut) && (peut('reception:write') || peut('achats:write'));
    coquille(`Commande ${esc(po.numero)}`, `
      <div class="carte">
        <div class="ligne-champs">
          <div><b>Fournisseur</b><br>${esc(po.fournisseur.nom)}</div>
          <div><b>Statut</b><br>${badgeStatut(LABEL_STATUT_PO, po.statut)}</div>
          <div><b>Créée le</b><br>${fmtDate(po.cree)}</div>
        </div>
        <div class="actions">
          ${po.statut === 'brouillon' && peut('achats:write') ? '<button id="btn-envoyer">Envoyer au fournisseur</button>' : ''}
          ${!['recue', 'annulee'].includes(po.statut) && peut('achats:write') ? '<button class="danger" id="btn-annuler">Annuler</button>' : ''}
        </div>
      </div>
      <form class="carte" id="form-reception">
        <h3>Lignes ${receptionOuverte ? '<span class="note">— saisir la réception</span>' : ''}</h3>
        <table class="donnees">
          <thead><tr><th>Produit</th><th>Commandé</th><th>Reçu</th>${receptionOuverte ? '<th>Qté à réceptionner</th><th>N° de lot</th><th>Date d\'expiration</th>' : ''}</tr></thead>
          <tbody>${po.lignes.map((l) => `
            <tr>
              <td>${esc(l.produitNom)} <span class="note">(${esc(l.produitCode)})</span></td>
              <td class="cellule-num">${l.quantiteCommandee}</td><td class="cellule-num">${l.quantiteRecue}</td>
              ${receptionOuverte ? `
                <td><input name="qte_${l.productId}" type="number" min="0" max="${l.quantiteCommandee - l.quantiteRecue}" value="${l.quantiteRecue < l.quantiteCommandee ? l.quantiteCommandee - l.quantiteRecue : 0}"></td>
                <td><input name="lot_${l.productId}" placeholder="N° de lot"></td>
                <td><input name="exp_${l.productId}" type="date"></td>` : ''}
            </tr>`).join('')}</tbody>
        </table>
        ${receptionOuverte ? '<div class="actions"><button type="submit">Confirmer la réception</button></div>' : ''}
      </form>`, '/achats');
    const btnEnvoyer = document.getElementById('btn-envoyer');
    if (btnEnvoyer) btnEnvoyer.onclick = async () => { try { await api(`/purchase-orders/${po.id}/envoyer`, { method: 'POST' }); toast('Commande envoyée'); naviguer(); } catch (e) { toast(e.message, true); } };
    const btnAnnuler = document.getElementById('btn-annuler');
    if (btnAnnuler) btnAnnuler.onclick = async () => { try { await api(`/purchase-orders/${po.id}/annuler`, { method: 'POST' }); toast('Commande annulée'); naviguer(); } catch (e) { toast(e.message, true); } };
    const formR = document.getElementById('form-reception');
    if (formR && receptionOuverte) formR.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(formR);
      const lignes = po.lignes.map((l) => ({
        productId: l.productId, quantiteRecue: Number(fd.get('qte_' + l.productId) || 0),
        numeroLot: fd.get('lot_' + l.productId), dateExpiration: fd.get('exp_' + l.productId),
      })).filter((l) => l.quantiteRecue > 0);
      if (!lignes.length) return toast('Indiquez au moins une quantité à réceptionner', true);
      try {
        await api(`/purchase-orders/${po.id}/receptionner`, { method: 'POST', body: { lignes } });
        toast('Réception enregistrée, lots créés');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Ventes (POS / caisse) ======================= */

route(/^\/ventes$/, async () => {
  coquille('Ventes (caisse)', '<div class="chargement">Chargement…</div>', '/ventes');
  try {
    const [session, produits, clients] = await Promise.all([
      api('/cash-sessions/current'), api('/products'), peut('clients:read') ? api('/customers') : [],
    ]);
    if (!session) {
      document.getElementById('corps').innerHTML = `
        <div class="carte">
          <h3>Aucune session de caisse ouverte</h3>
          <form id="form-ouverture">
            <label class="champ" style="max-width:260px"><span>Fond de caisse (USD)</span><input name="montantOuverture" type="number" step="0.01" value="0" required></label>
            <button type="submit">Ouvrir la caisse</button>
          </form>
        </div>`;
      document.getElementById('form-ouverture').onsubmit = async (e) => {
        e.preventDefault();
        try { await api('/cash-sessions/open', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Caisse ouverte'); naviguer(); }
        catch (err) { toast(err.message, true); }
      };
      return;
    }
    document.getElementById('entete-actions').innerHTML = `<span class="note">Caisse ouverte depuis ${fmtDate(session.ouvertureTs)} par ${esc(session.userNom || '')}</span>`;
    document.getElementById('corps').innerHTML = `
      <div class="deux-colonnes">
        <form class="carte" id="form-vente">
          <h3>Nouvelle vente</h3>
          <label class="champ"><span>Client (optionnel — laisser vide pour comptoir)</span>
            <select name="customerId"><option value="">— Client comptoir —</option>
              ${clients.map((c) => `<option value="${c.id}">${esc(c.nom)} (${c.categorieTarifaire})</option>`).join('')}
            </select></label>
          <label class="champ"><span>Ajouter un produit</span>
            <select id="select-produit">${produits.map((p) => `<option value="${p.id}" data-prix="${p.prixDetail}" data-dispo="${p.stockDisponible}">${esc(p.code)} — ${esc(p.nom)} (dispo ${p.stockDisponible})</option>`).join('')}</select></label>
          <button type="button" class="secondaire" id="btn-ajouter-panier">+ Ajouter au panier</button>
          <div id="panier" style="margin-top:1rem"></div>
          <div class="total-panier" id="total-panier">Total : 0.00 USD</div>
          <label class="champ" style="max-width:260px"><span>Mode de paiement</span>
            <select name="paiementMode"><option value="especes">Espèces</option><option value="mobile_money">Mobile Money</option><option value="credit">Crédit (client B2B)</option></select>
          </label>
          <div class="actions"><button type="submit">Enregistrer la vente</button>
            <button type="button" class="danger" id="btn-fermer-caisse">Clôturer la caisse</button></div>
        </form>
        <div class="carte">
          <h3>Ventes de la session</h3>
          <div id="ventes-session"><div class="chargement">Chargement…</div></div>
        </div>
      </div>`;

    const panier = [];
    const rendrePanier = () => {
      document.getElementById('panier').innerHTML = panier.length ? panier.map((l, i) => `
        <div class="panier-ligne">
          <span class="nom">${esc(l.nom)}</span>
          <input type="number" min="1" data-i="${i}" value="${l.quantite}" class="qte-panier">
          <span class="note">${fmt(l.prixUnitaire)} USD/u</span>
          <button type="button" class="secondaire" data-retirer="${i}">✕</button>
        </div>`).join('') : '<div class="vide">Panier vide.</div>';
      document.getElementById('total-panier').textContent = `Total : ${fmt(panier.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0))} USD`;
      document.querySelectorAll('.qte-panier').forEach((inp) => { inp.oninput = () => { panier[inp.dataset.i].quantite = Number(inp.value); rendrePanier(); }; });
      document.querySelectorAll('[data-retirer]').forEach((btn) => { btn.onclick = () => { panier.splice(Number(btn.dataset.retirer), 1); rendrePanier(); }; });
    };
    document.getElementById('btn-ajouter-panier').onclick = () => {
      const sel = document.getElementById('select-produit');
      const opt = sel.selectedOptions[0];
      panier.push({ productId: sel.value, nom: opt.textContent, prixUnitaire: Number(opt.dataset.prix), quantite: 1 });
      rendrePanier();
    };
    rendrePanier();

    const rendreVentes = async () => {
      const ventes = (await api('/sales')).filter((v) => v.cashSessionId === session.id);
      document.getElementById('ventes-session').innerHTML = ventes.length ? `
        <table class="donnees"><tbody>${ventes.map((v) => `
          <tr><td><b>${esc(v.numero)}</b><br><span class="note">${fmtDate(v.cree)}</span></td>
          <td class="cellule-num">${fmt(v.total)} USD</td>
          <td><a class="btn secondaire" href="/api/sales/${v.id}/pdf" target="_blank" onclick="event.stopPropagation()">Reçu PDF</a></td></tr>`).join('')}</tbody></table>`
        : '<div class="vide">Aucune vente dans cette session.</div>';
    };
    rendreVentes().catch((e) => toast(e.message, true));

    document.getElementById('form-vente').onsubmit = async (e) => {
      e.preventDefault();
      if (!panier.length) return toast('Le panier est vide', true);
      const fd = new FormData(e.target);
      try {
        await api('/sales', {
          method: 'POST',
          body: {
            customerId: fd.get('customerId') || null, paiementMode: fd.get('paiementMode'),
            lignes: panier.map((l) => ({ productId: l.productId, quantite: l.quantite })),
          },
        });
        toast('Vente enregistrée');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
    document.getElementById('btn-fermer-caisse').onclick = async () => {
      const reel = prompt('Montant réel compté en caisse (USD) :');
      if (reel === null) return;
      try {
        const r = await api(`/cash-sessions/${session.id}/close`, { method: 'POST', body: { montantFermetureReel: Number(reel) } });
        toast(`Caisse clôturée — écart : ${fmt(r.ecart)} USD`);
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Clients ===================================== */

route(/^\/clients$/, async () => {
  coquille('Clients', '<div class="chargement">Chargement…</div>', '/clients');
  if (peut('clients:write')) document.getElementById('entete-actions').innerHTML = '<a class="btn" href="#/clients/nouveau">+ Nouveau client</a>';
  const rendre = async (q = '') => {
    const rows = await api('/customers' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.getElementById('liste-clients').innerHTML = rows.length ? `
      <table class="donnees"><thead><tr><th>Nom</th><th>Type</th><th>Téléphone</th><th>Encours</th></tr></thead><tbody>
        ${rows.map((c) => `<tr class="cliquable" onclick="location.hash='/clients/${c.id}'">
          <td><b>${esc(c.nom)}</b></td><td>${c.type === 'professionnel' ? badge('B2B', 'bleu') : badge('Particulier', 'gris')}</td>
          <td>${esc(c.telephone)}</td><td class="cellule-num ${c.encours > 0 ? 'flag bas' : ''}">${fmt(c.encours)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="vide">Aucun client.</div>';
  };
  document.getElementById('corps').innerHTML = `
    <div class="carte"><input class="recherche" id="champ-recherche" placeholder="Rechercher (nom, téléphone)…"></div>
    <div class="carte" id="liste-clients"><div class="chargement">Chargement…</div></div>`;
  let minuterie;
  document.getElementById('champ-recherche').oninput = (e) => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => rendre(e.target.value).catch((err) => toast(err.message, true)), 250);
  };
  rendre().catch((e) => toast(e.message, true));
});

route(/^\/clients\/nouveau$/, async () => {
  coquille('Nouveau client', `
    <form class="carte" id="form-client">
      <div class="ligne-champs">
        <label class="champ"><span>Type</span><select name="type"><option value="particulier">Particulier</option><option value="professionnel">Professionnel (B2B)</option></select></label>
        <label class="champ"><span>Nom *</span><input name="nom" required></label>
        <label class="champ"><span>Téléphone *</span><input name="telephone" required></label>
        <label class="champ"><span>WhatsApp</span><input name="whatsapp"></label>
        <label class="champ"><span>Ville</span><input name="ville" value="Bukavu"></label>
        <label class="champ"><span>Catégorie tarifaire</span><select name="categorieTarifaire">
          <option value="detail">Détail</option><option value="pro">Professionnel</option><option value="semi_gros">Semi-gros</option></select></label>
        <label class="champ"><span>Plafond de crédit (USD)</span><input name="plafondCredit" type="number" value="0"></label>
        <label class="champ"><span>Responsable (si B2B)</span><input name="responsable"></label>
      </div>
      <label class="champ"><span>Adresse</span><input name="adresse"></label>
      <div class="actions"><button type="submit">Créer le client</button></div>
    </form>`, '/clients');
  document.getElementById('form-client').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const c = await api('/customers', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      toast(`Client ${c.nom} créé`);
      location.hash = '/clients/' + c.id;
    } catch (err) { toast(err.message, true); }
  };
});

route(/^\/clients\/([\w-]+)$/, async (m) => {
  coquille('Fiche client', '<div class="chargement">Chargement…</div>', '/clients');
  try {
    const { client: c, commandes, paiements } = await api('/customers/' + m[1]);
    coquille(esc(c.nom), `
      <div class="carte">
        <div class="ligne-champs">
          <div><b>Type</b><br>${c.type === 'professionnel' ? 'Professionnel (B2B)' : 'Particulier'}</div>
          <div><b>Téléphone</b><br>${esc(c.telephone)}</div>
          <div><b>Catégorie tarifaire</b><br>${esc(c.categorieTarifaire)}</div>
          <div><b>Encours / Plafond</b><br>${fmt(c.encours)} / ${fmt(c.plafondCredit)} USD</div>
        </div>
        ${peut('commandes:write') ? `<div class="actions"><a class="btn" href="#/commandes/nouvelle/${c.id}">+ Nouvelle commande</a></div>` : ''}
      </div>
      <div class="carte">
        <h3>Commandes</h3>
        ${commandes.length ? `<table class="donnees"><tbody>${commandes.map((o) => `
          <tr class="cliquable" onclick="location.hash='/commandes/${o.id}'"><td><b>${esc(o.numero)}</b><br><span class="note">${fmtDate(o.cree)}</span></td>
          <td class="cellule-num">${fmt(o.total)} USD</td><td>${badgeStatut(LABEL_STATUT_ORDER, o.statut)}</td></tr>`).join('')}</tbody></table>`
          : '<div class="vide">Aucune commande.</div>'}
      </div>
      <div class="carte">
        <h3>Paiements</h3>
        ${paiements.length ? `<table class="donnees"><tbody>${paiements.map((p) => `<tr><td>${fmtDate(p.ts)}</td><td class="cellule-num">${fmt(p.montant)} USD</td><td>${esc(p.mode)}</td></tr>`).join('')}</tbody></table>`
          : '<div class="vide">Aucun paiement.</div>'}
        ${peut('paiements:write') ? `<form id="form-paiement" style="margin-top:.8rem">
          <div class="ligne-champs">
            <label class="champ"><span>Montant (USD)</span><input name="montant" type="number" step="0.01" required></label>
            <label class="champ"><span>Mode</span><select name="mode"><option value="especes">Espèces</option><option value="mobile_money">Mobile Money</option><option value="banque">Banque</option></select></label>
          </div>
          <button type="submit">Enregistrer un paiement</button>
        </form>` : ''}
      </div>`, '/clients');
    const fp = document.getElementById('form-paiement');
    if (fp) fp.onsubmit = async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(fp));
      body.customerId = c.id;
      try { await api('/payments', { method: 'POST', body }); toast('Paiement enregistré'); naviguer(); }
      catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Commandes B2B ================================ */

route(/^\/commandes$/, async () => {
  coquille('Commandes B2B', '<div class="chargement">Chargement…</div>', '/commandes');
  const filtres = ['', 'brouillon', 'en_attente', 'confirmee', 'en_preparation', 'prete', 'en_livraison', 'livree', 'annulee'];
  const rendre = async (statut = '') => {
    const rows = await api('/customer-orders' + (statut ? '?statut=' + statut : ''));
    document.getElementById('liste-commandes').innerHTML = rows.length ? `
      <table class="donnees"><thead><tr><th>N°</th><th>Client</th><th>Total</th><th>Statut</th><th>Créée le</th></tr></thead><tbody>
        ${rows.map((o) => `<tr class="cliquable" onclick="location.hash='/commandes/${o.id}'">
          <td><b>${esc(o.numero)}</b></td><td>${esc(o.clientNom)}</td><td class="cellule-num">${fmt(o.total)} USD</td>
          <td>${badgeStatut(LABEL_STATUT_ORDER, o.statut)}</td><td>${fmtDate(o.cree)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="vide">Aucune commande pour ce filtre.</div>';
  };
  document.getElementById('corps').innerHTML = `
    <div class="carte"><label class="champ" style="max-width:280px"><span>Filtrer par statut</span>
      <select id="filtre-statut">${filtres.map((f) => `<option value="${f}">${f ? (LABEL_STATUT_ORDER[f] || [f])[0] : 'Toutes'}</option>`).join('')}</select></label></div>
    <div class="carte" id="liste-commandes"></div>`;
  document.getElementById('filtre-statut').onchange = (e) => rendre(e.target.value).catch((err) => toast(err.message, true));
  rendre().catch((e) => toast(e.message, true));
});

route(/^\/commandes\/nouvelle\/([\w-]+)$/, async (m) => {
  coquille('Nouvelle commande', '<div class="chargement">Chargement…</div>', '/commandes');
  try {
    const [{ client }, produits] = await Promise.all([api('/customers/' + m[1]), api('/products')]);
    document.getElementById('corps').innerHTML = `
      <form class="carte" id="form-commande">
        <h3>Client : ${esc(client.nom)}</h3>
        <div id="lignes-commande"></div>
        <button type="button" class="secondaire" id="btn-ajouter-ligne">+ Ajouter une ligne</button>
        <div class="ligne-champs" style="margin-top:1rem">
          <label class="champ"><span>Moyen de paiement</span><select name="moyenPaiement"><option value="comptant">Comptant</option><option value="credit">Crédit</option></select></label>
          <label class="champ"><span>Adresse de livraison</span><input name="adresseLivraison" value="${esc(client.adresse || '')}"></label>
        </div>
        <div class="actions"><button type="submit">Créer la commande</button></div>
      </form>`;
    const champTarif = { detail: 'prixDetail', pro: 'prixPro', semi_gros: 'prixSemiGros' }[client.categorieTarifaire] || 'prixDetail';
    const optionsProduits = produits.map((p) => `<option value="${p.id}" data-prix="${p[champTarif]}">${esc(p.code)} — ${esc(p.nom)}</option>`).join('');
    const lignesDiv = document.getElementById('lignes-commande');
    const ajouterLigne = () => {
      const div = document.createElement('div');
      div.className = 'ligne-champs';
      div.style.marginBottom = '.6rem';
      div.innerHTML = `
        <label class="champ"><span>Produit</span><select name="produit">${optionsProduits}</select></label>
        <label class="champ"><span>Quantité</span><input name="quantite" type="number" value="1" min="1"></label>
        <label class="champ"><span>Prix unitaire</span><input name="prix" type="number" step="0.01"></label>`;
      lignesDiv.appendChild(div);
      const select = div.querySelector('select');
      const prixInput = div.querySelector('input[name=prix]');
      const maj = () => { prixInput.value = select.selectedOptions[0]?.dataset.prix || ''; };
      select.onchange = maj; maj();
    };
    ajouterLigne();
    document.getElementById('btn-ajouter-ligne').onclick = ajouterLigne;
    document.getElementById('form-commande').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const lignes = [...lignesDiv.children].map((div) => ({
        productId: div.querySelector('select').value, quantite: Number(div.querySelector('input[name=quantite]').value),
        prixUnitaire: Number(div.querySelector('input[name=prix]').value),
      }));
      try {
        const o = await api('/customer-orders', {
          method: 'POST',
          body: { customerId: client.id, lignes, moyenPaiement: fd.get('moyenPaiement'), adresseLivraison: fd.get('adresseLivraison') },
        });
        toast(`Commande ${o.numero} créée`);
        location.hash = '/commandes/' + o.id;
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

route(/^\/commandes\/([\w-]+)$/, async (m) => {
  coquille('Commande', '<div class="chargement">Chargement…</div>', '/commandes');
  try {
    const o = await api('/customer-orders/' + m[1]);
    const TRANSITIONS = {
      brouillon: ['en_attente', 'annulee'], en_attente: ['confirmee', 'annulee'], confirmee: ['en_preparation', 'annulee'],
      en_preparation: ['prete', 'annulee'], prete: ['en_livraison', 'livree', 'annulee'],
      en_livraison: ['livree', 'partiellement_livree', 'annulee'], partiellement_livree: ['livree'], livree: ['retournee'],
      annulee: [], retournee: [],
    };
    const permParStatut = {
      en_attente: ['commandes:write', 'ventes:write'], confirmee: ['commandes:write', 'ventes:write'], annulee: ['commandes:write', 'ventes:write'],
      en_preparation: ['commandes:preparer'], prete: ['commandes:preparer'], en_livraison: ['livraisons:write'], livree: ['livraisons:write'], retournee: ['commandes:write'],
    };
    const suivants = (TRANSITIONS[o.statut] || []).filter((s) => (permParStatut[s] || []).some(peut));
    const LABEL_ACTION = {
      en_attente: 'Soumettre', confirmee: 'Confirmer', en_preparation: 'Démarrer la préparation', prete: 'Marquer prête',
      en_livraison: 'Passer en livraison', livree: 'Marquer livrée', annulee: 'Annuler', retournee: 'Marquer retournée',
    };
    coquille(`Commande ${esc(o.numero)}`, `
      <div class="carte">
        <div class="ligne-champs">
          <div><b>Client</b><br>${esc(o.client.nom)}</div>
          <div><b>Statut</b><br>${badgeStatut(LABEL_STATUT_ORDER, o.statut)}</div>
          <div><b>Total</b><br>${fmt(o.total)} USD</div>
          <div><b>Paiement</b><br>${esc(o.moyenPaiement)}</div>
        </div>
        <div class="actions">${suivants.map((s) => `<button data-statut="${s}" class="${s === 'annulee' ? 'danger' : ''}">${LABEL_ACTION[s] || s}</button>`).join('')}
          ${o.statut === 'prete' && peut('livraisons:write') ? '<button id="btn-creer-livraison" class="bleu-btn">Créer la livraison</button>' : ''}
        </div>
      </div>
      <div class="carte">
        <h3>Lignes</h3>
        <table class="donnees"><thead><tr><th>Produit</th><th>Quantité</th><th>Prix unitaire</th><th>Montant</th></tr></thead><tbody>
          ${o.lignes.map((l) => `<tr><td>${esc(l.produitNom)}</td><td class="cellule-num">${l.quantite}</td><td class="cellule-num">${fmt(l.prixUnitaire)}</td><td class="cellule-num">${fmt(l.montant)}</td></tr>`).join('')}
        </tbody></table>
      </div>
      <div class="carte">
        <h3>Historique</h3>
        <ul class="chrono">${o.historique.map((h) => `<li><b>${(LABEL_STATUT_ORDER[h.statut] || [h.statut])[0]}</b> — ${fmtDate(h.ts)} — ${esc(h.par)}</li>`).join('')}</ul>
      </div>`, '/commandes');
    document.querySelectorAll('button[data-statut]').forEach((b) => {
      b.onclick = async () => {
        try { await api(`/customer-orders/${o.id}/statut`, { method: 'POST', body: { statut: b.dataset.statut } }); toast('Statut mis à jour'); naviguer(); }
        catch (err) { toast(err.message, true); }
      };
    });
    const btnLiv = document.getElementById('btn-creer-livraison');
    if (btnLiv) btnLiv.onclick = async () => {
      try { const d = await api('/deliveries', { method: 'POST', body: { orderId: o.id } }); toast('Livraison créée'); location.hash = '/livraisons/' + d.id; }
      catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Livraisons ==================================== */

route(/^\/livraisons$/, async () => {
  coquille('Livraisons', '<div class="chargement">Chargement…</div>', '/livraisons');
  try {
    const rows = await api('/deliveries');
    document.getElementById('corps').innerHTML = `
      <div class="carte">
        ${rows.length ? `<table class="donnees"><thead><tr><th>Commande</th><th>Client</th><th>Statut</th><th>Créée le</th></tr></thead><tbody>
          ${rows.map((d) => `<tr class="cliquable" onclick="location.hash='/livraisons/${d.id}'">
            <td><b>${esc(d.numeroCommande)}</b></td><td>${esc(d.clientNom)}</td><td>${badgeStatut(LABEL_STATUT_LIVRAISON, d.statut)}</td><td>${fmtDate(d.cree)}</td></tr>`).join('')}
        </tbody></table>` : '<div class="vide">Aucune livraison.</div>'}
      </div>`;
  } catch (e) { toast(e.message, true); }
});

route(/^\/livraisons\/([\w-]+)$/, async (m) => {
  coquille('Livraison', '<div class="chargement">Chargement…</div>', '/livraisons');
  try {
    const d = await api('/deliveries/' + m[1]);
    const TRANSITIONS = { a_livrer: ['en_route', 'echec'], en_route: ['livree', 'echec'], echec: ['en_route'], livree: [] };
    const suivants = TRANSITIONS[d.statut] || [];
    coquille(`Livraison — ${esc(d.numeroCommande)}`, `
      <div class="carte">
        <div class="ligne-champs">
          <div><b>Client</b><br>${esc(d.clientNom)}</div>
          <div><b>Téléphone</b><br>${esc(d.clientTelephone)}</div>
          <div><b>Adresse</b><br>${esc(d.adresse)}</div>
          <div><b>Statut</b><br>${badgeStatut(LABEL_STATUT_LIVRAISON, d.statut)}</div>
        </div>
        ${peut('livraisons:write') ? `<div class="actions">
          ${suivants.filter((s) => s !== 'livree').map((s) => `<button data-statut="${s}">${s === 'en_route' ? 'Démarrer la livraison' : 'Signaler un échec'}</button>`).join('')}
          ${suivants.includes('livree') ? '<button id="btn-livrer" class="bleu-btn">Confirmer la livraison</button>' : ''}
        </div>` : ''}
        ${d.preuve ? `<div class="note" style="margin-top:.6rem">Reçu par <b>${esc(d.preuve.nomReceptionnaire)}</b> le ${fmtDate(d.preuve.heure)}${d.preuve.commentaire ? ` — ${esc(d.preuve.commentaire)}` : ''}</div>` : ''}
      </div>
      <div class="carte">
        <h3>Historique</h3>
        <ul class="chrono">${d.historique.map((h) => `<li><b>${(LABEL_STATUT_LIVRAISON[h.statut] || [h.statut])[0]}</b> — ${fmtDate(h.ts)} — ${esc(h.par)}</li>`).join('')}</ul>
      </div>`, '/livraisons');
    document.querySelectorAll('button[data-statut]').forEach((b) => {
      b.onclick = async () => {
        try { await api(`/deliveries/${d.id}/statut`, { method: 'POST', body: { statut: b.dataset.statut } }); toast('Statut mis à jour'); naviguer(); }
        catch (err) { toast(err.message, true); }
      };
    });
    const btnLivrer = document.getElementById('btn-livrer');
    if (btnLivrer) btnLivrer.onclick = async () => {
      const nom = prompt('Nom du réceptionnaire :');
      if (!nom) return;
      try {
        await api(`/deliveries/${d.id}/statut`, { method: 'POST', body: { statut: 'livree', preuve: { nomReceptionnaire: nom } } });
        toast('Livraison confirmée');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Finances ====================================== */

route(/^\/finances$/, async () => {
  coquille('Finances', '<div class="chargement">Chargement…</div>', '/finances');
  try {
    const [creances, depenses] = await Promise.all([
      peut('creances:read') ? api('/creances') : [], peut('depenses:read') || peut('depenses:write') ? api('/expenses') : [],
    ]);
    document.getElementById('corps').innerHTML = `
      <div class="deux-colonnes">
        <div class="carte">
          <h3>Créances clients (§33)</h3>
          ${creances.length ? `<table class="donnees"><tbody>${creances.map((c) => `
            <tr class="cliquable" onclick="location.hash='/clients/${c.clientId}'"><td>${esc(c.nom)}</td><td class="cellule-num">${fmt(c.encours)} / ${fmt(c.plafondCredit)}</td></tr>`).join('')}</tbody></table>`
            : '<div class="vide">Aucune créance.</div>'}
        </div>
        <div class="carte">
          <h3>Dépenses</h3>
          ${depenses.length ? `<table class="donnees"><tbody>${depenses.map((d) => `<tr><td>${fmtDateSeule(d.ts)}</td><td>${esc(d.categorie)}</td><td class="cellule-num">${fmt(d.montant)}</td></tr>`).join('')}</tbody></table>`
            : '<div class="vide">Aucune dépense.</div>'}
          ${peut('depenses:write') ? `<form id="form-depense" style="margin-top:.8rem">
            <div class="ligne-champs">
              <label class="champ"><span>Catégorie</span><input name="categorie" required placeholder="loyer, transport…"></label>
              <label class="champ"><span>Montant (USD)</span><input name="montant" type="number" step="0.01" required></label>
              <label class="champ"><span>Motif</span><input name="motif"></label>
            </div>
            <button type="submit">Enregistrer une dépense</button>
          </form>` : ''}
        </div>
      </div>`;
    const fd = document.getElementById('form-depense');
    if (fd) fd.onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/expenses', { method: 'POST', body: Object.fromEntries(new FormData(fd)) }); toast('Dépense enregistrée'); naviguer(); }
      catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Administration ================================= */

route(/^\/admin$/, async () => {
  coquille('Administration', '<div class="chargement">Chargement…</div>', '/admin');
  try {
    const [users, roles] = await Promise.all([api('/users'), api('/roles')]);
    document.getElementById('corps').innerHTML = `
      <div class="carte">
        <h3>Utilisateurs</h3>
        <table class="donnees"><thead><tr><th>Login</th><th>Nom</th><th>Rôle</th><th>État</th><th></th></tr></thead><tbody>
          ${users.map((u) => `<tr><td><b>${esc(u.login)}</b></td><td>${esc(u.nom)}</td><td><span class="badge role">${esc(u.roleLabel)}</span></td>
          <td>${u.actif ? 'actif' : 'désactivé'}</td>
          <td>${u.id !== etat.user.id ? `<button class="secondaire" data-toggle="${u.id}" data-actif="${u.actif}">${u.actif ? 'Désactiver' : 'Réactiver'}</button>` : ''}</td></tr>`).join('')}
        </tbody></table>
        <form id="form-user" style="margin-top:1rem">
          <div class="ligne-champs">
            <label class="champ"><span>Login *</span><input name="login" required></label>
            <label class="champ"><span>Nom complet *</span><input name="nom" required></label>
            <label class="champ"><span>Mot de passe *</span><input name="password" type="password" required minlength="8"></label>
            <label class="champ"><span>Rôle *</span><select name="role">${roles.map((r) => `<option value="${r.value}">${esc(r.label)}</option>`).join('')}</select></label>
          </div>
          <button type="submit">Créer l'utilisateur</button>
        </form>
      </div>`;
    document.getElementById('form-user').onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/users', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) }); toast('Utilisateur créé'); naviguer(); }
      catch (err) { toast(err.message, true); }
    };
    document.querySelectorAll('[data-toggle]').forEach((b) => {
      b.onclick = async () => {
        try { await api('/users/' + b.dataset.toggle, { method: 'PUT', body: { actif: b.dataset.actif !== 'true' } }); toast('Utilisateur mis à jour'); naviguer(); }
        catch (err) { toast(err.message, true); }
      };
    });
  } catch (e) { toast(e.message, true); }
});

/* ============================ Audit ==================================== */

route(/^\/audit$/, async () => {
  coquille("Journal d'audit", `
    <div class="carte">
      <input class="recherche" id="recherche-audit" placeholder="Filtrer (action, utilisateur, détail)…">
      <p class="note" style="margin-bottom:0">Journal en ajout seul : aucune entrée ne peut être modifiée ni supprimée (§92 règle 7).</p>
    </div>
    <div class="carte" id="liste-audit"><div class="chargement">Chargement…</div></div>`, '/audit');
  const rendre = async (q = '') => {
    const rows = await api('/audit' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.getElementById('liste-audit').innerHTML = rows.length ? `
      <table class="donnees"><thead><tr><th>Horodatage</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détails</th></tr></thead><tbody>
        ${rows.map((a) => `<tr><td>${fmtDate(a.ts)}</td><td>${esc(a.userNom)}</td><td><span class="badge role">${esc(a.action)}</span></td><td>${esc(a.entite)}</td><td class="note">${esc(a.details)}</td></tr>`).join('')}
      </tbody></table>` : '<div class="vide">Journal vide.</div>';
  };
  let minuterie;
  document.getElementById('recherche-audit').oninput = (e) => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => rendre(e.target.value).catch((err) => toast(err.message, true)), 250);
  };
  rendre().catch((e) => toast(e.message, true));
});

/* ============================ Démarrage ================================ */

naviguer();
