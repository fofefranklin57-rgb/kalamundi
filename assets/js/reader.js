/* ============================================================
   reader.js — Lecteur intégré d'œuvres
   Kalamundi — La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
import { getParam, lsGet, lsSet, toast, toastErreur } from './utils.js';
import { traduire, viderCacheTraduction, rendreOptionLangues, LANGUES_LECTURE } from './translate.js';
import { activerProtections } from './security.js';

/* Nombre de pages scrollées gratuites pour les visiteurs non connectés */
const LIMIT_VISITEUR_PAGES = 2;

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

  // Limite visiteur — détecter scroll bas de page pour visiteurs
  if (!etat.utilisateur) {
    _surveilerScrollVisiteur();
  }

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
  const langueSource = etat.oeuvre?.langue_originale || 'fr';
  return traduire(chapitreId, contenu, langue, langueSource);
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

// ── Surveillance scroll visiteur ──────────────────────────────
let _scrollPagesLues = 0;
let _scrollHandler   = null;
let _modalMontree    = false;

function _reinitScrollVisiteur() {
  // Réinitialise l'état entre chapitres pour éviter le freeze persistant
  _scrollPagesLues = 0;
  _modalMontree    = false;
  document.body.style.overflow = '';
}

function _surveilerScrollVisiteur() {
  // Réinitialiser l'état au chargement de chaque chapitre
  _reinitScrollVisiteur();

  // Supprimer l'ancien handler si existant
  if (_scrollHandler) window.removeEventListener('scroll', _scrollHandler);

  const hauteurFenetre = window.innerHeight;
  let seuilsAtteints   = new Set();

  _scrollHandler = () => {
    if (_modalMontree) return;
    const scrollY   = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;

    // Bug fix : éviter la division par zéro sur les chapitres courts
    const scrollable = Math.max(1, docHeight - hauteurFenetre);
    const pct        = scrollY / scrollable;

    // Chaque "page" = 100% de hauteur fenêtre scrollée
    const pageActuelle = Math.floor(scrollY / hauteurFenetre);

    if (pageActuelle > 0 && !seuilsAtteints.has(pageActuelle)) {
      seuilsAtteints.add(pageActuelle);
      _scrollPagesLues = seuilsAtteints.size;
    }

    // Après LIMIT_VISITEUR_PAGES pages scrollées OU arrivée à 80% du contenu
    // (pct >= 0.80 seulement si le contenu est scrollable — chapitre long)
    const contenuScrollable = (docHeight - hauteurFenetre) > 100;
    if (_scrollPagesLues >= LIMIT_VISITEUR_PAGES || (contenuScrollable && pct >= 0.80)) {
      _modalMontree = true;
      window.removeEventListener('scroll', _scrollHandler);
      // Bloquer le scroll
      document.body.style.overflow = 'hidden';
      _afficherModalAbonnement();
    }
  };

  window.addEventListener('scroll', _scrollHandler, { passive: true });
}

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
   Modal abonnement visiteur
   ============================================================ */

function _afficherModalAbonnement() {
  const modal = document.getElementById('modal-abonnement');
  if (!modal) return;

  // Pré-remplir le lien de retour après inscription
  const retour = encodeURIComponent(`/pages/reader.html?id=${etat.oeuvreId}&ch=${etat.chapitreNum}`);

  const btnInscription = document.getElementById('modal-btn-inscription');
  const btnConnexion   = document.getElementById('modal-btn-connexion');
  if (btnInscription) btnInscription.href = `/pages/login.html?mode=inscription&next=${retour}`;
  if (btnConnexion)   btnConnexion.href   = `/pages/login.html?next=${retour}`;

  // Afficher via la classe CSS (gère l'animation opacity)
  modal.style.display = '';     // enlever l'inline display:none du HTML
  modal.classList.add('is-open');

  // Bouton "Continuer comme visiteur" — ferme le modal + débloque le scroll
  const btnVisiteur = document.getElementById('modal-btn-visiteur');
  if (btnVisiteur) {
    // Remplacer l'éventuel ancien listener avant d'en ajouter un nouveau
    const newBtn = btnVisiteur.cloneNode(true);
    btnVisiteur.parentNode.replaceChild(newBtn, btnVisiteur);
    newBtn.addEventListener('click', () => {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      // Autoriser encore quelques scrolls avant le prochain déclenchement
      _scrollPagesLues = 0;
      _modalMontree    = false;
      // Re-attacher le handler avec un seuil remonté (1 seule page restante)
      if (!etat.utilisateur) _surveilerScrollVisiteurStrict();
    });
  }
}

/* Variante stricte : re-déclenche immédiatement si le visiteur scrolle encore */
function _surveilerScrollVisiteurStrict() {
  if (_scrollHandler) window.removeEventListener('scroll', _scrollHandler);
  const hauteurFenetre = window.innerHeight;

  _scrollHandler = () => {
    if (_modalMontree) return;
    const scrollY   = window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const scrollable = Math.max(1, docHeight - hauteurFenetre);
    const pct        = scrollY / scrollable;

    if (pct >= 0.95) { // Toute tentative d'arriver en bas
      _modalMontree = true;
      window.removeEventListener('scroll', _scrollHandler);
      document.body.style.overflow = 'hidden';
      _afficherModalAbonnement();
    }
  };
  window.addEventListener('scroll', _scrollHandler, { passive: true });
}

/* ============================================================
   Bouton partager
   ============================================================ */

document.getElementById('btn-partager')?.addEventListener('click', async () => {
  const url = `${window.location.origin}/pages/work.html?id=${etat.oeuvreId}&ref=share`;
  const titre = etat.oeuvre?.titre || 'Un livre sur Kalamundi';
  const texte = `Lis "${titre}" gratuitement sur Kalamundi — La Plume du Monde`;

  try {
    if (navigator.share) {
      await navigator.share({ title: titre, text: texte, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast('Lien copié ! Partagez-le pour inviter quelqu\'un à lire.', 'success');
    }
  } catch { /* annulé par l'utilisateur */ }
});

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
