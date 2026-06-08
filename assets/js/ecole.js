/* ============================================================
   ecole.js — Espace École Kalamundi
   Gestion classes, listes de lecture, progression élèves
   ============================================================ */

import { supabase, getUser } from './auth.js';
import { toast, toastSucces, toastErreur } from './utils.js';

let utilisateur = null;
let classeActive = null; // classe ouverte dans le modal détail

/* ============================================================
   INIT
   ============================================================ */

export async function init() {
  utilisateur = await getUser();

  initNavbar();
  initModals();
  initOnglets();

  if (!utilisateur) {
    document.getElementById('zone-non-connecte').style.display = 'block';
    return;
  }

  document.getElementById('zone-connecte').style.display = 'block';
  await chargerMesClasses();
  await chargerMesLectures();
}
if (!document.body?.classList.contains('edu-hub')) {
  document.addEventListener('DOMContentLoaded', init);
}

/* ============================================================
   NAVBAR
   ============================================================ */

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
    actions.innerHTML = `
      <a href="/pages/author-dashboard.html" class="btn btn--ghost btn--sm">Mon espace</a>`;
  } else {
    actions.innerHTML = `
      <a href="/pages/login.html" class="btn btn--ghost btn--sm">Connexion</a>
      <a href="/pages/login.html?mode=inscription" class="btn btn--accent btn--sm">S'inscrire</a>`;
  }
}

/* ============================================================
   ONGLETS PRINCIPAUX
   ============================================================ */

function initOnglets() {
  document.querySelectorAll('.ecole-tab[data-panel]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ecole-tab[data-panel]').forEach(b => b.classList.remove('ecole-tab--active'));
      document.querySelectorAll('.ecole-panel').forEach(p => p.classList.remove('ecole-panel--active'));
      btn.classList.add('ecole-tab--active');
      document.getElementById(`panel-${btn.dataset.panel}`).classList.add('ecole-panel--active');
    });
  });

  // Onglets internes du modal classe
  document.querySelectorAll('.ecole-tab[data-inner]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ecole-tab[data-inner]').forEach(b => b.classList.remove('ecole-tab--active'));
      btn.classList.add('ecole-tab--active');
      document.getElementById('inner-livres').style.display = btn.dataset.inner === 'livres' ? 'block' : 'none';
      document.getElementById('inner-eleves').style.display = btn.dataset.inner === 'eleves' ? 'block' : 'none';
      if (btn.dataset.inner === 'eleves' && classeActive) chargerEleves(classeActive.id);
    });
  });
}

/* ============================================================
   MODALS
   ============================================================ */

function initModals() {
  // Créer classe
  document.getElementById('btn-creer-classe')?.addEventListener('click', () => ouvrirModal('modal-creer'));
  document.getElementById('btn-annuler-classe')?.addEventListener('click', () => fermerModal('modal-creer'));
  document.getElementById('btn-confirmer-classe')?.addEventListener('click', creerClasse);

  // Rejoindre classe
  document.getElementById('btn-rejoindre-classe')?.addEventListener('click', () => ouvrirModal('modal-rejoindre'));
  document.getElementById('btn-annuler-rejoindre')?.addEventListener('click', () => fermerModal('modal-rejoindre'));
  document.getElementById('btn-confirmer-rejoindre')?.addEventListener('click', rejoindreclasse);

  // Fermer modal détail
  document.getElementById('btn-fermer-detail')?.addEventListener('click', () => fermerModal('modal-classe-detail'));

  // Recherche livre dans le modal
  let debounce;
  document.getElementById('input-recherche-livre')?.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => rechercherLivres(e.target.value), 350);
  });

  // Fermer sur clic fond
  document.querySelectorAll('.modal-overlay').forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) fermerModal(m.id); });
  });
}

function ouvrirModal(id) { document.getElementById(id)?.classList.add('is-open'); }
function fermerModal(id) { document.getElementById(id)?.classList.remove('is-open'); }

/* ============================================================
   CHARGER MES CLASSES
   ============================================================ */

async function chargerMesClasses() {
  const zone = document.getElementById('liste-classes');

  try {
    // Classes où je suis prof
    const { data: classesProf } = await supabase
      .from('classes')
      .select('*')
      .eq('prof_id', utilisateur.id)
      .eq('actif', true)
      .order('created_at', { ascending: false });

    // Classes où je suis élève
    const { data: membresData } = await supabase
      .from('membres_classe')
      .select('classe_id, classes(*)')
      .eq('eleve_id', utilisateur.id);

    const classesEleve = membresData?.map(m => m.classes).filter(Boolean) || [];
    const toutesClasses = [...(classesProf || []), ...classesEleve];

    if (!toutesClasses.length) {
      zone.innerHTML = `
        <div style="text-align:center;padding:var(--spacing-2xl) 0;color:var(--text-secondary)">
          <div style="font-size:3rem;margin-bottom:var(--spacing-md)">🏫</div>
          <h3>Aucune classe pour le moment</h3>
          <p>Créez votre première classe ou rejoignez celle de votre enseignant.</p>
        </div>`;
      return;
    }

    zone.innerHTML = toutesClasses.map(c => {
      const estProf = c.prof_id === utilisateur.id;
      return `
        <div class="classe-card">
          <div class="classe-card__header">
            <div>
              <div class="classe-card__titre">${c.nom}</div>
              <div class="classe-card__meta">
                ${c.niveau || ''} ${c.matiere ? '· ' + c.matiere : ''} · ${c.nb_eleves || 0} élève(s)
                ${estProf ? ' · <strong style="color:var(--color-primary)">Vous êtes l\'enseignant(e)</strong>' : ''}
              </div>
              ${c.description ? `<p style="color:var(--text-secondary);font-size:var(--font-size-sm);margin-top:6px">${c.description}</p>` : ''}
            </div>
            ${estProf ? `
              <div title="Cliquez pour copier le code d'accès" class="classe-card__code" data-code="${c.code_acces}" onclick="copierCode('${c.code_acces}')">
                🔑 ${c.code_acces}
              </div>` : ''}
          </div>
          <div class="classe-card__actions">
            <button class="btn btn--accent btn--sm" onclick="ouvrirDetailClasse('${c.id}','${c.nom.replace(/'/g,"\\'")}')">
              📚 Voir les livres
            </button>
            ${estProf ? `
              <button class="btn btn--outline btn--sm" onclick="ouvrirDetailClasse('${c.id}','${c.nom.replace(/'/g,"\\'")}','eleves')">
                👥 Élèves
              </button>
              <button class="btn btn--ghost btn--sm" style="color:var(--color-error)" onclick="supprimerClasse('${c.id}')">
                🗑️ Supprimer
              </button>` : `
              <button class="btn btn--ghost btn--sm" style="color:var(--text-secondary)" onclick="quitterClasse('${c.id}')">
                Quitter la classe
              </button>`}
          </div>
        </div>`;
    }).join('');

  } catch (e) {
    zone.innerHTML = `<p style="color:var(--color-error)">Erreur de chargement des classes.</p>`;
    console.error(e);
  }
}

/* ============================================================
   MES LECTURES ASSIGNÉES (élève)
   ============================================================ */

async function chargerMesLectures() {
  const zone = document.getElementById('liste-lectures');
  try {
    // Trouver mes classes en tant qu'élève
    const { data: membres } = await supabase
      .from('membres_classe')
      .select('classe_id')
      .eq('eleve_id', utilisateur.id);

    if (!membres?.length) {
      zone.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:2rem">Rejoignez une classe pour voir vos lectures assignées.</p>`;
      return;
    }

    const classeIds = membres.map(m => m.classe_id);
    const { data: listes } = await supabase
      .from('listes_lecture')
      .select(`
        obligatoire, note_prof, date_limite,
        oeuvres:oeuvre_id(id, titre, couverture_url, genre, public_cible),
        classes:classe_id(nom, niveau)
      `)
      .in('classe_id', classeIds)
      .order('obligatoire', { ascending: false });

    if (!listes?.length) {
      zone.innerHTML = `<p style="color:var(--text-secondary);text-align:center;padding:2rem">Aucun livre assigné pour le moment.</p>`;
      return;
    }

    zone.innerHTML = `<div class="livre-liste">${listes.map(l => {
      const o = l.oeuvres;
      const cover = o?.couverture_url
        ? `<img src="${o.couverture_url}" alt="${o?.titre}" class="livre-item__cover" onerror="this.style.display='none'">`
        : `<div class="livre-item__cover livre-item__cover--placeholder">📖</div>`;
      return `
        <div class="livre-item">
          ${cover}
          <div style="flex:1;min-width:0">
            <div class="livre-item__titre">${o?.titre || 'Sans titre'}</div>
            <div class="livre-item__meta">${l.classes?.nom || ''} · ${l.obligatoire ? '<span class="badge-obligatoire">Obligatoire</span>' : '<span class="badge-libre">Lecture libre</span>'}</div>
            ${l.note_prof ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px;font-style:italic">"${l.note_prof}"</div>` : ''}
            ${l.date_limite ? `<div style="font-size:11px;color:var(--color-warning,#e65c00);margin-top:2px">📅 Avant le ${new Date(l.date_limite).toLocaleDateString('fr-FR')}</div>` : ''}
            <a href="/pages/reader.html?id=${o?.id}&ch=1" class="btn btn--accent btn--sm" style="margin-top:8px;display:inline-block">📖 Lire</a>
          </div>
        </div>`;
    }).join('')}</div>`;

  } catch (e) {
    zone.innerHTML = `<p style="color:var(--color-error)">Erreur de chargement.</p>`;
  }
}

/* ============================================================
   CRÉER UNE CLASSE
   ============================================================ */

async function creerClasse() {
  const nom    = document.getElementById('input-nom-classe').value.trim();
  const niveau = document.getElementById('input-niveau').value;
  const matiere = document.getElementById('input-matiere').value.trim();
  const desc   = document.getElementById('input-description').value.trim();

  if (!nom) { toast('Le nom de la classe est obligatoire.', 'erreur'); return; }

  const btn = document.getElementById('btn-confirmer-classe');
  btn.disabled = true;
  btn.textContent = 'Création…';

  // Générer code unique KALA-XXXX
  const code = 'KALA-' + Math.random().toString(36).toUpperCase().slice(2, 6);

  const { error } = await supabase.from('classes').insert({
    prof_id:     utilisateur.id,
    nom,
    niveau,
    matiere:     matiere || null,
    code_acces:  code,
    description: desc || null,
  });

  btn.disabled = false;
  btn.textContent = 'Créer la classe';

  if (error) {
    toastErreur('Erreur lors de la création : ' + error.message);
    return;
  }

  fermerModal('modal-creer');
  document.getElementById('input-nom-classe').value = '';
  document.getElementById('input-matiere').value = '';
  document.getElementById('input-description').value = '';

  toastSucces(`Classe créée ! Code d'accès : ${code}`);
  await chargerMesClasses();
}

/* ============================================================
   REJOINDRE UNE CLASSE
   ============================================================ */

async function rejoindreclasse() {
  const code = document.getElementById('input-code-classe').value.trim().toUpperCase();
  if (!code) { toast('Entrez le code de la classe.', 'erreur'); return; }

  const btn = document.getElementById('btn-confirmer-rejoindre');
  btn.disabled = true;
  btn.textContent = 'Recherche…';

  const { data: classe, error } = await supabase
    .from('classes')
    .select('id, nom')
    .eq('code_acces', code)
    .eq('actif', true)
    .maybeSingle();

  if (!classe) {
    toast('Code invalide ou classe introuvable.', 'erreur');
    btn.disabled = false; btn.textContent = 'Rejoindre';
    return;
  }

  const { error: err2 } = await supabase.from('membres_classe').insert({
    classe_id: classe.id,
    eleve_id:  utilisateur.id,
  });

  btn.disabled = false; btn.textContent = 'Rejoindre';

  if (err2 && err2.code === '23505') {
    toast('Vous êtes déjà membre de cette classe.', 'info');
  } else if (err2) {
    toastErreur('Erreur : ' + err2.message);
    return;
  } else {
    fermerModal('modal-rejoindre');
    document.getElementById('input-code-classe').value = '';
    toastSucces(`Vous avez rejoint "${classe.nom}" !`);
    await chargerMesClasses();
    await chargerMesLectures();
  }
}

/* ============================================================
   DÉTAIL CLASSE — livres + élèves
   ============================================================ */

window.ouvrirDetailClasse = async function(id, nom, panel = 'livres') {
  classeActive = { id, nom };
  document.getElementById('modal-classe-titre').textContent = nom;
  ouvrirModal('modal-classe-detail');

  document.querySelectorAll('.ecole-tab[data-inner]').forEach(b => {
    b.classList.toggle('ecole-tab--active', b.dataset.inner === panel);
  });
  document.getElementById('inner-livres').style.display = panel === 'livres' ? 'block' : 'none';
  document.getElementById('inner-eleves').style.display = panel === 'eleves' ? 'block' : 'none';

  if (panel === 'livres') await chargerLivresClasse(id);
  else await chargerEleves(id);
};

async function chargerLivresClasse(classeId) {
  const zone = document.getElementById('liste-livres-classe');
  zone.innerHTML = '<div class="spinner" style="margin:1rem auto"></div>';

  const { data } = await supabase
    .from('listes_lecture')
    .select(`obligatoire, note_prof, oeuvres:oeuvre_id(id, titre, couverture_url)`)
    .eq('classe_id', classeId)
    .order('ordre');

  if (!data?.length) {
    zone.innerHTML = `<p style="color:var(--text-secondary);padding:1rem 0">Aucun livre assigné. Ajoutez-en ci-dessous.</p>`;
    return;
  }

  zone.innerHTML = data.map(l => {
    const o = l.oeuvres;
    return `
      <div class="livre-item" style="margin-bottom:var(--spacing-sm)">
        ${o?.couverture_url ? `<img src="${o.couverture_url}" class="livre-item__cover" onerror="this.style.display='none'">` : '<div class="livre-item__cover livre-item__cover--placeholder">📖</div>'}
        <div style="flex:1;min-width:0">
          <div class="livre-item__titre">${o?.titre || ''}</div>
          <div class="livre-item__meta">${l.obligatoire ? '<span class="badge-obligatoire">Obligatoire</span>' : '<span class="badge-libre">Libre</span>'}</div>
          ${l.note_prof ? `<div style="font-size:11px;color:var(--text-secondary);font-style:italic">"${l.note_prof}"</div>` : ''}
        </div>
        <button class="btn btn--ghost btn--sm" style="color:var(--color-error)" onclick="retirerLivre('${classeId}','${o?.id}')">✕</button>
      </div>`;
  }).join('');
}

async function chargerEleves(classeId) {
  const zone = document.getElementById('liste-eleves-classe');
  zone.innerHTML = '<div class="spinner" style="margin:1rem auto"></div>';

  const [{ data: membres }, { data: listes }, { data: progressions }] = await Promise.all([
    supabase
      .from('membres_classe')
      .select('profiles:eleve_id(id, nom, email, photo_url)')
      .eq('classe_id', classeId),
    supabase
      .from('listes_lecture')
      .select('oeuvres:oeuvre_id(id, titre)')
      .eq('classe_id', classeId)
      .order('ordre'),
    supabase
      .from('progression_eleves')
      .select('eleve_id, oeuvre_id, pourcentage, termine, derniere_lecture')
      .eq('classe_id', classeId),
  ]);

  if (!membres?.length) {
    zone.innerHTML = `<p style="color:var(--text-secondary);padding:1rem 0">Aucun élève. Partagez le code d'accès de la classe.</p>`;
    return;
  }

  const livres = (listes || []).map(l => l.oeuvres).filter(Boolean);

  // Index : progMap[eleveId][oeuvreId] = { pourcentage, termine, derniere_lecture }
  const progMap = {};
  for (const p of progressions || []) {
    if (!progMap[p.eleve_id]) progMap[p.eleve_id] = {};
    progMap[p.eleve_id][p.oeuvre_id] = p;
  }

  function avatar(p) {
    if (p?.photo_url) return `<img src="${p.photo_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover">`;
    return `<div style="width:36px;height:36px;border-radius:50%;background:var(--color-primary);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;flex-shrink:0">${p?.nom?.charAt(0)?.toUpperCase() || '?'}</div>`;
  }

  function barreProgression(pct, termine) {
    const couleur = termine ? 'var(--color-success,#2d6a4f)' : pct > 0 ? 'var(--color-primary)' : 'var(--border-color)';
    const label = termine ? '✅ Terminé' : pct > 0 ? `${pct}%` : 'Non commencé';
    return `
      <div style="display:flex;align-items:center;gap:6px;min-width:120px">
        <div style="flex:1;height:6px;border-radius:3px;background:var(--border-color,#e0e0e0);overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${couleur};border-radius:3px;transition:width .3s"></div>
        </div>
        <span style="font-size:10px;color:var(--text-secondary);white-space:nowrap">${label}</span>
      </div>`;
  }

  zone.innerHTML = membres.map(m => {
    const p = m.profiles;
    const prog = progMap[p?.id] || {};

    const lignesLivres = livres.length ? livres.map(o => {
      const r = prog[o.id];
      const pct  = r?.pourcentage ?? 0;
      const fin  = r?.termine ?? false;
      const date = r?.derniere_lecture ? new Date(r.derniere_lecture).toLocaleDateString('fr-FR') : null;
      return `
        <div style="display:flex;align-items:center;gap:var(--spacing-sm);padding:4px 0;border-top:1px solid var(--border-color)">
          <span style="flex:1;font-size:12px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${o.titre}">${o.titre}</span>
          ${barreProgression(pct, fin)}
          ${date ? `<span style="font-size:10px;color:var(--text-secondary);white-space:nowrap">${date}</span>` : ''}
        </div>`;
    }).join('') : `<div style="font-size:12px;color:var(--text-secondary);padding-top:4px">Aucun livre assigné</div>`;

    return `
      <div class="eleve-row" style="flex-direction:column;align-items:stretch;gap:var(--spacing-xs)">
        <div style="display:flex;align-items:center;gap:var(--spacing-sm)">
          ${avatar(p)}
          <div style="flex:1;min-width:0">
            <div style="font-weight:600">${p?.nom || 'Élève'}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${p?.email || ''}</div>
          </div>
        </div>
        <div style="padding-left:44px">${lignesLivres}</div>
      </div>`;
  }).join('');
}

/* ============================================================
   RECHERCHE + AJOUT LIVRE
   ============================================================ */

async function rechercherLivres(q) {
  const zone = document.getElementById('resultats-recherche-livre');
  if (!q || q.length < 2) { zone.innerHTML = ''; return; }

  const { data } = await supabase
    .from('oeuvres')
    .select('id, titre, couverture_url, public_cible')
    .ilike('titre', `%${q}%`)
    .eq('visible', true)
    .limit(5);

  if (!data?.length) { zone.innerHTML = `<p style="color:var(--text-secondary);font-size:var(--font-size-sm)">Aucun résultat.</p>`; return; }

  zone.innerHTML = data.map(o => `
    <div style="display:flex;align-items:center;gap:var(--spacing-sm);padding:8px;border:1px solid var(--border-color);border-radius:var(--radius-md);margin-bottom:4px;background:var(--bg-card)">
      <div style="flex:1">
        <div style="font-weight:600;font-size:var(--font-size-sm)">${o.titre}</div>
        ${o.public_cible ? `<div style="font-size:11px;color:var(--text-secondary)">${o.public_cible}</div>` : ''}
      </div>
      <button class="btn btn--accent btn--sm" onclick="ajouterLivre('${classeActive?.id}','${o.id}')">+ Ajouter</button>
    </div>`).join('');
}

window.ajouterLivre = async function(classeId, oeuvreId) {
  const { error } = await supabase.from('listes_lecture').insert({
    classe_id: classeId,
    oeuvre_id: oeuvreId,
    obligatoire: true,
  });

  if (error && error.code === '23505') {
    toast('Ce livre est déjà dans la liste.', 'info');
  } else if (error) {
    toastErreur('Erreur : ' + error.message);
  } else {
    toastSucces('Livre ajouté à la classe !');
    document.getElementById('input-recherche-livre').value = '';
    document.getElementById('resultats-recherche-livre').innerHTML = '';
    await chargerLivresClasse(classeId);
  }
};

window.retirerLivre = async function(classeId, oeuvreId) {
  if (!confirm('Retirer ce livre de la liste ?')) return;
  await supabase.from('listes_lecture').delete().eq('classe_id', classeId).eq('oeuvre_id', oeuvreId);
  toastSucces('Livre retiré.');
  await chargerLivresClasse(classeId);
};

/* ============================================================
   SUPPRIMER / QUITTER CLASSE
   ============================================================ */

window.supprimerClasse = async function(id) {
  if (!confirm('Supprimer définitivement cette classe et sa liste de lecture ?')) return;
  await supabase.from('classes').update({ actif: false }).eq('id', id);
  toastSucces('Classe supprimée.');
  await chargerMesClasses();
};

window.quitterClasse = async function(classeId) {
  if (!confirm('Quitter cette classe ?')) return;
  await supabase.from('membres_classe').delete().eq('classe_id', classeId).eq('eleve_id', utilisateur.id);
  toastSucces('Vous avez quitté la classe.');
  await chargerMesClasses();
  await chargerMesLectures();
};

/* ============================================================
   COPIER CODE
   ============================================================ */

window.copierCode = async function(code) {
  await navigator.clipboard.writeText(code).catch(() => {});
  toast(`Code "${code}" copié !`, 'success');
};
