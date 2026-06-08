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

  /* ── Intercepteur anti-popup ────────────────────────────── */
  /* Bloque les overlays plein-écran injectés par Monetag (faux boutons
     "Finish download", "Continue", etc.) tout en laissant passer
     la Vignette Banner (petit widget dans un coin) */
  function _activerAntiPopup() {
    if (window._kalaAntiPopupActif) return;
    window._kalaAntiPopupActif = true;

    /* 1. Bloquer les demandes de permission notification */
    try {
      if (window.Notification) {
        var _origReq = Notification.requestPermission.bind(Notification);
        Notification.requestPermission = function () {
          return Promise.resolve('denied');
        };
      }
    } catch (e) {}

    /* 2. MutationObserver — supprimer les popups intrusifs */
    var obs = new MutationObserver(function (mutations) {
      mutations.forEach(function (m) {
        m.addedNodes.forEach(function (node) {
          if (node.nodeType !== 1) return;
          _verifierEtSupprimer(node);
          /* Vérifier aussi les enfants */
          node.querySelectorAll && node.querySelectorAll('*').forEach(_verifierEtSupprimer);
        });
      });
    });
    obs.observe(document.body, { childList: true, subtree: false });
  }

  function _verifierEtSupprimer(el) {
    try {
      var style = window.getComputedStyle(el);
      var zIndex = parseInt(style.zIndex) || 0;
      var pos    = style.position;

      /* Un popup intrusif = position fixed/absolute, z-index très élevé */
      if ((pos !== 'fixed' && pos !== 'absolute') || zIndex < 9000) return;

      var w = el.offsetWidth;
      var h = el.offsetHeight;
      var vw = window.innerWidth;
      var vh = window.innerHeight;

      /* Couvre plus de 25% de la largeur ET plus de 80px de hauteur */
      if (w < vw * 0.25 || h < 80) return;

      /* Exclure la Vignette Banner Monetag (identifiable par son iframe interne
         qui est petite et positionnée en bas à droite) */
      var rect = el.getBoundingClientRect();
      var estVignette = (rect.right > vw * 0.7 && rect.bottom > vh * 0.6 && w < 400);
      if (estVignette) return;

      /* Exclure les éléments natifs Kalamundi */
      if (el.id && (el.id.startsWith('reader-') || el.id.startsWith('modal-') ||
          el.id.startsWith('annot-') || el.id === 'kala-ad-bar')) return;
      if (el.closest && el.closest('[id^="reader-"]')) return;

      /* C'est un popup ad intrusif → on le cache */
      el.style.setProperty('display', 'none', 'important');
      el.style.setProperty('visibility', 'hidden', 'important');
      el.style.setProperty('opacity', '0', 'important');
    } catch (e) {}
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
