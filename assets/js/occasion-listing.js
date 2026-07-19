/* ============================================================
   occasion-listing.js — Parcourir toutes les annonces d'occasion
   (reste P4 #14 : jusqu'ici on ne voyait que celles d'un livre précis)
   ============================================================ */

import { api } from './api.js';
import { genererCouverture } from './cover-generator.js';
import { echapperAttr, normaliserUrlImage } from './cover-utils.js';
import { toast } from './utils.js';

const listeEl = document.getElementById('occasion-liste');

init();

async function init() {
  if (!listeEl) return;
  try {
    const annonces = await api.getToutesAnnoncesOccasion({ limit: 60 });
    if (!annonces.length) {
      listeEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📚</div>
          <p class="empty-state__title">Aucune annonce d'occasion pour le moment</p>
          <p class="empty-state__text">Soyez le premier à en publier une.</p>
          <a href="/pages/vendre.html" class="btn btn--primary">Vendre un livre</a>
        </div>`;
      return;
    }
    listeEl.innerHTML = `<div class="occasion-grid">${annonces.map(carte).join('')}</div>`;
  } catch (err) {
    console.error(err);
    listeEl.innerHTML = '<div class="alert alert--error">Impossible de charger les annonces d\'occasion.</div>';
    toast('Erreur de chargement des annonces.', 'error');
  }
}

function carte(annonce) {
  const livre = annonce.livres || {};
  const titre = livre.titre || 'Livre d\'occasion';
  const etat = annonce.conditions?.etat || 'bon';
  const ville = annonce.conditions?.ville;
  const coverUrl = normaliserUrlImage(livre.couverture_url);
  const fallback = genererCouverture(titre, '', '', 220, 330);
  const cover = coverUrl || fallback;
  const lien = livre.oeuvre_id
    ? `/pages/work.html?id=${encodeURIComponent(livre.oeuvre_id)}`
    : `/pages/library.html`;

  return `
    <a class="occasion-card" href="${lien}">
      <img class="occasion-card__cover" src="${echapperAttr(cover)}" alt="Couverture ${echapperAttr(titre)}"
        onerror="this.onerror=null;this.src='${echapperAttr(fallback)}'" />
      <div class="occasion-card__body">
        <div class="occasion-card__titre">${echapper(titre)}</div>
        <div class="occasion-card__meta">
          <span>${echapper(labelEtat(etat))}${ville ? ' · ' + echapper(ville) : ''}</span>
        </div>
        <div class="occasion-card__prix">${Number(annonce.prix || 0).toLocaleString('fr-FR')} ${annonce.devise || 'XAF'}</div>
      </div>
    </a>`;
}

function labelEtat(etat) {
  return { neuf: 'Neuf', comme_neuf: 'Comme neuf', bon: 'Bon état', correct: 'Correct', use: 'Usé' }[etat] || etat;
}

function echapper(valeur = '') {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
