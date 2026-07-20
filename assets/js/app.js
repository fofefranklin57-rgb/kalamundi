/* ============================================================
   app.js — Page d'accueil publique (index.html)
   Kalamundi — La Plume du Monde
   ============================================================ */

import { getSession, supabase } from './auth.js';
import { api, estOeuvreImportee } from './api.js';
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

  /* Navbar + auteurs en parallèle — ne pas attendre l'auth pour afficher le contenu.
     Occasion/patrimoine chargés directement (pas de lazy IntersectionObserver) :
     la page est courte depuis la simplification du 20/07, ces sections ne sont
     plus loin sous le pli, et un chargement direct reste simple et fiable. */
  const [session] = await Promise.all([
    initNavbar(),
    chargerAuteurs(),
    chargerOccasion(),
    chargerPatrimoine(),
  ]);
  if (session?.user) chargerReprendre(session.user.id).catch(() => {});

  initHamburger();
  /* Pubs Monetag — chargées après le contenu, respecte les abonnés.
     Le paiement écrit profiles.abonnement (reader_plus/auteur_pro), jamais
     user_metadata.plan='premium' — cette ancienne vérification ne matchait
     donc jamais et un abonné payant voyait quand même de la publicité
     (cf. ERROR_LOG). Auteur Pro inclut Reader+, donc les deux coupent la pub. */
  if (window.initAds) {
    const abonne = session?.user
      ? await api.aAbonnementActif(session.user.id, ['reader_plus', 'auteur_pro'])
      : false;
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
          <a href="/pages/vendre.html" class="nav-avatar__item">🏷️ Vendre un livre</a>
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

  // chargerStats() supprimé — total récupéré dans chargerAuteurs()
  return session;
}

function renderSelecteurLangue() {
  return i18n.renderSelecteur({ classes: 'lang-select--nav js-lang-select' });
}

function connecterSelecteursLangue() {
  document.querySelectorAll('.js-lang-select').forEach(select => {
    if (select.dataset.i18nBound === '1') return;
    select.dataset.i18nBound = '1';
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

function formatPrixCourt(prix) {
  const valeur = Number(prix || 0);
  if (!valeur) return 'Premium';
  if (valeur >= 1000) return `${Math.round(valeur / 1000)}k FCFA`;
  return `${valeur.toLocaleString('fr-FR')} FCFA`;
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
   Grille auteurs — SEULEMENT les créations publiées sur Kalamundi
   (exclureSysteme:true, corrigé le 20/07 — ne filtrait rien avant).
   Le patrimoine (domaine public) a sa propre grille plus bas, jamais
   mélangé ici. Toujours une tuile « Ta place est ici » à la fin : le
   catalogue d'auteurs est petit aujourd'hui, autant en faire un appel
   à publier plutôt que de le cacher.
   ============================================================ */

async function chargerAuteurs() {
  const grid = document.getElementById('grid-auteurs');
  if (!grid) return;
  try {
    const [{ data }, stats] = await Promise.all([
      api.getOeuvres({ limit: 11, tri: 'recent', exclureSysteme: true }),
      api.getStatsAccueil().catch(() => null), // collection par défaut = tout le catalogue
    ]);

    mettreAJourStatsHero({
      oeuvres: stats?.totalOeuvres,
      lectures: stats?.totalLectures ?? 0,
    });

    const tuileCta = `
      <a href="/pages/login.html?mode=inscription" class="book-mini book-mini--cta">
        <div class="book-mini__cta-icon">✍️</div>
        <div class="book-mini__cta-text">Ta place<br>est ici</div>
      </a>`;

    grid.innerHTML = (data?.length ? data.map(o => renderBookMini(o)).join('') : '') + tuileCta;
    gererErreurImages(grid);
  } catch (err) {
    grid.innerHTML = videState('Impossible de charger les œuvres.');
    console.error(err);
  }
}

/* ============================================================
   Grille patrimoine — domaine public, volontairement séparée et
   discrète (cf. audit 20/07 : 285/288 œuvres du catalogue total).
   ============================================================ */

async function chargerPatrimoine() {
  const grid = document.getElementById('grid-patrimoine');
  const legende = document.getElementById('patrimoine-compte');
  if (!grid) return;
  try {
    const { data, total } = await api.getOeuvres({ limit: 30, tri: 'lectures' });
    const patrimoine = (data || []).filter(estOeuvreImportee).slice(0, 10);

    if (legende) {
      const [statsToutes, statsOriginaux] = await Promise.all([
        api.getStatsAccueil().catch(() => null),
        api.getStatsAccueil({ collection: 'originaux' }).catch(() => null),
      ]);
      if (statsToutes && statsOriginaux) {
        const nbPatrimoine = statsToutes.totalOeuvres - statsOriginaux.totalOeuvres;
        legende.textContent = `${nbPatrimoine} classiques du domaine public — libres et gratuits.`;
      }
    }

    grid.innerHTML = patrimoine.length ? patrimoine.map(o => renderBookMini(o)).join('') : videState('Aucun titre disponible.');
    gererErreurImages(grid);
  } catch (err) {
    grid.innerHTML = videState('Impossible de charger le patrimoine.');
    console.error(err);
  }
}

/* ============================================================
   Occasion — vrai état vide si aucune annonce, jamais d'annonce
   inventée (cf. audit 20/07).
   ============================================================ */

async function chargerOccasion() {
  const wrap = document.getElementById('home-occasion');
  if (!wrap) return;
  try {
    const annonces = await api.getToutesAnnoncesOccasion({ limit: 4 });
    if (!annonces.length) {
      wrap.innerHTML = `
        <div class="occasion-vide">
          <p>Aucune annonce pour l'instant — soyez le premier vendeur.</p>
          <a href="/pages/vendre.html" class="btn btn--outline btn--sm">Vendre un livre →</a>
        </div>`;
      return;
    }
    wrap.innerHTML = `<div class="books-carousel-wrap"><div class="books-carousel">${annonces.map(renderOccasionMini).join('')}</div></div>`;
    gererErreurImages(wrap);
  } catch (err) {
    wrap.innerHTML = videState('Impossible de charger les annonces.');
    console.error(err);
  }
}

function renderOccasionMini(offre) {
  const livre = offre.livres || {};
  const titre = livre.titre || 'Livre Kalamundi';
  const ville = offre.conditions?.ville;
  const etat  = offre.conditions?.etat;
  const coverUrl = normaliserUrlImage(livre.couverture_url);
  const couleur = '#2D6A4F';
  const initiale = titre.charAt(0).toUpperCase();
  const cover = coverUrl
    ? `<img src="${echapperAttr(coverUrl)}" alt="${echapperAttr(titre)}" loading="lazy" class="book-mini__img">`
    : `<div class="book-mini__fallback" style="background:${couleur}"><span>${initiale}</span></div>`;

  return `
    <a href="/pages/work.html?id=${echapperAttr(livre.oeuvre_id || '')}" class="book-mini">
      <div class="book-mini__cover">${cover}</div>
      <div class="book-mini__body">
        <div class="book-mini__title">${titre}</div>
        <div class="book-mini__author">${[etat, ville].filter(Boolean).join(' · ')}</div>
        <div class="book-mini__author" style="color:var(--color-primary);font-weight:600">${formatPrixCourt(offre.prix)}</div>
      </div>
    </a>`;
}

/* ============================================================
   Reprendre la lecture — corrige le défaut n°1 relevé sur Kindle
   (accueil tourné vers l'achat plutôt que "continuer ma lecture").
   Source : `lectures`, triée par updated_at desc (déjà l'historique
   de lecture le plus récent, pas besoin d'une nouvelle requête).
   ============================================================ */

async function chargerReprendre(userId) {
  const section = document.getElementById('section-reprendre');
  const wrap = document.getElementById('home-reprendre');
  if (!section || !wrap) return;
  try {
    const historique = (await api.getBibliotheque(userId)).slice(0, 4);
    if (!historique.length) return;

    wrap.innerHTML = historique.map(renderReprendreCard).join('');
    gererErreurImages(wrap);
    section.style.display = '';
  } catch (err) {
    console.error(err);
  }
}

function renderReprendreCard(item) {
  const oeuvre = item.oeuvres || {};
  const chapitre = item.chapitre_courant || 1;
  const html = renderBookMini(oeuvre);
  // Lien vers le chapitre exact repris, pas le début du livre.
  return html.replace(
    `/pages/work.html?id=${oeuvre.id}`,
    `/pages/reader.html?id=${oeuvre.id}&ch=${chapitre}`
  );
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
