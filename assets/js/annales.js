/* ============================================================
   annales.js — Annales BAC / Probatoire / BEPC — Cameroun
   Kalamundi — La Plume du Monde
   ============================================================ */

import { supabase, getUser } from './auth.js';
import { toast, toastSucces, toastErreur } from './utils.js';

let toutesLesAnnales = [];
let utilisateur = null;
let annaleSelectionnee = null;

const LABELS_EXAMEN = {
  BAC:        { label: 'BAC',        css: 'badge-bac'  },
  Probatoire: { label: 'Probatoire', css: 'badge-prob' },
  BEPC:       { label: 'BEPC',       css: 'badge-bepc' },
};

const LABELS_SERIE = {
  A:  'Lettres et Sciences Humaines',
  A4: 'Lettres Bilingues',
  B:  'Économie et Sciences Sociales',
  C:  'Mathématiques et Sciences Physiques',
  D:  'Sciences et Technologies du Vivant',
  E:  'Sciences et Technologies Industrielles',
  F:  'Techniques Industrielles',
  G1: 'Gestion Comptable',
  G2: 'Commercialisation',
  G3: 'Secrétariat-Bureautique',
};

/* ── Init ─────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  utilisateur = await getUser();
  if (utilisateur) verifierAdmin();

  await chargerAnnales();
  initFiltres();
  initModalUpload();
});

/* ── Navbar ───────────────────────────────────────────────── */

function initNavbar() {
  const toggle = document.getElementById('nav-toggle');
  const menu   = document.getElementById('nav-menu');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });

  const actions = document.getElementById('navbar-actions');
  if (!actions) return;
  if (utilisateur) {
    actions.innerHTML = `<a href="/pages/author-dashboard.html" class="btn btn--ghost btn--sm">Mon espace</a>`;
  } else {
    actions.innerHTML = `
      <a href="/pages/login.html" class="btn btn--ghost btn--sm">Connexion</a>
      <a href="/pages/login.html?mode=inscription" class="btn btn--accent btn--sm">S'inscrire</a>`;
  }
}

/* ── Vérifier si admin ────────────────────────────────────── */

async function verifierAdmin() {
  if (!utilisateur) return;
  const { data } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', utilisateur.id)
    .single();
  if (data?.role === 'admin') {
    document.getElementById('admin-bar').style.display = 'flex';
    document.getElementById('btn-ajouter-annale').addEventListener('click', () => {
      alert('Pour ajouter une annale manuellement, utilisez le tableau de bord admin.');
    });
  }
}

/* ── Charger les annales depuis Supabase ──────────────────── */

async function chargerAnnales() {
  const { data, error } = await supabase
    .from('annales')
    .select('*')
    .eq('visible', true)
    .order('annee', { ascending: false })
    .order('examen')
    .order('serie')
    .order('matiere');

  if (error) {
    document.getElementById('annales-grid').innerHTML = `
      <div style="grid-column:1/-1;text-align:center;color:var(--color-error);padding:3rem">
        Impossible de charger les annales. Vérifiez votre connexion.
      </div>`;
    return;
  }

  toutesLesAnnales = data || [];

  // Stat héro
  document.getElementById('stat-total').textContent = toutesLesAnnales.length;

  afficherAnnales(toutesLesAnnales);
}

/* ── Affichage ────────────────────────────────────────────── */

function afficherAnnales(liste) {
  const grid    = document.getElementById('annales-grid');
  const resume  = document.getElementById('filtre-resume');

  if (!liste.length) {
    grid.innerHTML = `
      <div class="annales-empty" style="grid-column:1/-1">
        <div class="annales-empty__icon">🔍</div>
        <h3>Aucune annale trouvée</h3>
        <p>Essayez de modifier vos filtres ou <button class="btn btn--ghost btn--sm" onclick="document.getElementById('btn-reset-filtres').click()">réinitialisez</button>.</p>
      </div>`;
    resume.textContent = '';
    return;
  }

  resume.textContent = `${liste.length} résultat${liste.length > 1 ? 's' : ''}`;

  grid.innerHTML = liste.map(a => carteAnnale(a)).join('');
}

function carteAnnale(a) {
  const ex       = LABELS_EXAMEN[a.examen] || { label: a.examen, css: 'badge-bac' };
  const serieLbl = a.serie ? `Série ${a.serie}` : '';
  const serieTitle = a.serie ? (LABELS_SERIE[a.serie] || '') : '';
  const sessRattrapage = a.session === 'rattrapage';

  const badgeSerie = serieLbl
    ? `<span class="badge-serie" title="${serieTitle}">${serieLbl}</span>`
    : '';
  const badgeSession = sessRattrapage
    ? `<span class="badge-session">Rattrapage</span>`
    : '';

  const dispo = !!a.fichier_url;
  const btnDl = dispo
    ? `<a href="${a.fichier_url}" target="_blank" rel="noopener"
          class="btn-telecharger btn-telecharger--dispo"
          onclick="incrementerDl('${a.id}')">
          ⬇ Télécharger
       </a>`
    : `<button class="btn-telecharger btn-telecharger--indispo" disabled title="PDF bientôt disponible">
          ⏳ Bientôt dispo
       </button>`;

  const adminUpload = document.getElementById('admin-bar')?.style.display !== 'none'
    ? `<button class="btn btn--ghost btn--sm" style="font-size:11px"
              onclick="ouvrirUpload('${a.id}','${esc(a.examen)}','${esc(a.serie||'')}','${esc(a.matiere)}',${a.annee})">
              📤 Upload PDF
       </button>`
    : '';

  return `
    <div class="annale-card">
      <div class="annale-card__badges">
        <span class="badge-examen ${ex.css}">${ex.label}</span>
        ${badgeSerie}
        ${badgeSession}
      </div>
      <div class="annale-card__matiere">${a.matiere}</div>
      <div class="annale-card__annee">📅 ${a.annee} · Cameroun</div>
      ${a.description ? `<div style="font-size:12px;color:var(--text-secondary)">${a.description}</div>` : ''}
      <div class="annale-card__footer">
        <span class="annale-card__dl">⬇ ${a.nb_telechargements} téléch.</span>
        <div style="display:flex;gap:6px;align-items:center">
          ${adminUpload}
          ${btnDl}
        </div>
      </div>
    </div>`;
}

function esc(s) { return String(s).replace(/'/g, "\\'"); }

/* ── Incrémenter téléchargements ─────────────────────────── */

window.incrementerDl = async function(id) {
  try {
    await supabase.rpc('incrementer_telechargement_annale', { annale_id: id });
    const a = toutesLesAnnales.find(x => x.id === id);
    if (a) a.nb_telechargements = (a.nb_telechargements || 0) + 1;
  } catch {}
};

/* ── Filtres ──────────────────────────────────────────────── */

function initFiltres() {
  const ids = ['filtre-examen', 'filtre-serie', 'filtre-annee', 'filtre-session'];
  ids.forEach(id => {
    document.getElementById(id)?.addEventListener('change', appliquerFiltres);
  });

  let debounce;
  document.getElementById('filtre-matiere')?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(appliquerFiltres, 250);
  });

  document.getElementById('btn-reset-filtres')?.addEventListener('click', () => {
    document.getElementById('filtre-examen').value  = '';
    document.getElementById('filtre-serie').value   = '';
    document.getElementById('filtre-annee').value   = '';
    document.getElementById('filtre-session').value = '';
    document.getElementById('filtre-matiere').value = '';
    appliquerFiltres();
  });
}

function appliquerFiltres() {
  const examen  = document.getElementById('filtre-examen').value;
  const serie   = document.getElementById('filtre-serie').value;
  const annee   = document.getElementById('filtre-annee').value;
  const session = document.getElementById('filtre-session').value;
  const matiere = document.getElementById('filtre-matiere').value.trim().toLowerCase();

  let liste = toutesLesAnnales;

  if (examen)  liste = liste.filter(a => a.examen === examen);
  if (serie)   liste = liste.filter(a => a.serie  === serie);
  if (annee)   liste = liste.filter(a => a.annee  === parseInt(annee));
  if (session) liste = liste.filter(a => a.session === session);
  if (matiere) liste = liste.filter(a => a.matiere.toLowerCase().includes(matiere));

  // Désactiver filtre série pour BEPC (pas de série)
  const selectSerie = document.getElementById('filtre-serie');
  if (examen === 'BEPC') {
    selectSerie.value = '';
    selectSerie.disabled = true;
  } else {
    selectSerie.disabled = false;
  }

  afficherAnnales(liste);
}

/* ── Modal upload admin ───────────────────────────────────── */

function initModalUpload() {
  document.getElementById('btn-annuler-upload')?.addEventListener('click', fermerModalUpload);
  document.getElementById('modal-upload')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal-upload')) fermerModalUpload();
  });
  document.getElementById('btn-confirmer-upload')?.addEventListener('click', uploadPDF);
}

window.ouvrirUpload = function(id, examen, serie, matiere, annee) {
  annaleSelectionnee = { id, examen, serie, matiere, annee };
  const info = document.getElementById('modal-annale-info');
  info.innerHTML = `
    <strong>${examen}${serie ? ' · Série ' + serie : ''}</strong><br>
    <strong>${matiere}</strong> — ${annee}`;
  document.getElementById('upload-pdf-input').value = '';
  document.getElementById('upload-progress').style.display = 'none';

  const modal = document.getElementById('modal-upload');
  modal.style.display = 'flex';
};

function fermerModalUpload() {
  document.getElementById('modal-upload').style.display = 'none';
  annaleSelectionnee = null;
}

async function uploadPDF() {
  if (!annaleSelectionnee) return;
  const input = document.getElementById('upload-pdf-input');
  const fichier = input.files?.[0];
  if (!fichier) { toast('Sélectionnez un fichier PDF.', 'erreur'); return; }
  if (fichier.type !== 'application/pdf') { toast('Seuls les fichiers PDF sont acceptés.', 'erreur'); return; }
  if (fichier.size > 50 * 1024 * 1024) { toast('Le fichier dépasse 50 Mo.', 'erreur'); return; }

  const btn = document.getElementById('btn-confirmer-upload');
  btn.disabled = true; btn.textContent = 'Upload…';
  document.getElementById('upload-progress').style.display = 'block';
  document.getElementById('upload-bar').style.width = '30%';

  const { examen, serie, matiere, annee } = annaleSelectionnee;
  const nom = `${examen}_${serie || 'BEPC'}_${matiere.replace(/\s+/g,'_')}_${annee}_${Date.now()}.pdf`;

  const { data: uploadData, error: uploadErr } = await supabase.storage
    .from('annales')
    .upload(nom, fichier, { contentType: 'application/pdf', upsert: false });

  document.getElementById('upload-bar').style.width = '70%';

  if (uploadErr) {
    toastErreur('Erreur upload : ' + uploadErr.message);
    btn.disabled = false; btn.textContent = 'Uploader';
    document.getElementById('upload-progress').style.display = 'none';
    return;
  }

  const { data: { publicUrl } } = supabase.storage.from('annales').getPublicUrl(nom);
  document.getElementById('upload-bar').style.width = '90%';

  const { error: updateErr } = await supabase
    .from('annales')
    .update({ fichier_url: publicUrl })
    .eq('id', annaleSelectionnee.id);

  if (updateErr) {
    toastErreur('Fichier uploadé mais mise à jour en base échouée : ' + updateErr.message);
  } else {
    document.getElementById('upload-bar').style.width = '100%';
    toastSucces('PDF uploadé avec succès !');
    const a = toutesLesAnnales.find(x => x.id === annaleSelectionnee.id);
    if (a) a.fichier_url = publicUrl;
    appliquerFiltres();
    setTimeout(fermerModalUpload, 800);
  }

  btn.disabled = false; btn.textContent = 'Uploader';
}
