/* ============================================================
   author-dashboard.js — Tableau de bord auteur
   Kalamundi — La Plume du Monde
   ============================================================ */

import { protegerRoute, resetPassword, getUser } from './auth.js';
import { api } from './api.js';
import { formatNombre, formatMontant, formatDateCourt, toastSucces, toastErreur, toast } from './utils.js';

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
    rendreOeuvres(etat.oeuvres);
    remplirFormulaireProfil(profil);

    api.getRevenus(etat.userId).then(rev => {
      etat.revenus = rev || [];
      rendreRevenus(etat.revenus);
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
  const notesMoyennes = (stats.oeuvres || []).filter(o => o.note_moyenne).map(o => o.note_moyenne);
  const noteMoyenne = notesMoyennes.length
    ? (notesMoyennes.reduce((a, b) => a + b, 0) / notesMoyennes.length).toFixed(1)
    : '—';
  document.getElementById('stat-note').textContent =
    noteMoyenne !== '—' ? `⭐ ${noteMoyenne}` : '—';
  document.getElementById('stat-revenus').textContent =
    stats.revenus?.total ? formatMontant(stats.revenus.total) : '0,00 $';
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
  conteneur.innerHTML = oeuvres.map(o => `
    <div class="oeuvre-row" data-id="${o.id}">
      <div class="oeuvre-row__cover--placeholder">📖</div>
      <div class="oeuvre-row__info">
        <div class="oeuvre-row__titre">${o.titre || 'Sans titre'}</div>
        <div class="oeuvre-row__meta">
          <span class="badge badge--${o.statut === 'premium' ? 'premium' : 'gratuit'}">${o.statut === 'premium' ? 'Premium' : 'Gratuit'}</span>
          <span>👁 ${formatNombre(o.nb_lectures || 0)} lectures</span>
          ${o.note_moyenne ? `<span>⭐ ${o.note_moyenne}</span>` : ''}
          ${!o.visible ? '<span class="badge badge--warning">Masquée</span>' : ''}
        </div>
      </div>
      <div class="oeuvre-row__actions">
        <a href="/pages/work.html?id=${o.id}" class="btn btn--ghost btn--sm" title="Voir">👁</a>
        <button class="btn btn--outline btn--sm btn-supprimer"
          data-id="${o.id}" data-titre="${o.titre || 'Sans titre'}" title="Supprimer">🗑</button>
      </div>
    </div>`).join('');

  conteneur.querySelectorAll('.btn-supprimer').forEach(btn =>
    btn.addEventListener('click', () => ouvrirModalSupprimer(btn.dataset.id, btn.dataset.titre)));
}

/* ============================================================
   REVENUS
   ============================================================ */

function rendreRevenus(revenus) {
  const total   = revenus.reduce((s, r) => s + Number(r.montant || 0), 0);
  const attente = revenus.filter(r => r.statut === 'en_attente')
                         .reduce((s, r) => s + Number(r.montant || 0), 0);
  document.getElementById('rev-total').textContent   = formatMontant(total);
  document.getElementById('rev-attente').textContent = formatMontant(attente);

  const conteneur = document.getElementById('liste-revenus');
  if (!revenus.length) return;
  conteneur.innerHTML = `
    <div style="border:1px solid var(--border-color);border-radius:var(--border-radius-lg);overflow:hidden">
      ${revenus.map(r => `
        <div class="revenu-row">
          <span class="revenu-row__titre">${r.oeuvres?.titre || '—'}</span>
          <span class="revenu-row__date">${formatDateCourt(r.created_at)}</span>
          <span class="revenu-row__montant">+${formatMontant(r.montant)}</span>
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

  // Si l'URL contient ?tab=profil, ouvrir directement l'onglet profil
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab') === 'profil') {
    setTimeout(() => {
      document.querySelector('[data-tab="profil"]')?.click();
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
  } catch {
    toastErreur('Impossible de supprimer cette œuvre.');
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
