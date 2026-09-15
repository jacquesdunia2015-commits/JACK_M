/* Gestion du consentement (CMP) — cahier des charges § 6.7.
   Règles appliquées :
   - aucun traceur non essentiel n'est déposé avant un choix explicite ;
   - refuser est aussi simple qu'accepter (deux boutons de même niveau) ;
   - granularité par finalité ;
   - journalisation de la preuve (date, version du bandeau, choix détaillé) ;
   - choix réversible depuis le pied de page.
   Le choix est conservé dans localStorage : aucun cookie n'est écrit tant
   qu'aucune finalité n'est acceptée. */
(function () {
  "use strict";

  var CLE = "consentement.v1";
  var VERSION_BANDEAU = 1;
  var DUREE_MOIS = 6;

  var FINALITES = [
    { id: "necessaire", nom: "Strictement nécessaires", obligatoire: true,
      desc: "Mémorisation de votre choix, sécurité, fonctionnement du site." },
    { id: "mesure", nom: "Mesure d'audience", obligatoire: false,
      desc: "Comprendre quelles pages sont lues, pour améliorer le site." },
    { id: "publicite", nom: "Publicité", obligatoire: false,
      desc: "Diffusion et mesure des campagnes. Le refus n'empêche pas l'affichage de publicités." },
    { id: "tiers", nom: "Réseaux sociaux et contenus tiers", obligatoire: false,
      desc: "Vidéos et publications intégrées, qui déposent leurs propres traceurs." }
  ];

  var etat = null;
  var abonnes = [];

  function lire() {
    try {
      var brut = window.localStorage.getItem(CLE);
      if (!brut) return null;
      var v = JSON.parse(brut);
      if (v.version !== VERSION_BANDEAU) return null;
      var limite = new Date(v.date);
      limite.setMonth(limite.getMonth() + DUREE_MOIS);
      if (limite < new Date()) return null;   // le consentement expire
      return v;
    } catch (e) { return null; }
  }

  function ecrire(choix) {
    etat = {
      version: VERSION_BANDEAU,
      date: new Date().toISOString(),
      choix: choix,
      // Preuve conservée côté navigateur ; en production, la même trace est
      // envoyée au journal serveur du CMP (§ 6.7 « journalisation des preuves »).
      preuve: { url: location.pathname, langue: navigator.language }
    };
    try { window.localStorage.setItem(CLE, JSON.stringify(etat)); } catch (e) {}
    abonnes.forEach(function (f) { try { f(choix); } catch (e) {} });
    document.dispatchEvent(new CustomEvent("consentement", { detail: choix }));
  }

  function tout(valeur) {
    var c = {};
    FINALITES.forEach(function (f) { c[f.id] = f.obligatoire ? true : valeur; });
    return c;
  }

  function accepte(id) { return !!(etat && etat.choix && etat.choix[id]); }

  function construire() {
    var bandeau = document.createElement("aside");
    bandeau.className = "cmp";
    bandeau.setAttribute("role", "dialog");
    bandeau.setAttribute("aria-modal", "false");
    bandeau.setAttribute("aria-labelledby", "cmp-titre");
    bandeau.id = "cmp";

    var finalites = FINALITES.filter(function (f) { return !f.obligatoire; }).map(function (f) {
      return '<label class="cmp-finalite">' +
        '<input type="checkbox" name="' + f.id + '">' +
        '<span><strong>' + f.nom + '</strong><span>' + f.desc + '</span></span></label>';
    }).join("");

    bandeau.innerHTML =
      '<div class="cmp-corps">' +
        '<h2 id="cmp-titre">Votre choix sur les traceurs</h2>' +
        '<p>Nous utilisons des traceurs pour mesurer l\'audience et financer le site par la publicité. ' +
        'Vous pouvez tout accepter, tout refuser, ou choisir finalité par finalité. ' +
        'Votre choix est modifiable à tout moment depuis le pied de page. ' +
        '<a href="__CONF__">En savoir plus</a>.</p>' +
        '<fieldset class="cmp-finalites" hidden data-detail>' +
          '<legend class="invisible">Choisir par finalité</legend>' +
          '<label class="cmp-finalite"><input type="checkbox" checked disabled>' +
          '<span><strong>Strictement nécessaires</strong><span>Toujours actifs : mémorisation de votre choix, sécurité.</span></span></label>' +
          finalites +
        '</fieldset>' +
        '<div class="cmp-actions">' +
          '<button type="button" class="bouton" data-action="tout-accepter">Tout accepter</button>' +
          '<button type="button" class="bouton" data-action="tout-refuser">Tout refuser</button>' +
          '<button type="button" class="bouton bouton-secondaire" data-action="personnaliser">Personnaliser</button>' +
          '<button type="button" class="bouton bouton-secondaire" hidden data-action="enregistrer">Enregistrer mes choix</button>' +
        '</div>' +
      '</div>';

    var base = document.documentElement.getAttribute("data-base") || "";
    bandeau.innerHTML = bandeau.innerHTML.replace("__CONF__", base + "gestion-des-cookies/");
    return bandeau;
  }

  function afficher() {
    var bandeau = document.getElementById("cmp") || construire();
    if (!bandeau.isConnected) document.body.appendChild(bandeau);
    bandeau.hidden = false;

    var detail = bandeau.querySelector("[data-detail]");
    var enregistrer = bandeau.querySelector('[data-action="enregistrer"]');
    var personnaliser = bandeau.querySelector('[data-action="personnaliser"]');

    // Pré-cocher selon un éventuel choix précédent (jamais coché par défaut sinon)
    if (etat && etat.choix) {
      FINALITES.forEach(function (f) {
        var c = bandeau.querySelector('input[name="' + f.id + '"]');
        if (c) c.checked = !!etat.choix[f.id];
      });
    }

    bandeau.onclick = function (ev) {
      var b = ev.target.closest("[data-action]");
      if (!b) return;
      var action = b.getAttribute("data-action");
      if (action === "personnaliser") {
        detail.hidden = false;
        personnaliser.hidden = true;
        enregistrer.hidden = false;
        return;
      }
      if (action === "tout-accepter") ecrire(tout(true));
      if (action === "tout-refuser") ecrire(tout(false));
      if (action === "enregistrer") {
        var c = { necessaire: true };
        FINALITES.forEach(function (f) {
          if (f.obligatoire) return;
          var i = bandeau.querySelector('input[name="' + f.id + '"]');
          c[f.id] = !!(i && i.checked);
        });
        ecrire(c);
      }
      bandeau.hidden = true;
    };

    var premier = bandeau.querySelector("button");
    if (premier) premier.focus();
  }

  etat = lire();

  window.Consentement = {
    finalites: FINALITES,
    accepte: accepte,
    etat: function () { return etat; },
    ouvrir: afficher,
    surChangement: function (f) { abonnes.push(f); if (etat) f(etat.choix); },
    retirer: function () {
      try { window.localStorage.removeItem(CLE); } catch (e) {}
      etat = null;
      afficher();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { if (!etat) afficher(); });
  } else if (!etat) {
    afficher();
  }
})();
