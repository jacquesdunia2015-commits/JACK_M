/* Comportements du site — cahier des charges § 4.3.1, § 4.4, § 4.5, § 6.8.
   Aucun appel réseau tiers n'est effectué avant consentement (§ 6.7). */
(function () {
  "use strict";

  var racine = document.documentElement;
  var base = racine.getAttribute("data-base") || "";
  var reglages = {};
  try { reglages = JSON.parse(document.getElementById("reglages-site").textContent); } catch (e) {}

  /* ------------------------------------------------------------------ *
   * 1. Mesure : file d'attente, vidée seulement si la finalité « mesure »
   *    est acceptée. Les événements attendus figurent au § 6.8.
   * ------------------------------------------------------------------ */
  var file = [];
  var mesureActive = false;

  function evenement(nom, props) {
    var e = Object.assign({ evenement: nom, page: location.pathname }, props || {});
    if (!mesureActive) { file.push(e); return; }
    envoyer(e);
  }
  function envoyer(e) {
    if (reglages.mesure === "matomo" && window._paq) {
      window._paq.push(["trackEvent", e.categorie || "Site", e.evenement, e.libelle || "", e.valeur || 0]);
    } else if (reglages.mesure === "ga4" && window.gtag) {
      window.gtag("event", e.evenement, e);
    }
    if (window.dataLayer) window.dataLayer.push(e);
  }
  window.mesurer = evenement;

  function activerMesure() {
    if (mesureActive) return;
    mesureActive = true;
    window.dataLayer = window.dataLayer || [];
    // Le script de mesure n'est injecté qu'ici, après consentement explicite.
    if (reglages.mesure === "matomo" && reglages.matomoUrl && reglages.matomoUrl.indexOf("[") !== 0) {
      window._paq = window._paq || [];
      window._paq.push(["setTrackerUrl", reglages.matomoUrl + "matomo.php"]);
      window._paq.push(["setSiteId", reglages.matomoSiteId]);
      window._paq.push(["trackPageView"]);
      var s = document.createElement("script");
      s.async = true; s.src = reglages.matomoUrl + "matomo.js";
      document.head.appendChild(s);
    }
    file.splice(0).forEach(envoyer);
  }

  if (window.Consentement) {
    window.Consentement.surChangement(function (choix) {
      if (choix && choix.mesure) activerMesure();
      if (choix && choix.publicite) document.dispatchEvent(new CustomEvent("publicite-autorisee"));
    });
  }

  /* ------------------------------------------------------------------ *
   * 2. Navigation : burger, accordéon mobile, voile.
   * ------------------------------------------------------------------ */
  var nav = document.querySelector(".nav-principale");
  var burger = document.querySelector(".burger");
  var voile = document.querySelector(".voile");

  function fermerNav() {
    if (!nav) return;
    nav.setAttribute("data-ouvert", "non");
    if (burger) burger.setAttribute("aria-expanded", "false");
    if (voile) voile.setAttribute("data-actif", "non");
    document.body.style.overflow = "";
  }
  if (burger && nav) {
    burger.addEventListener("click", function () {
      var ouvert = nav.getAttribute("data-ouvert") === "oui";
      if (ouvert) return fermerNav();
      nav.setAttribute("data-ouvert", "oui");
      burger.setAttribute("aria-expanded", "true");
      if (voile) voile.setAttribute("data-actif", "oui");
      document.body.style.overflow = "hidden";
      var premier = nav.querySelector("a");
      if (premier) premier.focus();
    });
  }
  if (voile) voile.addEventListener("click", fermerNav);

  // Accordéon des sous-menus (mobile) : un bouton par rubrique à sous-rubriques.
  document.querySelectorAll(".nav-item > .sous-menu").forEach(function (sm) {
    var item = sm.parentElement;
    var lien = item.querySelector(":scope > a");
    var b = document.createElement("button");
    b.type = "button";
    b.className = "bascule-sous-menu";
    b.setAttribute("aria-expanded", "false");
    b.innerHTML = '<span class="invisible">Afficher les sous-rubriques de ' + (lien ? lien.textContent : "") + "</span>";
    b.addEventListener("click", function () {
      var ouvert = item.getAttribute("data-deploye") === "oui";
      item.setAttribute("data-deploye", ouvert ? "non" : "oui");
      b.setAttribute("aria-expanded", ouvert ? "false" : "true");
    });
    item.appendChild(b);
  });

  /* ------------------------------------------------------------------ *
   * 3. Recherche interne (§ 4.4) : surcouche + suggestions au fil de la frappe.
   * ------------------------------------------------------------------ */
  var surcouche = document.querySelector(".surcouche-recherche");
  var boutonRecherche = document.querySelector("[data-ouvrir-recherche]");
  var index = null, chargement = null;

  function chargerIndex() {
    if (index) return Promise.resolve(index);
    if (!chargement) {
      chargement = fetch(base + "recherche/index.json")
        .then(function (r) { return r.json(); })
        .then(function (d) { index = d; return d; })
        .catch(function () { index = []; return index; });
    }
    return chargement;
  }

  function normaliser(s) {
    return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function chercher(q, limite) {
    var mots = normaliser(q).split(/\s+/).filter(Boolean);
    if (!mots.length || !index) return [];
    return index.map(function (doc) {
      var champ = doc.r || "";
      var score = 0;
      mots.forEach(function (m) {
        if (normaliser(doc.t).indexOf(m) >= 0) score += 6;
        if (normaliser(doc.c).indexOf(m) >= 0) score += 2;
        if (normaliser(champ).indexOf(m) >= 0) score += 2;
        if (normaliser(doc.k || "").indexOf(m) >= 0) score += 3;
        if (normaliser(doc.x || "").indexOf(m) >= 0) score += 1;
      });
      return { doc: doc, score: score };
    }).filter(function (x) { return x.score > 0; })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, limite || 8);
  }

  function rendreSuggestions(liste, resultats, q) {
    liste.innerHTML = "";
    if (!resultats.length) {
      liste.innerHTML = '<li><p style="padding:.6rem .3rem;margin:0">Aucun résultat pour « ' +
        q.replace(/</g, "&lt;") + ' ». Essayez un terme plus général.</p></li>';
      return;
    }
    resultats.forEach(function (r) {
      var li = document.createElement("li");
      li.innerHTML = '<a href="' + r.doc.u + '"><span class="rubrique-etiquette">' + r.doc.r +
        "</span>" + r.doc.t + "</a>";
      liste.appendChild(li);
    });
  }

  if (boutonRecherche && surcouche) {
    var champ = surcouche.querySelector("input[type=search]");
    var liste = surcouche.querySelector(".suggestions");
    var minuteur;

    boutonRecherche.addEventListener("click", function () {
      surcouche.setAttribute("data-ouvert", "oui");
      chargerIndex();
      champ.focus();
    });
    surcouche.addEventListener("click", function (ev) {
      if (ev.target === surcouche || ev.target.hasAttribute("data-fermer")) {
        surcouche.setAttribute("data-ouvert", "non");
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") {
        surcouche.setAttribute("data-ouvert", "non");
        fermerNav();
      }
    });
    champ.addEventListener("input", function () {
      clearTimeout(minuteur);
      var q = champ.value.trim();
      if (q.length < 2) { liste.innerHTML = ""; return; }
      minuteur = setTimeout(function () {
        chargerIndex().then(function () {
          rendreSuggestions(liste, chercher(q, 8), q);
          evenement("recherche_interne", { categorie: "Recherche", libelle: q, source: "surcouche" });
        });
      }, 180);
    });
  }

  // Page de résultats complète
  var pageRecherche = document.querySelector("[data-page-recherche]");
  if (pageRecherche) {
    var champP = pageRecherche.querySelector("input[type=search]");
    var sortie = pageRecherche.querySelector("[data-resultats]");
    var compteur = pageRecherche.querySelector("[data-compteur]");
    var q0 = new URLSearchParams(location.search).get("q") || "";
    if (q0) champP.value = q0;

    function afficherResultats(q) {
      chargerIndex().then(function () {
        var res = chercher(q, 50);
        compteur.textContent = q
          ? res.length + " résultat" + (res.length > 1 ? "s" : "") + " pour « " + q + " »"
          : "";
        sortie.innerHTML = "";
        if (q && !res.length) {
          sortie.innerHTML = '<p>Aucun contenu ne correspond à votre recherche. ' +
            'Essayez un terme plus général, ou parcourez le <a href="' + base + 'plan-du-site/">plan du site</a>.</p>';
        }
        res.forEach(function (r) {
          var art = document.createElement("article");
          art.className = "carte";
          art.innerHTML = '<p class="carte-meta"><span class="etiquette">' + r.doc.r + "</span></p>" +
            '<h2 class="carte-titre"><a href="' + r.doc.u + '">' + r.doc.t + "</a></h2>" +
            '<p class="carte-chapo">' + r.doc.c + "</p>";
          sortie.appendChild(art);
        });
        if (q) evenement("recherche_interne", { categorie: "Recherche", libelle: q, valeur: res.length, source: "page" });
      });
    }
    if (q0) afficherResultats(q0);
    pageRecherche.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var q = champP.value.trim();
      history.replaceState(null, "", "?q=" + encodeURIComponent(q));
      afficherResultats(q);
    });
  }

  /* ------------------------------------------------------------------ *
   * 4. Clics sortants affiliés (§ 4.6) et bloc partenaire (§ 6.8).
   * ------------------------------------------------------------------ */
  document.addEventListener("click", function (ev) {
    var a = ev.target.closest("a[data-affilie]");
    if (a) {
      evenement("clic_affilie", {
        categorie: "Affiliation",
        libelle: a.getAttribute("data-affilie"),
        marchand: a.getAttribute("data-marchand") || "",
        emplacement: a.getAttribute("data-emplacement") || "corps",
        article: document.body.getAttribute("data-article") || ""
      });
    }
    var p = ev.target.closest("[data-partenaire] a");
    if (p) evenement("clic_partenaire", { categorie: "Partenaire", libelle: p.href });
  });

  /* ------------------------------------------------------------------ *
   * 5. Profondeur de lecture 25/50/75/100 % (§ 6.8) + barre de progression.
   * ------------------------------------------------------------------ */
  var corps = document.querySelector(".corps");
  var barre = document.querySelector("[data-progression]");
  if (corps) {
    var paliers = [25, 50, 75, 100];
    var atteints = {};
    var tic = false;
    window.addEventListener("scroll", function () {
      if (tic) return;
      tic = true;
      requestAnimationFrame(function () {
        tic = false;
        var haut = corps.offsetTop;
        var hauteur = corps.offsetHeight;
        var vu = window.scrollY + window.innerHeight - haut;
        var pct = Math.max(0, Math.min(100, Math.round((vu / hauteur) * 100)));
        if (barre) barre.style.width = pct + "%";
        paliers.forEach(function (p) {
          if (pct >= p && !atteints[p]) {
            atteints[p] = true;
            evenement("profondeur_lecture", { categorie: "Lecture", libelle: p + "%", valeur: p });
          }
        });
      });
    }, { passive: true });
  }

  /* ------------------------------------------------------------------ *
   * 6. Newsletter (§ 4.5) : double opt-in, case non pré-cochée, suivi de source.
   * ------------------------------------------------------------------ */
  document.querySelectorAll("form[data-newsletter]").forEach(function (f) {
    f.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var msg = f.querySelector("[data-message]");
      var email = f.querySelector('input[type="email"]');
      var accord = f.querySelector('input[type="checkbox"]');
      if (!accord.checked) {
        msg.textContent = "Merci de cocher la case de consentement pour poursuivre.";
        accord.focus();
        return;
      }
      var source = f.getAttribute("data-newsletter") || "inconnu";
      evenement("inscription_newsletter", { categorie: "Newsletter", libelle: source, emplacement: source });
      // En production : appel de l'API d'emailing (§ 4.5), qui déclenche
      // l'envoi du courriel de confirmation. Sans double opt-in confirmé,
      // l'adresse n'est jamais considérée comme abonnée.
      msg.textContent = "Merci ! Un courriel de confirmation vient d'être envoyé à " +
        email.value + ". Votre inscription ne sera active qu'après avoir cliqué sur le lien qu'il contient.";
      f.querySelector(".ligne").hidden = true;
      f.querySelector(".consentement").hidden = true;
    });
  });

  /* ------------------------------------------------------------------ *
   * 7. Partage natif mobile (§ 4.3.4 point 10).
   * ------------------------------------------------------------------ */
  var partageNatif = document.querySelector("[data-partage-natif]");
  if (partageNatif) {
    if (navigator.share) {
      partageNatif.addEventListener("click", function () {
        navigator.share({ title: document.title, url: location.href })
          .then(function () { evenement("partage", { categorie: "Partage", libelle: "natif" }); })
          .catch(function () {});
      });
    } else {
      partageNatif.hidden = true;
    }
  }

  /* ------------------------------------------------------------------ *
   * 8. Ouverture du panneau de consentement depuis le pied de page.
   * ------------------------------------------------------------------ */
  document.querySelectorAll("[data-ouvrir-cmp]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (window.Consentement) window.Consentement.ouvrir();
    });
  });

  /* Année dynamique du pied de page (§ 4.3.1). */
  document.querySelectorAll("[data-annee]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
