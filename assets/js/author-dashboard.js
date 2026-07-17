/* ============================================================
   author-dashboard.js — Tableau de bord auteur
   Kalamundi — La Plume du Monde
   ============================================================ */

import { protegerRoute, resetPassword, getUser } from './auth.js';
import { api } from './api.js';
import { formatNombre, formatMontant, formatDateCourt, toastSucces, toastErreur, toast, truncate } from './utils.js';
import { normaliserUrlImage } from './cover-utils.js';

/* ============================================================
   CONSTANTES
   ============================================================ */

const LANGUES_DISPONIBLES = [
  { code: 'fr',  label: '🇫🇷 Français'   },
  { code: 'en',  label: '🇬🇧 Anglais'    },
  { code: 'es',  label: '🇪🇸 Espagnol'   },
  { code: 'pt',  label: '🇧🇷 Portugais'  },
  { code: 'ar',  label: '🇸🇦 Arabe'      },
  { code: 'sw',  label: '🌍 Swahili'     },
  { code: 'ha',  label: '🌍 Haoussa'     },
  { code: 'yo',  label: '🌍 Yoruba'      },
  { code: 'ln',  label: '🌍 Lingala'     },
  { code: 'de',  label: '🇩🇪 Allemand'   },
  { code: 'zh',  label: '🇨🇳 Chinois'    },
];

const GENRES_LITTERAIRES = [
  { value: 'roman',             label: 'Roman'             },
  { value: 'nouvelle',          label: 'Nouvelle'          },
  { value: 'poesie',            label: 'Poésie'            },
  { value: 'conte',             label: 'Conte'             },
  { value: 'thriller',          label: 'Thriller'          },
  { value: 'romance',           label: 'Romance'           },
  { value: 'sf_fantasy',        label: 'SF / Fantasy'      },
  { value: 'essai',             label: 'Essai'             },
  { value: 'autobiographie',    label: 'Autobiographie'    },
  { value: 'temoignage',        label: 'Témoignage'        },
  { value: 'philosophie',       label: 'Philosophie'       },
  { value: 'histoire',          label: 'Récit historique'  },
  { value: 'jeunesse',          label: 'Jeunesse'          },
  { value: 'litterature_orale', label: 'Littérature orale' },
];

/* ============================================================
   ÉTAT
   ============================================================ */

const etat = {
  profil:           null,
  userId:           null,
  oeuvres:          [],
  revenus:          [],
  oeuvreASupprimer: null,
  photoFichier:     null,
};

/* ============================================================
   INIT
   ============================================================ */

(async () => {
  const session = await protegerRoute();
  if (!session) return;

  etat.userId = session.user?.id || session.id;

  try {
    const [profil, stats] = await Promise.all([
      api.getProfil(etat.userId),
      api.getStatsAuteur(etat.userId),
    ]);
    etat.profil  = profil;
    etat.oeuvres = stats.oeuvres || [];

    rendreHeader(profil);
    rendreStats(stats);
    rendreReportingKdp(stats.reporting || {});
    rendrePilotageAuteur(stats, profil);
    rendreOeuvres(etat.oeuvres);
    remplirFormulaireProfil(profil);

    api.getRevenus(etat.userId).then(rev => {
      etat.revenus = rev || [];
      rendreRevenus(etat.revenus);
      rendrePilotageAuteur(stats, profil);
    }).catch(() => {});

  } catch (err) {
    toastErreur('Impossible de charger votre tableau de bord.');
    console.error(err);
  }

  initTabs();
  initNavbar(etat.profil);
  initModal();
  initNavbarMobile();
  initFormulaireProfil();
  construireCheckboxes();
})();

/* ============================================================
   NAVBAR
   ============================================================ */

function initNavbar(profil) {
  const actions = document.getElementById('navbar-actions');
  if (!actions) return;
  const initiales = (profil?.nom || '?').charAt(0).toUpperCase();
  actions.innerHTML = `
    <a href="/pages/author-dashboard.html?tab=profil" class="btn btn--ghost btn--sm"
      style="color:rgba(255,255,255,0.85)">
      <span style="width:28px;height:28px;border-radius:50%;background:var(--color-accent);
        display:inline-flex;align-items:center;justify-content:center;
        font-weight:bold;font-size:12px;color:#1a1a1a">${initiales}</span>
    </a>
  `;
}

/* ============================================================
   EN-TÊTE
   ============================================================ */

function rendreHeader(profil) {
  if (!profil) return;
  const nomComplet = [profil.prenom, profil.nom].filter(Boolean).join(' ') || 'Auteur';
  const role = profil.role === 'auteur' ? '✍️ Auteur'
    : profil.role === 'admin' ? '🛡️ Admin' : '📖 Lecteur';

  document.getElementById('nom-auteur').textContent  = nomComplet;
  document.getElementById('role-auteur').textContent = role
    + (profil.badge_fondateur ? ' · 🌟 Auteur fondateur' : '')
    + (profil.ville ? ` · 📍 ${profil.ville}${profil.pays ? ', ' + profil.pays : ''}` : profil.pays ? ` · 📍 ${profil.pays}` : '');

  const avatarEl = document.getElementById('avatar-auteur');
  if (profil.photo_url) {
    avatarEl.outerHTML = `<img src="${profil.photo_url}" alt="${nomComplet}" class="avatar avatar--lg">`;
  } else {
    avatarEl.textContent = nomComplet.charAt(0).toUpperCase();
  }

  // Lien profil public
  document.getElementById('lien-profil-public')?.setAttribute(
    'href', `/pages/author-profile.html?id=${etat.userId}`
  );
}

/* ============================================================
   STATISTIQUES
   ============================================================ */

function rendreStats(stats) {
  document.getElementById('stat-nb-oeuvres').textContent = stats.nbOeuvres ?? '0';
  document.getElementById('stat-lectures').textContent   = formatNombre(stats.totalLectures ?? 0);
  const oeuvres = stats.oeuvres || [];
  const premium = oeuvres.filter(o => o.statut === 'premium').length;
  const moyenneLectures = oeuvres.length ? Math.round((stats.totalLectures || 0) / oeuvres.length) : 0;
  const notesMoyennes = (stats.oeuvres || []).filter(o => o.note_moyenne).map(o => o.note_moyenne);
  const noteMoyenne = notesMoyennes.length
    ? (notesMoyennes.reduce((a, b) => a + b, 0) / notesMoyennes.length).toFixed(1)
    : '—';
  document.getElementById('stat-note').textContent =
    noteMoyenne !== '—' ? `⭐ ${noteMoyenne}` : '—';
  document.getElementById('stat-revenus').textContent =
    stats.revenus?.total ? formatMontant(stats.revenus.total, 'XAF') : formatMontant(0, 'XAF');
  document.getElementById('stat-premium').textContent = `${premium} premium`;
  document.getElementById('stat-moyenne-lectures').textContent = `${formatNombre(moyenneLectures)} / œuvre`;
  document.getElementById('stat-note-detail').textContent = `${notesMoyennes.length} œuvre${notesMoyennes.length > 1 ? 's' : ''} notée${notesMoyennes.length > 1 ? 's' : ''}`;
  document.getElementById('stat-revenus-attente').textContent = `${formatMontant(stats.revenus?.en_attente || 0, 'XAF')} en attente`;
}

function rendreReportingKdp(reporting = {}) {
  setText('kdp-ventes', formatNombre(reporting.ventes || 0));
  setText('kdp-pages', formatNombre(reporting.pagesSuivies || 0));
  setText('kdp-royalties', reporting.selectActif ? '70%' : '50%');
  setText('kdp-royalties-detail', reporting.selectActif
    ? 'Kalamundi Select actif'
    : reporting.selectEligible
      ? 'Select possible plus tard, non activé'
      : 'Standard auteur indépendant');

  const attente = Number(reporting.revenusAttente || 0);
  const seuil = Number(reporting.seuilPayout || 5000);
  const reste = Number(reporting.resteAvantPayout || Math.max(0, seuil - attente));
  setText('kdp-payout', attente >= seuil ? 'Prêt' : formatMontant(reste, 'XAF'));
  setText('kdp-payout-detail', attente >= seuil
    ? `${formatMontant(attente, 'XAF')} en attente de payout`
    : `Avant seuil ${formatMontant(seuil, 'XAF')}`);
}

function rendrePilotageAuteur(stats, profil) {
  const oeuvres = [...(stats.oeuvres || [])];
  const revenus = etat.revenus || [];
  const top = oeuvres.sort((a, b) => Number(b.nb_lectures || 0) - Number(a.nb_lectures || 0))[0];
  const totalLectures = Number(stats.totalLectures || 0);
  const premium = oeuvres.filter(o => o.statut === 'premium');
  const profilScore = calculerScoreProfil(profil);
  const actions = construireActionsAuteur(oeuvres, profil, revenus);

  const focusTitle = !oeuvres.length
    ? 'Publier une première œuvre'
    : premium.length === 0 && totalLectures >= 50
      ? 'Transformer une œuvre suivie en offre premium'
      : top
        ? `Pousser “${truncate(top.titre || 'Sans titre', 46)}”`
        : 'Développer ton catalogue';

  const focusText = !oeuvres.length
    ? 'Commence avec une œuvre courte, découpée en chapitres. Le lecteur doit comprendre vite ton univers.'
    : premium.length === 0 && totalLectures >= 50
      ? 'Tu as déjà des lectures. Garde les premiers chapitres gratuits, puis fais payer au moment où l’histoire devient forte.'
      : top
        ? `${formatNombre(top.nb_lectures || 0)} lectures. Mets cette œuvre en avant, ajoute une bonne couverture et publie le prochain chapitre régulièrement.`
        : 'Ajoute des chapitres, améliore tes couvertures et garde un rythme de publication visible.';

  setText('author-focus-title', focusTitle);
  setText('author-focus-text', focusText);
  const cta = document.getElementById('author-focus-cta');
  if (cta) {
    cta.textContent = !oeuvres.length ? 'Publier maintenant' : 'Continuer à publier';
    cta.href = '/pages/publish.html';
  }

  const scoreEl = document.getElementById('author-profile-score');
  if (scoreEl) {
    scoreEl.textContent = `${profilScore}%`;
    scoreEl.style.setProperty('--score', profilScore);
  }
  setText('author-score-label', profilScore >= 80 ? 'Profil solide' : profilScore >= 50 ? 'Profil presque prêt' : 'Profil à renforcer');
  setText('author-score-hint', profilScore >= 80
    ? 'Ton profil donne déjà de bons signaux de confiance.'
    : 'Ajoute photo, bio, pays, genres et réseaux pour rassurer les lecteurs.');

  const actionsEl = document.getElementById('author-next-actions');
  if (actionsEl) {
    actionsEl.innerHTML = actions.map(a => `
      <a class="author-action" href="${a.href}">
        <span class="author-action__icon">${a.icon}</span>
        <span>${escapeHtml(a.label)}</span>
      </a>`).join('');
  }

  setText('author-best-work', top ? `${top.titre || 'Sans titre'} · ${formatNombre(top.nb_lectures || 0)} lectures` : 'Aucune œuvre publiée');
  setText('author-market-note', premium.length
    ? `${premium.length} œuvre${premium.length > 1 ? 's' : ''} premium`
    : totalLectures >= 50 ? 'Prêt pour un test premium' : 'Construire l’audience');
  const attente = revenus.filter(r => r.statut === 'en_attente').reduce((s, r) => s + Number(r.montant || 0), 0);
  setText('author-revenue-pending', formatMontant(attente, 'XAF'));

  rendreTopOeuvres(oeuvres.slice(0, 3));
}

function calculerScoreProfil(profil) {
  if (!profil) return 0;
  const champs = [
    profil.photo_url, profil.bio, profil.pays, profil.ville, profil.niveau_auteur,
    profil.langues_parlees?.length, profil.genres_ecrits?.length, profil.genres_preferes?.length,
    profil.site_web || Object.values(profil.reseaux_sociaux || {}).some(Boolean),
  ];
  return Math.round((champs.filter(Boolean).length / champs.length) * 100);
}

function construireActionsAuteur(oeuvres, profil, revenus) {
  const actions = [];
  if (!oeuvres.length) actions.push({ icon: '✍️', label: 'Publier ta première œuvre', href: '/pages/publish.html' });
  if (!profil?.photo_url || !profil?.bio) actions.push({ icon: '👤', label: 'Compléter ton profil public', href: '/pages/author-dashboard.html?tab=profil' });
  if (oeuvres.length && !oeuvres.some(o => o.statut === 'premium')) actions.push({ icon: '⭐', label: 'Tester une œuvre premium', href: '/pages/publish.html' });
  if (oeuvres.some(o => !o.couverture_url)) actions.push({ icon: '🖼', label: 'Ajouter de vraies couvertures', href: '/pages/publish.html' });
  if (revenus.some(r => r.statut === 'en_attente')) actions.push({ icon: '💰', label: 'Suivre les revenus en attente', href: '/pages/author-dashboard.html?tab=revenus' });
  if (!actions.length) actions.push({ icon: '📚', label: 'Publier le prochain chapitre', href: '/pages/publish.html' });
  return actions.slice(0, 4);
}

function rendreTopOeuvres(oeuvres) {
  const el = document.getElementById('author-top-list');
  if (!el) return;
  if (!oeuvres.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `
    <div class="author-top-list__title">Top œuvres</div>
    <div class="author-top-list__items">
      ${oeuvres.map((o, i) => `
        <a class="author-top-item" href="/pages/work.html?id=${o.id}">
          <span class="author-top-item__rank">${i + 1}</span>
          <span class="author-top-item__title">${escapeHtml(o.titre || 'Sans titre')}</span>
          <span class="author-top-item__metric">${formatNombre(o.nb_lectures || 0)} lectures</span>
        </a>`).join('')}
    </div>`;
}

/* ============================================================
   LISTE DES ŒUVRES
   ============================================================ */

function rendreOeuvres(oeuvres) {
  const conteneur = document.getElementById('liste-oeuvres');
  if (!oeuvres.length) {
    conteneur.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✍️</div>
        <p class="empty-state__title">Aucune œuvre publiée</p>
        <p class="empty-state__text">Publiez votre première œuvre et touchez des lecteurs du monde entier.</p>
        <a href="/pages/publish.html" class="btn btn--primary" style="margin-top:var(--spacing-md)">Publier une œuvre</a>
      </div>`;
    return;
  }
  conteneur.innerHTML = oeuvres.map(o => {
    const coverUrl = normaliserUrlImage(o.couverture_url);
    return `
    <div class="oeuvre-row" data-id="${o.id}">
      ${coverUrl
        ? `<img src="${escapeHtml(coverUrl)}" alt="" class="oeuvre-row__cover" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=&quot;oeuvre-row__cover--placeholder&quot;>📖</div>'">`
        : '<div class="oeuvre-row__cover--placeholder">📖</div>'}
      <div class="oeuvre-row__info">
        <div class="oeuvre-row__titre">${escapeHtml(o.titre || 'Sans titre')}</div>
        <div class="oeuvre-row__meta">
          <span class="badge badge--${o.statut === 'premium' ? 'premium' : 'gratuit'}">${o.statut === 'premium' ? 'Premium' : 'Gratuit'}</span>
          ${o.genre ? `<span>${escapeHtml(o.genre)}</span>` : ''}
          <span>👁 ${formatNombre(o.nb_lectures || 0)} lectures</span>
          ${o.note_moyenne ? `<span>⭐ ${o.note_moyenne}</span>` : ''}
          ${o.statut === 'premium' && o.prix ? `<span>${formatMontant(o.prix, 'XAF')}</span>` : ''}
          ${!o.visible ? '<span class="badge badge--warning">Masquée</span>' : ''}
        </div>
      </div>
      <div class="oeuvre-row__actions">
        <a href="/pages/work.html?id=${o.id}" class="btn btn--ghost btn--sm" title="Voir">👁</a>
        <button class="btn btn--outline btn--sm btn-supprimer"
          data-id="${o.id}" data-titre="${o.titre || 'Sans titre'}" title="Supprimer">🗑</button>
      </div>
    </div>`;
  }).join('');

  conteneur.querySelectorAll('.btn-supprimer').forEach(btn =>
    btn.addEventListener('click', () => ouvrirModalSupprimer(btn.dataset.id, btn.dataset.titre)));
}

function setText(id, valeur) {
  const el = document.getElementById(id);
  if (el) el.textContent = valeur;
}

function escapeHtml(valeur = '') {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================
   REVENUS
   ============================================================ */

function rendreRevenus(revenus) {
  const total   = revenus.reduce((s, r) => s + Number(r.montant || 0), 0);
  const attente = revenus.filter(r => r.statut === 'en_attente')
                         .reduce((s, r) => s + Number(r.montant || 0), 0);
  document.getElementById('rev-total').textContent   = formatMontant(total, 'XAF');
  document.getElementById('rev-attente').textContent = formatMontant(attente, 'XAF');

  const conteneur = document.getElementById('liste-revenus');
  if (!revenus.length) return;
  conteneur.innerHTML = `
    <div style="border:1px solid var(--border-color);border-radius:var(--border-radius-lg);overflow:hidden">
      ${revenus.map(r => `
        <div class="revenu-row">
          <span class="revenu-row__titre">${r.oeuvres?.titre || '—'}</span>
          <span class="revenu-row__date">${formatDateCourt(r.created_at)}</span>
          <span class="revenu-row__montant">+${formatMontant(r.montant, 'XAF')}</span>
          <span class="revenu-row__statut badge badge--${r.statut === 'paye' ? 'success' : 'warning'}">
            ${r.statut === 'paye' ? 'Payé' : 'En attente'}
          </span>
        </div>`).join('')}
    </div>`;
}

/* ============================================================
   FORMULAIRE PROFIL — Remplissage
   ============================================================ */

function remplirFormulaireProfil(profil) {
  if (!profil) return;

  _setVal('p-prenom',         profil.prenom         || '');
  _setVal('p-nom',            profil.nom             || '');
  _setVal('p-telephone',      profil.telephone       || '');
  _setVal('p-date-naissance', profil.date_naissance  || '');
  _setVal('p-genre',          profil.genre_identite  || '');
  _setVal('p-langue',         profil.langue_preferee || 'fr');
  _setVal('p-pays',           profil.pays            || '');
  _setVal('p-ville',          profil.ville           || '');
  _setVal('p-bio',            profil.bio             || '');
  _setVal('p-niveau',         profil.niveau_auteur   || '');
  _setVal('p-site',           profil.site_web        || '');
  _setVal('p-email',          profil.email           || '');

  // Réseaux sociaux (JSONB)
  const rs = profil.reseaux_sociaux || {};
  _setVal('p-facebook',  rs.facebook  || '');
  _setVal('p-instagram', rs.instagram || '');
  _setVal('p-twitter',   rs.twitter   || '');
  _setVal('p-tiktok',    rs.tiktok    || '');
  _setVal('p-youtube',   rs.youtube   || '');

  // Photo
  const avatarPrev = document.getElementById('avatar-preview');
  if (profil.photo_url && avatarPrev) {
    avatarPrev.outerHTML = `<img src="${profil.photo_url}" id="avatar-preview"
      class="avatar avatar--xl" alt="Photo de profil" />`;
  } else if (avatarPrev) {
    avatarPrev.textContent = (profil.nom || '?').charAt(0).toUpperCase();
  }

  // Compteur bio
  _mettreAJourCompteurBio();

  // Checkboxes — langues parlées
  _cocher('langues-parlees-grid', profil.langues_parlees || []);
  _cocher('genres-ecrits-grid',   profil.genres_ecrits   || []);
  _cocher('genres-preferes-grid', profil.genres_preferes || []);
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function _cocher(gridId, valeurs) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.checked = valeurs.includes(cb.value);
  });
}

/* ============================================================
   FORMULAIRE PROFIL — Checkboxes dynamiques
   ============================================================ */

function construireCheckboxes() {
  _construireGrid('langues-parlees-grid', LANGUES_DISPONIBLES, 'langues', v => v.code,   v => v.label);
  _construireGrid('genres-ecrits-grid',   GENRES_LITTERAIRES,  'genres_e', v => v.value, v => v.label);
  _construireGrid('genres-preferes-grid', GENRES_LITTERAIRES,  'genres_p', v => v.value, v => v.label);
}

function _construireGrid(gridId, items, prefix, valFn, labelFn) {
  const grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = items.map(item => `
    <label class="checkbox-option">
      <input type="checkbox" name="${prefix}" value="${valFn(item)}" />
      <span>${labelFn(item)}</span>
    </label>`).join('');
}

/* ============================================================
   FORMULAIRE PROFIL — Compteur bio
   ============================================================ */

function _mettreAJourCompteurBio() {
  const bio   = document.getElementById('p-bio');
  const count = document.getElementById('bio-counter');
  if (bio && count) count.textContent = `${bio.value.length} / 1000 caractères`;
}

/* ============================================================
   FORMULAIRE PROFIL — Sauvegarde
   ============================================================ */

function initFormulaireProfil() {
  // Compteur bio
  document.getElementById('p-bio')?.addEventListener('input', _mettreAJourCompteurBio);

  // Upload photo
  document.getElementById('photo-upload')?.addEventListener('change', async (e) => {
    const fichier = e.target.files[0];
    if (!fichier) return;
    if (fichier.size > 2 * 1024 * 1024) {
      toastErreur('La photo ne doit pas dépasser 2 Mo.');
      return;
    }
    etat.photoFichier = fichier;
    // Aperçu local immédiat
    const url = URL.createObjectURL(fichier);
    const prev = document.getElementById('avatar-preview');
    if (prev) {
      prev.outerHTML = `<img src="${url}" id="avatar-preview"
        class="avatar avatar--xl" alt="Aperçu photo" />`;
    }
    toast('Photo sélectionnée — sauvegarde en cours…', 'info');
    try {
      const urlDistante = await api.updateAvatar(etat.userId, fichier);
      etat.profil.photo_url = urlDistante;
      toastSucces('Photo mise à jour ✓');
    } catch (err) {
      toastErreur('Impossible de sauvegarder la photo.');
    }
  });

  // Boutons sauvegarder (haut et bas)
  const sauver = async () => {
    const btn = document.getElementById('btn-sauver-profil');
    const btnBas = document.getElementById('btn-sauver-profil-bas');
    [btn, btnBas].forEach(b => { if (b) { b.disabled = true; b.textContent = 'Sauvegarde…'; } });

    try {
      const champs = _lireFormulaire();
      await api.updateProfil(etat.userId, champs);

      // Mise à jour locale de l'état
      etat.profil = { ...etat.profil, ...champs };
      rendreHeader(etat.profil);

      const alert = document.getElementById('profil-saved-alert');
      if (alert) {
        alert.classList.remove('hidden');
        setTimeout(() => alert.classList.add('hidden'), 4000);
      }
      toastSucces('Profil sauvegardé ✓');

    } catch (err) {
      console.error(err);
      toastErreur(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      [btn, btnBas].forEach(b => {
        if (b) { b.disabled = false; b.textContent = b.id === 'btn-sauver-profil' ? '💾 Enregistrer' : '💾 Enregistrer les modifications'; }
      });
    }
  };

  document.getElementById('btn-sauver-profil')?.addEventListener('click', sauver);
  document.getElementById('btn-sauver-profil-bas')?.addEventListener('click', sauver);

  // Changer mot de passe
  document.getElementById('btn-changer-mdp')?.addEventListener('click', async () => {
    const email = etat.profil?.email;
    if (!email) return;
    try {
      await resetPassword(email);
      toast(`Email de réinitialisation envoyé à ${email}`, 'success');
    } catch (err) {
      toastErreur(err.message);
    }
  });

  // Si l'URL contient ?tab=..., ouvrir directement l'onglet demandé
  const params = new URLSearchParams(window.location.search);
  const tab = params.get('tab');
  if (tab) {
    setTimeout(() => {
      document.querySelector(`[data-tab="${tab}"]`)?.click();
    }, 300);
  }
}

/* Lire tous les champs du formulaire profil */
function _lireFormulaire() {
  const g = id => (document.getElementById(id)?.value || '').trim();

  const languesParlees = Array.from(
    document.querySelectorAll('#langues-parlees-grid input:checked')
  ).map(cb => cb.value);

  const genresEcrits = Array.from(
    document.querySelectorAll('#genres-ecrits-grid input:checked')
  ).map(cb => cb.value);

  const genresPreferes = Array.from(
    document.querySelectorAll('#genres-preferes-grid input:checked')
  ).map(cb => cb.value);

  return {
    prenom:           g('p-prenom')    || null,
    nom:              g('p-nom')       || etat.profil?.nom || 'Utilisateur',
    telephone:        g('p-telephone') || null,
    date_naissance:   g('p-date-naissance') || null,
    genre_identite:   g('p-genre')     || null,
    langue_preferee:  g('p-langue')    || 'fr',
    pays:             g('p-pays')      || null,
    ville:            g('p-ville')     || null,
    bio:              g('p-bio')       || null,
    niveau_auteur:    g('p-niveau')    || null,
    site_web:         g('p-site')      || null,
    reseaux_sociaux: {
      facebook:  g('p-facebook')  || null,
      instagram: g('p-instagram') || null,
      twitter:   g('p-twitter')   || null,
      tiktok:    g('p-tiktok')    || null,
      youtube:   g('p-youtube')   || null,
    },
    langues_parlees:  languesParlees,
    genres_ecrits:    genresEcrits,
    genres_preferes:  genresPreferes,
  };
}

/* ============================================================
   TABS
   ============================================================ */

function initTabs() {
  document.querySelectorAll('.dashboard-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.dashboard-tabs .tab').forEach(t => t.classList.remove('tab--active'));
      document.querySelectorAll('.dashboard-panel').forEach(p => p.classList.remove('is-active'));
      tab.classList.add('tab--active');
      document.getElementById(`panel-${tab.dataset.tab}`)?.classList.add('is-active');
    });
  });
}

/* ============================================================
   MODAL SUPPRESSION
   ============================================================ */

function initModal() {
  document.getElementById('modal-close')?.addEventListener('click', fermerModal);
  document.getElementById('btn-annuler-suppr')?.addEventListener('click', fermerModal);
  document.getElementById('btn-confirmer-suppr')?.addEventListener('click', confirmerSuppression);
  document.getElementById('modal-supprimer')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) fermerModal();
  });
}

function ouvrirModalSupprimer(id, titre) {
  etat.oeuvreASupprimer = id;
  document.getElementById('modal-titre-oeuvre').textContent = titre;
  document.getElementById('modal-supprimer').classList.add('is-open');
}

function fermerModal() {
  etat.oeuvreASupprimer = null;
  document.getElementById('modal-supprimer').classList.remove('is-open');
}

async function confirmerSuppression() {
  if (!etat.oeuvreASupprimer) return;
  const btn = document.getElementById('btn-confirmer-suppr');
  btn.classList.add('btn--loading');
  btn.disabled = true;
  try {
    await api.supprimerOeuvre(etat.oeuvreASupprimer);
    etat.oeuvres = etat.oeuvres.filter(o => o.id !== etat.oeuvreASupprimer);
    rendreOeuvres(etat.oeuvres);
    toastSucces('Œuvre supprimée.');
    fermerModal();
  } catch (err) {
    console.error('Erreur suppression œuvre :', err);
    toastErreur(err.message || 'Impossible de supprimer cette œuvre.');
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
}

/* ============================================================
   HAMBURGER MOBILE
   ============================================================ */

function initNavbarMobile() {
  const toggle = document.getElementById('navbar-toggle');
  const menu   = document.getElementById('navbar-nav');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
}
