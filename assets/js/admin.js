/* ============================================================
   admin.js — Dashboard Administration Kalamundi
   Accès réservé : role === 'admin'
   ============================================================ */

import { getSession } from './auth.js';
import { api } from './api.js';

/* ============================================================
   Init
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const session = await getSession();
  if (!session) { window.location.href = '/pages/login.html'; return; }

  const profil = await api.getProfil(session.user.id);
  if (profil?.role !== 'admin') {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px">
        <div style="font-size:48px">🚫</div>
        <h1 style="color:#1B4332">Accès réservé</h1>
        <p style="color:#888">Cette page est réservée aux administrateurs Kalamundi.</p>
        <a href="/index.html" class="btn btn--primary">Retour à l'accueil</a>
      </div>`;
    return;
  }

  document.getElementById('admin-nom').textContent = profil.nom || 'Admin';
  document.getElementById('last-update').textContent =
    'Mis à jour : ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  await chargerStats();
  chargerOeuvres();
  chargerSignalements();
  chargerUsers();
  chargerInstitutions();
  chargerPaiements();
  chargerFinance();
  chargerPub();
  chargerConfig();
  chargerLitiges();
  chargerPromotions();
  chargerCampagnesVente();
  chargerSelectOeuvresCampagne();
});

/* ============================================================
   Navigation sections
   ============================================================ */

window.showSection = function (id, btn) {
  document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.sidebar__btn').forEach(b => b.classList.remove('active'));
  document.getElementById('section-' + id)?.classList.add('active');
  btn?.classList.add('active');
};

/* ============================================================
   Stats globales
   ============================================================ */

async function chargerStats() {
  try {
    const s = await api.adminGetStats();
    document.getElementById('s-oeuvres').textContent      = s.totalOeuvres;
    document.getElementById('s-users').textContent        = s.totalUsers;
    document.getElementById('s-signalements').textContent = s.signalementsOuverts;
    document.getElementById('s-institutions').textContent = s.institutionsAttente;

    if (s.signalementsOuverts > 0) {
      const b = document.getElementById('badge-signalements');
      b.textContent = s.signalementsOuverts; b.style.display = '';
    }
    if (s.institutionsAttente > 0) {
      const b = document.getElementById('badge-institutions');
      b.textContent = s.institutionsAttente; b.style.display = '';
    }
  } catch (e) { console.error(e); }
}

/* ============================================================
   Finance & Revenus
   ============================================================ */

window.chargerFinance = async function () {
  const el = document.getElementById('finance-content');
  el.innerHTML = loading();
  try {
    const d = await api.adminGetFinance();
    const maxGraphe = Math.max(...d.graphe.map(g => g.total), 1);

    el.innerHTML = `
      <div class="stat-grid" style="margin-bottom:var(--spacing-lg)">
        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">💵</div>
          <div class="stat-card__val">$${fmtMoney(d.totalPaiements)}</div>
          <div class="stat-card__label">Revenus bruts totaux</div>
        </div>
        <div class="stat-card stat-card--accent">
          <div class="stat-card__icon">🏦</div>
          <div class="stat-card__val">$${fmtMoney(d.totalKalamundi)}</div>
          <div class="stat-card__label">Part Kalamundi (50%)</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon">✍️</div>
          <div class="stat-card__val">$${fmtMoney(d.totalAuteurs)}</div>
          <div class="stat-card__label">Reversé aux auteurs</div>
        </div>
        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">📅</div>
          <div class="stat-card__val">$${fmtMoney(d.mrr)}</div>
          <div class="stat-card__label">Revenus ce mois</div>
        </div>
      </div>

      <div class="card-block" style="margin-bottom:var(--spacing-lg)">
        <h3>Revenus mensuels — 12 derniers mois</h3>
        <div class="bar-chart">
          ${d.graphe.map(g => `
            <div class="bar-chart__col">
              <div class="bar-chart__val">$${g.total > 0 ? fmtMoney(g.total) : '0'}</div>
              <div class="bar-chart__bar" style="height:${Math.round((g.total / maxGraphe) * 100)}px" title="${g.label}: $${g.total}"></div>
              <div class="bar-chart__label">${g.label}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="card-block">
        <h3>Top 10 œuvres par lectures</h3>
        <table class="admin-table">
          <thead><tr><th>#</th><th>Titre</th><th>Auteur</th><th>Genre</th><th>Lectures</th></tr></thead>
          <tbody>
            ${d.topOeuvres.map((o, i) => `
              <tr>
                <td style="color:var(--text-light);font-weight:700">${i + 1}</td>
                <td><a href="/pages/work.html?id=${o.id}" target="_blank" style="color:var(--color-primary)">${o.titre}</a></td>
                <td>${o.profiles?.nom || '—'}</td>
                <td>${o.genre || '—'}</td>
                <td><strong>${(o.nb_lectures || 0).toLocaleString('fr-FR')}</strong></td>
              </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--text-light)">Aucune donnée</td></tr>'}
          </tbody>
        </table>
      </div>`;
  } catch (e) { el.innerHTML = erreur('Impossible de charger les données finance.'); console.error(e); }
};

/* ============================================================
   Croissance
   ============================================================ */

window.chargerCroissance = async function () {
  const el = document.getElementById('croissance-content');
  el.innerHTML = loading();
  try {
    const d = await api.adminGetFinance();
    const maxUsers = Math.max(...d.usersParMois.map(u => u.count), 1);
    const totalUsers = d.usersParMois.reduce((s, u) => s + u.count, 0);

    el.innerHTML = `
      <div class="stat-grid" style="margin-bottom:var(--spacing-lg)">
        <div class="stat-card stat-card--green">
          <div class="stat-card__icon">👥</div>
          <div class="stat-card__val">${d.totalUsers.toLocaleString('fr-FR')}</div>
          <div class="stat-card__label">Utilisateurs totaux</div>
        </div>
        <div class="stat-card stat-card--accent">
          <div class="stat-card__icon">🆕</div>
          <div class="stat-card__val">${(d.usersParMois[d.usersParMois.length - 1]?.count || 0)}</div>
          <div class="stat-card__label">Nouveaux ce mois</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__icon">📖</div>
          <div class="stat-card__val">${d.topOeuvres.reduce((s, o) => s + (o.nb_lectures || 0), 0).toLocaleString('fr-FR')}</div>
          <div class="stat-card__label">Total lectures (top 10)</div>
        </div>
      </div>

      <div class="cards-2">
        <div class="card-block">
          <h3>Nouveaux utilisateurs — 6 derniers mois</h3>
          <div class="bar-chart">
            ${d.usersParMois.map(u => `
              <div class="bar-chart__col">
                <div class="bar-chart__val">${u.count}</div>
                <div class="bar-chart__bar" style="height:${Math.round((u.count / maxUsers) * 100)}px;background:var(--color-accent)"></div>
                <div class="bar-chart__label">${u.label}</div>
              </div>`).join('')}
          </div>
        </div>

        <div class="card-block">
          <h3>Top 5 pays</h3>
          ${d.topPays.length ? `
            <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
              ${d.topPays.map((p, i) => {
                const pct = Math.round((p.count / d.totalUsers) * 100);
                return `
                  <div>
                    <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                      <span>${i + 1}. ${p.pays || 'Inconnu'}</span>
                      <span style="font-weight:700">${p.count} <span style="color:var(--text-light);font-weight:400">(${pct}%)</span></span>
                    </div>
                    <div style="height:6px;background:var(--bg-secondary);border-radius:99px">
                      <div style="height:6px;width:${pct}%;background:var(--color-primary-light);border-radius:99px"></div>
                    </div>
                  </div>`;
              }).join('')}
            </div>
          ` : '<p style="color:var(--text-light);font-size:13px">Aucune donnée pays disponible.</p>'}
        </div>
      </div>`;
  } catch (e) { el.innerHTML = erreur('Impossible de charger les données de croissance.'); console.error(e); }
};

/* ============================================================
   Régie Publicitaire
   ============================================================ */

window.chargerPub = async function () {
  const el = document.getElementById('pub-content');
  el.innerHTML = loading();
  try {
    const bannieres = await api.pubGetBannieres();
    if (!bannieres.length) {
      el.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📢</div>
          <p class="empty-state__title">Aucune bannière créée</p>
          <p class="empty-state__subtitle">Créez votre première bannière publicitaire</p>
          <button class="btn btn--primary" onclick="ouvrirModalePub()">+ Nouvelle bannière</button>
        </div>`;
      return;
    }

    el.innerHTML = `
      <div style="margin-bottom:var(--spacing-md);font-size:var(--font-size-sm);color:var(--text-secondary)">
        ${bannieres.filter(b => b.actif).length} bannière(s) active(s) sur ${bannieres.length} au total
      </div>
      <div class="pub-grid">
        ${bannieres.map(b => `
          <div class="pub-card" id="pub-card-${b.id}">
            <div class="pub-card__img">
              ${b.image_url
                ? `<img src="${b.image_url}" alt="${b.titre}" onerror="this.parentElement.textContent='Image non disponible'" />`
                : '🖼️ Aucune image'}
            </div>
            <div class="pub-card__body">
              <div class="pub-card__titre">
                ${b.titre}
                <span class="pub-badge ${b.actif ? 'pub-badge--on' : 'pub-badge--off'}" style="margin-left:6px">
                  ${b.actif ? 'ACTIVE' : 'INACTIVE'}
                </span>
              </div>
              <div class="pub-card__meta">
                Page : <strong>${b.page_cible || 'all'}</strong>
                ${b.date_debut ? ` · Du ${new Date(b.date_debut).toLocaleDateString('fr-FR')}` : ''}
                ${b.date_fin   ? ` au ${new Date(b.date_fin).toLocaleDateString('fr-FR')}` : ''}
              </div>
              <div class="pub-card__stats">
                <span>👁 ${(b.impressions || 0).toLocaleString('fr-FR')} imp.</span>
                <span>🖱 ${(b.clics || 0).toLocaleString('fr-FR')} clics</span>
                <span>📊 CTR ${b.impressions > 0 ? ((b.clics / b.impressions) * 100).toFixed(1) : '0'}%</span>
              </div>
              <div class="pub-card__actions">
                <button class="btn-xs ${b.actif ? 'btn-warning' : 'btn-success'}"
                  onclick="toggleBanniere('${b.id}', ${!b.actif})">
                  ${b.actif ? '⏸ Désactiver' : '▶ Activer'}
                </button>
                <button class="btn-xs btn-muted" onclick="editerBanniere(${JSON.stringify(b).replace(/"/g, '&quot;')})">
                  ✏️ Éditer
                </button>
                <button class="btn-xs btn-danger" onclick="supprimerBanniere('${b.id}')">
                  🗑 Supprimer
                </button>
              </div>
            </div>
          </div>`).join('')}
      </div>`;
  } catch (e) { el.innerHTML = erreur('Impossible de charger les bannières.'); console.error(e); }
};

window.ouvrirModalePub = function (banniere = null) {
  document.getElementById('pub-edit-id').value   = banniere?.id || '';
  document.getElementById('pub-titre').value     = banniere?.titre || '';
  document.getElementById('pub-image-url').value = banniere?.image_url || '';
  document.getElementById('pub-lien').value      = banniere?.lien_cible || '';
  document.getElementById('pub-cta').value       = banniere?.texte_cta || 'En savoir plus';
  document.getElementById('pub-page').value      = banniere?.page_cible || 'all';
  document.getElementById('pub-debut').value     = banniere?.date_debut || '';
  document.getElementById('pub-fin').value       = banniere?.date_fin || '';
  document.getElementById('modal-pub-titre').textContent = banniere ? 'Modifier la bannière' : 'Nouvelle bannière';
  document.getElementById('modal-pub').classList.add('open');
};

window.fermerModalePub = function (e) {
  if (!e || e.target === document.getElementById('modal-pub'))
    document.getElementById('modal-pub').classList.remove('open');
};

window.editerBanniere = function (b) { ouvrirModalePub(b); };

window.sauvegarderBanniere = async function () {
  const id        = document.getElementById('pub-edit-id').value;
  const titre     = document.getElementById('pub-titre').value.trim();
  const image_url = document.getElementById('pub-image-url').value.trim();
  const lien_cible = document.getElementById('pub-lien').value.trim();
  const texte_cta = document.getElementById('pub-cta').value.trim() || 'En savoir plus';
  const page_cible = document.getElementById('pub-page').value;
  const date_debut = document.getElementById('pub-debut').value || null;
  const date_fin   = document.getElementById('pub-fin').value || null;

  if (!titre) { toast('Le titre est requis.', 'error'); return; }

  try {
    if (id) {
      await api.pubUpdateBanniere(id, { titre, image_url, lien_cible, texte_cta, page_cible, date_debut, date_fin });
      toast('Bannière mise à jour ✅', 'success');
    } else {
      await api.pubCreerBanniere({ titre, image_url, lien_cible, texte_cta, page_cible, date_debut, date_fin, actif: true });
      toast('Bannière créée ✅', 'success');
    }
    fermerModalePub();
    chargerPub();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

window.toggleBanniere = async function (id, actif) {
  try {
    await api.pubUpdateBanniere(id, { actif });
    toast(actif ? 'Bannière activée.' : 'Bannière désactivée.', 'success');
    chargerPub();
  } catch { toast('Erreur.', 'error'); }
};

window.supprimerBanniere = async function (id) {
  if (!confirm('Supprimer cette bannière définitivement ?')) return;
  try {
    await api.pubSupprimerBanniere(id);
    toast('Bannière supprimée.', 'info');
    chargerPub();
  } catch { toast('Erreur.', 'error'); }
};

/* ============================================================
   Configuration plateforme
   ============================================================ */

window.chargerConfig = async function () {
  const el = document.getElementById('config-content');
  el.innerHTML = loading();
  try {
    const configs = await api.configGetAll();
    if (!configs.length) { el.innerHTML = erreur('Table config_plateforme introuvable. Appliquez la migration SQL.'); return; }

    el.innerHTML = `
      <div class="config-list">
        ${configs.map(c => `
          <div class="config-row">
            <div>
              <div class="config-row__cle">${c.cle}</div>
            </div>
            <div class="config-row__desc">${c.description || ''}</div>
            <div class="config-row__input">
              <input type="text" id="cfg-${c.cle}" value="${c.valeur || ''}"
                placeholder="Valeur..."
                onkeydown="if(event.key==='Enter') sauvegarderConfig('${c.cle}')" />
              <button class="btn-xs btn-success" onclick="sauvegarderConfig('${c.cle}')">✓</button>
            </div>
          </div>`).join('')}
      </div>
      <p style="margin-top:var(--spacing-lg);font-size:11px;color:var(--text-light)">
        Appuyez sur Entrée ou cliquez ✓ pour sauvegarder chaque valeur individuellement.
      </p>`;
  } catch (e) { el.innerHTML = erreur('Impossible de charger la config. Vérifiez que la migration SQL a été appliquée.'); console.error(e); }
};

window.sauvegarderConfig = async function (cle) {
  const input = document.getElementById('cfg-' + cle);
  if (!input) return;
  try {
    await api.configSet(cle, input.value.trim());
    toast(`"${cle}" mis à jour ✅`, 'success');
    input.style.borderColor = 'var(--color-success)';
    setTimeout(() => { input.style.borderColor = ''; }, 2000);
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

/* ============================================================
   Oeuvres
   ============================================================ */

window.chargerOeuvres = async function () {
  const el = document.getElementById('table-oeuvres');
  el.innerHTML = loading();
  try {
    const { data } = await api.adminGetOeuvres({ limit: 50 });
    if (!data?.length) { el.innerHTML = vide('Aucune œuvre.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Titre</th><th>Auteur</th><th>Genre</th>
          <th>Statut</th><th>Lectures</th><th>Visible</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(o => `
          <tr id="row-o-${o.id}">
            <td><a href="/pages/work.html?id=${o.id}" target="_blank" style="color:var(--color-primary)">${o.titre}</a></td>
            <td>${o.profiles?.nom || '—'}</td>
            <td>${o.genre || '—'}</td>
            <td><span class="badge ${o.statut === 'premium' ? 'badge--premium' : 'badge--gratuit'}">${o.statut}</span></td>
            <td>${(o.nb_lectures || 0).toLocaleString('fr-FR')}</td>
            <td>${o.visible ? '✅' : '❌'}</td>
            <td>
              <button class="btn-xs ${o.visible ? 'btn-danger' : 'btn-success'}"
                onclick="toggleVisible('${o.id}', ${!o.visible})">
                ${o.visible ? 'Masquer' : 'Afficher'}
              </button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { el.innerHTML = vide('Erreur de chargement.'); }
};

window.toggleVisible = async function (id, visible) {
  try {
    await api.adminToggleVisible(id, visible);
    toast(visible ? 'Œuvre rendue visible.' : 'Œuvre masquée.', 'success');
    chargerOeuvres();
  } catch { toast('Erreur.', 'error'); }
};

/* ============================================================
   Signalements
   ============================================================ */

window.chargerSignalements = async function () {
  const el = document.getElementById('table-signalements');
  el.innerHTML = loading();
  try {
    const data = await api.adminGetSignalements();
    if (!data?.length) { el.innerHTML = vide('Aucun signalement.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Œuvre</th><th>Signalé par</th><th>Motif</th>
          <th>Statut</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(s => `
          <tr>
            <td><a href="/pages/work.html?id=${s.oeuvres?.id}" target="_blank" style="color:var(--color-primary)">${s.oeuvres?.titre || '—'}</a></td>
            <td>${s.profiles?.nom || '—'}</td>
            <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.motif}</td>
            <td><span class="badge ${s.statut === 'ouvert' ? 'badge--warning' : 'badge--gratuit'}">${s.statut}</span></td>
            <td style="color:var(--text-light);font-size:11px">${new Date(s.created_at).toLocaleDateString('fr-FR')}</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">
              ${s.statut === 'ouvert' ? `
                <button class="btn-xs btn-success" onclick="traiterSignalement('${s.id}','traite')">Traiter</button>
                <button class="btn-xs btn-muted"   onclick="traiterSignalement('${s.id}','ferme')">Fermer</button>
              ` : '<span style="color:var(--text-light);font-size:11px">Résolu</span>'}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { el.innerHTML = vide('Erreur de chargement.'); }
};

window.traiterSignalement = async function (id, statut) {
  try {
    await api.adminTraiterSignalement(id, statut);
    toast('Signalement mis à jour.', 'success');
    chargerSignalements();
    chargerStats();
  } catch { toast('Erreur.', 'error'); }
};

/* ============================================================
   Litiges occasion (reste P4 #14)
   ============================================================ */

window.chargerLitiges = async function () {
  const el = document.getElementById('table-litiges');
  el.innerHTML = loading();
  try {
    const data = await api.adminGetLitiges();
    const badge = document.getElementById('badge-litiges');
    if (badge) {
      badge.style.display = data.length ? '' : 'none';
      badge.textContent = data.length;
    }
    if (!data?.length) { el.innerHTML = vide('Aucun litige ouvert.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Livre</th><th>Acheteur</th><th>Vendeur</th><th>Montant</th>
          <th>Motif</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(c => `
          <tr>
            <td>${c.livres?.titre || '—'}</td>
            <td>${c.acheteur?.nom || '—'}${c.acheteur?.telephone ? ' · ' + c.acheteur.telephone : ''}</td>
            <td>${c.vendeur?.nom || '—'}${c.vendeur?.telephone ? ' · ' + c.vendeur.telephone : ''}</td>
            <td>${Number(c.montant_xaf || 0).toLocaleString('fr-FR')} FCFA</td>
            <td style="max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.litige_motif || '—'}</td>
            <td style="color:var(--text-light);font-size:11px">${new Date(c.created_at).toLocaleDateString('fr-FR')}</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn-xs btn-success" onclick="resoudreLitige('${c.id}','clos')">Vendeur a raison</button>
              <button class="btn-xs btn-muted"   onclick="resoudreLitige('${c.id}','rembourse')">Rembourser acheteur</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { el.innerHTML = vide('Erreur de chargement.'); }
};

window.resoudreLitige = async function (commandeId, decision) {
  const label = decision === 'clos' ? 'trancher en faveur du vendeur' : 'trancher en faveur de l\'acheteur (remboursement)';
  if (!confirm(`Confirmer : ${label} ?`)) return;
  try {
    await api.adminResoudreLitige(commandeId, decision);
    toast('Litige tranché.', 'success');
    chargerLitiges();
  } catch (e) { toast(e.message || 'Erreur.', 'error'); }
};

/* ============================================================
   Promotions — prix barré (reste P3 #12, D17)
   ============================================================ */

window.chargerPromotions = async function () {
  const el = document.getElementById('table-promotions');
  el.innerHTML = loading();
  try {
    const data = await api.adminGetPromotions();
    if (!data?.length) { el.innerHTML = vide('Aucune offre d\'achat numérique active.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Livre</th><th>Prix actuel</th><th>Prix avant (barré)</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(o => `
          <tr>
            <td>${o.livres?.titre || '—'}</td>
            <td>${Number(o.prix || 0).toLocaleString('fr-FR')} ${o.devise || 'XAF'}</td>
            <td>
              <input type="number" min="0" step="1" id="promo-${o.id}"
                value="${o.prix_barre != null ? o.prix_barre : ''}"
                placeholder="ex. ${Math.round(Number(o.prix || 0) * 1.4)}"
                style="width:110px;padding:4px 8px;border:1px solid var(--border-color);border-radius:6px" />
            </td>
            <td>
              <button class="btn-xs btn-success" onclick="sauvegarderPromo('${o.id}')">Enregistrer</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { el.innerHTML = vide('Erreur de chargement.'); }
};

window.sauvegarderPromo = async function (offreId) {
  const input = document.getElementById(`promo-${offreId}`);
  const valeur = input?.value?.trim();
  const prixBarre = valeur === '' ? null : Number(valeur);
  try {
    await api.adminDefinirPromo(offreId, prixBarre);
    toast(prixBarre ? 'Promo enregistrée.' : 'Promo retirée.', 'success');
  } catch (e) { toast(e.message || 'Erreur.', 'error'); }
};

/* ============================================================
   Campagnes de vente livre (V017)
   ============================================================ */

window.chargerCampagnesVente = async function () {
  const el = document.getElementById('table-campagnes');
  if (!el) return;
  el.innerHTML = loading();
  try {
    const data = await api.adminGetCampagnesVente();
    if (!data.length) { el.innerHTML = vide('Aucune campagne de vente.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Campagne</th><th>Œuvre</th><th>Prix</th><th>Période</th>
          <th>Statut</th><th>Performance</th><th>Lien</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(c => {
          const prix = Number(c.prix_campagne || c.oeuvres?.prix || 0);
          const lien = `${location.origin}/pages/campaign.html?c=${encodeURIComponent(c.slug)}`;
          return `
            <tr>
              <td>
                <strong>${escapeHtml(c.titre)}</strong>
                <div style="font-size:11px;color:var(--text-light)">${escapeHtml(c.slogan || c.conditions_admin || '')}</div>
              </td>
              <td>${escapeHtml(c.oeuvres?.titre || '—')}<br><span style="font-size:11px;color:var(--text-light)">${escapeHtml(c.oeuvres?.profiles?.nom || '')}</span></td>
              <td>${prix.toLocaleString('fr-FR')} ${c.devise || 'XAF'}</td>
              <td style="font-size:11px">${fmtDate(c.date_debut)}<br>${c.date_fin ? fmtDate(c.date_fin) : 'Sans fin'}</td>
              <td><span class="badge ${c.statut === 'active' ? 'badge--success' : c.statut === 'suspendue' ? 'badge--error' : 'badge--warning'}">${c.statut}</span></td>
              <td style="font-size:11px">
                ${Number(c.impressions || 0).toLocaleString('fr-FR')} vues<br>
                ${Number(c.clics || 0).toLocaleString('fr-FR')} clics · ${Number(c.intentions_achat || 0).toLocaleString('fr-FR')} achats lancés
              </td>
              <td><button class="btn-xs btn-muted" onclick="copierTexte('${encodeURIComponent(lien)}')">Copier</button></td>
              <td>
                <select class="form-input" style="padding:4px 8px;font-size:11px;height:28px"
                  onchange="changerStatutCampagne('${c.id}', this.value)">
                  ${['brouillon','programmee','active','terminee','suspendue'].map(s => `<option value="${s}" ${c.statut === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </td>
            </tr>`;
        }).join('')}</tbody>
      </table>`;
  } catch (e) {
    el.innerHTML = erreur('Impossible de charger les campagnes. Appliquez la migration V017 si nécessaire.');
    console.error(e);
  }
};

async function chargerSelectOeuvresCampagne() {
  const select = document.getElementById('camp-oeuvre');
  if (!select) return;
  try {
    const { data } = await api.adminGetOeuvres({ limit: 200 });
    const oeuvres = (data || []).filter(o => o.visible);
    select.innerHTML = oeuvres.map(o => `<option value="${o.id}" data-titre="${escapeAttr(o.titre || '')}">${escapeHtml(o.titre || 'Sans titre')}</option>`).join('');
    const mettreTitre = () => {
      const option = select.selectedOptions[0];
      const titre = option?.dataset.titre || '';
      if (!document.getElementById('camp-titre').value) document.getElementById('camp-titre').value = titre;
      if (!document.getElementById('camp-slug').value) document.getElementById('camp-slug').value = slugify(titre);
    };
    select.addEventListener('change', mettreTitre);
    mettreTitre();
  } catch {
    select.innerHTML = '<option value="">Œuvres indisponibles</option>';
  }
}

window.creerCampagneVente = async function () {
  const oeuvreId = document.getElementById('camp-oeuvre')?.value;
  const titre = document.getElementById('camp-titre')?.value.trim();
  const slug = slugify(document.getElementById('camp-slug')?.value || titre);
  if (!oeuvreId || !titre || !slug) {
    toast('Œuvre, titre et slug sont requis.', 'error');
    return;
  }

  try {
    const oeuvre = (await api.adminGetOeuvres({ limit: 200 })).data.find(o => o.id === oeuvreId);
    await api.adminCreerCampagneVente({
      oeuvre_id: oeuvreId,
      auteur_id: oeuvre?.auteur_id || null,
      titre,
      slogan: document.getElementById('camp-slogan')?.value.trim() || null,
      slug,
      statut: 'active',
      date_debut: dateLocaleVersIso(document.getElementById('camp-debut')?.value) || new Date().toISOString(),
      date_fin: dateLocaleVersIso(document.getElementById('camp-fin')?.value),
      prix_campagne: valeurNombre('camp-prix'),
      prix_barre: valeurNombre('camp-prix-barre'),
      devise: 'XAF',
      budget_pub_xaf: valeurNombre('camp-budget') || 0,
      canaux: (document.getElementById('camp-canaux')?.value || '')
        .split(',').map(v => v.trim()).filter(Boolean),
      conditions_admin: document.getElementById('camp-conditions')?.value.trim() || null,
    });
    toast('Campagne créée.', 'success');
    chargerCampagnesVente();
  } catch (e) {
    toast(e.message || 'Création impossible.', 'error');
  }
};

window.changerStatutCampagne = async function (id, statut) {
  try {
    await api.adminUpdateCampagneVente(id, { statut });
    toast('Statut mis à jour.', 'success');
    chargerCampagnesVente();
  } catch (e) { toast(e.message || 'Erreur.', 'error'); }
};

window.copierTexte = async function (encoded) {
  await navigator.clipboard?.writeText(decodeURIComponent(encoded)).catch(() => {});
  toast('Lien copié.', 'success');
};

/* ============================================================
   Utilisateurs
   ============================================================ */

window.chargerUsers = async function () {
  const el = document.getElementById('table-users');
  el.innerHTML = loading();
  try {
    const data = await api.adminGetUsers({ limit: 50 });
    if (!data?.length) { el.innerHTML = vide('Aucun utilisateur.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Nom</th><th>Rôle</th><th>Niveau</th><th>Pays</th>
          <th>Badge fondateur</th><th>Inscrit le</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(u => `
          <tr>
            <td>${u.nom || '—'}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge--premium' : 'badge--gratuit'}">${u.role}</span></td>
            <td>${u.niveau_auteur || '—'}</td>
            <td>${u.pays || '—'}</td>
            <td>${u.badge_fondateur ? '🏅' : '—'}</td>
            <td style="color:var(--text-light);font-size:11px">${new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
            <td>
              <select class="form-input" style="padding:4px 8px;font-size:11px;height:28px"
                onchange="setRole('${u.id}', this.value)">
                <option ${u.role==='lecteur'     ? 'selected':''} value="lecteur">lecteur</option>
                <option ${u.role==='auteur'      ? 'selected':''} value="auteur">auteur</option>
                <option ${u.role==='institution' ? 'selected':''} value="institution">institution</option>
                <option ${u.role==='admin'       ? 'selected':''} value="admin">admin</option>
              </select>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { el.innerHTML = vide('Erreur de chargement.'); }
};

window.setRole = async function (userId, role) {
  try {
    await api.adminSetRole(userId, role);
    toast('Rôle mis à jour.', 'success');
  } catch { toast('Erreur.', 'error'); }
};

/* ============================================================
   Institutions
   ============================================================ */

window.chargerInstitutions = async function () {
  const el = document.getElementById('table-institutions');
  el.innerHTML = loading();
  try {
    const data = await api.adminGetInstitutions();
    if (!data?.length) { el.innerHTML = vide('Aucune institution.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Nom</th><th>Type</th><th>Pays</th>
          <th>Domaine</th><th>Statut</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(i => `
          <tr>
            <td>${i.nom}</td>
            <td>${i.type || '—'}</td>
            <td>${i.pays || '—'}</td>
            <td>${i.domaine ? `<a href="${i.domaine}" target="_blank" style="color:var(--color-primary)">${i.domaine}</a>` : '—'}</td>
            <td>
              <span class="badge ${
                i.statut_verification === 'verifie' ? 'badge--success' :
                i.statut_verification === 'rejete'  ? 'badge--danger'  : 'badge--warning'}">
                ${i.statut_verification}
              </span>
            </td>
            <td style="color:var(--text-light);font-size:11px">${new Date(i.created_at).toLocaleDateString('fr-FR')}</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">
              ${i.statut_verification === 'en_attente' ? `
                <button class="btn-xs btn-success" onclick="verifierInstitution('${i.id}','verifie')">✅ Valider</button>
                <button class="btn-xs btn-danger"  onclick="verifierInstitution('${i.id}','rejete')">❌ Rejeter</button>
              ` : '<span style="color:var(--text-light);font-size:11px">Traité</span>'}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { el.innerHTML = vide('Erreur de chargement.'); }
};

window.verifierInstitution = async function (id, statut) {
  try {
    await api.adminVerifierInstitution(id, statut);
    toast(statut === 'verifie' ? 'Institution validée ✅' : 'Institution rejetée.', 'success');
    chargerInstitutions();
    chargerStats();
  } catch { toast('Erreur.', 'error'); }
};

/* ============================================================
   Paiements
   ============================================================ */

window.chargerPaiements = async function () {
  const el = document.getElementById('table-paiements');
  el.innerHTML = loading();
  try {
    const data = await api.adminGetPaiements();
    const attente = data?.filter(p => p.statut === 'en_attente') || [];

    if (attente.length > 0) {
      const b = document.getElementById('badge-paiements');
      b.textContent = attente.length; b.style.display = '';
    }

    if (!data?.length) { el.innerHTML = vide('Aucun paiement.'); return; }

    el.innerHTML = `
      <table class="admin-table">
        <thead><tr>
          <th>Utilisateur</th><th>Type</th><th>Œuvre</th>
          <th>Montant</th><th>Méthode</th><th>Référence</th>
          <th>Statut</th><th>Date</th><th>Actions</th>
        </tr></thead>
        <tbody>${data.map(p => `
          <tr>
            <td>${p.profiles?.nom || '—'}</td>
            <td style="font-size:11px">${p.type}</td>
            <td style="font-size:11px">${p.oeuvres?.titre || '—'}</td>
            <td><strong>${p.montant} ${p.devise}</strong></td>
            <td><span class="badge badge--gratuit" style="font-size:10px">${p.methode}</span></td>
            <td style="font-family:monospace;font-size:11px;color:var(--text-secondary)">${p.reference_transaction || '—'}</td>
            <td><span class="badge ${
              p.statut === 'confirme' ? 'badge--success' :
              p.statut === 'rejete'   ? 'badge--danger'  : 'badge--warning'}">
              ${p.statut}
            </span></td>
            <td style="color:var(--text-light);font-size:11px">${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
            <td style="display:flex;gap:6px;flex-wrap:wrap">
              ${p.statut === 'en_attente' ? `
                <button class="btn-xs btn-success" onclick="confirmerPaiement('${p.id}','${p.oeuvre_id||''}','${p.user_id}')">✅ Confirmer</button>
                <button class="btn-xs btn-danger"  onclick="rejeterPaiement('${p.id}')">❌ Rejeter</button>
              ` : '<span style="color:var(--text-light);font-size:11px">Traité</span>'}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } catch (e) { el.innerHTML = vide('Erreur de chargement.'); }
};

window.confirmerPaiement = async function (id, oeuvreId, userId) {
  try {
    await api.adminConfirmerPaiement(id, oeuvreId || null, userId);
    toast('Paiement confirmé — accès activé ✅', 'success');
    chargerPaiements(); chargerStats();
  } catch { toast('Erreur.', 'error'); }
};

window.rejeterPaiement = async function (id) {
  try {
    await api.adminRejeterPaiement(id);
    toast('Paiement rejeté.', 'info');
    chargerPaiements();
  } catch { toast('Erreur.', 'error'); }
};

/* ============================================================
   Export CSV
   ============================================================ */

window.exporterOeuvresCSV = async function () {
  try {
    const { data } = await api.adminGetOeuvres({ limit: 500 });
    const entetes = ['Titre', 'Auteur', 'Genre', 'Statut', 'Lectures', 'Note', 'Visible', 'Date'];
    const lignes  = data.map(o => [
      `"${(o.titre || '').replace(/"/g,'""')}"`,
      `"${(o.profiles?.nom || '').replace(/"/g,'""')}"`,
      o.genre || '', o.statut || '', o.nb_lectures || 0,
      o.note_moyenne || '', o.visible ? 'oui' : 'non',
      new Date(o.created_at).toLocaleDateString('fr-FR'),
    ].join(';'));
    _telechargerCSV('kalamundi_oeuvres.csv', [entetes.join(';'), ...lignes]);
    toast('Export téléchargé.', 'success');
  } catch { toast('Erreur export.', 'error'); }
};

window.exporterUsersCSV = async function () {
  try {
    const data = await api.adminGetUsers({ limit: 500 });
    const entetes = ['Nom', 'Rôle', 'Niveau', 'Pays', 'Badge fondateur', 'Inscrit le'];
    const lignes  = data.map(u => [
      `"${(u.nom || '').replace(/"/g,'""')}"`,
      u.role || '', u.niveau_auteur || '', u.pays || '',
      u.badge_fondateur ? 'oui' : 'non',
      new Date(u.created_at).toLocaleDateString('fr-FR'),
    ].join(';'));
    _telechargerCSV('kalamundi_utilisateurs.csv', [entetes.join(';'), ...lignes]);
    toast('Export téléchargé.', 'success');
  } catch { toast('Erreur export.', 'error'); }
};

window.exporterPaiementsCSV = async function () {
  try {
    const data = await api.adminGetPaiements();
    const entetes = ['Utilisateur', 'Type', 'Œuvre', 'Montant', 'Devise', 'Méthode', 'Référence', 'Statut', 'Date'];
    const lignes  = data.map(p => [
      `"${(p.profiles?.nom || '').replace(/"/g,'""')}"`,
      p.type || '', `"${(p.oeuvres?.titre || '').replace(/"/g,'""')}"`,
      p.montant || '', p.devise || 'USD', p.methode || '',
      p.reference_transaction || '', p.statut || '',
      new Date(p.created_at).toLocaleDateString('fr-FR'),
    ].join(';'));
    _telechargerCSV('kalamundi_paiements.csv', [entetes.join(';'), ...lignes]);
    toast('Export téléchargé.', 'success');
  } catch { toast('Erreur export.', 'error'); }
};

function _telechargerCSV(nom, lignes) {
  const contenu = '﻿' + lignes.join('\r\n');
  const blob    = new Blob([contenu], { type: 'text/csv;charset=utf-8;' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = nom; a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   Utilitaires
   ============================================================ */

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' });
}

function valeurNombre(id) {
  const valeur = document.getElementById(id)?.value;
  if (valeur == null || String(valeur).trim() === '') return null;
  return Number(valeur);
}

function dateLocaleVersIso(valeur) {
  if (!valeur) return null;
  const date = new Date(valeur);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(text) {
  return escapeHtml(text).replace(/`/g, '&#096;');
}

function loading() {
  return `<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__title">Chargement…</p></div>`;
}

function vide(msg) {
  return `<div class="empty-state"><div class="empty-state__icon">📭</div><p class="empty-state__title">${msg}</p></div>`;
}

function erreur(msg) {
  return `<div class="empty-state"><div class="empty-state__icon">⚠️</div><p class="empty-state__title">${msg}</p></div>`;
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}
