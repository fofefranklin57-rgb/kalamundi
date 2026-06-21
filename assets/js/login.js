/* ============================================================
   login.js — Logique page connexion / inscription
   Kalamundi — La Plume du Monde
   ============================================================ */

import {
  connexion,
  inscription,
  connexionGoogle,
  resetPassword,
  updatePassword,
  getSession,
} from './auth.js';
import { supabase } from './auth.js';

/* ============================================================
   Détecter mode reset mot de passe (lien email Supabase)
   ============================================================ */

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') {
    // Masquer les tabs, afficher uniquement le formulaire reset
    document.querySelector('.login-tabs').classList.add('hidden');
    afficherForm('reset');
    cacherAlertes();
  }
});

/* ============================================================
   Rediriger si déjà connecté (sauf si on est en mode reset)
   ============================================================ */

(async () => {
  const params = new URLSearchParams(window.location.search);
  const hash   = window.location.hash;
  // Laisser onAuthStateChange gérer le reset (PKCE = ?code=, ancien = #type=recovery)
  if (params.has('code') || hash.includes('type=recovery')) return;
  const session = await getSession();
  if (session) {
    const redirect = params.get('redirect');
    window.location.href = redirect || '/index.html';
  }
})();

/* ============================================================
   Éléments DOM
   ============================================================ */

const tabs       = document.querySelectorAll('.tab[data-tab]');
const forms      = document.querySelectorAll('.login-form[data-form]');
const alertEl    = document.querySelector('.login-alert');
const successEl  = document.querySelector('.login-success');

/* ============================================================
   Tabs
   ============================================================ */

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const cible = tab.dataset.tab;
    tabs.forEach(t => { t.classList.remove('tab--active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('tab--active');
    tab.setAttribute('aria-selected', 'true');
    afficherForm(cible);
    cacherAlertes();
  });
});

function afficherForm(nom) {
  forms.forEach(f => f.classList.toggle('hidden', f.dataset.form !== nom));
}

/* ============================================================
   Alertes
   ============================================================ */

function afficherErreur(msg) {
  alertEl.textContent = msg;
  alertEl.classList.remove('hidden');
  successEl.classList.add('hidden');
}

function afficherSucces(msg) {
  successEl.textContent = msg;
  successEl.classList.remove('hidden');
  alertEl.classList.add('hidden');
}

function cacherAlertes() {
  alertEl.classList.add('hidden');
  successEl.classList.add('hidden');
}

/* ============================================================
   Toggle mot de passe
   ============================================================ */

document.querySelectorAll('.input-password__toggle').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling;
    input.type = input.type === 'password' ? 'text' : 'password';
    btn.textContent = input.type === 'password' ? '👁' : '🙈';
  });
});

/* ============================================================
   Indicateur de force du mot de passe
   ============================================================ */

const regPassword   = document.getElementById('reg-password');
const strengthEl    = document.querySelector('.password-strength');

if (regPassword) {
  regPassword.addEventListener('input', () => {
    const val = regPassword.value;
    let force = 0;
    if (val.length >= 8)                    force++;
    if (/[A-Z]/.test(val))                  force++;
    if (/[0-9]/.test(val))                  force++;
    if (/[^A-Za-z0-9]/.test(val))           force++;

    const labels = ['', 'Faible', 'Moyen', 'Fort', 'Très fort'];
    const classes = ['', 'weak', 'moyen', 'fort', 'fort'];
    strengthEl.textContent  = val.length ? `Force : ${labels[force]}` : '';
    strengthEl.className    = `password-strength${val.length ? ' password-strength--' + classes[force] : ''}`;
  });
}

/* ============================================================
   Formulaire connexion
   ============================================================ */

const formConnexion = document.querySelector('[data-form="connexion"]');
formConnexion.addEventListener('submit', async (e) => {
  e.preventDefault();
  cacherAlertes();
  const btn = formConnexion.querySelector('[type="submit"]');
  btn.classList.add('btn--loading');
  btn.disabled = true;

  try {
    const email    = formConnexion.querySelector('[name="email"]').value.trim();
    const password = formConnexion.querySelector('[name="password"]').value;
    await connexion(email, password);
    const redirect = new URLSearchParams(window.location.search).get('redirect');
    window.location.href = redirect || '/index.html';
  } catch (err) {
    afficherErreur(err.message);
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
});

/* ============================================================
   Formulaire inscription
   ============================================================ */

const formInscription = document.querySelector('[data-form="inscription"]');
formInscription.addEventListener('submit', async (e) => {
  e.preventDefault();
  cacherAlertes();

  const nom      = formInscription.querySelector('[name="nom"]').value.trim();
  const email    = formInscription.querySelector('[name="email"]').value.trim();
  const password = formInscription.querySelector('[name="password"]').value;
  const cgu      = formInscription.querySelector('[name="cgu"]').checked;

  if (!nom)              return afficherErreur('Saisis ton prénom ou pseudonyme.');
  if (!email)            return afficherErreur('Saisis ton adresse email.');
  if (password.length < 8) return afficherErreur('Le mot de passe doit faire au moins 8 caractères.');
  if (!cgu)              return afficherErreur('Tu dois accepter les conditions d\'utilisation.');

  const btn = formInscription.querySelector('[type="submit"]');
  btn.classList.add('btn--loading');
  btn.disabled = true;

  try {
    await inscription(email, password, nom);
    afficherSucces('Compte créé ! Vérifie ton email pour confirmer ton inscription.');
    formInscription.reset();
  } catch (err) {
    afficherErreur(err.message);
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
});

/* ============================================================
   Formulaire nouveau mot de passe (reset)
   ============================================================ */

const formReset = document.querySelector('[data-form="reset"]');
formReset.addEventListener('submit', async (e) => {
  e.preventDefault();
  cacherAlertes();
  const password = formReset.querySelector('[name="password"]').value;
  if (password.length < 8) return afficherErreur('Le mot de passe doit faire au moins 8 caractères.');

  const btn = formReset.querySelector('[type="submit"]');
  btn.classList.add('btn--loading');
  btn.disabled = true;

  try {
    await updatePassword(password);
    afficherSucces('Mot de passe mis à jour ! Tu peux maintenant te connecter.');
    formReset.reset();
    setTimeout(() => {
      document.querySelector('.login-tabs').classList.remove('hidden');
      afficherForm('connexion');
    }, 2000);
  } catch (err) {
    afficherErreur(err.message);
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
});

/* ============================================================
   Mot de passe oublié
   ============================================================ */

const formForgot = document.querySelector('[data-form="forgot"]');
formForgot.addEventListener('submit', async (e) => {
  e.preventDefault();
  cacherAlertes();
  const email = formForgot.querySelector('[name="email"]').value.trim();
  if (!email) return afficherErreur('Saisis ton adresse email.');

  const btn = formForgot.querySelector('[type="submit"]');
  btn.classList.add('btn--loading');
  btn.disabled = true;

  try {
    await resetPassword(email);
    afficherSucces('Lien envoyé ! Vérifie ta boîte mail.');
    formForgot.reset();
  } catch (err) {
    afficherErreur(err.message);
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
});

/* ============================================================
   Actions boutons (Google, forgot, back)
   ============================================================ */

document.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (!action) return;

  if (action === 'google') {
    try { await connexionGoogle(); }
    catch (err) { afficherErreur(err.message); }
  }

  if (action === 'forgot') {
    tabs.forEach(t => { t.classList.remove('tab--active'); t.setAttribute('aria-selected', 'false'); });
    afficherForm('forgot');
    cacherAlertes();
  }

  if (action === 'back-to-login') {
    tabs[0].classList.add('tab--active');
    tabs[0].setAttribute('aria-selected', 'true');
    afficherForm('connexion');
    cacherAlertes();
  }
});
