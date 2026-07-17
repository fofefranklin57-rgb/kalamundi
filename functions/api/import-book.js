/* ============================================================
   /api/import-book — Import serveur robuste (P1 #6)
   Kalamundi — La Plume du Monde

   Reçoit un manuscrit (DOCX/ODT/EPUB/HTML/TXT), en extrait le texte SANS
   dépendance externe, puis le normalise avec le MÊME normaliseur que le
   client et les scripts → chapitres et chapitre_id strictement identiques.

   Pourquoi : l'import ne vivait que dans le navigateur et téléchargeait
   mammoth + epub.js + JSZip depuis un CDN à chaque usage (plusieurs Mo,
   inutilisable hors-ligne, data chère au Cameroun).

   Le PDF reste volontairement côté client (pdf.js) — voir FORMATS_SERVEUR.
   ============================================================ */

import { extraireTexte, formatDepuisNom, FORMATS_SERVEUR } from '../../scripts/lib/document-import.mjs';
import { normaliserLivreDepuisTexte } from '../../scripts/lib/book-normalizer.mjs';

/* Garde-fou : au-delà, on refuse plutôt que de faire expirer le Worker. */
const TAILLE_MAX = 12 * 1024 * 1024;

const ENTETES = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
};

const reponse = (donnees, status = 200) =>
  new Response(JSON.stringify(donnees), { status, headers: ENTETES });

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: ENTETES });
}

export async function onRequestPost({ request }) {
  let form;
  try {
    form = await request.formData();
  } catch {
    return reponse({ erreur: 'Requête invalide : multipart/form-data attendu.' }, 400);
  }

  const fichier = form.get('fichier');
  if (!fichier || typeof fichier.arrayBuffer !== 'function') {
    return reponse({ erreur: 'Aucun fichier reçu (champ « fichier »).' }, 400);
  }

  const format = (form.get('format') || formatDepuisNom(fichier.name)).toLowerCase();
  if (!FORMATS_SERVEUR.includes(format)) {
    return reponse({
      erreur: format === 'pdf'
        ? 'Le PDF est converti dans le navigateur : utilisez l’import client.'
        : `Format non pris en charge : « ${format || 'inconnu'} ».`,
      formats_acceptes: FORMATS_SERVEUR,
    }, 415);
  }

  const donnees = new Uint8Array(await fichier.arrayBuffer());
  if (!donnees.length) return reponse({ erreur: 'Fichier vide.' }, 400);
  if (donnees.length > TAILLE_MAX) {
    return reponse({ erreur: `Fichier trop volumineux (max ${TAILLE_MAX / 1024 / 1024} Mo).` }, 413);
  }

  let texte;
  try {
    texte = await extraireTexte(donnees, format);
  } catch (error) {
    return reponse({ erreur: error.message || 'Extraction impossible.' }, 422);
  }

  if (!texte?.trim()) {
    return reponse({ erreur: 'Aucun texte extractible de ce fichier.' }, 422);
  }

  /* Même normaliseur que le client et les scripts : chapitre_id stables. */
  const livre = normaliserLivreDepuisTexte(texte, {
    titre: form.get('titre') || fichier.name?.replace(/\.[^.]+$/, '') || 'Livre Kalamundi',
    auteur: form.get('auteur') || 'Auteur Kalamundi',
    langue_originale: form.get('langue') || 'fr',
    format_source: format,
  });

  return reponse({
    titre: livre.titre,
    auteur: livre.auteur,
    langue_originale: livre.langue_originale,
    format_source: format,
    nb_chapitres: livre.chapitres.length,
    caracteres: texte.length,
    /* `texte` conserve le contrat de lireFichier() côté client : le client
       continue de recevoir du texte brut et fait son propre découpage. */
    texte,
    chapitres: livre.chapitres,
  });
}
