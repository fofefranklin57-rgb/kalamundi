/* ============================================================
   pub.js — Injection bannières publicitaires Kalamundi
   Utilisation : import { injecterPub } from './pub.js';
                 injecterPub('home');   // ou 'library', 'reader', 'work', 'education'
   Les bannières ne s'affichent PAS aux admins.
   ============================================================ */

import { api } from './api.js';
import { supabase } from './auth.js';

const STYLE = `
  .pub-bande {
    width: 100%;
    background: var(--bg-card, #f8faf8);
    border: 1px solid var(--border-color, #a8d5b5);
    border-radius: var(--border-radius-lg, 16px);
    overflow: hidden;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 20px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    text-decoration: none;
    color: inherit;
    transition: box-shadow 0.2s, transform 0.2s;
    cursor: pointer;
  }
  .pub-bande:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.10); transform: translateY(-1px); }
  .pub-bande__img { width: 80px; height: 60px; object-fit: cover; border-radius: 8px; flex-shrink: 0; background: var(--bg-secondary); }
  .pub-bande__body { flex: 1; min-width: 0; }
  .pub-bande__titre { font-weight: 700; font-size: 14px; color: var(--color-primary, #1B4332); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pub-bande__cta { display: inline-block; margin-top: 6px; padding: 4px 14px; background: var(--color-accent, #D4A017); color: #000; border-radius: 99px; font-size: 12px; font-weight: 700; }
  .pub-bande__label { font-size: 9px; color: var(--text-light, #888); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 2px; }
  .pub-wrapper { margin: 24px 0; }
  @media(max-width: 600px) {
    .pub-bande { flex-direction: column; align-items: flex-start; gap: 10px; }
    .pub-bande__img { width: 100%; height: 100px; }
  }
`;

function injecterStyles() {
  if (document.getElementById('pub-styles')) return;
  const s = document.createElement('style');
  s.id = 'pub-styles';
  s.textContent = STYLE;
  document.head.appendChild(s);
}

function rendBanniere(b) {
  const wrapper = document.createElement('div');
  wrapper.className = 'pub-wrapper';

  const lien = document.createElement('a');
  lien.className = 'pub-bande';
  lien.href = b.lien_cible || '#';
  if (b.lien_cible) lien.target = '_blank';
  lien.rel = 'noopener sponsored';
  lien.setAttribute('data-pub-id', b.id);

  lien.innerHTML = `
    ${b.image_url ? `<img class="pub-bande__img" src="${b.image_url}" alt="${b.titre}" loading="lazy" />` : ''}
    <div class="pub-bande__body">
      <div class="pub-bande__label">Publicité</div>
      <div class="pub-bande__titre">${b.titre}</div>
      <span class="pub-bande__cta">${b.texte_cta || 'En savoir plus'}</span>
    </div>`;

  lien.addEventListener('click', () => {
    api.pubEnregistrerClic(b.id);
  });

  wrapper.appendChild(lien);
  return wrapper;
}

export async function injecterPub(page = 'all') {
  try {
    // Ne pas afficher aux admins
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const { data: profil } = await supabase
        .from('profiles').select('role').eq('id', session.user.id).single();
      if (profil?.role === 'admin' || profil?.role === 'auteur') return;
    }

    // Vérifier pub_activee dans config
    const { data: cfg } = await supabase
      .from('config_plateforme').select('valeur').eq('cle', 'pub_activee').single();
    if (cfg?.valeur === 'false') return;

    const bannieres = await api.pubGetBannierePage(page);
    if (!bannieres.length) return;

    injecterStyles();

    // Trouver le point d'injection selon la page
    const ancre = _trouverAncre(page);
    if (!ancre) return;

    bannieres.forEach(b => {
      const el = rendBanniere(b);
      ancre.parentNode.insertBefore(el, ancre);
      // Enregistrer impression
      api.pubEnregistrerImpression(b.id);
    });

  } catch (e) {
    // Silencieux — la pub ne doit jamais casser le reste de la page
    console.warn('[Pub] Erreur injection:', e);
  }
}

function _trouverAncre(page) {
  const selectors = {
    home:      '#section-nouveautes, .section--cta, footer',
    library:   '.lib-main, main footer, footer',
    reader:    '.reader-bottombar, footer',
    work:      '.section--cta, footer',
    education: 'footer, main',
  };
  const liste = (selectors[page] || selectors['home']).split(', ');
  for (const sel of liste) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return document.querySelector('footer') || document.querySelector('main');
}
