/* Contrôle de l'import serveur (P1 #6) :
   fabrique de vrais fichiers (DOCX compressé en deflate comme le fait Word,
   ODT, EPUB, HTML, TXT) et vérifie que l'extraction + la normalisation
   fonctionnent sans aucune dépendance externe. */

import fs from 'node:fs';
import path from 'node:path';
import { extraireTexte, FORMATS_SERVEUR } from './lib/document-import.mjs';
import { construireEpub, zipStore } from './build_epub.mjs';
import { normaliserLivreDepuisTexte } from './lib/book-normalizer.mjs';

const root = process.cwd();
const erreurs = [];

const PHRASE_1 = 'La premiere page pose le monde et installe la voix du recit.';
const PHRASE_2 = 'La deuxieme page verifie que le decoupage garde des identifiants stables.';

/* ---------- Écriture ZIP de test (stored + deflate) ---------- */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ CRC[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(buf) {
  const flux = new Blob([buf]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return Buffer.from(await new Response(flux).arrayBuffer());
}

/* Écrit un ZIP dont chaque entrée est compressée (méthode 8) — comme un vrai .docx */
async function zipDeflate(entries) {
  const locals = [];
  const centraux = [];
  let offset = 0;

  for (const [nom, valeur] of entries) {
    const nomBuf = Buffer.from(nom, 'utf8');
    const brut = Buffer.isBuffer(valeur) ? valeur : Buffer.from(String(valeur), 'utf8');
    const comp = await deflateRaw(brut);
    const crc = crc32(brut);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);
    local.writeUInt32LE(brut.length, 22);
    local.writeUInt16LE(nomBuf.length, 26);
    locals.push(local, nomBuf, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(brut.length, 24);
    central.writeUInt16LE(nomBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    centraux.push(central, nomBuf);

    offset += local.length + nomBuf.length + comp.length;
  }

  const tailleCentrale = centraux.reduce((t, p) => t + p.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(tailleCentrale, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, ...centraux, eocd]);
}

/* ---------- Fabrication des documents ---------- */

const docxXml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>Chapitre 1</w:t></w:r></w:p>
<w:p><w:r><w:t>${PHRASE_1}</w:t></w:r></w:p>
<w:p><w:r><w:t>Chapitre 2</w:t></w:r></w:p>
<w:p><w:r><w:t>${PHRASE_2}</w:t></w:r></w:p>
</w:body></w:document>`;

const odtXml = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis" xmlns:text="urn:oasis:text"><office:body><office:text>
<text:h text:outline-level="1">Chapitre 1</text:h>
<text:p>${PHRASE_1}</text:p>
<text:h text:outline-level="1">Chapitre 2</text:h>
<text:p>${PHRASE_2}</text:p>
</office:text></office:body></office:document-content>`;

const htmlSource = `<html><head><style>p{color:red}</style><script>var x=1;</script></head><body>
<h1>Chapitre 1</h1><p>${PHRASE_1}</p><h1>Chapitre 2</h1><p>${PHRASE_2}</p></body></html>`;

const txtSource = `Chapitre 1\n\n${PHRASE_1}\n\nChapitre 2\n\n${PHRASE_2}\n`;

/* ---------- Contrôles ---------- */

function verifierTexte(format, texte) {
  if (!texte?.includes(PHRASE_1) || !texte.includes(PHRASE_2)) {
    erreurs.push(`${format} : le texte des deux chapitres doit être extrait (obtenu : ${JSON.stringify(texte?.slice(0, 120))}).`);
    return;
  }
  const livre = normaliserLivreDepuisTexte(texte, { titre: 'Import Test', auteur: 'Kalamundi', langue_originale: 'fr', format_source: format });
  if (livre.chapitres.length !== 2) {
    erreurs.push(`${format} : la normalisation devait produire 2 chapitres, obtenu ${livre.chapitres.length}.`);
  }
  if (livre.chapitres.some(ch => !/^import-test-ch-\d{3}-[0-9a-f]{8}$/.test(ch.chapitre_id))) {
    erreurs.push(`${format} : les chapitre_id doivent rester stables et au format partagé.`);
  }
}

/* DOCX réellement compressé (deflate) — comme un fichier Word réel */
const docx = await zipDeflate([
  ['[Content_Types].xml', '<?xml version="1.0"?><Types/>'],
  ['word/document.xml', docxXml],
]);
verifierTexte('docx', await extraireTexte(docx, 'docx'));

/* ODT stocké (non compressé) — vérifie l'autre branche du lecteur ZIP */
const odt = zipStore([['mimetype', 'application/vnd.oasis.opendocument.text'], ['content.xml', odtXml]]);
verifierTexte('odt', await extraireTexte(odt, 'odt'));

/* EPUB produit par notre propre générateur */
const livreEpub = normaliserLivreDepuisTexte(txtSource, { titre: 'Import Test', auteur: 'Kalamundi', langue_originale: 'fr', format_source: 'txt' });
verifierTexte('epub', await extraireTexte(construireEpub(livreEpub), 'epub'));

verifierTexte('html', await extraireTexte(Buffer.from(htmlSource, 'utf8'), 'html'));
verifierTexte('txt', await extraireTexte(Buffer.from(txtSource, 'utf8'), 'txt'));

/* Le HTML ne doit pas laisser fuiter script/style */
const htmlTexte = await extraireTexte(Buffer.from(htmlSource, 'utf8'), 'html');
if (/var x=1|color:red/.test(htmlTexte)) erreurs.push('html : le contenu des balises script/style ne doit pas être extrait.');

/* Le PDF doit être refusé explicitement (il reste côté client) */
await extraireTexte(Buffer.from('%PDF-1.4'), 'pdf')
  .then(() => erreurs.push('pdf : l’import serveur doit refuser le PDF explicitement.'))
  .catch(e => { if (!/navigateur/i.test(e.message)) erreurs.push(`pdf : le refus doit expliquer que la conversion reste cliente (obtenu : ${e.message}).`); });

/* Un format inconnu doit échouer proprement */
await extraireTexte(Buffer.from('x'), 'xyz')
  .then(() => erreurs.push('Un format inconnu doit être refusé.'))
  .catch(() => {});

/* Une archive corrompue doit échouer proprement */
await extraireTexte(Buffer.from('pas un zip du tout'), 'docx')
  .then(() => erreurs.push('Une archive invalide doit être refusée.'))
  .catch(() => {});

/* L'endpoint doit exister et réutiliser le normaliseur partagé */
const endpointPath = path.join(root, 'functions/api/import-book.js');
if (!fs.existsSync(endpointPath)) {
  erreurs.push('functions/api/import-book.js doit exister pour l’import serveur.');
} else {
  const endpoint = fs.readFileSync(endpointPath, 'utf8');
  if (!endpoint.includes('normaliserLivreDepuisTexte')) {
    erreurs.push('import-book.js doit réutiliser le normaliseur partagé (chapitre_id identiques au client).');
  }
  if (!endpoint.includes('extraireTexte')) {
    erreurs.push('import-book.js doit utiliser l’extracteur portable document-import.');
  }
  if (!/onRequestPost/.test(endpoint)) erreurs.push('import-book.js doit exposer onRequestPost.');
  if (!/\btexte,/.test(endpoint)) {
    erreurs.push('import-book.js doit renvoyer « texte » pour préserver le contrat de lireFichier().');
  }
}

/* Le client doit tenter le serveur ET garder un repli local */
const upload = fs.readFileSync(path.join(root, 'assets/js/upload.js'), 'utf8');
if (!upload.includes('/api/import-book')) {
  erreurs.push('upload.js doit tenter l’import serveur /api/import-book.');
}
if (!/lireViaServeur/.test(upload) || !upload.includes('return null; // repli client')) {
  erreurs.push('upload.js doit retomber silencieusement sur le parsing client si le serveur échoue (hors-ligne).');
}
if (/FORMATS_SERVEUR\s*=\s*\[[^\]]*'pdf'/.test(upload)) {
  erreurs.push('upload.js ne doit pas envoyer le PDF au serveur (pdf.js reste côté client).');
}

if (!FORMATS_SERVEUR.includes('docx') || FORMATS_SERVEUR.includes('pdf')) {
  erreurs.push('FORMATS_SERVEUR doit accepter docx et exclure pdf.');
}

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Import serveur (docx/odt/epub/html/txt) OK.');
