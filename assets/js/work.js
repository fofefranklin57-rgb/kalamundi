/* ============================================================
   work.js — Page détail d'une œuvre
   Kalamundi — La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
import { injecterPub } from './pub.js';
import { estSauvegarde, sauvegarderLivre, supprimerLivre } from './offline.js';
import { getParam, formatNombre, formatDate, toast, toastErreur, toastSucces } from './utils.js';
import { genererCouverture } from './cover-generator.js';
import { echapperAttr, normaliserUrlImage } from './cover-utils.js';

const oeuvreId = getParam('id');
let noteSelectionnee = 0;
let utilisateur = null;
let commentaireReponseId = null;

/* ============================================================
   Init
   ============================================================ */

(async () => {
  if (!oeuvreId) {
    window.location.href = '/pages/library.html';
    return;
  }

  // Lancer l'œuvre ET l'auth en parallèle — ne pas attendre l'auth pour afficher
  const [, userResult] = await Promise.all([
    chargerOeuvre(),
    getUser().then(u => { utilisateur = u; return u; }),
    chargerCommentaires(),
  ]);

  // Visiteur non connecté arrivant via lien partagé
  if (!utilisateur && getParam('ref') === 'share') {
    const titre  = getParam('titre') || '';
    const auteur = getParam('auteur') || '';
    window.location.href =
      `/pages/bienvenue.html?livre_id=${oeuvreId}&titre=${encodeURIComponent(titre)}&auteur=${encodeURIComponent(auteur)}#objectifs`;
    return;
  }

  if (utilisateur) {
    document.getElementById('comment-form').classList.remove('hidden');
  } else {
    document.getElementById('connexion-required').classList.remove('hidden');
  }
})();

function _afficherBannerPartage() {
  const banner = document.createElement('div');
  banner.style.cssText = `
    background: linear-gradient(135deg, #1B4332, #2D6A4F);
    color: white; padding: 16px 24px; text-align: center;
    position: sticky; top: 0; z-index: 100;
    display: flex; align-items: center; justify-content: center; gap: 16px;
    flex-wrap: wrap; font-size: 15px;
  `;
  banner.innerHTML = `
    <span>📚 Quelqu'un vous a partagé ce livre — lisez <strong>3 chapitres gratuitement</strong> !</span>
    <a href="/pages/login.html?mode=inscription" style="
      background:white; color:#1B4332; padding:6px 16px; border-radius:20px;
      font-weight:600; text-decoration:none; white-space:nowrap; font-size:14px;
    ">Créer un compte gratuit</a>
    <button onclick="this.parentElement.remove()" style="
      background:none; border:none; color:rgba(255,255,255,0.7);
      cursor:pointer; font-size:18px; padding:0 4px;
    ">✕</button>
  `;
  document.body.prepend(banner);
}

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
    _injecterMetaOG(oeuvre);

    // Breadcrumb
    const bc = document.getElementById('breadcrumb-titre');
    if (bc) bc.textContent = oeuvre.titre;

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

    // Couverture : réelle, générée automatiquement, ou fallback si URL cassée
    const coverEl   = document.getElementById('work-cover');
    const auteurCov = oeuvre.profiles?.nom || '';
    const genreCov  = (oeuvre.genre || '').toLowerCase();
    const coverGen  = genererCouverture(oeuvre.titre, auteurCov, genreCov, 300, 420);
    const coverUrl = normaliserUrlImage(oeuvre.couverture_url);
    if (coverUrl) {
      coverEl.innerHTML = `<img src="${echapperAttr(coverUrl)}" alt="Couverture ${echapperAttr(oeuvre.titre)}"
        onerror="this.onerror=null;this.src='${coverGen}'" />`;
    } else {
      coverEl.innerHTML = `<img src="${coverGen}" alt="Couverture générée — ${echapperAttr(oeuvre.titre)}" />`;
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

    // Badge rythme de publication
    const FREQ_LABELS = {
      quotidien:      '📅 1 chapitre / jour',
      biquotidien:    '📅 1 chapitre / 2 jours',
      hebdomadaire:   '📅 1 chapitre / semaine',
      bihebdomadaire: '📅 1 chapitre / 2 semaines',
      mensuel:        '📅 1 chapitre / mois',
      bimensuel:      '📅 1 chapitre / 2 mois',
    };
    const freq = oeuvre.frequence_publication;
    const badgeEl = document.getElementById('badge-frequence');
    if (badgeEl) {
      if (freq && freq !== 'immediate' && FREQ_LABELS[freq]) {
        badgeEl.textContent = FREQ_LABELS[freq];
        badgeEl.style.display = 'inline-flex';
      } else {
        badgeEl.style.display = 'none';
      }
    }

    // Actions + Chapitres en parallèle
    await Promise.all([
      rendreActions(oeuvre),
      chargerChapitres(oeuvre),
    ]);

    // Recommandations en arrière-plan
    chargerRecommandations(oeuvre.genre, oeuvre.id);

  } catch (err) {
    document.getElementById('work-titre').textContent = 'Œuvre introuvable';
    toastErreur('Impossible de charger cette œuvre.');
  }
}

/* ============================================================
   Meta OG — partage réseaux sociaux
   ============================================================ */

function _injecterMetaOG(oeuvre) {
  const pageUrl  = window.location.href;
  const titre    = oeuvre.titre || 'Kalamundi';
  const auteur   = oeuvre.profiles?.nom || '';
  const desc     = (oeuvre.resume || `Lisez "${titre}" sur Kalamundi, la plateforme littéraire africaine.`).slice(0, 200);
  const image    = normaliserUrlImage(oeuvre.couverture_url) || 'https://kalamundi.pages.dev/assets/img/og-default.png';

  const metas = {
    'og:type':               'book',
    'og:title':              `${titre}${auteur ? ` — ${auteur}` : ''}`,
    'og:description':        desc,
    'og:url':                pageUrl,
    'og:image':              image,
    'og:site_name':          'Kalamundi',
    'twitter:card':          'summary_large_image',
    'twitter:title':         `${titre}${auteur ? ` — ${auteur}` : ''}`,
    'twitter:description':   desc,
    'twitter:image':         image,
    'description':           desc,
  };

  Object.entries(metas).forEach(([name, content]) => {
    const isOg      = name.startsWith('og:') || name.startsWith('twitter:');
    const attr      = isOg ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  });

  // Lien canonique
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = pageUrl;
}

/* ============================================================
   Actions (bouton lire, premium, etc.)
   ============================================================ */

async function rendreActions(oeuvre) {
  const actionsEl = document.getElementById('work-actions');

  if (oeuvre.statut === 'gratuit') {
    const deja = await estSauvegarde(oeuvre.id).catch(() => false);
    actionsEl.innerHTML = `
      <a href="/pages/reader.html?id=${oeuvre.id}&ch=1" class="btn btn--accent btn--lg">
        📖 Lire maintenant
      </a>
      <button class="btn btn--outline" id="btn-offline" data-id="${oeuvre.id}" data-sauvegarde="${deja}">
        ${deja ? '✅ Disponible hors-ligne' : '⬇️ Lire hors-ligne'}
      </button>
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
          ⭐ Accéder — ${formatPrixXaf(oeuvre.prix)}
        </button>
        <p style="color:rgba(255,255,255,0.6);font-size:var(--font-size-xs);margin-top:4px;">
          ${Number(oeuvre.chapitres_gratuits || 0) > 0 ? `${oeuvre.chapitres_gratuits} chapitre(s) gratuit(s) · ` : ''}Paiement sécurisé · 50% reversés à l'auteur
        </p>`;
    }
  }

  document.getElementById('btn-acheter')?.addEventListener('click', () => {
    if (!utilisateur) {
      const retour = encodeURIComponent(`/pages/payment.html?oeuvre=${oeuvre.id}`);
      window.location.href = `/pages/login.html?redirect=${retour}`;
      return;
    }
    window.location.href = `/pages/payment.html?oeuvre=${oeuvre.id}&montant=${encodeURIComponent(oeuvre.prix || 300)}&titre=${encodeURIComponent(oeuvre.titre || 'Kalamundi')}`;
  });

  // Bouton hors-ligne
  document.getElementById('btn-offline')?.addEventListener('click', async (e) => {
    const btn      = e.currentTarget;
    const deja     = btn.dataset.sauvegarde === 'true';
    if (deja) {
      if (!confirm(`Supprimer "${oeuvre.titre}" du mode hors-ligne ?`)) return;
      btn.disabled = true;
      btn.textContent = '🗑️ Suppression…';
      await supprimerLivre(oeuvre.id);
      btn.dataset.sauvegarde = 'false';
      btn.textContent = '⬇️ Lire hors-ligne';
      btn.disabled = false;
      toast('Livre retiré du mode hors-ligne.', 'info');
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner--sm"></span> Téléchargement…';
    try {
      const chaps = await api.getChapitresOffline(oeuvre.id);

      if (!chaps || !chaps.length) {
        toast('Aucun chapitre disponible pour ce livre.', 'erreur');
        btn.disabled = false;
        btn.textContent = '⬇️ Lire hors-ligne';
        return;
      }

      await sauvegarderLivre(oeuvre, chaps);
      btn.dataset.sauvegarde = 'true';
      btn.textContent = '✅ Disponible hors-ligne';
      btn.disabled = false;
      const ko = chaps.reduce((s, c) => s + (c.contenu?.length || 0), 0);
      toast(`"${oeuvre.titre}" sauvegardé (${Math.round(ko/1024)} Ko) — lisible sans internet !`, 'success');
    } catch (err) {
      console.error(err);
      toast('Erreur lors du téléchargement.', 'erreur');
      btn.disabled = false;
      btn.textContent = '⬇️ Lire hors-ligne';
    }
  });

  // Partager — lien avec titre + auteur pour URL lisible
  document.getElementById('btn-partager')?.addEventListener('click', async () => {
    const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const titreSlug  = slug(oeuvre.titre || '');
    const auteurSlug = slug(oeuvre.profiles?.nom || '');
    const url = `${window.location.origin}/pages/work.html?id=${oeuvreId}&ref=share&titre=${encodeURIComponent(oeuvre.titre)}&auteur=${encodeURIComponent(oeuvre.profiles?.nom || '')}`;
    const texte = `Lis "${oeuvre.titre}" de ${oeuvre.profiles?.nom || 'un auteur'} gratuitement sur Kalamundi — La Plume du Monde`;
    try {
      if (navigator.share) {
        await navigator.share({ title: oeuvre.titre, text: texte, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast('Lien copié ! Partagez-le pour inviter quelqu\'un à lire.', 'success');
      }
    } catch { /* annulé */ }
  });
}

async function verifierAccesPremium(oeuvreId) {
  if (!utilisateur) return false;
  return api.verifierAccesPremium(utilisateur.id, oeuvreId).catch(() => false);
}

function formatPrixXaf(prix) {
  return `${Number(prix || 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} FCFA`;
}

/* ============================================================
   Chapitres
   ============================================================ */

async function chargerChapitres(oeuvre) {
  const listEl = document.getElementById('chapitres-list');
  try {
    // Chapitres déjà inclus dans getOeuvre — pas de requête supplémentaire
    const chapitres = oeuvre.chapitres || [];
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

    listEl.innerHTML = construireArbreCommentaires(commentaires).map(c => `
      <div class="comment-item">
        <div class="avatar avatar--sm avatar--placeholder">
          ${escapeHtml(c.profiles?.nom?.charAt(0).toUpperCase() || '?')}
        </div>
        <div class="comment-item__body">
          <div class="comment-item__header">
            <span class="comment-item__nom">${escapeHtml(c.profiles?.nom || 'Anonyme')}</span>
            <span class="comment-item__date">${formatDate(c.created_at)}</span>
          </div>
          ${c.note ? `<div class="stars" style="margin-bottom:4px;">${'★'.repeat(c.note)}${'★'.repeat(5 - c.note).replace(/★/g, '<span class="stars__empty">★</span>')}</div>` : ''}
          <p class="comment-item__texte">${escapeHtml(c.contenu)}</p>
          ${utilisateur ? `<button type="button" class="comment-reply-btn" data-comment-id="${c.id}" data-comment-author="${escapeAttr(c.profiles?.nom || 'Anonyme')}">Répondre</button>` : ''}
          ${renderReponses(c.reponses || [])}
        </div>
      </div>
    `).join('');
    brancherBoutonsReponse();
  } catch {
    listEl.innerHTML = '<p style="color:var(--color-error);">Erreur de chargement des commentaires.</p>';
  }
}

function construireArbreCommentaires(commentaires) {
  const parId = new Map();
  const racines = [];
  commentaires.forEach(c => parId.set(c.id, { ...c, reponses: [] }));
  commentaires.forEach(c => {
    const item = parId.get(c.id);
    const parent = c.parent_id ? parId.get(c.parent_id) : null;
    if (parent) parent.reponses.push(item);
    else racines.push(item);
  });
  return racines.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function renderReponses(reponses) {
  if (!reponses.length) return '';
  return `
    <div class="comment-replies">
      ${reponses.map(r => `
        <div class="comment-reply">
          <div class="comment-item__header">
            <span class="comment-item__nom">${escapeHtml(r.profiles?.nom || 'Anonyme')}</span>
            <span class="comment-item__date">${formatDate(r.created_at)}</span>
          </div>
          <p class="comment-item__texte">${escapeHtml(r.contenu)}</p>
        </div>
      `).join('')}
    </div>`;
}

function brancherBoutonsReponse() {
  document.querySelectorAll('.comment-reply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      commentaireReponseId = btn.dataset.commentId;
      const auteur = btn.dataset.commentAuthor || 'ce commentaire';
      const textarea = document.getElementById('comment-texte');
      const badge = document.getElementById('reply-target');
      if (badge) {
        badge.innerHTML = `Réponse à <strong>${escapeHtml(auteur)}</strong> <button type="button" id="cancel-reply">Annuler</button>`;
        badge.classList.remove('hidden');
        document.getElementById('cancel-reply')?.addEventListener('click', annulerReponse);
      }
      textarea?.focus();
    });
  });
}

function annulerReponse() {
  commentaireReponseId = null;
  document.getElementById('reply-target')?.classList.add('hidden');
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
  if (!utilisateur) {
    toastErreur('Tu dois être connecté pour publier un avis.');
    return;
  }

  const texte = document.getElementById('comment-texte').value.trim();
  if (!texte) {
    toastErreur('Écris un commentaire avant de publier.');
    document.getElementById('comment-texte').focus();
    return;
  }

  const btn = document.getElementById('btn-commenter');
  const original = btn.textContent;
  btn.classList.add('btn--loading');
  btn.textContent = 'Publication…';
  btn.disabled = true;

  try {
    const nouveau = await api.ajouterCommentaire(
      utilisateur.id,
      oeuvreId,
      texte,
      commentaireReponseId ? null : (noteSelectionnee || null),
      commentaireReponseId
    );

    const etaitReponse = !!commentaireReponseId;

    // Réinitialiser le formulaire
    document.getElementById('comment-texte').value = '';
    noteSelectionnee = 0;
    annulerReponse();
    document.querySelectorAll('.star-rating__star').forEach(s => s.classList.remove('is-active'));

    toastSucces(etaitReponse ? 'Réponse publiée ✓' : 'Avis publié ✓ Merci !');

    // Les réponses ont besoin d'être replacées sous leur commentaire parent.
    if (nouveau && !nouveau.parent_id) {
      _prependerCommentaire(nouveau);
    } else {
      await chargerCommentaires();
    }

  } catch (err) {
    console.error('Erreur commentaire :', err);
    // Message d'erreur lisible pour l'utilisateur
    const msg = err?.message?.includes('foreign key')
      ? 'Ton profil est incomplet. Déconnecte-toi, reconnecte-toi et réessaie.'
      : err?.message?.includes('violates')
      ? 'Erreur de permission. Reconnecte-toi et réessaie.'
      : (err?.message || 'Une erreur est survenue. Réessaie.');
    toastErreur(msg);
  } finally {
    btn.classList.remove('btn--loading');
    btn.textContent = original;
    btn.disabled = false;
  }
});

/* Ajouter un commentaire en tête sans rechargement complet */
function _prependerCommentaire(c) {
  const listEl = document.getElementById('comments-list');

  // Retirer le "empty state" si présent
  const empty = listEl.querySelector('.empty-state');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'comment-item comment-item--new';
  div.innerHTML = `
    <div class="avatar avatar--sm avatar--placeholder">
      ${c.profiles?.nom?.charAt(0).toUpperCase() || utilisateur?.email?.charAt(0).toUpperCase() || '?'}
    </div>
    <div class="comment-item__body">
      <div class="comment-item__header">
        <span class="comment-item__nom">${escapeHtml(c.profiles?.nom || 'Moi')}</span>
        <span class="comment-item__date">À l'instant</span>
      </div>
      ${c.note ? `<div class="stars" style="margin-bottom:4px;color:var(--color-accent)">${'★'.repeat(c.note)}<span style="color:var(--border-color)">${'★'.repeat(5 - c.note)}</span></div>` : ''}
      <p class="comment-item__texte">${escapeHtml(c.contenu)}</p>
      ${utilisateur ? `<button type="button" class="comment-reply-btn" data-comment-id="${c.id}" data-comment-author="${escapeAttr(c.profiles?.nom || 'Moi')}">Répondre</button>` : ''}
    </div>`;

  listEl.prepend(div);
  brancherBoutonsReponse();

  // Animation d'apparition
  requestAnimationFrame(() => div.style.animation = 'fadeIn 0.3s ease');
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

/* ============================================================
   Recommandations croisées — même genre, autres œuvres
   ============================================================ */

async function chargerRecommandations(genre, oeuvreActuelleId) {
  if (!genre) return;
  try {
    const { data } = await api.getOeuvres({ genre, limit: 6 });
    const filtrees = (data || []).filter(o => o.id !== oeuvreActuelleId).slice(0, 5);
    if (!filtrees.length) return;

    const section = document.getElementById('section-recommandations');
    const grid    = document.getElementById('recommandations-grid');
    if (!section || !grid) return;

    grid.innerHTML = filtrees.map(o => `
      <a href="/pages/work.html?id=${o.id}" class="book-card" style="text-decoration:none;display:flex;flex-direction:column;background:white;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);transition:transform 0.15s;">
        <div style="height:200px;background:linear-gradient(135deg,#1B4332,#2D6A4F);display:flex;align-items:center;justify-content:center;font-size:48px;flex-shrink:0;">
          ${normaliserUrlImage(o.couverture_url) ? `<img src="${echapperAttr(normaliserUrlImage(o.couverture_url))}" alt="${echapperAttr(o.titre)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.outerHTML='📖'" />` : '📖'}
        </div>
        <div style="padding:10px;">
          <div style="font-weight:600;font-size:13px;color:var(--color-primary);line-height:1.3;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${o.titre}</div>
          <div style="font-size:11px;color:var(--text-light);">${o.profiles?.nom || '—'}</div>
          <div style="margin-top:6px;">
            <span style="font-size:10px;padding:2px 7px;border-radius:99px;background:${o.statut==='premium'?'#fef3c7':'#d1fae5'};color:${o.statut==='premium'?'#92400e':'#065f46'};font-weight:600;">${o.statut==='premium'?'⭐ Premium':'🆓 Gratuit'}</span>
          </div>
        </div>
      </a>
    `).join('');

    section.style.display = 'block';
  } catch { /* silencieux — les reco sont non-critiques */ }
}

injecterPub('work');
