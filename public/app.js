/* MediLab SaaS — application cliente (Phase 1 MVP)
   SPA vanilla JS : aucun framework, aucune dépendance. */

'use strict';

/* ============================ État global ============================== */

const etat = {
  token: sessionStorage.getItem('medilab_token') || null,
  user: JSON.parse(sessionStorage.getItem('medilab_user') || 'null'),
  etablissement: null,
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
  setTimeout(() => el.remove(), 4200);
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

const fmtDate = (iso) => iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

const STATUT_LABEL = {
  demandee: 'Demandée', prelevee: 'Prélevée', recue: 'Reçue au labo',
  en_analyse: 'En analyse', saisie: 'Résultats saisis', validee: 'Validée', publiee: 'Publiée',
};
const FLAG_LABEL = { normal: 'Normal', bas: 'Bas', haut: 'Élevé', critique: 'CRITIQUE', anormal: 'Anormal' };

function peut(perm) {
  const PERMS = {
    admin_systeme: ['*'],
    admin_etablissement: ['users:manage', 'tests:manage', 'patients:read', 'consultations:read', 'demandes:read', 'resultats:read', 'audit:read'],
    medecin: ['patients:read', 'patients:write', 'consultations:read', 'consultations:write', 'demandes:read', 'demandes:create', 'resultats:read'],
    infirmier: ['patients:read', 'consultations:read', 'demandes:read', 'demandes:prelever'],
    receptionniste: ['patients:read', 'patients:write'],
    laborantin: ['patients:read', 'demandes:read', 'demandes:traiter', 'resultats:write'],
    biologiste: ['patients:read', 'demandes:read', 'demandes:traiter', 'resultats:write', 'resultats:valider', 'resultats:read'],
    qualite: ['patients:read', 'demandes:read', 'resultats:read', 'audit:read'],
  };
  const p = PERMS[etat.user?.role] || [];
  return p.includes('*') || p.includes(perm);
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
    ['/patients', 'Patients', peut('patients:read')],
    ['/labo', 'Laboratoire', peut('demandes:read')],
    ['/admin', 'Administration', peut('users:manage') || peut('tests:manage')],
    ['/audit', "Journal d'audit", peut('audit:read')],
  ].filter((l) => l[2]);
  $app.innerHTML = `
  <div class="coquille">
    <aside class="barre-laterale">
      <div class="logo">Medi<span>Lab</span> SaaS</div>
      <div class="etab-nom">${esc(etat.etablissement ? etat.etablissement.nom : 'Plateforme — tous établissements')}</div>
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
  etat.token = null; etat.user = null; etat.etablissement = null;
  sessionStorage.removeItem('medilab_token');
  sessionStorage.removeItem('medilab_user');
  vueLogin();
}

/* ============================ Connexion ================================ */

function vueLogin() {
  $app.innerHTML = `
  <div class="ecran-login">
    <form class="boite-login" id="form-login">
      <h1>MediLab SaaS</h1>
      <p class="sous-titre">Gestion des dossiers médicaux et des résultats de laboratoire</p>
      <label class="champ"><span>Identifiant</span><input name="login" autocomplete="username" required autofocus></label>
      <label class="champ"><span>Mot de passe</span><input name="password" type="password" autocomplete="current-password" required></label>
      <button type="submit" style="width:100%">Se connecter</button>
      <div class="demo-comptes">
        <b>Comptes de démonstration</b> (mot de passe <code>demo1234</code>) :
        <code>dr.mukendi</code> médecin · <code>lab.kanya</code> laborantin ·
        <code>bio.ilunga</code> biologiste · <code>accueil</code> réception ·
        <code>qualite</code> qualité · <code>admin.horizon</code> admin établissement.
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
      sessionStorage.setItem('medilab_token', r.token);
      sessionStorage.setItem('medilab_user', JSON.stringify(r.user));
      const me = await api('/me');
      etat.etablissement = me.etablissement;
      location.hash = '/tableau';
      naviguer();
    } catch (err) { toast(err.message, true); }
  };
}

/* ============================ Tableau de bord ========================== */

route(/^\/tableau$/, async () => {
  coquille('Tableau de bord', '<div class="chargement">Chargement…</div>', '/tableau');
  try {
    if (!etat.etablissement && etat.user.etablissementId) {
      const me = await api('/me'); etat.etablissement = me.etablissement;
    }
    const d = await api('/dashboard');
    document.getElementById('corps').innerHTML = `
      <div class="grille-stats">
        <div class="stat"><div class="valeur">${d.patientsActifs}</div><div class="libelle">Patients actifs</div></div>
        <div class="stat"><div class="valeur">${d.demandes30j}</div><div class="libelle">Demandes (30 jours)</div></div>
        <div class="stat"><div class="valeur">${d.demandesEnAttente}</div><div class="libelle">Demandes en attente</div></div>
        <div class="stat"><div class="valeur">${d.delaiMoyenHeures != null ? d.delaiMoyenHeures.toFixed(1) + ' h' : '—'}</div><div class="libelle">Délai moyen de rendu</div></div>
      </div>
      <div class="deux-colonnes">
        <div class="carte">
          <h3>Demandes par statut</h3>
          <table class="donnees"><tbody>
            ${d.parStatut.map((s) => `<tr><td><span class="badge ${s.statut}">${STATUT_LABEL[s.statut]}</span></td><td style="text-align:right"><b>${s.n}</b></td></tr>`).join('')}
          </tbody></table>
        </div>
        <div class="carte">
          <h3>Résultats critiques récents</h3>
          ${d.resultatsCritiques.length
            ? `<table class="donnees"><tbody>${d.resultatsCritiques.map((c) => `<tr><td>${esc(c.demande)}</td><td class="flag critique">${esc(c.test)}</td></tr>`).join('')}</tbody></table>`
            : '<div class="vide">Aucun résultat critique.</div>'}
        </div>
      </div>`;
  } catch (e) { toast(e.message, true); }
});

/* ============================ Patients ================================= */

route(/^\/patients$/, async () => {
  coquille('Patients', '<div class="chargement">Chargement…</div>', '/patients');
  if (peut('patients:write')) {
    document.getElementById('entete-actions').innerHTML = '<a class="btn" href="#/patients/nouveau">+ Nouveau patient</a>';
  }
  const rendre = async (q = '') => {
    const rows = await api('/patients' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.getElementById('liste-patients').innerHTML = rows.length ? `
      <table class="donnees">
        <thead><tr><th>N° dossier</th><th>Nom</th><th>Sexe</th><th>Naissance</th><th>Téléphone</th></tr></thead>
        <tbody>${rows.map((p) => `
          <tr class="cliquable" onclick="location.hash='/patients/${p.id}'">
            <td><b>${esc(p.numero)}</b></td><td>${esc(p.nom.toUpperCase())} ${esc(p.prenom)}</td>
            <td>${p.sexe}</td><td>${esc(p.dateNaissance || '—')}</td><td>${esc(p.telephone || '—')}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<div class="vide">Aucun patient trouvé.</div>';
  };
  document.getElementById('corps').innerHTML = `
    <div class="carte">
      <input class="recherche" id="champ-recherche" placeholder="Rechercher (nom, n° dossier, téléphone)…">
    </div>
    <div class="carte" id="liste-patients"><div class="chargement">Chargement…</div></div>`;
  let minuterie;
  document.getElementById('champ-recherche').oninput = (e) => {
    clearTimeout(minuterie);
    minuterie = setTimeout(() => rendre(e.target.value).catch((err) => toast(err.message, true)), 250);
  };
  rendre().catch((e) => toast(e.message, true));
});

function formulairePatient(p = {}) {
  return `
  <div class="ligne-champs">
    <label class="champ"><span>Nom *</span><input name="nom" value="${esc(p.nom || '')}" required></label>
    <label class="champ"><span>Prénom *</span><input name="prenom" value="${esc(p.prenom || '')}" required></label>
    <label class="champ"><span>Sexe</span><select name="sexe">
      <option value="M" ${p.sexe === 'M' ? 'selected' : ''}>Masculin</option>
      <option value="F" ${p.sexe === 'F' ? 'selected' : ''}>Féminin</option></select></label>
    <label class="champ"><span>Date de naissance</span><input name="dateNaissance" type="date" value="${esc(p.dateNaissance || '')}"></label>
    <label class="champ"><span>Téléphone</span><input name="telephone" value="${esc(p.telephone || '')}"></label>
    <label class="champ"><span>Groupe sanguin</span><input name="groupeSanguin" value="${esc(p.groupeSanguin || '')}" placeholder="ex. O+"></label>
  </div>
  <label class="champ"><span>Adresse</span><input name="adresse" value="${esc(p.adresse || '')}"></label>
  <div class="ligne-champs">
    <label class="champ"><span>Antécédents</span><textarea name="antecedents">${esc(p.antecedents || '')}</textarea></label>
    <label class="champ"><span>Allergies</span><textarea name="allergies">${esc(p.allergies || '')}</textarea></label>
  </div>
  <label class="champ"><span>Contact d'urgence</span><input name="contactUrgence" value="${esc(p.contactUrgence || '')}" placeholder="Nom — téléphone"></label>`;
}

route(/^\/patients\/nouveau$/, async () => {
  coquille('Nouveau patient', `
    <form class="carte" id="form-patient">
      ${formulairePatient()}
      <div class="actions">
        <button type="submit">Créer le dossier</button>
        <a class="btn secondaire" href="#/patients" style="background:#e2e8f0;color:#1e293b">Annuler</a>
      </div>
    </form>`, '/patients');
  document.getElementById('form-patient').onsubmit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target));
    try {
      const p = await api('/patients', { method: 'POST', body });
      toast(`Dossier ${p.numero} créé`);
      location.hash = '/patients/' + p.id;
    } catch (err) { toast(err.message, true); }
  };
});

route(/^\/patients\/([\w-]+)$/, async (m) => {
  coquille('Dossier patient', '<div class="chargement">Chargement…</div>', '/patients');
  try {
    const { patient: p, consultations, demandes } = await api('/patients/' + m[1]);
    coquille(`${esc(p.nom.toUpperCase())} ${esc(p.prenom)} — ${esc(p.numero)}`, `
      <div class="deux-colonnes">
        <form class="carte" id="form-patient">
          <h3>Informations administratives et cliniques</h3>
          ${formulairePatient(p)}
          ${peut('patients:write') ? `<div class="actions">
            <button type="submit">Enregistrer</button>
            <button type="button" class="secondaire" id="btn-archiver">${p.archive ? 'Désarchiver' : 'Archiver le dossier'}</button>
          </div>` : ''}
        </form>
        <div>
          <div class="carte">
            <h3>Consultations</h3>
            ${peut('consultations:write') ? `<form id="form-consult">
              <label class="champ"><span>Motif</span><input name="motif" placeholder="Motif de consultation" required></label>
              <div class="ligne-champs">
                <label class="champ"><span>Symptômes</span><textarea name="symptomes"></textarea></label>
                <label class="champ"><span>Diagnostic</span><textarea name="diagnostic"></textarea></label>
              </div>
              <label class="champ"><span>Constantes</span><input name="constantes" placeholder="TA 12/8 · T° 37,2 · pouls 72"></label>
              <button type="submit">Ouvrir la consultation</button>
            </form><hr style="border:none;border-top:1px solid var(--bordure);margin:1rem 0">` : ''}
            ${consultations.length ? `<table class="donnees"><tbody>${consultations.map((c) => `
              <tr><td><b>${esc(c.numero)}</b><br><span class="note">${fmtDate(c.cree)} — ${esc(c.medecinNom)}</span></td>
              <td>${esc(c.motif || '')}<br><span class="note">${esc(c.diagnostic ? 'Diagnostic : ' + c.diagnostic : '')}</span></td></tr>`).join('')}</tbody></table>`
              : '<div class="vide">Aucune consultation.</div>'}
          </div>
          <div class="carte">
            <h3>Demandes de laboratoire</h3>
            ${peut('demandes:create') ? `<div class="actions" style="margin:0 0 .8rem"><a class="btn" href="#/labo/nouvelle/${p.id}">+ Prescrire des examens</a></div>` : ''}
            ${demandes.length ? `<table class="donnees"><tbody>${demandes.map((d) => `
              <tr class="cliquable" onclick="location.hash='/labo/${d.id}'">
                <td><b>${esc(d.numero)}</b><br><span class="note">${fmtDate(d.cree)}</span></td>
                <td>${d.lignes.map((l) => esc(l.code)).join(', ')}</td>
                <td><span class="badge ${d.statut}">${STATUT_LABEL[d.statut]}</span></td></tr>`).join('')}</tbody></table>`
              : '<div class="vide">Aucune demande.</div>'}
          </div>
        </div>
      </div>`, '/patients');
    const form = document.getElementById('form-patient');
    if (form && peut('patients:write')) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        try {
          await api('/patients/' + p.id, { method: 'PUT', body: Object.fromEntries(new FormData(form)) });
          toast('Dossier mis à jour');
        } catch (err) { toast(err.message, true); }
      };
      document.getElementById('btn-archiver').onclick = async () => {
        try {
          await api('/patients/' + p.id, { method: 'PUT', body: { archive: !p.archive } });
          toast(p.archive ? 'Dossier réactivé' : 'Dossier archivé');
          naviguer();
        } catch (err) { toast(err.message, true); }
      };
    }
    const fc = document.getElementById('form-consult');
    if (fc) fc.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/consultations', { method: 'POST', body: { patientId: p.id, ...Object.fromEntries(new FormData(fc)) } });
        toast('Consultation enregistrée');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Laboratoire ============================== */

route(/^\/labo$/, async () => {
  coquille('Laboratoire — demandes d’examens', '<div class="chargement">Chargement…</div>', '/labo');
  const filtres = ['', 'demandee', 'prelevee', 'recue', 'en_analyse', 'saisie', 'validee', 'publiee'];
  const rendre = async (statut = '') => {
    const rows = await api('/demandes' + (statut ? '?statut=' + statut : ''));
    document.getElementById('liste-demandes').innerHTML = rows.length ? `
      <table class="donnees">
        <thead><tr><th>N°</th><th>Patient</th><th>Examens</th><th>Priorité</th><th>Statut</th><th>Créée le</th></tr></thead>
        <tbody>${rows.map((d) => `
          <tr class="cliquable" onclick="location.hash='/labo/${d.id}'">
            <td><b>${esc(d.numero)}</b></td>
            <td>${esc(d.patientNom)}<br><span class="note">${esc(d.patientNumero)}</span></td>
            <td>${d.lignes.map((l) => esc(l.code)).join(', ')}</td>
            <td>${d.priorite === 'urgent' ? '<span class="badge urgent">URGENT</span>' : 'normale'}</td>
            <td><span class="badge ${d.statut}">${STATUT_LABEL[d.statut]}</span></td>
            <td>${fmtDate(d.cree)}</td>
          </tr>`).join('')}</tbody>
      </table>` : '<div class="vide">Aucune demande pour ce filtre.</div>';
  };
  document.getElementById('corps').innerHTML = `
    <div class="carte">
      <label class="champ" style="max-width:280px"><span>Filtrer par statut</span>
        <select id="filtre-statut">${filtres.map((f) => `<option value="${f}">${f ? STATUT_LABEL[f] : 'Toutes les demandes'}</option>`).join('')}</select>
      </label>
    </div>
    <div class="carte" id="liste-demandes"></div>`;
  document.getElementById('filtre-statut').onchange = (e) => rendre(e.target.value).catch((err) => toast(err.message, true));
  rendre().catch((e) => toast(e.message, true));
});

route(/^\/labo\/nouvelle\/([\w-]+)$/, async (m) => {
  coquille('Nouvelle demande d’examens', '<div class="chargement">Chargement…</div>', '/labo');
  try {
    const [{ patient: p, consultations }, tests] = await Promise.all([api('/patients/' + m[1]), api('/tests')]);
    const actifs = tests.filter((t) => t.actif);
    const categories = [...new Set(actifs.map((t) => t.categorie))];
    document.getElementById('corps').innerHTML = `
      <form class="carte" id="form-demande">
        <h3>Patient : ${esc(p.nom.toUpperCase())} ${esc(p.prenom)} (${esc(p.numero)})</h3>
        <div class="ligne-champs">
          <label class="champ"><span>Consultation associée</span>
            <select name="consultationId"><option value="">— aucune —</option>
              ${consultations.map((c) => `<option value="${c.id}">${esc(c.numero)} — ${esc(c.motif || '')}</option>`).join('')}
            </select></label>
          <label class="champ"><span>Priorité</span>
            <select name="priorite"><option value="normal">Normale</option><option value="urgent">Urgente</option></select></label>
        </div>
        <h3>Examens à prescrire</h3>
        ${categories.map((cat) => `
          <p style="margin:.6rem 0 .2rem"><b>${esc(cat)}</b></p>
          ${actifs.filter((t) => t.categorie === cat).map((t) => `
            <label style="display:inline-block;margin:.15rem 1rem .15rem 0;font-size:.9rem">
              <input type="checkbox" name="test" value="${t.id}" style="width:auto"> ${esc(t.nom)}
              ${t.type === 'quantitatif' && t.refMin != null ? `<span class="note">(${t.refMin}–${t.refMax} ${esc(t.unite)})</span>` : ''}
            </label>`).join('')}`).join('')}
        <div class="actions"><button type="submit">Créer la demande</button></div>
      </form>`;
    document.getElementById('form-demande').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const testIds = fd.getAll('test');
      if (!testIds.length) return toast('Sélectionnez au moins un examen', true);
      try {
        const d = await api('/demandes', {
          method: 'POST',
          body: { patientId: p.id, consultationId: fd.get('consultationId') || null, priorite: fd.get('priorite'), testIds },
        });
        toast(`Demande ${d.numero} créée`);
        location.hash = '/labo/' + d.id;
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

route(/^\/labo\/([\w-]+)$/, async (m) => {
  coquille('Demande de laboratoire', '<div class="chargement">Chargement…</div>', '/labo');
  try {
    const d = await api('/demandes/' + m[1]);
    const p = d.patient;
    const TRANSITIONS = {
      demandee: ['prelevee'], prelevee: ['recue'], recue: ['en_analyse'],
      en_analyse: ['saisie'], saisie: ['validee'], validee: ['publiee'], publiee: [],
    };
    const PERM_STATUT = {
      prelevee: ['demandes:prelever', 'demandes:traiter'], recue: ['demandes:traiter'],
      en_analyse: ['demandes:traiter'], saisie: ['resultats:write'],
      validee: ['resultats:valider'], publiee: ['resultats:valider'],
    };
    const suivants = TRANSITIONS[d.statut].filter((s) => (PERM_STATUT[s] || []).some(peut));
    const BOUTON_STATUT = {
      prelevee: 'Marquer prélevé', recue: 'Réception au laboratoire', en_analyse: 'Démarrer l’analyse',
      saisie: 'Soumettre les résultats', validee: 'Valider et signer', publiee: 'Publier au dossier patient',
    };
    const saisieOuverte = ['en_analyse', 'saisie'].includes(d.statut) && peut('resultats:write');
    const correctionOuverte = ['validee', 'publiee'].includes(d.statut) && peut('resultats:valider');
    const editable = saisieOuverte || correctionOuverte;
    const pdfDispo = ['validee', 'publiee'].includes(d.statut);

    coquille(`Demande ${esc(d.numero)}`, `
      <div class="carte">
        <div class="ligne-champs">
          <div><b>Patient</b><br>${esc(p.nom.toUpperCase())} ${esc(p.prenom)}<br><span class="note">${esc(p.numero)}</span></div>
          <div><b>Prescripteur</b><br>${esc(d.prescripteurNom)}<br><span class="note">${fmtDate(d.cree)}</span></div>
          <div><b>Priorité</b><br>${d.priorite === 'urgent' ? '<span class="badge urgent">URGENT</span>' : 'Normale'}</div>
          <div><b>Statut</b><br><span class="badge ${d.statut}">${STATUT_LABEL[d.statut]}</span></div>
          ${d.echantillon ? `<div><b>Échantillon</b><br>${esc(d.echantillon.numero)} (${esc(d.echantillon.type)})<br><span class="note">prélevé le ${fmtDate(d.echantillon.preleveLe)} par ${esc(d.echantillon.prelevePar)}</span></div>` : ''}
          ${d.validation ? `<div><b>Validation</b><br>${esc(d.validation.par)}<br><span class="note">${fmtDate(d.validation.le)}</span></div>` : ''}
        </div>
        <div class="actions">
          ${suivants.map((s) => `<button data-statut="${s}">${BOUTON_STATUT[s]}</button>`).join('')}
          ${pdfDispo ? '<button class="secondaire" id="btn-pdf">Télécharger le compte rendu PDF</button>' : ''}
        </div>
      </div>
      <form class="carte" id="form-resultats">
        <h3>Résultats ${correctionOuverte ? '<span class="note">(correction sous contrôle d’audit)</span>' : ''}</h3>
        <table class="donnees">
          <thead><tr><th>Examen</th><th>Résultat</th><th>Unité</th><th>Référence</th><th>Interprétation</th><th>Note</th></tr></thead>
          <tbody>
          ${d.lignes.map((l) => `
            <tr>
              <td>${esc(l.nom)}${l.sensible ? ' <span class="badge role">sensible</span>' : ''}</td>
              <td style="min-width:110px">${editable
                ? (l.type === 'quantitatif'
                  ? `<input name="v_${l.testId}" type="number" step="any" value="${esc(l.valeur ?? '')}">`
                  : `<select name="v_${l.testId}">
                       <option value="">—</option>
                       <option value="Négatif" ${l.valeur === 'Négatif' ? 'selected' : ''}>Négatif</option>
                       <option value="Positif" ${l.valeur === 'Positif' ? 'selected' : ''}>Positif</option>
                     </select>`)
                : `<b>${esc(l.valeur ?? '—')}</b>`}</td>
              <td>${esc(l.unite || '')}</td>
              <td>${l.type === 'quantitatif' && l.refMin != null ? `${l.refMin} – ${l.refMax}` : '—'}</td>
              <td>${l.flag ? `<span class="flag ${l.flag}">${FLAG_LABEL[l.flag]}</span>` : '—'}
                  <div class="note">${l.saisiPar ? `saisi par ${esc(l.saisiPar)}` : ''}</div></td>
              <td>${editable ? `<input name="c_${l.testId}" value="${esc(l.commentaire || '')}" placeholder="commentaire">` : esc(l.commentaire || '')}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        <label class="champ" style="margin-top:.8rem"><span>Commentaire du biologiste</span>
          ${editable ? `<textarea name="commentaireBiologiste">${esc(d.commentaireBiologiste || '')}</textarea>`
            : `<div>${esc(d.commentaireBiologiste || '—')}</div>`}
        </label>
        ${editable ? '<div class="actions"><button type="submit">Enregistrer les résultats</button></div>' : ''}
      </form>
      <div class="carte">
        <h3>Historique de la demande</h3>
        <ul class="chrono">
          ${d.historique.map((h) => `<li><b>${STATUT_LABEL[h.statut] || h.statut}</b> — ${fmtDate(h.ts)} — ${esc(h.par)}${h.note ? ` <span class="note">(${esc(h.note)})</span>` : ''}</li>`).join('')}
        </ul>
      </div>`, '/labo');

    document.querySelectorAll('button[data-statut]').forEach((b) => {
      b.onclick = async (e) => {
        e.preventDefault();
        const cible = b.dataset.statut;
        const body = { statut: cible };
        if (cible === 'prelevee') {
          const type = prompt('Type d’échantillon :', 'Sang veineux');
          if (type === null) return;
          body.typeEchantillon = type;
        }
        try {
          await api(`/demandes/${d.id}/statut`, { method: 'POST', body });
          toast(`Statut : ${STATUT_LABEL[cible]}`);
          naviguer();
        } catch (err) { toast(err.message, true); }
      };
    });

    const fr = document.getElementById('form-resultats');
    if (editable) fr.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(fr);
      const valeurs = {};
      for (const l of d.lignes) {
        const v = fd.get('v_' + l.testId);
        if (v === null || v === '') continue;
        valeurs[l.testId] = {
          valeur: v,
          commentaire: fd.get('c_' + l.testId) || '',
          anormal: l.type === 'qualitatif' && v === 'Positif',
        };
      }
      try {
        await api(`/demandes/${d.id}/resultats`, {
          method: 'PUT',
          body: { valeurs, commentaireBiologiste: fd.get('commentaireBiologiste') || '' },
        });
        toast('Résultats enregistrés');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };

    const btnPdf = document.getElementById('btn-pdf');
    if (btnPdf) btnPdf.onclick = async (e) => {
      e.preventDefault();
      try {
        const blob = await api(`/demandes/${d.id}/pdf`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `resultats-${d.numero}.pdf`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast('Compte rendu PDF généré');
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Administration =========================== */

route(/^\/admin$/, async () => {
  coquille('Administration', '<div class="chargement">Chargement…</div>', '/admin');
  try {
    const estAdminSys = etat.user.role === 'admin_systeme';
    const [users, tests, etabs] = await Promise.all([
      peut('users:manage') ? api('/users') : [],
      api('/tests'),
      api('/etablissements'),
    ]);
    const ROLES_OPTS = {
      admin_etablissement: "Administrateur d'établissement", medecin: 'Médecin', infirmier: 'Infirmier',
      receptionniste: 'Réceptionniste', laborantin: 'Laborantin', biologiste: 'Biologiste', qualite: 'Responsable qualité',
      ...(estAdminSys ? { admin_systeme: 'Administrateur système' } : {}),
    };
    document.getElementById('corps').innerHTML = `
      ${estAdminSys ? `<div class="carte">
        <h3>Établissements (multi-tenant)</h3>
        <table class="donnees"><thead><tr><th>Nom</th><th>Ville</th><th>Créé le</th></tr></thead>
        <tbody>${etabs.map((e) => `<tr><td><b>${esc(e.nom)}</b></td><td>${esc(e.ville)}</td><td>${fmtDate(e.cree)}</td></tr>`).join('')}</tbody></table>
        <form id="form-etab" class="actions" style="align-items:flex-end">
          <label class="champ" style="margin:0"><span>Nom</span><input name="nom" required></label>
          <label class="champ" style="margin:0"><span>Ville</span><input name="ville"></label>
          <button type="submit">Ajouter un établissement</button>
        </form>
      </div>` : ''}
      ${peut('users:manage') ? `<div class="carte">
        <h3>Utilisateurs</h3>
        <table class="donnees">
          <thead><tr><th>Login</th><th>Nom</th><th>Rôle</th>${estAdminSys ? '<th>Établissement</th>' : ''}<th>État</th><th></th></tr></thead>
          <tbody>${users.map((u) => `
            <tr>
              <td><b>${esc(u.login)}</b></td><td>${esc(u.nom)}</td>
              <td><span class="badge role">${esc(u.roleLabel)}</span></td>
              ${estAdminSys ? `<td>${esc((etabs.find((e) => e.id === u.etablissementId) || {}).nom || '— plateforme —')}</td>` : ''}
              <td>${u.actif ? 'actif' : 'désactivé'}</td>
              <td>${u.id !== etat.user.id ? `<button class="secondaire" data-toggle-user="${u.id}" data-actif="${u.actif}">${u.actif ? 'Désactiver' : 'Réactiver'}</button>` : ''}</td>
            </tr>`).join('')}</tbody>
        </table>
        <form id="form-user">
          <div class="ligne-champs" style="margin-top:.8rem">
            <label class="champ"><span>Login *</span><input name="login" required></label>
            <label class="champ"><span>Nom complet *</span><input name="nom" required></label>
            <label class="champ"><span>Mot de passe *</span><input name="password" type="password" required minlength="8"></label>
            <label class="champ"><span>Rôle *</span><select name="role">
              ${Object.entries(ROLES_OPTS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
            ${estAdminSys ? `<label class="champ"><span>Établissement</span><select name="etablissementId">
              <option value="">— plateforme —</option>
              ${etabs.map((e) => `<option value="${e.id}">${esc(e.nom)}</option>`).join('')}</select></label>` : ''}
          </div>
          <button type="submit">Créer l’utilisateur</button>
        </form>
      </div>` : ''}
      <div class="carte">
        <h3>Catalogue des tests (valeurs de référence et seuils d’alerte)</h3>
        <table class="donnees">
          <thead><tr><th>Code</th><th>Nom</th><th>Catégorie</th><th>Unité</th><th>Référence</th><th>Seuils critiques</th></tr></thead>
          <tbody>${tests.map((t) => `
            <tr><td><b>${esc(t.code)}</b></td><td>${esc(t.nom)}</td><td>${esc(t.categorie)}</td><td>${esc(t.unite)}</td>
            <td>${t.type === 'quantitatif' ? `${t.refMin ?? '—'} – ${t.refMax ?? '—'}` : 'qualitatif'}</td>
            <td>${t.critMin != null || t.critMax != null ? `${t.critMin ?? '—'} / ${t.critMax ?? '—'}` : '—'}</td></tr>`).join('')}</tbody>
        </table>
        ${peut('tests:manage') ? `<form id="form-test">
          <div class="ligne-champs" style="margin-top:.8rem">
            <label class="champ"><span>Code *</span><input name="code" required></label>
            <label class="champ"><span>Nom *</span><input name="nom" required></label>
            <label class="champ"><span>Catégorie</span><input name="categorie"></label>
            <label class="champ"><span>Unité</span><input name="unite"></label>
            <label class="champ"><span>Type</span><select name="type"><option value="quantitatif">Quantitatif</option><option value="qualitatif">Qualitatif</option></select></label>
            <label class="champ"><span>Réf. min</span><input name="refMin" type="number" step="any"></label>
            <label class="champ"><span>Réf. max</span><input name="refMax" type="number" step="any"></label>
            <label class="champ"><span>Critique max</span><input name="critMax" type="number" step="any"></label>
          </div>
          <button type="submit">Ajouter le test</button>
        </form>` : ''}
      </div>`;

    const fe = document.getElementById('form-etab');
    if (fe) fe.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/etablissements', { method: 'POST', body: Object.fromEntries(new FormData(fe)) });
        toast('Établissement créé (catalogue de tests initialisé)');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
    const fu = document.getElementById('form-user');
    if (fu) fu.onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api('/users', { method: 'POST', body: Object.fromEntries(new FormData(fu)) });
        toast('Utilisateur créé');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
    document.querySelectorAll('[data-toggle-user]').forEach((b) => {
      b.onclick = async () => {
        try {
          await api('/users/' + b.dataset.toggleUser, { method: 'PUT', body: { actif: b.dataset.actif !== 'true' } });
          toast('Utilisateur mis à jour');
          naviguer();
        } catch (err) { toast(err.message, true); }
      };
    });
    const ft = document.getElementById('form-test');
    if (ft) ft.onsubmit = async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(ft));
      for (const k of ['refMin', 'refMax', 'critMax']) if (body[k] === '') delete body[k];
      try {
        await api('/tests', { method: 'POST', body });
        toast('Test ajouté au catalogue');
        naviguer();
      } catch (err) { toast(err.message, true); }
    };
  } catch (e) { toast(e.message, true); }
});

/* ============================ Audit ==================================== */

route(/^\/audit$/, async () => {
  coquille("Journal d'audit", `
    <div class="carte">
      <input class="recherche" id="recherche-audit" placeholder="Filtrer (action, utilisateur, détail)…">
      <p class="note" style="margin-bottom:0">Journal en ajout seul : aucune entrée ne peut être modifiée ni supprimée par un utilisateur, quel que soit son rôle (Art. 16 du cahier des charges).</p>
    </div>
    <div class="carte" id="liste-audit"><div class="chargement">Chargement…</div></div>`, '/audit');
  const rendre = async (q = '') => {
    const rows = await api('/audit' + (q ? '?q=' + encodeURIComponent(q) : ''));
    document.getElementById('liste-audit').innerHTML = rows.length ? `
      <table class="donnees">
        <thead><tr><th>Horodatage</th><th>Utilisateur</th><th>Action</th><th>Entité</th><th>Détails</th></tr></thead>
        <tbody>${rows.map((a) => `
          <tr><td>${fmtDate(a.ts)}</td><td>${esc(a.userNom)}</td>
          <td><span class="badge role">${esc(a.action)}</span></td>
          <td>${esc(a.entite)}</td><td class="note">${esc(a.details)}</td></tr>`).join('')}</tbody>
      </table>` : '<div class="vide">Journal vide.</div>';
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
