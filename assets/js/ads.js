/* ============================================================
   ads.js — Intégration Monetag
   Kalamundi — La Plume du Monde

   Formats actifs :
   - Accueil       : Vignette Banner + Multitag (bannières discrètes — pas de In-Page Push)
   - Bibliothèque  : Vignette Banner + Multitag
   - Fiche œuvre   : Vignette Banner + Multitag
   - Login/autres  : In-Page Push uniquement (discret, ne bloque pas)

   Règle : ZERO pub pendant la lecture (reader.html)
           ZERO pub pour les abonnés Reader+ et Auteur Pro
           ZERO In-Page Push sur l'accueil (réduit le rebond)
   ============================================================ */

(function () {
  'use strict';

  /* ── Zone IDs Monetag ─────────────────────────────────────── */
  var ZONE_INPAGE   = '11110665';   // In-Page Push
  var SRC_INPAGE    = 'https://nap5k.com/tag.min.js';

  var ZONE_VIGNETTE = '11117130';   // Vignette Banner (zone mise à jour)
  var SRC_VIGNETTE  = 'https://n6wxm.com/vignette.min.js';

  // Multitag supprimé — injectait des formats non contrôlés (popunders, redirections)

  var DELAI_MS = 2500; // Délai avant injection (laisser la page se charger)

  /* ── Pages complètement sans pub ────────────────────────── */
  var PAGE_SANS_PUB = [
    'reader.html',         // lecture immersive — jamais de pub
    'admin.html',          // outil de gestion — expérience propre
    'payment.html',        // tunnel de paiement — ne pas distraire
    'author-dashboard',    // tableau de bord auteur — outil pro
    'abonnements',         // page paiement — ne pas distraire
    'contrat-auteur',      // page légale — pas de pub
    'cgu',                 // page légale — pas de pub
    'confidentialite',     // page légale — pas de pub
    'institution',         // page pro — expérience propre
  ];

  /* ── Anti-redirection automatique ───────────────────────── */
  /* Bloque les redirections déclenchées par les scripts pub
     sans geste utilisateur (clic volontaire).
     Les clics volontaires sur les pubs fonctionnent normalement. */
  function _activerAntiRedirect() {
    if (window._kalaAntiRedirect) return;
    window._kalaAntiRedirect = true;

    var _clicUtilisateur = false;
    var _timer = null;

    /* Détecter les vrais clics utilisateur */
    document.addEventListener('click', function () {
      _clicUtilisateur = true;
      clearTimeout(_timer);
      _timer = setTimeout(function () { _clicUtilisateur = false; }, 1000);
    }, true);

    /* Bloquer window.open automatique (nouvelle tab pub sans clic) */
    var _origOpen = window.open.bind(window);
    window.open = function (url, target, features) {
      if (_clicUtilisateur) return _origOpen(url, target, features);
      console.log('[KalaAds] window.open bloqué (auto):', url);
      return null;
    };

    /* Bloquer window.location.href automatique (redirection page entière) */
    var _locDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    try {
      var _hrefDescriptor = Object.getOwnPropertyDescriptor(Location.prototype, 'href');
      if (_hrefDescriptor && _hrefDescriptor.set) {
        var _origHrefSet = _hrefDescriptor.set;
        Object.defineProperty(Location.prototype, 'href', {
          set: function (url) {
            if (_clicUtilisateur || url.startsWith('/') ||
                url.includes('kalamundi') || url.startsWith('#')) {
              return _origHrefSet.call(this, url);
            }
            console.log('[KalaAds] location.href bloqué (auto):', url);
          },
          get: _hrefDescriptor.get,
          configurable: true,
        });
      }
    } catch (e) {}

    /* Bloquer window.location.assign automatique */
    try {
      var _origAssign = window.location.assign.bind(window.location);
      window.location.assign = function (url) {
        if (_clicUtilisateur || url.startsWith('/') || url.includes('kalamundi')) {
          return _origAssign(url);
        }
        console.log('[KalaAds] location.assign bloqué (auto):', url);
      };
    } catch (e) {}
  }

  /* ── Initialisation ──────────────────────────────────────── */
  function init() {
    /* Anti-redirect activé immédiatement, avant tout script pub */
    _activerAntiRedirect();

    var page = window.location.pathname;

    // Pas de pub sur les pages blacklistées
    for (var i = 0; i < PAGE_SANS_PUB.length; i++) {
      if (page.includes(PAGE_SANS_PUB[i])) return;
    }

    // Pas de double initialisation
    if (window._kalaAdsLoaded) return;
    window._kalaAdsLoaded = true;

    // Vérifier si l'utilisateur est abonné (localStorage rapide)
    var estAbonne = _verifierAbonnementLocal();

    setTimeout(function () {
      _chargerPubs(page, estAbonne);
      if (!estAbonne) {
        _injecterBandeau();
      }
    }, DELAI_MS);

    // Vérification Supabase en arrière-plan (plus précise)
    _verifierAbonnementSupabase(function (abonne) {
      if (abonne && window._kalaAdBar) {
        window._kalaAdBar.remove();
        window._kalaAdBar = null;
        document.documentElement.style.paddingBottom = '';
      }
    });
  }

  /* ── Charger les scripts Monetag selon la page ───────────── */
  function _chargerPubs(page, estAbonne) {
    /* Zéro pub : accueil et lecteur uniquement */
    var isAccueil = page === '/' || page.endsWith('index.html') || page === '';
    var isReader  = page.includes('reader.html');
    if (isAccueil || isReader) return;

    /* Pages de navigation/contenu → Vignette + Multitag (meilleur RPM) */
    var isBrowse = page.includes('library')
                || page.includes('work.html')
                || page.includes('author-profile')
                || page.includes('bienvenue');

    /* Toutes les autres pages → In-Page Push (discret) */
    if (isBrowse) {
      _chargerScript(ZONE_VIGNETTE, SRC_VIGNETTE);
    } else {
      _chargerScript(ZONE_INPAGE, SRC_INPAGE);
    }
  }

  function _chargerScript(zone, src) {
    var s       = document.createElement('script');
    s.dataset.zone    = zone;
    s.src             = src;
    s.async           = true;
    s.dataset.cfasync = 'false';
    document.body.appendChild(s);
  }

  /* ── Bandeau bas discret ─────────────────────────────────── */
  function _injecterBandeau() {
    if (document.getElementById('kala-ad-bar')) return;

    var bar = document.createElement('div');
    bar.id  = 'kala-ad-bar';
    window._kalaAdBar = bar;
    bar.setAttribute('aria-label', 'Publicité');
    bar.style.cssText = [
      'position:fixed', 'bottom:0', 'left:0', 'right:0',
      'height:56px', 'z-index:9998',
      'background:var(--bg-card,#fff)',
      'border-top:1px solid var(--border-color,#e2e8f0)',
      'display:flex', 'align-items:center', 'justify-content:center',
      'overflow:hidden', 'box-shadow:0 -2px 8px rgba(0,0,0,0.06)',
    ].join(';');

    var label = document.createElement('span');
    label.textContent = 'Publicité';
    label.style.cssText = 'position:absolute;left:8px;top:4px;font-size:9px;color:#94a3b8;letter-spacing:.05em;text-transform:uppercase';

    var fermer = document.createElement('button');
    fermer.innerHTML = '✕';
    fermer.setAttribute('aria-label', 'Fermer');
    fermer.style.cssText = [
      'position:absolute', 'right:8px', 'top:50%',
      'transform:translateY(-50%)',
      'background:none', 'border:none',
      'color:#94a3b8', 'font-size:14px',
      'cursor:pointer', 'padding:6px', 'line-height:1',
    ].join(';');

    fermer.onclick = function () {
      bar.remove();
      window._kalaAdBar = null;
      document.documentElement.style.paddingBottom = '';
    };

    bar.appendChild(label);
    bar.appendChild(fermer);
    document.body.appendChild(bar);
    document.documentElement.style.paddingBottom = '56px';
  }

  /* ── Vérification abonnement (localStorage) ─────────────── */
  function _verifierAbonnementLocal() {
    try {
      var plan = localStorage.getItem('kala_plan');
      return plan === 'reader_plus' || plan === 'auteur_pro' || plan === 'institution';
    } catch (e) { return false; }
  }

  /* ── Vérification abonnement (Supabase) ─────────────────── */
  function _verifierAbonnementSupabase(callback) {
    // Attendre que le client Supabase soit disponible (chargé via auth.js)
    var tentatives = 0;
    var interval = setInterval(function () {
      tentatives++;
      if (tentatives > 10) { clearInterval(interval); return; }

      // Chercher le client supabase dans le scope global (exposé par auth.js si besoin)
      // Pour l'instant on se base sur les paiements enregistrés en localStorage
      var plan = localStorage.getItem('kala_plan');
      var abonne = plan === 'reader_plus' || plan === 'auteur_pro' || plan === 'institution';

      clearInterval(interval);
      callback(abonne);
    }, 500);
  }

  /* ── Point d'entrée public (appelable depuis app.js ou les pages) ── */
  window.initAds = function (planAbonne) {
    if (planAbonne) {
      localStorage.setItem('kala_plan', 'reader_plus'); // mémoriser
    }
    init();
  };

  /* ── Auto-démarrage si la page a déjà fini de charger ────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM déjà prêt (script chargé en bas de page)
    init();
  }

})();
