/* ============================================================
   work.js — Page détail d'une œuvre
   Kalamundi — La Plume du Monde
   ============================================================ */

import { api } from './api.js';
import { getUser } from './auth.js';
import { injecterPub } from './pub.js';
import { estSauvegarde, sauvegarderLivre, supprimerLivre } from './offline.js';
import { addToCart } from './cart.js';
import { getParam, formatNombre, formatDate, toast, toastErreur, toastSucces } from './utils.js';
import { genererCouverture } from './cover-generator.js';
import { echapperAttr, normaliserUrlImage } from './cover-utils.js';

const oeuvreId = getParam('id');
let noteSelectionnee = 0;
let utilisateur = null;
let commentaireReponseId = null;
let oeuvreCourante = null;

/* ============================================================
   Init
   ============================================================ */

(async () => {
  if (!oeuvreId) {
    window.location.href = '/pages/library.html';
    return;
  }

  // Lancer l'œuvre ET l'auth en parallèle, puis attendre l'auth avant les actions personnalisées.
  const authReady = getUser().then(u => { utilisateur = u; return u; });
  await Promise.all([
    chargerOeuvre(authReady),
    authReady,
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

async function chargerOeuvre(authReady = null) {
  try {
    const oeuvre = await api.getOeuvre(oeuvreId);
    oeuvreCourante = oeuvre;
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

    if (authReady) await authReady.catch(() => null);

    // Actions, couche sociale + Chapitres en parallèle
    await Promise.all([
      rendreActions(oeuvre),
      chargerCoucheSociale(oeuvre),
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
  const offresEl = document.getElementById('work-offers-panel');
  const [offres, deja, acces] = await Promise.all([
    api.getOffresLivre(oeuvre.id, oeuvre).catch(() => []),
    estSauvegarde(oeuvre.id).catch(() => false),
    verifierAccesPremium(oeuvre.id),
  ]);
  const estPremium = oeuvre.statut === 'premium';
  const peutLire = !estPremium || acces || Number(oeuvre.chapitres_gratuits || 0) > 0;
  const prix = Number(oeuvre.prix || offres.find(o => Number(o.prix || 0) > 0)?.prix || 0);

  const boutonOffrir = estPremium
    ? `<a href="/pages/payment.html?cadeau=1&oeuvre=${oeuvre.id}&titre=${encodeURIComponent(oeuvre.titre || '')}"
          class="btn btn--outline btn--lg">🎁 Offrir</a>`
    : '';

  if (!estPremium || acces) {
    actionsEl.innerHTML = `
      <a href="/pages/reader.html?id=${oeuvre.id}&ch=1" class="btn btn--accent btn--lg">
        📖 Lire maintenant
      </a>
      ${boutonOffrir}
      <button class="btn btn--outline" id="btn-partager">
        Partager
      </button>`;
  } else {
    actionsEl.innerHTML = `
      ${peutLire ? `<a href="/pages/reader.html?id=${oeuvre.id}&ch=1" class="btn btn--outline btn--lg">Lire l'extrait</a>` : ''}
      <button class="btn btn--accent btn--lg js-buy">
        Accéder — ${formatPrixXaf(prix || 300)}
      </button>
      <button class="btn btn--outline btn--lg js-cart">
        Ajouter au panier
      </button>
      ${boutonOffrir}
      <button class="btn btn--outline" id="btn-partager">Partager</button>`;
  }

  if (offresEl) {
    offresEl.innerHTML = renderOffresLivre(oeuvre, offres, { deja, acces, prix });
    chargerOffresOccasion(oeuvre);
    chargerOffreEmprunt(oeuvre, offres, acces);
  }

  document.querySelectorAll('.js-buy').forEach(btn => btn.addEventListener('click', () => {
    if (!utilisateur) {
      const retour = encodeURIComponent(`/pages/payment.html?oeuvre=${oeuvre.id}`);
      window.location.href = `/pages/login.html?redirect=${retour}`;
      return;
    }
    window.location.href = `/pages/payment.html?oeuvre=${oeuvre.id}&montant=${encodeURIComponent(prix || 300)}&titre=${encodeURIComponent(oeuvre.titre || 'Kalamundi')}`;
  }));

  document.querySelectorAll('.js-cart').forEach(btn => btn.addEventListener('click', () => {
    addToCart({
      oeuvreId: oeuvre.id,
      titre: oeuvre.titre || 'Livre Kalamundi',
      auteur: oeuvre.profiles?.nom || '',
      prix: prix || Number(oeuvre.prix || 300),
      devise: 'XAF',
    });
    toast('Livre ajouté au panier.', 'success');
    btn.textContent = 'Dans le panier';
    btn.disabled = true;
    setTimeout(() => { window.location.href = '/pages/payment.html?cart=1'; }, 450);
  }));

  // Bouton hors-ligne
  document.querySelectorAll('.js-offline').forEach(btnOffline => btnOffline.addEventListener('click', async (e) => {
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
  }));

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

function renderOffresLivre(oeuvre, offres, { deja, acces, prix }) {
  const premium = oeuvre.statut === 'premium';
  const chapitresGratuits = Number(oeuvre.chapitres_gratuits || offres.find(o => o.chapitres_gratuits)?.chapitres_gratuits || 0);
  const offreLecture = offres.find(o => o.type === 'lecture_gratuite') || (!premium ? offres[0] : null);
  const offreAchat = offres.find(o => o.type === 'achat_numerique') || (premium ? offres[0] : null);

  const lireTitre = premium && !acces
    ? (chapitresGratuits > 0 ? 'Lire l’extrait gratuit' : 'Aperçu indisponible')
    : 'Lire le livre';
  const lireTexte = premium && !acces
    ? (chapitresGratuits > 0 ? `${chapitresGratuits} chapitre(s) offert(s) avant paiement.` : 'L’auteur n’a pas encore défini d’extrait gratuit.')
    : 'Accès complet dans le lecteur EPUB/chapitres.';

  return `
    <div class="work-offers__head">
      <div>
        <h2 class="work-offers__title">Offres disponibles</h2>
        <p class="work-offers__text">Une fiche unique pour lire, acheter, sauvegarder et préparer les prochains usages du livre.</p>
      </div>
      <span class="work-offers__badge">Royalties auteur 50%</span>
    </div>
    <div class="work-offers__grid">
      <article class="offer-card ${offreLecture || !premium || acces ? 'offer-card--active' : 'offer-card--disabled'}">
        <div class="offer-card__kicker">Lecture</div>
        <h3 class="offer-card__title">${lireTitre}</h3>
        <p class="offer-card__text">${lireTexte}</p>
        ${offreLecture || !premium || acces || chapitresGratuits > 0
          ? `<a href="/pages/reader.html?id=${oeuvre.id}&ch=1" class="btn btn--primary btn--sm">Ouvrir</a>`
          : `<button class="btn btn--outline btn--sm" disabled>Bientôt</button>`}
      </article>
      <article class="offer-card ${premium && !acces ? 'offer-card--active' : ''}">
        <div class="offer-card__kicker">Achat numérique</div>
        <h3 class="offer-card__title">
          ${premium ? formatPrixXaf(prix || offreAchat?.prix || 300) : 'Inclus gratuitement'}
          ${premium && offreAchat?.prix_barre && Number(offreAchat.prix_barre) > Number(offreAchat.prix || prix || 0)
            ? `<span style="text-decoration:line-through;opacity:.55;font-size:var(--font-size-sm);margin-left:6px">${formatPrixXaf(offreAchat.prix_barre)}</span>
               <span class="offer-card__badge" style="margin-left:6px">-${Math.round((1 - Number(offreAchat.prix) / Number(offreAchat.prix_barre)) * 100)}%</span>`
            : ''}
        </h3>
        <p class="offer-card__text">${premium ? 'Paiement Fapshi, accès complet et part auteur visible.' : 'Ce livre est déjà en accès libre.'}</p>
        ${premium && !acces
          ? `<div class="offer-card__actions"><button class="btn btn--accent btn--sm js-buy">Payer avec Fapshi</button><button class="btn btn--outline btn--sm js-cart">Panier</button></div>`
          : `<span class="offer-card__status">Accès complet</span>`}
      </article>
      <article class="offer-card">
        <div class="offer-card__kicker">Hors ligne</div>
        <h3 class="offer-card__title">${deja ? 'Déjà sauvegardé' : 'Sauvegarder ce livre'}</h3>
        <p class="offer-card__text">Téléchargement local des chapitres disponibles pour lire sans connexion.</p>
        <button class="btn btn--outline btn--sm js-offline" data-sauvegarde="${deja}">
          ${deja ? 'Retirer' : 'Activer'}
        </button>
      </article>
      <article class="offer-card" id="offer-emprunt">
        <div class="offer-card__kicker">Emprunt</div>
        <h3 class="offer-card__title">Prêt numérique</h3>
        <div id="offer-emprunt-body"><p class="offer-card__text">Vérification du fonds maison…</p></div>
      </article>
      <article class="offer-card" id="offer-occasion">
        <div class="offer-card__kicker">Occasion</div>
        <h3 class="offer-card__title">Exemplaires papier</h3>
        <div id="offer-occasion-body"><p class="offer-card__text">Chargement des annonces…</p></div>
      </article>
    </div>`;
}

/* Annonces d'occasion pour ce livre — chargées à part car elles dépendent
   de livre_id (V007), pas de oeuvre_id. */
async function chargerOffresOccasion(oeuvre) {
  const zone = document.getElementById('offer-occasion-body');
  if (!zone) return;

  try {
    const annonces = await api.getOffresOccasion(oeuvre.id);
    if (!annonces?.length) {
      zone.innerHTML = `<p class="offer-card__text">Aucun exemplaire d'occasion en vente pour le moment. <a href="/pages/vendre.html">Vendez le vôtre</a>.</p>`;
      return;
    }

    zone.innerHTML = `
      <p class="offer-card__text">${annonces.length} exemplaire${annonces.length > 1 ? 's' : ''} disponible${annonces.length > 1 ? 's' : ''}.</p>
      <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0">
        ${annonces.slice(0, 3).map(a => `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:var(--font-size-sm)">
            <span>${escapeHtmlOccasion(a.conditions?.etat || 'bon')}${a.conditions?.ville ? ' · ' + escapeHtmlOccasion(a.conditions.ville) : ''}</span>
            <strong>${formatPrixXaf(a.prix)}</strong>
          </div>`).join('')}
      </div>
      <button class="btn btn--accent btn--sm js-occasion" data-offre="${annonces[0].id}">
        Acheter à ${formatPrixXaf(annonces[0].prix)}
      </button>`;

    zone.querySelector('.js-occasion')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Réservation…';
      try {
        const commandeId = await api.reserverOccasion(btn.dataset.offre);
        window.location.href = `/pages/commande.html?id=${commandeId}`;
      } catch (err) {
        btn.disabled = false;
        btn.textContent = `Acheter à ${formatPrixXaf(annonces[0].prix)}`;
        toast(err.message || 'Réservation impossible.', 'error');
      }
    });
  } catch {
    zone.innerHTML = `<p class="offer-card__text">Annonces indisponibles pour le moment.</p>`;
  }
}

function escapeHtmlOccasion(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Prêt numérique — fonds maison, accès temporel + file d'attente (P4 #15).
   La disponibilité n'est pas affichée en amont (RLS masque les emprunts des
   autres) : on tente l'emprunt, le serveur tranche et fait rejoindre la file
   d'attente automatiquement si le fonds est complet. */
async function chargerOffreEmprunt(oeuvre, offres, aDejaAcces) {
  const zone = document.getElementById('offer-emprunt-body');
  if (!zone) return;

  const offre = offres.find(o => o.type === 'pret_numerique');
  if (!offre) {
    zone.innerHTML = `<p class="offer-card__text">Pas encore proposé au prêt pour ce livre.</p>`;
    return;
  }

  const duree = Number(offre.duree_acces_jours || 14);

  if (!utilisateur) {
    zone.innerHTML = `
      <p class="offer-card__text">Prêt de ${duree} jours depuis le fonds maison Kalamundi.</p>
      <a href="/pages/login.html?redirect=/pages/work.html?id=${oeuvre.id}" class="btn btn--outline btn--sm">Se connecter pour emprunter</a>`;
    return;
  }

  if (aDejaAcces) {
    zone.innerHTML = `<p class="offer-card__text">Vous avez déjà accès à ce livre (achat ou emprunt en cours).</p>`;
    const { emprunt } = await api.getStatutEmpruntOffre(offre.id, utilisateur.id).catch(() => ({ emprunt: null }));
    if (emprunt) {
      zone.innerHTML = `
        <p class="offer-card__text">Emprunté jusqu'au ${formatDate(emprunt.expire_le)}.</p>
        <button class="btn btn--outline btn--sm js-rendre" data-emprunt="${emprunt.id}">Rendre le livre</button>`;
      zone.querySelector('.js-rendre')?.addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        btn.textContent = 'Retour…';
        try {
          await api.rendreLivre(btn.dataset.emprunt);
          toast('Livre rendu, merci !', 'success');
          rendreActions(oeuvre);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Rendre le livre';
          toast(err.message || 'Retour impossible.', 'error');
        }
      });
    }
    return;
  }

  const { position } = await api.getStatutEmpruntOffre(offre.id, utilisateur.id).catch(() => ({ position: null }));
  if (position) {
    zone.innerHTML = `
      <p class="offer-card__text">Fonds maison complet — vous êtes en position ${position} dans la file d'attente.</p>
      <button class="btn btn--outline btn--sm js-quitter-file">Quitter la file</button>`;
    zone.querySelector('.js-quitter-file')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      try {
        await api.quitterFileAttente(offre.id);
        toast('Vous avez quitté la file d\'attente.', 'info');
        chargerOffreEmprunt(oeuvre, offres, aDejaAcces);
      } catch (err) {
        btn.disabled = false;
        toast(err.message || 'Action impossible.', 'error');
      }
    });
    return;
  }

  zone.innerHTML = `
    <p class="offer-card__text">Prêt de ${duree} jours depuis le fonds maison, sans frais.</p>
    <button class="btn btn--accent btn--sm js-emprunter" data-offre="${offre.id}">Emprunter</button>`;

  zone.querySelector('.js-emprunter')?.addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.textContent = 'Emprunt…';
    try {
      await api.emprunterLivre(btn.dataset.offre);
      toast(`Livre emprunté pour ${duree} jours !`, 'success');
      rendreActions(oeuvre);
    } catch (err) {
      if (err.message === 'file_attente') {
        try {
          const pos = await api.rejoindreFileAttente(btn.dataset.offre);
          toast(`Fonds maison complet. Vous êtes en position ${pos} dans la file d'attente.`, 'info');
          chargerOffreEmprunt(oeuvre, offres, aDejaAcces);
        } catch (err2) {
          btn.disabled = false;
          btn.textContent = 'Emprunter';
          toast(err2.message || 'Impossible de rejoindre la file d\'attente.', 'error');
        }
      } else {
        btn.disabled = false;
        btn.textContent = 'Emprunter';
        toast(err.message || 'Emprunt impossible.', 'error');
      }
    }
  });
}

async function chargerCoucheSociale(oeuvre) {
  const panel = document.getElementById('work-social-panel');
  if (!panel) return;
  try {
    const [stats, etagere] = await Promise.all([
      api.getStatsSocialesOeuvre(oeuvre.id),
      utilisateur ? api.getEtagereOeuvre(utilisateur.id, oeuvre.id) : Promise.resolve(null),
    ]);
    panel.innerHTML = renderCoucheSociale(oeuvre, stats, etagere);
    brancherActionsSociales(oeuvre, panel);
  } catch (err) {
    console.warn('Couche sociale indisponible :', err);
    panel.innerHTML = `
      <div class="work-social__empty">
        <strong>Activité lecteurs</strong>
        <span>Les avis restent disponibles plus bas.</span>
      </div>`;
  }
}

function renderCoucheSociale(oeuvre, stats, etagere) {
  const actif = etagere?.statut || '';
  const note = stats.noteMoyenne ? `${stats.noteMoyenne.toFixed(1)} / 5` : 'Pas encore';
  const actions = [
    ['a_lire', 'À lire'],
    ['en_cours', 'En cours'],
    ['termine', 'Terminé'],
    ['favori', 'Favori'],
  ].map(([statut, label]) => `
    <button type="button" class="shelf-action ${actif === statut ? 'is-active' : ''}"
      data-shelf="${statut}" ${!utilisateur ? 'data-login-required="true"' : ''}>
      ${label}
    </button>`).join('');

  return `
    <div class="work-social__head">
      <div>
        <h2 class="work-social__title">Activité des lecteurs</h2>
        <p class="work-social__text">Notes, avis et étagères donnent de la preuve sociale à l'œuvre.</p>
      </div>
      ${actif ? `<span class="work-social__status">Dans votre étagère : ${labelStatutEtagere(actif)}</span>` : ''}
    </div>
    <div class="work-social__stats">
      <div class="social-stat"><strong>${formatNombre(stats.nbAvis)}</strong><span>avis notés</span></div>
      <div class="social-stat"><strong>${note}</strong><span>note moyenne</span></div>
      <div class="social-stat"><strong>${formatNombre(stats.aLire)}</strong><span>à lire</span></div>
      <div class="social-stat"><strong>${formatNombre(stats.enCours)}</strong><span>en cours</span></div>
      <div class="social-stat"><strong>${formatNombre(stats.termines)}</strong><span>terminés</span></div>
      <div class="social-stat"><strong>${formatNombre(stats.favoris)}</strong><span>favoris</span></div>
    </div>
    <div class="work-social__actions">
      ${actions}
      ${actif ? '<button type="button" class="shelf-action shelf-action--muted" data-shelf-remove="true">Retirer</button>' : ''}
    </div>
    ${!utilisateur ? '<p class="work-social__login">Connectez-vous pour ajouter ce livre à votre bibliothèque personnelle.</p>' : ''}`;
}

function labelStatutEtagere(statut) {
  return {
    a_lire: 'À lire',
    en_cours: 'En cours',
    termine: 'Terminé',
    favori: 'Favori',
  }[statut] || statut;
}

function progressionPourStatut(statut) {
  if (statut === 'termine') return 100;
  if (statut === 'en_cours') return 10;
  return 0;
}

function brancherActionsSociales(oeuvre, panel) {
  panel.querySelectorAll('[data-shelf]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!utilisateur || btn.dataset.loginRequired === 'true') {
        window.location.href = `/pages/login.html?redirect=${encodeURIComponent(`/pages/work.html?id=${oeuvre.id}`)}`;
        return;
      }
      const statut = btn.dataset.shelf;
      btn.disabled = true;
      try {
        await api.setEtagereOeuvre(utilisateur.id, oeuvre.id, statut, progressionPourStatut(statut));
        toast(`Livre ajouté : ${labelStatutEtagere(statut)}`, 'success');
        await chargerCoucheSociale(oeuvre);
      } catch (err) {
        console.error(err);
        toastErreur('Impossible de mettre à jour votre étagère.');
        btn.disabled = false;
      }
    });
  });

  panel.querySelector('[data-shelf-remove="true"]')?.addEventListener('click', async (e) => {
    if (!utilisateur) return;
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api.retirerEtagereOeuvre(utilisateur.id, oeuvre.id);
      toast('Livre retiré de votre étagère.', 'info');
      await chargerCoucheSociale(oeuvre);
    } catch (err) {
      console.error(err);
      toastErreur('Impossible de retirer ce livre.');
      btn.disabled = false;
    }
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
    if (oeuvreCourante) await chargerCoucheSociale(oeuvreCourante);

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

    grid.innerHTML = filtrees.map(o => {
      const coverUrl = normaliserUrlImage(o.couverture_url);
      return `
        <a href="/pages/work.html?id=${o.id}" class="work-reco-card">
          <div class="work-reco-card__cover">
            ${coverUrl ? `<img src="${echapperAttr(coverUrl)}" alt="${echapperAttr(o.titre)}" onerror="this.outerHTML='📖'" />` : '📖'}
          </div>
          <div class="work-reco-card__body">
            <div class="work-reco-card__title">${escapeHtml(o.titre)}</div>
            <div class="work-reco-card__author">${escapeHtml(o.profiles?.nom || '—')}</div>
            <div class="work-reco-card__author">${o.statut === 'premium' ? 'Premium' : 'Gratuit'}</div>
          </div>
        </a>`;
    }).join('');

    section.style.display = 'block';
  } catch { /* silencieux — les reco sont non-critiques */ }
}

injecterPub('work');
