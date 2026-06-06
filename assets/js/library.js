/* ============================================================
   library.js — Bibliothèque : catalogue, filtres, pagination
   Kalamundi — La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
import { debounce, getParam, navigateAvecParams, formatNombre, truncate, toast } from './utils.js';

/* ============================================================
   État des filtres
   ============================================================ */

const filtres = {
  genre:    getParam('genre')   || '',
  langue:   getParam('langue')  || '',
  statut:   getParam('statut')  || '',
  public:   getParam('public')  || '',
  tri:      getParam('tri')     || 'recent',
  page:     parseInt(getParam('page') || '1'),
  recherche: getParam('q')      || '',
};

const LIMIT = 20;

/* ============================================================
   Init
   ============================================================ */

(async () => {
  await Promise.all([
    chargerPremierTextes(),
    chargerOeuvres(),
  ]);
  syncUI();
})();

/* ============================================================
   Charger les œuvres
   ============================================================ */

async function chargerOeuvres() {
  const grid = document.getElementById('works-grid');
  grid.innerHTML = '<div class="empty-state"><div class="spinner spinner--lg"></div></div>';

  try {
    const { data, total } = await api.getOeuvres({
      page:      filtres.page,
      limit:     LIMIT,
      genre:     filtres.genre   || undefined,
      langue:    filtres.langue  || undefined,
      statut:    filtres.statut  || undefined,
      recherche: filtres.recherche || undefined,
    });

    document.getElementById('library-count').textContent =
      `${total} œuvre${total !== 1 ? 's' : ''} trouvée${total !== 1 ? 's' : ''}`;

    if (!data.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📭</div>
          <div class="empty-state__title">Aucune œuvre trouvée</div>
          <p class="empty-state__text">Essaie d'autres filtres ou sois le premier à publier dans cette catégorie !</p>
          <a href="/pages/publish.html" class="btn btn--primary">Publier une œuvre</a>
        </div>`;
      return;
    }

    grid.innerHTML = data.map(o => carteOeuvre(o)).join('');
    rendrePagination(total);

  } catch (err) {
    grid.innerHTML = `<div class="alert alert--error">Erreur de chargement : ${err.message}</div>`;
  }
}

/* ============================================================
   Premiers textes (amateurs)
   ============================================================ */

async function chargerPremierTextes() {
  const grid = document.getElementById('premiers-textes-grid');
  try {
    const { data } = await api.getOeuvres({ limit: 4, statut: 'gratuit' });
    // Dans une vraie app : filtrer les auteurs avec badge_fondateur ou premier texte
    if (!data.length) {
      document.getElementById('premiers-textes').style.display = 'none';
      return;
    }
    grid.innerHTML = data.slice(0, 4).map(o => `
      <a href="/pages/work.html?id=${o.id}" class="card" style="text-decoration:none;">
        <div class="card__cover card__cover--placeholder" style="font-size:36px;">📖</div>
        <div class="card__body">
          <div class="card__genre">${o.genre}</div>
          <div class="card__title">${o.titre}</div>
          <div class="card__author">par ${o.profiles?.nom || 'Auteur anonyme'}</div>
        </div>
      </a>
    `).join('');
  } catch {
    document.getElementById('premiers-textes').style.display = 'none';
  }
}

/* ============================================================
   Template carte œuvre
   ============================================================ */

function carteOeuvre(o) {
  const auteur = o.profiles?.nom || 'Auteur anonyme';
  const pays   = o.profiles?.pays ? `· ${o.profiles.pays}` : '';
  const couv   = o.couverture_url
    ? `<img src="${o.couverture_url}" alt="Couverture" />`
    : '📖';

  return `
    <a href="/pages/work.html?id=${o.id}" class="work-card">
      <div class="work-card__cover">${couv}</div>
      <div class="work-card__body">
        <div class="work-card__genre">${o.genre}</div>
        <div class="work-card__title">${o.titre}</div>
        <div class="work-card__author">par ${auteur} ${pays}</div>
        ${o.resume ? `<p class="work-card__resume">${truncate(o.resume, 120)}</p>` : ''}
        <div class="work-card__meta">
          <span>👁 ${formatNombre(o.nb_lectures)} lectures</span>
          ${o.note_moyenne ? `<span>⭐ ${o.note_moyenne}</span>` : ''}
          <span class="badge ${o.statut === 'premium' ? 'badge--premium' : 'badge--gratuit'}">
            ${o.statut === 'premium' ? '⭐ Premium' : '🆓 Gratuit'}
          </span>
        </div>
      </div>
    </a>`;
}

/* ============================================================
   Pagination
   ============================================================ */

function rendrePagination(total) {
  const totalPages = Math.ceil(total / LIMIT);
  if (totalPages <= 1) return;
  const el = document.getElementById('pagination');

  let html = '';
  if (filtres.page > 1) {
    html += `<button class="pagination__btn" data-page="${filtres.page - 1}">←</button>`;
  }
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - filtres.page) <= 2) {
      html += `<button class="pagination__btn ${i === filtres.page ? 'pagination__btn--active' : ''}" data-page="${i}">${i}</button>`;
    } else if (Math.abs(i - filtres.page) === 3) {
      html += `<span style="color:var(--text-light)">…</span>`;
    }
  }
  if (filtres.page < totalPages) {
    html += `<button class="pagination__btn" data-page="${filtres.page + 1}">→</button>`;
  }
  el.innerHTML = html;

  el.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      filtres.page = parseInt(btn.dataset.page);
      chargerOeuvres();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

/* ============================================================
   Sync UI avec filtres actifs
   ============================================================ */

function syncUI() {
  if (filtres.recherche) {
    document.getElementById('search-input').value = filtres.recherche;
  }
  if (filtres.langue) {
    document.getElementById('filter-langue').value = filtres.langue;
  }
  if (filtres.statut) {
    document.getElementById('filter-statut').value = filtres.statut;
  }
  if (filtres.genre) {
    document.querySelectorAll('.filter-chip[data-genre]').forEach(c => {
      c.classList.toggle('is-active', c.dataset.genre === filtres.genre);
    });
    document.querySelectorAll('#sidebar-genres .filter-option').forEach(o => {
      o.classList.toggle('is-active', o.dataset.genre === filtres.genre);
    });
  }
  document.getElementById('sort-select').value = filtres.tri;
}

/* ============================================================
   Événements — filtres chips
   ============================================================ */

document.querySelectorAll('.filter-chip[data-genre]').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip[data-genre]').forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    filtres.genre = chip.dataset.genre;
    filtres.page  = 1;
    chargerOeuvres();
  });
});

document.querySelectorAll('#sidebar-genres .filter-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('#sidebar-genres .filter-option').forEach(o => o.classList.remove('is-active'));
    opt.classList.add('is-active');
    filtres.genre = opt.dataset.genre;
    filtres.page  = 1;
    chargerOeuvres();
  });
});

document.querySelectorAll('#sidebar-statut .filter-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('#sidebar-statut .filter-option').forEach(o => o.classList.remove('is-active'));
    opt.classList.add('is-active');
    filtres.statut = opt.dataset.statut;
    filtres.page   = 1;
    chargerOeuvres();
  });
});

document.getElementById('filter-langue')?.addEventListener('change', (e) => {
  filtres.langue = e.target.value;
  filtres.page   = 1;
  chargerOeuvres();
});

document.getElementById('filter-statut')?.addEventListener('change', (e) => {
  filtres.statut = e.target.value;
  filtres.page   = 1;
  chargerOeuvres();
});

document.getElementById('sort-select')?.addEventListener('change', (e) => {
  filtres.tri  = e.target.value;
  filtres.page = 1;
  chargerOeuvres();
});

/* ============================================================
   Recherche
   ============================================================ */

const rechercheDebounce = debounce(() => {
  filtres.recherche = document.getElementById('search-input').value.trim();
  filtres.page      = 1;
  chargerOeuvres();
}, 400);

document.getElementById('search-input')?.addEventListener('input', rechercheDebounce);
document.getElementById('search-btn')?.addEventListener('click', () => {
  filtres.recherche = document.getElementById('search-input').value.trim();
  filtres.page      = 1;
  chargerOeuvres();
});

/* ============================================================
   Reset filtres
   ============================================================ */

document.getElementById('reset-filters')?.addEventListener('click', () => {
  filtres.genre     = '';
  filtres.langue    = '';
  filtres.statut    = '';
  filtres.public    = '';
  filtres.tri       = 'recent';
  filtres.page      = 1;
  filtres.recherche = '';
  document.getElementById('search-input').value = '';
  document.getElementById('filter-langue').value = '';
  document.getElementById('filter-statut').value = '';
  document.getElementById('sort-select').value   = 'recent';
  document.querySelectorAll('.filter-chip[data-genre]')[0]?.click();
  chargerOeuvres();
});
