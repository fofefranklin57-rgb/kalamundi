/* ============================================================
   fax.js — Viewer épreuve + corrigé (fax) + IA fallback
   Kalamundi
   ============================================================ */

import { supabase, getUser } from './auth.js';

const params  = new URLSearchParams(location.search);
const EP_ID   = params.get('ep');

const CAT_ICONS = {
  droit_sciences_juridiques:   '⚖️',
  medecine_sante:              '🏥',
  sciences_exactes:            '📐',
  sciences_humaines:           '🌍',
  lettres_langues:             '📖',
  economie_gestion:            '📈',
  informatique_tech:           '💻',
  sciences_education:          '📚',
  agronomie:                   '🌱',
  architecture:                '🏛️',
  concours_grandes_ecoles:     '🏆',
  concours_fonctions_publiques:'🏢',
  autre:                       '📋',
};

const TYPE_LABELS = {
  cc:'CC', session_normale:'Session Normale', rattrapage:'Rattrapage',
  concours:'Concours', partiel:'Partiel', td:'TD', tp:'TP',
};

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  if (!EP_ID) { afficherErreur('Aucune epreuve specifiee.'); return; }
  try {
    const [epreuve, user] = await Promise.all([
      chargerEpreuve(EP_ID),
      getUser(),
    ]);
    if (!epreuve) { afficherErreur('Epreuve introuvable.'); return; }
    afficherInfo(epreuve);
    afficherSujet(epreuve);
    await afficherFax(epreuve, user);
    configRepetiteur(epreuve);
    enregistrerVue(EP_ID);
  } catch (e) {
    afficherErreur('Erreur de chargement : ' + e.message);
  }
});

/* ── Navbar ─────────────────────────────────────────────────── */
function initNavbar() {
  const toggle = document.getElementById('nav-toggle');
  const menu   = document.getElementById('nav-menu');
  toggle?.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
  });
  getUser().then(u => {
    const a = document.getElementById('navbar-actions');
    if (!a) return;
    a.innerHTML = u
      ? `<a href="/pages/author-dashboard.html" class="btn btn--ghost btn--sm">Mon espace</a>`
      : `<a href="/pages/login.html" class="btn btn--ghost btn--sm">Connexion</a>
         <a href="/pages/login.html?mode=inscription" class="btn btn--accent btn--sm">S'inscrire</a>`;
  }).catch(() => {});
}

/* ── Charger épreuve ────────────────────────────────────────── */
async function chargerEpreuve(id) {
  const { data, error } = await supabase
    .from('epreuves')
    .select(`
      id, matiere, annee, semestre, type_epreuve, a_corrige,
      description, enonce_url, nb_vues, nb_telechargements,
      filiere_id,
      filieres(id, nom, categorie, icone, etablissement_id,
        etablissements(id, nom, nom_court, type))
    `)
    .eq('id', id)
    .eq('visible', true)
    .single();
  if (error) throw error;
  return data;
}

/* ── Afficher infos ─────────────────────────────────────────── */
function afficherInfo(ep) {
  const fil  = ep.filieres;
  const etab = fil?.etablissements;
  const cat  = fil?.categorie;
  const icon = fil?.icone || CAT_ICONS[cat] || '📋';

  document.title = `${ep.matiere} ${ep.annee} — Fax Kalamundi`;
  document.getElementById('ep-icon').textContent    = icon;
  document.getElementById('ep-matiere').textContent = ep.matiere;
  document.getElementById('ep-filiere').textContent = fil?.nom || '—';

  document.getElementById('bc-filiere').textContent = fil?.nom || 'Filiere';
  document.getElementById('bc-matiere').textContent = ep.matiere;

  const badges = [
    `<span class="badge badge--annee">${ep.annee}</span>`,
    `<span class="badge badge--type">${TYPE_LABELS[ep.type_epreuve] || ep.type_epreuve}</span>`,
    etab ? `<span class="badge badge--etab">${etab.nom_court || etab.nom}</span>` : '',
    ep.semestre ? `<span class="badge badge--sem">${ep.semestre}</span>` : '',
  ];
  document.getElementById('ep-badges').innerHTML = badges.join('');
  document.getElementById('ep-stats').innerHTML =
    `<span>👁 ${(ep.nb_vues||0).toLocaleString('fr-FR')} vues</span>
     <span>⬇ ${(ep.nb_telechargements||0).toLocaleString('fr-FR')} téléchargements</span>`;

  document.getElementById('page-loader').style.display  = 'none';
  document.getElementById('page-content').style.display = 'block';
}

/* ── Afficher sujet ─────────────────────────────────────────── */
function afficherSujet(ep) {
  const zone = document.getElementById('sujet-zone');
  const btnDl = document.getElementById('btn-dl-sujet');

  if (ep.enonce_url) {
    btnDl.href = ep.enonce_url;
    btnDl.style.display = 'inline-flex';
    // Si c'est un PDF on l'embed
    if (ep.enonce_url.endsWith('.pdf')) {
      zone.innerHTML = `
        <div class="fax-viewer">
          <iframe src="${ep.enonce_url}" title="Sujet ${ep.matiere} ${ep.annee}"></iframe>
        </div>`;
    } else {
      zone.innerHTML = `
        <div style="text-align:center;padding:var(--spacing-lg)">
          <p style="color:var(--text-secondary);margin-bottom:var(--spacing-md)">
            Le sujet est disponible en téléchargement.
          </p>
          <a href="${ep.enonce_url}" target="_blank" class="btn btn--accent">
            Ouvrir le sujet
          </a>
        </div>`;
    }
  }
  // sinon le message "non disponible" reste
}

/* ── Afficher fax (corrigé) ─────────────────────────────────── */
async function afficherFax(ep, user) {
  const body  = document.getElementById('fax-body');
  const head  = document.getElementById('fax-head-label');
  const headR = document.getElementById('fax-head-right');

  if (!ep.a_corrige) {
    /* Pas de corrigé humain → générer avec IA */
    head.textContent = 'Corrige genere par IA';
    headR.innerHTML  = `<span class="badge" style="background:#f3e8ff;color:#6b21a8">Super Repetiteur IA</span>`;
    body.innerHTML   = rendreBlocIA(ep);
    return;
  }

  /* Chercher le corrigé en DB */
  let { data: corriges } = await supabase
    .from('corriges')
    .select('id, contenu_texte, fichier_url, source, statut, visible')
    .eq('epreuve_id', ep.id)
    .eq('visible', true)
    .order('source', { ascending: true }) // 'humain' < 'ia' alphabétiquement → humain en premier
    .limit(1);

  const corrige = corriges?.[0];
  if (!corrige) {
    body.innerHTML = rendreBlocIA(ep);
    return;
  }

  /* Vérifier accès premium */
  if (corrige.statut === 'premium') {
    const aAcces = await verifierAccesPremium(corrige.id, user);
    if (!aAcces) {
      body.innerHTML = rendreGatePremium(ep, corrige);
      headR.innerHTML = `<span class="badge" style="background:#fef9c3;color:#854d0e">Premium — 500 FCFA</span>`;
      return;
    }
  }

  /* Afficher le corrigé */
  const estIA = corrige.source === 'ia';
  head.textContent = estIA ? 'Corrige IA' : 'Corrige officiel (Fax)';
  headR.innerHTML  = estIA
    ? `<span class="badge" style="background:#f3e8ff;color:#6b21a8">IA</span>`
    : `<span class="badge" style="background:#dcfce7;color:#166534">Humain</span>`;

  if (corrige.fichier_url?.endsWith('.pdf')) {
    body.innerHTML = `
      <div class="fax-viewer">
        <iframe src="${corrige.fichier_url}" title="Corrige ${ep.matiere}"></iframe>
      </div>
      <div style="margin-top:var(--spacing-sm);text-align:right">
        <a href="${corrige.fichier_url}" target="_blank" class="btn btn--outline btn--sm">
          Telecharger le fax PDF
        </a>
      </div>`;
  } else if (corrige.contenu_texte) {
    body.innerHTML = `<div class="fax-texte" id="fax-texte">${escapeHtml(corrige.contenu_texte)}</div>`;
    if (corrige.fichier_url) {
      body.innerHTML += `
        <div style="margin-top:var(--spacing-sm);text-align:right">
          <a href="${corrige.fichier_url}" target="_blank" class="btn btn--outline btn--sm">
            Telecharger le fichier
          </a>
        </div>`;
    }
  } else {
    body.innerHTML = rendreBlocIA(ep);
  }

  enregistrerTelechargement(ep.id);
}

/* ── Bloc IA (bouton génération) ────────────────────────────── */
function rendreBlocIA(ep) {
  return `
    <div class="ia-zone" id="ia-zone">
      <div class="ia-zone__icon">🤖</div>
      <h3>Corrige non disponible</h3>
      <p>Aucun corrige humain pour cette epreuve.<br>
         Le Super Repetiteur IA peut en generer un en quelques secondes.</p>
      <button class="btn btn--accent" id="btn-gen-fax" data-ep-id="${ep.id}">
        Generer le corrige avec l'IA
      </button>
      <p style="font-size:11px;color:var(--text-light);margin-top:8px">
        Genere par claude-haiku · peut contenir des imprecisions — verifier avec ton prof
      </p>
    </div>
    <div class="ia-spinner" id="ia-spinner">
      <div class="spinner-ring"></div>
      <p style="color:var(--text-secondary)">Le Super Repetiteur redige le corrige…</p>
    </div>
    <div id="ia-result" style="display:none"></div>`;
}

/* ── Gate premium ───────────────────────────────────────────── */
function rendreGatePremium(ep, corrige) {
  const fil  = ep.filieres;
  const etab = fil?.etablissements;
  /* Aperçu flou des 3 premières lignes si contenu disponible */
  const preview = corrige.contenu_texte
    ? `<div class="fax-preview-blur"><div class="fax-texte">${escapeHtml(corrige.contenu_texte.slice(0, 600))}</div></div>`
    : `<div style="height:80px;background:var(--bg-secondary);border-radius:var(--border-radius-md);margin-bottom:var(--spacing-md)"></div>`;

  return `
    ${preview}
    <div class="premium-gate">
      <h3>Corrige premium</h3>
      <p>Ce corrige a ete prepare par un enseignant.
         Debloque-le une fois pour y acceder indefiniment.</p>
      <div class="price-badge">500 FCFA</div><br>
      <button class="btn btn--accent" id="btn-unlock-fax"
              data-corrige-id="${corrige.id}"
              data-ep-id="${ep.id}"
              data-matiere="${ep.matiere}"
              data-etab="${etab?.nom_court||''}">
        Debloquer ce fax — 500 FCFA
      </button>
      <p style="font-size:11px;color:var(--text-light);margin-top:8px">
        MTN MoMo · Orange Money · Express Union via Fapshi
      </p>
      <div style="margin-top:var(--spacing-md)">
        <button class="btn btn--outline btn--sm" id="btn-gen-fax-free" data-ep-id="${ep.id}">
          Utiliser le corrige IA gratuit
        </button>
      </div>
    </div>`;
}

/* ── Répétiteur strip ───────────────────────────────────────── */
function configRepetiteur(ep) {
  const fil      = ep.filieres;
  const matiere  = ep.matiere;
  const filNom   = fil?.nom || '';
  const cat      = fil?.categorie || '';

  document.getElementById('rep-matiere-label').textContent =
    `Revise "${matiere}" — ${filNom} — avec des QCM generes par l'IA.`;

  /* URL répétiteur avec pré-remplissage matière/filière */
  const repUrl = `/pages/repetiteur.html?matiere=${encodeURIComponent(matiere)}&filiere=${encodeURIComponent(filNom)}&cat=${encodeURIComponent(cat)}&mode=universite`;
  const simUrl = `/pages/examen-sim.html?matiere=${encodeURIComponent(matiere)}&mode=universite`;

  document.getElementById('btn-rep').href = repUrl;
  document.getElementById('btn-sim').href = simUrl;
}

/* ── Délégation événements dynamiques ───────────────────────── */
document.addEventListener('click', async e => {
  /* Bouton générer IA */
  if (e.target.id === 'btn-gen-fax' || e.target.id === 'btn-gen-fax-free') {
    const epId = e.target.dataset.epId;
    await genererFaxIA(epId);
  }
  /* Bouton débloquer premium */
  if (e.target.id === 'btn-unlock-fax') {
    const { corrigeId, epId, matiere, etab } = e.target.dataset;
    lancerPaiementPremium(corrigeId, epId, matiere, etab);
  }
});

/* ── Génération IA ──────────────────────────────────────────── */
async function genererFaxIA(epId) {
  /* Charger info épreuve pour le prompt */
  const { data: ep } = await supabase
    .from('epreuves')
    .select('matiere, annee, type_epreuve, semestre, description, filiere_id, filieres(nom, categorie)')
    .eq('id', epId)
    .single();

  if (!ep) return;

  const zone    = document.getElementById('ia-zone');
  const spinner = document.getElementById('ia-spinner');
  const result  = document.getElementById('ia-result');

  if (zone) zone.style.display = 'none';
  if (spinner) spinner.classList.add('visible');

  try {
    const res = await fetch('/api/generate-fax', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matiere:       ep.matiere,
        annee:         ep.annee,
        type_epreuve:  ep.type_epreuve,
        semestre:      ep.semestre,
        filiere:       ep.filieres?.nom || '',
        categorie:     ep.filieres?.categorie || '',
        description:   ep.description || '',
      }),
    });

    if (!res.ok) throw new Error('Erreur API : ' + res.status);
    const { contenu } = await res.json();

    if (spinner) spinner.classList.remove('visible');
    if (result) {
      result.style.display = 'block';
      result.innerHTML = `
        <div style="padding:var(--spacing-sm) 0 var(--spacing-md);display:flex;align-items:center;gap:8px">
          <span class="badge" style="background:#f3e8ff;color:#6b21a8">Super Repetiteur IA</span>
          <span style="font-size:12px;color:var(--text-secondary)">
            Verifie avec ton enseignant avant de te fier uniquement a ce corrige.
          </span>
        </div>
        <div class="fax-texte">${escapeHtml(contenu)}</div>
        <div style="margin-top:var(--spacing-md);display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="window.print()" class="btn btn--outline btn--sm">Imprimer</button>
          <button onclick="copierContenu()" class="btn btn--outline btn--sm">Copier le texte</button>
        </div>`;
    }

    /* Mise à jour flag a_corrige en DB (async, on s'en fiche si ça rate) */
    supabase.from('epreuves').update({ a_corrige: true }).eq('id', epId).then(() => {});

    /* Sauvegarder le corrigé IA */
    supabase.from('corriges').insert({
      epreuve_id:    epId,
      contenu_texte: contenu,
      source:        'ia',
      statut:        'gratuit',
      visible:       true,
    }).then(() => {});

  } catch (err) {
    if (spinner) spinner.classList.remove('visible');
    if (zone) {
      zone.style.display = 'flex';
      zone.querySelector('p').textContent = 'Erreur : ' + err.message + ' — Reessaie.';
    }
  }
}

/* ── Paiement premium ───────────────────────────────────────── */
function lancerPaiementPremium(corrigeId, epId, matiere, etab) {
  const redirectUrl = `${location.origin}/pages/fax.html?ep=${epId}&unlocked=1`;
  const payUrl = `/pages/payment.html?plan=fax&ref=${corrigeId}&montant=500&desc=${encodeURIComponent('Fax '+matiere+' '+etab)}&redirect=${encodeURIComponent(redirectUrl)}`;
  location.href = payUrl;
}

/* ── Accès premium ──────────────────────────────────────────── */
async function verifierAccesPremium(corrigeId, user) {
  if (!user) return false;
  const { data } = await supabase
    .from('acces_corriges')
    .select('id')
    .eq('user_id', user.id)
    .eq('corrige_id', corrigeId)
    .or('expire_at.is.null,expire_at.gt.' + new Date().toISOString())
    .maybeSingle();
  return !!data;
}

/* ── Compteurs ──────────────────────────────────────────────── */
function enregistrerVue(id) {
  supabase.rpc('incrementer_vue_epreuve', { ep_id: id }).catch(() => {});
}
function enregistrerTelechargement(id) {
  supabase.rpc('incrementer_telechargement_epreuve', { ep_id: id }).catch(() => {});
}

/* ── Erreur ─────────────────────────────────────────────────── */
function afficherErreur(msg) {
  document.getElementById('page-loader').style.display = 'none';
  document.getElementById('fax-page').innerHTML += `
    <div style="text-align:center;padding:4rem 1rem;color:var(--text-secondary)">
      <div style="font-size:3rem;margin-bottom:1rem">😕</div>
      <h3>${msg}</h3>
      <a href="/pages/epreuves.html" class="btn btn--accent" style="margin-top:1rem">
        Retour aux epreuves
      </a>
    </div>`;
}

/* ── Utilitaires ────────────────────────────────────────────── */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

window.copierContenu = function() {
  const texte = document.querySelector('.fax-texte')?.innerText || '';
  navigator.clipboard.writeText(texte).then(() => alert('Texte copie !'));
};
