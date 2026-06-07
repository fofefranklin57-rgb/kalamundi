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
    chargerNouveauxTalents(),
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
    const user = session.user;
    const nom = user.user_metadata?.nom || user.email?.split('@')[0] || 'Mon compte';
    const initiale = nom.charAt(0).toUpperCase();
    const photo = user.user_metadata?.avatar_url || user.user_metadata?.photo_url || null;
    const avatarHtml = photo
      ? `<img src="${photo}" alt="${nom}" class="nav-avatar__img">`
      : `<span class="nav-avatar__initiale">${initiale}</span>`;

    navbarActions.innerHTML = `
      <a href="/pages/publish.html" class="btn btn--accent btn--sm">Publier</a>
      <div class="nav-avatar" id="nav-avatar-btn" title="${nom}">
        ${avatarHtml}
        <div class="nav-avatar__menu" id="nav-avatar-menu">
          <div class="nav-avatar__name">${nom}</div>
          <a href="/pages/author-profile.html?id=${user.id}" class="nav-avatar__item">👤 Mon profil</a>
          <a href="/pages/author-dashboard.html" class="nav-avatar__item">📊 Tableau de bord</a>
          <a href="/pages/library.html" class="nav-avatar__item">📚 Ma bibliothèque</a>
          <div class="nav-avatar__sep"></div>
          <button class="nav-avatar__item nav-avatar__item--danger" id="btn-deconnexion">🚪 Déconnexion</button>
        </div>
      </div>
    `;

    // Toggle menu avatar
    document.getElementById('nav-avatar-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('nav-avatar-menu')?.classList.toggle('is-open');
    });
    document.addEventListener('click', () => {
      document.getElementById('nav-avatar-menu')?.classList.remove('is-open');
    });

    // Déconnexion
    document.getElementById('btn-deconnexion')?.addEventListener('click', async () => {
      const { signOut } = await import('./auth.js');
      await signOut();
      window.location.href = '/index.html';
    });

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
    const { data } = await api.getOeuvres({ limit: 12, tri: 'lectures' });
    if (!data?.length) {
      grid.innerHTML = videState('Aucune œuvre disponible pour l\'instant.');
      return;
    }
    const html = data.map(renderBookMini).join('');
    grid.innerHTML = html + html;
    grid.addEventListener('click', () => grid.classList.toggle('paused'));
    gererErreurImages(grid);
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
    const { data } = await api.getOeuvres({ limit: 12, tri: 'recent' });
    if (!data?.length) {
      grid.innerHTML = videState('Aucune nouveauté pour l\'instant.');
      return;
    }
    const html = data.map(renderBookMini).join('');
    grid.innerHTML = html + html;
    grid.addEventListener('click', () => grid.classList.toggle('paused'));
    gererErreurImages(grid);
  } catch (err) {
    grid.innerHTML = videState('Impossible de charger les nouveautés.');
    console.error(err);
  }
}

/* ============================================================
   Nouveaux talents — spotlight + premiers pas
   ============================================================ */

async function chargerNouveauxTalents() {
  const [auteurs, oeuvres] = await Promise.all([
    api.getNouveauxAuteurs({ limit: 6 }).catch(() => []),
    api.getOeuvresPremiersPas({ limit: 12 }).catch(() => []),
  ]);

  renderSpotlight(auteurs);
  renderPremiersPas(oeuvres);
}

/* ── Spotlight tournant (un auteur toutes les 5s) ───────── */
function renderSpotlight(auteurs) {
  const wrap = document.getElementById('spotlight-auteur');
  if (!wrap) return;
  if (!auteurs.length) {
    wrap.innerHTML = `<p style="color:var(--text-light);font-size:var(--font-size-sm);text-align:center;padding:var(--spacing-lg)">
      Aucun auteur trouvé. <a href="/pages/login.html?mode=inscription" class="lien-vert">Soyez le premier !</a>
    </p>`;
    return;
  }

  let idx = 0;

  function afficher(i) {
    const a = auteurs[i];
    if (!a) return;
    const oeuvre = a.derniere_oeuvre;
    const couleurs = ['#1B4332','#2D6A4F','#A97C0E','#1a3a5c','#5c1a1a','#2c4a1a'];
    const couleur  = couleurs[(a.nom || '').charCodeAt(0) % couleurs.length];
    const initiale = (a.nom || '?').charAt(0).toUpperCase();

    const avatar = a.photo_url
      ? `<img src="${a.photo_url}" alt="${a.nom}" class="spotlight__avatar-img" />`
      : `<div class="spotlight__avatar-fallback" style="background:${couleur}">${initiale}</div>`;

    const coverOeuvre = oeuvre?.couverture_url
      ? `<img src="${oeuvre.couverture_url}" alt="${oeuvre.titre}" class="spotlight__cover-img" />`
      : `<div class="spotlight__cover-fallback" style="background:${couleur}"><span>${(oeuvre?.titre || '?').charAt(0)}</span></div>`;

    const badges = [
      a.badge_fondateur ? '<span class="badge badge--premium">🏅 Fondateur</span>' : '',
      a.niveau_auteur   ? `<span class="badge badge--primary">${a.niveau_auteur}</span>` : '',
      a.pays            ? `<span class="badge badge--muted">📍 ${a.pays}</span>` : '',
    ].filter(Boolean).join('');

    const dots = auteurs.map((_, j) =>
      `<button class="spotlight__dot ${j === i ? 'is-active' : ''}" data-idx="${j}" aria-label="Auteur ${j + 1}"></button>`
    ).join('');

    wrap.innerHTML = `
      <div class="spotlight-card">
        <div class="spotlight__auteur">
          <a href="/pages/author-profile.html?id=${a.id}" class="spotlight__avatar-link">
            ${avatar}
          </a>
          <div class="spotlight__info">
            <a href="/pages/author-profile.html?id=${a.id}" class="spotlight__nom">${a.nom || 'Auteur'}</a>
            <div class="spotlight__badges">${badges}</div>
            ${a.bio ? `<p class="spotlight__bio">${a.bio.slice(0, 140)}${a.bio.length > 140 ? '…' : ''}</p>` : ''}
            <a href="/pages/author-profile.html?id=${a.id}" class="btn btn--outline btn--sm" style="margin-top:var(--spacing-sm)">
              Voir le profil →
            </a>
          </div>
        </div>
        ${oeuvre ? `
        <a href="/pages/work.html?id=${oeuvre.id}" class="spotlight__oeuvre">
          <div class="spotlight__cover">${coverOeuvre}</div>
          <div class="spotlight__oeuvre-info">
            <div class="spotlight__oeuvre-label">Dernière œuvre</div>
            <div class="spotlight__oeuvre-titre">${oeuvre.titre}</div>
            <div class="spotlight__oeuvre-genre">${oeuvre.genre || ''}</div>
          </div>
        </a>` : ''}
        <div class="spotlight__nav">
          ${dots}
        </div>
      </div>`;

    // Dots cliquables
    wrap.querySelectorAll('.spotlight__dot').forEach(btn => {
      btn.addEventListener('click', () => {
        idx = parseInt(btn.dataset.idx);
        afficher(idx);
        resetTimer();
      });
    });
  }

  let timer;
  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
      idx = (idx + 1) % auteurs.length;
      afficher(idx);
    }, 5000);
  }

  afficher(0);
  if (auteurs.length > 1) resetTimer();
}

/* ── Grille "Premiers pas" ─────────────────────────────── */
function renderPremiersPas(oeuvres) {
  const grid = document.getElementById('grid-premiers-pas');
  if (!grid) return;
  if (!oeuvres.length) {
    grid.innerHTML = videState('Aucune œuvre pour le moment.');
    return;
  }
  const html = oeuvres.map(renderBookMini).join('');
  grid.innerHTML = html + html;
  grid.addEventListener('click', () => grid.classList.toggle('paused'));
  gererErreurImages(grid);
}

function gererErreurImages(container) {
  container.querySelectorAll('.book-mini__img').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
      const fallback = img.nextElementSibling;
      if (fallback) fallback.style.display = 'flex';
    });
  });
}

/* ============================================================
   Rendu carte œuvre
   ============================================================ */

function renderBookMini(oeuvre) {
  const titre  = oeuvre.titre || 'Sans titre';
  const auteur = oeuvre.profiles?.nom || 'Auteur inconnu';
  const genre  = oeuvre.genre || '';
  const couleurs = ['#1B4332','#2D6A4F','#A97C0E','#1a3a5c','#5c1a1a','#2c4a1a'];
  const couleur  = couleurs[titre.charCodeAt(0) % couleurs.length];
  const initiale = titre.charAt(0).toUpperCase();

  const cover = oeuvre.couverture_url
    ? `<img src="${oeuvre.couverture_url}" alt="${titre}" loading="lazy" class="book-mini__img" data-fallback-color="${couleur}" data-fallback-initiale="${initiale}">`
    : '';
  const fallback = `<div class="book-mini__fallback" style="background:${couleur};display:${oeuvre.couverture_url ? 'none' : 'flex'}">
    <span>${initiale}</span>
  </div>`;

  return `
    <a href="/pages/work.html?id=${oeuvre.id}" class="book-mini">
      <div class="book-mini__cover">${cover}${fallback}</div>
      <div class="book-mini__body">
        ${genre ? `<div class="book-mini__genre">${genre}</div>` : ''}
        <div class="book-mini__title">${titre}</div>
        <div class="book-mini__author">${auteur}</div>
      </div>
    </a>`;
}

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
