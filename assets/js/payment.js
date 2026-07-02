/* ============================================================
   payment.js — Paiement Fapshi
   Kalamundi — La Plume du Monde
   ============================================================
   ============================================================ */

import { getSession } from './auth.js';

/* ============================================================
   Config paiements
   ============================================================ */
const CONFIG = {
  fapshi: { workerUrl: '/api/fapshi-pay' },
};

/* Plans abonnement */
const PLANS = {
  reader_plus:  { label: 'Abonnement Reader+',     montant: 1000, devise: 'XAF', type: 'abonnement_reader' },
  auteur_pro:   { label: 'Abonnement Auteur Pro',  montant: 2500, devise: 'XAF', type: 'abonnement_auteur' },
  institution:  { label: 'Abonnement Institution', montant: 10000, devise: 'XAF', type: 'abonnement_institution' },
};

/* ============================================================
   Init
   ============================================================ */
let SESSION = null;
let PARAMS  = {};

document.addEventListener('DOMContentLoaded', async () => {
  SESSION = await getSession();

  const qs = new URLSearchParams(window.location.search);
  if (qs.get('fapshi') === 'success') {
    document.getElementById('payment-card').style.display = 'none';
    document.getElementById('zone-succes').style.display = 'block';
    return;
  }

  if (!SESSION) {
    document.getElementById('payment-card').style.display = 'none';
    document.getElementById('zone-auth').innerHTML = `
      <div class="empty-state" style="margin-bottom:var(--spacing-xl)">
        <div class="empty-state__icon">🔐</div>
        <p class="empty-state__title">Connexion requise pour payer</p>
        <a href="/pages/login.html?redirect=/pages/payment.html${window.location.search}"
           class="btn btn--primary" style="margin-top:var(--spacing-md)">Se connecter</a>
      </div>`;
    return;
  }

  /* Lire les paramètres URL */
  PARAMS = {
    plan:      qs.get('plan'),      /* abonnement */
    oeuvreId:  qs.get('oeuvre'),   /* achat œuvre */
    montant:   parseFloat(qs.get('montant')) || 0,
    titre:     qs.get('titre') || '',
  };

  /* Déterminer le type de transaction */
  if (PARAMS.oeuvreId) {
    await chargerInfoOeuvre();
  } else if (PARAMS.plan && PLANS[PARAMS.plan]) {
    const plan = PLANS[PARAMS.plan];
    PARAMS.montant = plan.montant;
    PARAMS.devise  = plan.devise;
    PARAMS.type    = plan.type;
    afficherHeader('Abonnement', plan.label, plan.montant, plan.devise);
  } else {
    afficherErreur('Paramètres de paiement invalides.');
  }

  remplirMontants();
  choisirMethode('fapshi');
});

/* ============================================================
   Chargement info œuvre (achat premium)
   ============================================================ */
async function chargerInfoOeuvre() {
  try {
    const oeuvre = await api.getOeuvre(PARAMS.oeuvreId);
    PARAMS.titre   = oeuvre.titre;
    PARAMS.montant = parseFloat(oeuvre.prix) || 0;
    PARAMS.devise  = 'XAF';
    afficherHeader('Achat œuvre premium', oeuvre.titre, PARAMS.montant, 'XAF');
  } catch {
    afficherErreur('Œuvre introuvable.');
  }
}

/* ============================================================
   Affichage header paiement
   ============================================================ */
function afficherHeader(typeLabel, titre, montant, devise) {
  document.getElementById('pay-type-label').textContent = typeLabel;
  document.getElementById('pay-title').textContent      = titre;
  document.getElementById('pay-montant').textContent    = `${montant} ${devise}`;
}

function remplirMontants() {
  const display = document.getElementById('fapshi-montant-display');
  if (display) display.textContent = `${PARAMS.montant} ${PARAMS.devise || 'XAF'}`;
}

function afficherErreur(msg) {
  document.getElementById('payment-card').innerHTML = `
    <div class="payment-body">
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <p class="empty-state__title">${msg}</p>
        <a href="/pages/abonnements.html" class="btn btn--primary" style="margin-top:16px">Voir les abonnements</a>
      </div>
    </div>`;
}

/* ============================================================
   Sélection méthode
   ============================================================ */
window.choisirMethode = function (methode) {
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.method-panel').forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.method-btn')[0]?.classList.add('active');
  document.getElementById(`panel-${methode}`)?.classList.add('active');

  if (methode === 'fapshi') {
    const display = document.getElementById('fapshi-montant-display');
    if (display) display.textContent = `${PARAMS.montant} ${PARAMS.devise || 'XAF'}`;
    const btn = document.getElementById('btn-payer-fapshi');
    btn?.removeEventListener('click', _fapshiHandler);
    btn?.addEventListener('click', _fapshiHandler);
    return;
  }
};

/* ── Fapshi : initiation paiement automatique ────────────── */
async function _fapshiHandler() {
  const btn = document.getElementById('btn-payer-fapshi');
  btn.disabled = true;
  btn.textContent = 'Initialisation…';

  try {
    const res = await fetch(CONFIG.fapshi.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION.access_token}`,
      },
      body: JSON.stringify({
        montant:     PARAMS.montant,
        devise:      PARAMS.devise || 'XAF',
        description: PARAMS.titre || 'Kalamundi — Paiement',
        userId:      SESSION.user.id,
        oeuvreId:    PARAMS.oeuvreId || null,
        plan:        PARAMS.type || null,
        redirectUrl: window.location.origin + '/pages/payment.html?fapshi=success',
      }),
    });

    if (!res.ok) throw new Error('Erreur initialisation Fapshi');
    const { link } = await res.json();
    window.location.href = link;

  } catch (e) {
    btn.disabled = false;
    btn.textContent = '⚡ Payer maintenant avec Fapshi';
    const errDiv = document.createElement('div');
    errDiv.className = 'toast toast--error';
    errDiv.style.marginTop = '8px';
    errDiv.textContent = 'Erreur : ' + e.message;
    btn.parentElement.appendChild(errDiv);
  }
}
