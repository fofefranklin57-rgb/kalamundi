#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  escapeXml,
  normaliserLivreDepuisTexte,
  slugifier,
  texteEnParagraphes,
} from './lib/book-normalizer.mjs';

const args = process.argv.slice(2);

function arg(nom, defaut = null) {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : defaut;
}

function has(nom) {
  return args.includes(nom);
}

function main() {
  const input = arg('--input');
  const out = arg('--out');

  if (!input || !out || has('--help')) {
    console.log(`Usage:
  node scripts/build_epub.mjs --input manuscrit.txt --out livre.epub --title "Titre" --author "Auteur" --lang fr

Options:
  --json sortie.json   écrit aussi les chapitres normalisés
  --format txt|html    renseigne le format source`);
    process.exit(input && out ? 0 : 1);
  }

  const source = fs.readFileSync(input, 'utf8');
  const metadata = {
    titre: arg('--title', path.basename(input, path.extname(input))),
    auteur: arg('--author', 'Auteur Kalamundi'),
    langue_originale: arg('--lang', 'fr'),
    format_source: arg('--format', path.extname(input).replace('.', '') || 'texte'),
  };

  const livre = normaliserLivreDepuisTexte(source, metadata);
  const epub = construireEpub(livre);

  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, epub);

  const jsonOut = arg('--json');
  if (jsonOut) {
    fs.mkdirSync(path.dirname(path.resolve(jsonOut)), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(livre, null, 2), 'utf8');
  }

  console.log(`EPUB généré : ${out}`);
  console.log(`${livre.chapitres.length} chapitre(s) normalisé(s).`);
}

export function construireEpub(livre) {
  const titre = livre.titre || 'Livre Kalamundi';
  const auteur = livre.auteur || 'Auteur Kalamundi';
  const langue = livre.langue_originale || 'fr';
  const identifier = `urn:kalamundi:${slugifier(titre) || 'livre'}:${Date.now()}`;
  const dateIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  const chapitres = livre.chapitres.map((chapitre, index) => {
    const href = `chapters/${String(index + 1).padStart(3, '0')}-${chapitre.chapitre_id}.xhtml`;
    return { ...chapitre, href };
  });

  const entries = [
    ['mimetype', 'application/epub+zip'],
    ['META-INF/container.xml', containerXml()],
    ['OEBPS/styles/book.css', css()],
    ['OEBPS/nav.xhtml', navXhtml({ titre, auteur, langue, chapitres })],
    ['OEBPS/content.opf', contentOpf({ titre, auteur, langue, identifier, dateIso, chapitres })],
    ...chapitres.map(ch => [`OEBPS/${ch.href}`, chapitreXhtml({ titre, langue, chapitre: ch })]),
  ];

  return zipStore(entries);
}

function containerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function contentOpf({ titre, auteur, langue, identifier, dateIso, chapitres }) {
  const manifestChapters = chapitres.map((ch, index) =>
    `    <item id="chapitre-${index + 1}" href="${escapeXml(ch.href)}" media-type="application/xhtml+xml"/>`
  ).join('\n');
  const spine = chapitres.map((_, index) => `    <itemref idref="chapitre-${index + 1}"/>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${escapeXml(langue)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
    <dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(titre)}</dc:title>
    <dc:creator>${escapeXml(auteur)}</dc:creator>
    <dc:language>${escapeXml(langue)}</dc:language>
    <meta property="dcterms:modified">${escapeXml(dateIso)}</meta>
    <meta property="schema:accessibilityFeature">tableOfContents</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="style" href="styles/book.css" media-type="text/css"/>
${manifestChapters}
  </manifest>
  <spine>
${spine}
  </spine>
</package>`;
}

function navXhtml({ titre, auteur, langue, chapitres }) {
  const items = chapitres.map(ch =>
    `      <li><a href="${escapeXml(ch.href)}">${escapeXml(ch.titre || `Chapitre ${ch.numero}`)}</a></li>`
  ).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(langue)}" xml:lang="${escapeXml(langue)}">
<head>
  <title>${escapeXml(titre)}</title>
  <link rel="stylesheet" href="styles/book.css"/>
</head>
<body>
  <section class="cover">
    <h1>${escapeXml(titre)}</h1>
    <p>${escapeXml(auteur)}</p>
  </section>
  <nav epub:type="toc" id="toc">
    <h2>Table des matières</h2>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>`;
}

function chapitreXhtml({ titre, langue, chapitre }) {
  const heading = chapitre.titre || `Chapitre ${chapitre.numero}`;
  const paragraphes = texteEnParagraphes(chapitre.contenu)
    .map(p => `    <p>${escapeXml(p)}</p>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(langue)}" xml:lang="${escapeXml(langue)}">
<head>
  <title>${escapeXml(titre)} - ${escapeXml(heading)}</title>
  <link rel="stylesheet" href="../styles/book.css"/>
</head>
<body>
  <section epub:type="chapter" data-kalamundi-chapitre-id="${escapeXml(chapitre.chapitre_id)}">
    <h1>${escapeXml(heading)}</h1>
${paragraphes || '    <p></p>'}
  </section>
</body>
</html>`;
}

function css() {
  return `body {
  color: #2B241B;
  font-family: Georgia, "Times New Roman", serif;
  line-height: 1.65;
  margin: 7%;
}
h1, h2 {
  color: #123D2B;
  font-weight: 700;
  line-height: 1.2;
}
p {
  margin: 0 0 1em;
  text-align: justify;
}
.cover {
  min-height: 70vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  text-align: center;
}`;
}

export function zipStore(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  entries.forEach(([name, value]) => {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.isBuffer(value) ? value : Buffer.from(String(value), 'utf8');
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    localParts.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  });

  const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, eocd]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

/* Exécution CLI — DOIT rester en fin de module : main() utilise CRC_TABLE,
   qui est un const initialisé plus haut. Appelé en tête de fichier, il tombait
   dans la zone morte temporelle (ReferenceError).
   Comparaison via pathToFileURL : sur Windows `file://${chemin}` produit
   file://C:/... quand import.meta.url vaut file:///C:/... → main() n'était
   jamais appelé et `npm run epub:build` ne faisait rien. */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
