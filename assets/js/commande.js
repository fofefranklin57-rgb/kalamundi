/* ============================================================
   commande.js — Suivi d'une commande d'occasion (séquestre)
   Kalamundi — La Plume du Monde  (P4 #14)

   Affiche la timeline du séquestre et propose, selon le rôle (acheteur/
   vendeur), les actions permises : payer, confirmer remise, confirmer
   réception (libère les fonds), ouvrir un litige, évaluer.
   Toute la logique de sécurité vit dans les RPC SECURITY DEFINER (V012) —
   ce fichier ne fait qu'afficher et appeler.
   ============================================================ */

import { getSession, supabase } from './auth.js';

const ETAPES = [
  { statut: 'en_attente_paiement', label: 'Commande créée', icone: '📝' },
  { statut: 'paye_sequestre',      label: 'Payé — fonds en séquestre', icone: '🔒' },
  { statut: 'remis',               label: 'Remis par le vendeur', icone: '📦' },
  { statut: 'receptionne',         label: 'Reçu par l\'acheteur', icone: '✅' },
  { statut: 'clos',                label: 'Fonds versés au vendeur', icone: '💰' },
];
const ORDRE = ETAPES.map(e => e.statut);

const fcfa = n => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

let CMD = null;
let ROLE = null; // 'acheteur' | 'vendeur'
let SESSION = null;

document.addEventListener('DOMContentLoaded', async () => {
  SESSION = await getSession();
  const id = new URLSearchParams(window.location.search).get('id');

  if (!SESSION) {
    document.getElementById('zone-auth').innerHTML = `
      <div class="empty-state" style="margin-bottom:var(--spacing-xl)">
        <div class="empty-state__icon">🔐</div>
        <p class="empty-state__title">Connexion requise</p>
        <a href="/pages/login.html?redirect=/pages/commande.html${window.location.search}" class="btn btn--primary">Se connecter</a>
      </div>`;
    return;
  }
  if (!id) return afficherErreur();

  await charger(id);
});

async function charger(id) {
  const { data, error } = await supabase
    .from('commandes_occasion')
    .select('id, livre_id, acheteur_id, vendeur_id, montant_xaf, commission_xaf, montant_vendeur_xaf, statut, mode_remise, remise_infos, litige_motif, created_at, livres(titre)')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) return afficherErreur();

  CMD = data;
  ROLE = data.acheteur_id === SESSION.user.id ? 'acheteur'
       : data.vendeur_id === SESSION.user.id ? 'vendeur' : null;

  if (!ROLE) return afficherErreur(); // ni acheteur ni vendeur : le RLS aurait de toute façon bloqué le SELECT

  document.getElementById('cmd-card').style.display = 'block';
  rendre();
}

function afficherErreur() {
  document.getElementById('cmd-erreur').style.display = 'block';
}

function rendre() {
  document.getElementById('cmd-role').textContent = ROLE === 'acheteur' ? 'Votre achat' : 'Votre vente';
  document.getElementById('cmd-titre').textContent = CMD.livres?.titre || 'Livre Kalamundi';
  document.getElementById('cmd-montant').textContent = fcfa(CMD.montant_xaf);

  rendreAlerte();
  rendreTimeline();
  rendreActions();
}

function rendreAlerte() {
  const zone = document.getElementById('cmd-alerte');
  if (CMD.statut === 'litige') {
    zone.innerHTML = `<div class="cmd-alert cmd-alert--litige">⚠️ Litige en cours${CMD.litige_motif ? ' : ' + escapeHtml(CMD.litige_motif) : ''}. Notre équipe va examiner la commande.</div>`;
  } else if (CMD.statut === 'clos') {
    zone.innerHTML = `<div class="cmd-alert cmd-alert--clos">✅ Transaction terminée. ${ROLE === 'vendeur' ? `Vos ${fcfa(CMD.montant_vendeur_xaf)} sont en cours de versement.` : 'Bonne lecture !'}</div>`;
  } else if (CMD.statut === 'annule' || CMD.statut === 'rembourse') {
    zone.innerHTML = `<div class="cmd-alert cmd-alert--litige">Commande ${CMD.statut === 'annule' ? 'annulée' : 'remboursée'}.</div>`;
  } else {
    zone.innerHTML = '';
  }
}

function rendreTimeline() {
  const zone = document.getElementById('cmd-timeline');
  const enLitige = CMD.statut === 'litige';
  const indexActuel = enLitige ? ORDRE.indexOf('paye_sequestre') : ORDRE.indexOf(CMD.statut);

  zone.innerHTML = ETAPES.map((etape, i) => {
    const fait = !enLitige && i <= indexActuel && indexActuel >= 0;
    const actif = !enLitige && i === indexActuel;
    const classe = fait ? 'timeline__etape--fait' : actif ? 'timeline__etape--actif' : '';
    return `
      <div class="timeline__etape ${classe}">
        <div class="timeline__puce">${fait ? '✓' : etape.icone}</div>
        <div>
          <div class="timeline__label">${etape.label}</div>
        </div>
      </div>`;
  }).join('');
}

function rendreActions() {
  const zone = document.getElementById('cmd-actions');
  const s = CMD.statut;

  if (s === 'en_attente_paiement' && ROLE === 'acheteur') {
    zone.innerHTML = `<a href="/pages/payment.html?occasion=1&commande=${CMD.id}&titre=${encodeURIComponent(CMD.livres?.titre || '')}&montant=${CMD.montant_xaf}"
      class="btn btn--primary btn--full btn--lg">Payer ${fcfa(CMD.montant_xaf)}</a>`;
    return;
  }

  if (s === 'paye_sequestre' && ROLE === 'vendeur') {
    zone.innerHTML = boutons([
      { id: 'btn-remise', label: '📦 J\'ai remis le livre', classe: 'btn--primary' },
      { id: 'btn-litige', label: 'Signaler un problème', classe: 'btn--outline' },
    ]);
    lier('btn-remise', () => agir('confirmer_remise', { p_commande_id: CMD.id }, 'Remise confirmée.'));
    lier('btn-litige', ouvrirLitige);
    return;
  }

  if (s === 'paye_sequestre' && ROLE === 'acheteur') {
    zone.innerHTML = `<p style="color:var(--text-secondary);font-size:var(--font-size-sm)">En attente que le vendeur remette le livre (${modeRemise()}).</p>` +
      boutons([{ id: 'btn-litige', label: 'Signaler un problème', classe: 'btn--outline' }]);
    lier('btn-litige', ouvrirLitige);
    return;
  }

  if (s === 'remis' && ROLE === 'acheteur') {
    zone.innerHTML = boutons([
      { id: 'btn-reception', label: '✅ J\'ai bien reçu le livre', classe: 'btn--primary' },
      { id: 'btn-litige', label: 'Je n\'ai rien reçu / problème', classe: 'btn--outline' },
    ]) + `<p style="font-size:var(--font-size-xs);color:var(--text-light);margin-top:8px">Confirmer libère le paiement au vendeur.</p>`;
    lier('btn-reception', () => agir('confirmer_reception', { p_commande_id: CMD.id }, 'Réception confirmée — le vendeur va être payé !'));
    lier('btn-litige', ouvrirLitige);
    return;
  }

  if (s === 'remis' && ROLE === 'vendeur') {
    zone.innerHTML = `<p style="color:var(--text-secondary);font-size:var(--font-size-sm)">En attente de confirmation de réception par l'acheteur.</p>`;
    return;
  }

  if (s === 'clos' && ROLE === 'acheteur') {
    zone.innerHTML = `
      <div class="form-group">
        <label class="form-label">Noter le vendeur</label>
        <div id="etoiles" style="display:flex;gap:4px;font-size:24px;cursor:pointer">
          ${[1,2,3,4,5].map(n => `<span data-note="${n}" class="etoile">☆</span>`).join('')}
        </div>
      </div>
      <textarea class="form-textarea" id="commentaire" placeholder="Commentaire (optionnel)" maxlength="500" style="min-height:60px"></textarea>
      <button class="btn btn--primary btn--full" id="btn-evaluer" style="margin-top:8px" disabled>Envoyer l'évaluation</button>`;
    let note = 0;
    zone.querySelectorAll('.etoile').forEach(el => el.addEventListener('click', () => {
      note = Number(el.dataset.note);
      zone.querySelectorAll('.etoile').forEach((e2, i) => e2.textContent = i < note ? '★' : '☆');
      document.getElementById('btn-evaluer').disabled = false;
    }));
    lier('btn-evaluer', () => agir('evaluer_vendeur', {
      p_commande_id: CMD.id, p_note: note, p_commentaire: document.getElementById('commentaire').value || null,
    }, 'Merci pour votre évaluation !', { pasRecharger: true }));
    return;
  }

  zone.innerHTML = '';
}

function modeRemise() {
  return { main_propre: 'en main propre', point_relais: 'en point relais', livraison: 'par livraison' }[CMD.mode_remise] || CMD.mode_remise;
}

function boutons(liste) {
  return `<div style="display:flex;flex-direction:column;gap:8px">` +
    liste.map(b => `<button class="btn ${b.classe} btn--full" id="${b.id}">${b.label}</button>`).join('') + `</div>`;
}

function lier(id, fn) {
  document.getElementById(id)?.addEventListener('click', fn);
}

async function ouvrirLitige() {
  const motif = window.prompt('Décrivez brièvement le problème :');
  if (motif === null) return;
  await agir('ouvrir_litige', { p_commande_id: CMD.id, p_motif: motif }, 'Litige ouvert. Notre équipe va examiner la commande.');
}

async function agir(rpc, params, messageSucces, { pasRecharger } = {}) {
  const zoneMsg = document.getElementById('cmd-message');
  zoneMsg.innerHTML = '';
  document.querySelectorAll('#cmd-actions button').forEach(b => b.disabled = true);

  const { error } = await supabase.rpc(rpc, params);

  if (error) {
    zoneMsg.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || 'Action impossible.')}</div>`;
    document.querySelectorAll('#cmd-actions button').forEach(b => b.disabled = false);
    return;
  }

  zoneMsg.innerHTML = `<div class="alert alert--success">${escapeHtml(messageSucces)}</div>`;
  if (!pasRecharger) await charger(CMD.id);
}

function escapeHtml(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
