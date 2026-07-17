/* ============================================================
   publish.js — Logique page publication + horodatage SHA-256
   Kalamundi — La Plume du Monde
   ============================================================ */

import { protegerRoute, getUser } from './auth.js';
import { api } from './api.js';
import { lireFichier, calculerSHA256, calculerSHA256Fichier, decouperEnChapitres, watermark } from './upload.js';
import { construireEpubCanonique, validerStructureEpub } from './epub-builder.js';
import { toast, toastErreur, formatTailleFichier, qs, cacher, afficher, copier, validerFichier } from './utils.js';

/* ============================================================
   Protection — page réservée aux auteurs connectés
   ============================================================ */

let utilisateur = null;
(async () => {
  utilisateur = await protegerRoute();
})();

/* ============================================================
   Brouillon — sauvegarde automatique localStorage
   ============================================================ */

const CLE_BROUILLON = 'kalamundi_brouillon_v1';
let _brouillonTimer = null;

function sauvegarderBrouillon() {
  clearTimeout(_brouillonTimer);
  _brouillonTimer = setTimeout(() => {
    const data = {
      titre:       qs('#titre')?.value || '',
      sousTitre:   qs('#sous-titre')?.value || '',
      serie:       qs('#serie')?.value || '',
      numeroSerie: qs('#numero-serie')?.value || '',
      genre:       qs('#genre')?.value || '',
      categoriePrincipale: qs('#categorie-principale')?.value || '',
      categorieSecondaire: qs('#categorie-secondaire')?.value || '',
      langue:      qs('#langue')?.value || '',
      resume:      qs('#resume')?.value || '',
      motsCles:    qs('#mots-cles')?.value || '',
      isbn:        qs('#isbn')?.value || '',
      editeur:     qs('#editeur')?.value || '',
      public_cible: qs('#public_cible')?.value || '',
      territoires: qs('#territoires')?.value || 'monde',
      drmProtection: qs('#drm-protection')?.value || 'standard',
      mode:        etat.mode,
      editorHTML:  qs('#editor-content')?.innerHTML || '',
      statut:      qs('#statut-oeuvre')?.value || 'gratuit',
      prix:        qs('#prix')?.value || '',
      savedAt:     new Date().toISOString(),
    };
    try {
      localStorage.setItem(CLE_BROUILLON, JSON.stringify(data));
      const ind = qs('#brouillon-indicator');
      if (ind) { ind.textContent = 'Brouillon enregistré'; ind.classList.add('saved'); setTimeout(() => ind.classList.remove('saved'), 2000); }
    } catch { /* quota dépassé — silencieux */ }
  }, 2000);
}

function effacerBrouillon() {
  localStorage.removeItem(CLE_BROUILLON);
}

function restaurerBrouillon(data) {
  if (data.titre)       { const el = qs('#titre');        if (el) el.value = data.titre; }
  if (data.sousTitre)   { const el = qs('#sous-titre');   if (el) el.value = data.sousTitre; }
  if (data.serie)       { const el = qs('#serie');        if (el) el.value = data.serie; }
  if (data.numeroSerie) { const el = qs('#numero-serie'); if (el) el.value = data.numeroSerie; }
  if (data.genre)       { const el = qs('#genre');        if (el) el.value = data.genre; }
  if (data.categoriePrincipale) { const el = qs('#categorie-principale'); if (el) el.value = data.categoriePrincipale; }
  if (data.categorieSecondaire) { const el = qs('#categorie-secondaire'); if (el) el.value = data.categorieSecondaire; }
  if (data.langue)      { const el = qs('#langue');       if (el) el.value = data.langue; }
  if (data.resume)      { const el = qs('#resume');       if (el) { el.value = data.resume; qs('#resume-counter').textContent = `${data.resume.length} / 1000 caractères`; } }
  if (data.motsCles)    { const el = qs('#mots-cles');    if (el) el.value = data.motsCles; }
  if (data.isbn)        { const el = qs('#isbn');         if (el) el.value = data.isbn; }
  if (data.editeur)     { const el = qs('#editeur');      if (el) el.value = data.editeur; }
  if (data.public_cible){ const el = qs('#public_cible'); if (el) el.value = data.public_cible; }
  if (data.territoires) { const el = qs('#territoires');  if (el) el.value = data.territoires; }
  if (data.drmProtection) { const el = qs('#drm-protection'); if (el) el.value = data.drmProtection; }
  if (data.editorHTML)  { const el = qs('#editor-content'); if (el) el.innerHTML = data.editorHTML; }
  if (data.prix)        { const el = qs('#prix');          if (el) el.value = data.prix; }
  if (data.statut === 'premium') {
    document.querySelectorAll('[data-statut]').forEach(c => c.classList.remove('is-active'));
    document.querySelector('[data-statut="premium"]')?.classList.add('is-active');
    qs('#statut-oeuvre').value = 'premium';
    qs('#groupe-prix')?.classList.remove('hidden');
  }
  if (data.mode === 'editor') {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('is-active'));
    document.querySelector('[data-mode="editor"]')?.classList.add('is-active');
    etat.mode = 'editor';
    qs('#zone-upload')?.classList.add('hidden');
    qs('#zone-editor')?.classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const raw = localStorage.getItem(CLE_BROUILLON);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (!data.titre && !data.editorHTML) return;
    const date = data.savedAt ? new Date(data.savedAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' }) : '';
    const banner = document.createElement('div');
    banner.id = 'brouillon-banner';
    banner.style.cssText = 'background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;';
    banner.innerHTML = `
      <span style="font-size:18px">📝</span>
      <span style="flex:1;font-size:14px;color:#713f12;">Brouillon disponible${date ? ` — sauvegardé le ${date}` : ''}. Veux-tu le restaurer ?</span>
      <button type="button" id="btn-restaurer" style="background:#1B4332;color:#fff;border:none;border-radius:6px;padding:6px 14px;cursor:pointer;font-size:13px;font-weight:600;">Restaurer</button>
      <button type="button" id="btn-ignorer-brouillon" style="background:transparent;border:1px solid #999;border-radius:6px;padding:6px 12px;cursor:pointer;font-size:13px;color:#555;">Ignorer</button>
    `;
    qs('.publish-page')?.insertBefore(banner, qs('.stepper'));

    qs('#btn-restaurer')?.addEventListener('click', () => {
      restaurerBrouillon(data);
      banner.remove();
      toast('Brouillon restauré !', 'success');
    });
    qs('#btn-ignorer-brouillon')?.addEventListener('click', () => {
      effacerBrouillon();
      banner.remove();
    });
  } catch { localStorage.removeItem(CLE_BROUILLON); }
});

/* Auto-sauvegarde sur chaque modification */
['#titre','#sous-titre','#serie','#numero-serie','#genre','#categorie-principale','#categorie-secondaire','#langue','#resume','#mots-cles','#isbn','#editeur','#public_cible','#territoires','#drm-protection','#prix','#statut-oeuvre','#editor-content'].forEach(sel => {
  document.addEventListener('DOMContentLoaded', () => {
    qs(sel)?.addEventListener('input', sauvegarderBrouillon);
    qs(sel)?.addEventListener('change', sauvegarderBrouillon);
  });
});

/* ============================================================
   État global du formulaire
   ============================================================ */

const etat = {
  etape:        1,
  mode:         'upload',  // 'upload' | 'editor'
  fichier:      null,
  couverture:   null,
  couvertureOk: false,
  contenuTexte: '',
  hash:         '',
  oeuvreId:     null,
};

let qualitePublication = 0;

/* ============================================================
   Éléments DOM
   ============================================================ */

const steps    = document.querySelectorAll('.step[data-step]');
const sections = document.querySelectorAll('.publish-section[data-section]');
const alertEl  = qs('#publish-alert');

/* ============================================================
   Qualité du dépôt — checklist auteur
   ============================================================ */

function texteEditeur() {
  return qs('#editor-content')?.innerText?.trim() || '';
}

function lireMotsCles() {
  return (qs('#mots-cles')?.value || '')
    .split(',')
    .map(mot => mot.trim())
    .filter(Boolean)
    .slice(0, 7);
}

function collecterMetadonneesPublication() {
  const categories = [
    qs('#categorie-principale')?.value || '',
    qs('#categorie-secondaire')?.value || '',
  ].filter(Boolean);

  return {
    sous_titre: qs('#sous-titre')?.value.trim() || null,
    serie: qs('#serie')?.value.trim() || null,
    numero_serie: qs('#numero-serie')?.value ? Number(qs('#numero-serie').value) : null,
    categories,
    mots_cles: lireMotsCles(),
    isbn: qs('#isbn')?.value.trim() || null,
    editeur: qs('#editeur')?.value.trim() || 'Auto-édition',
    territoires: qs('#territoires')?.value || 'monde',
    drm_protection: qs('#drm-protection')?.value || 'standard',
    licence: qs('#licence-oeuvre')?.value || 'tous_droits',
  };
}

function verifierRatioCouverture(fichier) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(fichier);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const ratio = img.height / Math.max(img.width, 1);
      resolve({ ok: ratio >= 1.45 && ratio <= 1.75, ratio });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ ok: false, ratio: 0 });
    };
    img.src = url;
  });
}

function calculerQualitePublication() {
  const titre = qs('#titre')?.value.trim() || '';
  const genre = qs('#genre')?.value || '';
  const categorie = qs('#categorie-principale')?.value || '';
  const langue = qs('#langue')?.value || '';
  const resume = qs('#resume')?.value.trim() || '';
  const motsCles = lireMotsCles();
  const statut = qs('#statut-oeuvre')?.value || 'gratuit';
  const prix = parseFloat(qs('#prix')?.value || '0');
  const declaration = Boolean(qs('#declaration-proprio')?.checked);
  const contenuPret = etat.mode === 'upload' ? Boolean(etat.fichier) : texteEditeur().length >= 200;
  const chapitres = Boolean(qs('#par-chapitres')?.checked);
  const premiumPret = statut !== 'premium' || prix >= 100;
  const couverturePret = Boolean(etat.couverture && etat.couvertureOk);

  const items = [
    { label: 'Titre, genre, catégorie et langue originale', ok: Boolean(titre && genre && categorie && langue), points: 18 },
    { label: 'Résumé professionnel pour convaincre', ok: resume.length >= 80, points: 16 },
    { label: 'Mots-clés de découverte renseignés', ok: motsCles.length >= 1 && motsCles.length <= 7, points: 12 },
    { label: 'Contenu importé ou texte saisi', ok: contenuPret, points: 18 },
    { label: 'Couverture verticale 1,6:1 validée', ok: couverturePret, points: 14 },
    { label: 'Structure par chapitres activée', ok: chapitres, points: 8 },
    { label: 'Prix premium valide si nécessaire', ok: premiumPret, points: 7 },
    { label: 'Droits, territoires et déclaration confirmés', ok: Boolean(declaration && qs('#territoires')?.value), points: 7 },
  ];

  const score = items.reduce((total, item) => total + (item.ok ? item.points : 0), 0);
  return { score: Math.min(100, score), items };
}

function mettreAJourQualitePublication() {
  const { score, items } = calculerQualitePublication();
  qualitePublication = score;

  const scoreEl = qs('#quality-score');
  const barEl = qs('#quality-bar');
  const listEl = qs('#quality-checklist');
  if (scoreEl) scoreEl.textContent = `${score}%`;
  if (barEl) barEl.style.width = `${score}%`;
  if (listEl) {
    listEl.innerHTML = items.map(item => `
      <div class="publish-quality__check ${item.ok ? 'is-ok' : ''}">
        <span>${item.ok ? '✓' : item.optional ? '•' : '!'}</span>
        <p>${item.label}</p>
      </div>
    `).join('');
  }

  const recapQualite = qs('#recap-qualite');
  if (recapQualite) recapQualite.textContent = `${score}%`;
}

document.addEventListener('DOMContentLoaded', () => {
  mettreAJourQualitePublication();
  qs('.publish-page')?.addEventListener('input', mettreAJourQualitePublication);
  qs('.publish-page')?.addEventListener('change', mettreAJourQualitePublication);
});

/* ============================================================
   Navigation entre étapes
   ============================================================ */

function allerEtape(n) {
  etat.etape = n;
  steps.forEach(s => {
    const num = Number(s.dataset.step);
    s.classList.toggle('step--active', num === n);
    s.classList.toggle('step--done',   num < n);
  });
  sections.forEach(s => s.classList.toggle('is-active', Number(s.dataset.section) === n));
  if (n === 4) remplirRecap();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

qs('#next-1')?.addEventListener('click', () => {
  if (!validerEtape1()) return;
  allerEtape(2);
});

qs('#next-2')?.addEventListener('click', () => {
  if (!validerEtape2()) return;
  allerEtape(3);
});

qs('#next-3')?.addEventListener('click', () => {
  if (!validerEtape3()) return;
  allerEtape(4);
});

qs('#prev-2')?.addEventListener('click', () => allerEtape(1));
qs('#prev-3')?.addEventListener('click', () => allerEtape(2));
qs('#prev-4')?.addEventListener('click', () => allerEtape(3));

/* ============================================================
   Validations par étape
   ============================================================ */

function afficherErreur(msg) {
  alertEl.textContent = msg;
  afficher(alertEl);
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function cacherErreur() { cacher(alertEl); }

function validerEtape1() {
  cacherErreur();
  const titre = qs('#titre').value.trim();
  const genre = qs('#genre').value;
  const categorie = qs('#categorie-principale')?.value || '';
  const langue = qs('#langue').value;
  const resume = qs('#resume').value.trim();
  const motsCles = lireMotsCles();
  if (!titre)  return afficherErreur('Le titre est obligatoire.') || false;
  if (!genre)  return afficherErreur('Choisis un genre littéraire.') || false;
  if (!categorie) return afficherErreur('Choisis une catégorie principale pour classer le livre.') || false;
  if (!langue) return afficherErreur('Choisis la langue originale.') || false;
  if (!resume) return afficherErreur('Ajoute un résumé : il aide les lecteurs à comprendre ton livre.') || false;
  if (resume.length < 80) return afficherErreur('Le résumé doit faire au moins 80 caractères pour présenter correctement le livre.') || false;
  if (!motsCles.length) return afficherErreur('Ajoute au moins un mot-clé pour aider les lecteurs à trouver ton livre.') || false;
  if (motsCles.length > 7) return afficherErreur('Limite les mots-clés à 7 maximum, comme les standards ebook.') || false;
  return true;
}

function validerEtape2() {
  cacherErreur();
  if (etat.mode === 'upload' && !etat.fichier) {
    return afficherErreur('Importe un fichier ou utilise l\'éditeur pour saisir ton texte.') || false;
  }
  if (etat.mode === 'editor') {
    const contenu = qs('#editor-content').innerText.trim();
    if (!contenu) return afficherErreur('L\'éditeur est vide. Écris quelque chose !') || false;
    etat.contenuTexte = contenu;
  }
  return true;
}

function validerEtape3() {
  cacherErreur();
  const statut = qs('#statut-oeuvre').value;
  if (statut === 'premium') {
    const prix = parseFloat(qs('#prix').value);
    if (!prix || prix < 100) return afficherErreur('Le prix minimum est 100 FCFA.') || false;
    const gratuits = parseInt(qs('#chapitres-gratuits')?.value || '0', 10);
    if (Number.isNaN(gratuits) || gratuits < 0) return afficherErreur('Indique un nombre de chapitres gratuits valide.') || false;
  }
  if (!qs('#declaration-proprio').checked) {
    return afficherErreur('Tu dois déclarer être l\'auteur(e) de cette œuvre.') || false;
  }
  if (!qs('#territoires')?.value) {
    return afficherErreur('Choisis les territoires où Kalamundi peut diffuser ton livre.') || false;
  }
  return true;
}

function validerChecklistFinale() {
  if (!etat.couverture) {
    return afficherErreur('Ajoute une couverture avant publication. Un livre commercialisable doit avoir une couverture lisible.') || false;
  }
  if (!etat.couvertureOk) {
    return afficherErreur('La couverture doit être verticale, proche du ratio 1,6:1 recommandé pour les ebooks.') || false;
  }
  if (qualitePublication < 85) {
    return afficherErreur('Complète la checklist de dépôt avant publication : vise au moins 85%.') || false;
  }
  return true;
}

/* ============================================================
   Étape 1 — Couverture
   ============================================================ */

qs('#cover-btn')?.addEventListener('click', () => qs('#cover-input').click());
qs('#cover-preview')?.addEventListener('click', () => qs('#cover-input').click());
qs('#cover-preview')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') qs('#cover-input').click();
});

qs('#cover-input')?.addEventListener('change', (e) => {
  const fichier = e.target.files[0];
  if (!fichier) return;
  if (fichier.size > 5 * 1024 * 1024) return toastErreur('Image trop lourde (max 5 Mo).');
  verifierRatioCouverture(fichier).then(({ ok }) => {
    etat.couvertureOk = ok;
    if (!ok) {
      toast('Couverture acceptée, mais ratio à corriger : vise 1,6:1.', 'info', 5000);
    }
    mettreAJourQualitePublication();
  });
  etat.couverture = fichier;
  const url = URL.createObjectURL(fichier);
  qs('#cover-preview').innerHTML = `<img src="${url}" alt="Couverture" />`;
  afficher(qs('#cover-remove'));
  mettreAJourQualitePublication();
});

qs('#cover-remove')?.addEventListener('click', () => {
  etat.couverture = null;
  etat.couvertureOk = false;
  qs('#cover-input').value = '';
  qs('#cover-preview').innerHTML = `
    <div class="cover-preview__placeholder">
      <span>🖼</span><p>Ajouter une image</p>
    </div>`;
  cacher(qs('#cover-remove'));
  mettreAJourQualitePublication();
});

/* Compteur résumé */
qs('#resume')?.addEventListener('input', () => {
  const n = qs('#resume').value.length;
  qs('#resume-counter').textContent = `${n} / 1000 caractères`;
});

/* ============================================================
   Étape 2 — Sélecteur de mode
   ============================================================ */

document.querySelectorAll('.mode-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    etat.mode = btn.dataset.mode;
    qs('#zone-upload').classList.toggle('hidden', etat.mode !== 'upload');
    qs('#zone-editor').classList.toggle('hidden', etat.mode !== 'editor');
    mettreAJourQualitePublication();
  });
});

/* ============================================================
   Étape 2 — Upload fichier
   ============================================================ */

const uploadZone  = qs('#upload-zone');
const fichierInput = qs('#fichier-input');

uploadZone?.addEventListener('click', () => fichierInput.click());
uploadZone?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') fichierInput.click();
});

uploadZone?.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('is-dragover');
});

uploadZone?.addEventListener('dragleave', () => {
  uploadZone.classList.remove('is-dragover');
});

uploadZone?.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('is-dragover');
  const fichier = e.dataTransfer.files[0];
  if (fichier) traiterFichier(fichier);
});

fichierInput?.addEventListener('change', (e) => {
  const fichier = e.target.files[0];
  if (fichier) traiterFichier(fichier);
});

async function traiterFichier(fichier) {
  try {
    const { valide, erreur } = validerFichier(fichier);
    if (!valide) throw new Error(erreur || 'Fichier non accepté.');
    etat.fichier = fichier;
    qs('#fichier-nom').textContent   = fichier.name;
    qs('#fichier-taille').textContent = formatTailleFichier(fichier.size);
    afficher(qs('#fichier-info'));
    cacher(uploadZone);
    mettreAJourQualitePublication();
    toast(`Fichier "${fichier.name}" prêt à être publié`, 'success');
  } catch (err) {
    toastErreur(err.message);
    etat.fichier = null;
  }
}

qs('#fichier-retirer')?.addEventListener('click', () => {
  etat.fichier = null;
  fichierInput.value = '';
  cacher(qs('#fichier-info'));
  afficher(uploadZone);
  mettreAJourQualitePublication();
});

/* ============================================================
   Étape 2 — Éditeur WYSIWYG
   ============================================================ */

document.querySelectorAll('.editor-toolbar__btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.dataset.cmd;
    const val = btn.dataset.val;
    document.execCommand(cmd, false, val || null);
    qs('#editor-content').focus();
  });
});

qs('#editor-content')?.addEventListener('input', () => {
  const mots = qs('#editor-content').innerText.trim().split(/\s+/).filter(Boolean).length;
  qs('#editor-counter').textContent = `${mots} mot(s)`;
});

/* ============================================================
   Étape 2 — Publication par chapitres + programmation
   ============================================================ */

qs('#par-chapitres')?.addEventListener('change', (e) => {
  qs('#groupe-chapitres-details').classList.toggle('hidden', !e.target.checked);
  if (e.target.checked) mettreAJourApercuPlanning();
});

qs('#groupe-chapitres-details')?.classList.toggle('hidden', !qs('#par-chapitres')?.checked);

qs('#frequence-publication')?.addEventListener('change', mettreAJourApercuPlanning);
qs('#date-debut-publication')?.addEventListener('change', mettreAJourApercuPlanning);

function mettreAJourApercuPlanning() {
  const freq    = qs('#frequence-publication')?.value || 'immediate';
  const apercu  = qs('#apercu-planning');
  if (!apercu) return;

  if (freq === 'immediate') {
    apercu.style.display = 'none';
    return;
  }

  const labels = {
    quotidien: 'par jour',
    biquotidien: 'tous les 2 jours',
    hebdomadaire: 'par semaine',
    bihebdomadaire: 'toutes les 2 semaines',
    mensuel: 'par mois',
    bimensuel: 'tous les 2 mois',
  };
  apercu.style.display = 'block';
  apercu.innerHTML = `✅ Les chapitres seront dévoilés automatiquement — 1 chapitre ${labels[freq]}.<br>
    Le premier paraît à la date de début (ou aujourd'hui si vide).`;
}

function calculerDatesPublication(nbChapitres, frequence, dateDebut) {
  const dates = [];
  const debut = dateDebut ? new Date(dateDebut + 'T00:00:00') : new Date();
  debut.setHours(0, 0, 0, 0);

  const intervalJours = {
    quotidien:      1,
    biquotidien:    2,
    hebdomadaire:   7,
    bihebdomadaire: 14,
  };

  for (let i = 0; i < nbChapitres; i++) {
    if (frequence === 'immediate') { dates.push(null); continue; }
    const d = new Date(debut);
    if (intervalJours[frequence] !== undefined) {
      d.setDate(debut.getDate() + i * intervalJours[frequence]);
    } else if (frequence === 'mensuel') {
      d.setMonth(debut.getMonth() + i);
    } else if (frequence === 'bimensuel') {
      d.setMonth(debut.getMonth() + i * 2);
    }
    dates.push(d.toISOString());
  }
  return dates;
}

/* ============================================================
   Étape 3 — Statut gratuit / premium
   ============================================================ */

document.querySelectorAll('[data-statut]').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('[data-statut]').forEach(c => c.classList.remove('is-active'));
    card.classList.add('is-active');
    qs('#statut-oeuvre').value = card.dataset.statut;
    qs('#groupe-prix').classList.toggle('hidden', card.dataset.statut !== 'premium');
    mettreAJourQualitePublication();
  });
});

/* ============================================================
   Étape 3 — Licence
   ============================================================ */

document.querySelectorAll('[data-licence]').forEach(card => {
  card.addEventListener('click', () => {
    document.querySelectorAll('[data-licence]').forEach(c => c.classList.remove('is-active'));
    card.classList.add('is-active');
    qs('#licence-oeuvre').value = card.dataset.licence;
  });
});

/* ============================================================
   Étape 4 — Récapitulatif
   ============================================================ */

function remplirRecap() {
  const genres = {
    roman: 'Roman', nouvelle: 'Nouvelle', poesie: 'Poésie', essai: 'Essai',
    conte: 'Conte traditionnel', autobiographie: 'Autobiographie', recit_voyage: 'Récit de voyage',
    recit_historique: 'Récit historique', temoignage: 'Témoignage', thriller: 'Thriller / Policier',
    romance: 'Romance', sf_fantasy: 'SF / Fantasy', jeunesse: 'Littérature jeunesse',
    litterature_orale: 'Littérature orale', philosophie: 'Philosophie',
    developpement_perso: 'Développement personnel', humour: 'Humour / Satire', bd: 'BD / Roman graphique',
  };
  const langues = {
    fr: 'Français', en: 'Anglais', es: 'Espagnol', pt: 'Portugais',
    ar: 'Arabe', sw: 'Swahili', ha: 'Haoussa', yo: 'Yoruba',
    ig: 'Igbo', ln: 'Lingala', wo: 'Wolof', bm: 'Bambara',
    de: 'Allemand', zh: 'Mandarin', autre: 'Autre',
  };

  qs('#recap-titre').textContent   = qs('#titre').value || '—';
  qs('#recap-genre').textContent   = genres[qs('#genre').value] || '—';
  qs('#recap-categories').textContent = [
    qs('#categorie-principale')?.selectedOptions?.[0]?.textContent || '',
    qs('#categorie-secondaire')?.selectedOptions?.[0]?.textContent || '',
  ].filter(t => t && !t.includes('Optionnel')).join(' · ') || '—';
  qs('#recap-langue').textContent  = langues[qs('#langue').value] || '—';
  qs('#recap-mots-cles').textContent = lireMotsCles().join(', ') || '—';
  qs('#recap-statut').textContent  = qs('#statut-oeuvre').value === 'premium'
    ? `Premium — ${qs('#prix').value || '?'} FCFA · ${qs('#chapitres-gratuits')?.value || 0} chapitre(s) gratuit(s)` : 'Gratuit';
  qs('#recap-licence').textContent = qs('#licence-oeuvre').value === 'cc'
    ? 'Creative Commons' : 'Tous droits réservés';
  qs('#recap-contenu').textContent = etat.fichier
    ? `Fichier : ${etat.fichier.name}` : 'Texte saisi dans l\'éditeur';
  qs('#recap-qualite').textContent = `${qualitePublication}%`;
  qs('#recap-royalties').textContent = qs('#statut-oeuvre').value === 'premium'
    ? '50% auteur / 50% Kalamundi' : 'Revenus publicité selon disponibilité';
}

/* ============================================================
   Publication finale
   ============================================================ */

qs('#btn-publier')?.addEventListener('click', async () => {
  const btn = qs('#btn-publier');
  btn.classList.add('btn--loading');
  btn.disabled = true;
  cacherErreur();

  try {
    const user = await getUser();
    if (!user) throw new Error('Tu dois être connecté pour publier.');
    if (!validerEtape1() || !validerEtape2() || !validerEtape3() || !validerChecklistFinale()) {
      return;
    }

    // 1. Lire le contenu
    let contenu = '';
    if (etat.mode === 'upload' && etat.fichier) {
      contenu = await lireFichier(etat.fichier);
    } else {
      contenu = qs('#editor-content').innerText.trim();
    }
    if (!contenu) throw new Error('Le contenu de l\'œuvre est vide.');

    // 2. Calculer SHA-256
    etat.hash = await calculerSHA256(contenu);

    // 3. Créer l'œuvre en base
    const frequence      = qs('#frequence-publication')?.value || 'immediate';
    const dateDebut      = qs('#date-debut-publication')?.value || null;
    const metadonneesPublication = collecterMetadonneesPublication();
    const oeuvreData = {
      auteur_id:              user.id,
      titre:                  qs('#titre').value.trim(),
      genre:                  qs('#genre').value,
      resume:                 qs('#resume').value.trim() || null,
      langue_originale:       qs('#langue').value,
      statut:                 qs('#statut-oeuvre').value,
      prix:                   qs('#statut-oeuvre').value === 'premium' ? parseFloat(qs('#prix').value) : 0,
      chapitres_gratuits:     qs('#statut-oeuvre').value === 'premium' ? parseInt(qs('#chapitres-gratuits')?.value || '3', 10) : 0,
      public_cible:           qs('#public_cible').value,
      hash_sha256:            etat.hash,
      visible:                true,
      frequence_publication:  frequence,
      date_debut_publication: dateDebut || null,
    };

    const oeuvre = await api.creerOeuvre(oeuvreData);
    etat.oeuvreId = oeuvre.id;

    // 4. Upload couverture si présente
    let urlCouverture = null;
    if (etat.couverture) {
      try {
        urlCouverture = await api.uploadCouverture(oeuvre.id, etat.couverture);
        await api.updateOeuvre(oeuvre.id, { couverture_url: urlCouverture });
      } catch { /* couverture optionnelle, on continue */ }
    }

    // 5. Upload fichier original si présent
    let cheminFichier = null;
    if (etat.fichier) {
      try {
        cheminFichier = await api.uploadFichierOeuvre(oeuvre.id, etat.fichier);
        await api.updateOeuvre(oeuvre.id, { fichier_url: cheminFichier });
      } catch { /* fichier optionnel, le texte est déjà en base */ }
    }

    // 6. Découper et enregistrer les chapitres
    const parChapitres  = qs('#par-chapitres').checked;
    const typeElement   = qs('#type-element-chapitre')?.value || 'chapitre';
    const titreChapitre = qs('#titre-chapitre')?.value?.trim() || null;

    const decoupageAuto = etat.mode === 'upload' && contenu.length > 12000;
    const doitDecouper = parChapitres || decoupageAuto;

    const chapitres = doitDecouper
      ? decouperEnChapitres(contenu)
      : [{ ...decouperEnChapitres(contenu)[0], titre: titreChapitre }];

    if (decoupageAuto && !parChapitres && chapitres.length > 1) {
      toast(`Découpage automatique : ${chapitres.length} chapitres créés.`, 'info', 5000);
    }

    const datesPublication = calculerDatesPublication(chapitres.length, parChapitres ? frequence : 'immediate', dateDebut);

    for (let i = 0; i < chapitres.length; i++) {
      const ch = chapitres[i];
      const datePubli = datesPublication[i];
      await api.creerChapitre({
        oeuvre_id:        oeuvre.id,
        numero:           ch.numero,
        titre:            ch.titre,
        contenu_texte:    ch.contenu,
        chapitre_id:      ch.chapitre_id,
        source_hash:      ch.source_hash,
        format_source:    etat.fichier?.name?.split('.').pop()?.toLowerCase() || 'interne',
        metadata: {
          normalisation: doitDecouper ? 'decoupage_publication' : 'chapitre_unique',
          mode_publication: etat.mode,
        },
        type_element:     doitDecouper ? (ch.type_element || 'chapitre') : typeElement,
        date_publication: datePubli,
        visible:          datePubli === null || new Date(datePubli) <= new Date(),
      });
    }

    // 6bis. Construire l’EPUB canonique et synchroniser le modèle Livre/Éditions/Offres.
    let epubPath = null;
    const validationEpub = validerStructureEpub({ chapitres });
    if (validationEpub.valide) {
      try {
        const epubBlob = await construireEpubCanonique({
          oeuvre: {
            ...oeuvreData,
            id: oeuvre.id,
            couverture_url: urlCouverture,
          },
          chapitres,
        });
        epubPath = await api.uploadEpubCanonique(oeuvre.id, epubBlob);
      } catch (err) {
        console.warn('EPUB canonique non généré :', err);
        toast('Publication enregistrée, EPUB canonique à régénérer plus tard.', 'info', 5000);
      }
    } else {
      console.warn('Structure EPUB invalide :', validationEpub.erreurs);
    }

    api.synchroniserLivrePublication({
      ...oeuvre,
      ...oeuvreData,
      couverture_url: urlCouverture,
      fichier_url: cheminFichier,
      ...metadonneesPublication,
      metadata_publication: metadonneesPublication,
    }, {
      chapitres,
      fichierOriginal: etat.fichier,
      cheminFichier,
      epubPath,
    }).catch(err => console.warn('Livre/éditions/offres non synchronisés :', err));

    // 7. Afficher le certificat
    afficherCertificat(etat.hash);

    // 8. Afficher le panneau post-publication
    cacher(qs('#publish-nav-final'));
    afficher(qs('#post-publication'));
    qs('#voir-oeuvre').href = `/pages/work.html?id=${oeuvre.id}`;

    api.notifierNouvelleOeuvre(oeuvre.id)
      .catch(err => console.warn('Notification publication non envoyee :', err));

    effacerBrouillon();
    toast('Œuvre publiée avec succès ! 🎉', 'success', 5000);

  } catch (err) {
    afficherErreur(err.message);
    toastErreur(err.message);
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
});

/* ============================================================
   Certificat d'horodatage
   ============================================================ */

function afficherCertificat(hash) {
  const certificat = qs('#certificat');
  qs('#certificat-hash').textContent = hash;
  qs('#certificat-date').textContent = `Enregistré le ${new Date().toLocaleString('fr-FR')}`;
  afficher(certificat);
  certificat.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

qs('#copier-hash')?.addEventListener('click', () => {
  copier(etat.hash);
});
