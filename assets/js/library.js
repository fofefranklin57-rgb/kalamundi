/* ============================================================
   library.js — Bibliothèque Kalamundi
   Organisation : BISAC + Dublin Core + Dewey 896 (littératures africaines)
   ============================================================ */

import { api, estOeuvreImportee } from './api.js';
import { debounce, getParam, formatNombre, truncate } from './utils.js';
import { genererCouverture } from './cover-generator.js';
import { echapperAttr, normaliserUrlImage } from './cover-utils.js';
import { injecterPub } from './pub.js';

/* ============================================================
   RÉFÉRENTIEL GENRE — adapté BISAC
   Chaque genre a : label affiché, couleur de code, emoji couverture
   ============================================================ */

const GENRES = {
  roman:             { label: 'Roman',               couleur: '#2D6A4F', emoji: '📗' },
  nouvelle:          { label: 'Nouvelle',             couleur: '#1B5E20', emoji: '📗' },
  conte:             { label: 'Conte',                couleur: '#E65100', emoji: '📙' },
  thriller:          { label: 'Thriller / Policier',  couleur: '#B71C1C', emoji: '🔴' },
  romance:           { label: 'Romance',              couleur: '#AD1457', emoji: '💗' },
  sf_fantasy:        { label: 'SF / Fantasy',         couleur: '#1565C0', emoji: '🚀' },
  poesie:            { label: 'Poésie',               couleur: '#6A1B9A', emoji: '✍️' },
  litterature_orale: { label: 'Littérature orale',    couleur: '#00695C', emoji: '🎭' },
  essai:             { label: 'Essai',                couleur: '#37474F', emoji: '📝' },
  autobiographie:    { label: 'Autobiographie',       couleur: '#5D4037', emoji: '👤' },
  temoignage:        { label: 'Témoignage',           couleur: '#558B2F', emoji: '✍️' },
  philosophie:       { label: 'Philosophie',          couleur: '#4527A0', emoji: '🧠' },
  histoire:          { label: 'Récit historique',     couleur: '#6D4C41', emoji: '🏛️' },
  jeunesse:          { label: 'Jeunesse',             couleur: '#2E7D32', emoji: '🌟' },
  developpement:     { label: 'Développement perso',  couleur: '#00838F', emoji: '💡' },
};

/* ============================================================
   CATÉGORIES BISAC — regroupements thématiques
   ============================================================ */

const CATEGORIES = {
  fiction: {
    label:       'Fiction',
    desc:        'Romans, nouvelles, contes, thrillers, romances et littérature d\'imagination',
    genres:      ['roman', 'nouvelle', 'conte', 'thriller', 'romance', 'sf_fantasy'],
    couleur:     '#2D6A4F',
  },
  nonfiction: {
    label:       'Non-fiction',
    desc:        'Essais, autobiographies, témoignages, philosophie et récits historiques',
    genres:      ['essai', 'autobiographie', 'temoignage', 'philosophie', 'histoire', 'developpement'],
    couleur:     '#37474F',
  },
  poesie: {
    label:       'Poésie & Oralité',
    desc:        'Poésie du monde entier et littérature orale transcrite — patrimoine vivant',
    genres:      ['poesie', 'litterature_orale'],
    couleur:     '#6A1B9A',
  },
  jeunesse: {
    label:       'Jeunesse',
    desc:        'Contes, récits et histoires pour enfants et adolescents',
    genres:      ['jeunesse'],
    couleur:     '#2E7D32',
  },
  afrique: {
    label:       'Littératures africaines',
    desc:        'Dewey 896 · Œuvres d\'auteurs africains — romans, contes, poésies, essais de tout le continent',
    genres:      [],   // filtre par pays, pas par genre
    filtreAfrique: true,
    couleur:     '#E65100',
  },
  patrimoine: {
    label:       'Domaine public',
    desc:        'Œuvres libres de droits — Project Gutenberg, African Storybook, Standard Ebooks',
    genres:      [],
    filtreStatut: 'gratuit',
    couleur:     '#5D4037',
  },
};

/* ============================================================
   LANGUES — affichage avec drapeau (Dublin Core dc:language ISO 639-1)
   ============================================================ */

const LANGUES = {
  fr: { nom: 'Français',   drapeau: '🇫🇷' },
  en: { nom: 'Anglais',    drapeau: '🇬🇧' },
  ar: { nom: 'Arabe',      drapeau: '🇸🇦' },
  sw: { nom: 'Swahili',    drapeau: '🌍' },
  ha: { nom: 'Haoussa',    drapeau: '🌍' },
  yo: { nom: 'Yoruba',     drapeau: '🌍' },
  ln: { nom: 'Lingala',    drapeau: '🌍' },
  es: { nom: 'Espagnol',   drapeau: '🇪🇸' },
  pt: { nom: 'Portugais',  drapeau: '🇧🇷' },
  de: { nom: 'Allemand',   drapeau: '🇩🇪' },
  it: { nom: 'Italien',    drapeau: '🇮🇹' },
  zh: { nom: 'Chinois',    drapeau: '🇨🇳' },
};

/* Pays du continent africain — pour détecter les littératures africaines */
const PAYS_AFRICAINS = new Set([
  'Cameroun','Sénégal','Mali','Côte d\'Ivoire','RDC','Congo','Gabon','Burkina Faso',
  'Niger','Tchad','Togo','Bénin','Guinée','Madagascar','Mauritanie','Rwanda','Burundi',
  'Comores','Djibouti','Nigeria','Ghana','Kenya','Tanzania','Tanzanie','Uganda','Ouganda',
  'Ethiopia','Éthiopie','South Africa','Afrique du Sud','Egypt','Égypte','Morocco','Maroc',
  'Algeria','Algérie','Tunisia','Tunisie','Libya','Libye','Angola','Mozambique','Zambia',
  'Zambie','Zimbabwe','Botswana','Namibia','Namibie','Malawi','Lesotho','Swaziland',
  'Sierra Leone','Liberia','Libéria','Gambia','Gambie','Guinea-Bissau','Guinée-Bissau',
  'Eritrea','Érythrée','Somalia','Somalie','Sudan','Soudan','Central African Republic',
  'Centrafrique','Équateur','Guinée équatoriale',
]);

const FETCH_LIMIT = 1000;

/* ============================================================
   ÉTAT DES FILTRES
   ============================================================ */

const filtres = {
  categorie: getParam('cat')    || '',
  collection: getParam('collection') || (getParam('cat') === 'patrimoine' ? 'patrimoine' : 'originaux'),
  genre:     getParam('genre')  || '',
  langue:    getParam('langue') || '',
  statut:    getParam('statut') || '',
  pays:      getParam('pays')   || '',
  tri:       getParam('tri')    || 'recent',
  page:      parseInt(getParam('page') || '1'),
  recherche: getParam('q')      || '',
};

const LIMIT = 24; // Multiple de 3 colonnes

/* ============================================================
   INIT
   ============================================================ */

(async () => {
  syncUI();
  await chargerOeuvres();
})();

/* ============================================================
   CHARGEMENT DES ŒUVRES
   ============================================================ */

async function chargerOeuvres() {
  const grid = document.getElementById('works-grid');
  grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="spinner spinner--lg"></div><p class="empty-state__text" style="margin-top:12px">Chargement…</p></div>';

  // Déterminer les genres à filtrer selon la catégorie BISAC active
  let genreFiltre = filtres.genre || undefined;
  let paysFiltre  = filtres.pays  || undefined;

  const cat = CATEGORIES[filtres.categorie];
  if (cat && !filtres.genre) {
    if (cat.filtreAfrique) {
      // Filtre par pays africain — géré côté client sur les résultats
      paysFiltre = '__afrique__';
    } else if (cat.filtreStatut && !filtres.statut) {
      filtres.statut = cat.filtreStatut;
    } else if (cat.genres?.length) {
      // On ne peut filtrer que sur 1 genre via api.getOeuvres pour l'instant
      // On charge tout et on filtre côté client pour la catégorie
    }
  }

  try {
    const chargementLarge = filtres.collection !== 'tout';
    const { data: tous, total } = await api.getOeuvres({
      page:      chargementLarge ? 1 : filtres.page,
      limit:     chargementLarge ? FETCH_LIMIT : LIMIT,
      langue:    filtres.langue  || undefined,
      statut:    filtres.statut  || undefined,
      genre:     genreFiltre,
      recherche: filtres.recherche || undefined,
      tri:       filtres.tri,
      exclureSysteme: filtres.collection === 'originaux',
    });
    const statsCatalogue = filtres.collection !== 'tout'
      ? await api.getStatsAccueil().catch(() => null)
      : null;

    // Filtrage client pour catégories multi-genres et pays africains
    let data = tous;

    if (cat?.genres?.length && !filtres.genre) {
      data = tous.filter(o => cat.genres.includes(o.genre?.toLowerCase()));
    }

    if (paysFiltre === '__afrique__') {
      data = tous.filter(o => o.profiles?.pays && PAYS_AFRICAINS.has(o.profiles.pays));
    }

    if (filtres.pays && filtres.pays !== '') {
      data = data.filter(o => o.profiles?.pays === filtres.pays);
    }

    if (filtres.collection === 'originaux') {
      data = data.filter(o => !estOeuvreImportee(o));
    } else if (filtres.collection === 'patrimoine') {
      data = data.filter(o => estOeuvreImportee(o));
    }

    // Compte affiché
    const totalAffiches = chargementLarge ? data.length : total;
    const pageData = chargementLarge
      ? data.slice((filtres.page - 1) * LIMIT, filtres.page * LIMIT)
      : data;
    const nbAffiches = pageData.length;
    const countEl = document.getElementById('library-count');
    countEl.textContent = nbAffiches === 0
      ? 'Aucune œuvre trouvée'
      : `${totalAffiches} œuvre${totalAffiches > 1 ? 's' : ''} — ${nbAffiches} affichée${nbAffiches > 1 ? 's' : ''}`;

    if (!pageData.length) {
      const message = filtres.collection === 'originaux'
        ? 'Les livres importés sont maintenant rangés à part. Publie une œuvre ou passe sur Patrimoine / imports pour les voir.'
        : 'Aucune œuvre ne correspond à ces filtres.';
      afficherContexteCatalogue(totalAffiches, statsCatalogue?.totalOeuvres);
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state__icon">📚</div>
          <div class="empty-state__title">Aucune œuvre dans cette catégorie</div>
          <p class="empty-state__text">${message}</p>
          <a href="/pages/publish.html" class="btn btn--primary" style="margin-top:var(--spacing-md)">
            Publier une œuvre
          </a>
        </div>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    grid.innerHTML = pageData.map(o => carteOeuvre(o)).join('');
    rendrePagination(totalAffiches);
    afficherFiltresActifs();
    afficherContexteCatalogue(totalAffiches, statsCatalogue?.totalOeuvres);

  } catch (err) {
    const contexte = document.getElementById('library-context');
    if (contexte) contexte.style.display = 'none';
    grid.innerHTML = `<div class="alert alert--error" style="grid-column:1/-1">Erreur de chargement : ${err.message}</div>`;
  }
}

function echapperHtml(valeur = '') {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function afficherContexteCatalogue(totalAffiches, totalCatalogue) {
  const el = document.getElementById('library-context');
  if (!el) return;

  if (filtres.collection === 'tout') {
    el.style.display = 'none';
    el.innerHTML = '';
    return;
  }

  const total = Number(totalCatalogue || 0);
  const affiches = Number(totalAffiches || 0);
  const masques = Math.max(total - affiches, 0);
  const collectionLabel = filtres.collection === 'patrimoine'
    ? 'le patrimoine et les imports'
    : 'les œuvres publiées par les auteurs Kalamundi';

  el.style.display = 'flex';
  el.innerHTML = `
    <div>
      <strong>Rayon sélectionné :</strong> ${collectionLabel}.
      ${masques > 0 ? `<span>${formatNombre(masques)} autre${masques > 1 ? 's' : ''} œuvre${masques > 1 ? 's' : ''} restent masquée${masques > 1 ? 's' : ''} par ce filtre.</span>` : ''}
    </div>
    <a href="/pages/library.html?collection=tout" class="btn btn--outline btn--sm">Tout afficher</a>
  `;
}

/* ============================================================
   CARTE ŒUVRE — notice bibliographique complète
   Champs Dublin Core affichés : titre, auteur, langue, genre, date, droits
   ============================================================ */

function carteOeuvre(o) {
  const auteur  = o.profiles?.nom  || 'Auteur anonyme';
  const pays    = o.profiles?.pays || '';
  const genre   = o.genre?.toLowerCase() || '';
  const cfg     = GENRES[genre] || { label: o.genre || 'Œuvre', couleur: '#2D6A4F', emoji: '📖' };
  const langue  = LANGUES[o.langue_originale] || { nom: o.langue_originale || '?', drapeau: '🌐' };
  const estAfricain = pays && PAYS_AFRICAINS.has(pays);
  const annee   = o.created_at ? new Date(o.created_at).getFullYear() : '';
  const note    = o.note_moyenne ? `⭐ ${Number(o.note_moyenne).toFixed(1)}` : '';
  const lectures = o.nb_lectures ? `👁 ${formatNombre(o.nb_lectures)}` : '';
  const estImporte = estOeuvreImportee(o);

  // Couverture : image réelle, générée automatiquement, ou emoji fallback
  const auteurNom = o.profiles?.nom || '';
  const genreKey  = (o.genre || '').toLowerCase();
  const coverFallbackB64 = genererCouverture(o.titre, auteurNom, genreKey, 300, 420);
  const coverUrl = normaliserUrlImage(o.couverture_url);
  const couverture = coverUrl
    ? `<img src="${echapperAttr(coverUrl)}" alt="Couverture — ${echapperAttr(o.titre)}" loading="lazy" decoding="async" referrerpolicy="no-referrer"
           onerror="this.onerror=null;this.src='${coverFallbackB64}'" />`
    : `<img src="${coverFallbackB64}" alt="Couverture générée — ${echapperAttr(o.titre)}" loading="lazy" decoding="async" />`;

  // Badge licence (dc:rights)
  const badgeLicence = o.statut === 'premium'
    ? '<span class="book-badge book-badge--premium">⭐ Premium</span>'
    : '<span class="book-badge book-badge--free">🆓 Gratuit</span>';

  // Badge auteur africain (Dewey 896)
  const badgeAfrique = estAfricain
    ? '<span class="book-badge book-badge--africa">🌍 Afrique</span>'
    : '';
  const badgeImport = estImporte
    ? '<span class="book-badge book-badge--import">Patrimoine</span>'
    : '';

  return `
    <a href="/pages/work.html?id=${o.id}" class="book-card ${estImporte ? 'book-card--import' : 'book-card--original'}" aria-label="${echapperAttr(o.titre)} par ${echapperAttr(auteur)}">

      <!-- Couverture avec couleur genre -->
      <div class="book-card__cover" style="--genre-color:${cfg.couleur}">
        ${couverture}
        <div class="book-card__cover-badges">
          ${badgeLicence}
          ${badgeImport}
        </div>
      </div>

      <!-- Notice bibliographique -->
      <div class="book-card__body">

        <!-- Genre (BISAC) -->
        <div class="book-card__genre" style="color:${cfg.couleur}">${cfg.label}</div>

        <!-- Titre principal (dc:title) -->
        <h3 class="book-card__title">${echapperHtml(o.titre)}</h3>

        <!-- Auteur + pays (dc:creator) -->
        <div class="book-card__author">
          ${echapperHtml(auteur)}${pays ? ` · <span class="book-card__pays">${echapperHtml(pays)}</span>` : ''}
          ${estAfricain ? badgeAfrique : ''}
        </div>

        <!-- Résumé (dc:description) -->
        ${o.resume ? `<p class="book-card__resume">${echapperHtml(truncate(o.resume, 100))}</p>` : ''}

        <!-- Métadonnées bibliographiques -->
        <div class="book-card__meta">
          <!-- Langue originale (dc:language ISO 639-1) -->
          <span class="book-card__langue" title="Langue originale : ${langue.nom}">
            ${langue.drapeau} ${o.langue_originale?.toUpperCase() || '?'}
          </span>
          ${lectures ? `<span>${lectures}</span>` : ''}
          ${note    ? `<span>${note}</span>`    : ''}
          ${annee   ? `<span class="book-card__annee">${annee}</span>` : ''}
        </div>

      </div>
    </a>`;
}

/* ============================================================
   PAGINATION
   ============================================================ */

function rendrePagination(total) {
  const totalPages = Math.ceil(total / LIMIT);
  if (totalPages <= 1) {
    document.getElementById('pagination').innerHTML = '';
    return;
  }
  const el = document.getElementById('pagination');
  let html = '';

  if (filtres.page > 1)
    html += `<button class="pagination__btn" data-page="${filtres.page - 1}" aria-label="Page précédente">←</button>`;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - filtres.page) <= 2) {
      html += `<button class="pagination__btn ${i === filtres.page ? 'pagination__btn--active' : ''}"
        data-page="${i}" aria-label="Page ${i}"${i === filtres.page ? ' aria-current="page"' : ''}>${i}</button>`;
    } else if (Math.abs(i - filtres.page) === 3) {
      html += `<span class="pagination__ellipsis">…</span>`;
    }
  }

  if (filtres.page < totalPages)
    html += `<button class="pagination__btn" data-page="${filtres.page + 1}" aria-label="Page suivante">→</button>`;

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
   DESCRIPTION CATÉGORIE
   ============================================================ */

function afficherDescCategorie() {
  const descEl = document.getElementById('lib-cat-desc');
  const cat    = CATEGORIES[filtres.categorie];
  if (!cat) { descEl.style.display = 'none'; return; }
  descEl.style.display = 'block';
  descEl.innerHTML = `
    <div class="lib-cat-banner" style="border-left-color:${cat.couleur}">
      <strong>${cat.label}</strong> — ${cat.desc}
    </div>`;
}

/* ============================================================
   FILTRES ACTIFS — affichage des chips de filtre actifs
   ============================================================ */

function afficherFiltresActifs() {
  const el = document.getElementById('active-filters');
  const chips = [];

  if (filtres.langue) {
    const l = LANGUES[filtres.langue];
    chips.push({ label: `Langue : ${l ? l.drapeau + ' ' + l.nom : filtres.langue}`, key: 'langue' });
  }
  if (filtres.genre) {
    const g = GENRES[filtres.genre];
    chips.push({ label: `Genre : ${g ? g.label : filtres.genre}`, key: 'genre' });
  }
  if (filtres.statut) {
    chips.push({ label: filtres.statut === 'gratuit' ? '🆓 Gratuit' : '⭐ Premium', key: 'statut' });
  }
  if (filtres.pays) {
    chips.push({ label: `Pays : ${filtres.pays}`, key: 'pays' });
  }
  if (filtres.collection !== 'originaux') {
    const label = filtres.collection === 'patrimoine' ? 'Patrimoine / imports' : 'Tout le catalogue';
    chips.push({ label: `Rayon : ${label}`, key: 'collection' });
  }
  if (filtres.recherche) {
    chips.push({ label: `"${filtres.recherche}"`, key: 'recherche' });
  }

  if (!chips.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = chips.map(c => `
    <button class="active-filter-chip" data-key="${c.key}" aria-label="Retirer le filtre : ${c.label}">
      ${c.label} ✕
    </button>`).join('');

  el.querySelectorAll('.active-filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      filtres[key] = key === 'collection' ? 'originaux' : '';
      if (key === 'langue') document.getElementById('filter-langue').value = '';
      if (key === 'pays')   document.getElementById('filter-pays').value   = '';
      if (key === 'statut') document.querySelector('input[name="statut"][value=""]').checked = true;
      if (key === 'collection') document.querySelector('input[name="collection"][value="originaux"]').checked = true;
      if (key === 'recherche') document.getElementById('search-input').value = '';
      filtres.page = 1;
      chargerOeuvres();
    });
  });
}

/* ============================================================
   GENRES SIDEBAR — mis à jour selon onglet actif
   ============================================================ */

function mettreAJourSidebarGenres() {
  const conteneur = document.getElementById('sidebar-genres');
  const cat       = CATEGORIES[filtres.categorie];
  const genres    = cat?.genres?.length ? cat.genres : Object.keys(GENRES);

  conteneur.innerHTML = `
    <label class="lib-radio ${!filtres.genre ? 'is-active' : ''}">
      <input type="radio" name="genre" value="" ${!filtres.genre ? 'checked' : ''} />
      Tous
    </label>
    ${genres.map(g => {
      const cfg = GENRES[g];
      if (!cfg) return '';
      return `
        <label class="lib-radio ${filtres.genre === g ? 'is-active' : ''}">
          <input type="radio" name="genre" value="${g}" ${filtres.genre === g ? 'checked' : ''} />
          <span style="color:${cfg.couleur}">${cfg.emoji}</span> ${cfg.label}
        </label>`;
    }).join('')}`;

  conteneur.querySelectorAll('input[name="genre"]').forEach(radio => {
    radio.addEventListener('change', () => {
      filtres.genre = radio.value;
      filtres.page  = 1;
      conteneur.querySelectorAll('.lib-radio').forEach(l => l.classList.remove('is-active'));
      radio.closest('.lib-radio')?.classList.add('is-active');
      chargerOeuvres();
    });
  });
}

/* ============================================================
   SYNC UI — remplir les contrôles depuis l'état des filtres
   ============================================================ */

function syncUI() {
  document.querySelectorAll('.lib-radio').forEach(r => r.classList.remove('is-active'));

  // Onglets catégorie
  document.querySelectorAll('.lib-tab').forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.cat === filtres.categorie);
    tab.setAttribute('aria-selected', tab.dataset.cat === filtres.categorie ? 'true' : 'false');
  });

  // Champs
  if (filtres.recherche) document.getElementById('search-input').value = filtres.recherche;
  if (filtres.langue)    document.getElementById('filter-langue').value  = filtres.langue;
  if (filtres.pays)      document.getElementById('filter-pays').value    = filtres.pays;

  // Rayon
  const collectionRadio = document.querySelector(`input[name="collection"][value="${filtres.collection}"]`);
  if (collectionRadio) {
    collectionRadio.checked = true;
    collectionRadio.closest('.lib-radio')?.classList.add('is-active');
  }

  // Tri
  const triRadio = document.querySelector(`input[name="tri"][value="${filtres.tri}"]`);
  if (triRadio) {
    triRadio.checked = true;
    triRadio.closest('.lib-radio')?.classList.add('is-active');
  }

  // Statut
  const statutRadio = document.querySelector(`input[name="statut"][value="${filtres.statut}"]`);
  if (statutRadio) {
    statutRadio.checked = true;
    statutRadio.closest('.lib-radio')?.classList.add('is-active');
  }

  afficherDescCategorie();
  mettreAJourSidebarGenres();
}

/* ============================================================
   ÉVÉNEMENTS
   ============================================================ */

// Onglets BISAC
document.querySelectorAll('.lib-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    filtres.categorie = tab.dataset.cat;
    filtres.genre     = '';
    filtres.page      = 1;
    filtres.collection = tab.dataset.cat === 'patrimoine' ? 'patrimoine' : 'originaux';
    // Réinitialiser le filtre statut si on quittait "patrimoine"
    if (filtres.statut === 'gratuit' && tab.dataset.cat !== 'patrimoine') {
      filtres.statut = '';
      document.querySelector('input[name="statut"][value=""]').checked = true;
    }
    syncUI();
    chargerOeuvres();
  });
});

// Rayon catalogue
document.querySelectorAll('input[name="collection"]').forEach(radio => {
  radio.addEventListener('change', () => {
    filtres.collection = radio.value;
    filtres.page = 1;
    if (radio.value !== 'patrimoine' && filtres.categorie === 'patrimoine') {
      filtres.categorie = '';
    }
    document.querySelectorAll('input[name="collection"]').forEach(r =>
      r.closest('.lib-radio')?.classList.toggle('is-active', r === radio));
    syncUI();
    chargerOeuvres();
  });
});

// Tri
document.querySelectorAll('input[name="tri"]').forEach(radio => {
  radio.addEventListener('change', () => {
    filtres.tri  = radio.value;
    filtres.page = 1;
    document.querySelectorAll('input[name="tri"]').forEach(r =>
      r.closest('.lib-radio')?.classList.toggle('is-active', r === radio));
    chargerOeuvres();
  });
});

// Statut
document.querySelectorAll('input[name="statut"]').forEach(radio => {
  radio.addEventListener('change', () => {
    filtres.statut = radio.value;
    filtres.page   = 1;
    document.querySelectorAll('input[name="statut"]').forEach(r =>
      r.closest('.lib-radio')?.classList.toggle('is-active', r === radio));
    chargerOeuvres();
  });
});

// Langue
document.getElementById('filter-langue')?.addEventListener('change', e => {
  filtres.langue = e.target.value;
  filtres.page   = 1;
  chargerOeuvres();
});

// Pays
document.getElementById('filter-pays')?.addEventListener('change', e => {
  filtres.pays = e.target.value;
  filtres.page = 1;
  chargerOeuvres();
});

// Recherche (debounce 400ms)
const rechercheDebounce = debounce(() => {
  filtres.recherche = document.getElementById('search-input').value.trim();
  filtres.page      = 1;
  chargerOeuvres();
}, 400);
document.getElementById('search-input')?.addEventListener('input', rechercheDebounce);

// Reset
document.getElementById('reset-filters')?.addEventListener('click', () => {
  filtres.categorie = '';
  filtres.collection = 'originaux';
  filtres.genre     = '';
  filtres.langue    = '';
  filtres.statut    = '';
  filtres.pays      = '';
  filtres.tri       = 'recent';
  filtres.page      = 1;
  filtres.recherche = '';
  document.getElementById('search-input').value  = '';
  document.getElementById('filter-langue').value  = '';
  document.getElementById('filter-pays').value    = '';
  document.querySelector('input[name="tri"][value="recent"]').checked  = true;
  document.querySelector('input[name="collection"][value="originaux"]').checked  = true;
  document.querySelector('input[name="statut"][value=""]').checked     = true;
  syncUI();
  chargerOeuvres();
});

// Bouton mobile filtres
document.getElementById('btn-mobile-filters')?.addEventListener('click', () => {
  document.getElementById('lib-sidebar').classList.toggle('is-open');
});

injecterPub('library');
