/* ============================================================
   ads.js — Intégration Monetag (In-Page Push)
   Kalamundi — La Plume du Monde
   ============================================================
   CONFIGURATION :
     1. Créer un compte sur https://publishers.monetag.com
     2. Ajouter le site kalamundi.pages.dev
     3. Remplacer MONETAG_ZONE_ID ci-dessous par votre Zone ID
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     CONFIG — À personnaliser après inscription Monetag
  ────────────────────────────────────────────────────────── */
  var MONETAG_ZONE_ID = '11110665';
  var MONETAG_SRC     = 'https://nap5k.com/tag.min.js';
  var AD_DELAY_MS     = 3000; // délai avant chargement (3 s)

  /* ──────────────────────────────────────────────────────────
     Charge le script Monetag (In-Page Push)
  ────────────────────────────────────────────────────────── */
  function loadMonetag() {
    if (window._kalaMonetag) return;
    window._kalaMonetag = true;

    var s = document.createElement('script');
    s.dataset.zone = MONETAG_ZONE_ID;
    s.src          = MONETAG_SRC;
    s.async        = true;
    document.body.appendChild(s);
  }

  /* ──────────────────────────────────────────────────────────
     Bannière basse discrète (pour utilisateurs sans abonnement)
  ────────────────────────────────────────────────────────── */
  function injecterBandeau() {
    if (document.getElementById('kala-ad-bar')) return;

    var bar = document.createElement('div');
    bar.id = 'kala-ad-bar';
    bar.setAttribute('aria-label', 'Espace publicitaire');
    bar.style.cssText = [
      'position:fixed',
      'bottom:0',
      'left:0',
      'right:0',
      'height:54px',
      'z-index:9998',
      'background:var(--surface, #fff)',
      'border-top:1px solid var(--border, #e2e8f0)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'overflow:hidden',
    ].join(';');

    var fermer = document.createElement('button');
    fermer.innerHTML = '✕';
    fermer.setAttribute('aria-label', 'Fermer la publicité');
    fermer.style.cssText = [
      'position:absolute',
      'right:8px',
      'top:50%',
      'transform:translateY(-50%)',
      'background:none',
      'border:none',
      'color:var(--text-light, #94a3b8)',
      'font-size:13px',
      'cursor:pointer',
      'padding:6px',
      'line-height:1',
    ].join(';');
    fermer.onclick = function () { bar.remove(); };

    var label = document.createElement('span');
    label.textContent = 'Publicité';
    label.style.cssText = 'font-size:10px;color:var(--text-light,#94a3b8);position:absolute;left:8px;top:4px';

    bar.appendChild(label);
    bar.appendChild(fermer);
    document.body.appendChild(bar);

    /* décaler le contenu pour éviter que le bandeau ne cache le footer */
    document.documentElement.style.paddingBottom = '54px';
    fermer.addEventListener('click', function () {
      document.documentElement.style.paddingBottom = '';
    }, { once: true });
  }

  /* ──────────────────────────────────────────────────────────
     Point d'entrée public — appelé depuis app.js
     planAbonne : true → pas de bandeau (expérience épurée)
                  false/undefined → bandeau + In-Page Push
  ────────────────────────────────────────────────────────── */
  window.initAds = function (planAbonne) {
    if (MONETAG_ZONE_ID === 'VOTRE_ZONE_ID') return; // pubs non configurées

    setTimeout(function () {
      loadMonetag();
      if (!planAbonne) {
        injecterBandeau();
      }
    }, AD_DELAY_MS);
  };

})();
