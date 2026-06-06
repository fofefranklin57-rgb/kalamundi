/* ============================================================
   institution.js — Espace Institutions Kalamundi
   ============================================================ */

import { getSession } from './auth.js';
import { api } from './api.js';

const zone = document.getElementById('zone-institution');
const heroCta = document.getElementById('hero-cta');

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initHamburger();
  const session = await getSession();
  if (!session) {
    afficherPublic();
  } else {
    await afficherEspaceConnecte(session.user);
  }
});

/* ============================================================
   NAVBAR
   ============================================================ */

async function initNavbar() {
  const session = await getSession();
  const actions = document.getElementById('navbar-actions');
  if (!actions) return;
  if (session) {
    actions.innerHTML = `
      <a href="/pages/author-dashboard.html" class="btn btn--outline btn--sm" style="color:white;border-color:rgba(255,255,255,0.5)">Mon espace</a>
    `;
  } else {
    actions.innerHTML = `
      <a href="/pages/login.html" class="btn btn--ghost btn--sm" style="color:rgba(255,255,255,0.85)">Connexion</a>
      <a href="/pages/login.html?mode=inscription" class="btn btn--accent btn--sm">S'inscrire</a>
    `;
  }
}

/* ============================================================
   VUE : non connecté
   ============================================================ */

function afficherPublic() {
  heroCta.innerHTML = `
    <a href="/pages/login.html?mode=inscription&role=institution" class="btn btn--accent btn--lg">Inscrire mon institution</a>
    <a href="/pages/login.html" class="btn btn--outline btn--lg" style="color:white;border-color:rgba(255,255,255,0.6)">J'ai déjà un compte</a>
  `;
  zone.innerHTML = `
    <div class="cta-box" style="max-width:600px;margin:auto;text-align:center">
      <h2 class="cta-box__title">Prêt à rejoindre ?</h2>
      <p class="cta-box__text">Créez un compte institution gratuit. Notre équipe vérifie votre demande sous 48h. Accès immédiat au catalogue dès validation.</p>
      <a href="/pages/login.html?mode=inscription&role=institution" class="btn btn--accent btn--lg">Commencer l'inscription</a>
    </div>
  `;
}

/* ============================================================
   VUE : connecté — vérifier si déjà institution
   ============================================================ */

async function afficherEspaceConnecte(user) {
  try {
    const institution = await api.getInstitution(user.id);
    if (institution) {
      afficherStatut(institution);
    } else {
      afficherFormulaire(user);
    }
  } catch (_) {
    afficherFormulaire(user);
  }
}

/* ============================================================
   VUE : statut de la demande
   ============================================================ */

function afficherStatut(inst) {
  heroCta.innerHTML = '';

  const badges = {
    en_attente: { label: '⏳ Demande en cours de vérification', cls: 'badge--warning' },
    verifie:    { label: '✅ Institution vérifiée',             cls: 'badge--success' },
    rejete:     { label: '❌ Demande rejetée',                  cls: 'badge--danger'  },
  };
  const b = badges[inst.statut_verification] || badges.en_attente;

  const dashboardLink = inst.statut_verification === 'verifie'
    ? `<a href="/pages/admin.html?institution=${inst.id}" class="btn btn--primary" style="margin-top:var(--spacing-md)">Accéder au tableau de bord</a>`
    : '';

  zone.innerHTML = `
    <div class="dashboard-header" style="flex-direction:column;align-items:flex-start">
      <h2 style="color:var(--color-primary);margin-bottom:var(--spacing-sm)">${inst.nom}</h2>
      <span class="badge ${b.cls}" style="font-size:var(--font-size-sm);padding:6px 14px">${b.label}</span>
    </div>

    <div class="features-grid" style="margin-top:var(--spacing-lg)">
      <div class="feature-card">
        <div class="feature-card__icon">🏷️</div>
        <h3 class="feature-card__title">Type</h3>
        <p class="feature-card__text">${inst.type || '—'}</p>
      </div>
      <div class="feature-card">
        <div class="feature-card__icon">🌍</div>
        <h3 class="feature-card__title">Pays</h3>
        <p class="feature-card__text">${inst.pays || '—'}</p>
      </div>
      <div class="feature-card">
        <div class="feature-card__icon">🌐</div>
        <h3 class="feature-card__title">Domaine</h3>
        <p class="feature-card__text">${inst.domaine || '—'}</p>
      </div>
    </div>

    ${dashboardLink}

    ${inst.statut_verification === 'rejete' ? `
      <div class="empty-state" style="margin-top:var(--spacing-xl)">
        <div class="empty-state__icon">📧</div>
        <p class="empty-state__title">Contactez-nous pour plus d'informations</p>
        <a href="mailto:institutions@kalamundi.com" class="btn btn--outline" style="margin-top:var(--spacing-md)">institutions@kalamundi.com</a>
      </div>
    ` : ''}
  `;
}

/* ============================================================
   VUE : formulaire d'inscription institution
   ============================================================ */

function afficherFormulaire(user) {
  heroCta.innerHTML = `
    <a href="/pages/library.html" class="btn btn--outline btn--lg" style="color:white;border-color:rgba(255,255,255,0.6)">Voir le catalogue</a>
  `;

  zone.innerHTML = `
    <div style="max-width:640px;margin:auto">
      <h2 style="color:var(--color-primary);margin-bottom:var(--spacing-xs)">Inscrire mon institution</h2>
      <p style="color:var(--text-light);margin-bottom:var(--spacing-xl)">
        Remplissez ce formulaire. Notre équipe vérifie votre demande sous 48h.
      </p>

      <form id="form-institution" novalidate>

        <div class="form-group">
          <label class="form-label" for="inst-nom">Nom de l'institution *</label>
          <input type="text" id="inst-nom" class="form-input" placeholder="Ex : École primaire La Lumière" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="inst-type">Type d'institution *</label>
          <select id="inst-type" class="form-input" required>
            <option value="">— Choisir —</option>
            <option value="ecole">École</option>
            <option value="universite">Université / Lycée</option>
            <option value="bibliotheque">Bibliothèque</option>
            <option value="ong">ONG / Association</option>
            <option value="entreprise">Entreprise</option>
            <option value="autre">Autre</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="inst-pays">Pays *</label>
          <input type="text" id="inst-pays" class="form-input" placeholder="Ex : Cameroun" required />
        </div>

        <div class="form-group">
          <label class="form-label" for="inst-domaine">Site web ou domaine (optionnel)</label>
          <input type="url" id="inst-domaine" class="form-input" placeholder="https://monecole.cm" />
        </div>

        <div id="form-error" class="toast toast--error" style="display:none;margin-bottom:var(--spacing-md)"></div>

        <button type="submit" class="btn btn--primary btn--lg" id="btn-submit" style="width:100%">
          Envoyer la demande
        </button>

      </form>
    </div>
  `;

  document.getElementById('form-institution').addEventListener('submit', (e) => soumettre(e, user));
}

/* ============================================================
   Soumission du formulaire
   ============================================================ */

async function soumettre(e, user) {
  e.preventDefault();
  const btn   = document.getElementById('btn-submit');
  const errEl = document.getElementById('form-error');

  const nom     = document.getElementById('inst-nom').value.trim();
  const type    = document.getElementById('inst-type').value;
  const pays    = document.getElementById('inst-pays').value.trim();
  const domaine = document.getElementById('inst-domaine').value.trim();

  if (!nom || !type || !pays) {
    errEl.textContent = 'Veuillez remplir tous les champs obligatoires.';
    errEl.style.display = 'block';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Envoi en cours…';
  errEl.style.display = 'none';

  try {
    const inst = await api.creerInstitution({ user_id: user.id, nom, type, pays, domaine: domaine || null });
    afficherStatut(inst);
    afficherToast('Demande envoyée ! Notre équipe vous répond sous 48h.', 'success');
  } catch (err) {
    errEl.textContent = 'Une erreur est survenue. Veuillez réessayer.';
    errEl.style.display = 'block';
    btn.disabled    = false;
    btn.textContent = 'Envoyer la demande';
    console.error(err);
  }
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
  setTimeout(() => toast.remove(), 4500);
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
