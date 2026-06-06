/* ============================================================
   work.js — Page détail d'une œuvre
   Kalamundi — La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
import { getParam, formatNombre, formatDate, toast, toastErreur, toastSucces } from './utils.js';

const oeuvreId = getParam('id');
let noteSelectionnee = 0;
let utilisateur = null;

/* ============================================================
   Init
   ============================================================ */

(async () => {
  if (!oeuvreId) {
    window.location.href = '/pages/library.html';
    return;
  }

  utilisateur = await getUser();

  await Promise.all([
    chargerOeuvre(),
    chargerCommentaires(),
  ]);

  if (utilisateur) {
    document.getElementById('comment-form').classList.remove('hidden');
  } else {
    document.getElementById('connexion-required').classList.remove('hidden');
  }
})();

/* ============================================================
   Charger l'œuvre
   ============================================================ */

async function chargerOeuvre() {
  try {
    const oeuvre = await api.getOeuvre(oeuvreId);
    const auteur = oeuvre.profiles;

    // Meta
    document.getElementById('page-title').textContent = `${oeuvre.titre} — Kalamundi`;
    document.title = `${oeuvre.titre} — Kalamundi`;

    // Hero
    document.getElementById('work-genre').textContent = oeuvre.genre;
    document.getElementById('work-titre').textContent = oeuvre.titre;
    document.getElementById('stat-lectures').textContent = formatNombre(oeuvre.nb_lectures);
    document.getElementById('stat-note').textContent = oeuvre.note_moyenne
      ? `${oeuvre.note_moyenne} ⭐` : '—';

    // Auteur
    if (auteur) {
      document.getElementById('work-auteur-link').textContent = auteur.nom;
      document.getElementById('work-auteur-link').href = `/pages/author-profile.html?id=${auteur.id}`;
      document.getElementById('work-pays').textContent = auteur.pays ? `· ${auteur.pays}` : '';
      document.getElementById('author-nom').textContent = auteur.nom;
      document.getElementById('author-pays').textContent = auteur.pays || '';
      document.getElementById('author-bio').textContent = auteur.bio || '';
      document.getElementById('voir-profil-auteur').href = `/pages/author-profile.html?id=${auteur.id}`;
      document.getElementById('author-mini-link').href = `/pages/author-profile.html?id=${auteur.id}`;

      const avatarEl = document.getElementById('author-avatar');
      if (auteur.photo_url) {
        avatarEl.innerHTML = `<img src="${auteur.photo_url}" alt="${auteur.nom}" class="avatar avatar--md" />`;
      } else {
        avatarEl.textContent = auteur.nom.charAt(0).toUpperCase();
      }
    }

    // Couverture
    const coverEl = document.getElementById('work-cover');
    if (oeuvre.couverture_url) {
      coverEl.innerHTML = `<img src="${oeuvre.couverture_url}" alt="Couverture ${oeuvre.titre}" />`;
    }

    // Résumé
    document.getElementById('work-resume').textContent = oeuvre.resume || 'Aucun résumé disponible.';

    // Badges
    const badgesEl = document.getElementById('work-badges');
    badgesEl.innerHTML = `
      <span class="badge ${oeuvre.statut === 'premium' ? 'badge--premium' : 'badge--gratuit'}">
        ${oeuvre.statut === 'premium' ? '⭐ Premium' : '🆓 Gratuit'}
      </span>
      <span class="badge badge--primary">${oeuvre.langue_originale.toUpperCase()}</span>
      <span class="badge badge--primary">${oeuvre.public_cible || 'Tout public'}</span>
    `;

    // Infos sidebar
    document.getElementById('info-langue').textContent  = oeuvre.langue_originale;
    document.getElementById('info-genre').textContent   = oeuvre.genre;
    document.getElementById('info-public').textContent  = oeuvre.public_cible || 'Tout public';
    document.getElementById('info-date').textContent    = formatDate(oeuvre.created_at);

    // Actions
    await rendreActions(oeuvre);

    // Chapitres
    await chargerChapitres(oeuvre);

  } catch (err) {
    document.getElementById('work-titre').textContent = 'Œuvre introuvable';
    toastErreur('Impossible de charger cette œuvre.');
  }
}

/* ============================================================
   Actions (bouton lire, premium, etc.)
   ============================================================ */

async function rendreActions(oeuvre) {
  const actionsEl = document.getElementById('work-actions');

  if (oeuvre.statut === 'gratuit') {
    actionsEl.innerHTML = `
      <a href="/pages/reader.html?id=${oeuvre.id}&ch=1" class="btn btn--accent btn--lg">
        📖 Lire maintenant
      </a>
      <button class="btn btn--outline" id="btn-partager">
        Partager
      </button>`;
  } else {
    const acces = utilisateur ? await verifierAccesPremium(oeuvre.id) : false;
    if (acces) {
      actionsEl.innerHTML = `
        <a href="/pages/reader.html?id=${oeuvre.id}&ch=1" class="btn btn--accent btn--lg">
          📖 Lire maintenant
        </a>`;
    } else {
      actionsEl.innerHTML = `
        <button class="btn btn--accent btn--lg" id="btn-acheter">
          ⭐ Accéder — ${oeuvre.prix} USD
        </button>
        <p style="color:rgba(255,255,255,0.6);font-size:var(--font-size-xs);margin-top:4px;">
          Paiement sécurisé · 50% reversés à l'auteur
        </p>`;
    }
  }

  // Partager
  document.getElementById('btn-partager')?.addEventListener('click', async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: document.title, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast('Lien copié !', 'success');
    }
  });
}

async function verifierAccesPremium() {
  // À implémenter avec la table revenus/achats — retourne false par défaut
  return false;
}

/* ============================================================
   Chapitres
   ============================================================ */

async function chargerChapitres(oeuvre) {
  const listEl = document.getElementById('chapitres-list');
  try {
    const chapitres = await api.getChapitres(oeuvre.id);
    document.getElementById('stat-chapitres').textContent = chapitres.length;

    if (!chapitres.length) {
      listEl.innerHTML = '<p style="color:var(--text-light);font-size:var(--font-size-sm);">Aucun chapitre disponible.</p>';
      return;
    }

    listEl.innerHTML = chapitres.map(ch => `
      <a href="/pages/reader.html?id=${oeuvre.id}&ch=${ch.numero}" class="chapitre-item">
        <div class="chapitre-item__num">${ch.numero}</div>
        <div class="chapitre-item__titre">
          ${ch.titre || `Chapitre ${ch.numero}`}
        </div>
        <span style="color:var(--text-light);font-size:var(--font-size-xs);">→</span>
      </a>
    `).join('');
  } catch {
    listEl.innerHTML = '<p style="color:var(--color-error);">Erreur de chargement des chapitres.</p>';
  }
}

/* ============================================================
   Commentaires
   ============================================================ */

async function chargerCommentaires() {
  const listEl = document.getElementById('comments-list');
  try {
    const commentaires = await api.getCommentaires(oeuvreId);

    if (!commentaires.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">💬</div>
          <p class="empty-state__text">Aucun commentaire pour l'instant. Sois le premier à encourager l'auteur !</p>
        </div>`;
      return;
    }

    listEl.innerHTML = commentaires.map(c => `
      <div class="comment-item">
        <div class="avatar avatar--sm avatar--placeholder">
          ${c.profiles?.nom?.charAt(0).toUpperCase() || '?'}
        </div>
        <div class="comment-item__body">
          <div class="comment-item__header">
            <span class="comment-item__nom">${c.profiles?.nom || 'Anonyme'}</span>
            <span class="comment-item__date">${formatDate(c.created_at)}</span>
          </div>
          ${c.note ? `<div class="stars" style="margin-bottom:4px;">${'★'.repeat(c.note)}${'★'.repeat(5 - c.note).replace(/★/g, '<span class="stars__empty">★</span>')}</div>` : ''}
          <p class="comment-item__texte">${c.contenu}</p>
        </div>
      </div>
    `).join('');
  } catch {
    listEl.innerHTML = '<p style="color:var(--color-error);">Erreur de chargement des commentaires.</p>';
  }
}

/* ============================================================
   Système d'étoiles
   ============================================================ */

document.querySelectorAll('.star-rating__star').forEach(star => {
  star.addEventListener('click', () => {
    noteSelectionnee = parseInt(star.dataset.note);
    document.querySelectorAll('.star-rating__star').forEach((s, i) => {
      s.classList.toggle('is-active', i < noteSelectionnee);
    });
  });

  star.addEventListener('mouseenter', () => {
    const n = parseInt(star.dataset.note);
    document.querySelectorAll('.star-rating__star').forEach((s, i) => {
      s.classList.toggle('is-active', i < n);
    });
  });
});

document.getElementById('star-rating')?.addEventListener('mouseleave', () => {
  document.querySelectorAll('.star-rating__star').forEach((s, i) => {
    s.classList.toggle('is-active', i < noteSelectionnee);
  });
});

/* ============================================================
   Poster un commentaire
   ============================================================ */

document.getElementById('btn-commenter')?.addEventListener('click', async () => {
  if (!utilisateur) return;
  const texte = document.getElementById('comment-texte').value.trim();
  if (!texte) return toastErreur('Écris un commentaire avant de publier.');

  const btn = document.getElementById('btn-commenter');
  btn.classList.add('btn--loading');
  btn.disabled = true;

  try {
    await api.ajouterCommentaire(utilisateur.id, oeuvreId, texte, noteSelectionnee || null);
    document.getElementById('comment-texte').value = '';
    noteSelectionnee = 0;
    document.querySelectorAll('.star-rating__star').forEach(s => s.classList.remove('is-active'));
    toastSucces('Commentaire publié !');
    await chargerCommentaires();
  } catch (err) {
    toastErreur(err.message);
  } finally {
    btn.classList.remove('btn--loading');
    btn.disabled = false;
  }
});

/* ============================================================
   Signalement
   ============================================================ */

document.getElementById('btn-signaler')?.addEventListener('click', () => {
  document.getElementById('modal-signalement').classList.add('is-open');
});

document.getElementById('close-modal-signalement')?.addEventListener('click', () => {
  document.getElementById('modal-signalement').classList.remove('is-open');
});

document.getElementById('cancel-signalement')?.addEventListener('click', () => {
  document.getElementById('modal-signalement').classList.remove('is-open');
});

document.getElementById('confirm-signalement')?.addEventListener('click', async () => {
  if (!utilisateur) return toastErreur('Connecte-toi pour signaler.');
  const motif = document.getElementById('motif-signalement').value;
  if (!motif) return toastErreur('Choisis un motif.');

  try {
    const detail = document.getElementById('detail-signalement').value.trim();
    await api.signalerOeuvre(utilisateur.id, oeuvreId, motif + (detail ? ` — ${detail}` : ''));
    document.getElementById('modal-signalement').classList.remove('is-open');
    toastSucces('Signalement envoyé. Merci de contribuer à la qualité de la plateforme.');
  } catch (err) {
    toastErreur(err.message);
  }
});

document.getElementById('modal-signalement')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.classList.remove('is-open');
});
