/* ============================================================
   publish.js — Logique page publication + horodatage SHA-256
   Kalamundi — La Plume du Monde
   ============================================================ */

import { protegerRoute, getUser } from './auth.js';
import { api } from './api.js';
import { lireFichier, calculerSHA256, calculerSHA256Fichier, decouperEnChapitres, watermark } from './upload.js';
import { toast, toastErreur, formatTailleFichier, qs, cacher, afficher, copier } from './utils.js';

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
      genre:       qs('#genre')?.value || '',
      langue:      qs('#langue')?.value || '',
      resume:      qs('#resume')?.value || '',
      public_cible: qs('#public_cible')?.value || '',
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
  if (data.genre)       { const el = qs('#genre');        if (el) el.value = data.genre; }
  if (data.langue)      { const el = qs('#langue');       if (el) el.value = data.langue; }
  if (data.resume)      { const el = qs('#resume');       if (el) { el.value = data.resume; qs('#resume-counter').textContent = `${data.resume.length} / 1000 caractères`; } }
  if (data.public_cible){ const el = qs('#public_cible'); if (el) el.value = data.public_cible; }
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
['#titre','#genre','#langue','#resume','#public_cible','#prix','#statut-oeuvre','#editor-content'].forEach(sel => {
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
  contenuTexte: '',
  hash:         '',
  oeuvreId:     null,
};

/* ============================================================
   Éléments DOM
   ============================================================ */

const steps    = document.querySelectorAll('.step[data-step]');
const sections = document.querySelectorAll('.publish-section[data-section]');
const alertEl  = qs('#publish-alert');

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
  const langue = qs('#langue').value;
  if (!titre)  return afficherErreur('Le titre est obligatoire.') || false;
  if (!genre)  return afficherErreur('Choisis un genre littéraire.') || false;
  if (!langue) return afficherErreur('Choisis la langue originale.') || false;
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
    if (!prix || prix < 0.99) return afficherErreur('Le prix minimum est 0,99 USD.') || false;
  }
  if (!qs('#declaration-proprio').checked) {
    return afficherErreur('Tu dois déclarer être l\'auteur(e) de cette œuvre.') || false;
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
  etat.couverture = fichier;
  const url = URL.createObjectURL(fichier);
  qs('#cover-preview').innerHTML = `<img src="${url}" alt="Couverture" />`;
  afficher(qs('#cover-remove'));
});

qs('#cover-remove')?.addEventListener('click', () => {
  etat.couverture = null;
  qs('#cover-input').value = '';
  qs('#cover-preview').innerHTML = `
    <div class="cover-preview__placeholder">
      <span>🖼</span><p>Ajouter une image</p>
    </div>`;
  cacher(qs('#cover-remove'));
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
    const { valide, erreur } = await import('./utils.js').then(m => ({ valide: true }));
    etat.fichier = fichier;
    qs('#fichier-nom').textContent   = fichier.name;
    qs('#fichier-taille').textContent = formatTailleFichier(fichier.size);
    afficher(qs('#fichier-info'));
    cacher(uploadZone);
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

  const labels = { quotidien: 'par jour', hebdomadaire: 'par semaine', mensuel: 'par mois' };
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
  qs('#recap-langue').textContent  = langues[qs('#langue').value] || '—';
  qs('#recap-statut').textContent  = qs('#statut-oeuvre').value === 'premium'
    ? `Premium — ${qs('#prix').value || '?'} USD` : 'Gratuit';
  qs('#recap-licence').textContent = qs('#licence-oeuvre').value === 'cc'
    ? 'Creative Commons' : 'Tous droits réservés';
  qs('#recap-contenu').textContent = etat.fichier
    ? `Fichier : ${etat.fichier.name}` : 'Texte saisi dans l\'éditeur';
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
    const oeuvreData = {
      auteur_id:              user.id,
      titre:                  qs('#titre').value.trim(),
      genre:                  qs('#genre').value,
      resume:                 qs('#resume').value.trim() || null,
      langue_originale:       qs('#langue').value,
      statut:                 qs('#statut-oeuvre').value,
      prix:                   qs('#statut-oeuvre').value === 'premium' ? parseFloat(qs('#prix').value) : 0,
      public_cible:           qs('#public_cible').value,
      hash_sha256:            etat.hash,
      visible:                true,
      frequence_publication:  frequence,
      date_debut_publication: dateDebut || null,
    };

    const oeuvre = await api.creerOeuvre(oeuvreData);
    etat.oeuvreId = oeuvre.id;

    // 4. Upload couverture si présente
    if (etat.couverture) {
      try {
        const urlCouverture = await api.uploadCouverture(oeuvre.id, etat.couverture);
        await api.updateOeuvre(oeuvre.id, { couverture_url: urlCouverture });
      } catch { /* couverture optionnelle, on continue */ }
    }

    // 5. Upload fichier original si présent
    if (etat.fichier) {
      try {
        const cheminFichier = await api.uploadFichierOeuvre(oeuvre.id, etat.fichier);
        await api.updateOeuvre(oeuvre.id, { fichier_url: cheminFichier });
      } catch { /* fichier optionnel, le texte est déjà en base */ }
    }

    // 6. Découper et enregistrer les chapitres
    const parChapitres  = qs('#par-chapitres').checked;
    const typeElement   = qs('#type-element-chapitre')?.value || 'chapitre';
    const titreChapitre = qs('#titre-chapitre')?.value?.trim() || null;

    const chapitres = parChapitres
      ? decouperEnChapitres(contenu)
      : [{ numero: 1, titre: titreChapitre, contenu }];

    const datesPublication = calculerDatesPublication(chapitres.length, parChapitres ? frequence : 'immediate', dateDebut);

    for (let i = 0; i < chapitres.length; i++) {
      const ch = chapitres[i];
      const datePubli = datesPublication[i];
      await api.creerChapitre({
        oeuvre_id:        oeuvre.id,
        numero:           ch.numero,
        titre:            ch.titre,
        contenu_texte:    ch.contenu,
        type_element:     parChapitres ? (ch.type_element || 'chapitre') : typeElement,
        date_publication: datePubli,
        visible:          datePubli === null || new Date(datePubli) <= new Date(),
      });
    }

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
