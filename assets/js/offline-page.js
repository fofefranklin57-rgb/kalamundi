/* ============================================================
   offline-page.js — Bibliothèque locale hors-ligne
   ============================================================ */

import { listerLivres, supprimerLivre, espaceTotalKo } from './offline.js';
import { getSession } from './auth.js';
import { api } from './api.js';
import { genererCouverture } from './cover-generator.js';
import { echapperAttr, normaliserUrlImage } from './cover-utils.js';
import { formatDateCourt, toast, toastErreur } from './utils.js';

const listeEl = document.getElementById('offline-books');
const achatsEl = document.getElementById('purchased-books');
const countEl = document.getElementById('offline-count');
const sizeEl = document.getElementById('offline-size');
const stateEl = document.getElementById('offline-network-state');

init();

async function init() {
  mettreAJourEtatReseau();
  window.addEventListener('online', mettreAJourEtatReseau);
  window.addEventListener('offline', mettreAJourEtatReseau);
  await Promise.all([
    rendreBibliothequeLocale(),
    rendreAchats(),
  ]);
}

async function rendreBibliothequeLocale() {
  if (!listeEl) return;
  listeEl.innerHTML = '<div class="offline-loading"><span class="spinner"></span><span>Chargement de ta bibliothèque locale…</span></div>';

  try {
    const livres = (await listerLivres()).sort((a, b) =>
      new Date(b.date_sauvegarde || 0) - new Date(a.date_sauvegarde || 0)
    );
    const totalKo = await espaceTotalKo();

    countEl.textContent = `${livres.length} livre${livres.length > 1 ? 's' : ''}`;
    sizeEl.textContent = `${formatKo(totalKo)} stocké${totalKo > 1 ? 's' : ''}`;

    if (!livres.length) {
      listeEl.innerHTML = `
        <div class="empty-state offline-empty">
          <div class="empty-state__icon">📚</div>
          <p class="empty-state__title">Aucun livre sauvegardé</p>
          <p class="empty-state__text">Ouvre une fiche livre puis utilise “Lire hors-ligne” pour l'ajouter ici.</p>
          <a href="/pages/library.html" class="btn btn--primary">Explorer la bibliothèque</a>
        </div>`;
      return;
    }

    listeEl.innerHTML = livres.map(carteLivreLocal).join('');
    listeEl.querySelectorAll('[data-remove-offline]').forEach(btn => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        event.stopPropagation();
        await retirerLivre(btn.dataset.removeOffline, btn.dataset.title || 'ce livre');
      });
    });
  } catch (err) {
    console.error(err);
    listeEl.innerHTML = `
      <div class="alert alert--error">
        Impossible d'ouvrir la bibliothèque hors-ligne sur cet appareil.
      </div>`;
  }
}

async function rendreAchats() {
  if (!achatsEl) return;
  const session = await getSession().catch(() => null);
  if (!session?.user) {
    achatsEl.innerHTML = `
      <div class="empty-state offline-empty">
        <div class="empty-state__icon">🔐</div>
        <p class="empty-state__title">Connectez-vous pour voir vos achats</p>
        <a href="/pages/login.html?redirect=/offline.html" class="btn btn--primary">Se connecter</a>
      </div>`;
    return;
  }

  try {
    const achats = await api.getAchatsUtilisateur(session.user.id);
    if (!achats.length) {
      achatsEl.innerHTML = `
        <div class="empty-state offline-empty">
          <div class="empty-state__icon">💎</div>
          <p class="empty-state__title">Aucun achat confirmé</p>
          <p class="empty-state__text">Vos livres premium achetés via Fapshi apparaîtront ici.</p>
          <a href="/pages/library.html?statut=premium" class="btn btn--primary">Découvrir les premium</a>
        </div>`;
      return;
    }
    achatsEl.innerHTML = achats.map(carteLivreAchete).join('');
  } catch (err) {
    console.error(err);
    achatsEl.innerHTML = '<div class="alert alert--error">Impossible de charger vos achats.</div>';
  }
}

function carteLivreAchete(achat) {
  const oeuvre = achat.oeuvres || {};
  const coverUrl = normaliserUrlImage(oeuvre.couverture_url);
  const auteur = oeuvre.profiles?.nom || 'Auteur inconnu';
  const fallback = genererCouverture(oeuvre.titre, auteur, oeuvre.genre, 220, 330);
  const cover = coverUrl || fallback;
  const date = achat.confirme_at || achat.created_at;
  return `
    <article class="offline-book">
      <a class="offline-book__cover" href="/pages/reader.html?id=${encodeURIComponent(oeuvre.id || achat.oeuvre_id)}">
        <img src="${echapperAttr(cover)}" alt="Couverture ${echapperAttr(oeuvre.titre || 'Livre acheté')}"
          onerror="this.onerror=null;this.src='${echapperAttr(fallback)}'" />
      </a>
      <div class="offline-book__body">
        <div class="offline-book__meta">
          <span>Achat Fapshi</span>
          <span>${Number(achat.montant || 0).toLocaleString('fr-FR')} ${achat.devise || 'XAF'}</span>
        </div>
        <h2 class="offline-book__title">
          <a href="/pages/reader.html?id=${encodeURIComponent(oeuvre.id || achat.oeuvre_id)}">${echapper(oeuvre.titre || 'Livre acheté')}</a>
        </h2>
        <p class="offline-book__author">${echapper(auteur)}</p>
        ${oeuvre.resume ? `<p class="offline-book__resume">${echapper(oeuvre.resume)}</p>` : ''}
        <div class="offline-book__footer">
          <span>Confirmé le ${date ? formatDateCourt(date) : '—'}</span>
          <a class="btn btn--ghost btn--sm" href="/pages/reader.html?id=${encodeURIComponent(oeuvre.id || achat.oeuvre_id)}">Lire</a>
        </div>
      </div>
    </article>`;
}

function carteLivreLocal(livre) {
  const coverUrl = normaliserUrlImage(livre.couverture_url);
  const fallback = genererCouverture(livre.titre, livre.auteur, livre.genre, 220, 330);
  const cover = coverUrl || fallback;
  const chapitres = Number(livre.nb_chapitres || livre.chapitres?.length || 0);
  const taille = formatKo(livre.taille_ko || 0);
  const date = livre.date_sauvegarde ? formatDateCourt(livre.date_sauvegarde) : 'date inconnue';
  const resume = livre.resume ? `<p class="offline-book__resume">${echapper(livre.resume)}</p>` : '';

  return `
    <article class="offline-book">
      <a class="offline-book__cover" href="/pages/reader.html?id=${encodeURIComponent(livre.id)}">
        <img src="${echapperAttr(cover)}" alt="Couverture ${echapperAttr(livre.titre)}"
          onerror="this.onerror=null;this.src='${echapperAttr(fallback)}'" />
      </a>
      <div class="offline-book__body">
        <div class="offline-book__meta">
          <span>${chapitres} chapitre${chapitres > 1 ? 's' : ''}</span>
          <span>${taille}</span>
        </div>
        <h2 class="offline-book__title">
          <a href="/pages/reader.html?id=${encodeURIComponent(livre.id)}">${echapper(livre.titre || 'Livre hors-ligne')}</a>
        </h2>
        <p class="offline-book__author">${echapper(livre.auteur || 'Auteur inconnu')}</p>
        ${resume}
        <div class="offline-book__footer">
          <span>Sauvegardé le ${date}</span>
          <button class="btn btn--ghost btn--sm" data-remove-offline="${echapperAttr(livre.id)}" data-title="${echapperAttr(livre.titre || '')}">
            Retirer
          </button>
        </div>
      </div>
    </article>`;
}

async function retirerLivre(id, titre) {
  if (!id) return;
  if (!confirm(`Retirer "${titre}" du mode hors-ligne ?`)) return;
  try {
    await supprimerLivre(id);
    toast('Livre retiré du mode hors-ligne.', 'info');
    await rendreBibliothequeLocale();
  } catch (err) {
    console.error(err);
    toastErreur('Impossible de retirer ce livre.');
  }
}

function mettreAJourEtatReseau() {
  if (!stateEl) return;
  const online = navigator.onLine;
  stateEl.textContent = online ? 'Connecté' : 'Hors connexion';
  stateEl.classList.toggle('is-offline', !online);
}

function formatKo(ko) {
  const value = Number(ko || 0);
  if (value < 1024) return `${Math.max(0, Math.round(value))} Ko`;
  return `${(value / 1024).toFixed(1).replace('.0', '')} Mo`;
}

function echapper(valeur = '') {
  return String(valeur)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
