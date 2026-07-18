/* ============================================================
   vendre.js — Poster une annonce de livre d'occasion (P4 #14)
   Kalamundi — La Plume du Monde

   Affiche au vendeur, EN DIRECT, ce qu'il va recevoir (répartition D15/D16),
   puis crée l'annonce via la RPC creer_annonce_occasion (SECURITY DEFINER).
   ============================================================ */

import { getSession, supabase } from './auth.js';

/* Commission occasion — source de vérité : scripts/lib/economie.mjs (D15).
   Dupliquée ici en une seule constante pour l'aperçu ; le calcul qui engage
   l'argent est refait côté serveur à la commande (V012). */
const COMMISSION_OCCASION_PCT = 20;

const fcfa = n => `${Math.round(n).toLocaleString('fr-FR')} FCFA`;

/* Ce que touche le vendeur : la plateforme porte les frais Fapshi (D16),
   donc le vendeur reçoit prix − commission, sans autre déduction. */
function repartition(prix) {
  const p = Math.max(0, Math.round(Number(prix) || 0));
  const commission = Math.round(p * COMMISSION_OCCASION_PCT / 100);
  return { prix: p, commission, vendeur: p - commission };
}

function majRepartition() {
  const prix = Number(document.getElementById('prix').value) || 0;
  const r = repartition(prix);
  document.getElementById('r-prix').textContent = prix ? fcfa(r.prix) : '—';
  document.getElementById('r-commission').textContent = prix ? `− ${fcfa(r.commission)}` : '—';
  document.getElementById('r-vendeur').textContent = prix ? fcfa(r.vendeur) : '—';
}

document.addEventListener('DOMContentLoaded', async () => {
  const session = await getSession();

  if (!session) {
    document.getElementById('vendre-card').style.display = 'none';
    document.getElementById('zone-auth').innerHTML = `
      <div class="empty-state" style="margin-bottom:var(--spacing-xl)">
        <div class="empty-state__icon">🔐</div>
        <p class="empty-state__title">Connexion requise</p>
        <p class="empty-state__text">Connectez-vous pour vendre un livre.</p>
        <a href="/pages/login.html?redirect=/pages/vendre.html" class="btn btn--primary">Se connecter</a>
      </div>`;
    return;
  }

  document.getElementById('prix').addEventListener('input', majRepartition);
  document.getElementById('btn-publier').addEventListener('click', publier);
  majRepartition();
});

async function publier() {
  const btn = document.getElementById('btn-publier');
  const zoneMsg = document.getElementById('vendre-message');
  zoneMsg.innerHTML = '';

  const val = id => document.getElementById(id).value.trim();
  const titre = val('titre');
  const prix = Number(document.getElementById('prix').value) || 0;

  if (titre.length < 2) {
    zoneMsg.innerHTML = `<div class="alert alert--warning">Indiquez le titre du livre.</div>`;
    return;
  }
  if (prix < 100) {
    zoneMsg.innerHTML = `<div class="alert alert--warning">Le prix doit être d'au moins 100 FCFA.</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Publication…';

  const { error } = await supabase.rpc('creer_annonce_occasion', {
    p_titre: titre,
    p_auteur: val('auteur') || null,
    p_isbn: val('isbn') || null,
    p_etat: document.getElementById('etat').value,
    p_prix: prix,
    p_ville: val('ville') || null,
    p_mode_remise: document.getElementById('mode').value,
    p_photos: [],
    p_description: null,
  });

  if (error) {
    btn.disabled = false;
    btn.textContent = "Publier l'annonce";
    zoneMsg.innerHTML = `<div class="alert alert--error">${escapeHtml(error.message || 'Publication impossible.')}</div>`;
    return;
  }

  document.getElementById('vendre-card').style.display = 'none';
  document.getElementById('zone-succes').style.display = 'block';
}

function escapeHtml(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}
