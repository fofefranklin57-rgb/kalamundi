/* ============================================================
   annotations.js — Marque-pages, Notes, Surligneur
   Kalamundi — La Plume du Monde

   Architecture :
   - Stockage local  : localStorage (disponible hors-ligne)
   - Stockage distant : Supabase (si connecté) — sync au chargement
   - Les deux sont fusionnés, local fait foi si conflit

   Types : 'marque_page' | 'note' | 'surlignage'
   ============================================================ */

import { api } from './api.js';
import { activerModeAnnotation, desactiverModeAnnotation } from './security.js';
import { toast } from './utils.js';

/* ============================================================
   CONSTANTES
   ============================================================ */

const COULEURS_SURLIGNAGE = {
  jaune: { bg: '#FFF176', border: '#F9A825', label: 'Jaune' },
  vert:  { bg: '#C8E6C9', border: '#388E3C', label: 'Vert'  },
  bleu:  { bg: '#BBDEFB', border: '#1976D2', label: 'Bleu'  },
  rose:  { bg: '#F8BBD0', border: '#C2185B', label: 'Rose'  },
};

/* ============================================================
   ÉTAT
   ============================================================ */

let _oeuvreId    = null;
let _userId      = null;
let _chapitreNum = 1;
let _chapitreId  = null;
let _annotations = [];     // cache local en mémoire
let _onChangeCb  = null;   // callback à appeler après modification

/* ============================================================
   INIT
   ============================================================ */

export async function initAnnotations({ oeuvreId, userId, chapitreNum, chapitreId, onChange }) {
  _oeuvreId    = oeuvreId;
  _userId      = userId;
  _chapitreNum = chapitreNum;
  _chapitreId  = chapitreId;
  _onChangeCb  = onChange;

  _annotations = _chargerLocal();

  // Sync Supabase si connecté
  if (userId) {
    try {
      const distantes = await api.getAnnotations(userId, oeuvreId);
      _annotations = _fusionner(_annotations, distantes);
      _sauvegarderLocal(_annotations);
    } catch { /* offline — on garde le local */ }
  }
}

export function mettreAJourChapitre(chapitreNum, chapitreId) {
  _chapitreNum = chapitreNum;
  _chapitreId  = chapitreId;
}

/* ============================================================
   STOCKAGE LOCAL
   ============================================================ */

function _cleStorage() { return `kala_annot_${_oeuvreId}`; }

function _chargerLocal() {
  try {
    return JSON.parse(localStorage.getItem(_cleStorage()) || '[]');
  } catch { return []; }
}

function _sauvegarderLocal(annotations) {
  try {
    localStorage.setItem(_cleStorage(), JSON.stringify(annotations));
  } catch { /* quota dépassé */ }
}

function _fusionner(local, distant) {
  const map = new Map();
  // Local d'abord
  local.forEach(a => map.set(a.id, a));
  // Distant écrase si plus récent
  distant.forEach(a => {
    const loc = map.get(a.id);
    if (!loc || new Date(a.updated_at) > new Date(loc.updated_at || 0)) {
      map.set(a.id, a);
    }
  });
  return Array.from(map.values());
}

/* ============================================================
   ACCESSEURS
   ============================================================ */

export function getAnnotationsChapitreActuel() {
  return _annotations.filter(a => a.chapitre_num === _chapitreNum);
}

export function getToutesAnnotations() {
  return [..._annotations];
}

export function getMarquePages() {
  return _annotations.filter(a => a.type === 'marque_page').sort((a, b) => a.chapitre_num - b.chapitre_num);
}

export function getNotes() {
  return _annotations.filter(a => a.type === 'note').sort((a, b) => a.chapitre_num - b.chapitre_num);
}

export function getSurlignages() {
  return _annotations.filter(a => a.type === 'surlignage');
}

export function aMarquePage(chapitreNum) {
  return _annotations.some(a => a.type === 'marque_page' && a.chapitre_num === chapitreNum);
}

/* ============================================================
   MARQUE-PAGE
   ============================================================ */

export async function toggleMarquePage(label = null) {
  const existant = _annotations.find(
    a => a.type === 'marque_page' && a.chapitre_num === _chapitreNum
  );

  if (existant) {
    // Supprimer
    _annotations = _annotations.filter(a => a.id !== existant.id);
    _sauvegarderLocal(_annotations);
    if (_userId) api.supprimerAnnotation(existant.id).catch(() => {});
    toast('Marque-page retiré', 'info');
  } else {
    // Créer
    const ann = {
      id:           crypto.randomUUID(),
      user_id:      _userId,
      oeuvre_id:    _oeuvreId,
      chapitre_id:  _chapitreId,
      chapitre_num: _chapitreNum,
      type:         'marque_page',
      label:        label || `Chapitre ${_chapitreNum}`,
      created_at:   new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    };
    _annotations.push(ann);
    _sauvegarderLocal(_annotations);
    if (_userId) {
      try {
        const sauvegarde = await api.upsertMarquePage(_userId, _oeuvreId, _chapitreId, _chapitreNum, ann.label);
        // Remplacer l'id local par l'id Supabase
        const idx = _annotations.findIndex(a => a.id === ann.id);
        if (idx !== -1 && sauvegarde?.id) _annotations[idx] = { ...ann, ...sauvegarde };
        _sauvegarderLocal(_annotations);
      } catch { /* offline — ok */ }
    }
    toast('Marque-page ajouté ✓', 'success');
  }

  _onChangeCb?.();
  return !existant; // true = ajouté, false = retiré
}

/* ============================================================
   NOTE
   ============================================================ */

export async function ajouterNote(texteSelectionne, contenu, couleur = 'jaune') {
  if (!contenu?.trim()) return;

  const ann = {
    id:               crypto.randomUUID(),
    user_id:          _userId,
    oeuvre_id:        _oeuvreId,
    chapitre_id:      _chapitreId,
    chapitre_num:     _chapitreNum,
    type:             'note',
    texte_selectionne: texteSelectionne || null,
    contenu:          contenu.trim(),
    couleur,
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };

  _annotations.push(ann);
  _sauvegarderLocal(_annotations);

  if (_userId) {
    try {
      const s = await api.creerAnnotation(ann);
      const idx = _annotations.findIndex(a => a.id === ann.id);
      if (idx !== -1 && s?.id) _annotations[idx] = { ...ann, ...s };
      _sauvegarderLocal(_annotations);
    } catch { /* offline */ }
  }

  toast('Note ajoutée ✓', 'success');
  _onChangeCb?.();
}

export async function supprimerAnnotation(id) {
  _annotations = _annotations.filter(a => a.id !== id);
  _sauvegarderLocal(_annotations);
  if (_userId) api.supprimerAnnotation(id).catch(() => {});
  _onChangeCb?.();
}

export async function modifierNote(id, nouveauContenu) {
  const idx = _annotations.findIndex(a => a.id === id);
  if (idx === -1) return;
  _annotations[idx] = { ..._annotations[idx], contenu: nouveauContenu, updated_at: new Date().toISOString() };
  _sauvegarderLocal(_annotations);
  if (_userId) api.updateAnnotation(id, { contenu: nouveauContenu }).catch(() => {});
  _onChangeCb?.();
}

/* ============================================================
   SURLIGNAGE
   ============================================================ */

export async function ajouterSurlignage(texteSelectionne, couleur = 'jaune', paragrapheIndex = 0) {
  if (!texteSelectionne?.trim()) return;

  const ann = {
    id:               crypto.randomUUID(),
    user_id:          _userId,
    oeuvre_id:        _oeuvreId,
    chapitre_id:      _chapitreId,
    chapitre_num:     _chapitreNum,
    type:             'surlignage',
    texte_selectionne: texteSelectionne.trim(),
    couleur,
    paragraphe_index: paragrapheIndex,
    created_at:       new Date().toISOString(),
    updated_at:       new Date().toISOString(),
  };

  _annotations.push(ann);
  _sauvegarderLocal(_annotations);

  if (_userId) {
    try {
      const s = await api.creerAnnotation(ann);
      const idx = _annotations.findIndex(a => a.id === ann.id);
      if (idx !== -1 && s?.id) _annotations[idx] = { ...ann, ...s };
      _sauvegarderLocal(_annotations);
    } catch { /* offline */ }
  }

  _onChangeCb?.();
}

/* ============================================================
   APPLIQUER LES SURLIGNAGES SUR LE DOM
   ============================================================ */

export function appliquerSurlignagesSurDOM(contentEl, chapitreNum) {
  const surlignages = _annotations.filter(
    a => a.type === 'surlignage' && a.chapitre_num === chapitreNum
  );

  if (!surlignages.length) return;

  const paragraphes = contentEl.querySelectorAll('p');

  surlignages.forEach(s => {
    const cible = s.paragraphe_index != null
      ? paragraphes[s.paragraphe_index]
      : null;

    const els = cible ? [cible] : Array.from(paragraphes);
    const cfg  = COULEURS_SURLIGNAGE[s.couleur] || COULEURS_SURLIGNAGE.jaune;

    for (const p of els) {
      if (!p.textContent.includes(s.texte_selectionne)) continue;

      // Remplacer le texte par un <mark> surligné
      const escaped = s.texte_selectionne.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex   = new RegExp(escaped, 'g');

      p.innerHTML = p.innerHTML.replace(regex, match =>
        `<mark class="kala-hl" data-annot-id="${s.id}"
          style="background:${cfg.bg};border-bottom:2px solid ${cfg.border};
          border-radius:2px;padding:0 1px;cursor:pointer"
          title="Surlignage ${cfg.label} — cliquer pour options">${match}</mark>`
      );
      break; // une seule occurrence
    }
  });

  // Clic sur surlignage → menu contextuel (supprimer / noter)
  contentEl.querySelectorAll('.kala-hl').forEach(mark => {
    mark.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = mark.dataset.annotId;
      afficherMenuSurlignage(mark, id);
    });
  });
}

function afficherMenuSurlignage(markEl, id) {
  const existing = document.getElementById('kala-hl-menu');
  if (existing) existing.remove();

  const rect = markEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'kala-hl-menu';
  menu.className = 'annot-ctx-menu';
  menu.style.cssText = `
    position:fixed;
    top:${rect.bottom + 6}px;
    left:${Math.min(rect.left, window.innerWidth - 180)}px;
    z-index:9990;
  `;

  menu.innerHTML = `
    <button class="annot-ctx-item" id="hl-add-note">📝 Ajouter une note</button>
    <button class="annot-ctx-item annot-ctx-item--danger" id="hl-delete">🗑 Supprimer</button>
  `;

  document.body.appendChild(menu);

  menu.querySelector('#hl-add-note')?.addEventListener('click', () => {
    menu.remove();
    const ann = _annotations.find(a => a.id === id);
    afficherModalNote(ann?.texte_selectionne || '');
  });

  menu.querySelector('#hl-delete')?.addEventListener('click', async () => {
    menu.remove();
    await supprimerAnnotation(id);
    markEl.outerHTML = markEl.textContent; // retirer le mark
    toast('Surlignage supprimé', 'info');
  });

  // Fermer au clic extérieur
  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 10);
}

/* ============================================================
   TOOLBAR FLOTTANTE (apparaît sur sélection de texte)
   ============================================================ */

let _toolbarEl = null;

export function initToolbarAnnotation(contentEl) {
  // Activer le mode annotation (permet la sélection)
  activerModeAnnotation();

  document.addEventListener('mouseup', (e) => {
    const sel = window.getSelection();
    const texte = sel?.toString().trim();

    // Cacher si sélection vide ou hors du contenu
    if (!texte || !contentEl.contains(sel?.anchorNode)) {
      _cacherToolbar();
      return;
    }

    if (texte.length < 2) { _cacherToolbar(); return; }

    const range = sel.getRangeAt(0);
    const rect  = range.getBoundingClientRect();

    // Trouver l'index du paragraphe
    let paragrapheIndex = 0;
    const p = sel.anchorNode?.parentElement?.closest('p');
    if (p) {
      paragrapheIndex = Array.from(contentEl.querySelectorAll('p')).indexOf(p);
    }

    _afficherToolbar(texte, rect, paragrapheIndex);
  });

  // Cacher la toolbar au scroll
  window.addEventListener('scroll', _cacherToolbar, { passive: true });
}

function _afficherToolbar(texte, rect, paragrapheIndex) {
  _cacherToolbar();

  const tb = document.createElement('div');
  tb.id = 'kala-annot-toolbar';
  tb.className = 'annot-toolbar';

  const top  = rect.top + window.scrollY - 48;
  const left = Math.min(
    rect.left + window.scrollX + rect.width / 2 - 110,
    window.innerWidth - 240
  );

  tb.style.cssText = `top:${Math.max(8, top)}px;left:${Math.max(8, left)}px`;

  tb.innerHTML = `
    <span class="annot-toolbar__label">Surligner :</span>
    ${Object.entries(COULEURS_SURLIGNAGE).map(([key, cfg]) => `
      <button class="annot-toolbar__color" data-color="${key}"
        style="background:${cfg.bg};border-color:${cfg.border}"
        title="${cfg.label}" aria-label="Surligner en ${cfg.label}">
      </button>`).join('')}
    <div class="annot-toolbar__sep"></div>
    <button class="annot-toolbar__btn" id="toolbar-note" title="Ajouter une note">📝</button>
    <button class="annot-toolbar__btn" id="toolbar-marque" title="Marque-page ici">🔖</button>
  `;

  document.body.appendChild(tb);
  _toolbarEl = tb;

  // Surlignage couleur
  tb.querySelectorAll('.annot-toolbar__color').forEach(btn => {
    btn.addEventListener('mousedown', async (e) => {
      e.preventDefault(); // conserver la sélection
      const couleur = btn.dataset.color;
      await ajouterSurlignage(texte, couleur, paragrapheIndex);
      _cacherToolbar();
      window.getSelection()?.removeAllRanges();
      // Réappliquer les surlignages sur le DOM
      const contentElDOM = document.getElementById('reader-content');
      if (contentElDOM) {
        contentElDOM.querySelectorAll('.kala-hl').forEach(m => {
          if (!_annotations.some(a => a.id === m.dataset.annotId)) {
            m.outerHTML = m.textContent;
          }
        });
        appliquerSurlignagesSurDOM(contentElDOM, _chapitreNum);
      }
    });
  });

  // Note
  tb.querySelector('#toolbar-note')?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    _cacherToolbar();
    afficherModalNote(texte);
    window.getSelection()?.removeAllRanges();
  });

  // Marque-page
  tb.querySelector('#toolbar-marque')?.addEventListener('mousedown', async (e) => {
    e.preventDefault();
    _cacherToolbar();
    window.getSelection()?.removeAllRanges();
    await toggleMarquePage(`Chapitre ${_chapitreNum} — ${texte.slice(0, 40)}…`);
    // Mettre à jour le bouton marque-page dans la topbar
    _rafraichirBoutonMarquePage();
  });
}

function _cacherToolbar() {
  if (_toolbarEl) {
    _toolbarEl.remove();
    _toolbarEl = null;
  }
}

/* ============================================================
   MODAL NOTE
   ============================================================ */

export function afficherModalNote(texteSelectionne = '', noteExistante = null) {
  const existing = document.getElementById('kala-modal-note');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'kala-modal-note';
  modal.className = 'annot-modal-overlay';

  modal.innerHTML = `
    <div class="annot-modal">
      <div class="annot-modal__header">
        <h3 class="annot-modal__title">
          ${noteExistante ? '✏️ Modifier la note' : '📝 Nouvelle note'}
        </h3>
        <button class="annot-modal__close" id="annot-modal-close">✕</button>
      </div>

      ${texteSelectionne ? `
        <div class="annot-modal__quote">
          <span class="annot-modal__quote-icon">❝</span>
          <p>${texteSelectionne.slice(0, 200)}${texteSelectionne.length > 200 ? '…' : ''}</p>
        </div>` : ''}

      <div class="annot-modal__couleurs">
        <span style="font-size:12px;color:var(--text-light)">Couleur :</span>
        ${Object.entries(COULEURS_SURLIGNAGE).map(([key, cfg]) => `
          <label class="annot-couleur-label">
            <input type="radio" name="annot-couleur" value="${key}"
              ${(noteExistante?.couleur || 'jaune') === key ? 'checked' : ''} />
            <span style="background:${cfg.bg};border:2px solid ${cfg.border}"
              class="annot-couleur-dot" title="${cfg.label}"></span>
          </label>`).join('')}
      </div>

      <textarea class="annot-modal__textarea" id="annot-note-textarea"
        placeholder="Écris ta note ici…"
        rows="4">${noteExistante?.contenu || ''}</textarea>

      <div class="annot-modal__actions">
        <button class="btn btn--ghost btn--sm" id="annot-modal-annuler">Annuler</button>
        <button class="btn btn--primary btn--sm" id="annot-modal-sauver">
          ${noteExistante ? 'Modifier' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const fermer = () => modal.remove();

  modal.querySelector('#annot-modal-close')?.addEventListener('click', fermer);
  modal.querySelector('#annot-modal-annuler')?.addEventListener('click', fermer);
  modal.addEventListener('click', e => { if (e.target === modal) fermer(); });

  modal.querySelector('#annot-modal-sauver')?.addEventListener('click', async () => {
    const contenu = modal.querySelector('#annot-note-textarea')?.value.trim();
    const couleur = modal.querySelector('input[name="annot-couleur"]:checked')?.value || 'jaune';
    if (!contenu) return;

    if (noteExistante) {
      await modifierNote(noteExistante.id, contenu);
    } else {
      await ajouterNote(texteSelectionne, contenu, couleur);
    }
    fermer();
  });

  // Focus textarea
  setTimeout(() => modal.querySelector('#annot-note-textarea')?.focus(), 50);
}

/* ============================================================
   PANNEAU ANNOTATIONS (drawer latéral droit)
   ============================================================ */

export function afficherPanneauAnnotations(onNaviguerChapitre) {
  const existing = document.getElementById('kala-annot-panel');
  if (existing) { existing.remove(); return; } // toggle

  const panel = document.createElement('div');
  panel.id = 'kala-annot-panel';
  panel.className = 'annot-panel';

  panel.innerHTML = `
    <div class="annot-panel__header">
      <h2 class="annot-panel__title">Mes annotations</h2>
      <button class="annot-panel__close" id="annot-panel-close">✕</button>
    </div>

    <div class="annot-panel__tabs">
      <button class="annot-tab is-active" data-tab="marques">🔖 Marque-pages</button>
      <button class="annot-tab" data-tab="notes">📝 Notes</button>
      <button class="annot-tab" data-tab="surlignages">🖊 Surlignages</button>
    </div>

    <div class="annot-panel__content" id="annot-panel-content">
      <!-- Rempli par _rendreOnglet() -->
    </div>
  `;

  document.body.appendChild(panel);

  // Close
  panel.querySelector('#annot-panel-close')?.addEventListener('click', () => panel.remove());

  // Onglets
  panel.querySelectorAll('.annot-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      panel.querySelectorAll('.annot-tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      _rendreOnglet(tab.dataset.tab, panel.querySelector('#annot-panel-content'), onNaviguerChapitre);
    });
  });

  // Rendre le premier onglet
  _rendreOnglet('marques', panel.querySelector('#annot-panel-content'), onNaviguerChapitre);

  // Animation entrée
  requestAnimationFrame(() => panel.classList.add('is-open'));
}

function _rendreOnglet(type, conteneur, onNaviguerChapitre) {
  if (!conteneur) return;

  if (type === 'marques') {
    const marques = getMarquePages();
    if (!marques.length) {
      conteneur.innerHTML = _vide('Aucun marque-page', 'Appuie sur 🔖 en lisant pour marquer ta position.');
      return;
    }
    conteneur.innerHTML = marques.map(m => `
      <div class="annot-item annot-item--marque" data-id="${m.id}" data-ch="${m.chapitre_num}">
        <div class="annot-item__icon">🔖</div>
        <div class="annot-item__body">
          <div class="annot-item__label">${m.label || `Chapitre ${m.chapitre_num}`}</div>
          <div class="annot-item__ch">Chapitre ${m.chapitre_num}</div>
        </div>
        <button class="annot-item__del" data-id="${m.id}" title="Supprimer">🗑</button>
      </div>`).join('');

  } else if (type === 'notes') {
    const notes = getNotes();
    if (!notes.length) {
      conteneur.innerHTML = _vide('Aucune note', 'Sélectionne du texte puis clique 📝 pour annoter.');
      return;
    }
    const COULEURS = COULEURS_SURLIGNAGE;
    conteneur.innerHTML = notes.map(n => `
      <div class="annot-item annot-item--note" data-id="${n.id}" data-ch="${n.chapitre_num}"
        style="border-left-color:${COULEURS[n.couleur]?.border || '#ccc'}">
        <div class="annot-item__body">
          <div class="annot-item__ch">Chapitre ${n.chapitre_num}</div>
          ${n.texte_selectionne ? `
            <div class="annot-item__quote">❝ ${n.texte_selectionne.slice(0, 80)}…</div>` : ''}
          <div class="annot-item__contenu">${n.contenu}</div>
        </div>
        <div class="annot-item__actions">
          <button class="annot-item__edit" data-id="${n.id}" title="Modifier">✏️</button>
          <button class="annot-item__del"  data-id="${n.id}" title="Supprimer">🗑</button>
        </div>
      </div>`).join('');

  } else if (type === 'surlignages') {
    const surl = getSurlignages();
    if (!surl.length) {
      conteneur.innerHTML = _vide('Aucun surlignage', 'Sélectionne du texte pour surligner en couleur.');
      return;
    }
    const COULEURS = COULEURS_SURLIGNAGE;
    conteneur.innerHTML = surl.map(s => `
      <div class="annot-item annot-item--surl" data-id="${s.id}" data-ch="${s.chapitre_num}">
        <div class="annot-item__color-dot"
          style="background:${COULEURS[s.couleur]?.bg};border:2px solid ${COULEURS[s.couleur]?.border}">
        </div>
        <div class="annot-item__body">
          <div class="annot-item__ch">Chapitre ${s.chapitre_num}</div>
          <div class="annot-item__quote">❝ ${s.texte_selectionne?.slice(0, 100) || ''}…</div>
        </div>
        <button class="annot-item__del" data-id="${s.id}" title="Supprimer">🗑</button>
      </div>`).join('');
  }

  // Navigation vers le chapitre au clic
  conteneur.querySelectorAll('.annot-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const ch = parseInt(item.dataset.ch);
      if (ch && onNaviguerChapitre) {
        onNaviguerChapitre(ch);
        document.getElementById('kala-annot-panel')?.remove();
      }
    });
  });

  // Supprimer
  conteneur.querySelectorAll('.annot-item__del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await supprimerAnnotation(btn.dataset.id);
      _rendreOnglet(type, conteneur, onNaviguerChapitre);
    });
  });

  // Modifier note
  conteneur.querySelectorAll('.annot-item__edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const note = _annotations.find(a => a.id === btn.dataset.id);
      if (note) afficherModalNote(note.texte_selectionne || '', note);
    });
  });
}

function _vide(titre, sous) {
  return `
    <div class="annot-empty">
      <div class="annot-empty__icon">✨</div>
      <div class="annot-empty__titre">${titre}</div>
      <p class="annot-empty__sous">${sous}</p>
    </div>`;
}

/* ============================================================
   RAFRAÎCHIR LE BOUTON MARQUE-PAGE DANS LA TOPBAR
   ============================================================ */

export function _rafraichirBoutonMarquePage() {
  const btn = document.getElementById('btn-marque-page');
  if (!btn) return;
  const actif = aMarquePage(_chapitreNum);
  btn.classList.toggle('is-active', actif);
  btn.title = actif ? 'Retirer le marque-page' : 'Ajouter un marque-page';
  btn.textContent = actif ? '🔖' : '🔖';
  btn.setAttribute('aria-pressed', actif);
}

export { COULEURS_SURLIGNAGE };
