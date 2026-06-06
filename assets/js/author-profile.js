/* ============================================================
   author-profile.js — Édition du profil auteur
   Kalamundi — La Plume du Monde
   ============================================================ */

import { protegerRoute, deconnexion } from './auth.js';
import { api } from './api.js';
import { toastSucces, toastErreur, afficher, cacher } from './utils.js';

const GENRES = ['Roman', 'Poésie', 'Conte', 'Nouvelle', 'Essai', 'Théâtre', 'Biographie', 'BD / Manga'];

const PAYS = [
  'Afghanistan','Afrique du Sud','Albanie','Algérie','Allemagne','Angola','Arabie Saoudite',
  'Argentine','Australie','Autriche','Azerbaïdjan','Bahreïn','Bangladesh','Belgique','Bénin',
  'Bolivie','Botswana','Brésil','Burkina Faso','Burundi','Cambodge','Cameroun','Canada',
  'Cap-Vert','Chili','Chine','Colombie','Comores','Congo','Corée du Sud','Côte d\'Ivoire',
  'Cuba','Djibouti','Égypte','Émirats arabes unis','Équateur','Érythrée','Espagne',
  'Éthiopie','États-Unis','Finlande','France','Gabon','Gambie','Ghana','Guinée',
  'Guinée-Bissau','Guinée équatoriale','Haïti','Honduras','Hongrie','Inde','Indonésie',
  'Irak','Iran','Irlande','Israël','Italie','Jamaïque','Japon','Jordanie','Kazakhstan',
  'Kenya','Kirghizistan','Koweït','Liban','Libéria','Libye','Madagascar','Malawi',
  'Mali','Maroc','Maurice','Mauritanie','Mexique','Moldavie','Mongolie','Mozambique',
  'Namibie','Niger','Nigéria','Norvège','Nouvelle-Zélande','Ouganda','Pakistan',
  'Palestine','Pays-Bas','Pérou','Philippines','Pologne','Portugal','Qatar','République centrafricaine',
  'République démocratique du Congo','Roumanie','Royaume-Uni','Rwanda','Sénégal',
  'Sierra Leone','Somalie','Soudan','Soudan du Sud','Suède','Suisse','Tanzanie',
  'Tchad','Togo','Tunisie','Turkménistan','Turquie','Ukraine','Venezuela','Vietnam',
  'Yémen','Zambie','Zimbabwe',
];

/* ============================================================
   Init
   ============================================================ */

let profil = null;

(async () => {
  const session = await protegerRoute();
  if (!session) return;

  const userId = session.user?.id || session.id;

  try {
    profil = await api.getProfil(userId);
  } catch {
    toastErreur('Impossible de charger votre profil.');
    return;
  }

  remplirPays();
  remplirGenres(profil.genres || []);
  remplirFormulaire(profil);
  initAvatar(userId);
  initFormulaire(userId);
  initCompteurBio();
  initNavbar(profil);
  initNavbarMobile();
  initSupprimerCompte();
})();

/* ============================================================
   Sélecteur pays
   ============================================================ */

function remplirPays() {
  const sel = document.getElementById('champ-pays');
  PAYS.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    sel.appendChild(opt);
  });
}

/* ============================================================
   Checkboxes genres
   ============================================================ */

function remplirGenres(genresActifs) {
  const conteneur = document.getElementById('genres-checkboxes');
  conteneur.innerHTML = GENRES.map(g => {
    const id      = `genre-${g.toLowerCase().replace(/[^a-z]/g, '')}`;
    const checked = genresActifs.includes(g) ? 'checked' : '';
    return `
      <input type="checkbox" class="genre-checkbox" id="${id}" value="${g}" ${checked}>
      <label for="${id}">${g}</label>
    `;
  }).join('');
}

function getGenresCoches() {
  return [...document.querySelectorAll('.genre-checkbox:checked')].map(cb => cb.value);
}

/* ============================================================
   Remplir le formulaire
   ============================================================ */

function remplirFormulaire(p) {
  document.getElementById('champ-nom').value     = p.nom     || '';
  document.getElementById('champ-bio').value     = p.bio     || '';
  document.getElementById('champ-pays').value    = p.pays    || '';
  document.getElementById('champ-site').value    = p.site_web || '';
  document.getElementById('champ-twitter').value = p.twitter  || '';

  /* Compteur bio */
  document.getElementById('bio-compteur').textContent = (p.bio || '').length;

  /* Avatar preview */
  const avatarEl = document.getElementById('preview-avatar');
  if (p.photo_url) {
    avatarEl.outerHTML = `<img src="${p.photo_url}" id="preview-avatar" alt="Photo de profil" class="avatar avatar--xl">`;
  } else {
    avatarEl.textContent = (p.nom || '?').charAt(0).toUpperCase();
  }
}

/* ============================================================
   Compteur biographie
   ============================================================ */

function initCompteurBio() {
  document.getElementById('champ-bio')?.addEventListener('input', e => {
    document.getElementById('bio-compteur').textContent = e.target.value.length;
  });
}

/* ============================================================
   Upload avatar
   ============================================================ */

function initAvatar(userId) {
  document.getElementById('input-avatar')?.addEventListener('change', async e => {
    const fichier = e.target.files[0];
    if (!fichier) return;

    if (fichier.size > 2 * 1024 * 1024) {
      toastErreur('Image trop lourde. Maximum 2 Mo.');
      return;
    }

    /* Aperçu local immédiat */
    const reader = new FileReader();
    reader.onload = ev => {
      const el = document.getElementById('preview-avatar');
      if (el.tagName === 'DIV') {
        el.outerHTML = `<img src="${ev.target.result}" id="preview-avatar" alt="Aperçu" class="avatar avatar--xl">`;
      } else {
        el.src = ev.target.result;
      }
    };
    reader.readAsDataURL(fichier);

    /* Upload Supabase */
    try {
      await api.updateAvatar(userId, fichier);
      toastSucces('Photo mise à jour !');
    } catch {
      toastErreur('Erreur lors de l\'upload. Réessayez.');
    }
  });
}

/* ============================================================
   Soumission formulaire
   ============================================================ */

function initFormulaire(userId) {
  document.getElementById('profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();

    const btn = document.getElementById('btn-sauvegarder');
    btn.classList.add('btn--loading');
    btn.disabled = true;

    cacher(document.getElementById('alert-succes'));
    cacher(document.getElementById('alert-erreur'));

    const nom     = document.getElementById('champ-nom').value.trim();
    const bio     = document.getElementById('champ-bio').value.trim();
    const pays    = document.getElementById('champ-pays').value;
    const site    = document.getElementById('champ-site').value.trim();
    const twitter = document.getElementById('champ-twitter').value.trim();
    const genres  = getGenresCoches();

    if (!nom) {
      afficherErreur('Le nom est obligatoire.');
      btn.classList.remove('btn--loading');
      btn.disabled = false;
      return;
    }

    try {
      await api.updateProfil(userId, { nom, bio, pays, site_web: site, twitter, genres });
      const alertSucces = document.getElementById('alert-succes');
      alertSucces.textContent = 'Profil mis à jour avec succès !';
      afficher(alertSucces);
      setTimeout(() => cacher(alertSucces), 4000);
      toastSucces('Profil sauvegardé !');
    } catch {
      afficherErreur('Impossible de sauvegarder. Réessayez.');
    } finally {
      btn.classList.remove('btn--loading');
      btn.disabled = false;
    }
  });
}

function afficherErreur(msg) {
  const el = document.getElementById('alert-erreur');
  el.textContent = msg;
  afficher(el);
}

/* ============================================================
   Navbar
   ============================================================ */

function initNavbar(p) {
  const actions = document.getElementById('navbar-actions');
  if (!actions) return;
  actions.innerHTML = `
    <a href="/pages/author-dashboard.html" class="btn btn--ghost btn--sm" style="color:rgba(255,255,255,0.85)">Dashboard</a>
  `;
}

function initNavbarMobile() {
  const toggle = document.getElementById('navbar-toggle');
  const menu   = document.getElementById('navbar-nav');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
}

/* ============================================================
   Supprimer le compte
   ============================================================ */

function initSupprimerCompte() {
  document.getElementById('btn-supprimer-compte')?.addEventListener('click', () => {
    const confirmation = prompt('Tapez "SUPPRIMER" pour confirmer la suppression de votre compte :');
    if (confirmation === 'SUPPRIMER') {
      toastErreur('Fonctionnalité disponible prochainement. Contactez le support.');
    }
  });
}
