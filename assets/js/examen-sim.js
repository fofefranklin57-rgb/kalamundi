/* ============================================================
   examen-sim.js — Moteur de simulation d'examen
   F3 : questions, correction, lacunes, recommandations
   ============================================================ */

import { supabase, getUser } from './auth.js';
import { getParam } from './utils.js';

const LETTRES = ['A','B','C','D'];

/* ── Paramètres URL ─────────────────────────────────────────── */
const MATIERE = getParam('matiere') || '';
const EXAMEN  = getParam('examen')  || 'BAC';
const SERIE   = getParam('serie')   || null;
const NB_Q    = parseInt(getParam('nb') || '10');

/* ── État ───────────────────────────────────────────────────── */
let utilisateur  = null;
let questions    = [];
let courant      = 0;       // index question courante
let reponses     = [];      // { question_id, choix_donne, correct, theme }
let choixSelec   = null;    // choix actuel (avant validation)
let correctionOk = false;   // true = on a validé la réponse courante
let timerSec     = 0;
let timerInterval= null;
let debut        = Date.now();

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  utilisateur = await getUser();

  if (!MATIERE) {
    afficherConfig();
    return;
  }

  await chargerQuestions();
});

/* ── Écran config (si pas de params) ───────────────────────── */
function afficherConfig() {
  const SERIES = ['C','D','A','A4','B','G1','G2','G3','E','F'];
  const MATIERES_ALL = [
    'Mathématiques','Physique-Chimie','SVT','Chimie','Physique',
    'Français','Philosophie','Anglais','Histoire-Géographie',
    'Économie','Comptabilité','Économie-Droit','Informatique',
    'Techniques Commerciales','Marketing','Bureautique','Correspondance',
    'Sciences Physiques','Économie de Marché',
  ];
  document.getElementById('app').innerHTML = `
    <div class="sim-config">
      <h2>🎯 Lancer une simulation</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);margin-bottom:var(--spacing-md)">
        <div>
          <label style="display:block;font-weight:700;margin-bottom:6px;font-size:var(--font-size-sm)">Examen</label>
          <select id="sel-examen" style="width:100%;padding:10px;border:1.5px solid var(--border-color);border-radius:var(--radius-md);background:var(--bg-card);color:var(--text-primary)">
            <option value="BAC">BAC</option>
            <option value="Probatoire">Probatoire</option>
            <option value="BEPC">BEPC</option>
          </select>
        </div>
        <div>
          <label style="display:block;font-weight:700;margin-bottom:6px;font-size:var(--font-size-sm)">Matière</label>
          <select id="sel-matiere" style="width:100%;padding:10px;border:1.5px solid var(--border-color);border-radius:var(--radius-md);background:var(--bg-card);color:var(--text-primary)">
            ${MATIERES_ALL.map(m => `<option value="${m}">${m}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="margin-bottom:var(--spacing-lg)">
        <label style="display:block;font-weight:700;margin-bottom:6px;font-size:var(--font-size-sm)">Nombre de questions</label>
        <div style="display:flex;gap:var(--spacing-sm)">
          ${[5,10,15,20].map(n => `
            <button class="btn${n===10?' btn--accent':' btn--outline'}" style="flex:1"
              onclick="window._setNbQ(${n},this)">${n}</button>`).join('')}
        </div>
        <input type="hidden" id="nb-q" value="10" />
      </div>
      <button class="btn btn--accent btn--lg" style="width:100%" onclick="window._lancerSim()">
        🚀 Démarrer l'examen
      </button>
    </div>`;

  window._setNbQ = (n, btn) => {
    document.getElementById('nb-q').value = n;
    document.querySelectorAll('.sim-config .btn').forEach(b => {
      b.classList.remove('btn--accent'); b.classList.add('btn--outline');
    });
    btn.classList.add('btn--accent'); btn.classList.remove('btn--outline');
  };

  window._lancerSim = () => {
    const examen  = document.getElementById('sel-examen').value;
    const matiere = document.getElementById('sel-matiere').value;
    const nb      = document.getElementById('nb-q').value;
    window.location.href = `/pages/examen-sim.html?matiere=${encodeURIComponent(matiere)}&examen=${examen}&nb=${nb}`;
  };
}

/* ── Charger les questions ──────────────────────────────────── */
async function chargerQuestions() {
  document.getElementById('app').innerHTML = '<div class="spinner"></div>';

  let query = supabase
    .from('questions')
    .select('*')
    .eq('visible', true)
    .eq('matiere', MATIERE);

  // Filtrer par série si elle est spécifiée (ou prendre les questions communes)
  if (SERIE) {
    query = query.or(`serie.eq.${SERIE},serie.is.null`);
  }

  const { data, error } = await query;

  if (error || !data?.length) {
    /* Fallback IA : générer les questions via Claude */
    await chargerQuestionsIA();
    return;
  }

  // Mélanger et limiter au nombre demandé
  questions = shuffle(data).slice(0, NB_Q);
  reponses  = [];
  courant   = 0;
  debut     = Date.now();

  demarrerTimer();
  afficherQuestion();
}

/* ── Fallback IA — génération de questions via Claude ───────── */
async function chargerQuestionsIA() {
  document.getElementById('app').innerHTML = `
    <div style="text-align:center;padding:4rem 1rem;color:var(--text-secondary)">
      <div style="font-size:3rem;margin-bottom:1rem">🤖</div>
      <h3 style="color:var(--color-primary)">Super Répétiteur IA</h3>
      <p style="margin-bottom:1rem">Aucune question en base pour <strong>${MATIERE}</strong>.<br>
         Je génère ${NB_Q} questions personnalisées avec l'IA…</p>
      <div class="spinner" style="margin:0 auto"></div>
    </div>`;

  try {
    const res = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matiere: MATIERE, examen: EXAMEN, serie: SERIE || null, nb: NB_Q }),
    });

    if (!res.ok) throw new Error(`Erreur ${res.status}`);
    const { questions: qIA } = await res.json();

    if (!qIA?.length) throw new Error('Aucune question générée');

    questions = shuffle(qIA).slice(0, NB_Q);
    reponses  = [];
    courant   = 0;
    debut     = Date.now();

    /* Badge IA visible pendant l'exam */
    document.getElementById('app').innerHTML = `
      <div style="background:linear-gradient(90deg,#1a3a5c,#1B4332);color:#fff;
           text-align:center;padding:6px;font-size:12px;border-radius:var(--radius-md) var(--radius-md) 0 0">
        🤖 Questions générées par IA — ${MATIERE} · ${EXAMEN}${SERIE ? ' Série '+SERIE : ''}
      </div>
      <div id="app-inner"></div>`;

    const origApp = document.getElementById('app');
    Object.defineProperty(origApp, 'innerHTML', {
      set(v) { document.getElementById('app-inner').innerHTML = v; },
      get() { return document.getElementById('app-inner').innerHTML; },
      configurable: true,
    });

    demarrerTimer();
    afficherQuestion();

  } catch (e) {
    document.getElementById('app').innerHTML = `
      <div style="text-align:center;padding:4rem 0;color:var(--text-secondary)">
        <div style="font-size:3rem;margin-bottom:1rem">⚠️</div>
        <h3>Questions indisponibles</h3>
        <p style="margin-bottom:1rem">${e.message}</p>
        <a href="/pages/repetiteur.html" class="btn btn--accent">← Retour au Répétiteur</a>
      </div>`;
  }
}

/* ── Timer ──────────────────────────────────────────────────── */
function demarrerTimer() {
  timerSec = 0;
  timerInterval = setInterval(() => {
    timerSec++;
    const el = document.getElementById('exam-timer');
    if (el) {
      el.textContent = formatTimer(timerSec);
      // Urgent si > 2min par question
      el.classList.toggle('urgent', timerSec > questions.length * 120);
    }
  }, 1000);
}

function formatTimer(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

/* ── Afficher une question ──────────────────────────────────── */
function afficherQuestion() {
  const q   = questions[courant];
  const pct = Math.round((courant / questions.length) * 100);
  choixSelec   = null;
  correctionOk = false;

  const choix = Array.isArray(q.choix) ? q.choix : JSON.parse(q.choix);

  document.getElementById('app').innerHTML = `
    <div style="max-width:720px;margin:0 auto">
      <!-- Header -->
      <div class="exam-header">
        <div>
          <div class="exam-header__titre">${MATIERE}</div>
          <div class="exam-header__meta">${EXAMEN}${SERIE ? ' · Série ' + SERIE : ''} · ${q.theme || ''}</div>
        </div>
        <div style="text-align:right">
          <div class="exam-timer" id="exam-timer">${formatTimer(timerSec)}</div>
          <div style="font-size:11px;opacity:.7">${courant+1} / ${questions.length}</div>
        </div>
      </div>
      <div class="exam-progress">
        <div class="exam-progress__fill" style="width:${pct}%"></div>
      </div>

      <!-- Corps -->
      <div class="exam-body">
        <div class="question-num">Question ${courant+1} sur ${questions.length} · Niveau ${'⭐'.repeat(q.niveau || 2)}</div>
        <div class="question-enonce">${q.enonce}</div>

        <div class="choix-grid" id="choix-grid">
          ${choix.map((c, i) => `
            <button class="choix-btn" id="choix-${i}" onclick="window._selectionner(${i})">
              <span class="choix-lettre">${LETTRES[i]}</span>
              <span>${c}</span>
            </button>`).join('')}
        </div>

        <div id="explication-zone"></div>

        <div class="exam-nav">
          <div style="font-size:var(--font-size-sm);color:var(--text-secondary)">
            ${courant > 0 ? `<button class="btn btn--ghost btn--sm" onclick="window._precedent()">← Précédent</button>` : ''}
          </div>
          <button class="btn btn--accent" id="btn-valider" onclick="window._valider()" disabled>
            Valider
          </button>
        </div>
      </div>
    </div>`;
}

/* ── Sélectionner un choix ──────────────────────────────────── */
window._selectionner = function(idx) {
  if (correctionOk) return;
  choixSelec = idx;
  document.querySelectorAll('.choix-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === idx);
  });
  document.getElementById('btn-valider').disabled = false;
};

/* ── Valider la réponse ─────────────────────────────────────── */
window._valider = function() {
  if (choixSelec === null || correctionOk) return;
  correctionOk = true;

  const q      = questions[courant];
  const bonne  = q.reponse_correcte;
  const correct = choixSelec === bonne;
  const choix  = Array.isArray(q.choix) ? q.choix : JSON.parse(q.choix);

  // Enregistrer la réponse
  reponses.push({
    question_id: q.id,
    theme:       q.theme || '',
    choix_donne: choixSelec,
    correct,
  });

  // Colorer les boutons
  document.querySelectorAll('.choix-btn').forEach((btn, i) => {
    btn.disabled = true;
    if (i === bonne)     btn.classList.add('correct');
    if (i === choixSelec && !correct) btn.classList.add('incorrect');
  });

  // Explication
  const expZone = document.getElementById('explication-zone');
  const expl    = q.explication || (correct ? 'Bonne réponse !' : `La bonne réponse était : ${LETTRES[bonne]}. ${choix[bonne]}`);
  expZone.innerHTML = `
    <div class="explication-box ${correct ? 'correct' : 'incorrect'}">
      ${correct ? '✅' : '❌'} <strong>${correct ? 'Correct !' : 'Incorrect'}</strong><br>${expl}
    </div>`;

  // Changer le bouton Valider → Suivant
  const btn = document.getElementById('btn-valider');
  const estDernier = courant === questions.length - 1;
  btn.textContent  = estDernier ? '📊 Voir mes résultats' : 'Question suivante →';
  btn.onclick      = estDernier ? window._terminer : window._suivant;
};

/* ── Navigation ─────────────────────────────────────────────── */
window._suivant = function() {
  courant++;
  afficherQuestion();
};

window._precedent = function() {
  if (courant > 0) { courant--; afficherQuestion(); }
};

/* ── Terminer l'examen ──────────────────────────────────────── */
window._terminer = async function() {
  clearInterval(timerInterval);

  const nbCorrect = reponses.filter(r => r.correct).length;
  const score     = Math.round((nbCorrect / questions.length) * 100);
  const duree     = Math.round((Date.now() - debut) / 1000);

  // Identifier les lacunes (thèmes ratés)
  const lacunes = [...new Set(
    reponses.filter(r => !r.correct).map(r => r.theme).filter(Boolean)
  )];

  // Sauvegarder en Supabase si connecté
  if (utilisateur) {
    await supabase.from('resultats_sim').insert({
      user_id:      utilisateur.id,
      examen:       EXAMEN,
      serie:        SERIE || null,
      matiere:      MATIERE,
      nb_questions: questions.length,
      nb_correct:   nbCorrect,
      score,
      lacunes,
      reponses:     reponses.map(r => ({ question_id: r.question_id, choix_donne: r.choix_donne, correct: r.correct })),
      duree_secondes: duree,
    }).catch(() => {});
  }

  // Charger des recommandations de livres
  const recos = await chargerRecommandations(lacunes);

  afficherResultatFinal(nbCorrect, score, duree, lacunes, recos);
};

/* ── Recommandations ────────────────────────────────────────── */
async function chargerRecommandations(lacunes) {
  const recos = [];

  // 1. Livres du catalogue correspondant à la matière
  const { data: livres } = await supabase
    .from('oeuvres')
    .select('id, titre, genre, couverture_url')
    .eq('visible', true)
    .or(`public_cible.ilike.%${MATIERE}%,genre.eq.education`)
    .limit(3);
  if (livres?.length) livres.forEach(l => recos.push({ type: 'livre', titre: l.titre, id: l.id }));

  // 2. Annales correspondantes
  const { data: annales } = await supabase
    .from('annales')
    .select('id, examen, serie, matiere, annee')
    .eq('matiere', MATIERE)
    .eq('examen', EXAMEN)
    .order('annee', { ascending: false })
    .limit(3);
  if (annales?.length) annales.forEach(a => recos.push({
    type: 'annale',
    titre: `${a.examen}${a.serie ? ' Série '+a.serie : ''} — ${a.matiere} ${a.annee}`,
    id: a.id,
  }));

  return recos;
}

/* ── Afficher le résultat final ─────────────────────────────── */
function afficherResultatFinal(nbCorrect, score, duree, lacunes, recos) {
  const couleur = score >= 70 ? '#1B4332' : score >= 50 ? '#e65c00' : '#7f0000';
  const emoji   = score >= 70 ? '🏆' : score >= 50 ? '📈' : '📚';
  const verdict = score >= 70 ? 'Excellent !' : score >= 50 ? 'Peut mieux faire' : 'À renforcer';
  const mention = score >= 70 ? 'Bonne maîtrise de la matière' : score >= 50 ? 'Quelques lacunes à combler' : 'Révisions intensives recommandées';

  const partageTexte =
    `${emoji} J'ai obtenu ${score}% en ${MATIERE} (${EXAMEN}) sur Kalamundi !\n`
    + `${nbCorrect}/${questions.length} bonnes réponses · ${Math.floor(duree/60)}min${duree%60}s\n`
    + `Tente le tien : https://kalamundi.pages.dev/pages/repetiteur.html`;

  document.getElementById('app').innerHTML = `
    <div class="resultat-final">
      <!-- Hero score -->
      <div class="resultat-final__hero" style="background:linear-gradient(135deg,${couleur},#0d2137)">
        <div style="font-size:2.5rem;margin-bottom:var(--spacing-sm)">${emoji}</div>
        <div class="rf-score">${score}%</div>
        <div class="rf-verdict">${verdict}</div>
        <div class="rf-detail">${nbCorrect} / ${questions.length} correctes · ⏱ ${Math.floor(duree/60)}min${duree%60}s</div>
        <div style="margin-top:var(--spacing-md);font-size:var(--font-size-sm);opacity:.8">${MATIERE} · ${EXAMEN}${SERIE ? ' Série '+SERIE : ''}</div>
      </div>

      <div class="resultat-final__body">

        <!-- Détail par question -->
        <h3 style="margin-bottom:var(--spacing-md)">📋 Détail des réponses</h3>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:var(--spacing-xl)">
          ${reponses.map((r, i) => `
            <div style="width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;
              font-weight:700;font-size:14px;background:${r.correct ? '#e8f5e9' : '#ffebee'};
              color:${r.correct ? '#2e7d32' : '#b71c1c'}" title="Q${i+1}: ${r.correct ? 'Correct' : 'Incorrect'}">
              ${r.correct ? '✓' : '✗'}
            </div>`).join('')}
        </div>

        ${lacunes.length ? `
          <!-- Lacunes -->
          <h3 style="margin-bottom:var(--spacing-md)">⚠️ Thèmes à renforcer</h3>
          <div style="margin-bottom:var(--spacing-xl)">
            ${lacunes.map(l => `
              <div class="lacune-card">
                <div class="lacune-card__titre">📌 ${l}</div>
                <div class="lacune-card__detail">Révisez ce thème et refaites une simulation ciblée.</div>
              </div>`).join('')}
          </div>` : `
          <div style="background:#e8f5e9;border-radius:var(--radius-md);padding:var(--spacing-md);margin-bottom:var(--spacing-xl);color:#1b5e20;font-weight:600">
            ✅ Aucune lacune identifiée — excellente maîtrise !
          </div>`}

        ${recos.length ? `
          <!-- Recommandations -->
          <h3 style="margin-bottom:var(--spacing-md)">📚 Ressources recommandées</h3>
          <div class="reco-grid" style="margin-bottom:var(--spacing-xl)">
            ${recos.map(r => `
              <div class="reco-card">
                <div class="reco-card__type">${r.type === 'livre' ? '📖 Livre' : '📝 Annale'}</div>
                <div class="reco-card__titre">${r.titre}</div>
                ${r.type === 'livre'
                  ? `<a href="/pages/work.html?id=${r.id}" class="btn btn--ghost btn--sm" style="margin-top:8px;display:inline-block">Lire →</a>`
                  : `<a href="/pages/annales.html" class="btn btn--ghost btn--sm" style="margin-top:8px;display:inline-block">Voir →</a>`}
              </div>`).join('')}
          </div>` : ''}

        <!-- Actions -->
        <div style="display:flex;gap:var(--spacing-sm);flex-wrap:wrap">
          <button class="btn btn--accent" onclick="window.location.reload()">↺ Refaire l'examen</button>
          <a href="/pages/repetiteur.html" class="btn btn--outline">← Mon tableau de bord</a>
          <button onclick="navigator.share ? navigator.share({text:'${partageTexte.replace(/'/g,"\\'")}',title:'Mon résultat Kalamundi'}).catch(()=>{}) : window.open('https://wa.me/?text='+encodeURIComponent('${partageTexte.replace(/'/g,"\\'")}'),'_blank')"
            style="background:#25D366;color:#fff;border:none;padding:10px 20px;border-radius:var(--radius-md);font-weight:700;cursor:pointer;font-size:var(--font-size-sm)">
            📱 Partager
          </button>
        </div>

      </div>
    </div>`;
}

/* ── Utilitaires ────────────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
