/* ============================================================
   campaign.js — Landing publique d'une campagne de vente livre
   ============================================================ */

import { api } from './api.js';
import { echapperAttr, genererCouvertureOeuvre, normaliserUrlImage } from './cover-utils.js';

const root = document.getElementById('campaign-root');
const params = new URLSearchParams(window.location.search);
const slug = params.get('c') || params.get('slug') || '';

document.addEventListener('DOMContentLoaded', chargerCampagne);

async function chargerCampagne() {
  if (!root) return;
  if (!slug) {
    afficherErreur('Campagne introuvable.');
    return;
  }

  try {
    const campagne = await api.getCampagneVente(slug);
    if (!campagne || campagne.statut !== 'active' || !estDansPeriode(campagne)) {
      afficherErreur('Cette campagne n’est pas active.');
      return;
    }

    await api.trackCampagneVente(slug, 'vue');
    root.innerHTML = renderCampagne(campagne);
    brancherActions(campagne);
  } catch (error) {
    console.error(error);
    afficherErreur('Impossible de charger la campagne.');
  }
}

function renderCampagne(campagne) {
  const oeuvre = campagne.oeuvres || {};
  const titre = campagne.titre || oeuvre.titre || 'Livre Kalamundi';
  const auteur = oeuvre.profiles?.nom || 'Auteur Kalamundi';
  const resume = campagne.slogan || oeuvre.resume || 'Découvrez ce livre sur Kalamundi et poursuivez votre lecture en paiement sécurisé.';
  const prix = Number(campagne.prix_campagne ?? oeuvre.prix ?? 0);
  const prixBarre = Number(campagne.prix_barre || 0);
  const devise = campagne.devise || 'XAF';
  const coverUrl = normaliserUrlImage(campagne.visuel_url || oeuvre.couverture_url);
  const cover = coverUrl || genererCouvertureOeuvre(oeuvre, 420, 620);
  const fin = campagne.date_fin
    ? new Date(campagne.date_fin).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'durée limitée';
  const url = `${window.location.origin}/pages/campaign.html?c=${encodeURIComponent(campagne.slug)}`;

  return `
    <div class="container">
      <section class="campaign-hero">
        <div class="campaign-hero__cover">
          <img src="${echapperAttr(cover)}" alt="${echapperAttr(titre)}" />
        </div>
        <div>
          <div class="campaign-hero__kicker">Campagne Kalamundi · ${fin}</div>
          <h1 class="campaign-hero__title">${escapeHtml(titre)}</h1>
          <p class="campaign-hero__text">${escapeHtml(resume)}</p>
          <div class="campaign-hero__meta">
            <span class="badge badge--primary">${escapeHtml(auteur)}</span>
            ${oeuvre.genre ? `<span class="badge badge--gratuit">${escapeHtml(oeuvre.genre)}</span>` : ''}
            <span class="badge badge--accent">Paiement Fapshi</span>
          </div>
          <div class="campaign-hero__price">
            <strong>${prix ? `${prix.toLocaleString('fr-FR')} ${devise}` : 'Lecture gratuite'}</strong>
            ${prixBarre > prix && prix > 0 ? `<span>${prixBarre.toLocaleString('fr-FR')} ${devise}</span>` : ''}
          </div>
          <div style="display:flex;gap:var(--spacing-sm);flex-wrap:wrap">
            <a class="btn btn--primary btn--lg" id="campaign-buy" href="${urlPaiement(campagne, prix)}">Acheter et lire</a>
            <a class="btn btn--outline btn--lg" href="/pages/work.html?id=${encodeURIComponent(campagne.oeuvre_id)}">Voir la fiche</a>
          </div>
          <div class="campaign-share" aria-label="Partager la campagne">
            <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(`${titre} sur Kalamundi : ${url}`)}">WhatsApp</a>
            <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}">Facebook</a>
            <button class="btn btn--ghost btn--sm" id="campaign-copy" type="button">Copier le lien</button>
          </div>
        </div>
      </section>
    </div>`;
}

function brancherActions(campagne) {
  document.getElementById('campaign-buy')?.addEventListener('click', () => {
    api.trackCampagneVente(campagne.slug, 'achat');
  });
  document.getElementById('campaign-copy')?.addEventListener('click', async () => {
    const url = `${window.location.origin}/pages/campaign.html?c=${encodeURIComponent(campagne.slug)}`;
    await navigator.clipboard?.writeText(url).catch(() => {});
    toast('Lien copié.');
  });
}

function urlPaiement(campagne, prix) {
  const qs = new URLSearchParams({
    oeuvre: campagne.oeuvre_id,
    montant: String(prix || 0),
    titre: campagne.oeuvres?.titre || campagne.titre || 'Livre Kalamundi',
    campaign: campagne.slug,
  });
  return `/pages/payment.html?${qs.toString()}`;
}

function estDansPeriode(campagne) {
  const now = Date.now();
  const debut = campagne.date_debut ? new Date(campagne.date_debut).getTime() : 0;
  const fin = campagne.date_fin ? new Date(campagne.date_fin).getTime() : Infinity;
  return debut <= now && fin >= now;
}

function afficherErreur(message) {
  root.innerHTML = `
    <div class="container">
      <div class="empty-state">
        <div class="empty-state__icon">⚠️</div>
        <p class="empty-state__title">${message}</p>
        <a class="btn btn--primary" href="/pages/library.html">Retour au catalogue</a>
      </div>
    </div>`;
}

function toast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast toast--success';
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
