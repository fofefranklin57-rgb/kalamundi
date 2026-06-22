/* ============================================================
   epreuves.js — Espace Etudiant : browse epreuves & fax
   Kalamundi
   ============================================================ */

import { supabase } from './auth.js';
import { toast, toastErreur, qs } from './utils.js';

/* ── Etat ───────────────────────────────────────────────────── */
const etat = {
  cat:      '',
  etab:     '',
  type:     '',
  annee:    '',
  fax:      '',
  search:   '',
  page:     1,
  perPage:  24,
  total:    0,
};

const TYPES_LABELS = {
  cc:             'CC',
  session_normale:'Session',
  rattrapage:     'Rattrapage',
  concours:       'Concours',
  partiel:        'Partiel',
  td:             'TD',
  tp:             'TP',
};

const CAT_ICONS = {
  droit_sciences_juridiques:   '⚖️',
  medecine_sante:              '🏥',
  sciences_exactes:            '📐',
  sciences_humaines:           '🌍',
  lettres_langues:             '📖',
  economie_gestion:            '📈',
  informatique_tech:           '💻',
  sciences_education:          '📚',
  agronomie:                   '🌱',
  architecture:                '🏛️',
  concours_grandes_ecoles:     '🏆',
  concours_fonctions_publiques:'🏢',
  autre:                       '📋',
};

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  await Promise.all([
    chargerEtablissements(),
    chargerAnnees(),
    chargerStats(),
  ]);
  initFiltres();
  await chargerEpreuves();
});

/* ── Navbar ─────────────────────────────────────────────────── */
function initNavbar() {
  const toggle = qs('#nav-toggle');
  const menu   = qs('#nav-menu');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
  import('./auth.js').then(({ getUser }) => {
    getUser().then(u => {
      const a = qs('#navbar-actions');
      if (!a) return;
      a.innerHTML = u
        ? `<a href="/pages/author-dashboard.html" class="btn btn--ghost btn--sm">Mon espace</a>`
        : `<a href="/pages/login.html" class="btn btn--ghost btn--sm">Connexion</a>`;
    });
  }).catch(() => {});
}

/* ── Stats hero ─────────────────────────────────────────────── */
async function chargerStats() {
  try {
    const [{ count: nbEp }, { count: nbFax }, { count: nbFil }] = await Promise.all([
      supabase.from('epreuves').select('*', { count:'exact', head:true }).eq('visible', true),
      supabase.from('corriges').select('*', { count:'exact', head:true }).eq('visible', true),
      supabase.from('filieres').select('*', { count:'exact', head:true }).eq('actif', true),
    ]);
    qs('#stat-epreuves').textContent = (nbEp || 0).toLocaleString('fr-FR');
    qs('#stat-fax').textContent      = (nbFax || 0).toLocaleString('fr-FR');
    qs('#stat-filieres').textContent = (nbFil || 0).toLocaleString('fr-FR');
  } catch { /* silencieux */ }
}

/* ── Etablissements ─────────────────────────────────────────── */
async function chargerEtablissements() {
  const { data } = await supabase
    .from('etablissements')
    .select('id, nom_court, nom, type')
    .eq('actif', true)
    .order('nom_court');

  if (!data?.length) return;
  const sel = qs('#f-etab');
  const groupes = {};
  data.forEach(e => {
    const g = e.type;
    if (!groupes[g]) groupes[g] = [];
    groupes[g].push(e);
  });
  const labelsGroupes = {
    universite:   'Universites',
    grande_ecole: 'Grandes Ecoles',
    iut:          'IUT',
    preparatoire: 'Classes Preparatoires',
    national:     'Concours Nationaux',
  };
  Object.entries(groupes).forEach(([g, items]) => {
    const grp = document.createElement('optgroup');
    grp.label = labelsGroupes[g] || g;
    items.forEach(e => {
      const opt = document.createElement('option');
      opt.value       = e.id;
      opt.textContent = `${e.nom_court || ''} — ${e.nom}`;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });
}

/* ── Annees ─────────────────────────────────────────────────── */
async function chargerAnnees() {
  const { data } = await supabase
    .from('epreuves')
    .select('annee')
    .eq('visible', true)
    .order('annee', { ascending: false });

  if (!data) return;
  const annees = [...new Set(data.map(r => r.annee))];
  const sel = qs('#f-annee');
  annees.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a;
    opt.textContent = a;
    sel.appendChild(opt);
  });
}

/* ── Filtres ─────────────────────────────────────────────────── */
function initFiltres() {
  /* Onglets catégorie */
  document.querySelectorAll('.cat-btn[data-cat]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      etat.cat  = btn.dataset.cat;
      etat.page = 1;
      chargerEpreuves();
    });
  });

  /* Selects */
  ['#f-etab','#f-type','#f-annee','#f-fax'].forEach(sel => {
    qs(sel)?.addEventListener('change', e => {
      const key = sel.replace('#f-','');
      etat[key] = e.target.value;
      etat.page = 1;
      chargerEpreuves();
    });
  });

  /* Recherche */
  let searchTimer;
  qs('#f-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      etat.search = e.target.value.trim();
      etat.page   = 1;
      chargerEpreuves();
    }, 350);
  });

  /* Reset */
  qs('#f-reset-btn')?.addEventListener('click', () => {
    etat.cat = etat.etab = etat.type = etat.annee = etat.fax = etat.search = '';
    etat.page = 1;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.cat-btn[data-cat=""]')?.classList.add('active');
    ['#f-etab','#f-type','#f-annee','#f-fax'].forEach(s => { if(qs(s)) qs(s).value=''; });
    if(qs('#f-search')) qs('#f-search').value = '';
    chargerEpreuves();
  });
}

/* ── Chargement épreuves ────────────────────────────────────── */
async function chargerEpreuves() {
  const grid = qs('#ep-grid');
  const vide = qs('#ep-vide');
  const count = qs('#ep-count');

  grid.innerHTML = Array(6).fill('<div class="skel-card skeleton"></div>').join('');
  vide.style.display = 'none';

  try {
    let query = supabase
      .from('epreuves')
      .select(`
        id, matiere, annee, semestre, type_epreuve, a_corrige, nb_vues, nb_telechargements,
        filieres!inner(id, nom, categorie, icone, etablissement_id,
          etablissements(nom_court, nom, type))
      `, { count: 'exact' })
      .eq('visible', true)
      .order('annee', { ascending: false })
      .order('matiere');

    if (etat.cat)    query = query.eq('filieres.categorie', etat.cat);
    if (etat.etab)   query = query.eq('filieres.etablissement_id', etat.etab);
    if (etat.type)   query = query.eq('type_epreuve', etat.type);
    if (etat.annee)  query = query.eq('annee', parseInt(etat.annee));
    if (etat.fax === '1') query = query.eq('a_corrige', true);
    if (etat.fax === '0') query = query.eq('a_corrige', false);
    if (etat.search) {
      query = query.or(`matiere.ilike.%${etat.search}%`);
    }

    const debut = (etat.page - 1) * etat.perPage;
    query = query.range(debut, debut + etat.perPage - 1);

    const { data, error, count: total } = await query;
    if (error) throw error;

    etat.total = total || 0;
    count.textContent = `${etat.total.toLocaleString('fr-FR')} epreuve${etat.total > 1 ? 's' : ''}`;

    if (!data?.length) {
      grid.innerHTML    = '';
      vide.style.display = 'block';
      qs('#ep-pagination').innerHTML = '';
      return;
    }

    grid.innerHTML = data.map(ep => rendreCarte(ep)).join('');
    rendrePagination();

  } catch (e) {
    grid.innerHTML = `<div style="padding:2rem;color:var(--color-error)">Erreur : ${e.message}</div>`;
  }
}

/* ── Carte épreuve ──────────────────────────────────────────── */
function rendreCarte(ep) {
  const fil   = ep.filieres;
  const etab  = fil?.etablissements;
  const icon  = fil?.icone || CAT_ICONS[fil?.categorie] || '📋';
  const typeL = TYPES_LABELS[ep.type_epreuve] || ep.type_epreuve;
  const faxBadge = ep.a_corrige
    ? `<span class="badge badge--fax">Fax dispo</span>`
    : `<span class="badge badge--fax-ia">Fax IA</span>`;

  return `
    <a class="ep-card" href="/pages/fax.html?ep=${ep.id}" aria-label="${ep.matiere} ${ep.annee}">
      <div class="ep-card__header">
        <div class="ep-card__icon">${icon}</div>
        <div class="ep-card__meta">
          <div class="ep-card__matiere">${ep.matiere}</div>
          <div class="ep-card__filiere">${fil?.nom || '—'}</div>
        </div>
      </div>
      <div class="ep-card__badges">
        <span class="badge badge--annee">${ep.annee}</span>
        <span class="badge badge--type">${typeL}</span>
        ${ep.semestre && ep.semestre !== 'Non précisé' ? `<span class="badge badge--sem">${ep.semestre}</span>` : ''}
        ${faxBadge}
      </div>
      <div class="ep-card__footer">
        <span class="ep-card__etab">${etab?.nom_court || ''}</span>
        <span class="ep-card__cta">Voir le fax →</span>
      </div>
    </a>`;
}

/* ── Pagination ─────────────────────────────────────────────── */
function rendrePagination() {
  const pag   = qs('#ep-pagination');
  const pages = Math.ceil(etat.total / etat.perPage);
  if (pages <= 1) { pag.innerHTML = ''; return; }

  let html = '';
  if (etat.page > 1) html += `<button class="btn btn--outline btn--sm" onclick="window._goPage(${etat.page-1})">← Precedent</button>`;
  html += `<span style="font-size:var(--font-size-sm);color:var(--text-secondary);padding:8px 12px">Page ${etat.page} / ${pages}</span>`;
  if (etat.page < pages) html += `<button class="btn btn--outline btn--sm" onclick="window._goPage(${etat.page+1})">Suivant →</button>`;
  pag.innerHTML = html;
}

window._goPage = function(p) {
  etat.page = p;
  chargerEpreuves();
  window.scrollTo({ top: 0, behavior: 'smooth' });
};
