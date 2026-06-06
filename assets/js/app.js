/* ============================================================
   app.js — Page d'accueil publique (index.html)
   Kalamundi — La Plume du Monde
   ============================================================ */

import { getSession } from './auth.js';
import { api } from './api.js';

/* ============================================================
   Init
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  enregistrerSW();
  const session = await initNavbar();
  await Promise.all([
    chargerVedettes(),
    chargerNouveautes(),
  ]);
  initHamburger();
  /* Pubs Monetag — chargées après le contenu, respecte les abonnés */
  if (window.initAds) {
    const abonne = session?.user?.user_metadata?.plan === 'premium';
    window.initAds(abonne);
  }
});

/* ============================================================
   Service Worker
   ============================================================ */

function enregistrerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js')
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const nouveau = reg.installing;
        nouveau?.addEventListener('statechange', () => {
          if (nouveau.state === 'installed' && navigator.serviceWorker.controller) {
            afficherToast('Mise à jour disponible — rechargez la page.', 'info');
          }
        });
      });
    })
    .catch(() => { /* SW non disponible en dev local — ignoré */ });
}

/* ============================================================
   Navbar — état connexion
   ============================================================ */

async function initNavbar() {
  const session = await getSession();
  /* retourne la session pour que DOMContentLoaded puisse l'utiliser */
  const navbarActions = document.getElementById('navbar-actions');
  const heroActions   = document.getElementById('hero-actions');
  const heroStats     = document.getElementById('hero-stats');

  if (session) {
    navbarActions.innerHTML = `
      <a href="/pages/library.html" class="btn btn--outline btn--sm" style="color:white;border-color:rgba(255,255,255,0.5)">Ma bibliothèque</a>
      <a href="/pages/publish.html" class="btn btn--accent btn--sm">Publier</a>
    `;
    heroActions.innerHTML = `
      <a href="/pages/library.html" class="btn btn--accent btn--lg">Découvrir les œuvres</a>
      <a href="/pages/publish.html" class="btn btn--outline btn--lg" style="color:white;border-color:rgba(255,255,255,0.6)">Publier une œuvre</a>
    `;
  } else {
    navbarActions.innerHTML = `
      <a href="/pages/login.html" class="btn btn--ghost btn--sm" style="color:rgba(255,255,255,0.85)">Connexion</a>
      <a href="/pages/login.html?mode=inscription" class="btn btn--accent btn--sm">S'inscrire</a>
    `;
    heroActions.innerHTML = `
      <a href="/pages/library.html" class="btn btn--accent btn--lg">Découvrir gratuitement</a>
      <a href="/pages/login.html?mode=inscription" class="btn btn--outline btn--lg" style="color:white;border-color:rgba(255,255,255,0.6)">Devenir auteur</a>
    `;
  }

  heroStats.innerHTML = `
    <div class="hero__stat"><span class="hero__stat-value" id="stat-oeuvres">—</span><span class="hero__stat-label">œuvres</span></div>
    <div class="hero__stat"><span class="hero__stat-value" id="stat-lectures">—</span><span class="hero__stat-label">lectures</span></div>
    <div class="hero__stat"><span class="hero__stat-value">50+</span><span class="hero__stat-label">langues</span></div>
  `;

  chargerStats();
  return session;
}

/* ============================================================
   Stats globales (compteurs hero)
   ============================================================ */

async function chargerStats() {
  try {
    const { total } = await api.getOeuvres({ limit: 1 });
    const el = document.getElementById('stat-oeuvres');
    if (el) el.textContent = total > 999 ? Math.floor(total / 1000) + 'k+' : total || '0';
  } catch (_) { /* silencieux */ }
}

/* ============================================================
   Grille vedettes (les plus lues)
   ============================================================ */

async function chargerVedettes() {
  const grid = document.getElementById('grid-vedettes');
  try {
    const { data } = await api.getOeuvres({ limit: 6, tri: 'lectures' });
    if (!data?.length) {
      grid.innerHTML = videState('Aucune œuvre disponible pour l\'instant.');
      return;
    }
    grid.innerHTML = data.map(renderCard).join('');
  } catch (err) {
    grid.innerHTML = videState('Impossible de charger les œuvres.');
    console.error(err);
  }
}

/* ============================================================
   Grille nouveautés (les plus récentes, hors vedettes)
   ============================================================ */

async function chargerNouveautes() {
  const grid = document.getElementById('grid-nouveautes');
  try {
    const { data } = await api.getOeuvres({ limit: 8, tri: 'recent' });
    if (!data?.length) {
      grid.innerHTML = videState('Aucune nouveauté pour l\'instant.');
      return;
    }
    // Exclure celles déjà en vedette (nb_lectures élevé)
    const nouveautes = data.filter(o => o.nb_lectures < 1000).slice(0, 4);
    grid.innerHTML = nouveautes.length
      ? nouveautes.map(renderCard).join('')
      : videState('Toutes les œuvres sont déjà en vedette !');
  } catch (err) {
    grid.innerHTML = videState('Impossible de charger les nouveautés.');
    console.error(err);
  }
}

/* ============================================================
   Rendu carte œuvre
   ============================================================ */

function renderCard(oeuvre) {
  const auteur  = oeuvre.profiles?.nom || 'Auteur inconnu';
  const genre   = oeuvre.genre || '';
  const titre   = oeuvre.titre || 'Sans titre';
  const note    = oeuvre.note_moyenne;
  const lectures = oeuvre.nb_lectures || 0;
  const statut  = oeuvre.statut || 'gratuit';

  const cover = oeuvre.couverture_url
    ? `<img src="${oeuvre.couverture_url}" alt="Couverture de ${titre}" class="card__cover" loading="lazy">`
    : `<div class="card__cover card__cover--placeholder">📖</div>`;

  const etoiles = note
    ? renderEtoiles(note)
    : '<span class="text-light" style="font-size:var(--font-size-xs)">Pas encore noté</span>';

  const badgeStatut = statut === 'premium'
    ? '<span class="badge badge--premium">Premium</span>'
    : '<span class="badge badge--gratuit">Gratuit</span>';

  return `
    <a href="/pages/work.html?id=${oeuvre.id}" class="card" style="text-decoration:none;color:inherit">
      ${cover}
      <div class="card__body">
        ${genre ? `<div class="card__genre">${genre}</div>` : ''}
        <div class="card__title">${titre}</div>
        <div class="card__author">par ${auteur}</div>
        <div class="card__meta">
          ${etoiles}
          <span>👁 ${lectures.toLocaleString('fr-FR')}</span>
        </div>
      </div>
      <div class="card__footer" style="justify-content:space-between;align-items:center">
        ${badgeStatut}
        <span class="btn btn--primary btn--sm">Lire</span>
      </div>
    </a>
  `;
}

function renderEtoiles(note) {
  const plein = Math.round(note);
  let html = '<span class="stars">';
  for (let i = 1; i <= 5; i++) {
    html += i <= plein ? '★' : '<span class="stars__empty">★</span>';
  }
  html += `</span> <span style="font-size:var(--font-size-xs);color:var(--text-light)">${note.toFixed(1)}</span>`;
  return html;
}

/* ============================================================
   Utilitaires
   ============================================================ */

function afficherToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

function videState(message) {
  return `
    <div class="empty-state" style="grid-column:1/-1">
      <div class="empty-state__icon">📭</div>
      <p class="empty-state__title">${message}</p>
    </div>
  `;
}

/* ============================================================
   Menu hamburger mobile
   ============================================================ */

function initHamburger() {
  const toggle = document.getElementById('nav-toggle');
  const menu   = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
  });
}
