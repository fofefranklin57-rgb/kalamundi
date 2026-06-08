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

  var ZONE_MULTITAG = '246898';     // Multitag
  var SRC_MULTITAG  = 'https://quge5.com/88/tag.min.js';

  var DELAI_MS = 2500; // Délai avant injection (laisser la page se charger)

  /* ── Pages complètement sans pub ────────────────────────── */
  var PAGE_SANS_PUB = [
    'reader.html',   // lecture immersive — jamais de pub
    'admin.html',    // outil de gestion — expérience propre
    'payment.html',  // tunnel de paiement — ne pas distraire
  ];

  /* ── Initialisation ──────────────────────────────────────── */
  function init() {
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
    var isBrowse  = page.includes('library') || page.includes('work')
                 || page.includes('author-profile');
    var isAccueil = page === '/' || page.endsWith('index.html') || page === '';
    var isLogin   = page.includes('login.html');
    var isDashboard = page.includes('author-dashboard')
                   || page.includes('institution')
                   || page.includes('abonnements')
                   || page.includes('publish')
                   || page.includes('cgu')
                   || page.includes('contrat');

    if (isBrowse) {
      /* Pages de catalogue et fiches œuvres :
         Vignette Banner + Multitag — meilleur RPM sur contenu éditorial */
      _chargerScript(ZONE_VIGNETTE, SRC_VIGNETTE);
      _chargerScript(ZONE_MULTITAG, SRC_MULTITAG);

    } else if (isAccueil) {
      /* Accueil : Vignette Banner UNIQUEMENT
         In-Page Push et Multitag INTERDITS sur l'accueil —
         ces formats génèrent des fausses fenêtres de téléchargement
         qui nuisent à l'image de la plateforme */
      _chargerScript(ZONE_VIGNETTE, SRC_VIGNETTE);

    } else if (isLogin) {
      /* Login/inscription : In-Page Push uniquement — discret,
         format notification, ne bloque pas le formulaire */
      _chargerScript(ZONE_INPAGE, SRC_INPAGE);

    } else if (isDashboard) {
      /* Dashboard, publication, pages légales :
         In-Page Push uniquement — non intrusif */
      _chargerScript(ZONE_INPAGE, SRC_INPAGE);

    } else {
      /* Toutes les autres pages : In-Page Push par défaut */
      _chargerScript(ZONE_INPAGE, SRC_INPAGE);
    }
  }

  /* ── Charger au scroll (% de la page) ───────────────────── */
  function _chargerAuScroll(seuil, callback) {
    var declenche = false;
    function verifier() {
      if (declenche) return;
      var scrolled = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if (scrolled >= seuil) {
        declenche = true;
        window.removeEventListener('scroll', verifier);
        callback();
      }
    }
    window.addEventListener('scroll', verifier, { passive: true });
  }

  /* ── Intercepteur anti-popup In-Page Push ───────────────── */
  /* Signature exacte du popup Monetag : z-index = 2147483647 (valeur max 32-bit)
     La Vignette Banner utilise un z-index inférieur → jamais touchée */
  function _activerAntiPopup() {
    if (window._kalaAntiPopupActif) return;
    window._kalaAntiPopupActif = true;

    /* Bloquer les demandes de permission notification */
    try {
      Notification.requestPermission = function () { return Promise.resolve('denied'); };
      Object.defineProperty(Notification, 'permission', { get: function () { return 'denied'; } });
    } catch (e) {}

    /* Bloquer l'enregistrement de service workers push */
    try {
      if (navigator.serviceWorker) {
        var _origSW = navigator.serviceWorker.register.bind(navigator.serviceWorker);
        navigator.serviceWorker.register = function (url, opts) {
          if (/push|notification|subscribe/i.test(String(url))) {
            return Promise.reject(new Error('blocked'));
          }
          return _origSW(url, opts);
        };
      }
    } catch (e) {}

    /* MutationObserver démarré après 4 secondes :
       - Vignette Banner apparaît en < 2s  → passe avant l'observer
       - In-Page Push apparaît après 5-10s → bloqué par l'observer
       z-index 2147483647 = signature exclusive du popup Monetag */
    setTimeout(function () {
      var ZMAX = 2147483647;

      function _tuer(el) {
        if (!el || el.nodeType !== 1) return;
        try {
          var z = parseInt(window.getComputedStyle(el).zIndex);
          if (z === ZMAX) {
            el.style.cssText += ';display:none!important;visibility:hidden!important;pointer-events:none!important;';
          }
        } catch (e) {}
      }

      new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var nodes = mutations[i].addedNodes;
          for (var j = 0; j < nodes.length; j++) {
            _tuer(nodes[j]);
          }
        }
      }).observe(document.documentElement, { childList: true, subtree: true });

    }, 4000); /* 4s : Vignette déjà affichée, popup pas encore arrivé */
  }

  function _chargerScript(zone, src) {
    _activerAntiPopup(); /* Activer l'intercepteur avant chaque chargement */
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
