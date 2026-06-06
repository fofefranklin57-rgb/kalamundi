/* ============================================================
   author-dashboard.js — Tableau de bord auteur
   Kalamundi — La Plume du Monde
   ============================================================ */

import { protegerRoute } from './auth.js';
import { api } from './api.js';
import { formatNombre, formatMontant, formatDateCourt, dureeDepuis, toastSucces, toastErreur } from './utils.js';

/* ============================================================
   État
   ============================================================ */

const etat = {
  profil:   null,
  oeuvres:  [],
  revenus:  [],
  oeuvreASupprimer: null,
};

/* ============================================================
   Init
   ============================================================ */

(async () => {
  const session = await protegerRoute();
  if (!session) return;

  const userId = session.user?.id || session.id;

  try {
    const [profil, stats] = await Promise.all([
      api.getProfil(userId),
      api.getStatsAuteur(userId),
    ]);
    etat.profil  = profil;
    etat.oeuvres = stats.oeuvres || [];

    rendreHeader(profil);
    rendreStats(stats);
    rendreOeuvres(etat.oeuvres);

    /* Charger les revenus en arrière-plan */
    api.getRevenus(userId).then(rev => {
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
})();

/* ============================================================
   Navbar
   ============================================================ */

function initNavbar(profil) {
  const actions = document.getElementById('navbar-actions');
  if (!actions) return;
  const initiales = (profil?.nom || '?').charAt(0).toUpperCase();
  actions.innerHTML = `
    <a href="/pages/author-profile.html" class="btn btn--ghost btn--sm" style="color:rgba(255,255,255,0.85)">
      <span style="width:28px;height:28px;border-radius:50%;background:var(--color-accent);display:inline-flex;align-items:center;justify-content:center;font-weight:bold;font-size:12px;color:#1a1a1a">${initiales}</span>
    </a>
  `;
}

/* ============================================================
   En-tête
   ============================================================ */

function rendreHeader(profil) {
  if (!profil) return;
  const nom  = profil.nom || 'Auteur';
  const role = profil.role === 'auteur' ? '✍️ Auteur' : profil.role === 'admin' ? '🛡️ Admin' : '📖 Lecteur';

  document.getElementById('nom-auteur').textContent  = nom;
  document.getElementById('role-auteur').textContent = role;

  const avatarEl = document.getElementById('avatar-auteur');
  if (profil.photo_url) {
    avatarEl.outerHTML = `<img src="${profil.photo_url}" alt="${nom}" class="avatar avatar--lg">`;
  } else {
    avatarEl.textContent = nom.charAt(0).toUpperCase();
  }
}

/* ============================================================
   Statistiques
   ============================================================ */

function rendreStats(stats) {
  document.getElementById('stat-nb-oeuvres').textContent = stats.nbOeuvres ?? '0';
  document.getElementById('stat-lectures').textContent   = formatNombre(stats.totalLectures ?? 0);

  /* Note moyenne pondérée */
  const notesMoyennes = (stats.oeuvres || [])
    .filter(o => o.note_moyenne)
    .map(o => o.note_moyenne);
  const noteMoyenne = notesMoyennes.length
    ? (notesMoyennes.reduce((a, b) => a + b, 0) / notesMoyennes.length).toFixed(1)
    : '—';
  document.getElementById('stat-note').textContent = noteMoyenne !== '—' ? `⭐ ${noteMoyenne}` : '—';

  document.getElementById('stat-revenus').textContent =
    stats.revenus?.total ? formatMontant(stats.revenus.total) : '0,00 $';
}

/* ============================================================
   Liste des œuvres
   ============================================================ */

function rendreOeuvres(oeuvres) {
  const conteneur = document.getElementById('liste-oeuvres');
  if (!oeuvres.length) {
    conteneur.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">✍️</div>
        <p class="empty-state__title">Aucune œuvre publiée</p>
        <p class="empty-state__text">Publiez votre première œuvre et commencez à toucher des lecteurs du monde entier.</p>
        <a href="/pages/publish.html" class="btn btn--primary">Publier une œuvre</a>
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
                data-id="${o.id}" data-titre="${o.titre || 'Sans titre'}"
                title="Supprimer">🗑</button>
      </div>
    </div>
  `).join('');

  /* Listeners suppression */
  conteneur.querySelectorAll('.btn-supprimer').forEach(btn => {
    btn.addEventListener('click', () => ouvrirModalSupprimer(btn.dataset.id, btn.dataset.titre));
  });
}

/* ============================================================
   Revenus
   ============================================================ */

function rendreRevenus(revenus) {
  /* Résumé */
  const total    = revenus.reduce((s, r) => s + Number(r.montant || 0), 0);
  const attente  = revenus.filter(r => r.statut === 'en_attente')
                          .reduce((s, r) => s + Number(r.montant || 0), 0);
  document.getElementById('rev-total').textContent  = formatMontant(total);
  document.getElementById('rev-attente').textContent = formatMontant(attente);

  const conteneur = document.getElementById('liste-revenus');
  if (!revenus.length) return; /* empty state déjà en place */

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
        </div>
      `).join('')}
    </div>
  `;
}

/* ============================================================
   Tabs
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
   Modal suppression
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
   Hamburger mobile
   ============================================================ */

function initNavbarMobile() {
  const toggle = document.getElementById('navbar-toggle');
  const menu   = document.getElementById('navbar-nav');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
}
