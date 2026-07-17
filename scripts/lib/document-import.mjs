/* ============================================================
   document-import.mjs — Extraction de texte portable (DOCX/ODT/EPUB/HTML/TXT)
   Kalamundi — La Plume du Monde

   Pourquoi : l'import se faisait uniquement dans le navigateur en
   téléchargeant mammoth + pdf.js + epub.js + JSZip depuis un CDN à chaque
   usage (plusieurs Mo, échec hors-ligne, data chère). Ce module extrait le
   texte SANS aucune dépendance, avec des APIs standard du Web, pour tourner
   aussi bien dans une Cloudflare Pages Function que dans Node ou le navigateur.

   Hors périmètre : le PDF (nécessite pdf.js) reste traité côté client.
   ============================================================ */

const SIG_EOCD = 0x06054b50;
const SIG_CENTRAL = 0x02014b50;

/* ============================================================
   Lecture ZIP — standard Web (DecompressionStream), zéro dépendance
   ============================================================ */

export async function lireZip(donnees) {
  const octets = donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees);
  const vue = new DataView(octets.buffer, octets.byteOffset, octets.byteLength);

  const eocd = trouverEocd(vue, octets.length);
  if (eocd < 0) throw new Error('Archive invalide : ce fichier n’est pas un ZIP lisible.');

  const nbEntrees = vue.getUint16(eocd + 10, true);
  let pointeur = vue.getUint32(eocd + 16, true);
  const fichiers = new Map();

  for (let i = 0; i < nbEntrees; i++) {
    if (vue.getUint32(pointeur, true) !== SIG_CENTRAL) break;

    const methode = vue.getUint16(pointeur + 10, true);
    const tailleCompressee = vue.getUint32(pointeur + 20, true);
    const longueurNom = vue.getUint16(pointeur + 28, true);
    const longueurExtra = vue.getUint16(pointeur + 30, true);
    const longueurCommentaire = vue.getUint16(pointeur + 32, true);
    const offsetLocal = vue.getUint32(pointeur + 42, true);
    const nom = new TextDecoder().decode(octets.subarray(pointeur + 46, pointeur + 46 + longueurNom));

    const nomLocal = vue.getUint16(offsetLocal + 26, true);
    const extraLocal = vue.getUint16(offsetLocal + 28, true);
    const debut = offsetLocal + 30 + nomLocal + extraLocal;
    const brut = octets.subarray(debut, debut + tailleCompressee);

    fichiers.set(nom, methode === 8 ? await inflateRaw(brut) : brut);
    pointeur += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }

  return fichiers;
}

function trouverEocd(vue, taille) {
  for (let i = taille - 22; i >= 0; i--) {
    if (vue.getUint32(i, true) === SIG_EOCD) return i;
  }
  return -1;
}

async function inflateRaw(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}

const texteDe = octets => new TextDecoder('utf-8').decode(octets);

/* ============================================================
   Utilitaires XML / HTML
   ============================================================ */

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decoderEntites(valeur) {
  return String(valeur)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (entier, nom) => ENTITES[nom.toLowerCase()] ?? entier);
}

function retirerBalises(fragment) {
  return decoderEntites(fragment.replace(/<[^>]*>/g, '')).replace(/[ \t ]+/g, ' ').trim();
}

function assemblerParagraphes(paragraphes) {
  return paragraphes.map(p => p.trim()).filter(Boolean).join('\n\n');
}

/* ============================================================
   Extracteurs par format
   ============================================================ */

/* DOCX : word/document.xml — un <w:p> = un paragraphe, texte dans <w:t> */
export async function texteDepuisDocx(donnees) {
  const zip = await lireZip(donnees);
  const doc = zip.get('word/document.xml');
  if (!doc) throw new Error('DOCX invalide : « word/document.xml » est absent.');

  const xml = texteDe(doc);
  const paragraphes = [...xml.matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)].map(([, contenu]) => {
    const morceaux = [...contenu.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => decoderEntites(m[1]));
    const avecSauts = contenu.replace(/<w:(?:br|cr)\b[^>]*\/?>/g, '\n');
    return morceaux.length ? morceaux.join('') : (avecSauts.includes('\n') ? '' : '');
  });

  const texte = assemblerParagraphes(paragraphes);
  if (!texte) throw new Error('DOCX vide : aucun texte extractible.');
  return texte;
}

/* ODT : content.xml — <text:p> et <text:h> */
export async function texteDepuisOdt(donnees) {
  const zip = await lireZip(donnees);
  const doc = zip.get('content.xml');
  if (!doc) throw new Error('ODT invalide : « content.xml » est absent.');

  const xml = texteDe(doc);
  const paragraphes = [...xml.matchAll(/<text:(?:p|h)\b[^>]*>([\s\S]*?)<\/text:(?:p|h)>/g)]
    .map(([, contenu]) => retirerBalises(contenu));

  const texte = assemblerParagraphes(paragraphes);
  if (!texte) throw new Error('ODT vide : aucun texte extractible.');
  return texte;
}

/* EPUB : container.xml → OPF → spine → XHTML dans l'ordre de lecture */
export async function texteDepuisEpub(donnees) {
  const zip = await lireZip(donnees);

  const container = zip.get('META-INF/container.xml');
  if (!container) throw new Error('EPUB invalide : « META-INF/container.xml » est absent.');

  const cheminOpf = texteDe(container).match(/full-path\s*=\s*"([^"]+)"/)?.[1];
  if (!cheminOpf) throw new Error('EPUB invalide : container.xml ne déclare aucun rootfile.');

  const opf = zip.get(cheminOpf);
  if (!opf) throw new Error(`EPUB invalide : le rootfile « ${cheminOpf} » est absent.`);

  const opfXml = texteDe(opf);
  const base = cheminOpf.includes('/') ? cheminOpf.slice(0, cheminOpf.lastIndexOf('/') + 1) : '';

  const items = new Map();
  for (const [, balise] of opfXml.matchAll(/(<item\b[^>]*>)/g)) {
    const id = balise.match(/\bid\s*=\s*"([^"]+)"/)?.[1];
    const href = balise.match(/\bhref\s*=\s*"([^"]+)"/)?.[1];
    if (id && href) items.set(id, href);
  }

  const ordre = [...opfXml.matchAll(/<itemref\b[^>]*\bidref\s*=\s*"([^"]+)"/g)].map(m => m[1]);
  const morceaux = [];

  for (const idref of ordre) {
    const href = items.get(idref);
    if (!href || /^[a-z]+:\/\//i.test(href)) continue;

    const contenu = zip.get(normaliserChemin(base + decodeURIComponent(href)));
    if (!contenu) continue;

    const corps = texteDe(contenu).match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? texteDe(contenu);
    const texte = texteDepuisHtml(corps);
    if (texte) morceaux.push(texte);
  }

  const texte = morceaux.join('\n\n');
  if (!texte) throw new Error('EPUB vide : aucun texte extractible depuis le spine.');
  return texte;
}

/* HTML / XHTML */
export function texteDepuisHtml(source) {
  const sansScripts = String(source)
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(p|div|h[1-6]|li|section|article|br)\s*\/?>/gi, '\n\n')
    .replace(/<br\b[^>]*\/?>/gi, '\n');

  return assemblerParagraphes(sansScripts.split(/\n{2,}/).map(retirerBalises));
}

function normaliserChemin(chemin) {
  const parties = [];
  for (const partie of chemin.split('/')) {
    if (partie === '.' || partie === '') continue;
    if (partie === '..') parties.pop();
    else parties.push(partie);
  }
  return parties.join('/');
}

/* ============================================================
   Point d'entrée unique
   ============================================================ */

export const FORMATS_SERVEUR = ['txt', 'md', 'html', 'htm', 'xhtml', 'docx', 'odt', 'epub'];

export function formatDepuisNom(nom) {
  return String(nom || '').toLowerCase().split('.').pop() || '';
}

export async function extraireTexte(donnees, format) {
  switch (format) {
    case 'txt':
    case 'md':
      return texteDe(donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees)).trim();
    case 'html':
    case 'htm':
    case 'xhtml':
      return texteDepuisHtml(texteDe(donnees instanceof Uint8Array ? donnees : new Uint8Array(donnees)));
    case 'docx':
      return texteDepuisDocx(donnees);
    case 'odt':
      return texteDepuisOdt(donnees);
    case 'epub':
      return texteDepuisEpub(donnees);
    case 'pdf':
      throw new Error('Le PDF est converti dans le navigateur (pdf.js) : il n’est pas accepté par l’import serveur.');
    default:
      throw new Error(`Format non pris en charge : « ${format || 'inconnu'} ».`);
  }
}
