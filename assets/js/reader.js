/* ============================================================
   reader.js — Lecteur immersif Kalamundi
   La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
import { genererCouverture } from './cover-generator.js';
import { getParam, lsGet, lsSet, toast, toastErreur } from './utils.js';
import { traduire, viderCacheTraduction, rendreOptionLangues, LANGUES_LECTURE } from './translate.js';
import { activerProtections } from './security.js';
import {
  initAnnotations, mettreAJourChapitre,
  initToolbarAnnotation, appliquerSurlignagesSurDOM,
  afficherPanneauAnnotations, toggleMarquePage,
  _rafraichirBoutonMarquePage,
} from './annotations.js';

/* Nombre de pages gratuites pour les visiteurs (session entière, toutes pages confondues) */
const LIMIT_VISITEUR_PAGES = 5;

/* Couleur par genre pour la couverture (doit correspondre à library.js) */
const GENRE_COULEURS = {
  roman:             '#2D6A4F', nouvelle: '#1B5E20', conte: '#E65100',
  thriller:          '#B71C1C', romance:  '#AD1457', sf_fantasy: '#1565C0',
  poesie:            '#6A1B9A', litterature_orale: '#00695C',
  essai:             '#37474F', autobiographie: '#5D4037',
  temoignage:        '#558B2F', philosophie: '#4527A0',
  histoire:          '#6D4C41', jeunesse: '#2E7D32',
};

const GENRE_EMOJIS = {
  roman: '📗', nouvelle: '📗', conte: '📙', thriller: '🔴',
  romance: '💗', sf_fantasy: '🚀', poesie: '✍️', litterature_orale: '🎭',
  essai: '📝', autobiographie: '👤', temoignage: '✍️',
  philosophie: '🧠', histoire: '🏛️', jeunesse: '🌟',
};

const LANGUES_NOMS = {
  fr: '🇫🇷 Français', en: '🇬🇧 Anglais', ar: '🇸🇦 Arabe',
  sw: '🌍 Swahili',   ha: '🌍 Haoussa', yo: '🌍 Yoruba',
  es: '🇪🇸 Espagnol', pt: '🇧🇷 Portugais', de: '🇩🇪 Allemand',
};

/* ============================================================
   ÉTAT DU LECTEUR
   ============================================================ */

const etat = {
  oeuvreId:       getParam('id'),
  chapitreNum:    parseInt(getParam('ch') || '1'),
  langueAffichee: lsGet('reader_langue') || 'original',
  fontSize:       parseInt(lsGet('reader_fontsize') || '18'),
  lineHeight:     parseFloat(lsGet('reader_lh') || '1.9'),
  maxWidth:       parseInt(lsGet('reader_width') || '680'),
  theme:          lsGet('reader_theme') || 'light',
  chapitres:      [],
  oeuvre:         null,
  utilisateur:    null,
  couvertureVisible: true,
  pages:          0,   // nombre de pages dans le chapitre courant (après pagination)
  pageCourante:   1,   // page courante (1-indexed)
};

/* ============================================================
   INIT
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

  // Afficher la couverture en premier
  afficherCouverture();
  remplirTOC();
  remplirNavPanelChapitres();
  _rendreOptionLangues();

})();

/* ============================================================
   PREMIÈRE DE COUVERTURE
   ============================================================ */

function afficherCouverture() {
  const oeuvre = etat.oeuvre;
  if (!oeuvre) return;

  const genre   = (oeuvre.genre || '').toLowerCase();
  const couleur = GENRE_COULEURS[genre] || '#1B4332';
  const emoji   = GENRE_EMOJIS[genre]   || '📖';
  const auteur  = oeuvre.profiles?.nom  || 'Auteur inconnu';
  const pays    = oeuvre.profiles?.pays  || '';

  // Fond dynamique : si pas de couverture → dégradé couleur genre
  const bgEl = document.getElementById('cover-bg');
  if (oeuvre.couverture_url) {
    bgEl.style.backgroundImage = `url('${oeuvre.couverture_url}')`;
    bgEl.style.background      = `url('${oeuvre.couverture_url}') center/cover no-repeat`;
  } else {
    bgEl.style.background = `linear-gradient(160deg, ${couleur} 0%, color-mix(in srgb, ${couleur} 50%, #000) 100%)`;
  }

  // Miniature livre — générée automatiquement si pas de couverture uploadée
  const bookEl  = document.getElementById('cover-book-img');
  const coverGenerated = genererCouverture(
    oeuvre.titre, auteur, (oeuvre.genre || '').toLowerCase(), 220, 308
  );
  if (oeuvre.couverture_url) {
    bookEl.innerHTML = `<img src="${oeuvre.couverture_url}" alt="Couverture de ${oeuvre.titre}"
      onerror="this.onerror=null;this.src='${coverGenerated}'" />`;
  } else {
    bookEl.innerHTML = `<img src="${coverGenerated}" alt="Couverture générée — ${oeuvre.titre}" />`;
  }

  // Métadonnées
  const genreLabel = oeuvre.genre ? oeuvre.genre.charAt(0).toUpperCase() + oeuvre.genre.slice(1) : '';
  document.getElementById('cover-genre').textContent  = genreLabel;
  document.getElementById('cover-title').textContent  = oeuvre.titre;
  document.getElementById('cover-author').textContent = `par ${auteur}${pays ? ' · ' + pays : ''}`;

  // Infos : langue · chapitres · accès
  const langue  = LANGUES_NOMS[oeuvre.langue_originale] || oeuvre.langue_originale || '?';
  const nbCh    = etat.chapitres.length;
  const acces   = oeuvre.statut === 'premium' ? '⭐ Premium' : '🆓 Gratuit';
  document.getElementById('cover-info').innerHTML = `
    <span>${langue}</span>
    <span class="dot"></span>
    <span>📚 ${nbCh} chapitre${nbCh > 1 ? 's' : ''}</span>
    <span class="dot"></span>
    <span>${acces}</span>
  `;

  // Résumé
  document.getElementById('cover-resume').textContent = oeuvre.resume || '';
  if (!oeuvre.resume) document.getElementById('cover-resume').style.display = 'none';

  // Lien retour
  const backBtn = document.getElementById('cover-back-btn');
  if (backBtn) backBtn.href = `/pages/work.html?id=${etat.oeuvreId}`;

  // TOC : couverture miniature (générée si absente ou cassée)
  const tocCover   = document.getElementById('toc-cover');
  const tocCoverSrc = oeuvre.couverture_url || coverGenerated;
  tocCover.innerHTML = `
    <img src="${tocCoverSrc}" alt="Couverture"
      onerror="this.onerror=null;this.src='${coverGenerated}'" />
    <div class="reader-toc__cover-overlay">
      <div class="reader-toc__cover-title">${oeuvre.titre}</div>
    </div>`;

  document.getElementById('toc-book-title').textContent = oeuvre.titre;
  document.getElementById('toc-author').textContent     = `par ${auteur}`;
  document.title = `${oeuvre.titre} — Kalamundi`;
  document.getElementById('page-title').textContent = `${oeuvre.titre} — Kalamundi`;
}

/* Bouton "Commencer la lecture" */
document.getElementById('btn-start-reading')?.addEventListener('click', entrerDansLecteur);

/* Bouton 📚 dans la topbar (retour couverture) */
document.getElementById('btn-show-cover')?.addEventListener('click', () => {
  document.getElementById('reader-cover').style.display = 'flex';
  document.getElementById('reader-page').style.display  = 'none';
  etat.couvertureVisible = true;
});

async function entrerDansLecteur() {
  document.getElementById('reader-cover').style.display = 'none';
  document.getElementById('reader-page').style.display  = '';
  etat.couvertureVisible = false;

  appliquerPreferences();

  // Init annotations (localStorage + Supabase sync)
  const chapDepart0 = etat.chapitreNum;
  await initAnnotations({
    oeuvreId:    etat.oeuvreId,
    userId:      etat.utilisateur?.id || null,
    chapitreNum: chapDepart0,
    chapitreId:  etat.chapitres.find(c => c.numero === chapDepart0)?.id || null,
    onChange:    () => _rafraichirBoutonMarquePage(),
  });

  // Init toolbar de sélection
  initToolbarAnnotation(document.getElementById('reader-content'));

  // Restaurer progression si connecté
  const prog = etat.utilisateur
    ? await api.getProgression(etat.utilisateur.id, etat.oeuvreId).catch(() => null)
    : null;

  const chapDepart = prog?.chapitre_courant > 1 ? prog.chapitre_courant : etat.chapitreNum;

  await chargerChapitre(chapDepart, true /* premier chargement — pas d'animation titre */);
  api.incrementerLectures(etat.oeuvreId).catch(() => {});

  if (prog?.chapitre_courant > 1) {
    toast(`Reprise au chapitre ${prog.chapitre_courant}`, 'info');
  }

  // Volet de navigation ouvert par défaut sur desktop
  if (window.innerWidth > 900) ouvrirNavPanel();

  // La progression est gérée par la pagination (pas de scroll)
}

/* ============================================================
   CHARGER UN CHAPITRE
   ============================================================ */

async function chargerChapitre(numero, sansAnimation = false) {
  etat.chapitreNum = numero;

  const contentEl  = document.getElementById('reader-content');
  const loadingEl  = document.getElementById('reader-loading');

  // Page de titre de chapitre (sauf premier chargement)
  if (!sansAnimation && etat.chapitres.length > 1) {
    await afficherPageTitreChapitre(numero);
  }

  // Effacer + loader
  contentEl.classList.remove('is-visible');
  contentEl.classList.add('is-loading');
  contentEl.innerHTML = '';
  loadingEl.style.display = 'flex';

  const chapitre = etat.chapitres.find(c => c.numero === numero);
  if (!chapitre) {
    toastErreur('Chapitre introuvable.');
    loadingEl.style.display = 'none';
    return;
  }

  // Charger le texte
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
    loadingEl.querySelector('span').textContent = 'Traduction en cours…';
    try {
      contenu = await obtenirTraduction(chapitre.id, contenu, etat.langueAffichee);
    } catch {
      toast('Traduction indisponible — affichage en langue originale.', 'info');
      etat.langueAffichee = 'original';
    }
  }

  loadingEl.style.display = 'none';
  contentEl.innerHTML = formaterTexte(contenu);

  // Animation d'entrée
  contentEl.classList.remove('is-loading');
  contentEl.classList.add('is-visible');

  // Appliquer la largeur max du texte
  contentEl.style.maxWidth  = `${etat.maxWidth}px`;
  contentEl.style.fontSize  = `${etat.fontSize}px`;
  contentEl.style.lineHeight = etat.lineHeight;

  // Style paratextuel selon le type d'élément du chapitre
  _appliquerStyleParatextuel(contentEl, chapitre);

  // Protections + watermark
  activerProtections(contentEl, etat.utilisateur?.id);

  // Appliquer les surlignages sauvegardés
  appliquerSurlignagesSurDOM(contentEl, numero);

  // Mettre à jour le contexte d'annotations pour ce chapitre
  mettreAJourChapitre(numero, chapitre.id);
  _rafraichirBoutonMarquePage();

  // UI — la position/progression est mise à jour dans _paginerContenu via _mettreAJourPositionPage
  mettreAJourNavigation();
  mettreAJourTOC();
  mettreAJourNavPanelChapitres();
  remplirNavPanelTitres();
  remplirNavPanelPages(); // liste les pages du chapitre après pagination
  sauvegarderProgression();
  rendreInfosTopbar();

  // Scroll haut
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Pagination : découper le texte en pages de hauteur écran
  _paginerContenu(contentEl);
  mettreAJourNavigation();
  _mettreAJourPositionPage();
}

/* ============================================================
   PAGE DE TITRE DE CHAPITRE
   ============================================================ */

function afficherPageTitreChapitre(numero) {
  return new Promise(resolve => {
    const page   = document.getElementById('chapter-title-page');
    const numEl  = document.getElementById('chap-title-num');
    const titreEl = document.getElementById('chap-title-text');

    const chapitre = etat.chapitres.find(c => c.numero === numero);
    numEl.textContent  = `Chapitre ${numero}`;
    titreEl.textContent = chapitre?.titre || '';

    page.style.display = 'flex';

    setTimeout(() => {
      page.style.display = 'none';
      resolve();
    }, 1400);
  });
}

/* ============================================================
   FORMATAGE DU TEXTE — nettoyage intelligent
   Gere les imports PDF/Word : en-tetes repetes, double espaces,
   separateurs visuels, dialogues, epigraphes, ornements
   ============================================================ */

function formaterTexte(texte) {

  /* ETAPE 0 : Protéger les marqueurs de saut de page originaux (PDF)
     avant tout autre traitement */
  const texteAvecMarqueurs = texte.replace(/---PAGE---/g, '\n§PGBRK§\n');

  /* ETAPE 1 : Supprimer les en-tetes de page PDF repetes
     Pattern : “Titre · Auteur · N” en debut de chaque page */
  const lignesBrutes  = texteAvecMarqueurs.split('\n').filter(l => l.trim());
  const rxEnTete      = /^.{4,120}\xb7\s*\d{1,3}\s+/;
  const nbEnTetes     = lignesBrutes.filter(l => rxEnTete.test(l)).length;
  const estPDF        = nbEnTetes / Math.max(lignesBrutes.length, 1) > 0.35;
  const lignesPropres = estPDF
    ? lignesBrutes.map(l => l.replace(rxEnTete, '').trim())
    : lignesBrutes;

  /* ETAPE 2 : Decoupage intelligent des paragraphes */
  const txt = lignesPropres.join('\n')
    .replace(/[—\-]{4,}/g, '\n§SEP§\n')
    .replace(/✦|★|✶|✴/g, '\n§ORN§\n')
    .replace(/\*\s*\*\s*\*/g, '\n§ORN§\n')
    // Saut de para SEULEMENT apres ponctuation forte + double espace + debut de phrase
    .replace(/([.!?\xbb])\s{2,}([A-Z\xc0-\xdc«””—])/g, '$1\n$2')
    // Debut de dialogue reel (apres ponctuation forte)
    .replace(/([.!?\xbb\n])\s*—\s+([A-Z\xc0-\xdc])/g, '$1\n— $2');

  /* ETAPE 3 : Decouper et consolider les micro-blocs (artefacts OCR) */
  const blocsRaw = txt.split('\n').map(l => l.trim()).filter(l => l);
  const blocs = [];
  for (const b of blocsRaw) {
    const isMarqueur = b === '§SEP§' || b === '§ORN§' || b === '§PGBRK§';
    const isSpecial  = isMarqueur
      || /^[—–]\s/.test(b)
      || /^\xa9/.test(b)
      || /^P\.?\s*S/i.test(b)
      || /^\xab|^”|^“/.test(b)
      || /^(A propos|About)/i.test(b);

    // Fusionner les micro-blocs avec le precedent (artefacts OCR)
    if (!isSpecial && b.length < 55 && blocs.length > 0) {
      const prev = blocs[blocs.length - 1];
      if (prev !== '§SEP§' && prev !== '§ORN§' && prev !== '§PGBRK§') {
        blocs[blocs.length - 1] = prev + ' ' + b;
        continue;
      }
    }
    blocs.push(b);
  }

  /* ETAPE 4 : HTML fidèle à l'auteur — sans injection de métadonnées
     (résumé, auteur → déjà dans work.html) */
  let premierVrai = true;
  const html = [];

  for (const bloc of blocs) {
    // Numéros de page PDF résiduels → ignorer
    if (/^.{4,80}\xb7\s*\d{1,3}$/.test(bloc)) continue;

    if (bloc === '§PGBRK§') { html.push('<div class="reader-page-break" data-forced="true"></div>'); premierVrai = true; continue; }
    if (bloc === '§SEP§') { html.push('<hr class="reader-sep" />'); continue; }
    if (bloc === '§ORN§') { html.push('<div class="reader-ornament" aria-hidden="true">✦</div>'); continue; }

    if (/^\xa9|Tous droits|All rights reserved/i.test(bloc)) {
      html.push(`<p class="reader-legal">${bloc}</p>`); continue;
    }
    if (/^P\.?\s*S\.?\s+/i.test(bloc)) {
      html.push(`<p class="reader-ps">${bloc}</p>`); continue;
    }
    if (/^(Chapitre|Chapter|Partie|Part|Prologue|Épilogue|Epilogue|Dédicace|À propos|About the|Note de l.auteur|Biographie)\b/i.test(bloc) && bloc.length < 80) {
      html.push(`<h2 class="reader-section-title">${bloc}</h2>`);
      premierVrai = true; continue;
    }
    if (/^[—–]\s/.test(bloc)) {
      html.push(`<p class="reader-dialogue">${bloc}</p>`); continue;
    }
    if (/^\xab|^\u201c|^\u201d/.test(bloc) && bloc.length < 400) {
      html.push(`<blockquote class="reader-quote"><p>${bloc}</p></blockquote>`); continue;
    }
    // Titre en majuscules (PROLOGUE, ÉPILOGUE…)
    if (bloc.length < 70 && /^[A-Z\xc0-\xdc\s\-']+$/.test(bloc) && !/[.!?,;:]/.test(bloc)) {
      html.push(`<h3 class="reader-inner-title">${bloc}</h3>`);
      premierVrai = true; continue;
    }

    const cls = premierVrai ? ' class="is-first"' : '';
    html.push(`<p${cls}>${bloc}</p>`);
    if (premierVrai) premierVrai = false;
  }

  return html.join('');
}


/* ============================================================
   TRADUCTION
   ============================================================ */

async function obtenirTraduction(chapitreId, contenu, langue) {
  const langueSource = etat.oeuvre?.langue_originale || 'fr';
  return traduire(chapitreId, contenu, langue, langueSource);
}

/* ============================================================
   SÉLECTEUR DE LANGUES
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

    if (!etat.couvertureVisible) {
      await chargerChapitre(etat.chapitreNum, true);
    }
  });
}

/* ============================================================
   TOPBAR — infos
   ============================================================ */

function rendreInfosTopbar() {
  if (!etat.oeuvre) return;
  document.getElementById('topbar-titre').textContent = etat.oeuvre.titre;
  const ch = etat.chapitres.find(c => c.numero === etat.chapitreNum);
  document.getElementById('topbar-chapitre').textContent =
    ch?.titre ? `Chapitre ${etat.chapitreNum} — ${ch.titre}` : `Chapitre ${etat.chapitreNum} / ${etat.chapitres.length}`;
  document.getElementById('back-btn')?.setAttribute('href', `/pages/work.html?id=${etat.oeuvreId}`);
}

/* ============================================================
   TABLE DES MATIÈRES
   ============================================================ */

/* Types paratextuels par zone du livre */
const LIMMINAIRES = ['dedicace','epigraphe','avant_propos','preface','introduction','prologue','sommaire'];
const TERMINAUX   = ['epilogue','conclusion','postface','remerciements','bibliographie','annexe','index','glossaire'];

const LABELS_TYPE = {
  dedicace:'Dédicace', epigraphe:'Épigraphe', avant_propos:'Avant-propos',
  preface:'Préface', introduction:'Introduction', prologue:'Prologue',
  sommaire:'Sommaire', chapitre:'Chapitre', partie:'Partie',
  interlude:'Interlude', epilogue:'Épilogue', conclusion:'Conclusion',
  postface:'Postface', remerciements:'Remerciements',
  bibliographie:'Bibliographie', annexe:'Annexe', index:'Index', glossaire:'Glossaire',
};

function remplirTOC() {
  const listEl = document.getElementById('toc-list');

  let html = '';
  let afficheCorps    = false;
  let afficheTerminal = false;
  let numChapitre     = 0;

  etat.chapitres.forEach(ch => {
    const type   = ch.type_element || 'chapitre';
    const estLim = LIMMINAIRES.includes(type);
    const estTer = TERMINAUX.includes(type);
    const estCh  = !estLim && !estTer;

    // Séparateur "Corps du livre"
    if (estCh && !afficheCorps) {
      afficheCorps = true;
      if (etat.chapitres.some(c => LIMMINAIRES.includes(c.type_element || ''))) {
        html += `<div class="toc-separator">Corps du livre</div>`;
      }
    }

    // Séparateur "En fin de livre"
    if (estTer && !afficheTerminal) {
      afficheTerminal = true;
      html += `<div class="toc-separator">En fin de livre</div>`;
    }

    // Numérotation uniquement pour les chapitres du corps
    const num = type === 'chapitre' ? ++numChapitre : null;

    const estParatexte = estLim || estTer;
    const label = estParatexte
      ? (ch.titre || LABELS_TYPE[type] || type)
      : (ch.titre || `Chapitre ${num}`);

    html += `
      <div class="toc-item ${ch.numero === etat.chapitreNum ? 'is-current' : ''} ${estParatexte ? 'toc-item--paratexte' : ''}"
        data-num="${ch.numero}">
        <div class="toc-item__num">${num || '—'}</div>
        <span>${label}</span>
      </div>`;
  });

  listEl.innerHTML = html;

  listEl.querySelectorAll('.toc-item').forEach(item => {
    item.addEventListener('click', () => {
      const numCible = parseInt(item.dataset.num);
      if (_visiteurBloque() && numCible !== etat.chapitreNum) {
        fermerTOC();
        _modalMontree = true;
        document.body.style.overflow = 'hidden';
        _afficherModalAbonnement();
        return;
      }
      chargerChapitre(numCible);
      fermerTOC();
    });
  });
}

function mettreAJourTOC() {
  document.querySelectorAll('.toc-item').forEach(item => {
    const actif = parseInt(item.dataset.num) === etat.chapitreNum;
    item.classList.toggle('is-current', actif);
    item.querySelector('.toc-item__num')?.classList.toggle('is-current', actif);
  });
}

document.getElementById('btn-toc')?.addEventListener('click', () => {
  document.getElementById('reader-toc').classList.toggle('is-open');
});

document.getElementById('close-toc')?.addEventListener('click', fermerTOC);
document.getElementById('toc-overlay')?.addEventListener('click', fermerTOC);

function fermerTOC() {
  document.getElementById('reader-toc').classList.remove('is-open');
}

/* ============================================================
   VOLET DE NAVIGATION (Word-style)
   ============================================================ */

const _navPanel    = document.getElementById('reader-nav-panel');
const _navOverlay  = document.getElementById('nav-panel-overlay');
const _navBtnOpen  = document.getElementById('btn-nav-panel');
const _navPage     = document.getElementById('reader-page');

function ouvrirNavPanel() {
  _navPanel?.classList.add('is-open');
  _navPage?.classList.add('nav-panel-open');
  // Overlay uniquement sur mobile (sur desktop il bloquerait les clics sur le texte)
  if (window.innerWidth <= 900) _navOverlay?.classList.add('is-visible');
  _navBtnOpen?.setAttribute('aria-expanded', 'true');
  _navBtnOpen?.classList.add('is-active');
  _majLanguetteNav(true);
}

function fermerNavPanel() {
  _navPanel?.classList.remove('is-open');
  _navPage?.classList.remove('nav-panel-open');
  _navOverlay?.classList.remove('is-visible');
  _navBtnOpen?.setAttribute('aria-expanded', 'false');
  _navBtnOpen?.classList.remove('is-active');
  _majLanguetteNav(false);
}

function _majLanguetteNav(ouvert) {
  const tab = document.getElementById('btn-toggle-nav-tab');
  if (!tab) return;
  tab.textContent    = ouvert ? '‹' : '›';
  tab.title          = ouvert ? 'Rétracter le volet' : 'Ouvrir le volet';
  tab.ariaLabel      = ouvert ? 'Rétracter le volet' : 'Ouvrir le volet';
}

function toggleNavPanel() {
  _navPanel?.classList.contains('is-open') ? fermerNavPanel() : ouvrirNavPanel();
}

_navBtnOpen?.addEventListener('click', toggleNavPanel);
document.getElementById('btn-close-nav-panel')?.addEventListener('click', fermerNavPanel);
document.getElementById('btn-toggle-nav-tab')?.addEventListener('click', toggleNavPanel);
_navOverlay?.addEventListener('click', fermerNavPanel);

/* Onglets Chapitres / Pages / Titres */
document.getElementById('nav-tab-chapitres')?.addEventListener('click', () => {
  _activerOngletNav('chapitres');
});
document.getElementById('nav-tab-pages')?.addEventListener('click', () => {
  _activerOngletNav('pages');
  remplirNavPanelPages();
});
document.getElementById('nav-tab-titres')?.addEventListener('click', () => {
  _activerOngletNav('titres');
  remplirNavPanelTitres();
});

function _activerOngletNav(onglet) {
  ['chapitres', 'pages', 'titres'].forEach(o => {
    document.getElementById(`nav-tab-${o}`)?.classList.toggle('is-active', o === onglet);
    document.getElementById(`nav-tab-${o}`)?.setAttribute('aria-selected', o === onglet ? 'true' : 'false');
    document.getElementById(`nav-pane-${o}`)?.classList.toggle('is-active', o === onglet);
  });
}

/* ── Vignettes miniatures des pages — rendu Canvas (style Word) ── */

/**
 * Dessine sur canvas une représentation visuelle d'une page.
 * Reproduit la structure du texte (paragraphes, titres, dialogues, lettrine)
 * sous forme de lignes grises — identique à ce que fait Word en vue miniature.
 */
function _dessinerVignette(canvas, pageEl, isDark, isSepia) {
  const W   = canvas.width;
  const H   = canvas.height;
  const dpr = window.devicePixelRatio || 1;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // Fond selon thème
  ctx.fillStyle = isDark ? '#1e2a22' : isSepia ? '#f8f0e3' : '#ffffff';
  ctx.fillRect(0, 0, W, H);

  if (!pageEl) return;

  const MX   = W * 0.09;           // marge horizontale
  const MY   = H * 0.06;           // marge verticale haut
  const TW   = W - MX * 2;         // largeur texte
  const LH   = H * 0.022;          // hauteur d'une ligne
  const GAP  = LH * 0.6;           // espace entre lignes
  const PGAP = LH * 1.4;           // espace entre paragraphes
  const TCOL = isDark ? 'rgba(255,255,255,0.35)' : isSepia ? 'rgba(90,60,20,0.35)' : 'rgba(0,0,0,0.28)';
  const HCOL = isDark ? '#52B788'  : '#1B4332';  // couleur titres
  const DCOL = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.45)'; // dialogues

  let y = MY;

  const elements = pageEl.querySelectorAll('p, h2, h3, blockquote, hr, .reader-ornament');

  for (const el of elements) {
    if (y > H - MY) break;
    const tag = el.tagName.toLowerCase();
    const cls = el.className || '';
    const txt = el.textContent || '';

    // ── Séparateur ──────────────────────────────────
    if (tag === 'hr') {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(MX + TW * 0.15, y + LH / 2, TW * 0.7, 1);
      y += LH + PGAP; continue;
    }

    // ── Ornement ✦ ──────────────────────────────────
    if (cls.includes('reader-ornament')) {
      ctx.fillStyle = HCOL;
      const sz = LH * 0.9;
      ctx.fillRect(W / 2 - sz / 2, y, sz, sz);
      y += LH + PGAP; continue;
    }

    // ── Titre h2 / section ──────────────────────────
    if (tag === 'h2') {
      ctx.fillStyle = HCOL;
      const w = Math.min(TW * 0.65, Math.max(TW * 0.2, txt.length * LH * 0.52));
      ctx.fillRect(MX, y, w, LH * 1.25);
      y += LH * 1.25 + PGAP; continue;
    }

    // ── Titre h3 / intertitres ───────────────────────
    if (tag === 'h3') {
      ctx.fillStyle = HCOL + '99';
      const w = Math.min(TW * 0.5, Math.max(TW * 0.15, txt.length * LH * 0.48));
      ctx.fillRect(MX, y, w, LH);
      y += LH + PGAP; continue;
    }

    // ── Citation / blockquote ───────────────────────
    if (tag === 'blockquote') {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(MX, y, TW, Math.min(LH * 4, (txt.length / 50) * (LH + GAP)));
      ctx.fillStyle = HCOL;
      ctx.fillRect(MX, y, 2, Math.min(LH * 4, (txt.length / 50) * (LH + GAP)));
      y += Math.min(LH * 4, (txt.length / 50) * (LH + GAP)) + PGAP; continue;
    }

    // ── Paragraphe ──────────────────────────────────
    const isFirst    = cls.includes('is-first');
    const isDialogue = cls.includes('reader-dialogue');
    const nbLignes   = Math.max(1, Math.min(8, Math.ceil(txt.length / 55)));

    ctx.fillStyle = isDialogue ? DCOL : TCOL;

    if (isFirst && txt.length > 2) {
      // Lettrine — petit carré vert en haut à gauche
      ctx.fillStyle = HCOL;
      const ls = LH * 2.8;
      ctx.fillRect(MX, y, ls * 0.7, ls);
      // Première ligne à côté de la lettrine
      ctx.fillStyle = isDialogue ? DCOL : TCOL;
      ctx.fillRect(MX + ls * 0.85, y, TW - ls * 0.85, LH);
      y += LH + GAP;
      if (nbLignes > 1) {
        ctx.fillRect(MX + ls * 0.85, y, TW * 0.7, LH);
        y += LH + GAP;
      }
      // Lignes restantes pleine largeur
      for (let l = 2; l < nbLignes; l++) {
        if (y > H - MY) break;
        const isLast = l === nbLignes - 1;
        ctx.fillRect(MX, y, isLast ? TW * (0.25 + (txt.length % 7) / 10) : TW, LH);
        y += LH + GAP;
      }
    } else {
      for (let l = 0; l < nbLignes; l++) {
        if (y > H - MY) break;
        const isLast = l === nbLignes - 1;
        const ratio  = isLast ? 0.2 + (txt.length % 9) / 12 : 0.92 + (l % 3) * 0.026;
        ctx.fillRect(MX, y, TW * Math.min(ratio, 1), LH);
        y += LH + GAP;
      }
    }
    y += PGAP * 0.5;
  }
}

function remplirNavPanelPages() {
  const listEl = document.getElementById('nav-pages-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (!etat.pages) {
    listEl.innerHTML = '<p class="nav-panel__empty">Chargement…</p>';
    return;
  }
  if (etat.pages <= 1) {
    listEl.innerHTML = '<p class="nav-panel__empty">Chapitre en une seule page.</p>';
    return;
  }

  // 1 colonne — largeur disponible = panel (260px) - padding (24px) = 236px
  const THUMB_W = 210;
  const RATIO   = 210 / 297; // proportion A4 à l'envers = portrait
  const THUMB_H = Math.round(THUMB_W / RATIO * 1.06);
  const DPR     = Math.min(window.devicePixelRatio || 1, 2);
  const isDark  = document.body.classList.contains('theme-dark');
  const isSepia = document.body.classList.contains('theme-sepia');

  for (let i = 1; i <= etat.pages; i++) {
    const sourcePage = document.querySelector(`.reader-book-page[data-page="${i}"]`);
    const actif      = i === etat.pageCourante;

    const wrapper = document.createElement('div');
    wrapper.className = `nav-thumb${actif ? ' is-current' : ''}`;
    wrapper.dataset.page = String(i);
    wrapper.title = `Page ${i}`;

    // Canvas vignette
    const canvas = document.createElement('canvas');
    canvas.className = 'nav-thumb__canvas';
    canvas.width  = THUMB_W * DPR;
    canvas.height = THUMB_H * DPR;
    canvas.style.width  = THUMB_W + 'px';
    canvas.style.height = THUMB_H + 'px';
    canvas.getContext('2d').scale(DPR, DPR);
    _dessinerVignette(canvas, sourcePage, isDark, isSepia);

    const label = document.createElement('div');
    label.className = 'nav-thumb__label';
    label.textContent = String(i);

    wrapper.appendChild(canvas);
    wrapper.appendChild(label);
    wrapper.addEventListener('click', () => {
      _allerPage(i);
      if (window.innerWidth <= 900) fermerNavPanel();
    });
    listEl.appendChild(wrapper);
  }
}

function mettreAJourNavPanelPages() {
  document.querySelectorAll('#nav-pages-list .nav-thumb').forEach(item => {
    item.classList.toggle('is-current', parseInt(item.dataset.page) === etat.pageCourante);
  });
  const courant = document.querySelector('#nav-pages-list .nav-thumb.is-current');
  courant?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ── Liste des chapitres dans le volet ─────────────────── */
function remplirNavPanelChapitres() {
  const listEl = document.getElementById('nav-chapters-list');
  if (!listEl) return;

  let html = '';
  let afficheCorps    = false;
  let afficheTerminal = false;
  let numChapitre     = 0;

  etat.chapitres.forEach(ch => {
    const type   = ch.type_element || 'chapitre';
    const estLim = LIMMINAIRES.includes(type);
    const estTer = TERMINAUX.includes(type);
    const estCh  = !estLim && !estTer;

    if (estCh && !afficheCorps) {
      afficheCorps = true;
      if (etat.chapitres.some(c => LIMMINAIRES.includes(c.type_element || ''))) {
        html += `<div class="nav-ch-separator">Corps du livre</div>`;
      }
    }
    if (estTer && !afficheTerminal) {
      afficheTerminal = true;
      html += `<div class="nav-ch-separator">En fin de livre</div>`;
    }

    const num   = type === 'chapitre' ? ++numChapitre : null;
    const estPt = estLim || estTer;
    const label = estPt
      ? (ch.titre || LABELS_TYPE[type] || type)
      : (ch.titre || `Chapitre ${num}`);

    html += `
      <div class="nav-ch-item ${ch.numero === etat.chapitreNum ? 'is-current' : ''} ${estPt ? 'nav-ch-item--paratexte' : ''}"
        data-num="${ch.numero}" title="${label}">
        <div class="nav-ch-item__num">${num !== null ? num : '·'}</div>
        <span class="nav-ch-item__label">${label}</span>
      </div>`;
  });

  listEl.innerHTML = html;

  listEl.querySelectorAll('.nav-ch-item').forEach(item => {
    item.addEventListener('click', () => {
      const numCible = parseInt(item.dataset.num);
      if (_visiteurBloque() && numCible !== etat.chapitreNum) {
        fermerNavPanel();
        _modalMontree = true;
        document.body.style.overflow = 'hidden';
        _afficherModalAbonnement();
        return;
      }
      chargerChapitre(numCible);
      // Sur mobile, fermer après navigation
      if (window.innerWidth <= 900) fermerNavPanel();
    });
  });
}

function mettreAJourNavPanelChapitres() {
  document.querySelectorAll('#nav-chapters-list .nav-ch-item').forEach(item => {
    item.classList.toggle('is-current', parseInt(item.dataset.num) === etat.chapitreNum);
  });
  // Scroll automatique vers l'item courant
  const courant = document.querySelector('#nav-chapters-list .nav-ch-item.is-current');
  courant?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

/* ── Titres du chapitre courant ─────────────────────────── */
function remplirNavPanelTitres() {
  const listEl    = document.getElementById('nav-headings-list');
  const contentEl = document.getElementById('reader-content');
  if (!listEl || !contentEl) return;

  const headings = contentEl.querySelectorAll('h2, h3');
  if (!headings.length) {
    listEl.innerHTML = '<p class="nav-panel__empty">Aucun titre dans ce chapitre.</p>';
    return;
  }

  // Injecter des ancres uniques dans le DOM si nécessaire
  headings.forEach((el, i) => {
    if (!el.id) el.id = `nav-h-${i}`;
  });

  let html = '';
  headings.forEach(el => {
    const niveau = el.tagName.toLowerCase(); // h2 ou h3
    const texte  = el.textContent.trim();
    html += `
      <div class="nav-heading-item nav-heading-item--${niveau}" data-target="${el.id}" title="${texte}">
        <span class="nav-heading-item__bar"></span>
        <span>${texte}</span>
      </div>`;
  });

  listEl.innerHTML = html;

  listEl.querySelectorAll('.nav-heading-item').forEach(item => {
    item.addEventListener('click', () => {
      const target = document.getElementById(item.dataset.target);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ============================================================
   NAVIGATION CHAPITRES
   ============================================================ */

function _visiteurBloque() {
  return !etat.utilisateur && (_visiteurModeStrict || _pagesVisiteurLues >= LIMIT_VISITEUR_PAGES);
}

function mettreAJourNavigation() {
  const bloque       = _visiteurBloque();
  const premierePage = etat.pageCourante <= 1 && etat.chapitreNum <= 1;
  const dernierePage = etat.pageCourante >= etat.pages && etat.chapitreNum >= etat.chapitres.length;

  document.getElementById('btn-prev').disabled = premierePage;
  document.getElementById('btn-next').disabled = (dernierePage || bloque);
}

document.getElementById('btn-prev')?.addEventListener('click', _pagePrev);
document.getElementById('btn-next')?.addEventListener('click', _pageNext);

/* ============================================================
   PROGRESSION — scroll dans le chapitre (plus précis que X/Y)
   ============================================================ */

/* _mettreAJourScrollProgress est géré par _mettreAJourPositionPage() dans la section pagination */
function _mettreAJourScrollProgress() { /* no-op — remplacé par la pagination */ }

/* ============================================================
   PROGRESSION SUPABASE
   ============================================================ */

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

/* ============================================================
   PARAMÈTRES DE LECTURE
   ============================================================ */

document.getElementById('btn-settings')?.addEventListener('click', () => {
  const s = document.getElementById('reader-settings');
  s.classList.toggle('is-open');
  document.getElementById('reader-lang-panel').classList.remove('is-open');
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
  document.getElementById('reader-content').style.fontSize  = `${etat.fontSize}px`;
  document.getElementById('font-size-display').textContent  = `${etat.fontSize}px`;
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

// Largeur du texte
document.querySelectorAll('.width-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    etat.maxWidth = parseInt(btn.dataset.width);
    document.getElementById('reader-content').style.maxWidth = `${etat.maxWidth}px`;
    lsSet('reader_width', etat.maxWidth);
  });
});

/* ============================================================
   SÉLECTEUR LANGUE (bouton)
   ============================================================ */

document.getElementById('btn-lang')?.addEventListener('click', () => {
  const p = document.getElementById('reader-lang-panel');
  p.classList.toggle('is-open');
  document.getElementById('reader-settings').classList.remove('is-open');
});

/* ============================================================
   FERMER PANNEAUX AU CLIC EXTÉRIEUR
   ============================================================ */

document.addEventListener('click', (e) => {
  const settings = document.getElementById('reader-settings');
  const lang     = document.getElementById('reader-lang-panel');
  if (!e.target.closest('#reader-settings') && !e.target.closest('#btn-settings')) {
    settings?.classList.remove('is-open');
  }
  if (!e.target.closest('#reader-lang-panel') && !e.target.closest('#btn-lang')) {
    lang?.classList.remove('is-open');
  }
});

/* ============================================================
   APPLIQUER PRÉFÉRENCES SAUVEGARDÉES
   ============================================================ */

function appliquerPreferences() {
  // Thème
  if (etat.theme !== 'light') {
    document.body.classList.add(`theme-${etat.theme}`);
    document.querySelector(`[data-theme="${etat.theme}"]`)?.classList.add('is-active');
    document.querySelector(`[data-theme="light"]`)?.classList.remove('is-active');
  }

  // Largeur
  document.getElementById('reader-content').style.maxWidth = `${etat.maxWidth}px`;
  const wBtn = document.querySelector(`.width-btn[data-width="${etat.maxWidth}"]`);
  if (wBtn) {
    document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('is-active'));
    wBtn.classList.add('is-active');
  }

  // Font size
  document.getElementById('reader-content').style.fontSize  = `${etat.fontSize}px`;
  document.getElementById('font-size-display').textContent  = `${etat.fontSize}px`;

  // Interligne
  document.getElementById('reader-content').style.lineHeight = etat.lineHeight;
  document.querySelectorAll('.line-height-btn').forEach(btn => {
    btn.classList.toggle('is-active', parseFloat(btn.dataset.lh) === etat.lineHeight);
  });

  // Langue
  if (etat.langueAffichee !== 'original') {
    document.getElementById('translation-notice').style.display = 'block';
    const l = LANGUES_LECTURE.find(x => x.code === etat.langueAffichee);
    document.getElementById('lang-label').textContent = l?.drapeau || etat.langueAffichee.toUpperCase();
  }
}

/* ============================================================
   STYLE PARATEXTUEL — structure du livre
   Applique des classes CSS selon le type_element du chapitre
   ============================================================ */

const TYPE_CLASSES = {
  dedicace:     'is-dedicace',
  epigraphe:    'is-epigraphe',
  partie:       'is-partie',
  bibliographie:'is-bibliographie',
  index:        'is-index',
  glossaire:    'is-index',
};

function _appliquerStyleParatextuel(contentEl, chapitre) {
  // Retirer les anciennes classes paratextuelles
  Object.values(TYPE_CLASSES).forEach(cls => contentEl.classList.remove(cls));

  const type = chapitre?.type_element || 'chapitre';
  const cls  = TYPE_CLASSES[type];
  if (cls) contentEl.classList.add(cls);

  // Supprimer la lettrine pour les éléments non-chapitre
  const SANS_LETTRINE = ['dedicace', 'epigraphe', 'partie', 'sommaire', 'bibliographie', 'index', 'glossaire'];
  const premier = contentEl.querySelector('p.is-first');
  if (premier && SANS_LETTRINE.includes(type)) {
    premier.classList.remove('is-first');
  }
}

/* ============================================================
   BOUTONS ANNOTATIONS
   ============================================================ */

// Marque-page
document.getElementById('btn-marque-page')?.addEventListener('click', async () => {
  const chapitre = etat.chapitres.find(c => c.numero === etat.chapitreNum);
  const label    = chapitre?.titre ? `${chapitre.titre}` : `Chapitre ${etat.chapitreNum}`;
  await toggleMarquePage(label);
  _rafraichirBoutonMarquePage();
});

// Panneau annotations
document.getElementById('btn-annotations')?.addEventListener('click', () => {
  afficherPanneauAnnotations((chapitreNum) => {
    chargerChapitre(chapitreNum);
  });
});

/* ============================================================
   PARTAGE
   ============================================================ */

document.getElementById('btn-partager')?.addEventListener('click', async () => {
  const url   = `${window.location.origin}/pages/work.html?id=${etat.oeuvreId}&ref=share`;
  const titre = etat.oeuvre?.titre || 'Un livre sur Kalamundi';
  const texte = `Lis "${titre}" gratuitement sur Kalamundi — La Plume du Monde`;
  try {
    if (navigator.share) {
      await navigator.share({ title: titre, text: texte, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast('Lien copié !', 'success');
    }
  } catch { /* annulé */ }
});

/* ============================================================
   RACCOURCIS CLAVIER
   ============================================================ */

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (etat.couvertureVisible) {
    if (e.key === 'Enter' || e.key === ' ') entrerDansLecteur();
    return;
  }
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
    _pageNext();
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
    _pagePrev();
  }
  if (e.key === 'Escape') {
    fermerTOC();
    document.getElementById('reader-settings')?.classList.remove('is-open');
    document.getElementById('reader-lang-panel')?.classList.remove('is-open');
  }
  // 'c' = retour couverture
  if (e.key === 'c' || e.key === 'C') {
    document.getElementById('btn-show-cover')?.click();
  }
});

/* ============================================================
   PAGINATION — découpage en pages hauteur-écran
   ============================================================ */

let _pagesVisiteurLues  = 0;     // nb pages tournées par un visiteur cette session
let _modalMontree       = false;
let _visiteurModeStrict = false; // true après "Continuer comme visiteur"

/**
 * Découpe le contenu de `contentEl` (déjà dans le DOM) en pages
 * de hauteur égale à la zone de lecture disponible.
 * Remplace le contenu par des <div class="reader-book-page"> numérotées.
 */
function _paginerContenu(contentEl) {
  const elements = Array.from(contentEl.children);
  if (!elements.length) { etat.pages = 1; etat.pageCourante = 1; return; }

  // Hauteur disponible pour le texte
  const header   = document.querySelector('header');
  const footer   = document.querySelector('.reader-bottombar');
  const headerH  = header?.offsetHeight ?? 56;
  const footerH  = footer?.offsetHeight ?? 56;
  const PADDING  = 72; // padding vertical reader-main (top 36 + bottom 36)
  const GAP      = 28; // marge estimée entre paragraphes
  const hauteurMax = Math.max(300, window.innerHeight - headerH - footerH - PADDING);

  // Snapshot des hauteurs (éléments visibles dans le DOM)
  const pages    = [];
  let page       = [];
  let hPage      = 0;

  for (const el of elements) {
    // Saut de page forcé (marqueur ---PAGE--- du PDF original) → nouvelle page immédiate
    if (el.dataset.forced === 'true') {
      if (page.length > 0) { pages.push(page); page = []; hPage = 0; }
      continue; // ne pas inclure l'élément marqueur dans la page
    }

    const h = el.offsetHeight + GAP;
    // Saut de page automatique par hauteur (docs sans marqueurs)
    if (hPage + h > hauteurMax && page.length > 0) {
      pages.push(page);
      page = [el];
      hPage = h;
    } else {
      page.push(el);
      hPage += h;
    }
  }
  if (page.length) pages.push(page);
  // Garantir au moins 1 page
  if (!pages.length) pages.push([]);

  // Reconstruire le DOM avec des divs de pages
  contentEl.innerHTML = '';
  pages.forEach((pg, i) => {
    const div = document.createElement('div');
    div.className = 'reader-book-page';
    div.dataset.page = String(i + 1);
    if (i !== 0) div.hidden = true;
    pg.forEach(el => div.appendChild(el));
    contentEl.appendChild(div);
  });

  etat.pages       = pages.length;
  etat.pageCourante = 1;
}

/** Affiche la page `num` du chapitre courant */
function _allerPage(num) {
  if (num < 1 || num > etat.pages) return;

  // Contrôle visiteur — bloquer après LIMIT_VISITEUR_PAGES
  if (!etat.utilisateur && num > etat.pageCourante) {
    if (_visiteurModeStrict || _pagesVisiteurLues >= LIMIT_VISITEUR_PAGES) {
      _modalMontree = true;
      document.body.style.overflow = 'hidden';
      _afficherModalAbonnement();
      return;
    }
    _pagesVisiteurLues++;
  }

  // Masquer page courante, afficher nouvelle
  const pages = document.querySelectorAll('.reader-book-page');
  pages.forEach(p => { p.hidden = true; });
  const cible = document.querySelector(`.reader-book-page[data-page="${num}"]`);
  if (cible) cible.hidden = false;

  etat.pageCourante = num;
  window.scrollTo({ top: 0 });
  mettreAJourNavigation();
  _mettreAJourPositionPage();
  _mettreAJourScrollProgress();
  mettreAJourNavPanelPages(); // synchronise la page surlignée dans le volet
}

/** Page suivante, puis chapitre suivant si on est à la dernière page */
function _pageNext() {
  if (etat.pageCourante < etat.pages) {
    _allerPage(etat.pageCourante + 1);
  } else if (!_visiteurBloque() && etat.chapitreNum < etat.chapitres.length) {
    chargerChapitre(etat.chapitreNum + 1);
  } else if (_visiteurBloque()) {
    _modalMontree = true;
    document.body.style.overflow = 'hidden';
    _afficherModalAbonnement();
  }
}

/** Page précédente, puis chapitre précédent si on est à la première page */
function _pagePrev() {
  if (etat.pageCourante > 1) {
    _allerPage(etat.pageCourante - 1);
  } else if (etat.chapitreNum > 1) {
    chargerChapitre(etat.chapitreNum - 1);
  }
}

/** Met à jour le compteur "Page X / Y" dans la bottombar */
function _mettreAJourPositionPage() {
  const el = document.getElementById('reader-position');
  if (!el) return;
  if (etat.pages > 1) {
    el.innerHTML = `Page <strong>${etat.pageCourante}</strong> / ${etat.pages}
      <span style="color:var(--text-light);margin-left:6px;">· Ch. ${etat.chapitreNum}/${etat.chapitres.length}</span>`;
  } else {
    el.innerHTML = `Ch. <strong>${etat.chapitreNum}</strong> / ${etat.chapitres.length}`;
  }
  // Barre de progression = avancement dans la page courante par rapport au livre total
  const totalPages = etat.pages || 1;
  const pct = Math.round((etat.pageCourante / totalPages) * 100);
  document.getElementById('progress-fill').style.width = `${pct}%`;
}

/* Anciennes fonctions scroll visiteur — supprimées, remplacées par la pagination par pages */

function _afficherModalAbonnement() {
  const modal = document.getElementById('modal-abonnement');
  if (!modal) return;

  const retour = encodeURIComponent(`/pages/reader.html?id=${etat.oeuvreId}&ch=${etat.chapitreNum}`);
  const btnI = document.getElementById('modal-btn-inscription');
  const btnC = document.getElementById('modal-btn-connexion');
  if (btnI) btnI.href = `/pages/login.html?mode=inscription&next=${retour}`;
  if (btnC) btnC.href = `/pages/login.html?next=${retour}`;

  modal.style.display = '';
  modal.classList.add('is-open');

  const btnV = document.getElementById('modal-btn-visiteur');
  if (btnV) {
    const newBtn = btnV.cloneNode(true);
    btnV.parentNode.replaceChild(newBtn, btnV);
    newBtn.addEventListener('click', () => {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
      _modalMontree       = false;
      _visiteurModeStrict = true; // toute prochaine page tournée affichera le modal
    });
  }
}
