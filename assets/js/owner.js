/* ============================================================
   owner.js — Owner Dashboard Kalamundi (mobile-first)
   ============================================================ */

import { api } from './api.js';
import { supabase } from './auth.js';

/* ── Auth guard + login intégré ─────────────────────────────── */
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { afficherLogin(); return; }
  const { data: profil } = await supabase.from('profiles').select('role').eq('id', session.user.id).single();
  if (profil?.role !== 'admin') { afficherAccesRefuse(); return; }
  masquerLogin();
  init();
})();

function afficherLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display    = 'none';
}

function masquerLogin() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'block';
}

function afficherAccesRefuse() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display    = 'none';
  document.getElementById('login-error').textContent    = 'Accès refusé — compte non admin.';
  document.getElementById('login-error').style.display  = 'block';
}

window.submitLogin = async function () {
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-pwd').value;
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');

  if (!email || !pwd) { errEl.textContent = 'Email et mot de passe requis.'; errEl.style.display = 'block'; return; }

  btn.disabled = true;
  btn.textContent = 'Connexion…';
  errEl.style.display = 'none';

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd });
    if (error) throw error;

    const { data: profil } = await supabase.from('profiles').select('role').eq('id', data.user.id).single();
    if (profil?.role !== 'admin') { throw new Error('Accès refusé — compte non admin.'); }

    masquerLogin();
    init();
  } catch (e) {
    errEl.textContent   = e.message || 'Identifiants incorrects.';
    errEl.style.display = 'block';
    btn.disabled    = false;
    btn.textContent = 'Se connecter';
  }
};

window.submitLogout = async function () {
  await supabase.auth.signOut();
  afficherLogin();
  document.getElementById('login-email').value = '';
  document.getElementById('login-pwd').value   = '';
};

async function init() {
  await Promise.all([chargerFinance(), chargerPub(), chargerConfig()]);
  // Croissance partage les données de finance, on le charge après
  chargerCroissance();
  chargerDonnees();
}

/* ── Navigation ─────────────────────────────────────────────── */
let _section = 'finance';

window.showSection = function (id, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('sec-' + id)?.classList.add('active');
  btn?.classList.add('active');
  _section = id;
  const fab = document.getElementById('fab');
  fab.classList.toggle('visible', id === 'pub');
};

window.rafraichir = function () {
  const map = {
    finance:    chargerFinance,
    croissance: chargerCroissance,
    donnees:    chargerDonnees,
    pub:        chargerPub,
    config:     chargerConfig,
  };
  map[_section]?.();
  toast('Actualisé ✓', 'success');
};

/* ── Finance ─────────────────────────────────────────────────── */
let _financeData = null;
let _ownerInsights = null;

async function chargerFinance() {
  const el = document.getElementById('finance-content');
  el.innerHTML = '<div class="loading">⏳ Chargement…</div>';
  try {
    _financeData = await api.adminGetFinance();
    const d = _financeData;
    const maxG = Math.max(...d.graphe.map(g => g.total), 1);

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card kpi-card--green">
          <div class="kpi-card__icon">💵</div>
          <div class="kpi-card__val">$${fmt(d.totalPaiements)}</div>
          <div class="kpi-card__lbl">Revenus bruts totaux</div>
        </div>
        <div class="kpi-card kpi-card--acc">
          <div class="kpi-card__icon">🏦</div>
          <div class="kpi-card__val">$${fmt(d.totalKalamundi)}</div>
          <div class="kpi-card__lbl">Part Kalamundi</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card__icon">✍️</div>
          <div class="kpi-card__val">$${fmt(d.totalAuteurs)}</div>
          <div class="kpi-card__lbl">Reversé auteurs</div>
        </div>
        <div class="kpi-card kpi-card--green">
          <div class="kpi-card__icon">📅</div>
          <div class="kpi-card__val">$${fmt(d.mrr)}</div>
          <div class="kpi-card__lbl">Ce mois</div>
        </div>
      </div>

      <div class="block">
        <div class="block__title">Revenus mensuels — 12 mois</div>
        <div class="bars">
          ${d.graphe.map(g => `
            <div class="bar-col">
              <div class="bar-col__val">${g.total > 0 ? '$'+fmt(g.total) : ''}</div>
              <div class="bar-col__bar" style="height:${Math.round((g.total/maxG)*70)+2}px"></div>
              <div class="bar-col__lbl">${g.label}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="block">
        <div class="block__title">Top 5 œuvres — lectures</div>
        ${d.topOeuvres.slice(0,5).map((o,i) => `
          <div class="list-row">
            <span>${i+1}. ${o.titre}</span>
            <span class="list-row__val">${(o.nb_lectures||0).toLocaleString('fr-FR')}</span>
          </div>`).join('') || '<div style="color:var(--text3);font-size:13px">Aucune donnée</div>'}
      </div>`;
  } catch (e) { const msg = e?.message || e?.toString() || JSON.stringify(e); alert('FINANCE ERR: ' + msg); el.innerHTML = errEl('Erreur: ' + msg); }
}

/* ── Croissance ──────────────────────────────────────────────── */
async function chargerCroissance() {
  const el = document.getElementById('croissance-content');
  el.innerHTML = '<div class="loading">⏳ Chargement…</div>';
  try {
    const d = _financeData || await api.adminGetFinance();
    _financeData = d;
    const maxU = Math.max(...d.usersParMois.map(u => u.count), 1);

    el.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card kpi-card--green">
          <div class="kpi-card__icon">👥</div>
          <div class="kpi-card__val">${d.totalUsers.toLocaleString('fr-FR')}</div>
          <div class="kpi-card__lbl">Utilisateurs totaux</div>
        </div>
        <div class="kpi-card kpi-card--acc">
          <div class="kpi-card__icon">🆕</div>
          <div class="kpi-card__val">${d.usersParMois.at(-1)?.count || 0}</div>
          <div class="kpi-card__lbl">Nouveaux ce mois</div>
        </div>
      </div>

      <div class="block">
        <div class="block__title">Nouveaux utilisateurs — 6 mois</div>
        <div class="bars">
          ${d.usersParMois.map(u => `
            <div class="bar-col">
              <div class="bar-col__val">${u.count || ''}</div>
              <div class="bar-col__bar" style="height:${Math.round((u.count/maxU)*70)+2}px;background:#D4A017"></div>
              <div class="bar-col__lbl">${u.label}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="block">
        <div class="block__title">Top pays</div>
        ${d.topPays.length ? d.topPays.map((p, i) => {
          const pct = Math.round((p.count / d.totalUsers) * 100);
          return `
            <div class="list-row" style="flex-direction:column;align-items:stretch;gap:4px">
              <div style="display:flex;justify-content:space-between;font-size:13px">
                <span>${i+1}. ${p.pays || 'Inconnu'}</span>
                <strong>${p.count} <span style="color:var(--text3);font-weight:400">(${pct}%)</span></strong>
              </div>
              <div class="progress"><div class="progress__fill" style="width:${pct}%"></div></div>
            </div>`;
        }).join('') : '<div style="color:var(--text3);font-size:13px">Aucune donnée pays.</div>'}
      </div>`;
  } catch (e) { el.innerHTML = errEl('Erreur croissance'); console.error(e); }
}

/* ── Données commercialisables ───────────────────────────────── */
async function chargerDonnees() {
  const el = document.getElementById('donnees-content');
  if (!el) return;
  el.innerHTML = '<div class="loading">⏳ Analyse des données…</div>';
  try {
    _ownerInsights = await api.adminGetOwnerInsights();
    const d = _ownerInsights;
    const k = d.kpis || {};
    const seg = d.segments || {};
    const lists = d.lists || {};

    el.innerHTML = `
      <div class="toolbar">
        <button class="btn-sm btn-primary" onclick="exporterDataset('audience','csv')">Audience CSV</button>
        <button class="btn-sm btn-primary" onclick="exporterDataset('catalogue','csv')">Catalogue CSV</button>
        <button class="btn-sm btn-primary" onclick="exporterDataset('segments','csv')">Segments CSV</button>
        <button class="btn-sm btn-toggle" onclick="exporterDataset('all','json')">Tout JSON</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card kpi-card--green">
          <div class="kpi-card__icon">🎯</div>
          <div class="kpi-card__val">${fmt0(k.active30)}</div>
          <div class="kpi-card__lbl">Actifs 30 jours</div>
        </div>
        <div class="kpi-card kpi-card--acc">
          <div class="kpi-card__icon">🛒</div>
          <div class="kpi-card__val">${pct(k.conversion)}</div>
          <div class="kpi-card__lbl">Conversion payante</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-card__icon">📚</div>
          <div class="kpi-card__val">${fmt0(k.totalLectures)}</div>
          <div class="kpi-card__lbl">Lectures cumulées</div>
        </div>
        <div class="kpi-card kpi-card--green">
          <div class="kpi-card__icon">💳</div>
          <div class="kpi-card__val">${fmt(k.arpu)}</div>
          <div class="kpi-card__lbl">ARPU global</div>
        </div>
      </div>

      ${renderActionsCommerciales(d)}

      <div class="block">
        <div class="block__title">Segments vendables</div>
        <div class="mini-note">Ces segments peuvent servir à préparer offres sponsorisées, packs éditeurs, écoles, concours ou campagnes publicitaires.</div>
        ${renderSegments(seg.marketableSegments || [])}
      </div>

      <div class="block">
        <div class="block__title">Demande par genre</div>
        ${renderGenreDemand(seg.lecturesParGenre || [])}
      </div>

      <div class="block">
        <div class="block__title">Top auteurs exploitables</div>
        ${renderTopAuteurs(lists.topAuteurs || [])}
      </div>

      <div class="block">
        <div class="block__title">Inventaire publicitaire</div>
        ${renderAdInventory(lists.adInventory || [])}
      </div>`;
  } catch (e) {
    el.innerHTML = errEl('Erreur données');
    console.error(e);
  }
}

function renderActionsCommerciales(d) {
  const k = d.kpis || {};
  const seg = d.segments || {};
  const topGenre = seg.lecturesParGenre?.[0];
  const topPays = seg.paysUsers?.[0];
  const ideas = [];

  if (topGenre) {
    ideas.push({
      title: `Pack sponsorisé "${topGenre.genre}"`,
      body: `${fmt0(topGenre.lectures)} lectures sur ${fmt0(topGenre.oeuvres)} œuvres. Bon angle pour éditeurs, concours littéraires et marques culturelles.`,
    });
  }
  if (topPays) {
    ideas.push({
      title: `Offre locale ${topPays.label}`,
      body: `${fmt0(topPays.count)} profils. Segment utile pour écoles, librairies, évènements et annonceurs géolocalisés.`,
    });
  }
  if (Number(k.active30 || 0) > 0) {
    ideas.push({
      title: 'Audience active 30 jours',
      body: `${fmt0(k.active30)} utilisateurs récents. À vendre comme inventaire prioritaire, newsletter ou notification sponsorisée.`,
    });
  }
  if (Number(k.paidUsers || 0) > 0) {
    ideas.push({
      title: 'Acheteurs confirmés',
      body: `${fmt0(k.paidUsers)} utilisateurs ont déjà payé. Segment précieux pour upsell abonnements, premium, formations et offres partenaires.`,
    });
  }

  return `
    <div class="block">
      <div class="block__title">Pistes commerciales prioritaires</div>
      ${ideas.map(i => `
        <div class="insight-card">
          <div class="insight-card__title">${escapeHtml(i.title)}</div>
          <div class="insight-card__body">${escapeHtml(i.body)}</div>
        </div>`).join('') || '<div class="mini-note">Pas encore assez de données pour proposer des pistes fiables.</div>'}
    </div>`;
}

function renderSegments(rows) {
  if (!rows.length) return '<div class="mini-note">Aucun segment exploitable pour le moment.</div>';
  return `
    <table class="data-table">
      <thead><tr><th>Segment</th><th>Usage</th><th>Taille</th></tr></thead>
      <tbody>${rows.slice(0, 12).map(r => `
        <tr>
          <td>${escapeHtml(r.segment)}</td>
          <td>${escapeHtml(r.angle)}</td>
          <td>${fmt0(r.taille)}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function renderGenreDemand(rows) {
  if (!rows.length) return '<div class="mini-note">Aucune lecture par genre disponible.</div>';
  const max = Math.max(...rows.map(r => r.lectures), 1);
  return rows.slice(0, 8).map(r => {
    const pctWidth = Math.max(4, Math.round((r.lectures / max) * 100));
    return `
      <div class="list-row" style="flex-direction:column;align-items:stretch;gap:4px">
        <div style="display:flex;justify-content:space-between;font-size:13px">
          <span>${escapeHtml(r.genre)} <span class="pill">${fmt0(r.oeuvres)} œuvres</span></span>
          <strong>${fmt0(r.lectures)} lectures</strong>
        </div>
        <div class="progress"><div class="progress__fill" style="width:${pctWidth}%"></div></div>
      </div>`;
  }).join('');
}

function renderTopAuteurs(rows) {
  if (!rows.length) return '<div class="mini-note">Aucun auteur exploitable pour le moment.</div>';
  return `
    <table class="data-table">
      <thead><tr><th>Auteur</th><th>Pays</th><th>Œuvres</th><th>Lectures</th></tr></thead>
      <tbody>${rows.slice(0, 10).map(a => `
        <tr>
          <td>${escapeHtml(a.nom)}</td>
          <td>${escapeHtml(a.pays || '-')}</td>
          <td>${fmt0(a.oeuvres)} / ${fmt0(a.premium)} premium</td>
          <td>${fmt0(a.lectures)}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

function renderAdInventory(rows) {
  if (!rows.length) return '<div class="mini-note">Aucune bannière publicitaire suivie.</div>';
  return `
    <table class="data-table">
      <thead><tr><th>Campagne</th><th>Page</th><th>État</th><th>CTR</th></tr></thead>
      <tbody>${rows.slice(0, 10).map(b => `
        <tr>
          <td>${escapeHtml(b.titre || 'Sans titre')}</td>
          <td>${escapeHtml(b.page || 'all')}</td>
          <td>${b.actif ? '<span class="badge-on">ON</span>' : '<span class="badge-off">OFF</span>'}</td>
          <td>${fmt0(b.impressions)} vues<br>${pct(b.ctr)}</td>
        </tr>`).join('')}</tbody>
    </table>`;
}

/* ── Pub ─────────────────────────────────────────────────────── */
async function chargerPub() {
  const el = document.getElementById('pub-content');
  el.innerHTML = '<div class="loading">⏳ Chargement…</div>';
  document.getElementById('fab').classList.toggle('visible', _section === 'pub');
  try {
    const bannieres = await api.pubGetBannieres();

    if (!bannieres.length) {
      el.innerHTML = `
        <div class="loading">
          <div style="font-size:40px;margin-bottom:12px">📢</div>
          <div style="font-weight:700;margin-bottom:8px">Aucune bannière</div>
          <div style="font-size:13px;color:var(--text3)">Appuyez sur + pour créer votre première campagne</div>
        </div>`;
      return;
    }

    const actives = bannieres.filter(b => b.actif).length;
    el.innerHTML = `
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px">
        ${actives} active(s) · ${bannieres.length} total
      </div>
      ${bannieres.map(b => `
        <div class="pub-card" id="pcard-${b.id}">
          <div class="pub-card__img">
            ${b.image_url
              ? `<img src="${b.image_url}" alt="${b.titre}" loading="lazy" onerror="this.parentElement.textContent='Image indisponible'" />`
              : '🖼️ Aucune image'}
          </div>
          <div class="pub-card__body">
            <div class="pub-card__titre">
              ${b.titre}
              <span class="${b.actif ? 'badge-on' : 'badge-off'}" style="margin-left:6px">
                ${b.actif ? 'ON' : 'OFF'}
              </span>
            </div>
            <div class="pub-card__meta">Page : ${b.page_cible || 'all'}
              ${b.date_fin ? ` · Expire ${new Date(b.date_fin).toLocaleDateString('fr-FR')}` : ''}
            </div>
            <div class="pub-card__stats">
              <span>👁 ${(b.impressions||0).toLocaleString('fr-FR')}</span>
              <span>🖱 ${(b.clics||0).toLocaleString('fr-FR')}</span>
              <span>CTR ${b.impressions > 0 ? ((b.clics/b.impressions)*100).toFixed(1) : '0'}%</span>
            </div>
            <div class="pub-card__actions">
              <button class="btn-sm ${b.actif ? 'btn-toggle' : 'btn-success'}"
                onclick="toggleBanniere('${b.id}', ${!b.actif})">
                ${b.actif ? '⏸ Désactiver' : '▶ Activer'}
              </button>
              <button class="btn-sm btn-danger"
                onclick="supprimerBanniere('${b.id}')">
                🗑
              </button>
            </div>
          </div>
        </div>`).join('')}`;
  } catch (e) { el.innerHTML = errEl('Erreur pub'); console.error(e); }
}

/* ── Config ──────────────────────────────────────────────────── */
async function chargerConfig() {
  const el = document.getElementById('config-content');
  el.innerHTML = '<div class="loading">⏳ Chargement…</div>';
  try {
    const configs = await api.configGetAll();
    if (!configs.length) {
      el.innerHTML = errEl('Table config manquante — appliquez la migration SQL.');
      return;
    }
    el.innerHTML = `
      <div class="block">
        <div class="block__title">Paramètres plateforme</div>
        ${configs.map(c => `
          <div style="margin-bottom:14px">
            <label style="font-size:11px;color:var(--text3);font-family:monospace">${c.cle}</label>
            <div style="font-size:12px;color:var(--text2);margin-bottom:6px">${c.description || ''}</div>
            <div class="cfg-row">
              <input class="cfg-input" id="cfg-${c.cle}" type="text" value="${c.valeur || ''}" />
              <button class="cfg-save" onclick="sauvegarderConfig('${c.cle}')">✓</button>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (e) { el.innerHTML = errEl('Erreur config'); console.error(e); }
}

/* ── Pub CRUD ────────────────────────────────────────────────── */
window.ouvrirModalePub = function (b = null) {
  document.getElementById('pub-id').value    = b?.id || '';
  document.getElementById('pub-titre').value = b?.titre || '';
  document.getElementById('pub-image').value = b?.image_url || '';
  document.getElementById('pub-lien').value  = b?.lien_cible || '';
  document.getElementById('pub-cta').value   = b?.texte_cta || 'En savoir plus';
  document.getElementById('pub-page').value  = b?.page_cible || 'all';
  document.getElementById('pub-debut').value = b?.date_debut || '';
  document.getElementById('pub-fin').value   = b?.date_fin || '';
  document.getElementById('modal-titre').textContent = b ? 'Modifier bannière' : 'Nouvelle bannière';
  document.getElementById('modal-pub').classList.add('open');
};

window.fermerModal = function (e) {
  if (!e || e.target === document.getElementById('modal-pub'))
    document.getElementById('modal-pub').classList.remove('open');
};

window.sauvegarderBanniere = async function () {
  const id       = document.getElementById('pub-id').value;
  const titre    = document.getElementById('pub-titre').value.trim();
  if (!titre) { toast('Titre requis', 'error'); return; }

  const champs = {
    titre,
    image_url:   document.getElementById('pub-image').value.trim(),
    lien_cible:  document.getElementById('pub-lien').value.trim(),
    texte_cta:   document.getElementById('pub-cta').value.trim() || 'En savoir plus',
    page_cible:  document.getElementById('pub-page').value,
    date_debut:  document.getElementById('pub-debut').value || null,
    date_fin:    document.getElementById('pub-fin').value || null,
  };

  try {
    if (id) { await api.pubUpdateBanniere(id, champs); toast('Mise à jour ✅', 'success'); }
    else     { await api.pubCreerBanniere({ ...champs, actif: true }); toast('Bannière créée ✅', 'success'); }
    fermerModal();
    chargerPub();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

window.toggleBanniere = async function (id, actif) {
  try {
    await api.pubUpdateBanniere(id, { actif });
    toast(actif ? 'Activée ✅' : 'Désactivée', 'success');
    chargerPub();
  } catch { toast('Erreur', 'error'); }
};

window.supprimerBanniere = async function (id) {
  if (!confirm('Supprimer cette bannière ?')) return;
  try {
    await api.pubSupprimerBanniere(id);
    toast('Supprimée', 'success');
    chargerPub();
  } catch { toast('Erreur', 'error'); }
};

/* ── Config save ─────────────────────────────────────────────── */
window.sauvegarderConfig = async function (cle) {
  const input = document.getElementById('cfg-' + cle);
  if (!input) return;
  try {
    await api.configSet(cle, input.value.trim());
    toast(cle + ' mis à jour ✅', 'success');
    input.style.borderColor = 'var(--green)';
    setTimeout(() => { input.style.borderColor = ''; }, 2000);
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

/* ── Utilitaires ─────────────────────────────────────────────── */
function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmt0(n) {
  return Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

function pct(n) {
  return `${Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })}%`;
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.exporterDataset = function (nom, format = 'csv') {
  if (!_ownerInsights) {
    toast('Données pas encore chargées', 'error');
    return;
  }
  if (format === 'json') {
    telecharger(
      `kalamundi_owner_${dateStamp()}.json`,
      JSON.stringify(_ownerInsights, null, 2),
      'application/json'
    );
    return;
  }
  const data = _ownerInsights.exports?.[nom] || [];
  if (!data.length) {
    toast('Aucune donnée à exporter', 'error');
    return;
  }
  telecharger(`kalamundi_${nom}_${dateStamp()}.csv`, toCsv(data), 'text/csv;charset=utf-8');
  toast('Export prêt ✓', 'success');
};

function toCsv(rows) {
  const headers = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const esc = value => {
    const text = String(value ?? '');
    return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    headers.join(';'),
    ...rows.map(row => headers.map(h => esc(row[h])).join(';')),
  ].join('\n');
}

function telecharger(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function errEl(msg) {
  return `<div class="loading">⚠️<br><span style="font-size:13px">${msg}</span></div>`;
}

function toast(msg, type = 'info') {
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast-item ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
