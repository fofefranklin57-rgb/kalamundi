import { api } from './api.js';
import { getUser } from './auth.js';
import { formatDate, toastErreur, toastSucces } from './utils.js';

let utilisateur = null;
let communautes = [];
let communauteActive = null;
let mesCommunautes = new Set();

document.addEventListener('DOMContentLoaded', async () => {
  utilisateur = await getUser();
  if (utilisateur) {
    const rows = await api.getMesCommunautes(utilisateur.id).catch(() => []);
    mesCommunautes = new Set(rows.map(r => r.communaute_id));
  }

  brancherUI();
  await chargerCommunautes();
});

function brancherUI() {
  document.getElementById('btn-open-create')?.addEventListener('click', () => {
    if (!utilisateur) {
      window.location.href = '/pages/login.html?redirect=/pages/communautes.html';
      return;
    }
    ouvrirModal(true);
  });
  document.getElementById('close-create-community')?.addEventListener('click', () => ouvrirModal(false));
  document.getElementById('cancel-create-community')?.addEventListener('click', () => ouvrirModal(false));
  document.getElementById('save-create-community')?.addEventListener('click', creerCommunaute);
  document.getElementById('community-search')?.addEventListener('input', debounce(chargerCommunautes, 300));
}

async function chargerCommunautes() {
  const recherche = document.getElementById('community-search')?.value.trim() || '';
  const list = document.getElementById('communities-list');
  list.innerHTML = '<div class="empty-state"><div class="spinner"></div></div>';
  try {
    communautes = await api.getCommunautes({ recherche });
    if (!communautes.length) {
      list.innerHTML = '<div class="empty-state"><p class="empty-state__title">Aucune communauté</p></div>';
      return;
    }
    list.innerHTML = communautes.map(renderCommunauteRow).join('');
    list.querySelectorAll('.community-row').forEach(btn => {
      btn.addEventListener('click', () => ouvrirCommunaute(btn.dataset.id));
    });
    if (!communauteActive) ouvrirCommunaute(communautes[0].id);
  } catch (e) {
    list.innerHTML = '<p style="color:var(--color-error)">Impossible de charger les communautés.</p>';
  }
}

function renderCommunauteRow(c) {
  return `
    <button class="community-row ${communauteActive?.id === c.id ? 'is-active' : ''}" data-id="${c.id}">
      <span class="community-row__name">${escapeHtml(c.nom)}</span>
      <span class="community-row__meta">${escapeHtml(c.theme || 'Lecture')} · ${escapeHtml(c.pays || c.langue || 'Kalamundi')}</span>
    </button>`;
}

async function ouvrirCommunaute(id) {
  communauteActive = communautes.find(c => c.id === id);
  if (!communauteActive) return;
  document.querySelectorAll('.community-row').forEach(row => row.classList.toggle('is-active', row.dataset.id === id));
  await renderDetail();
}

async function renderDetail() {
  const c = communauteActive;
  const detail = document.getElementById('community-detail');
  const estMembre = utilisateur && mesCommunautes.has(c.id);
  detail.innerHTML = `
    <div class="community-hero">
      <div>
        <h2>${escapeHtml(c.nom)}</h2>
        <p>${escapeHtml(c.description || 'Un espace pour lire, recommander et discuter autour des œuvres Kalamundi.')}</p>
        <div class="community-badges">
          ${c.theme ? `<span class="badge badge--primary">${escapeHtml(c.theme)}</span>` : ''}
          ${c.pays ? `<span class="badge badge--muted">${escapeHtml(c.pays)}</span>` : ''}
          <span class="badge badge--gratuit">${escapeHtml(c.langue || 'fr')}</span>
        </div>
      </div>
      <button class="btn ${estMembre ? 'btn--outline' : 'btn--primary'}" id="btn-toggle-member">
        ${estMembre ? 'Quitter' : 'Rejoindre'}
      </button>
    </div>
    ${estMembre ? `
      <div class="community-post-form">
        <textarea class="form-textarea" id="community-post-text" rows="3" maxlength="1200" placeholder="Lance une discussion, recommande une œuvre ou propose une lecture commune."></textarea>
        <button class="btn btn--primary" id="btn-send-post" style="margin-top:var(--spacing-sm)">Publier</button>
      </div>` : ''}
    <div id="community-posts"><div class="empty-state"><div class="spinner"></div></div></div>`;

  document.getElementById('btn-toggle-member')?.addEventListener('click', toggleMembre);
  document.getElementById('btn-send-post')?.addEventListener('click', creerPost);
  await chargerPosts();
}

async function chargerPosts() {
  const wrap = document.getElementById('community-posts');
  try {
    const posts = await api.getPostsCommunaute(communauteActive.id);
    if (!posts.length) {
      wrap.innerHTML = '<div class="empty-state"><p class="empty-state__title">Pas encore de discussion</p><p class="empty-state__text">Sois le premier à lancer le cercle.</p></div>';
      return;
    }
    wrap.innerHTML = posts.map(renderPost).join('');
  } catch {
    wrap.innerHTML = '<p style="color:var(--color-error)">Impossible de charger les discussions.</p>';
  }
}

function renderPost(p) {
  return `
    <article class="community-post">
      <div class="community-post__head">
        <span class="community-post__author">${escapeHtml(p.profiles?.nom || 'Membre')}</span>
        <span>${formatDate(p.created_at)}</span>
      </div>
      <div class="community-post__text">${escapeHtml(p.contenu)}</div>
      ${p.oeuvres ? `<a href="/pages/work.html?id=${p.oeuvres.id}" class="badge badge--primary" style="margin-top:var(--spacing-sm);text-decoration:none">${escapeHtml(p.oeuvres.titre)}</a>` : ''}
    </article>`;
}

async function toggleMembre() {
  if (!utilisateur) {
    window.location.href = '/pages/login.html?redirect=/pages/communautes.html';
    return;
  }
  try {
    if (mesCommunautes.has(communauteActive.id)) {
      await api.quitterCommunaute(communauteActive.id, utilisateur.id);
      mesCommunautes.delete(communauteActive.id);
      toastSucces('Communauté quittée.');
    } else {
      await api.rejoindreCommunaute(communauteActive.id, utilisateur.id);
      mesCommunautes.add(communauteActive.id);
      toastSucces('Bienvenue dans la communauté.');
    }
    await renderDetail();
  } catch (e) {
    toastErreur(e.message || 'Action impossible.');
  }
}

async function creerPost() {
  const textarea = document.getElementById('community-post-text');
  const contenu = textarea?.value.trim();
  if (!contenu) return toastErreur('Écris un message avant de publier.');
  try {
    await api.creerPostCommunaute({
      communaute_id: communauteActive.id,
      user_id: utilisateur.id,
      contenu,
    });
    textarea.value = '';
    toastSucces('Message publié.');
    await chargerPosts();
  } catch (e) {
    toastErreur(e.message || 'Publication impossible.');
  }
}

async function creerCommunaute() {
  const nom = document.getElementById('community-name').value.trim();
  if (!nom) return toastErreur('Le nom est obligatoire.');
  const btn = document.getElementById('save-create-community');
  btn.disabled = true;
  btn.textContent = 'Création…';
  try {
    const communaute = await api.creerCommunaute({
      createur_id: utilisateur.id,
      nom,
      theme: document.getElementById('community-theme').value.trim() || null,
      pays: document.getElementById('community-country').value.trim() || null,
      description: document.getElementById('community-description').value.trim() || null,
      langue: 'fr',
    });
    ouvrirModal(false);
    mesCommunautes.add(communaute.id);
    toastSucces('Communauté créée.');
    await chargerCommunautes();
    ouvrirCommunaute(communaute.id);
  } catch (e) {
    toastErreur(e.message || 'Création impossible.');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Créer';
  }
}

function ouvrirModal(open) {
  document.getElementById('modal-create-community')?.classList.toggle('is-open', open);
}

function debounce(fn, wait) {
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, wait);
  };
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
