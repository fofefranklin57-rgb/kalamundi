/* ============================================================
   payment.js — Paiements manuels MTN MoMo / Orange Money / PayPal
   Kalamundi — La Plume du Monde
   ============================================================
   Pour basculer vers CinetPay ou Campay quand le RCCM est prêt,
   remplacer les fonctions soumettreFormulaire() par l'appel API.
   ============================================================ */

import { getSession } from './auth.js';
import { api } from './api.js';

/* ============================================================
   Config paiements
   ============================================================ */
const CONFIG = {
  mtn:    { numero: '673 950 019', operateur: 'MTN Mobile Money' },
  om:     { numero: '673 950 019', operateur: 'Orange Money' },
  paypal: { merchantId: '6YGZW846EQMJ2' },
};

/* Plans abonnement */
const PLANS = {
  etudiant:     { label: 'Abonnement Étudiant',   montant: 500, devise: 'FCFA' },
  reader_plus:  { label: 'Abonnement Reader+',    montant: 2,   devise: 'USD' },
  auteur_pro:   { label: 'Abonnement Auteur Pro', montant: 5,   devise: 'USD' },
  institution:  { label: 'Abonnement Institution',montant: 20,  devise: 'USD' },
};

/* ============================================================
   Init
   ============================================================ */
let SESSION = null;
let PARAMS  = {};

document.addEventListener('DOMContentLoaded', async () => {
  SESSION = await getSession();

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
  const qs = new URLSearchParams(window.location.search);
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
    afficherHeader('Abonnement', plan.label, plan.montant, plan.devise);
  } else {
    afficherErreur('Paramètres de paiement invalides.');
  }

  remplirMontants();
});

/* ============================================================
   Chargement info œuvre (achat premium)
   ============================================================ */
async function chargerInfoOeuvre() {
  try {
    const oeuvre = await api.getOeuvre(PARAMS.oeuvreId);
    PARAMS.titre   = oeuvre.titre;
    PARAMS.montant = parseFloat(oeuvre.prix) || 0;
    afficherHeader('Achat œuvre premium', oeuvre.titre, PARAMS.montant, 'USD');
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
  document.getElementById('paypal-amount').value        = montant;
  document.getElementById('paypal-item-name').value     = `Kalamundi — ${titre}`;
}

function remplirMontants() {
  const m = `${PARAMS.montant} ${PARAMS.devise || 'USD'}`;
  const ids = ['mtn-montant', 'om-montant', 'paypal-montant'];
  ids.forEach(id => { const el = document.getElementById(id); if (el) el.textContent = m; });
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
  /* Activer le bouton sélectionné */
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.method-panel').forEach(p => p.classList.remove('active'));

  const btnMap = { mtn: 0, om: 1, paypal: 2 };
  document.querySelectorAll('.method-btn')[btnMap[methode]]?.classList.add('active');
  document.getElementById(`panel-${methode}`)?.classList.add('active');

  /* Générer le formulaire de confirmation si pas encore fait */
  const formId = `form-${methode}`;
  if (!document.getElementById(formId).hasChildNodes()) {
    document.getElementById(formId).innerHTML = formulaireConfirmation(methode);
  }
};

/* ============================================================
   Formulaire de confirmation de transaction
   ============================================================ */
function formulaireConfirmation(methode) {
  const labels = {
    mtn:    'Référence MTN MoMo',
    om:     'Référence Orange Money',
    paypal: 'ID de transaction PayPal',
  };
  return `
    <div class="form-group">
      <label class="form-label" for="ref-${methode}">${labels[methode]} *</label>
      <input type="text" id="ref-${methode}" class="form-input"
        placeholder="${methode === 'paypal' ? 'Ex: 5AB12345CD678901E' : 'Ex: CM2312345678'}"
        style="font-family:monospace;letter-spacing:1px" required />
      <p style="font-size:11px;color:var(--text-light);margin-top:4px">
        Entrez la référence exactement telle qu'elle apparaît dans votre confirmation de paiement.
      </p>
    </div>
    <div id="err-${methode}" class="toast toast--error" style="display:none;margin-bottom:12px"></div>
    <button class="btn btn--primary" style="width:100%;font-size:var(--font-size-md);padding:14px"
      onclick="soumettre('${methode}')">
      ✅ Confirmer mon paiement
    </button>
  `;
}

/* ============================================================
   Soumission
   ============================================================ */
window.soumettre = async function (methode) {
  const refEl = document.getElementById(`ref-${methode}`);
  const errEl = document.getElementById(`err-${methode}`);
  const ref   = refEl?.value.trim();

  if (!ref) {
    errEl.textContent = 'Veuillez entrer la référence de transaction.';
    errEl.style.display = 'block';
    return;
  }

  const btn = refEl.parentElement.parentElement.querySelector('button[onclick]');
  btn.disabled    = true;
  btn.textContent = 'Envoi en cours…';
  errEl.style.display = 'none';

  try {
    await api.creerPaiement({
      user_id:               SESSION.user.id,
      oeuvre_id:             PARAMS.oeuvreId || null,
      type:                  PARAMS.plan || 'achat_oeuvre',
      montant:               PARAMS.montant,
      devise:                PARAMS.devise || 'USD',
      methode,
      reference_transaction: ref,
      statut:                'en_attente',
    });

    /* Afficher la confirmation */
    document.getElementById('payment-card').style.display = 'none';
    document.getElementById('zone-succes').style.display  = 'block';

  } catch (e) {
    errEl.textContent = 'Une erreur est survenue. Veuillez réessayer.';
    errEl.style.display = 'block';
    btn.disabled    = false;
    btn.textContent = '✅ Confirmer mon paiement';
    console.error(e);
  }
};
