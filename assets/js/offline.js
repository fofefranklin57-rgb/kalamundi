/* ============================================================
   offline.js — Mode hors-ligne Kalamundi
   Stockage des livres dans IndexedDB pour lecture sans internet
   ============================================================ */

const DB_NAME    = 'kalamundi-offline';
const DB_VERSION = 1;
const STORE_NAME = 'livres';

/* ── Ouvrir / créer la base IndexedDB ──────────────────────── */
function ouvrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('titre', 'titre', { unique: false });
        store.createIndex('date', 'date_sauvegarde', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ── Sauvegarder un livre ───────────────────────────────────── */
export async function sauvegarderLivre(oeuvre, chapitres) {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const enregistrement = {
      id:             oeuvre.id,
      titre:          oeuvre.titre,
      auteur:         oeuvre.profiles?.nom || 'Auteur inconnu',
      couverture_url: oeuvre.couverture_url || null,
      genre:          oeuvre.genre || '',
      resume:         oeuvre.resume || '',
      langue:         oeuvre.langue_originale || 'fr',
      chapitres:      chapitres,  // [{numero, titre, contenu}]
      nb_chapitres:   chapitres.length,
      date_sauvegarde: new Date().toISOString(),
      taille_ko:      Math.round(JSON.stringify(chapitres).length / 1024),
    };
    const req = store.put(enregistrement);
    req.onsuccess = () => resolve(enregistrement);
    req.onerror   = (e) => reject(e.target.error);
    tx.onerror    = (e) => reject(e.target.error);
  });
}

/* ── Récupérer un livre sauvegardé ─────────────────────────── */
export async function getLivre(id) {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.get(id);
    req.onsuccess = (e) => resolve(e.target.result || null);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ── Lister tous les livres sauvegardés ────────────────────── */
export async function listerLivres() {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ── Supprimer un livre sauvegardé ─────────────────────────── */
export async function supprimerLivre(id) {
  const db = await ouvrirDB();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req   = store.delete(id);
    req.onsuccess = () => resolve(true);
    req.onerror   = (e) => reject(e.target.error);
  });
}

/* ── Vérifier si un livre est déjà sauvegardé ──────────────── */
export async function estSauvegarde(id) {
  const livre = await getLivre(id);
  return !!livre;
}

/* ── Calculer l'espace total utilisé ───────────────────────── */
export async function espaceTotalKo() {
  const livres = await listerLivres();
  return livres.reduce((total, l) => total + (l.taille_ko || 0), 0);
}
