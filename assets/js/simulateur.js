/* ============================================================
   simulateur.js — Simulateur de moyenne BAC/Probatoire/BEPC
   Coefficients officiels Cameroun
   ============================================================ */

import { getUser } from './auth.js';

/* ============================================================
   COEFFICIENTS OFFICIELS PAR EXAMEN + SÉRIE
   ============================================================ */

const CONFIGS = {

  BAC: {
    C: {
      label: 'BAC Série C — Mathématiques et Sciences Physiques',
      matieres: [
        { nom: 'Mathématiques',       coef: 7, eliminatoire: true  },
        { nom: 'Physique-Chimie',     coef: 6, eliminatoire: true  },
        { nom: 'SVT',                 coef: 2, eliminatoire: false },
        { nom: 'Français',            coef: 3, eliminatoire: false },
        { nom: 'Philosophie',         coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 2, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    D: {
      label: 'BAC Série D — Sciences et Technologies du Vivant',
      matieres: [
        { nom: 'SVT',                 coef: 6, eliminatoire: true  },
        { nom: 'Chimie',              coef: 4, eliminatoire: true  },
        { nom: 'Physique',            coef: 3, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 4, eliminatoire: false },
        { nom: 'Français',            coef: 3, eliminatoire: false },
        { nom: 'Philosophie',         coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 2, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    A: {
      label: 'BAC Série A — Lettres et Sciences Humaines',
      matieres: [
        { nom: 'Français',            coef: 5, eliminatoire: true  },
        { nom: 'Philosophie',         coef: 4, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 4, eliminatoire: false },
        { nom: 'Anglais',             coef: 3, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    A4: {
      label: 'BAC Série A4 — Lettres Bilingues',
      matieres: [
        { nom: 'Français',            coef: 4, eliminatoire: true  },
        { nom: 'Anglais',             coef: 4, eliminatoire: true  },
        { nom: 'Philosophie',         coef: 4, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 3, eliminatoire: false },
        { nom: 'Latin',               coef: 2, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    B: {
      label: 'BAC Série B — Économie et Sciences Sociales',
      matieres: [
        { nom: 'Économie',            coef: 5, eliminatoire: true  },
        { nom: 'Comptabilité',        coef: 4, eliminatoire: true  },
        { nom: 'Mathématiques',       coef: 4, eliminatoire: false },
        { nom: 'Droit',               coef: 3, eliminatoire: false },
        { nom: 'Français',            coef: 3, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    G1: {
      label: 'BAC Série G1 — Gestion Comptable',
      matieres: [
        { nom: 'Comptabilité',        coef: 6, eliminatoire: true  },
        { nom: 'Économie-Droit',      coef: 4, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 3, eliminatoire: false },
        { nom: 'Informatique',        coef: 2, eliminatoire: false },
        { nom: 'Français',            coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 1, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    G2: {
      label: 'BAC Série G2 — Commercialisation',
      matieres: [
        { nom: 'Techniques Commerciales', coef: 5, eliminatoire: true  },
        { nom: 'Marketing',               coef: 4, eliminatoire: false },
        { nom: 'Économie',                coef: 3, eliminatoire: false },
        { nom: 'Mathématiques',           coef: 2, eliminatoire: false },
        { nom: 'Français',                coef: 2, eliminatoire: false },
        { nom: 'Anglais',                 coef: 1, eliminatoire: false },
        { nom: 'EPS',                     coef: 1, eliminatoire: false },
      ],
    },
    G3: {
      label: 'BAC Série G3 — Secrétariat-Bureautique',
      matieres: [
        { nom: 'Bureautique',         coef: 5, eliminatoire: true  },
        { nom: 'Correspondance',      coef: 4, eliminatoire: false },
        { nom: 'Sténo-Dactylo',       coef: 3, eliminatoire: false },
        { nom: 'Économie-Droit',      coef: 2, eliminatoire: false },
        { nom: 'Français',            coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 1, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    E: {
      label: 'BAC Série E — Sciences et Technologies Industrielles',
      matieres: [
        { nom: 'Mathématiques',           coef: 6, eliminatoire: true  },
        { nom: 'Sciences Industrielles',  coef: 6, eliminatoire: true  },
        { nom: 'Physique-Chimie',         coef: 4, eliminatoire: false },
        { nom: 'Français',                coef: 2, eliminatoire: false },
        { nom: 'Anglais',                 coef: 1, eliminatoire: false },
        { nom: 'EPS',                     coef: 1, eliminatoire: false },
      ],
    },
    F: {
      label: 'BAC Série F — Techniques Industrielles',
      matieres: [
        { nom: 'Technologie',         coef: 6, eliminatoire: true  },
        { nom: 'Mathématiques',       coef: 4, eliminatoire: true  },
        { nom: 'Physique-Chimie',     coef: 4, eliminatoire: false },
        { nom: 'Français',            coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 1, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
  },

  Probatoire: {
    C: {
      label: 'Probatoire Série C — Mathématiques et Sciences Physiques',
      matieres: [
        { nom: 'Mathématiques',       coef: 7, eliminatoire: true  },
        { nom: 'Physique-Chimie',     coef: 6, eliminatoire: true  },
        { nom: 'SVT',                 coef: 2, eliminatoire: false },
        { nom: 'Français',            coef: 3, eliminatoire: false },
        { nom: 'Philosophie',         coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 2, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    D: {
      label: 'Probatoire Série D — Sciences du Vivant',
      matieres: [
        { nom: 'SVT',                 coef: 6, eliminatoire: true  },
        { nom: 'Chimie',              coef: 4, eliminatoire: true  },
        { nom: 'Physique',            coef: 3, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 4, eliminatoire: false },
        { nom: 'Français',            coef: 3, eliminatoire: false },
        { nom: 'Philosophie',         coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 2, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    A: {
      label: 'Probatoire Série A — Lettres et Sciences Humaines',
      matieres: [
        { nom: 'Français',            coef: 5, eliminatoire: true  },
        { nom: 'Philosophie',         coef: 4, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 4, eliminatoire: false },
        { nom: 'Anglais',             coef: 3, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    A4: {
      label: 'Probatoire Série A4 — Lettres Bilingues',
      matieres: [
        { nom: 'Français',            coef: 4, eliminatoire: true  },
        { nom: 'Anglais',             coef: 4, eliminatoire: true  },
        { nom: 'Philosophie',         coef: 4, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 3, eliminatoire: false },
        { nom: 'Latin',               coef: 2, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    B: {
      label: 'Probatoire Série B — Économie et Sciences Sociales',
      matieres: [
        { nom: 'Économie',            coef: 5, eliminatoire: true  },
        { nom: 'Comptabilité',        coef: 4, eliminatoire: true  },
        { nom: 'Mathématiques',       coef: 4, eliminatoire: false },
        { nom: 'Droit',               coef: 3, eliminatoire: false },
        { nom: 'Français',            coef: 3, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    G1: {
      label: 'Probatoire Série G1 — Gestion Comptable',
      matieres: [
        { nom: 'Comptabilité',        coef: 6, eliminatoire: true  },
        { nom: 'Économie-Droit',      coef: 4, eliminatoire: false },
        { nom: 'Mathématiques',       coef: 3, eliminatoire: false },
        { nom: 'Informatique',        coef: 2, eliminatoire: false },
        { nom: 'Français',            coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 1, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
    G2: {
      label: 'Probatoire Série G2 — Commercialisation',
      matieres: [
        { nom: 'Techniques Commerciales', coef: 5, eliminatoire: true  },
        { nom: 'Marketing',               coef: 4, eliminatoire: false },
        { nom: 'Économie',                coef: 3, eliminatoire: false },
        { nom: 'Mathématiques',           coef: 2, eliminatoire: false },
        { nom: 'Français',                coef: 2, eliminatoire: false },
        { nom: 'Anglais',                 coef: 1, eliminatoire: false },
        { nom: 'EPS',                     coef: 1, eliminatoire: false },
      ],
    },
    G3: {
      label: 'Probatoire Série G3 — Secrétariat-Bureautique',
      matieres: [
        { nom: 'Bureautique',         coef: 5, eliminatoire: true  },
        { nom: 'Correspondance',      coef: 4, eliminatoire: false },
        { nom: 'Sténo-Dactylo',       coef: 3, eliminatoire: false },
        { nom: 'Économie-Droit',      coef: 2, eliminatoire: false },
        { nom: 'Français',            coef: 2, eliminatoire: false },
        { nom: 'Anglais',             coef: 1, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
  },

  BEPC: {
    _: {
      label: 'BEPC — Brevet d\'Études du Premier Cycle',
      matieres: [
        { nom: 'Mathématiques',       coef: 4, eliminatoire: true  },
        { nom: 'Français',            coef: 4, eliminatoire: true  },
        { nom: 'Anglais',             coef: 3, eliminatoire: false },
        { nom: 'Sciences Physiques',  coef: 3, eliminatoire: false },
        { nom: 'SVT',                 coef: 3, eliminatoire: false },
        { nom: 'Histoire-Géographie', coef: 3, eliminatoire: false },
        { nom: 'Économie de Marché',  coef: 2, eliminatoire: false },
        { nom: 'EPS',                 coef: 1, eliminatoire: false },
      ],
    },
  },
};

/* ============================================================
   ÉTAT
   ============================================================ */

let notes = {}; // { nomMatiere: valeur }

/* ============================================================
   INIT
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initSelectors();
  rendreMatieres();
});

function initNavbar() {
  const toggle = document.getElementById('nav-toggle');
  const menu   = document.getElementById('nav-menu');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
}

function initSelectors() {
  const selExamen  = document.getElementById('sel-examen');
  const selSerie   = document.getElementById('sel-serie');
  const selSession = document.getElementById('sel-session');

  selExamen.addEventListener('change', () => {
    const examen = selExamen.value;
    // BEPC : masquer le sélecteur de série
    document.getElementById('groupe-serie').style.display = examen === 'BEPC' ? 'none' : '';
    notes = {};
    rendreMatieres();
  });

  selSerie.addEventListener('change', () => { notes = {}; rendreMatieres(); });
  selSession.addEventListener('change', calculer);
}

/* ============================================================
   RENDU DES MATIÈRES
   ============================================================ */

function rendreMatieres() {
  const cfg    = getConfig();
  const liste  = document.getElementById('matieres-liste');
  const titre  = document.getElementById('card-titre');
  const sous   = document.getElementById('card-sous-titre');

  if (!cfg) { liste.innerHTML = ''; return; }

  const totalCoefs = cfg.matieres.reduce((s, m) => s + m.coef, 0);
  titre.textContent = cfg.label;
  sous.textContent  = `${cfg.matieres.length} matières · Total coefficients : ${totalCoefs}`;

  liste.innerHTML = cfg.matieres.map(m => `
    <div class="matiere-row${m.eliminatoire ? ' matiere-row--eliminatoire' : ''}" id="row-${slug(m.nom)}">
      <div class="matiere-nom">
        ${m.nom}
        ${m.eliminatoire ? '<small>⚠️ Matière éliminatoire (< 5 = éliminé)</small>' : ''}
      </div>
      <div class="matiere-coef">${m.coef}</div>
      <input
        type="number" min="0" max="20" step="0.25"
        class="matiere-input"
        id="note-${slug(m.nom)}"
        placeholder="—"
        value="${notes[m.nom] !== undefined ? notes[m.nom] : ''}"
        data-matiere="${m.nom}"
        data-coef="${m.coef}"
        data-eliminatoire="${m.eliminatoire}"
        oninput="window._simNoteChange(this)"
      />
      <div class="matiere-points" id="pts-${slug(m.nom)}">—</div>
    </div>
  `).join('');

  // Recalculer si on avait des notes
  if (Object.keys(notes).length) calculer();
  else reinitResultat();
}

function slug(s) { return s.replace(/[^a-zA-Z0-9]/g, '_'); }

/* ============================================================
   CHANGEMENT DE NOTE
   ============================================================ */

window._simNoteChange = function(input) {
  const nom  = input.dataset.matiere;
  let   val  = parseFloat(input.value);

  // Bornes
  if (isNaN(val)) { delete notes[nom]; }
  else {
    val = Math.max(0, Math.min(20, val));
    input.value = val;
    notes[nom]  = val;
  }

  // Couleur de l'input
  input.classList.remove('note-faible','note-moyenne','note-bonne');
  if (!isNaN(val)) {
    if (val < 8)       input.classList.add('note-faible');
    else if (val < 12) input.classList.add('note-moyenne');
    else               input.classList.add('note-bonne');
  }

  // Mettre à jour les points
  const coef = parseInt(input.dataset.coef);
  const ptsEl = document.getElementById('pts-' + slug(nom));
  if (ptsEl) ptsEl.textContent = isNaN(val) ? '—' : (val * coef).toFixed(2);

  calculer();
};

/* ============================================================
   CALCUL
   ============================================================ */

function calculer() {
  const cfg = getConfig();
  if (!cfg) return;

  const notesRenseignees = cfg.matieres.filter(m => notes[m.nom] !== undefined);
  if (!notesRenseignees.length) { reinitResultat(); return; }

  // Vérification éliminatoire
  const eliminatoires = cfg.matieres.filter(m => m.eliminatoire && notes[m.nom] !== undefined && notes[m.nom] < 5);

  let totalPoints = 0;
  let totalCoefs  = 0;
  cfg.matieres.forEach(m => {
    if (notes[m.nom] !== undefined) {
      totalPoints += notes[m.nom] * m.coef;
      totalCoefs  += m.coef;
    }
  });

  const saisieComplete = notesRenseignees.length === cfg.matieres.length;
  const moyenne        = totalCoefs > 0 ? totalPoints / totalCoefs : 0;

  // Verdict
  let verdict, mention, emoji, classe;

  if (eliminatoires.length > 0 && saisieComplete) {
    verdict = 'Éliminé(e)';
    mention = `Note éliminatoire en ${eliminatoires.map(m => m.nom).join(', ')}`;
    emoji   = '❌';
    classe  = 'resultat-card--refusé';
  } else if (saisieComplete) {
    if (moyenne >= 10) {
      if      (moyenne >= 16) { mention = 'Très Bien';   emoji = '🏆'; }
      else if (moyenne >= 14) { mention = 'Bien';         emoji = '🥇'; }
      else if (moyenne >= 12) { mention = 'Assez Bien';  emoji = '🎉'; }
      else                    { mention = 'Passable';     emoji = '✅'; }
      verdict = 'Admis(e)';
      classe  = 'resultat-card--admis';
    } else {
      verdict = 'Refusé(e)';
      mention = 'Moyenne insuffisante';
      emoji   = '😔';
      classe  = 'resultat-card--refusé';
    }
  } else {
    // Partiel
    if (eliminatoires.length > 0) {
      verdict = 'Note éliminatoire !';
      mention = `${eliminatoires.map(m => m.nom).join(', ')} < 5`;
      emoji   = '⚠️';
      classe  = 'resultat-card--ajourné';
    } else if (moyenne >= 10) {
      verdict = 'En bonne voie';
      mention = `${notesRenseignees.length}/${cfg.matieres.length} matières saisies`;
      emoji   = '📈';
      classe  = 'resultat-card--admis';
    } else {
      verdict = 'À améliorer';
      mention = `${notesRenseignees.length}/${cfg.matieres.length} matières saisies`;
      emoji   = '📉';
      classe  = 'resultat-card--ajourné';
    }
  }

  // Afficher
  const card = document.getElementById('resultat-card');
  card.className = `resultat-card ${classe}`;
  document.getElementById('res-emoji').textContent   = emoji;
  document.getElementById('res-moyenne').textContent = moyenne.toFixed(2) + ' / 20';
  document.getElementById('res-mention').textContent = saisieComplete ? `${verdict} — ${mention}` : verdict;
  document.getElementById('res-detail').textContent  = saisieComplete
    ? `Total : ${totalPoints.toFixed(2)} pts / ${cfg.matieres.reduce((s,m)=>s+m.coef,0)*20}`
    : mention;

  // Partage (seulement si complet)
  document.getElementById('partage-zone').style.display = saisieComplete ? 'flex' : 'none';
  if (saisieComplete) initPartage(moyenne, verdict, mention, cfg.label);

  // Alertes matières à risque
  afficherAlertes(cfg);
}

function reinitResultat() {
  const card = document.getElementById('resultat-card');
  card.className = 'resultat-card resultat-card--vide';
  document.getElementById('res-emoji').textContent   = '📝';
  document.getElementById('res-moyenne').textContent = '—';
  document.getElementById('res-mention').textContent = 'Entrez vos notes ci-dessous';
  document.getElementById('res-detail').textContent  = '';
  document.getElementById('partage-zone').style.display = 'none';
  document.getElementById('alertes-zone').style.display = 'none';
}

/* ============================================================
   ALERTES
   ============================================================ */

function afficherAlertes(cfg) {
  const alertes = [];
  cfg.matieres.forEach(m => {
    if (notes[m.nom] === undefined) return;
    if (m.eliminatoire && notes[m.nom] < 5) {
      alertes.push({ type: 'danger', msg: `${m.nom} : ${notes[m.nom]}/20 — Note éliminatoire ! (coef. ${m.coef})` });
    } else if (notes[m.nom] < 8 && m.coef >= 3) {
      alertes.push({ type: 'warning', msg: `${m.nom} : ${notes[m.nom]}/20 — Matière à fort coefficient (coef. ${m.coef}), à travailler en priorité.` });
    }
  });

  const zone = document.getElementById('alertes-zone');
  const liste = document.getElementById('alertes-liste');
  if (!alertes.length) { zone.style.display = 'none'; return; }
  zone.style.display = 'block';
  liste.innerHTML = alertes.map(a => `
    <div class="alerte-item alerte-item--${a.type}">
      ${a.type === 'danger' ? '🚨' : '⚠️'} ${a.msg}
    </div>`).join('');
}

/* ============================================================
   PARTAGE
   ============================================================ */

function initPartage(moyenne, verdict, mention, label) {
  const examen = document.getElementById('sel-examen').value;
  const serie  = document.getElementById('sel-serie').value;
  const serieLabel = examen === 'BEPC' ? '' : ` Série ${serie}`;

  const texte = `📊 Mon résultat ${examen}${serieLabel} sur Kalamundi :\n`
    + `🎯 Moyenne : ${moyenne.toFixed(2)}/20\n`
    + `${verdict} — ${mention}\n\n`
    + `Calcule ta moyenne : https://kalamundi.pages.dev/pages/simulateur.html`;

  document.getElementById('btn-whatsapp').onclick = () => {
    window.open('https://wa.me/?text=' + encodeURIComponent(texte), '_blank');
  };

  document.getElementById('btn-copier').onclick = async () => {
    try {
      await navigator.clipboard.writeText(texte);
      const btn = document.getElementById('btn-copier');
      btn.textContent = '✅ Copié !';
      setTimeout(() => { btn.textContent = '📋 Copier le résultat'; }, 2000);
    } catch { alert(texte); }
  };
}

/* ============================================================
   HELPER
   ============================================================ */

function getConfig() {
  const examen = document.getElementById('sel-examen').value;
  const serie  = document.getElementById('sel-serie').value;
  if (examen === 'BEPC') return CONFIGS.BEPC?._ || null;
  return CONFIGS[examen]?.[serie] || null;
}
