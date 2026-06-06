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
      b.textContent = s.signalementsOuverts;
      b.style.display = '';
    }
    if (s.institutionsAttente > 0) {
      const b = document.getElementById('badge-institutions');
      b.textContent = s.institutionsAttente;
      b.style.display = '';
    }
  } catch (e) { console.error(e); }
}

/* ============================================================
   Oeuvres
   ============================================================ */

window.chargerOeuvres = async function () {
  const el = document.getElementById('table-oeuvres');
  el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__title">Chargement…</p></div>';
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
  el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__title">Chargement…</p></div>';
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
   Utilisateurs
   ============================================================ */

window.chargerUsers = async function () {
  const el = document.getElementById('table-users');
  el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__title">Chargement…</p></div>';
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
                <option ${u.role==='lecteur'    ? 'selected':''} value="lecteur">lecteur</option>
                <option ${u.role==='auteur'     ? 'selected':''} value="auteur">auteur</option>
                <option ${u.role==='institution'? 'selected':''} value="institution">institution</option>
                <option ${u.role==='admin'      ? 'selected':''} value="admin">admin</option>
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
  el.innerHTML = '<div class="empty-state"><div class="empty-state__icon">⏳</div><p class="empty-state__title">Chargement…</p></div>';
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
                i.statut_verification === 'verifie'    ? 'badge--success' :
                i.statut_verification === 'rejete'     ? 'badge--danger'  : 'badge--warning'}">
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
   Utilitaires
   ============================================================ */

function vide(msg) {
  return `<div class="empty-state"><div class="empty-state__icon">📭</div><p class="empty-state__title">${msg}</p></div>`;
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
