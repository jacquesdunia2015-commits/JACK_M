/* NuméroGo — application cliente (Phase 1 MVP)
   SPA vanilla JS : aucun framework, aucune dépendance. */

'use strict';

/* ============================ État global ================================ */

const etat = {
  token: localStorage.getItem('numerogo_token') || null,
  user: JSON.parse(localStorage.getItem('numerogo_user') || 'null'),
  pays: [],
  stream: null,
};

const $app = document.getElementById('app');

/* ============================ Utilitaires ================================= */

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
    headers: { 'Content-Type': 'application/json', ...(etat.token ? { Authorization: 'Bearer ' + etat.token } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) deconnecter(false);
    throw new Error(data.erreur || `Erreur ${res.status}`);
  }
  return data;
}

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—');

function fmtRestant(iso) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'expiré';
  const h = Math.floor(ms / 3600000), min = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} h ${min} min restantes` : `${min} min restantes`;
}

const STATUT_LABEL = { available: 'Disponible', reserved: 'Réservé', active: 'Actif', expired: 'Expiré', released: 'Libéré' };

function connecte() { return !!(etat.token && etat.user); }
function estAdmin() { return connecte() && etat.user.role === 'admin'; }

function sauverSession(token, user) {
  etat.token = token; etat.user = user;
  localStorage.setItem('numerogo_token', token);
  localStorage.setItem('numerogo_user', JSON.stringify(user));
  ouvrirFlux();
}

function deconnecter(appel = true) {
  if (appel && etat.token) api('/auth/logout', { method: 'POST' }).catch(() => {});
  etat.token = null; etat.user = null;
  localStorage.removeItem('numerogo_token'); localStorage.removeItem('numerogo_user');
  fermerFlux();
  location.hash = '#/';
  naviguer();
}

/* ============================ Flux temps réel (SSE) ======================= */

function ouvrirFlux() {
  fermerFlux();
  if (!etat.token) return;
  const src = new EventSource(`/api/stream?token=${encodeURIComponent(etat.token)}`);
  src.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    toast(`📩 Nouveau SMS de « ${msg.from} »`);
    document.dispatchEvent(new CustomEvent('numerogo:sms', { detail: msg }));
  });
  src.addEventListener('number-expired', () => document.dispatchEvent(new CustomEvent('numerogo:refresh-numbers')));
  etat.stream = src;
}
function fermerFlux() { if (etat.stream) { etat.stream.close(); etat.stream = null; } }

/* ============================ Routage ====================================== */

const routes = [];
function route(pattern, vue) { routes.push({ pattern, vue }); }

async function naviguer() {
  const hash = location.hash.slice(1) || '/';
  const estZoneProtegee = hash.startsWith('/app') || hash.startsWith('/admin');
  if (estZoneProtegee && !connecte()) { location.hash = '#/connexion'; return; }
  if (hash.startsWith('/admin') && !estAdmin()) { location.hash = '#/app'; return; }
  rendreCoquille();
  const $contenu = document.getElementById('contenu');
  for (const r of routes) {
    const m = hash.match(r.pattern);
    if (m) { try { await r.vue($contenu, m); } catch (e) { $contenu.innerHTML = `<div class="carte"><p class="erreur-texte">${esc(e.message)}</p></div>`; } return; }
  }
  $contenu.innerHTML = '<div class="carte">Page introuvable.</div>';
}
window.addEventListener('hashchange', naviguer);

/* ============================ Coquille ====================================== */

function rendreCoquille() {
  const hash = location.hash.slice(1) || '/';
  const lien = (h, label) => `<a href="#${h}" class="${hash === h ? 'actif' : ''}">${label}</a>`;
  $app.innerHTML = `
    <div class="topbar">
      <a href="#/" class="marque"><span class="puce">📞</span> NuméroGo</a>
      <div class="nav-liens">
        ${connecte() ? lien('/app', 'Tableau de bord') + lien('/app/numeros', 'Mes numéros') + lien('/app/api', 'API &amp; Webhooks') + (estAdmin() ? lien('/admin', 'Administration') : '') : lien('/', 'Accueil')}
      </div>
      ${connecte()
        ? `<span class="solde-pill">💰 ${etat.user.walletUsd.toFixed(2)} $</span><button class="secondaire petit" id="btn-deco">Déconnexion</button>`
        : `<a href="#/connexion"><button class="secondaire petit">Se connecter</button></a><a href="#/inscription"><button class="petit">Créer un compte</button></a>`}
    </div>
    <main id="contenu"></main>
  `;
  document.getElementById('btn-deco')?.addEventListener('click', () => deconnecter());
}

/* ============================ Vue : Accueil ================================= */

route(/^\/$/, async ($c) => {
  if (connecte()) { location.hash = '#/app'; return; }
  const { countries } = await api('/countries');
  etat.pays = countries;
  $c.innerHTML = `
    <div class="hero">
      <h1>Un numéro de téléphone, partout, en quelques secondes.</h1>
      <p>Louez un numéro temporaire dans plus de ${countries.length} pays, recevez vos SMS et codes de vérification en temps réel, payez à l'usage depuis un wallet prépayé. API complète incluse.</p>
      <div class="actions">
        <a href="#/inscription"><button>Créer un compte gratuit</button></a>
        <a href="#/app/api"><button class="secondaire">Découvrir l'API</button></a>
      </div>
    </div>
    <div class="section-titre">Tarifs par pays</div>
    <div class="grille cartes">
      ${countries.map((c) => `
        <div class="carte compact pays-carte">
          <div>
            <div class="nom">${esc(c.name)}</div>
            <div class="sub">${esc(c.dial)} · ${c.availableCount} disponibles</div>
          </div>
          <div style="text-align:right">
            <div class="prix">${c.priceEntry.local.toFixed(2)} ${esc(c.currency)}</div>
            <div class="sub">≈ ${c.priceEntry.usd.toFixed(2)} USD</div>
          </div>
        </div>`).join('')}
    </div>
  `;
});

/* ============================ Vues : auth ==================================== */

function formulaireAuth(titre, sousTitre, submitLabel, onSubmit, lienBas) {
  return `
    <div class="formulaire-centre carte">
      <h2>${titre}</h2>
      <p class="muted">${sousTitre}</p>
      <form id="form-auth">
        <div class="champ"><label>E-mail</label><input type="email" name="email" required autocomplete="email"></div>
        <div class="champ"><label>Mot de passe</label><input type="password" name="password" required minlength="6" autocomplete="current-password"></div>
        <p class="erreur-texte" id="erreur-auth" hidden></p>
        <button type="submit" style="width:100%">${submitLabel}</button>
      </form>
      <p class="muted" style="margin-top:14px">${lienBas}</p>
    </div>
  `;
}

route(/^\/inscription$/, async ($c) => {
  $c.innerHTML = formulaireAuth('Créer un compte', 'Un crédit d’essai de 2 $ est offert à l’inscription.', 'Créer mon compte',
    null, 'Déjà inscrit ? <a href="#/connexion">Se connecter</a>');
  brancherFormAuth('/auth/register');
});

route(/^\/connexion$/, async ($c) => {
  $c.innerHTML = formulaireAuth('Se connecter', 'Compte de démonstration : demo@numerogo.dev / demo1234', 'Se connecter',
    null, 'Pas encore de compte ? <a href="#/inscription">Créer un compte</a>');
  brancherFormAuth('/auth/login');
});

function brancherFormAuth(chemin) {
  const form = document.getElementById('form-auth');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const $err = document.getElementById('erreur-auth');
    $err.hidden = true;
    const fd = new FormData(form);
    try {
      const data = await api(chemin, { method: 'POST', body: { email: fd.get('email'), password: fd.get('password') } });
      sauverSession(data.token, data.user);
      toast(`Bienvenue, ${data.user.email} !`);
      location.hash = '#/app';
    } catch (e) { $err.textContent = e.message; $err.hidden = false; }
  });
}

/* ============================ Vue : Tableau de bord =========================== */

route(/^\/app$/, async ($c) => {
  const [{ countries }, { numbers }, { transactions }] = await Promise.all([
    api('/countries'), api('/numbers'), api('/billing/transactions'),
  ]);
  etat.pays = countries;
  const actifs = numbers.filter((n) => ['active', 'reserved'].includes(n.status));

  $c.innerHTML = `
    <div class="grille deux">
      <div class="carte">
        <h2>💰 Wallet</h2>
        <p style="font-size:32px;font-weight:800;margin:4px 0">${etat.user.walletUsd.toFixed(2)} $</p>
        <div class="champ"><label>Recharger (USD)</label>
          <div style="display:flex;gap:8px">
            <input type="number" id="montant-recharge" min="1" max="500" step="0.5" value="10">
            <button id="btn-recharge">Recharger</button>
          </div>
        </div>
        <div style="display:flex;gap:6px">
          ${[5, 10, 25].map((v) => `<button class="secondaire petit" data-montant="${v}">+${v}$</button>`).join('')}
        </div>
      </div>
      <div class="carte">
        <h2>📱 Louer un numéro</h2>
        <div class="champ"><label>Pays</label>
          <select id="select-pays">${countries.map((c) => `<option value="${c.code}">${esc(c.name)} — ${c.priceEntry.local.toFixed(2)} ${esc(c.currency)} (≈${c.priceEntry.usd.toFixed(2)}$)</option>`).join('')}</select>
        </div>
        <button id="btn-louer" style="width:100%">Réserver et activer maintenant</button>
        <p class="muted" style="margin-top:8px">Débité automatiquement de votre wallet dès l'activation. Numéro valable ${esc(countries[0]?.durationHours || 24)} h, renouvelable.</p>
      </div>
    </div>

    <div class="section-titre">Numéros actifs (${actifs.length})</div>
    <div id="zone-numeros" class="grille cartes"></div>

    <div class="section-titre">Historique du wallet</div>
    <div class="carte table-scroll">
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Détail</th><th>Montant</th><th>Solde</th></tr></thead>
        <tbody>
          ${transactions.length ? transactions.map((t) => `
            <tr><td>${fmtDate(t.createdAt)}</td><td>${esc(t.type)}</td><td>${esc(t.description)}</td>
              <td style="color:${t.amountUsd >= 0 ? 'var(--ok)' : 'var(--err)'}">${t.amountUsd >= 0 ? '+' : ''}${t.amountUsd.toFixed(2)} $</td>
              <td>${t.balanceAfter.toFixed(2)} $</td></tr>`).join('') : '<tr><td colspan="5" class="vide">Aucune transaction</td></tr>'}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-recharge').addEventListener('click', () => recharger(Number(document.getElementById('montant-recharge').value)));
  document.querySelectorAll('[data-montant]').forEach((b) => b.addEventListener('click', () => recharger(Number(b.dataset.montant))));
  document.getElementById('btn-louer').addEventListener('click', louerNumero);

  await rafraichirNumeros();
  document.addEventListener('numerogo:refresh-numbers', rafraichirNumeros);
  document.addEventListener('numerogo:sms', rafraichirNumeros);
});

async function recharger(montant) {
  if (!montant || montant < 1) return toast('Montant invalide', true);
  try {
    const data = await api('/billing/recharge', { method: 'POST', body: { amountUsd: montant, method: 'démo' } });
    etat.user.walletUsd = data.walletUsd;
    localStorage.setItem('numerogo_user', JSON.stringify(etat.user));
    toast(`Wallet rechargé de ${montant.toFixed(2)} $`);
    naviguer();
  } catch (e) { toast(e.message, true); }
}

async function louerNumero() {
  const code = document.getElementById('select-pays').value;
  const $btn = document.getElementById('btn-louer');
  $btn.disabled = true;
  try {
    const { number } = await api('/numbers/reserve', { method: 'POST', body: { country: code } });
    const act = await api(`/numbers/${number.id}/activate`, { method: 'POST' });
    etat.user.walletUsd = act.wallet;
    localStorage.setItem('numerogo_user', JSON.stringify(etat.user));
    toast(`Numéro ${act.number.phoneNumber} activé ! Un SMS de test arrivera sous peu.`);
    naviguer(); // reconstruit la coquille (solde à jour) et la liste des numéros
  } catch (e) { toast(e.message, true); }
  finally { $btn.disabled = false; }
}

async function rafraichirNumeros() {
  const zone = document.getElementById('zone-numeros');
  if (!zone) return;
  const { numbers } = await api('/numbers');
  const actifs = numbers.filter((n) => ['active', 'reserved', 'expired'].includes(n.status));
  zone.innerHTML = actifs.length ? actifs.map((n) => carteNumero(n)).join('') : '<p class="vide">Aucun numéro pour l’instant — réservez-en un ci-dessus.</p>';
  actifs.forEach((n) => brancherCarteNumero(n));
}

function carteNumero(n) {
  const c = (etat.pays.find((p) => p.code === n.countryCode)) || {};
  return `
    <div class="carte numero-carte" data-id="${n.id}">
      <div class="flex-entre"><span class="badge ${n.status}">${STATUT_LABEL[n.status] || n.status}</span><span class="muted">${esc(c.name || n.countryCode)}</span></div>
      <div class="tel">${esc(n.phoneNumber)}</div>
      <div class="expire">${n.status === 'active' ? fmtRestant(n.expiresAt) : n.status === 'reserved' ? 'à activer' : ''} · ${n.messageCount} message(s)</div>
      <div class="actions">
        ${n.status === 'active' || n.status === 'expired' ? `<button class="secondaire petit" data-renew="${n.id}">Renouveler</button>` : ''}
        <button class="secondaire petit" data-release="${n.id}">Libérer</button>
        <button class="secondaire petit" data-thread="${n.id}">💬 Messages</button>
      </div>
      <div class="messages" id="fil-${n.id}" hidden></div>
    </div>
  `;
}

function brancherCarteNumero(n) {
  const carte = document.querySelector(`.numero-carte[data-id="${n.id}"]`);
  if (!carte) return;
  carte.querySelector('[data-renew]')?.addEventListener('click', () => agirSurNumero(n.id, 'renew'));
  carte.querySelector('[data-release]')?.addEventListener('click', () => { if (confirm('Libérer ce numéro ?')) agirSurNumero(n.id, 'release'); });
  carte.querySelector('[data-thread]')?.addEventListener('click', () => basculerFil(n.id));
}

async function agirSurNumero(id, action) {
  try {
    const data = await api(`/numbers/${id}/${action}`, { method: 'POST' });
    if (data.wallet != null) { etat.user.walletUsd = data.wallet; localStorage.setItem('numerogo_user', JSON.stringify(etat.user)); }
    toast(action === 'renew' ? 'Numéro renouvelé' : 'Numéro libéré');
    naviguer();
  } catch (e) { toast(e.message, true); }
}

async function basculerFil(numberId) {
  const $fil = document.getElementById(`fil-${numberId}`);
  if (!$fil) return;
  if (!$fil.hidden) { $fil.hidden = true; return; }
  $fil.hidden = false;
  $fil.innerHTML = '<p class="vide">Chargement…</p>';
  const { messages } = await api(`/messages?numberId=${numberId}`);
  $fil.innerHTML = messages.length
    ? messages.map((m) => `<div class="message"><span class="quand">${fmtDate(m.receivedAt)}</span><div class="from">${esc(m.from)}</div><div class="texte">${esc(m.text)}</div></div>`).join('')
    : '<p class="vide">Aucun SMS reçu pour l’instant.</p>';
}

/* ============================ Vue : Mes numéros (historique complet) ========== */

route(/^\/app\/numeros$/, async ($c) => {
  const { numbers } = await api('/numbers');
  const { countries } = await api('/countries'); etat.pays = countries;
  $c.innerHTML = `
    <h2>Mes numéros</h2>
    <div class="carte table-scroll">
      <table>
        <thead><tr><th>Numéro</th><th>Pays</th><th>Statut</th><th>Activé</th><th>Expire</th><th>Renouvellements</th><th>Messages</th></tr></thead>
        <tbody>
          ${numbers.length ? numbers.map((n) => `
            <tr><td class="mono">${esc(n.phoneNumber)}</td><td>${esc((etat.pays.find((p) => p.code === n.countryCode) || {}).name || n.countryCode)}</td>
              <td><span class="badge ${n.status}">${STATUT_LABEL[n.status] || n.status}</span></td>
              <td>${fmtDate(n.activatedAt)}</td><td>${fmtDate(n.expiresAt)}</td><td>${n.renewals}</td><td>${n.messageCount}</td></tr>`).join('')
            : '<tr><td colspan="7" class="vide">Aucun numéro loué pour l’instant.</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
});

/* ============================ Vue : API & Webhooks ============================ */

route(/^\/app\/api$/, async ($c) => {
  const { webhooks } = await api('/webhooks');
  $c.innerHTML = `
    <h2>🔑 Clé API</h2>
    <div class="carte">
      <p class="muted">Utilisez votre clé dans l'en-tête <code class="ep">X-Api-Key</code> pour appeler l'API sans session navigateur.</p>
      <p>${etat.user.hasApiKey ? '✅ Une clé API existe déjà pour ce compte.' : 'Aucune clé API générée pour l’instant.'}</p>
      <button id="btn-cle">${etat.user.hasApiKey ? 'Régénérer la clé' : 'Générer une clé API'}</button>
      <p id="cle-affichee" class="mono" hidden></p>
    </div>

    <div class="section-titre">Webhooks</div>
    <div class="carte">
      <p class="muted">Recevez chaque SMS entrant (<code class="ep">message.received</code>) sur votre propre serveur, signé HMAC-SHA256 dans l'en-tête <code class="ep">X-Signature</code>.</p>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input id="webhook-url" placeholder="https://mon-serveur.example.com/webhooks/numerogo">
        <button id="btn-webhook">Ajouter</button>
      </div>
      <table>
        <thead><tr><th>URL</th><th>Créé</th><th></th></tr></thead>
        <tbody id="liste-webhooks">
          ${webhooks.length ? webhooks.map((w) => `<tr><td class="mono">${esc(w.url)}</td><td>${fmtDate(w.createdAt)}</td><td><button class="secondaire petit" data-suppr="${w.id}">Retirer</button></td></tr>`).join('')
            : '<tr><td colspan="3" class="vide">Aucun webhook enregistré.</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="section-titre">Référence rapide</div>
    <div class="carte">
      <pre class="bloc">curl -H "X-Api-Key: VOTRE_CLE" https://votre-domaine/api/countries
curl -X POST -H "X-Api-Key: VOTRE_CLE" -H "Content-Type: application/json" \\
     -d '{"country":"CD"}' https://votre-domaine/api/numbers/reserve</pre>
      <table>
        <tbody>
          <tr><td class="mono">GET /api/countries</td><td>Liste des pays et tarifs</td></tr>
          <tr><td class="mono">GET /api/numbers/available?country=XX</td><td>Disponibilité par pays</td></tr>
          <tr><td class="mono">POST /api/numbers/reserve</td><td>Réserver un numéro</td></tr>
          <tr><td class="mono">POST /api/numbers/:id/activate</td><td>Activer (débite le wallet)</td></tr>
          <tr><td class="mono">POST /api/numbers/:id/renew</td><td>Renouveler</td></tr>
          <tr><td class="mono">DELETE /api/numbers/:id</td><td>Libérer</td></tr>
          <tr><td class="mono">GET /api/messages?numberId=…</td><td>SMS reçus</td></tr>
          <tr><td class="mono">POST /api/webhooks/register</td><td>Enregistrer un webhook</td></tr>
          <tr><td class="mono">GET /api/billing/balance</td><td>Solde du wallet</td></tr>
          <tr><td class="mono">POST /api/billing/recharge</td><td>Recharger le wallet</td></tr>
          <tr><td class="mono">GET /api/pricing?country=XX</td><td>Tarification détaillée</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.getElementById('btn-cle').addEventListener('click', async () => {
    try {
      const data = await api('/auth/api-key', { method: 'POST' });
      etat.user.hasApiKey = true; localStorage.setItem('numerogo_user', JSON.stringify(etat.user));
      const $p = document.getElementById('cle-affichee');
      $p.hidden = false; $p.textContent = `⚠️ Copiez-la maintenant, elle ne sera plus affichée : ${data.apiKey}`;
    } catch (e) { toast(e.message, true); }
  });

  document.getElementById('btn-webhook').addEventListener('click', async () => {
    const url = document.getElementById('webhook-url').value.trim();
    try { await api('/webhooks/register', { method: 'POST', body: { url } }); toast('Webhook ajouté'); naviguer(); }
    catch (e) { toast(e.message, true); }
  });

  document.querySelectorAll('[data-suppr]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/webhooks/${b.dataset.suppr}`, { method: 'DELETE' }); toast('Webhook retiré'); naviguer(); }
    catch (e) { toast(e.message, true); }
  }));
});

/* ============================ Vue : Administration ============================= */

route(/^\/admin$/, async ($c) => {
  const [overview, { countries }, { users }] = await Promise.all([api('/admin/overview'), api('/admin/countries'), api('/admin/users')]);
  $c.innerHTML = `
    <h2>📊 Administration <span class="badge admin">admin</span></h2>
    <div class="grille cartes">
      <div class="carte compact"><div class="muted">Utilisateurs</div><div style="font-size:26px;font-weight:800">${overview.users}</div></div>
      <div class="carte compact"><div class="muted">Numéros actifs</div><div style="font-size:26px;font-weight:800">${overview.activeNumbers}</div></div>
      <div class="carte compact"><div class="muted">Réservés</div><div style="font-size:26px;font-weight:800">${overview.reservedNumbers}</div></div>
      <div class="carte compact"><div class="muted">Revenu total</div><div style="font-size:26px;font-weight:800">${overview.revenueUsd.toFixed(2)} $</div></div>
      <div class="carte compact"><div class="muted">SMS (24 h)</div><div style="font-size:26px;font-weight:800">${overview.messagesLast24h}</div></div>
    </div>

    <div class="section-titre">Pays et tarification</div>
    <div class="carte table-scroll">
      <table>
        <thead><tr><th>Pays</th><th>Devise</th><th>Taux/USD</th><th>Entrée (USD)</th><th>Renouv. (USD)</th><th>Durée (h)</th><th>Actif</th><th></th></tr></thead>
        <tbody>
          ${countries.map((c) => `
            <tr data-code="${c.code}">
              <td>${esc(c.name)} (${c.code})</td><td>${esc(c.currency)}</td>
              <td><input type="number" step="0.01" value="${c.rate}" data-f="rate" style="width:90px"></td>
              <td><input type="number" step="0.01" value="${c.priceEntryUsd}" data-f="priceEntryUsd" style="width:80px"></td>
              <td><input type="number" step="0.01" value="${c.priceRenewUsd}" data-f="priceRenewUsd" style="width:80px"></td>
              <td><input type="number" step="1" value="${c.durationHours}" data-f="durationHours" style="width:70px"></td>
              <td><input type="checkbox" data-f="active" ${c.active ? 'checked' : ''}></td>
              <td><button class="secondaire petit" data-save="${c.code}">Enregistrer</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>

    <div class="section-titre">Utilisateurs</div>
    <div class="carte table-scroll">
      <table>
        <thead><tr><th>E-mail</th><th>Rôle</th><th>Wallet</th><th>Inscrit</th><th>Statut</th><th></th></tr></thead>
        <tbody>
          ${users.map((u) => `
            <tr><td>${esc(u.email)}</td><td>${esc(u.role)}</td><td>${u.walletUsd.toFixed(2)} $</td><td>${fmtDate(u.createdAt)}</td>
              <td>${u.suspended ? '<span class="badge expired">Suspendu</span>' : '<span class="badge active">Actif</span>'}</td>
              <td>${u.role === 'admin' ? '' : `<button class="secondaire petit" data-toggle="${u.id}" data-cur="${u.suspended}">${u.suspended ? 'Réactiver' : 'Suspendre'}</button>`}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  document.querySelectorAll('[data-save]').forEach((btn) => btn.addEventListener('click', async () => {
    const tr = btn.closest('tr');
    const body = {};
    tr.querySelectorAll('[data-f]').forEach((inp) => { body[inp.dataset.f] = inp.type === 'checkbox' ? inp.checked : Number(inp.value); });
    try { await api(`/admin/countries/${btn.dataset.save}`, { method: 'PATCH', body }); toast(`${btn.dataset.save} mis à jour`); }
    catch (e) { toast(e.message, true); }
  }));

  document.querySelectorAll('[data-toggle]').forEach((btn) => btn.addEventListener('click', async () => {
    try { await api(`/admin/users/${btn.dataset.toggle}`, { method: 'PATCH', body: { suspended: btn.dataset.cur !== 'true' } }); toast('Statut mis à jour'); naviguer(); }
    catch (e) { toast(e.message, true); }
  }));
});

/* ============================ Démarrage ======================================= */

if (connecte()) ouvrirFlux();
naviguer();
