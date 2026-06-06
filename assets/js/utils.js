/* ============================================================
   utils.js — Fonctions utilitaires partagées
   Kalamundi — La Plume du Monde
   ============================================================ */

/* ============================================================
   Formatage
   ============================================================ */

export function formatDate(dateStr, options = {}) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
    ...options,
  });
}

export function formatDateCourt(dateStr) {
  return formatDate(dateStr, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatNombre(n) {
  if (n === null || n === undefined) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace('.0', '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1).replace('.0', '') + 'k';
  return n.toString();
}

export function formatMontant(montant, devise = 'USD') {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise }).format(montant);
}

export function dureeDepuis(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const heures  = Math.floor(diff / 3600000);
  const jours   = Math.floor(diff / 86400000);
  const mois    = Math.floor(jours / 30);
  const ans     = Math.floor(jours / 365);
  if (minutes < 1)   return 'à l\'instant';
  if (minutes < 60)  return `il y a ${minutes} min`;
  if (heures < 24)   return `il y a ${heures}h`;
  if (jours < 30)    return `il y a ${jours} jour${jours > 1 ? 's' : ''}`;
  if (mois < 12)     return `il y a ${mois} mois`;
  return `il y a ${ans} an${ans > 1 ? 's' : ''}`;
}

export function truncate(texte, max = 150) {
  if (!texte || texte.length <= max) return texte || '';
  return texte.slice(0, max).trimEnd() + '…';
}

export function slugify(texte) {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/* ============================================================
   Validation
   ============================================================ */

export function validerEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validerMotDePasse(mdp) {
  return mdp && mdp.length >= 8;
}

export function sanitizeTexte(texte) {
  const div = document.createElement('div');
  div.textContent = texte;
  return div.innerHTML;
}

/* ============================================================
   DOM
   ============================================================ */

export function qs(selector, parent = document) {
  return parent.querySelector(selector);
}

export function qsa(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function creerElement(tag, classes = [], attributs = {}) {
  const el = document.createElement(tag);
  if (classes.length) el.classList.add(...classes);
  Object.entries(attributs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

export function afficher(el)  { el?.classList.remove('hidden'); }
export function cacher(el)    { el?.classList.add('hidden'); }
export function toggle(el)    { el?.classList.toggle('hidden'); }

/* ============================================================
   Toast notifications
   ============================================================ */

let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = creerElement('div', ['toast-container']);
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function toast(message, type = 'info', duree = 3500) {
  const container = getToastContainer();
  const el = creerElement('div', ['toast', `toast--${type}`]);
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'all 0.3s ease';
    setTimeout(() => el.remove(), 300);
  }, duree);
}

export const toastSucces  = (msg) => toast(msg, 'success');
export const toastErreur  = (msg) => toast(msg, 'error', 5000);
export const toastInfo    = (msg) => toast(msg, 'info');

/* ============================================================
   LocalStorage sécurisé
   ============================================================ */

export function lsGet(cle, defaut = null) {
  try {
    const val = localStorage.getItem('kala_' + cle);
    return val !== null ? JSON.parse(val) : defaut;
  } catch { return defaut; }
}

export function lsSet(cle, valeur) {
  try { localStorage.setItem('kala_' + cle, JSON.stringify(valeur)); }
  catch {}
}

export function lsDel(cle) {
  localStorage.removeItem('kala_' + cle);
}

/* ============================================================
   Debounce / Throttle
   ============================================================ */

export function debounce(fn, delai = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delai);
  };
}

export function throttle(fn, delai = 300) {
  let dernierAppel = 0;
  return (...args) => {
    const maintenant = Date.now();
    if (maintenant - dernierAppel >= delai) {
      dernierAppel = maintenant;
      fn(...args);
    }
  };
}

/* ============================================================
   URL / Navigation
   ============================================================ */

export function getParam(nom) {
  return new URLSearchParams(window.location.search).get(nom);
}

export function navigate(url) {
  window.location.href = url;
}

export function navigateAvecParams(url, params = {}) {
  const qs = new URLSearchParams(params).toString();
  window.location.href = qs ? `${url}?${qs}` : url;
}

/* ============================================================
   Fichiers
   ============================================================ */

export function formatTailleFichier(octets) {
  if (octets < 1024)        return octets + ' o';
  if (octets < 1024 * 1024) return (octets / 1024).toFixed(1) + ' Ko';
  return (octets / (1024 * 1024)).toFixed(1) + ' Mo';
}

export function extensionFichier(nomFichier) {
  return nomFichier.split('.').pop().toLowerCase();
}

export const EXTENSIONS_AUTORISEES = ['txt', 'docx', 'pdf', 'epub', 'odt'];
export const TAILLE_MAX_FICHIER    = 50 * 1024 * 1024; // 50 MB

export function validerFichier(fichier) {
  const ext = extensionFichier(fichier.name);
  if (!EXTENSIONS_AUTORISEES.includes(ext)) {
    return { valide: false, erreur: `Format non supporté. Formats acceptés : ${EXTENSIONS_AUTORISEES.join(', ')}` };
  }
  if (fichier.size > TAILLE_MAX_FICHIER) {
    return { valide: false, erreur: `Fichier trop lourd. Maximum : 50 Mo` };
  }
  return { valide: true };
}

/* ============================================================
   Copier dans le presse-papier
   ============================================================ */

export async function copier(texte) {
  try {
    await navigator.clipboard.writeText(texte);
    toastSucces('Copié !');
  } catch {
    toastErreur('Impossible de copier');
  }
}
