/* ============================================================
   app.js — Page d'accueil publique (index.html)
   Kalamundi — La Plume du Monde
   ============================================================ */

import { getSession, supabase } from './auth.js';
import { api } from './api.js';
import { injecterPub } from './pub.js';
import { initNotificationsPush } from './notifications.js';
import { echapperAttr, normaliserUrlImage } from './cover-utils.js';
import i18n from './i18n.js';

/* ============================================================
   Init
   ============================================================ */

/* ============================================================
   PWA Install
   ============================================================ */
let _installPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _installPrompt = e;
  document.querySelectorAll('.btn-pwa-install').forEach(b => b.style.display = 'inline-flex');
});

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  document.querySelectorAll('.btn-pwa-install').forEach(b => b.style.display = 'none');
});

window._installerApp = async function () {
  if (!_installPrompt) return;
  _installPrompt.prompt();
  const { outcome } = await _installPrompt.userChoice;
  if (outcome === 'accepted') _installPrompt = null;
};

document.addEventListener('DOMContentLoaded', async () => {
  i18n.appliquer();
  enregistrerSW();
  initNotificationsPush().catch(() => {});

  /* Navbar + vedettes en parallèle — ne pas attendre l'auth pour afficher le contenu */
  const [session] = await Promise.all([
    initNavbar(),
    chargerVedettes(),
  ]);

  /* Lazy load sections sous le fold via IntersectionObserver */
  const lazyLoad = (elementId, fn) => {
    const el = document.getElementById(elementId);
    if (!el) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { obs.disconnect(); fn(); }
    }, { rootMargin: '200px' });
    obs.observe(el);
  };
  lazyLoad('section-nouveautes',       () => chargerNouveautes());
  lazyLoad('section-nouveaux-talents', () => chargerNouveauxTalents());

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
      ${renderSelecteurLangue()}
      <button class="btn btn--outline btn--sm btn-pwa-install" onclick="window._installerApp()" style="display:none;color:rgba(255,255,255,0.9);border-color:rgba(255,255,255,0.4)">📲 Installer</button>
      <a href="/pages/publish.html" class="btn btn--accent btn--sm">Publier</a>
      <div class="nav-avatar" id="nav-avatar-btn" title="${nom}">
        ${avatarHtml}
        <div class="nav-avatar__menu" id="nav-avatar-menu">
          <div class="nav-avatar__name">${nom}</div>
          <a href="/pages/author-profile.html?id=${user.id}" class="nav-avatar__item">👤 Mon profil</a>
          <a href="/pages/author-dashboard.html" class="nav-avatar__item">📊 Tableau de bord</a>
          <a href="/pages/library.html" class="nav-avatar__item">📚 Ma bibliothèque</a>
          <a href="/pages/abonnements.html" class="nav-avatar__item">💎 Abonnements</a>
          <a href="/offline.html" class="nav-avatar__item">📵 Mode hors-ligne</a>
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
      ${renderSelecteurLangue()}
      <button class="btn btn--outline btn--sm btn-pwa-install" onclick="window._installerApp()" style="display:none;color:rgba(255,255,255,0.9);border-color:rgba(255,255,255,0.4)">📲 Installer</button>
      <a href="/pages/login.html" class="btn btn--ghost btn--sm" style="color:rgba(255,255,255,0.85)">Connexion</a>
      <a href="/pages/login.html?mode=inscription" class="btn btn--accent btn--sm">S'inscrire</a>
    `;
    heroActions.innerHTML = `
      <a href="/pages/library.html" class="btn btn--accent btn--lg">Découvrir gratuitement</a>
      <a href="/pages/login.html?mode=inscription" class="btn btn--outline btn--lg" style="color:white;border-color:rgba(255,255,255,0.6)">Devenir auteur</a>
    `;
  }

  heroStats.innerHTML = `
    <div class="hero__stat"><span class="hero__stat-value" id="stat-oeuvres">—</span><span class="hero__stat-label">${i18n.t('home.hero.oeuvres', 'œuvres')}</span></div>
    <div class="hero__stat"><span class="hero__stat-value" id="stat-lectures">—</span><span class="hero__stat-label">${i18n.t('home.hero.lectures', 'lectures')}</span></div>
    <div class="hero__stat"><span class="hero__stat-value">50+</span><span class="hero__stat-label">${i18n.t('home.hero.langues', 'langues')}</span></div>
  `;

  connecterSelecteursLangue();

  // chargerStats() supprimé — total récupéré dans chargerVedettes()
  return session;
}

function renderSelecteurLangue() {
  return i18n.renderSelecteur({ classes: 'lang-select--nav js-lang-select' });
}

function connecterSelecteursLangue() {
  document.querySelectorAll('.js-lang-select').forEach(select => {
    select.value = i18n.langue;
    select.addEventListener('change', (event) => {
      i18n.setLangue(event.target.value);
      window.location.reload();
    });
  });
}

function formatStat(nombre) {
  const valeur = Number(nombre || 0);
  if (valeur >= 1000000) return `${(valeur / 1000000).toFixed(valeur >= 10000000 ? 0 : 1).replace('.0', '')}M+`;
  if (valeur >= 1000) return `${(valeur / 1000).toFixed(valeur >= 10000 ? 0 : 1).replace('.0', '')}k+`;
  return String(valeur);
}

function mettreAJourStatsHero({ oeuvres, lectures } = {}) {
  const elOeuvres = document.getElementById('stat-oeuvres');
  const elLectures = document.getElementById('stat-lectures');
  if (elOeuvres && oeuvres != null) elOeuvres.textContent = formatStat(oeuvres);
  if (elLectures && lectures != null) elLectures.textContent = formatStat(lectures);
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
    const [oeuvres, stats] = await Promise.all([
      api.getOeuvres({ limit: 12, tri: 'lectures' }),
      api.getStatsAccueil().catch(() => null),
    ]);
    const { data, total } = oeuvres;

    const lecturesFallback = (data || []).reduce((somme, oeuvre) => somme + Number(oeuvre.nb_lectures || 0), 0);
    mettreAJourStatsHero({
      oeuvres: stats?.totalOeuvres ?? total,
      lectures: stats?.totalLectures ?? lecturesFallback,
    });

    if (!data?.length) {
      grid.innerHTML = videState('Aucune œuvre disponible pour l\'instant.');
      return;
    }
    const html = data.map(renderBookMini).join('');
    // Dupliquer pour carrousel infini — lazy load sur la 2e copie
    grid.innerHTML = html + data.map(o => renderBookMini(o, true)).join('');
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
    grid.innerHTML = html + data.map(o => renderBookMini(o, true)).join('');
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

    const avatarUrl = normaliserUrlImage(a.photo_url);
    const avatar = avatarUrl
      ? `<img src="${echapperAttr(avatarUrl)}" alt="${echapperAttr(a.nom)}" class="spotlight__avatar-img" />`
      : `<div class="spotlight__avatar-fallback" style="background:${couleur}">${initiale}</div>`;

    const coverUrl = normaliserUrlImage(oeuvre?.couverture_url);
    const coverOeuvre = coverUrl
      ? `<img src="${echapperAttr(coverUrl)}" alt="${echapperAttr(oeuvre.titre)}" class="spotlight__cover-img" onerror="this.outerHTML='<div class=&quot;spotlight__cover-fallback&quot; style=&quot;background:${couleur}&quot;><span>${(oeuvre?.titre || '?').charAt(0)}</span></div>'" />`
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

function renderBookMini(oeuvre, lazyDuplicate = false) {
  const titre  = oeuvre.titre || 'Sans titre';
  const auteur = oeuvre.profiles?.nom || 'Auteur inconnu';
  const genre  = oeuvre.genre || '';
  const couleurs = ['#1B4332','#2D6A4F','#A97C0E','#1a3a5c','#5c1a1a','#2c4a1a'];
  const couleur  = couleurs[titre.charCodeAt(0) % couleurs.length];
  const initiale = titre.charAt(0).toUpperCase();
  const coverUrl = normaliserUrlImage(oeuvre.couverture_url);

  // Doublons du carrousel → lazy loading, aria-hidden pour accessibilité
  const lazyAttr = lazyDuplicate ? 'loading="lazy" aria-hidden="true"' : 'loading="lazy"';
  const cover = coverUrl
    ? `<img src="${echapperAttr(coverUrl)}" alt="${echapperAttr(titre)}" ${lazyAttr} class="book-mini__img" data-fallback-color="${couleur}" data-fallback-initiale="${initiale}">`
    : '';
  const fallback = `<div class="book-mini__fallback" style="background:${couleur};display:${coverUrl ? 'none' : 'flex'}">
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
  const coverUrl = normaliserUrlImage(oeuvre.couverture_url);

  const cover = coverUrl
    ? `<img src="${echapperAttr(coverUrl)}" alt="Couverture de ${echapperAttr(titre)}" class="card__cover" loading="lazy" onerror="this.outerHTML='<div class=&quot;card__cover card__cover--placeholder&quot;>📖</div>'">`
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

/* ============================================================
   Section Scolaire — Manuels OpenStax
   ============================================================ */

async function chargerScolaire(niveau = 'tous') {
  const grid = document.getElementById('grid-scolaire');
  if (!grid) return;
  grid.innerHTML = '<div class="spinner" style="margin:2rem auto"></div>';

  try {
    let query = supabase
      .from('oeuvres')
      .select(`id, titre, couverture_url, genre, public_cible, note_moyenne, statut, profiles:auteur_id(nom)`)
      .like('genre', 'education%')
      .eq('visible', true)
      .order('titre', { ascending: true })
      .limit(20);

    if (niveau !== 'tous') {
      query = query.eq('public_cible', niveau);
    }

    const { data, error } = await query;
    if (error || !data?.length) {
      grid.innerHTML = videState('Aucun manuel disponible.');
      return;
    }

    grid.innerHTML = data.map(o => {
      const titre   = o.titre || 'Sans titre';
      const niveau_ = o.public_cible || '';
      const matiere = o.genre?.replace('education_', '') || '';
      const couleurs = { maths:'#1B4332', sciences:'#1a3a5c', sh:'#5c1a1a', eco:'#A97C0E', info:'#2D6A4F', langues:'#4a1a5c', autre:'#333' };
      const cle = matiere.toLowerCase();
      const couleur = couleurs[cle] || couleurs.autre;
      const initiale = titre.charAt(0).toUpperCase();
      const coverUrl = normaliserUrlImage(o.couverture_url);
      const cover = coverUrl
        ? `<img src="${echapperAttr(coverUrl)}" alt="${echapperAttr(titre)}" loading="lazy" class="book-mini__img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        : '';
      const fallback = `<div class="book-mini__fallback" style="background:${couleur};display:${coverUrl ? 'none' : 'flex'}"><span>${initiale}</span></div>`;
      const badge = niveau_ ? `<span style="font-size:10px;background:var(--accent-light,#e8f5e9);color:var(--primary);border-radius:4px;padding:1px 6px;font-weight:600">${niveau_}</span>` : '';
      return `
        <a href="/pages/work.html?id=${o.id}" class="book-mini">
          <div class="book-mini__cover">${cover}${fallback}</div>
          <div class="book-mini__body">
            <div class="book-mini__genre" style="display:flex;gap:4px;align-items:center">🎓 ${badge}</div>
            <div class="book-mini__title">${titre}</div>
            <div class="book-mini__author">OpenStax · CC-BY</div>
          </div>
        </a>`;
    }).join('');

  } catch (e) {
    grid.innerHTML = videState('Erreur de chargement.');
  }

  /* Onglets niveaux */
  document.getElementById('edu-tabs')?.querySelectorAll('.edu-tab').forEach(btn => {
    btn.addEventListener('click', async () => {
      document.querySelectorAll('.edu-tab').forEach(b => b.classList.remove('edu-tab--active'));
      btn.classList.add('edu-tab--active');
      await chargerScolaire(btn.dataset.niveau);
    });
  });
}

function initHamburger() {
  const toggle = document.getElementById('nav-toggle');
  const menu   = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', isOpen);
  });
}

injecterPub('home');
