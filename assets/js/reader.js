/* ============================================================
   reader.js — Lecteur immersif Kalamundi
   La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
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

  // Miniature livre
  const bookEl = document.getElementById('cover-book-img');
  if (oeuvre.couverture_url) {
    bookEl.innerHTML = `<img src="${oeuvre.couverture_url}" alt="Couverture de ${oeuvre.titre}" />`;
  } else {
    bookEl.style.background = `linear-gradient(145deg, ${couleur}, color-mix(in srgb, ${couleur} 70%, #000))`;
    bookEl.innerHTML = `<span style="font-size:3rem;opacity:0.4">${emoji}</span>`;
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

  // TOC : couverture miniature
  const tocCover = document.getElementById('toc-cover');
  if (oeuvre.couverture_url) {
    tocCover.innerHTML = `
      <img src="${oeuvre.couverture_url}" alt="Couverture" />
      <div class="reader-toc__cover-overlay">
        <div class="reader-toc__cover-title">${oeuvre.titre}</div>
      </div>`;
  } else {
    tocCover.style.background = `linear-gradient(145deg, ${couleur}, color-mix(in srgb, ${couleur} 60%, #000))`;
    tocCover.innerHTML = `
      <span class="reader-toc__cover-placeholder">${emoji}</span>
      <div class="reader-toc__cover-overlay">
        <div class="reader-toc__cover-title">${oeuvre.titre}</div>
      </div>`;
  }

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

  /* ETAPE 1 : Supprimer les en-tetes de page PDF repetes
     Pattern : “Titre · Auteur · N” en debut de chaque page */
  const lignesBrutes  = texte.split('\n').filter(l => l.trim());
  const rxEnTete      = /^.{4,120}\xb7\s*\d{1,3}\s+/;
  const nbEnTetes     = lignesBrutes.filter(l => rxEnTete.test(l)).length;
  const estPDF        = nbEnTetes / Math.max(lignesBrutes.length, 1) > 0.35;
  const lignesPropres = estPDF
    ? lignesBrutes.map(l => l.replace(rxEnTete, '').trim())
    : lignesBrutes;

  /* ETAPE 2 : Decoupage intelligent des paragraphes
     REGLE CLE : on coupe sur double espace SEULEMENT apres ponctuation de fin
     On NE coupe PAS sur — au milieu d'une phrase (tiret litteraire) */
  const txt = lignesPropres.join('\n')
    .replace(/[—\-]{4,}/g, '\n§SEP§\n')   // separateurs longs
    .replace(/✦|★|✶|✴/g, '\n§ORN§\n')  // ornements typographiques ✦ ★
    .replace(/\*\s*\*\s*\*/g, '\n§ORN§\n')       // * * *
    // Saut de para SEULEMENT apres ponctuation forte + double espace + debut de phrase
    .replace(/([.!?\xbb])\s{2,}([A-Z\xc0-\xdc«””—])/g, '$1\n$2')
    // Debut de dialogue reel (apres ponctuation forte)
    .replace(/([.!?\xbb\n])\s*—\s+([A-Z\xc0-\xdc])/g, '$1\n— $2');

  /* ETAPE 3 : Decouper et consolider les micro-blocs (artefacts OCR) */
  const blocsRaw = txt.split('\n').map(l => l.trim()).filter(l => l);
  const blocs = [];
  for (const b of blocsRaw) {
    const isMarqueur = b === '§SEP§' || b === '§ORN§';
    const isSpecial  = isMarqueur
      || /^[—–]\s/.test(b)
      || /^\xa9/.test(b)
      || /^P\.?\s*S/i.test(b)
      || /^\xab|^”|^“/.test(b)
      || /^(A propos|About)/i.test(b);

    // Fusionner les micro-blocs avec le precedent (artefacts OCR)
    if (!isSpecial && b.length < 55 && blocs.length > 0) {
      const prev = blocs[blocs.length - 1];
      if (prev !== '§SEP§' && prev !== '§ORN§') {
        blocs[blocs.length - 1] = prev + ' ' + b;
        continue;
      }
    }
    blocs.push(b);
  }

  /* ETAPE 4 : Detecter le paratexte de debut (couverture, copyright, epigraphe)
     = blocs avant le premier paragraphe narratif long */
  const idxCorps = _trouverDebutCorps(blocs);
  const paratexte  = idxCorps > 3 ? blocs.slice(0, idxCorps) : [];
  const blocsCorps = idxCorps > 3 ? blocs.slice(idxCorps) : blocs;

  /* ETAPE 5 : Construire le HTML */
  let premierVrai = true;
  const html = [];

  // Paratexte compact (couverture, copyright, epigraphe)
  if (paratexte.length) {
    html.push('<div class=”reader-paratexte”>');
    for (const b of paratexte) {
      if (b === '§SEP§') { html.push('<hr class=”reader-sep reader-sep--thin” />'); continue; }
      if (b === '§ORN§') { html.push('<div class=”reader-ornament”>✦</div>'); continue; }
      if (/^\xa9|Tous droits/i.test(b)) { html.push(`<p class=”reader-legal”>${b}</p>`); continue; }
      if (/^\xab|^”|^“/.test(b) && b.length < 400) { html.push(`<blockquote class=”reader-quote”><p>${b}</p></blockquote>`); continue; }
      if (/^.{4,80}\xb7\s*\d{1,3}$/.test(b)) continue;
      html.push(`<p class=”reader-meta”>${b}</p>`);
    }
    html.push('</div><hr class=”reader-sep” />');
  }

  // Corps principal
  for (const bloc of blocsCorps) {
    if (bloc === '§SEP§') { html.push('<hr class=”reader-sep” />'); continue; }
    if (bloc === '§ORN§') { html.push('<div class=”reader-ornament” aria-hidden=”true”>✦</div>'); continue; }
    if (/^.{4,80}\xb7\s*\d{1,3}$/.test(bloc)) continue;
    if (/^\xa9|Tous droits|All rights reserved/i.test(bloc)) {
      html.push(`<p class=”reader-legal”>${bloc}</p>`); continue;
    }
    if (/^P\.?\s*S\.?\s+/i.test(bloc)) {
      html.push(`<p class=”reader-ps”>${bloc}</p>`); continue;
    }
    if (/^(À propos|About the|Note de l.auteur|Biographie)/i.test(bloc) && bloc.length < 80) {
      html.push(`<h2 class=”reader-section-title”>${bloc}</h2>`);
      premierVrai = true; continue;
    }
    if (/^[—–]\s/.test(bloc)) {
      html.push(`<p class=”reader-dialogue”>${bloc}</p>`); continue;
    }
    if ((/^\xab|^”|^“/.test(bloc)) && bloc.length < 400) {
      html.push(`<blockquote class=”reader-quote”><p>${bloc}</p></blockquote>`); continue;
    }
    if (bloc.length < 60 && /^[A-Z\xc0-\xdc\s]+$/.test(bloc) && !/[.!?,;:]/.test(bloc)) {
      html.push(`<h3 class=”reader-inner-title”>${bloc}</h3>`); continue;
    }
    const cls = premierVrai ? 'is-first' : '';
    html.push(`<p${cls ? ` class=”${cls}”` : ''}>${bloc}</p>`);
    if (premierVrai) premierVrai = false;
  }

  return html.join('');
}

/* Trouve l'index du debut du corps narratif (premier paragraphe long) */
function _trouverDebutCorps(blocs) {
  for (let i = 0; i < blocs.length; i++) {
    const b = blocs[i];
    if (b === '§SEP§' || b === '§ORN§') continue;
    if (b.length > 100
        && !/^\xa9/.test(b)
        && !/^KALAMUNDI/.test(b)
        && !/^[A-Z\xc0-\xdc\s\xb7]+$/.test(b)) {
      return i;
    }
  }
  return 0;
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
  _navOverlay?.classList.add('is-visible');
  _navBtnOpen?.setAttribute('aria-expanded', 'true');
  _navBtnOpen?.classList.add('is-active');
}

function fermerNavPanel() {
  _navPanel?.classList.remove('is-open');
  _navPage?.classList.remove('nav-panel-open');
  _navOverlay?.classList.remove('is-visible');
  _navBtnOpen?.setAttribute('aria-expanded', 'false');
  _navBtnOpen?.classList.remove('is-active');
}

function toggleNavPanel() {
  _navPanel?.classList.contains('is-open') ? fermerNavPanel() : ouvrirNavPanel();
}

_navBtnOpen?.addEventListener('click', toggleNavPanel);
document.getElementById('btn-close-nav-panel')?.addEventListener('click', fermerNavPanel);
_navOverlay?.addEventListener('click', fermerNavPanel);

/* Onglets Chapitres / Titres */
document.getElementById('nav-tab-chapitres')?.addEventListener('click', () => {
  _activerOngletNav('chapitres');
});
document.getElementById('nav-tab-titres')?.addEventListener('click', () => {
  _activerOngletNav('titres');
  remplirNavPanelTitres(); // rafraîchit à la demande
});

function _activerOngletNav(onglet) {
  ['chapitres', 'titres'].forEach(o => {
    document.getElementById(`nav-tab-${o}`)?.classList.toggle('is-active', o === onglet);
    document.getElementById(`nav-tab-${o}`)?.setAttribute('aria-selected', o === onglet ? 'true' : 'false');
    document.getElementById(`nav-pane-${o}`)?.classList.toggle('is-active', o === onglet);
  });
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
    const h = el.offsetHeight + GAP;
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
