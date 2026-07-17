/* ============================================================
   reader.js — Lecteur immersif Kalamundi
   La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser, supabase } from './auth.js';
import { injecterPub } from './pub.js';
import { getLivre } from './offline.js';
import { genererCouverture } from './cover-generator.js';
import { echapperAttr, normaliserUrlImage } from './cover-utils.js';
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

function largeurLectureInitiale() {
  const largeur = parseInt(lsGet('reader_width') || '920', 10);
  return largeur < 720 ? 920 : largeur;
}

function estModeDoublePage() {
  return window.innerWidth >= 980 && etat.maxWidth >= 900;
}

/* ============================================================
   ÉTAT DU LECTEUR
   ============================================================ */

const etat = {
  oeuvreId:       getParam('id'),
  chapitreNum:    parseInt(getParam('ch') || '1'),
  langueAffichee: lsGet('reader_langue') || 'original',
  fontSize:       parseInt(lsGet('reader_fontsize') || '18'),
  fontFamily:     lsGet('reader_font_family') || 'serif',
  lineHeight:     parseFloat(lsGet('reader_lh') || '1.9'),
  maxWidth:       largeurLectureInitiale(),
  theme:          lsGet('reader_theme') || 'light',
  chapitres:      [],
  oeuvre:         null,
  sourceLocale:   false,
  utilisateur:    null,
  accesPremium:   false,
  couvertureVisible: true,
  pages:          0,   // nombre de pages dans le chapitre courant (après pagination)
  pageCourante:   1,   // page courante (1-indexed)
  pageInitiale:   1,
  modeEpub:       false,
  epub:           null,
  epubRendition:  null,
  epubSourceUrl:  null,
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
    etat.oeuvre = await api.getOeuvre(etat.oeuvreId);
    etat.chapitres = await chargerChapitresEnLigne(etat.oeuvre);
  } catch {
    const livreLocal = await getLivre(etat.oeuvreId).catch(() => null);
    if (!livreLocal) {
      toastErreur('Impossible de charger cette œuvre.');
      return;
    }
    etat.oeuvre = normaliserOeuvreLocale(livreLocal);
    etat.chapitres = normaliserChapitresLocaux(livreLocal);
    etat.sourceLocale = true;
    toast('Mode hors-ligne — livre ouvert depuis ta bibliothèque locale.', 'info');
  }

  if (etat.utilisateur && etat.oeuvre?.statut === 'premium') {
    etat.accesPremium = await api.verifierAccesPremium(etat.utilisateur.id, etat.oeuvreId).catch(() => false);
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
  const coverUrl = normaliserUrlImage(oeuvre.couverture_url);

  // Fond dynamique : si pas de couverture → dégradé couleur genre
  const bgEl = document.getElementById('cover-bg');
  if (coverUrl) {
    const cssUrl = coverUrl.replace(/'/g, "\\'");
    bgEl.style.backgroundImage = `url('${cssUrl}')`;
    bgEl.style.background      = `url('${cssUrl}') center/cover no-repeat`;
  } else {
    bgEl.style.background = `linear-gradient(160deg, ${couleur} 0%, color-mix(in srgb, ${couleur} 50%, #000) 100%)`;
  }

  // Miniature livre — générée automatiquement si pas de couverture uploadée
  const bookEl  = document.getElementById('cover-book-img');
  const coverGenerated = genererCouverture(
    oeuvre.titre, auteur, (oeuvre.genre || '').toLowerCase(), 220, 308
  );
  if (coverUrl) {
    bookEl.innerHTML = `<img src="${echapperAttr(coverUrl)}" alt="Couverture de ${echapperAttr(oeuvre.titre)}"
      onerror="this.onerror=null;this.src='${coverGenerated}'" />`;
  } else {
    bookEl.innerHTML = `<img src="${coverGenerated}" alt="Couverture générée — ${echapperAttr(oeuvre.titre)}" />`;
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
  const tocCoverSrc = coverUrl || coverGenerated;
  tocCover.innerHTML = `
    <img src="${echapperAttr(tocCoverSrc)}" alt="Couverture"
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
  await mettreAJourStatutHorsLigne();

  if (await demarrerLecteurEpubSiDisponible()) {
    api.incrementerLectures(etat.oeuvreId).catch(() => {});
    if (window.innerWidth > 900) ouvrirNavPanel();
    return;
  }

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
  etat.pageInitiale = Math.max(1, Number(prog?.page_courante || 1));

  await chargerChapitre(chapDepart, true /* premier chargement — pas d'animation titre */);
  api.incrementerLectures(etat.oeuvreId).catch(() => {});

  if (prog?.chapitre_courant > 1) {
    toast(`Reprise au chapitre ${prog.chapitre_courant}`, 'info');
  }

  // Volet de navigation ouvert par défaut sur desktop
  if (window.innerWidth > 900) ouvrirNavPanel();

  // La progression est gérée par la pagination (pas de scroll)
}

async function demarrerLecteurEpubSiDisponible() {
  if (etat.sourceLocale || etat.modeEpub) return etat.modeEpub;
  const sourceUrl = await trouverSourceEpub();
  if (!sourceUrl) return false;

  const contentEl = document.getElementById('reader-content');
  const epubEl = document.getElementById('reader-epub');
  const viewport = document.getElementById('reader-epub-viewport');
  const loadingEl = document.getElementById('reader-loading');

  if (!epubEl || !viewport) return false;

  try {
    loadingEl.style.display = 'flex';
    loadingEl.querySelector('span').textContent = 'Préparation du livre EPUB…';
    await chargerScriptLecteur('https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js');
    if (!window.ePub) throw new Error('Lecteur EPUB indisponible.');

    etat.modeEpub = true;
    etat.epubSourceUrl = sourceUrl;
    contentEl.hidden = true;
    epubEl.hidden = false;
    viewport.innerHTML = '';

    etat.epub = window.ePub(sourceUrl);
    etat.epubRendition = etat.epub.renderTo(viewport, {
      width: '100%',
      height: '100%',
      spread: window.innerWidth >= 980 ? 'always' : 'none',
      flow: 'paginated',
      manager: 'default',
    });

    await etat.epub.ready;
    await etat.epubRendition.display();
    appliquerThemeEpub();
    brancherEvenementsEpub();
    loadingEl.style.display = 'none';
    rendreInfosTopbar();
    mettreAJourNavigation();
    _mettreAJourPositionPage();
    toast('Lecture EPUB activée.', 'success');
    return true;
  } catch (err) {
    console.warn('Fallback lecteur chapitres après échec EPUB :', err);
    etat.modeEpub = false;
    etat.epub = null;
    etat.epubRendition = null;
    etat.epubSourceUrl = null;
    epubEl.hidden = true;
    contentEl.hidden = false;
    loadingEl.style.display = 'none';
    toast('EPUB indisponible — ouverture du lecteur Kalamundi classique.', 'info');
    return false;
  }
}

async function trouverSourceEpub() {
  const fichier = etat.oeuvre?.fichier_url || '';
  if (/\.epub(\?|$)/i.test(fichier)) {
    return fichier.startsWith('http') ? fichier : api.getUrlFichierSecurise(fichier).catch(() => null);
  }

  const edition = await api.getEditionEpub(etat.oeuvreId).catch(() => null);
  const url = edition?.epub_url || edition?.fichier_url || '';
  if (!url) return null;
  return url.startsWith('http') ? url : api.getUrlFichierSecurise(url).catch(() => null);
}

function chargerScriptLecteur(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.head.appendChild(script);
  });
}

function brancherEvenementsEpub() {
  etat.epubRendition?.on('relocated', location => {
    const debut = location?.start;
    etat.pageCourante = Number(debut?.displayed?.page || 1);
    etat.pages = Number(debut?.displayed?.total || 1);
    _mettreAJourPositionPage();
    sauvegarderProgression();
  });
}

function appliquerThemeEpub() {
  if (!etat.epubRendition?.themes) return;
  etat.epubRendition.themes.register('kalamundi-light', {
    body: {
      color: '#2B241B',
      background: '#fffdf7',
      'font-family': policeEpub(),
      'line-height': String(etat.lineHeight),
    },
    p: { 'font-size': `${etat.fontSize}px`, 'line-height': String(etat.lineHeight), 'text-align': 'justify' },
  });
  etat.epubRendition.themes.register('kalamundi-dark', {
    body: {
      color: '#e6e2d6',
      background: '#111611',
      'font-family': policeEpub(),
      'line-height': String(etat.lineHeight),
    },
    p: { 'font-size': `${etat.fontSize}px`, 'line-height': String(etat.lineHeight), 'text-align': 'justify' },
  });
  etat.epubRendition.themes.register('kalamundi-sepia', {
    body: {
      color: '#4a321f',
      background: '#fbf3df',
      'font-family': policeEpub(),
      'line-height': String(etat.lineHeight),
    },
    p: { 'font-size': `${etat.fontSize}px`, 'line-height': String(etat.lineHeight), 'text-align': 'justify' },
  });
  etat.epubRendition.themes.select(`kalamundi-${etat.theme || 'light'}`);
  etat.epubRendition.themes.fontSize(`${etat.fontSize}px`);
}

function policeEpub() {
  if (etat.fontFamily === 'sans') return 'Inter, Arial, sans-serif';
  if (etat.fontFamily === 'display') return 'Fraunces, Georgia, serif';
  return 'Georgia, "Times New Roman", serif';
}

async function mettreAJourStatutHorsLigne() {
  const btn = document.getElementById('btn-offline-status');
  if (!btn) return;
  const local = await getLivre(etat.oeuvreId).catch(() => null);
  const horsConnexion = !navigator.onLine;
  btn.classList.toggle('is-active', !!local);
  btn.title = local
    ? `Disponible hors-ligne · ${local.nb_chapitres || 0} chapitre(s)`
    : 'Sauvegarder ce livre pour lecture hors-ligne';
  btn.textContent = local ? (horsConnexion ? '📵' : '✅') : '⬇️';
}

document.getElementById('btn-offline-status')?.addEventListener('click', async () => {
  const local = await getLivre(etat.oeuvreId).catch(() => null);
  if (local) {
    toast(`Disponible hors-ligne · ${local.nb_chapitres || 0} chapitre(s) sauvegardé(s).`, 'success');
    return;
  }
  window.location.href = `/pages/work.html?id=${etat.oeuvreId}#work-actions`;
});

window.addEventListener('online', mettreAJourStatutHorsLigne);
window.addEventListener('offline', mettreAJourStatutHorsLigne);

/* ============================================================
   CHARGER UN CHAPITRE
   ============================================================ */

async function chargerChapitre(numero, sansAnimation = false) {
  if (await chapitrePremiumBloque(numero)) {
    _afficherModalPaiement();
    return;
  }

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

  let chapitre = etat.chapitres.find(c => Number(c.numero) === Number(numero));
  if (!chapitre) {
    chapitre = etat.chapitres[0];
    if (!chapitre) {
      toastErreur('Aucun chapitre disponible pour cette œuvre.');
      loadingEl.style.display = 'none';
      return;
    }
    etat.chapitreNum = Number(chapitre.numero) || 1;
    toast('Chapitre demandé indisponible — ouverture du premier chapitre.', 'info');
  }

  // Charger le texte — local direct si livre hors-ligne, sinon réseau puis IndexedDB en fallback.
  let contenu = '';
  if (etat.sourceLocale || chapitre._offline) {
    contenu = chapitre.contenu || chapitre.contenu_texte || '';
  } else {
    try {
      const ch = await api.getChapitre(chapitre.id);
      contenu = ch.contenu_texte || ch.contenu || '';
    } catch {
      contenu = await chargerChapitreLocal(numero);
      if (!contenu) {
        loadingEl.style.display = 'none';
        return;
      }
    }
  }

  if (!contenu && !etat.sourceLocale) {
    contenu = await chargerChapitreLocal(numero);
    if (!contenu) {
      loadingEl.style.display = 'none';
      return;
    }
  }

  if (etat.sourceLocale) {
    toast('📵 Lecture depuis la mémoire locale.', 'info');
  }

  if (!contenu?.trim()) {
    toastErreur('Ce chapitre ne contient pas encore de texte.');
    loadingEl.style.display = 'none';
    return;
  }

  // Traduire si nécessaire
  if (etat.langueAffichee !== 'original') {
    loadingEl.querySelector('span').textContent = 'Traduction en cours…';
    try {
      contenu = await obtenirTraduction(chapitre, contenu, etat.langueAffichee);
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

  // Appliquer la largeur de lecture. Le cadre papier reste fluide, le texte se règle via --reader-width.
  contentEl.style.maxWidth  = 'none';
  contentEl.style.setProperty('--reader-width', `${etat.maxWidth}px`);
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

  // UI — la position/progression est mise à jour après pagination
  mettreAJourNavigation();
  mettreAJourTOC();
  mettreAJourNavPanelChapitres();
  remplirNavPanelTitres();
  rendreInfosTopbar();

  // Scroll haut
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Pagination : découper le texte en pages de hauteur écran
  _paginerContenu(contentEl);
  if (sansAnimation && etat.pageInitiale > 1 && etat.pageInitiale <= etat.pages) {
    _allerPage(etat.pageInitiale, { sauvegarder: false });
    etat.pageInitiale = 1;
  } else {
    sauvegarderProgression();
  }
  mettreAJourNavigation();
  _mettreAJourPositionPage();
  remplirNavPanelPages();
}

async function chargerChapitresEnLigne(oeuvre) {
  let chapitres = [];
  try {
    chapitres = await api.getChapitres(etat.oeuvreId);
  } catch {
    chapitres = [];
  }

  if (!chapitres?.length) {
    chapitres = normaliserChapitresOeuvre(oeuvre);
  }

  if (!chapitres.length) {
    throw new Error('Aucun chapitre disponible pour cette œuvre.');
  }

  return chapitres;
}

async function chargerChapitreLocal(numero) {
  try {
    const livreLocal = await getLivre(etat.oeuvreId);
    const chapLocal = livreLocal?.chapitres?.find(c => Number(c.numero) === Number(numero));
    if (chapLocal?.contenu || chapLocal?.contenu_texte) {
      toast('📵 Mode hors-ligne — lecture depuis la mémoire locale.', 'info');
      return chapLocal.contenu || chapLocal.contenu_texte || '';
    }
    toastErreur('Chapitre indisponible hors-ligne. Connectez-vous pour lire.');
    return '';
  } catch {
    toastErreur('Erreur de chargement du chapitre.');
    return '';
  }
}

function normaliserOeuvreLocale(livre) {
  return {
    id: livre.id,
    titre: livre.titre || 'Livre hors-ligne',
    genre: livre.genre || '',
    resume: livre.resume || '',
    langue_originale: livre.langue || 'fr',
    statut: livre.statut || 'gratuit',
    couverture_url: livre.couverture_url || null,
    profiles: { nom: livre.auteur || 'Auteur inconnu', pays: '' },
  };
}

function normaliserChapitresLocaux(livre) {
  return (livre.chapitres || []).map((ch, index) => ({
    id: ch.id || `offline-${livre.id}-${ch.numero || index + 1}`,
    chapitre_id: ch.chapitre_id || ch.chapitre_ref || ch.id || `offline-${livre.id}-${ch.numero || index + 1}`,
    source_hash: ch.source_hash || null,
    numero: Number(ch.numero || index + 1),
    titre: ch.titre || null,
    contenu: ch.contenu || ch.contenu_texte || '',
    type_element: ch.type_element || 'chapitre',
    _offline: true,
  }));
}

function normaliserChapitresOeuvre(oeuvre) {
  return (oeuvre?.chapitres || [])
    .slice()
    .sort((a, b) => Number(a.numero || 0) - Number(b.numero || 0))
    .map((ch, index) => ({
      id: ch.id,
      chapitre_id: ch.chapitre_id || ch.chapitre_ref || ch.id,
      source_hash: ch.source_hash || null,
      numero: Number(ch.numero || index + 1),
      titre: ch.titre || null,
      type_element: ch.type_element || 'chapitre',
      visible: ch.visible !== false,
      date_publication: ch.date_publication || null,
      created_at: ch.created_at || null,
    }))
    .filter(ch => ch.id && ch.numero >= 1);
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

async function obtenirTraduction(chapitre, contenu, langue) {
  const langueSource = etat.oeuvre?.langue_originale || 'fr';
  return traduire(chapitre, contenu, langue, langueSource);
}

/* ============================================================
   SÉLECTEUR DE LANGUES
   ============================================================ */

function _rendreOptionLangues() {
  const conteneur = document.getElementById('lang-options');
  rendreOptionLangues(conteneur, etat.langueAffichee, async (code) => {
    if (etat.modeEpub && code !== 'original') {
      toast('La traduction EPUB sera branchée sur les chapitres normalisés à l’étape P1.8.', 'info');
      document.getElementById('reader-lang-panel').classList.remove('is-open');
      return;
    }
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
  if (etat.modeEpub) {
    document.getElementById('topbar-chapitre').textContent = 'EPUB · Livre complet';
    document.getElementById('back-btn')?.setAttribute('href', `/pages/work.html?id=${etat.oeuvreId}`);
    return;
  }
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
      if (etat.modeEpub) {
        toast('Le sommaire EPUB se parcourt directement dans le livre.', 'info');
        fermerTOC();
        return;
      }
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

  if (etat.modeEpub) {
    listEl.innerHTML = '<p class="nav-panel__empty">La pagination EPUB est gérée par le livre.</p>';
    return;
  }

  if (!etat.pages) {
    listEl.innerHTML = '<p class="nav-panel__empty">Chargement…</p>';
    return;
  }
  if (etat.pages <= 1) {
    listEl.innerHTML = '<p class="nav-panel__empty">Chapitre en une seule page.</p>';
    return;
  }

  const frag = document.createDocumentFragment();
  for (let i = 1; i <= etat.pages; i++) {
    const wrapper = document.createElement('button');
    wrapper.type = 'button';
    wrapper.className = `nav-page-chip${i === etat.pageCourante ? ' is-current' : ''}`;
    wrapper.dataset.page = String(i);
    wrapper.textContent = i === etat.pages && etat.chapitreNum >= etat.chapitres.length ? `Fin · ${i}` : `Page ${i}`;
    wrapper.addEventListener('click', () => {
      _allerPage(i);
      if (window.innerWidth <= 900) fermerNavPanel();
    });
    frag.appendChild(wrapper);
  }
  listEl.appendChild(frag);
}

function mettreAJourNavPanelPages() {
  document.querySelectorAll('#nav-pages-list .nav-page-chip').forEach(item => {
    item.classList.toggle('is-current', parseInt(item.dataset.page) === etat.pageCourante);
  });
  const courant = document.querySelector('#nav-pages-list .nav-page-chip.is-current');
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
      if (etat.modeEpub) {
        toast('Le sommaire EPUB se parcourt directement dans le livre.', 'info');
        if (window.innerWidth <= 900) fermerNavPanel();
        return;
      }
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

  if (etat.modeEpub) {
    listEl.innerHTML = '<p class="nav-panel__empty">Sommaire EPUB disponible dans le livre.</p>';
    return;
  }

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
  if (etat.modeEpub) {
    document.getElementById('btn-prev').disabled = false;
    document.getElementById('btn-next').disabled = _visiteurBloque();
    return;
  }
  const bloque       = _visiteurBloque();
  const dernierePageVisible = estModeDoublePage() ? Math.min(etat.pageCourante + 1, etat.pages) : etat.pageCourante;
  const premiumBloque = chapitrePremiumBloqueSync(etat.chapitreNum + (dernierePageVisible >= etat.pages ? 1 : 0));
  const premierePage = etat.pageCourante <= 1 && etat.chapitreNum <= 1;
  const dernierePage = dernierePageVisible >= etat.pages && etat.chapitreNum >= etat.chapitres.length;

  document.getElementById('btn-prev').disabled = premierePage;
  document.getElementById('btn-next').disabled = (dernierePage || bloque || premiumBloque);
}

document.getElementById('btn-prev')?.addEventListener('click', _pagePrev);
document.getElementById('btn-next')?.addEventListener('click', _pageNext);
document.getElementById('reader-page-prev-zone')?.addEventListener('click', _pagePrev);
document.getElementById('reader-page-next-zone')?.addEventListener('click', _pageNext);

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
      etat.chapitreNum, etat.pageCourante || 1, sessionId
    );
  } catch {}

  // Synchroniser progression_eleves pour chaque classe où ce livre est assigné
  try {
    const { data: membres } = await supabase
      .from('membres_classe')
      .select('classe_id')
      .eq('eleve_id', etat.utilisateur.id);

    if (membres?.length) {
      const classeIds = membres.map(m => m.classe_id);
      const { data: listes } = await supabase
        .from('listes_lecture')
        .select('classe_id')
        .eq('oeuvre_id', etat.oeuvreId)
        .in('classe_id', classeIds);

      const nbChapitres = etat.chapitres.length;
      for (const l of listes || []) {
        await api.sauvegarderProgressionEleve(
          etat.utilisateur.id, etat.oeuvreId, l.classe_id,
          etat.chapitreNum, nbChapitres
        );
      }
    }
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
    appliquerThemeLecteur(btn.dataset.theme || 'light');
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
  if (etat.modeEpub) {
    appliquerThemeEpub();
    return;
  }
  repaginerSiLectureOuverte();
}

// Police de lecture
document.querySelectorAll('.font-family-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    etat.fontFamily = btn.dataset.font || 'serif';
    appliquerPoliceLecture();
    lsSet('reader_font_family', etat.fontFamily);
    if (etat.modeEpub) {
      appliquerThemeEpub();
      return;
    }
    repaginerSiLectureOuverte();
  });
});

// Interligne
document.querySelectorAll('.line-height-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.line-height-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    etat.lineHeight = parseFloat(btn.dataset.lh);
    document.getElementById('reader-content').style.lineHeight = etat.lineHeight;
    lsSet('reader_lh', etat.lineHeight);
    if (etat.modeEpub) {
      appliquerThemeEpub();
      return;
    }
    repaginerSiLectureOuverte();
  });
});

// Largeur du texte
document.querySelectorAll('.width-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    etat.maxWidth = parseInt(btn.dataset.width);
    document.getElementById('reader-content').style.maxWidth = 'none';
    document.getElementById('reader-content').style.setProperty('--reader-width', `${etat.maxWidth}px`);
    document.getElementById('reader-epub')?.style.setProperty('--reader-width', `${etat.maxWidth}px`);
    lsSet('reader_width', etat.maxWidth);
    if (etat.modeEpub) {
      etat.epubRendition?.resize('100%', '100%');
      return;
    }
    if (!etat.couvertureVisible) chargerChapitre(etat.chapitreNum, true);
  });
});

function appliquerThemeLecteur(theme) {
  etat.theme = ['light', 'dark', 'sepia'].includes(theme) ? theme : 'light';
  document.body.classList.remove('theme-dark', 'theme-sepia');
  if (etat.theme !== 'light') document.body.classList.add(`theme-${etat.theme}`);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    const actif = btn.dataset.theme === etat.theme;
    btn.classList.toggle('is-active', actif);
    btn.setAttribute('aria-pressed', actif);
  });
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    metaTheme.setAttribute('content', etat.theme === 'dark' ? '#101410' : etat.theme === 'sepia' ? '#8B6914' : '#1B4332');
  }
  lsSet('reader_theme', etat.theme);
  if (etat.modeEpub) appliquerThemeEpub();
}

function appliquerPoliceLecture() {
  const contentEl = document.getElementById('reader-content');
  if (!contentEl) return;
  contentEl.dataset.font = etat.fontFamily;
  document.querySelectorAll('.font-family-btn').forEach(btn => {
    const actif = btn.dataset.font === etat.fontFamily;
    btn.classList.toggle('is-active', actif);
    btn.setAttribute('aria-pressed', actif);
  });
}

function repaginerSiLectureOuverte() {
  if (etat.couvertureVisible) return;
  if (etat.modeEpub) {
    etat.epubRendition?.resize('100%', '100%');
    appliquerThemeEpub();
    return;
  }
  chargerChapitre(etat.chapitreNum, true);
}

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
  appliquerThemeLecteur(etat.theme);

  // Largeur
  document.getElementById('reader-content').style.maxWidth = 'none';
  document.getElementById('reader-content').style.setProperty('--reader-width', `${etat.maxWidth}px`);
  document.getElementById('reader-epub')?.style.setProperty('--reader-width', `${etat.maxWidth}px`);
  const wBtn = document.querySelector(`.width-btn[data-width="${etat.maxWidth}"]`);
  if (wBtn) {
    document.querySelectorAll('.width-btn').forEach(b => b.classList.remove('is-active'));
    wBtn.classList.add('is-active');
  }

  // Font size
  document.getElementById('reader-content').style.fontSize  = `${etat.fontSize}px`;
  document.getElementById('font-size-display').textContent  = `${etat.fontSize}px`;

  // Police
  appliquerPoliceLecture();

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
  if (etat.modeEpub) {
    toast('Marque-pages EPUB avancés : prévu après l’ancrage complet Readium/foliate.', 'info');
    return;
  }
  const chapitre = etat.chapitres.find(c => c.numero === etat.chapitreNum);
  const label    = chapitre?.titre ? `${chapitre.titre}` : `Chapitre ${etat.chapitreNum}`;
  await toggleMarquePage(label);
  _rafraichirBoutonMarquePage();
});

// Panneau annotations
document.getElementById('btn-annotations')?.addEventListener('click', () => {
  if (etat.modeEpub) {
    toast('Annotations EPUB : prévues sur les chapitres normalisés.', 'info');
    return;
  }
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
  const style = getComputedStyle(contentEl);
  const paddingY = parseFloat(style.paddingTop || '0') + parseFloat(style.paddingBottom || '0');
  const hauteurCadre = contentEl.clientHeight || Math.max(420, window.innerHeight - headerH - footerH - 56);
  const GAP = 18; // marge estimée entre paragraphes
  const hauteurMax = Math.max(280, hauteurCadre - paddingY - 38);

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
    if (i !== 0 && !(estModeDoublePage() && i === 1)) div.hidden = true;
    pg.forEach(el => div.appendChild(el));
    contentEl.appendChild(div);
  });

  if (etat.chapitreNum >= etat.chapitres.length) {
    const backCover = _creerQuatriemeCouverturePage(pages.length + 1);
    backCover.hidden = pages.length > 0;
    contentEl.appendChild(backCover);
    pages.push([backCover]);
  }

  etat.pages       = pages.length;
  etat.pageCourante = 1;
  contentEl.dataset.currentPage = '1';
  contentEl.classList.toggle('is-left-page', false);
  contentEl.classList.toggle('has-spread', estModeDoublePage());
}

function _creerQuatriemeCouverturePage(numeroPage) {
  const page = document.createElement('div');
  page.className = 'reader-book-page reader-book-page--back-cover';
  page.dataset.page = String(numeroPage);

  const auteur = etat.oeuvre?.profiles?.nom || 'Auteur inconnu';
  const titre = etat.oeuvre?.titre || 'Kalamundi';
  const resume = etat.oeuvre?.resume || 'Merci d’avoir lu cette œuvre sur Kalamundi.';

  const inner = document.createElement('div');
  inner.className = 'reader-back-cover';

  const label = document.createElement('div');
  label.className = 'reader-back-cover__label';
  label.textContent = 'Quatrième de couverture';

  const h = document.createElement('h2');
  h.textContent = titre;

  const p = document.createElement('p');
  p.textContent = resume;

  const meta = document.createElement('div');
  meta.className = 'reader-back-cover__meta';
  meta.textContent = `Kalamundi · ${auteur}`;

  inner.append(label, h, p, meta);
  page.appendChild(inner);
  return page;
}

/** Affiche la page `num` du chapitre courant */
function _allerPage(num, options = {}) {
  if (num < 1 || num > etat.pages) return;
  const direction = num > etat.pageCourante ? 'next' : 'prev';
  const pageActuelle = document.querySelector(`.reader-book-page[data-page="${etat.pageCourante}"]`);
  const feuilleActuelle = estModeDoublePage() && direction === 'next'
    ? (document.querySelector(`.reader-book-page[data-page="${etat.pageCourante + 1}"]`) || pageActuelle)
    : pageActuelle;

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
  const doublePage = estModeDoublePage();
  const cible = document.querySelector(`.reader-book-page[data-page="${num}"]`);
  if (cible) {
    cible.hidden = false;
    cible.classList.remove('is-turning-next', 'is-turning-prev');
    void cible.offsetWidth;
    cible.classList.add(direction === 'next' ? 'is-turning-next' : 'is-turning-prev');
  }
  if (doublePage) {
    const droite = document.querySelector(`.reader-book-page[data-page="${num + 1}"]`);
    if (droite) {
      droite.hidden = false;
      droite.classList.remove('is-turning-next', 'is-turning-prev');
    }
  }

  etat.pageCourante = num;
  const contentEl = document.getElementById('reader-content');
  if (contentEl) {
    contentEl.dataset.currentPage = String(num);
    contentEl.classList.toggle('is-left-page', num % 2 === 0);
    contentEl.classList.toggle('has-spread', doublePage);
    _jouerFeuilletage(contentEl, feuilleActuelle, direction);
  }
  window.scrollTo({ top: 0 });
  mettreAJourNavigation();
  _mettreAJourPositionPage();
  _mettreAJourScrollProgress();
  mettreAJourNavPanelPages(); // synchronise la page surlignée dans le volet
  if (options.sauvegarder !== false) sauvegarderProgression();
}

function _jouerFeuilletage(contentEl, pageActuelle, direction) {
  if (!pageActuelle || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  contentEl.querySelectorAll('.reader-page-flip').forEach(el => el.remove());
  const feuille = document.createElement('div');
  feuille.className = `reader-page-flip reader-page-flip--${direction}`;
  feuille.innerHTML = pageActuelle.innerHTML;
  contentEl.appendChild(feuille);

  window.setTimeout(() => feuille.remove(), 620);
}

/** Page suivante, puis chapitre suivant si on est à la dernière page */
function _pageNext() {
  if (etat.modeEpub) {
    if (_visiteurBloque()) {
      _modalMontree = true;
      document.body.style.overflow = 'hidden';
      _afficherModalAbonnement();
      return;
    }
    if (!etat.utilisateur) _pagesVisiteurLues++;
    etat.epubRendition?.next();
    return;
  }
  const pas = estModeDoublePage() ? 2 : 1;
  const derniereVisible = estModeDoublePage() ? Math.min(etat.pageCourante + 1, etat.pages) : etat.pageCourante;
  if (derniereVisible < etat.pages) {
    _allerPage(etat.pageCourante + pas);
  } else if (chapitrePremiumBloqueSync(etat.chapitreNum + 1)) {
    _afficherModalPaiement();
  } else if (!_visiteurBloque() && etat.chapitreNum < etat.chapitres.length) {
    // Déclencher pub interstitielle dans l'APK Android au changement de chapitre
    if (window.KalamundiAds) window.KalamundiAds.onChapterChange();
    chargerChapitre(etat.chapitreNum + 1);
  } else if (_visiteurBloque()) {
    _modalMontree = true;
    document.body.style.overflow = 'hidden';
    _afficherModalAbonnement();
  }
}

/** Page précédente, puis chapitre précédent si on est à la première page */
function _pagePrev() {
  if (etat.modeEpub) {
    etat.epubRendition?.prev();
    return;
  }
  if (etat.pageCourante > 1) {
    _allerPage(Math.max(1, etat.pageCourante - (estModeDoublePage() ? 2 : 1)));
  } else if (etat.chapitreNum > 1) {
    chargerChapitre(etat.chapitreNum - 1);
  }
}

/** Met à jour le compteur "Page X / Y" dans la bottombar */
function _mettreAJourPositionPage() {
  const el = document.getElementById('reader-position');
  if (!el) return;
  if (etat.modeEpub) {
    const label = etat.pages > 1
      ? `Page <strong>${etat.pageCourante}</strong> / ${etat.pages}`
      : 'Lecture EPUB';
    el.innerHTML = `${label}<span style="color:var(--text-light);margin-left:6px;">· Livre complet</span>`;
    document.getElementById('progress-fill').style.width = etat.pages > 1
      ? `${Math.round((etat.pageCourante / etat.pages) * 100)}%`
      : '0%';
    return;
  }
  if (etat.pages > 1) {
    const fin = estModeDoublePage() ? Math.min(etat.pageCourante + 1, etat.pages) : etat.pageCourante;
    const label = fin > etat.pageCourante ? `${etat.pageCourante}-${fin}` : String(etat.pageCourante);
    el.innerHTML = `Page <strong>${label}</strong> / ${etat.pages}
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
  const btnV = document.getElementById('modal-btn-visiteur');
  document.getElementById('modal-titre').textContent = 'Inscrivez-vous pour continuer';
  modal.querySelector('p').innerHTML = `
    Vous avez atteint la limite de lecture gratuite.<br>
    Créez un compte <strong>gratuit</strong> pour lire l'œuvre en entier, accéder à tout le catalogue et sauvegarder votre progression.`;
  if (btnI) btnI.href = `/pages/login.html?mode=inscription&redirect=${retour}`;
  if (btnC) btnC.href = `/pages/login.html?redirect=${retour}`;
  if (btnI) btnI.textContent = '✨ Créer un compte gratuit';
  if (btnC) btnC.textContent = 'Se connecter';
  if (btnV) {
    btnV.textContent = 'Rester visiteur (chapitre 1 seulement)';
    btnV.style.display = '';
  }

  modal.style.display = '';
  modal.classList.add('is-open');

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

async function chapitrePremiumBloque(numero) {
  if (!etat.oeuvre || etat.oeuvre.statut !== 'premium') return false;
  if (etat.accesPremium) return false;
  if (etat.utilisateur) {
    etat.accesPremium = await api.verifierAccesPremium(etat.utilisateur.id, etat.oeuvreId).catch(() => false);
    if (etat.accesPremium) return false;
  }
  return chapitrePremiumBloqueSync(numero);
}

function chapitrePremiumBloqueSync(numero) {
  if (!etat.oeuvre || etat.oeuvre.statut !== 'premium' || etat.accesPremium) return false;
  const gratuits = Number(etat.oeuvre.chapitres_gratuits ?? 0);
  return Number(numero || 1) > gratuits;
}

function _afficherModalPaiement() {
  const modal = document.getElementById('modal-abonnement');
  if (!modal || !etat.oeuvre) return;
  const prix = Number(etat.oeuvre.prix || 300).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
  const retour = encodeURIComponent(`/pages/reader.html?id=${etat.oeuvreId}&ch=${etat.chapitreNum}`);
  const paiement = `/pages/payment.html?oeuvre=${etat.oeuvreId}&montant=${encodeURIComponent(etat.oeuvre.prix || 300)}&titre=${encodeURIComponent(etat.oeuvre.titre || 'Kalamundi')}`;

  document.getElementById('modal-titre').textContent = 'La suite est premium';
  modal.querySelector('p').innerHTML = `
    Vous avez lu l'extrait gratuit. La suite de <strong>${etat.oeuvre.titre}</strong> est disponible après paiement.<br>
    Prix : <strong>${prix} FCFA</strong>.`;

  const btnI = document.getElementById('modal-btn-inscription');
  const btnC = document.getElementById('modal-btn-connexion');
  const btnV = document.getElementById('modal-btn-visiteur');
  if (btnI) {
    btnI.textContent = etat.utilisateur ? `Payer ${prix} FCFA` : 'Se connecter et payer';
    btnI.href = etat.utilisateur ? paiement : `/pages/login.html?redirect=${encodeURIComponent(paiement)}`;
  }
  if (btnC) {
    btnC.textContent = 'Retour à la fiche';
    btnC.href = `/pages/work.html?id=${etat.oeuvreId}`;
  }
  if (btnV) btnV.style.display = 'none';

  modal.style.display = '';
  modal.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

injecterPub('reader');
