/* ============================================================
   payment.js — Paiement Fapshi
   Kalamundi — La Plume du Monde
   ============================================================
   ============================================================ */

import { getSession } from './auth.js';
import { api } from './api.js';
import { getCart, cartTotal, clearCart } from './cart.js';

/* ============================================================
   Config paiements
   ============================================================ */
const CONFIG = {
  fapshi: { workerUrl: '/api/fapshi-pay' },
};

/* Plans abonnement.
   'institution' retiré volontairement (2026-07-20) : la vente est suspendue
   tant que la fonctionnalité équipe/tableau de bord n'est pas construite
   (cf. ERROR_LOG.md). Ne pas le remettre ici sans avoir livré ces avantages. */
const PLANS = {
  reader_plus:  { label: 'Abonnement Reader+',     montant: 1000, devise: 'XAF', type: 'abonnement_reader' },
  auteur_pro:   { label: 'Abonnement Auteur Pro',  montant: 2500, devise: 'XAF', type: 'abonnement_auteur' },
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
    if (qs.get('occasion') === '1' && qs.get('commande')) {
      /* Le paiement occasion se suit sur sa propre page (timeline du séquestre). */
      window.location.href = `/pages/commande.html?id=${encodeURIComponent(qs.get('commande'))}`;
      return;
    }
    if (localStorage.getItem('kalamundi_cart_pending') === '1') {
      clearCart();
      localStorage.removeItem('kalamundi_cart_pending');
    }
    document.getElementById('payment-card').style.display = 'none';
    document.getElementById('zone-succes').style.display = 'block';
    afficherCodeCadeau();
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
    cart:      qs.get('cart') === '1',
    cadeau:    qs.get('cadeau') === '1', /* offrir à un proche (diaspora) */
    occasion:  qs.get('occasion') === '1', /* livre d'occasion (séquestre) */
    commandeOccasionId: qs.get('commande') || null,
    campaign:  qs.get('campaign') || null,
    montant:   parseFloat(qs.get('montant')) || 0,
    titre:     qs.get('titre') || '',
  };

  /* Déterminer le type de transaction */
  if (PARAMS.occasion && PARAMS.commandeOccasionId) {
    afficherHeader('📚 Achat occasion', PARAMS.titre || 'Livre Kalamundi', PARAMS.montant, 'XAF');
  } else if (PARAMS.cadeau && PARAMS.oeuvreId) {
    await chargerInfoCadeau();
  } else if (PARAMS.cart) {
    chargerPanier();
  } else if (PARAMS.oeuvreId) {
    await chargerInfoOeuvre();
  } else if (PARAMS.plan === 'institution') {
    afficherErreur("L'abonnement Institution n'est pas encore en vente. Écrivez-nous à institutions@kalamundi.com pour être prévenu au lancement.");
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
    PARAMS.montant = PARAMS.campaign && PARAMS.montant > 0
      ? PARAMS.montant
      : parseFloat(oeuvre.prix) || 0;
    PARAMS.devise  = 'XAF';
    afficherHeader(PARAMS.campaign ? 'Campagne livre' : 'Achat œuvre premium', oeuvre.titre, PARAMS.montant, 'XAF');
  } catch {
    afficherErreur('Œuvre introuvable.');
  }
}

/* ============================================================
   Mode cadeau (diaspora) — offrir un livre à un proche
   ============================================================ */
async function chargerInfoCadeau() {
  try {
    const oeuvre = await api.getOeuvre(PARAMS.oeuvreId);
    PARAMS.titre   = oeuvre.titre;
    PARAMS.montant = parseFloat(oeuvre.prix) || 0;
    PARAMS.devise  = 'XAF';
    PARAMS.type    = 'cadeau';
    afficherHeader('🎁 Offrir ce livre', oeuvre.titre, PARAMS.montant, 'XAF');
    rendreChampsCadeau();
  } catch {
    afficherErreur('Œuvre introuvable.');
  }
}

function rendreChampsCadeau() {
  const zone = document.getElementById('gift-fields');
  if (!zone) return;
  zone.innerHTML = `
    <div class="instruction-box" style="margin-bottom:var(--spacing-md)">
      <h3>🎁 Un cadeau pour un proche</h3>
      <p style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:var(--spacing-md)">
        Vous payez, et un proche resté au pays recevra un <strong>code</strong> à saisir pour débloquer le livre.
      </p>
      <div class="form-group">
        <label class="form-label" for="gift-contact">Contact du destinataire <span style="color:var(--text-light)">(facultatif)</span></label>
        <input class="form-input" id="gift-contact" type="text" placeholder="Nom, téléphone ou email" maxlength="120" />
      </div>
      <div class="form-group" style="margin-bottom:0">
        <label class="form-label" for="gift-message">Petit mot <span style="color:var(--text-light)">(facultatif)</span></label>
        <textarea class="form-textarea" id="gift-message" placeholder="Bonne lecture !" maxlength="500" style="min-height:70px"></textarea>
      </div>
    </div>`;
}

function afficherCodeCadeau() {
  const code = localStorage.getItem('kalamundi_gift_pending');
  const zone = document.getElementById('gift-code-zone');
  if (!code || !zone) return;
  localStorage.removeItem('kalamundi_gift_pending');

  const joli = (code.match(/.{1,4}/g) || [code]).join('-');
  const partage = `J'ai un cadeau pour toi sur Kalamundi 🎁 Voici ton code : ${joli}\nÀ saisir sur ${location.origin}/pages/reclamer.html`;

  document.querySelector('#zone-succes h2').textContent = 'Cadeau prêt à offrir !';
  zone.innerHTML = `
    <div class="instruction-box" style="text-align:center;margin-bottom:var(--spacing-lg)">
      <h3>Code cadeau</h3>
      <div class="numero" id="gift-code-value" style="cursor:pointer" title="Copier">${joli}</div>
      <p style="font-size:var(--font-size-sm);color:var(--text-secondary)">
        Partagez ce code avec le destinataire. Il le saisira sur la
        <a href="/pages/reclamer.html">page de réclamation</a> pour recevoir le livre.
      </p>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:var(--spacing-md);flex-wrap:wrap">
        <button class="btn btn--outline btn--sm" id="gift-copy">📋 Copier le code</button>
        <a class="btn btn--outline btn--sm" target="_blank" rel="noopener"
           href="https://wa.me/?text=${encodeURIComponent(partage)}">📲 Partager sur WhatsApp</a>
      </div>
    </div>`;

  const copier = () => navigator.clipboard?.writeText(joli).then(() => {
    document.getElementById('gift-copy').textContent = '✅ Copié';
  }).catch(() => {});
  document.getElementById('gift-copy')?.addEventListener('click', copier);
  document.getElementById('gift-code-value')?.addEventListener('click', copier);
}

function chargerPanier() {
  const items = getCart().filter(item => Number(item.prix || 0) > 0);
  if (!items.length) {
    afficherErreur('Votre panier est vide.');
    return;
  }
  PARAMS.items = items;
  PARAMS.montant = cartTotal(items);
  PARAMS.devise = 'XAF';
  PARAMS.type = 'panier_livres';
  PARAMS.titre = `${items.length} livre${items.length > 1 ? 's' : ''} Kalamundi`;
  afficherHeader('Panier livres', PARAMS.titre, PARAMS.montant, 'XAF');
  afficherResumePanier(items);
}

function afficherResumePanier(items) {
  const body = document.querySelector('.payment-body');
  if (!body || document.getElementById('cart-summary')) return;
  const resume = document.createElement('div');
  resume.id = 'cart-summary';
  resume.className = 'instruction-box';
  resume.innerHTML = `
    <h3>Votre panier</h3>
    <div style="display:grid;gap:8px">
      ${items.map(item => `
        <div style="display:flex;justify-content:space-between;gap:12px;font-size:var(--font-size-sm)">
          <span>${escapeHtml(item.titre || 'Livre Kalamundi')}</span>
          <strong>${Number(item.prix || 0).toLocaleString('fr-FR')} XAF</strong>
        </div>`).join('')}
    </div>`;
  body.prepend(resume);
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
    const estCadeau = PARAMS.cadeau === true;
    const estOccasion = PARAMS.occasion === true;
    const res = await fetch(CONFIG.fapshi.workerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SESSION.access_token}`,
      },
      body: JSON.stringify({
        montant:     PARAMS.montant,
        devise:      PARAMS.devise || 'XAF',
        description: (estCadeau ? '🎁 Cadeau — ' : estOccasion ? '📚 Occasion — ' : '') + (PARAMS.titre || 'Kalamundi — Paiement'),
        userId:      SESSION.user.id,
        oeuvreId:    PARAMS.oeuvreId || null,
        plan:        (estCadeau || estOccasion) ? null : (PARAMS.type || null),
        items:       (estCadeau || estOccasion) ? null : (PARAMS.items || null),
        campaign:    PARAMS.campaign || null,
        cadeau:      estCadeau,
        commandeOccasionId: estOccasion ? PARAMS.commandeOccasionId : null,
        beneficiaireContact: estCadeau ? (document.getElementById('gift-contact')?.value || null) : null,
        message:     estCadeau ? (document.getElementById('gift-message')?.value || null) : null,
        redirectUrl: window.location.origin + '/pages/payment.html?fapshi=success'
          + (estOccasion ? `&occasion=1&commande=${encodeURIComponent(PARAMS.commandeOccasionId)}` : ''),
      }),
    });

    if (!res.ok) throw new Error('Erreur initialisation Fapshi');
    const { link, code } = await res.json();
    if (estCadeau && code) localStorage.setItem('kalamundi_gift_pending', code);
    if (PARAMS.items?.length) localStorage.setItem('kalamundi_cart_pending', '1');
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

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
