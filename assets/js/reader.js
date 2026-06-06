/* ============================================================
   reader.js — Lecteur intégré d'œuvres
   Kalamundi — La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
import { getParam, lsGet, lsSet, toast, toastErreur } from './utils.js';
import { traduire, viderCacheTraduction, rendreOptionLangues, LANGUES_LECTURE } from './translate.js';
import { activerProtections } from './security.js';

/* ============================================================
   État du lecteur
   ============================================================ */

const etat = {
  oeuvreId:    getParam('id'),
  chapitreNum: parseInt(getParam('ch') || '1'),
  langueAffichee: lsGet('reader_langue') || 'original',
  fontSize:    parseInt(lsGet('reader_fontsize') || '18'),
  lineHeight:  parseFloat(lsGet('reader_lh') || '1.9'),
  theme:       lsGet('reader_theme') || 'light',
  chapitres:   [],
  oeuvre:      null,
  utilisateur: null,
};

/* ============================================================
   Init
   ============================================================ */

(async () => {
  if (!etat.oeuvreId) {
    window.location.href = '/pages/library.html';
    return;
  }

  etat.utilisateur = await getUser();

  try {
    [etat.oeuvre, etat.chapitres] = await Promise.all([
      api.getOeuvre(etat.oeuvreId),
      api.getChapitres(etat.oeuvreId),
    ]);
  } catch {
    toastErreur('Impossible de charger cette œuvre.');
    return;
  }

  appliquerPreferences();
  rendreInfos();
  rendreTOC();
  _rendreOptionLangues();
  await chargerChapitre(etat.chapitreNum);
  restaurerProgression();
  api.incrementerLectures(etat.oeuvreId).catch(() => {});
})();

/* ============================================================
   Charger un chapitre
   ============================================================ */

async function chargerChapitre(numero) {
  etat.chapitreNum = numero;
  const contentEl  = document.getElementById('reader-content');
  const loadingEl  = document.getElementById('reader-loading');

  contentEl.innerHTML = '';
  loadingEl.style.display = 'flex';

  const chapitre = etat.chapitres.find(c => c.numero === numero);
  if (!chapitre) {
    toastErreur('Chapitre introuvable.');
    loadingEl.style.display = 'none';
    return;
  }

  // Charger le contenu complet du chapitre
  let contenu = '';
  try {
    const ch = await api.getChapitre(chapitre.id);
    contenu = ch.contenu_texte;
  } catch {
    toastErreur('Erreur de chargement du chapitre.');
    loadingEl.style.display = 'none';
    return;
  }

  // Traduire si nécessaire
  if (etat.langueAffichee !== 'original') {
    loadingEl.querySelector('span').textContent = 'Traduction en cours...';
    try {
      const traduit = await obtenirTraduction(chapitre.id, contenu, etat.langueAffichee);
      contenu = traduit;
    } catch {
      toast('Traduction indisponible — affichage en langue originale.', 'info');
      etat.langueAffichee = 'original';
    }
  }

  loadingEl.style.display = 'none';
  contentEl.innerHTML = formaterTexte(contenu);

  // Protections sécurité + watermark
  activerProtections(contentEl, etat.utilisateur?.id);

  // Mise à jour UI
  mettreAJourNavigation();
  mettreAJourProgression();
  mettreAJourTOC();
  sauvegarderProgression();

  // Scroll vers le haut
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   Formatage du texte
   ============================================================ */

function formaterTexte(texte) {
  return texte
    .split('\n')
    .map(ligne => ligne.trim())
    .filter(ligne => ligne)
    .map(ligne => `<p>${ligne}</p>`)
    .join('');
}

/* ============================================================
   Traduction — délégué à translate.js
   ============================================================ */

async function obtenirTraduction(chapitreId, contenu, langue) {
  return traduire(chapitreId, contenu, langue);
}

/* ============================================================
   Panneau sélecteur de langues — 11 langues via translate.js
   ============================================================ */

function _rendreOptionLangues() {
  const conteneur = document.getElementById('lang-options');
  rendreOptionLangues(conteneur, etat.langueAffichee, async (code) => {
    etat.langueAffichee = code;
    lsSet('reader_langue', code);

    const isOriginal = code === 'original';
    document.getElementById('translation-notice').style.display = isOriginal ? 'none' : 'block';

    const langue = LANGUES_LECTURE.find(l => l.code === code);
    document.getElementById('lang-label').textContent = isOriginal
      ? '🌐'
      : (langue?.drapeau || code.toUpperCase());

    document.getElementById('reader-lang-panel').classList.remove('is-open');
    await chargerChapitre(etat.chapitreNum);
  });
}

/* ============================================================
   Navigation chapitres
   ============================================================ */

function mettreAJourNavigation() {
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  btnPrev.disabled = etat.chapitreNum <= 1;
  btnNext.disabled = etat.chapitreNum >= etat.chapitres.length;
}

document.getElementById('btn-prev')?.addEventListener('click', () => {
  if (etat.chapitreNum > 1) chargerChapitre(etat.chapitreNum - 1);
});

document.getElementById('btn-next')?.addEventListener('click', () => {
  if (etat.chapitreNum < etat.chapitres.length) chargerChapitre(etat.chapitreNum + 1);
});

/* ============================================================
   Progression
   ============================================================ */

function mettreAJourProgression() {
  const pct = etat.chapitres.length > 0
    ? Math.round((etat.chapitreNum / etat.chapitres.length) * 100) : 0;
  document.getElementById('progress-fill').style.width = `${pct}%`;
  document.getElementById('reader-position').textContent =
    `Chapitre ${etat.chapitreNum} sur ${etat.chapitres.length} · ${pct}%`;
}

async function sauvegarderProgression() {
  if (!etat.utilisateur) return;
  const sessionId = lsGet('reader_session') || crypto.randomUUID();
  lsSet('reader_session', sessionId);
  try {
    await api.sauvegarderProgression(
      etat.utilisateur.id, etat.oeuvreId,
      etat.chapitreNum, 1, sessionId
    );
  } catch {}
}

async function restaurerProgression() {
  if (!etat.utilisateur || etat.chapitreNum !== 1) return;
  try {
    const prog = await api.getProgression(etat.utilisateur.id, etat.oeuvreId);
    if (prog && prog.chapitre_courant > 1) {
      toast(`Reprendre au chapitre ${prog.chapitre_courant} ?`, 'info');
      // Ajouter bouton "Reprendre" dans le toast — simplifié ici
    }
  } catch {}
}

/* ============================================================
   Infos topbar
   ============================================================ */

function rendreInfos() {
  if (!etat.oeuvre) return;
  document.getElementById('topbar-titre').textContent   = etat.oeuvre.titre;
  document.getElementById('page-title').textContent     = `${etat.oeuvre.titre} — Kalamundi`;
  document.title = `${etat.oeuvre.titre} — Kalamundi`;
  document.getElementById('back-btn').href = `/pages/work.html?id=${etat.oeuvreId}`;
}

/* ============================================================
   Table des matières
   ============================================================ */

function rendreTOC() {
  const listEl = document.getElementById('toc-list');
  listEl.innerHTML = etat.chapitres.map(ch => `
    <div class="toc-item ${ch.numero === etat.chapitreNum ? 'is-current' : ''}"
      data-num="${ch.numero}">
      <div class="toc-item__num">${ch.numero}</div>
      <span>${ch.titre || `Chapitre ${ch.numero}`}</span>
    </div>
  `).join('');

  listEl.querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', () => {
      chargerChapitre(parseInt(item.dataset.num));
      fermerTOC();
    });
  });
}

function mettreAJourTOC() {
  document.querySelectorAll('.toc-item').forEach(item => {
    item.classList.toggle('is-current', parseInt(item.dataset.num) === etat.chapitreNum);
  });
  document.getElementById('topbar-chapitre').textContent =
    etat.chapitres.find(c => c.numero === etat.chapitreNum)?.titre
    || `Chapitre ${etat.chapitreNum}`;
}

document.getElementById('btn-toc')?.addEventListener('click', () => {
  document.getElementById('reader-toc').classList.toggle('is-open');
  fermerPanneaux('toc');
});

document.getElementById('close-toc')?.addEventListener('click', fermerTOC);
document.getElementById('toc-overlay')?.addEventListener('click', fermerTOC);

function fermerTOC() {
  document.getElementById('reader-toc').classList.remove('is-open');
}

/* ============================================================
   Paramètres de lecture
   ============================================================ */

document.getElementById('btn-settings')?.addEventListener('click', () => {
  const panel = document.getElementById('reader-settings');
  panel.classList.toggle('is-open');
  fermerPanneaux('settings');
});

// Thèmes
document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    etat.theme = btn.dataset.theme;
    document.body.className = `reader-body${etat.theme !== 'light' ? ` theme-${etat.theme}` : ''}`;
    lsSet('reader_theme', etat.theme);
  });
});

// Taille police
const MIN_FONT = 14, MAX_FONT = 28;

document.getElementById('font-up')?.addEventListener('click', () => {
  if (etat.fontSize >= MAX_FONT) return;
  etat.fontSize += 2;
  appliquerFontSize();
});

document.getElementById('font-down')?.addEventListener('click', () => {
  if (etat.fontSize <= MIN_FONT) return;
  etat.fontSize -= 2;
  appliquerFontSize();
});

function appliquerFontSize() {
  document.getElementById('reader-content').style.fontSize = `${etat.fontSize}px`;
  document.getElementById('font-size-display').textContent = `${etat.fontSize}px`;
  lsSet('reader_fontsize', etat.fontSize);
}

// Interligne
document.querySelectorAll('.line-height-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.line-height-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    etat.lineHeight = parseFloat(btn.dataset.lh);
    document.getElementById('reader-content').style.lineHeight = etat.lineHeight;
    lsSet('reader_lh', etat.lineHeight);
  });
});

/* ============================================================
   Sélecteur de langue
   ============================================================ */

document.getElementById('btn-lang')?.addEventListener('click', () => {
  const panel = document.getElementById('reader-lang-panel');
  panel.classList.toggle('is-open');
  fermerPanneaux('lang');
});

/* Les listeners .lang-option sont gérés par _rendreOptionLangues() via translate.js */

/* ============================================================
   Fermer les panneaux ouverts
   ============================================================ */

function fermerPanneaux(saufCelui) {
  if (saufCelui !== 'settings') document.getElementById('reader-settings').classList.remove('is-open');
  if (saufCelui !== 'lang')     document.getElementById('reader-lang-panel').classList.remove('is-open');
}

document.addEventListener('click', (e) => {
  const settings = document.getElementById('reader-settings');
  const lang     = document.getElementById('reader-lang-panel');
  if (!e.target.closest('#reader-settings') && !e.target.closest('#btn-settings')) {
    settings.classList.remove('is-open');
  }
  if (!e.target.closest('#reader-lang-panel') && !e.target.closest('#btn-lang')) {
    lang.classList.remove('is-open');
  }
});

/* ============================================================
   Appliquer les préférences sauvegardées
   ============================================================ */

function appliquerPreferences() {
  // Thème
  if (etat.theme !== 'light') {
    document.body.classList.add(`theme-${etat.theme}`);
    document.querySelector(`[data-theme="${etat.theme}"]`)?.classList.add('is-active');
    document.querySelector(`[data-theme="light"]`)?.classList.remove('is-active');
  }

  // Taille police
  document.getElementById('reader-content').style.fontSize = `${etat.fontSize}px`;
  document.getElementById('font-size-display').textContent = `${etat.fontSize}px`;

  // Interligne
  document.getElementById('reader-content').style.lineHeight = etat.lineHeight;
  document.querySelectorAll('.line-height-btn').forEach(btn => {
    btn.classList.toggle('is-active', parseFloat(btn.dataset.lh) === etat.lineHeight);
  });

  // Langue
  if (etat.langueAffichee !== 'original') {
    document.querySelectorAll('.lang-option').forEach(o => o.classList.remove('is-active'));
    document.querySelector(`[data-lang="${etat.langueAffichee}"]`)?.classList.add('is-active');
    document.getElementById('lang-label').textContent = etat.langueAffichee.toUpperCase();
    document.getElementById('translation-notice').style.display = 'block';
  }
}

/* ============================================================
   Raccourcis clavier
   ============================================================ */

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    if (etat.chapitreNum < etat.chapitres.length) chargerChapitre(etat.chapitreNum + 1);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (etat.chapitreNum > 1) chargerChapitre(etat.chapitreNum - 1);
  }
  if (e.key === 'Escape') {
    fermerTOC();
    fermerPanneaux('');
  }
});
