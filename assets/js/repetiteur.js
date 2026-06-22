/* ============================================================
   repetiteur.js — Super Répétiteur Kalamundi
   F1 : Programme d'étude + planning
   F2 : Lanceur de simulations par matière
   F3 : Tableau de résultats + progression
   ============================================================ */

import { supabase, getUser } from './auth.js';
import { toast, toastSucces, toastErreur } from './utils.js';

/* ── Matières + coefficients par série (pour la config) ────── */
const SERIES_CONFIG = {
  BAC: {
    C:  ['Mathématiques','Physique-Chimie','SVT','Français','Philosophie','Anglais','Histoire-Géographie'],
    D:  ['SVT','Chimie','Physique','Mathématiques','Français','Philosophie','Anglais','Histoire-Géographie'],
    A:  ['Français','Philosophie','Histoire-Géographie','Anglais','Mathématiques'],
    A4: ['Français','Anglais','Philosophie','Histoire-Géographie','Latin','Mathématiques'],
    B:  ['Économie','Comptabilité','Mathématiques','Droit','Français','Histoire-Géographie','Anglais'],
    G1: ['Comptabilité','Économie-Droit','Mathématiques','Informatique','Français','Anglais'],
    G2: ['Techniques Commerciales','Marketing','Économie','Mathématiques','Français','Anglais'],
    G3: ['Bureautique','Correspondance','Sténo-Dactylo','Économie-Droit','Français','Anglais'],
    E:  ['Mathématiques','Sciences Industrielles','Physique-Chimie','Français','Anglais'],
    F:  ['Technologie','Mathématiques','Physique-Chimie','Français','Anglais'],
  },
  Probatoire: {
    C:  ['Mathématiques','Physique-Chimie','SVT','Français','Philosophie','Anglais','Histoire-Géographie'],
    D:  ['SVT','Chimie','Physique','Mathématiques','Français','Philosophie','Anglais','Histoire-Géographie'],
    A:  ['Français','Philosophie','Histoire-Géographie','Anglais','Mathématiques'],
    A4: ['Français','Anglais','Philosophie','Histoire-Géographie','Mathématiques'],
    B:  ['Économie','Comptabilité','Mathématiques','Droit','Français','Anglais'],
    G1: ['Comptabilité','Économie-Droit','Mathématiques','Français','Anglais'],
    G2: ['Techniques Commerciales','Marketing','Économie','Mathématiques','Français'],
    G3: ['Bureautique','Correspondance','Sténo-Dactylo','Français'],
  },
  BEPC: {
    _: ['Mathématiques','Français','Anglais','Sciences Physiques','SVT','Histoire-Géographie','Économie de Marché'],
  },
};

const COEFS = {
  BAC: {
    C:  { 'Mathématiques':7,'Physique-Chimie':6,'SVT':2,'Français':3,'Philosophie':2,'Anglais':2,'Histoire-Géographie':2,'EPS':1 },
    D:  { 'SVT':6,'Chimie':4,'Physique':3,'Mathématiques':4,'Français':3,'Philosophie':2,'Anglais':2,'Histoire-Géographie':2,'EPS':1 },
    A:  { 'Français':5,'Philosophie':4,'Histoire-Géographie':4,'Anglais':3,'Mathématiques':2,'EPS':1 },
    A4: { 'Français':4,'Anglais':4,'Philosophie':4,'Histoire-Géographie':3,'Latin':2,'Mathématiques':2,'EPS':1 },
    B:  { 'Économie':5,'Comptabilité':4,'Mathématiques':4,'Droit':3,'Français':3,'Histoire-Géographie':2,'Anglais':2,'EPS':1 },
    G1: { 'Comptabilité':6,'Économie-Droit':4,'Mathématiques':3,'Informatique':2,'Français':2,'Anglais':1,'EPS':1 },
    G2: { 'Techniques Commerciales':5,'Marketing':4,'Économie':3,'Mathématiques':2,'Français':2,'Anglais':1,'EPS':1 },
    G3: { 'Bureautique':5,'Correspondance':4,'Sténo-Dactylo':3,'Économie-Droit':2,'Français':2,'Anglais':1,'EPS':1 },
    E:  { 'Mathématiques':6,'Sciences Industrielles':6,'Physique-Chimie':4,'Français':2,'Anglais':1,'EPS':1 },
    F:  { 'Technologie':6,'Mathématiques':4,'Physique-Chimie':4,'Français':2,'Anglais':1,'EPS':1 },
  },
  BEPC: { _: { 'Mathématiques':4,'Français':4,'Anglais':3,'Sciences Physiques':3,'SVT':3,'Histoire-Géographie':3,'Économie de Marché':2,'EPS':1 } },
};

const THEMES = {
  'Mathématiques':       ['Fonctions et dérivées','Limites','Suites numériques','Probabilités','Géométrie','Complexes','Intégrales'],
  'Physique-Chimie':     ['Mécanique','Électricité','Optique','Chimie des solutions'],
  'Physique':            ['Mécanique','Électricité','Optique','Thermodynamique'],
  'Chimie':              ['Solutions aqueuses','Réactions chimiques','Chimie organique'],
  'SVT':                 ['Génétique','Immunologie','Écologie','Physiologie'],
  'Sciences Physiques':  ['Mécanique','Électricité','Optique'],
  'Français':            ['Grammaire','Expression écrite','Compréhension','Littérature'],
  'Philosophie':         ['Connaissance','Morale','Politique','Existence'],
  'Anglais':             ['Grammar','Vocabulary','Reading','Expression'],
  'Histoire-Géographie': ['Histoire contemporaine','Géopolitique','Géographie'],
  'Économie':            ['Marchés','Macroéconomie','Monnaie','Commerce international'],
  'Économie de Marché':  ['Marchés','Consommation','Production'],
  'Comptabilité':        ['Bilan','Compte de résultat','Opérations courantes'],
  'Économie-Droit':      ['Économie','Droit des contrats','Droit commercial'],
  'Techniques Commerciales': ['Vente','Négociation','Gestion commerciale'],
  'Marketing':           ['Étude de marché','Mix marketing','Communication'],
  'Informatique':        ['Algorithmique','Tableur','Base de données'],
  'Bureautique':         ['Traitement de texte','Tableur','Présentation'],
  'Correspondance':      ['Lettre commerciale','Rapport','Note de service'],
  'Sténo-Dactylo':       ['Sténographie','Dactylographie','Vitesse frappe'],
  'Sciences Industrielles': ['Mécanique industrielle','Électrotechnique'],
  'Technologie':         ['Dessin technique','Mécanique','Électrotechnique'],
  'Latin':               ['Grammaire latine','Traduction','Civilisation'],
  'Droit':               ['Droit des contrats','Droit commercial','Droit du travail'],
};

const MATIERE_ICONS = {
  'Mathématiques':'📐','Physique-Chimie':'⚗️','Physique':'⚡','Chimie':'🧪',
  'SVT':'🧬','Sciences Physiques':'⚡','Français':'📖','Philosophie':'🧠',
  'Anglais':'🇬🇧','Histoire-Géographie':'🌍','Économie':'📈','Comptabilité':'🧾',
  'Économie-Droit':'⚖️','Économie de Marché':'📊','Techniques Commerciales':'🤝',
  'Marketing':'📣','Informatique':'💻','Bureautique':'🖥️','Correspondance':'✉️',
  'Sténo-Dactylo':'⌨️','Sciences Industrielles':'🔧','Technologie':'🔩',
  'Latin':'🏛️','Droit':'⚖️','Latin':'🏛️',
};

/* ── État ───────────────────────────────────────────────────── */
let utilisateur = null;
let programme   = null;  // données Supabase
let resultats   = [];

/* ── Init ───────────────────────────────────────────────────── */
export async function init() {
  initNavbar();
  utilisateur = await getUser();

  if (!utilisateur) {
    document.getElementById('zone-non-connecte').style.display = 'block';
    return;
  }
  document.getElementById('zone-connecte').style.display = 'block';

  initOnglets();
  await Promise.all([chargerProgramme(), chargerResultats()]);
  rendreOngletActif('programme');
}
if (!document.body?.classList.contains('edu-hub')) {
  document.addEventListener('DOMContentLoaded', init);
}

/* ── Navbar ─────────────────────────────────────────────────── */
function initNavbar() {
  const toggle = document.getElementById('nav-toggle');
  const menu   = document.getElementById('nav-menu');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
  const actions = document.getElementById('navbar-actions');
  if (!actions) return;
  actions.innerHTML = `<a href="/pages/author-dashboard.html" class="btn btn--ghost btn--sm">Mon espace</a>`;
}

/* ── Onglets ────────────────────────────────────────────────── */
function initOnglets() {
  document.querySelectorAll('.rep-tab[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rep-tab').forEach(b => b.classList.remove('rep-tab--active'));
      document.querySelectorAll('.rep-panel').forEach(p => p.classList.remove('rep-panel--active'));
      btn.classList.add('rep-tab--active');
      document.getElementById('panel-' + btn.dataset.panel).classList.add('rep-panel--active');
      rendreOngletActif(btn.dataset.panel);
    });
  });
}

function rendreOngletActif(panel) {
  if (panel === 'programme')  rendreProgramme();
  if (panel === 'simulateur') rendreSimulateur();
  if (panel === 'resultats')  rendreResultats();
}

/* ── Charger le programme ───────────────────────────────────── */
async function chargerProgramme() {
  const { data } = await supabase
    .from('programmes_etude')
    .select('*')
    .eq('user_id', utilisateur.id)
    .eq('actif', true)
    .maybeSingle();
  programme = data || null;
}

async function chargerResultats() {
  const { data } = await supabase
    .from('resultats_sim')
    .select('*')
    .eq('user_id', utilisateur.id)
    .order('created_at', { ascending: false })
    .limit(50);
  resultats = data || [];
}

/* ============================================================
   F1 — PROGRAMME D'ÉTUDE
   ============================================================ */

function rendreProgramme() {
  const zone = document.getElementById('zone-programme');
  if (programme) {
    zone.innerHTML = rendreDashboardProgramme();
    initDashboardEvents();
  } else {
    zone.innerHTML = rendreFormulaireConfig();
    initFormulaireEvents();
  }
}

/* ── Formulaire de configuration ────────────────────────────── */
function rendreFormulaireConfig() {
  return `
    <div class="config-card">
      <h2>📅 Créez votre programme d'étude</h2>
      <p style="color:var(--text-secondary);margin-bottom:var(--spacing-lg);font-size:var(--font-size-sm)">
        Je génère un planning semaine par semaine jusqu'à votre examen, adapté à votre niveau actuel dans chaque matière.
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md)">
        <div class="form-group">
          <label>Examen</label>
          <select id="cfg-examen">
            <option value="BAC">BAC</option>
            <option value="Probatoire">Probatoire</option>
            <option value="BEPC">BEPC</option>
          </select>
        </div>
        <div class="form-group" id="cfg-groupe-serie">
          <label>Série</label>
          <select id="cfg-serie">
            <option value="C">Série C</option>
            <option value="D">Série D</option>
            <option value="A">Série A</option>
            <option value="A4">Série A4</option>
            <option value="B">Série B</option>
            <option value="G1">Série G1</option>
            <option value="G2">Série G2</option>
            <option value="G3">Série G3</option>
            <option value="E">Série E</option>
            <option value="F">Série F</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Date de l'examen</label>
        <input type="date" id="cfg-date" min="${new Date().toISOString().split('T')[0]}" />
      </div>

      <div class="form-group">
        <label>Votre niveau actuel par matière</label>
        <p style="font-size:11px;color:var(--text-secondary);margin-bottom:var(--spacing-sm)">
          ⭐ = Très faible &nbsp;|&nbsp; ⭐⭐⭐ = Moyen &nbsp;|&nbsp; ⭐⭐⭐⭐⭐ = Maîtrisé
        </p>
        <div class="niveaux-grid" id="cfg-niveaux"></div>
      </div>

      <button class="btn btn--accent btn--lg" style="width:100%;margin-top:var(--spacing-md)" id="btn-creer-programme">
        🚀 Générer mon programme
      </button>
    </div>`;
}

function initFormulaireEvents() {
  const selExamen = document.getElementById('cfg-examen');
  const selSerie  = document.getElementById('cfg-serie');

  selExamen.addEventListener('change', () => {
    document.getElementById('cfg-groupe-serie').style.display =
      selExamen.value === 'BEPC' ? 'none' : '';
    rendreNiveaux();
  });
  selSerie.addEventListener('change', rendreNiveaux);
  rendreNiveaux();

  // Pré-remplir date (ex: dans 30 jours)
  const d = new Date(); d.setDate(d.getDate() + 30);
  document.getElementById('cfg-date').value = d.toISOString().split('T')[0];

  document.getElementById('btn-creer-programme').addEventListener('click', creerProgramme);
}

function rendreNiveaux() {
  const examen = document.getElementById('cfg-examen').value;
  const serie  = examen === 'BEPC' ? '_' : document.getElementById('cfg-serie').value;
  const mats   = SERIES_CONFIG[examen]?.[serie] || [];
  const zone   = document.getElementById('cfg-niveaux');

  zone.innerHTML = mats.map(m => `
    <div class="niveau-item">
      <label>${MATIERE_ICONS[m] || '📚'} ${m}</label>
      <div class="niveau-stars" data-matiere="${m}">
        ${[1,2,3,4,5].map(i => `
          <button class="niveau-star" data-val="${i}" onclick="window._setNiveau('${m}',${i})">★</button>
        `).join('')}
      </div>
    </div>`).join('');

  // Activer par défaut niveau 2 pour chaque matière
  mats.forEach(m => window._setNiveau(m, 2));
}

window._setNiveau = function(matiere, val) {
  const stars = document.querySelectorAll(`.niveau-stars[data-matiere="${matiere}"] .niveau-star`);
  stars.forEach((s, i) => s.classList.toggle('active', i < val));
  stars.forEach(s => { if (parseInt(s.dataset.val) === val) s.closest('.niveau-stars').dataset.niveau = val; });
};

function getNiveaux() {
  const result = {};
  document.querySelectorAll('.niveau-stars[data-matiere]').forEach(div => {
    result[div.dataset.matiere] = parseInt(div.dataset.niveau) || 2;
  });
  return result;
}

async function creerProgramme() {
  const examen    = document.getElementById('cfg-examen').value;
  const serie     = examen === 'BEPC' ? '_' : document.getElementById('cfg-serie').value;
  const dateExam  = document.getElementById('cfg-date').value;
  const niveaux   = getNiveaux();

  if (!dateExam) { toast('Choisissez la date de l\'examen.', 'erreur'); return; }

  const planning = genererPlanning(examen, serie, dateExam, niveaux);
  if (!planning.length) { toast('La date est trop proche. Choisissez au moins 7 jours.', 'erreur'); return; }

  const btn = document.getElementById('btn-creer-programme');
  btn.disabled = true; btn.textContent = 'Génération…';

  const { error } = await supabase.from('programmes_etude').upsert({
    user_id:     utilisateur.id,
    examen,
    serie:       serie === '_' ? null : serie,
    date_examen: dateExam,
    niveaux,
    planning,
    actif:       true,
    updated_at:  new Date().toISOString(),
  }, { onConflict: 'user_id' });

  btn.disabled = false; btn.textContent = '🚀 Générer mon programme';

  if (error) { toastErreur('Erreur : ' + error.message); return; }

  await chargerProgramme();
  toastSucces('Programme créé ! Bonne révision 🎓');
  rendreProgramme();
}

/* ── Génération du planning ─────────────────────────────────── */
function genererPlanning(examen, serie, dateExamen, niveaux) {
  const coefs  = COEFS[examen]?.[serie] || COEFS.BEPC?.['_'] || {};
  const mats   = SERIES_CONFIG[examen]?.[serie] || [];
  const today  = new Date(); today.setHours(0,0,0,0);
  const fin    = new Date(dateExamen); fin.setHours(0,0,0,0);
  const jours  = Math.floor((fin - today) / 86400000);
  if (jours < 7) return [];

  // Priorité : coef × (6 − niveau)
  const priorites = mats.map(m => ({
    nom: m, coef: coefs[m] || 1,
    niveau: niveaux[m] || 3,
    prio: (coefs[m] || 1) * (6 - (niveaux[m] || 3)),
  }));
  const totalPrio = priorites.reduce((s, m) => s + m.prio, 0);

  // Sessions disponibles (6 jours/semaine, 1 session/jour)
  const nbSemaines = Math.floor(jours / 7);
  const sessTotal  = nbSemaines * 6;

  // File de sessions (matières × themes, proportionnelle à la priorité)
  const file = [];
  priorites.forEach(m => {
    const nb = Math.max(1, Math.round(m.prio / totalPrio * sessTotal));
    const themes = THEMES[m.nom] || ['Révision générale'];
    for (let i = 0; i < nb; i++) {
      file.push({ matiere: m.nom, theme: themes[i % themes.length] });
    }
  });

  // Interleave : alterner les matières pour varier
  const interleaved = interleave(file);

  // Distribuer en semaines
  const JOURS_NOMS = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const semaines   = [];
  let start = new Date(today);
  // Aller au prochain lundi
  const dow = start.getDay();
  if (dow !== 1) start.setDate(start.getDate() + (dow === 0 ? 1 : 8 - dow));

  let idx = 0;
  for (let s = 0; s < nbSemaines && idx < interleaved.length; s++) {
    const debut = new Date(start);
    debut.setDate(start.getDate() + s * 7);
    const fin2  = new Date(debut); fin2.setDate(debut.getDate() + 6);
    const sem   = { numero: s + 1, du: fmtDate(debut), au: fmtDate(fin2), sessions: [] };

    for (let j = 0; j < 6 && idx < interleaved.length; j++) {
      const d = new Date(debut); d.setDate(debut.getDate() + j);
      if (d >= fin) break;
      sem.sessions.push({
        id:      `s${s}_j${j}`,
        jour:    JOURS_NOMS[j],
        date:    fmtDate(d),
        matiere: interleaved[idx].matiere,
        theme:   interleaved[idx].theme,
        duree:   2,
        done:    false,
      });
      idx++;
    }
    if (sem.sessions.length) semaines.push(sem);
  }
  return semaines;
}

function interleave(arr) {
  // Trier par matière et alterner pour éviter les répétitions
  const grouped = {};
  arr.forEach(s => { (grouped[s.matiere] = grouped[s.matiere] || []).push(s); });
  const groups = Object.values(grouped);
  const out = [];
  let changed = true;
  while (changed) {
    changed = false;
    groups.forEach(g => { if (g.length) { out.push(g.shift()); changed = true; } });
  }
  return out;
}

function fmtDate(d) { return d.toISOString().split('T')[0]; }

function fmtDateFR(s) {
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day:'numeric', month:'long' });
}

/* ── Dashboard programme ────────────────────────────────────── */
function rendreDashboardProgramme() {
  const { examen, serie, date_examen, niveaux, planning } = programme;
  const fin = new Date(date_examen + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  const joursRestants = Math.ceil((fin - now) / 86400000);

  const totalSessions = planning.reduce((s, sem) => s + sem.sessions.length, 0);
  const doneSessions  = planning.reduce((s, sem) => s + sem.sessions.filter(x => x.done).length, 0);
  const pctGlobal     = totalSessions ? Math.round(doneSessions / totalSessions * 100) : 0;

  const semaineAujourdhui = planning.find(sem =>
    sem.sessions.some(s => s.date === fmtDate(now))
  );

  return `
    <div style="margin-bottom:var(--spacing-xl)">
      <div class="planning-header">
        <div>
          <h2 style="margin:0">${examen}${serie && serie !== '_' ? ' · Série ' + serie : ''}</h2>
          <div style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-top:4px">
            📅 Examen le ${fmtDateFR(date_examen)} ·
            ${joursRestants > 0 ? `<strong style="color:var(--color-primary)">${joursRestants} jours</strong> restants` : '<strong style="color:var(--color-error)">L\'examen est passé</strong>'}
          </div>
        </div>
        <button class="btn btn--ghost btn--sm" id="btn-reset-programme">↺ Refaire le programme</button>
      </div>

      <!-- Barre de progression globale -->
      <div style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--radius-lg);padding:var(--spacing-lg);margin-bottom:var(--spacing-xl)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--spacing-sm)">
          <span style="font-weight:700">Progression globale</span>
          <span style="font-weight:700;color:var(--color-primary)">${pctGlobal}%</span>
        </div>
        <div style="height:10px;background:var(--border-color);border-radius:5px;overflow:hidden">
          <div style="width:${pctGlobal}%;height:100%;background:var(--color-primary);border-radius:5px;transition:width .5s"></div>
        </div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:6px">${doneSessions} / ${totalSessions} sessions complétées</div>
      </div>

      ${semaineAujourdhui ? `
        <div style="background:linear-gradient(90deg,#1a3a5c15,#1B433215);border:1px solid var(--color-primary);border-radius:var(--radius-lg);padding:var(--spacing-md) var(--spacing-lg);margin-bottom:var(--spacing-xl)">
          <div style="font-weight:700;color:var(--color-primary);margin-bottom:var(--spacing-sm)">📍 Aujourd'hui</div>
          ${semaineAujourdhui.sessions.filter(s => s.date === fmtDate(now)).map(s => `
            <div style="display:flex;align-items:center;gap:var(--spacing-md)">
              <span style="font-size:1.4rem">${MATIERE_ICONS[s.matiere] || '📚'}</span>
              <div>
                <div style="font-weight:700">${s.matiere}</div>
                <div style="font-size:12px;color:var(--text-secondary)">${s.theme} · ${s.duree}h</div>
              </div>
              <a href="/pages/examen-sim.html?matiere=${encodeURIComponent(s.matiere)}&examen=${examen}&serie=${serie || ''}"
                 class="btn btn--accent btn--sm" style="margin-left:auto">🎯 Réviser</a>
            </div>`).join('')}
        </div>` : ''}

      <!-- Planning semaines -->
      <div id="planning-semaines">
        ${planning.map((sem, si) => rendreSemaine(sem, si)).join('')}
      </div>
    </div>`;
}

function rendreSemaine(sem, si) {
  const doneSem = sem.sessions.filter(s => s.done).length;
  const isCurrentWeek = sem.sessions.some(s => s.date === fmtDate(new Date()));
  return `
    <div class="semaine-card${isCurrentWeek ? '' : ' semaine-collapsed'}" id="sem-${si}">
      <div class="semaine-header" onclick="window._toggleSemaine(${si})">
        <h3>Semaine ${sem.numero} · ${fmtDateFR(sem.du)} → ${fmtDateFR(sem.au)}</h3>
        <span style="font-size:12px;opacity:.8">${doneSem}/${sem.sessions.length} ✓</span>
      </div>
      <div class="semaine-body">
        ${sem.sessions.map((sess, ji) => `
          <div class="session-row${sess.done ? ' done' : ''}" id="sess-${si}-${ji}">
            <div class="session-jour">${sess.jour}</div>
            <div class="session-info">
              <div class="session-mat">${MATIERE_ICONS[sess.matiere] || '📚'} ${sess.matiere}</div>
              <div class="session-theme">${sess.theme}</div>
            </div>
            <div class="session-duree">⏱ ${sess.duree}h</div>
            <button class="session-check${sess.done ? ' checked' : ''}"
              onclick="window._toggleSession(${si},${ji})"
              title="${sess.done ? 'Marquer non fait' : 'Marquer comme fait'}">
              ${sess.done ? '✓' : ''}
            </button>
          </div>`).join('')}
      </div>
    </div>`;
}

function initDashboardEvents() {
  document.getElementById('btn-reset-programme')?.addEventListener('click', async () => {
    if (!confirm('Supprimer le programme actuel et en créer un nouveau ?')) return;
    await supabase.from('programmes_etude').delete().eq('user_id', utilisateur.id);
    programme = null;
    rendreProgramme();
  });
}

window._toggleSemaine = function(si) {
  document.getElementById('sem-' + si)?.classList.toggle('semaine-collapsed');
};

window._toggleSession = async function(si, ji) {
  if (!programme) return;
  programme.planning[si].sessions[ji].done = !programme.planning[si].sessions[ji].done;
  // Mettre à jour Supabase en arrière-plan
  supabase.from('programmes_etude')
    .update({ planning: programme.planning, updated_at: new Date().toISOString() })
    .eq('user_id', utilisateur.id)
    .then(() => {});
  // Mettre à jour le DOM immédiatement
  const sess = programme.planning[si].sessions[ji];
  const row  = document.getElementById(`sess-${si}-${ji}`);
  const btn  = row?.querySelector('.session-check');
  if (row)  row.classList.toggle('done', sess.done);
  if (btn)  { btn.classList.toggle('checked', sess.done); btn.textContent = sess.done ? '✓' : ''; }
};

/* ============================================================
   F2 — SIMULATEUR (lanceur)
   ============================================================ */

function rendreSimulateur() {
  const zone = document.getElementById('zone-simulateur');

  if (!programme) {
    /* Mode libre — accessible à tous, y compris étudiants universitaires */
    zone.innerHTML = rendreSimulateurLibre();
    initSimulateurLibreEvents();
    return;
  }

  const { examen, serie } = programme;
  const serie2 = serie || '_';
  const mats   = SERIES_CONFIG[examen]?.[serie2] || [];

  // Scores moyens par matière depuis les résultats
  const scores = {};
  resultats.forEach(r => {
    if (!scores[r.matiere]) scores[r.matiere] = [];
    scores[r.matiere].push(r.score);
  });
  const moyennes = {};
  Object.entries(scores).forEach(([m, arr]) => {
    moyennes[m] = Math.round(arr.reduce((a,b) => a+b,0) / arr.length);
  });

  zone.innerHTML = `
    <h2 style="margin-bottom:var(--spacing-lg)">Choisissez une matière à simuler</h2>
    <div class="sim-grid">
      ${mats.map(m => {
        const moy = moyennes[m];
        const couleur = moy == null ? 'var(--text-secondary)' : moy >= 70 ? '#2e7d32' : moy >= 50 ? '#f57c00' : '#b71c1c';
        const nbSim = scores[m]?.length || 0;
        return `
          <div class="sim-matiere-card">
            <div class="sim-matiere-card__icon">${MATIERE_ICONS[m] || '📚'}</div>
            <div class="sim-matiere-card__nom">${m}</div>
            <div class="sim-matiere-card__score" style="color:${couleur}">
              ${moy != null ? `Dernier score : ${moy}%` : 'Jamais simulé'}
              ${nbSim ? ` · ${nbSim} sim.` : ''}
            </div>
            <div class="sim-matiere-card__btn">
              <a href="/pages/examen-sim.html?matiere=${encodeURIComponent(m)}&examen=${examen}&serie=${serie || ''}"
                 class="btn btn--accent btn--sm" style="width:100%;text-align:center">
                🎯 Lancer l'examen
              </a>
            </div>
          </div>`;
      }).join('')}
    </div>`;
}

/* ============================================================
   F3 — RÉSULTATS + PROGRESSION
   ============================================================ */

function rendreResultats() {
  const zone = document.getElementById('zone-resultats');

  if (!resultats.length) {
    zone.innerHTML = `<div class="vide">
      <div class="vide__icon">📊</div>
      <h3>Aucun résultat pour l'instant</h3>
      <p>Faites votre première simulation d'examen pour voir votre progression.</p>
      <button class="btn btn--accent" onclick="document.querySelector('[data-panel=simulateur]').click()">Aller au simulateur</button>
    </div>`;
    return;
  }

  // Calcul moyennes par matière
  const parMatiere = {};
  resultats.forEach(r => {
    if (!parMatiere[r.matiere]) parMatiere[r.matiere] = [];
    parMatiere[r.matiere].push(r);
  });

  const lignesProgress = Object.entries(parMatiere).map(([m, arr]) => {
    const moy = Math.round(arr.reduce((s, r) => s + r.score, 0) / arr.length);
    const couleur = moy >= 70 ? '#2e7d32' : moy >= 50 ? '#f57c00' : '#b71c1c';
    return `
      <div class="matiere-progress-row">
        <div class="matiere-progress-nom">${MATIERE_ICONS[m] || '📚'} ${m}</div>
        <div class="matiere-progress-bar">
          <div class="matiere-progress-fill" style="width:${moy}%;background:${couleur}"></div>
        </div>
        <div class="matiere-progress-pct" style="color:${couleur}">${moy}%</div>
      </div>`;
  }).join('');

  // Lacunes globales
  const toutesLacunes = {};
  resultats.forEach(r => {
    (r.lacunes || []).forEach(l => { toutesLacunes[l] = (toutesLacunes[l] || 0) + 1; });
  });
  const topLacunes = Object.entries(toutesLacunes)
    .sort((a,b) => b[1]-a[1]).slice(0,5);

  zone.innerHTML = `
    <!-- Progression par matière -->
    <div class="progress-global" style="margin-bottom:var(--spacing-xl)">
      <h3>📈 Score moyen par matière</h3>
      ${lignesProgress}
    </div>

    ${topLacunes.length ? `
    <!-- Lacunes identifiées -->
    <div style="background:var(--bg-card);border:1px solid var(--color-warning,#f57c00);border-radius:var(--radius-lg);padding:var(--spacing-lg);margin-bottom:var(--spacing-xl)">
      <h3 style="margin-bottom:var(--spacing-md)">⚠️ Thèmes à renforcer</h3>
      <div style="display:flex;flex-wrap:wrap;gap:var(--spacing-sm)">
        ${topLacunes.map(([t,n]) => `
          <span style="background:#fff3e0;color:#e65c00;padding:4px 12px;border-radius:20px;font-size:var(--font-size-sm);font-weight:600">
            ${t} (${n}× raté)
          </span>`).join('')}
      </div>
    </div>` : ''}

    <!-- Historique -->
    <h3 style="margin-bottom:var(--spacing-md)">🕒 Historique des simulations</h3>
    ${resultats.map(r => {
      const score = Math.round(r.score);
      const cls   = score >= 70 ? 'good' : score >= 50 ? 'avg' : 'bad';
      const date  = new Date(r.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
      return `
        <div class="res-item">
          <div class="res-score res-score--${cls}">${score}%</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700">${MATIERE_ICONS[r.matiere] || '📚'} ${r.matiere}</div>
            <div style="font-size:12px;color:var(--text-secondary)">${r.nb_correct}/${r.nb_questions} bonnes réponses · ${date}</div>
            ${r.lacunes?.length ? `<div style="font-size:11px;color:#e65c00;margin-top:2px">⚠️ Lacunes : ${r.lacunes.join(', ')}</div>` : ''}
          </div>
          <a href="/pages/examen-sim.html?matiere=${encodeURIComponent(r.matiere)}&examen=${r.examen||'BAC'}&serie=${r.serie||''}"
             class="btn btn--ghost btn--sm">↺ Refaire</a>
        </div>`;
    }).join('')}`;
}

/* ============================================================
   MODE LIBRE — Universite + BAC sans programme
   Accessible à tous (connectés ou non) depuis fax.html, epreuves.html
   ============================================================ */

/* Matières universitaires par catégorie */
const UNIV_MATIERES = {
  'Droit / Sciences Juridiques': [
    'Droit civil','Droit des obligations','Droit commercial','Droit des affaires',
    'Droit du travail','Droit constitutionnel','Droit administratif','Droit penal',
    'Droit OHADA','Droit international prive','Institutions judiciaires',
    'Droit des societes','Fiscalite','Procedure civile',
  ],
  'Medecine / Sante': [
    'Anatomie','Physiologie','Biochimie','Histologie-Embryologie',
    'Semiologie medicale','Pharmacologie','Pathologie generale','Microbiologie',
    'Parasitologie','Chirurgie generale','Gynecologie-Obstetrique',
    'Pediatrie','Medecine interne','Sante publique','PCEM1','PCEM2',
  ],
  'Sciences Exactes': [
    'Analyse mathematique','Algebre','Probabilites-Statistiques',
    'Mecanique classique','Electromagnetisme','Thermodynamique',
    'Chimie generale','Chimie organique','Optique','Informatique scientifique',
    'Physique quantique','Chimie analytique',
  ],
  'Economie / Gestion': [
    'Microeconomie','Macroeconomie','Comptabilite generale',
    'Comptabilite analytique','Finance d\'entreprise','Marketing',
    'Management','Statistiques economiques','Econometrie',
    'Gestion des ressources humaines','Commerce international',
    'Fiscalite des entreprises','Audit comptable',
  ],
  'Informatique / Technologie': [
    'Algorithmique','Programmation C','Programmation Java','Python',
    'Base de donnees','Reseaux informatiques','Systemes d\'exploitation',
    'Genie logiciel','Intelligence artificielle','Securite informatique',
    'Architecture des ordinateurs','Web development',
  ],
  'Lettres / Langues': [
    'Litterature francaise','Litterature africaine','Grammaire avancee',
    'Linguistique','Traduction francais-anglais','Anglais avance',
    'Civilisation americaine','Litterature anglophone','Stylistique',
    'Dissertation litteraire','Communication ecrite',
  ],
  'Sciences Humaines': [
    'Sociologie generale','Psychologie sociale','Histoire contemporaine',
    'Geographie humaine','Philosophie politique','Epistemologie',
    'Anthropologie','Demographie','Science politique','Relations internationales',
  ],
  'ENS / Sciences de l\'Education': [
    'Psychologie de l\'education','Pedagogie generale','Didactique',
    'Evaluation des apprentissages','Methodes de recherche en education',
    'Technologie educative','Mathematiques (ENSET)','Physique (ENS)',
    'Chimie (ENS)','SVT (ENS)','Francais (ENS)',
  ],
  'Concours Grandes Ecoles': [
    'Culture generale','Logique','Problemes economiques et sociaux',
    'Droit public','Finances publiques','Administration','Redaction administrative',
    'Anglais (concours)','Mathematiques (concours)','Physique (concours)',
  ],
  'Fonctions Publiques': [
    'Culture generale','Instruction civique','Droit administratif',
    'Logique et raisonnement','Mathematiques de base',
    'Biologie (Police/Gendarmerie)','Chimie (concours)','Physique (concours)',
    'Francais (concours)','Anglais (concours)','Aptitude physique (theorie)',
  ],
};

const UNIV_THEMES = {
  'Droit civil': ['Personnes','Famille','Biens','Obligations','Contrats','Responsabilite'],
  'Microeconomie': ['Offre et demande','Elasticites','Concurrence parfaite','Monopole','Jeux'],
  'Anatomie': ['Anatomie topographique','Squelette','Muscles','Systeme nerveux','Vaisseaux'],
  'Analyse mathematique': ['Suites','Limites','Derivees','Integrales','Series','Equations diff.'],
  'Algorithmique': ['Complexite','Tri','Graphes','Recursivite','Structures de donnees'],
  'Litterature francaise': ['Classicisme','Romantisme','Realisme','Existentialisme','Nouveau roman'],
  'Macroeconomie': ['PIB','Inflation','Chomage','Politique monetaire','Politique budgetaire'],
  'Physiologie': ['Systeme nerveux','Cardio-vasculaire','Respiratoire','Digestif','Endocrinien'],
};

function rendreSimulateurLibre() {
  const urlParams   = new URLSearchParams(location.search);
  const modeUniv    = urlParams.get('mode') === 'universite';
  const preMatiere  = urlParams.get('matiere') || '';
  const preFiliere  = urlParams.get('filiere') || '';
  const preCat      = urlParams.get('cat')     || '';

  /* Déterminer la catégorie initiale à afficher */
  let catInit = '';
  if (preCat) {
    const mapping = {
      droit_sciences_juridiques:    'Droit / Sciences Juridiques',
      medecine_sante:               'Medecine / Sante',
      sciences_exactes:             'Sciences Exactes',
      economie_gestion:             'Economie / Gestion',
      informatique_tech:            'Informatique / Technologie',
      lettres_langues:              'Lettres / Langues',
      sciences_humaines:            'Sciences Humaines',
      sciences_education:           'ENS / Sciences de l\'Education',
      concours_grandes_ecoles:      'Concours Grandes Ecoles',
      concours_fonctions_publiques: 'Fonctions Publiques',
    };
    catInit = mapping[preCat] || '';
  }

  const modeActif = modeUniv ? 'universite' : 'lycee';

  return `
    <div>
      <!-- Switcher Lycée / Université -->
      <div style="display:flex;gap:8px;margin-bottom:var(--spacing-lg)">
        <button class="btn${modeActif==='lycee'?' btn--accent':' btn--outline'}" id="btn-mode-lycee">
          BAC / Probatoire / BEPC
        </button>
        <button class="btn${modeActif==='universite'?' btn--accent':' btn--outline'}" id="btn-mode-univ">
          Universite & Grandes Ecoles
        </button>
      </div>

      <!-- === SECTION LYCÉE === -->
      <div id="section-lycee" style="display:${modeActif==='lycee'?'block':'none'}">
        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--spacing-md)">
          Choisis ton examen, ta serie et ta matiere pour une simulation immediate.
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--spacing-sm);margin-bottom:var(--spacing-md)">
          <div class="form-group" style="margin:0">
            <label style="font-size:12px">Examen</label>
            <select id="libre-examen" class="form-control" style="width:100%;padding:8px">
              <option value="BAC">BAC</option>
              <option value="Probatoire">Probatoire</option>
              <option value="BEPC">BEPC</option>
            </select>
          </div>
          <div class="form-group" style="margin:0" id="libre-groupe-serie">
            <label style="font-size:12px">Serie</label>
            <select id="libre-serie" class="form-control" style="width:100%;padding:8px">
              <option value="C">C</option><option value="D">D</option>
              <option value="A">A</option><option value="A4">A4</option>
              <option value="B">B</option><option value="G1">G1</option>
              <option value="G2">G2</option><option value="E">E</option>
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label style="font-size:12px">Matiere</label>
            <select id="libre-matiere" class="form-control" style="width:100%;padding:8px"></select>
          </div>
        </div>
        <button class="btn btn--accent" id="btn-libre-sim" style="width:100%">
          Lancer la simulation
        </button>
        <p style="font-size:11px;color:var(--text-secondary);margin-top:var(--spacing-sm)">
          Crée un programme d'étude pour que le Répétiteur adapte le planning a ton niveau.
          <button class="btn btn--ghost btn--sm" onclick="document.querySelector('[data-panel=programme]').click()">Créer mon programme</button>
        </p>
      </div>

      <!-- === SECTION UNIVERSITÉ === -->
      <div id="section-universite" style="display:${modeActif==='universite'?'block':'none'}">
        ${preMatiere ? `
          <div style="background:linear-gradient(90deg,#1B433215,#2D6A4F15);border:1px solid var(--color-primary);border-radius:var(--border-radius-md);padding:var(--spacing-md);margin-bottom:var(--spacing-md);display:flex;align-items:center;gap:var(--spacing-md)">
            <span style="font-size:1.5rem">📚</span>
            <div>
              <div style="font-weight:700">${preMatiere}</div>
              <div style="font-size:12px;color:var(--text-secondary)">${preFiliere}</div>
            </div>
            <a href="/pages/examen-sim.html?matiere=${encodeURIComponent(preMatiere)}&mode=universite"
               class="btn btn--accent btn--sm" style="margin-left:auto">
              Simuler cette matiere
            </a>
          </div>` : ''}

        <p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-bottom:var(--spacing-md)">
          Choisis ta filiere et ta matiere pour une simulation avec questions generees par l'IA.
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:var(--spacing-sm);margin-bottom:var(--spacing-md)">
          <div class="form-group" style="margin:0">
            <label style="font-size:12px">Domaine / Filiere</label>
            <select id="univ-cat" class="form-control" style="width:100%;padding:8px">
              ${Object.keys(UNIV_MATIERES).map(c =>
                `<option value="${c}"${catInit===c?' selected':''}>${c}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group" style="margin:0">
            <label style="font-size:12px">Matiere</label>
            <select id="univ-matiere" class="form-control" style="width:100%;padding:8px"></select>
          </div>
          <div class="form-group" style="margin:0">
            <label style="font-size:12px">Niveau</label>
            <select id="univ-niveau" class="form-control" style="width:100%;padding:8px">
              <option value="L1">L1</option><option value="L2">L2</option>
              <option value="L3">L3</option><option value="M1">M1</option>
              <option value="M2">M2</option><option value="Doctorat">Doctorat</option>
              <option value="PCEM1">PCEM1</option><option value="PCEM2">PCEM2</option>
              <option value="Prepa">Classe Preparatoire</option>
            </select>
          </div>
        </div>

        <!-- Cartes matières de la catégorie sélectionnée -->
        <div id="univ-matieres-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--spacing-sm);margin-bottom:var(--spacing-md)"></div>

        <button class="btn btn--accent" id="btn-univ-sim" style="width:100%">
          Lancer la simulation IA
        </button>
        <p style="font-size:11px;color:var(--text-secondary);margin-top:var(--spacing-sm)">
          Les questions sont generees par le Super Repetiteur (Claude claude-haiku-4-5) si la base n'en contient pas.
        </p>
      </div>
    </div>`;
}

function initSimulateurLibreEvents() {
  /* --- Mode switcher --- */
  document.getElementById('btn-mode-lycee')?.addEventListener('click', () => {
    document.getElementById('section-lycee').style.display = 'block';
    document.getElementById('section-universite').style.display = 'none';
    document.getElementById('btn-mode-lycee').className = 'btn btn--accent';
    document.getElementById('btn-mode-univ').className  = 'btn btn--outline';
  });
  document.getElementById('btn-mode-univ')?.addEventListener('click', () => {
    document.getElementById('section-lycee').style.display = 'none';
    document.getElementById('section-universite').style.display = 'block';
    document.getElementById('btn-mode-lycee').className = 'btn btn--outline';
    document.getElementById('btn-mode-univ').className  = 'btn btn--accent';
    rendreMatieresUniv();
  });

  /* --- Section lycée : mise à jour matières --- */
  const selExamen = document.getElementById('libre-examen');
  const selSerie  = document.getElementById('libre-serie');

  function mettreAJourMatieresLycee() {
    const ex  = selExamen?.value || 'BAC';
    const ser = ex === 'BEPC' ? '_' : (selSerie?.value || 'C');
    document.getElementById('libre-groupe-serie').style.display = ex === 'BEPC' ? 'none' : '';
    const mats = SERIES_CONFIG[ex]?.[ser] || [];
    const sel  = document.getElementById('libre-matiere');
    if (!sel) return;
    sel.innerHTML = mats.map(m => `<option value="${m}">${m}</option>`).join('');
  }
  selExamen?.addEventListener('change', mettreAJourMatieresLycee);
  selSerie?.addEventListener('change', mettreAJourMatieresLycee);
  mettreAJourMatieresLycee();

  document.getElementById('btn-libre-sim')?.addEventListener('click', () => {
    const ex  = document.getElementById('libre-examen')?.value || 'BAC';
    const ser = document.getElementById('libre-serie')?.value  || 'C';
    const mat = document.getElementById('libre-matiere')?.value;
    if (!mat) return;
    location.href = `/pages/examen-sim.html?matiere=${encodeURIComponent(mat)}&examen=${ex}&serie=${ser}`;
  });

  /* --- Section université : mise à jour matières --- */
  document.getElementById('univ-cat')?.addEventListener('change', rendreMatieresUniv);

  document.getElementById('btn-univ-sim')?.addEventListener('click', () => {
    const mat    = document.getElementById('univ-matiere')?.value;
    const niveau = document.getElementById('univ-niveau')?.value || 'L1';
    if (!mat) return;
    location.href = `/pages/examen-sim.html?matiere=${encodeURIComponent(mat)}&mode=universite&niveau=${niveau}`;
  });

  /* Pré-remplir depuis URL params */
  const urlParams  = new URLSearchParams(location.search);
  const preMatiere = urlParams.get('matiere');
  const modeUniv   = urlParams.get('mode') === 'universite';

  if (modeUniv) {
    /* Basculer en mode université */
    document.getElementById('section-lycee').style.display = 'none';
    document.getElementById('section-universite').style.display = 'block';
    document.getElementById('btn-mode-lycee').className = 'btn btn--outline';
    document.getElementById('btn-mode-univ').className  = 'btn btn--accent';
    rendreMatieresUniv();
    /* Pré-sélectionner la matière dans le select */
    if (preMatiere) {
      setTimeout(() => {
        const sel = document.getElementById('univ-matiere');
        if (sel) {
          const opt = [...sel.options].find(o => o.value === preMatiere);
          if (opt) sel.value = preMatiere;
        }
      }, 100);
    }
  }
}

function rendreMatieresUniv() {
  const cat   = document.getElementById('univ-cat')?.value || Object.keys(UNIV_MATIERES)[0];
  const mats  = UNIV_MATIERES[cat] || [];
  const sel   = document.getElementById('univ-matiere');
  const grid  = document.getElementById('univ-matieres-grid');

  if (sel) sel.innerHTML = mats.map(m => `<option value="${m}">${m}</option>`).join('');
  if (grid) {
    grid.innerHTML = mats.map(m => `
      <button onclick="window._lancerUniv('${m.replace(/'/g, "\\'")}')"
              style="background:var(--bg-card);border:1px solid var(--border-color);border-radius:var(--border-radius-md);padding:12px;text-align:left;cursor:pointer;font-size:var(--font-size-sm);transition:.2s"
              onmouseover="this.style.borderColor='var(--color-primary)'"
              onmouseout="this.style.borderColor='var(--border-color)'">
        ${m}
      </button>`).join('');
  }
}

window._lancerUniv = function(mat) {
  const niveau = document.getElementById('univ-niveau')?.value || 'L1';
  location.href = `/pages/examen-sim.html?matiere=${encodeURIComponent(mat)}&mode=universite&niveau=${niveau}`;
};

