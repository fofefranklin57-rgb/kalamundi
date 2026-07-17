/* ============================================================
   epub-builder.js — EPUB canonique navigateur pour publication
   ============================================================ */

const JSZIP_CDN = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';

export async function construireEpubCanonique({ oeuvre, chapitres }) {
  if (!window.JSZip) await chargerScript(JSZIP_CDN);
  if (!window.JSZip) throw new Error('Impossible de charger le générateur EPUB.');

  const zip = new window.JSZip();
  const titre = oeuvre.titre || 'Livre Kalamundi';
  const auteur = oeuvre.auteur || 'Auteur Kalamundi';
  const langue = oeuvre.langue_originale || 'fr';
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const identifier = `urn:kalamundi:${oeuvre.id || Date.now()}`;
  const normalized = (chapitres || []).map((ch, index) => ({
    ...ch,
    numero: ch.numero || index + 1,
    titre: ch.titre || `Chapitre ${index + 1}`,
    href: `chapters/${String(index + 1).padStart(3, '0')}-${echapperFichier(ch.chapitre_id || `chapitre-${index + 1}`)}.xhtml`,
  }));

  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', containerXml());
  const oebps = zip.folder('OEBPS');
  oebps.file('content.opf', contentOpf({ titre, auteur, langue, identifier, modified, chapitres: normalized }));
  oebps.file('nav.xhtml', navXhtml({ titre, auteur, langue, chapitres: normalized }));
  oebps.folder('styles').file('book.css', styles());
  const folderChapitres = oebps.folder('chapters');
  normalized.forEach(ch => {
    folderChapitres.file(ch.href.replace('chapters/', ''), chapitreXhtml({ titre, langue, chapitre: ch }));
  });

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/epub+zip',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
}

export function validerStructureEpub({ chapitres }) {
  const erreurs = [];
  if (!chapitres?.length) erreurs.push('Aucun chapitre normalisé.');
  if (chapitres?.some(ch => !ch.chapitre_id)) erreurs.push('Un chapitre n’a pas de chapitre_id.');
  if (chapitres?.some(ch => !String(ch.contenu || '').trim())) erreurs.push('Un chapitre est vide.');
  return { valide: erreurs.length === 0, erreurs };
}

function containerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;
}

function contentOpf({ titre, auteur, langue, identifier, modified, chapitres }) {
  const manifestChapters = chapitres.map((ch, index) =>
    `    <item id="chapitre-${index + 1}" href="${xml(ch.href)}" media-type="application/xhtml+xml"/>`
  ).join('\n');
  const spine = chapitres.map((_, index) => `    <itemref idref="chapitre-${index + 1}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${xml(langue)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/">
    <dc:identifier id="book-id">${xml(identifier)}</dc:identifier>
    <dc:title>${xml(titre)}</dc:title>
    <dc:creator>${xml(auteur)}</dc:creator>
    <dc:language>${xml(langue)}</dc:language>
    <meta property="dcterms:modified">${xml(modified)}</meta>
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
  const items = chapitres.map(ch => `      <li><a href="${xml(ch.href)}">${xml(ch.titre)}</a></li>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${xml(langue)}" xml:lang="${xml(langue)}">
<head><title>${xml(titre)}</title><link rel="stylesheet" href="styles/book.css"/></head>
<body>
  <section class="cover"><h1>${xml(titre)}</h1><p>${xml(auteur)}</p></section>
  <nav epub:type="toc" id="toc"><h2>Table des matières</h2><ol>
${items}
  </ol></nav>
</body>
</html>`;
}

function chapitreXhtml({ titre, langue, chapitre }) {
  const paragraphs = String(chapitre.contenu || '')
    .split(/\n{2,}/)
    .map(p => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map(p => `    <p>${xml(p)}</p>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${xml(langue)}" xml:lang="${xml(langue)}">
<head><title>${xml(titre)} - ${xml(chapitre.titre)}</title><link rel="stylesheet" href="../styles/book.css"/></head>
<body>
  <section epub:type="chapter" data-kalamundi-chapitre-id="${xml(chapitre.chapitre_id)}">
    <h1>${xml(chapitre.titre)}</h1>
${paragraphs || '    <p></p>'}
  </section>
</body>
</html>`;
}

function styles() {
  return `body{color:#2B241B;font-family:Georgia,"Times New Roman",serif;line-height:1.65;margin:7%;}h1,h2{color:#123D2B;line-height:1.2;}p{text-align:justify;margin:0 0 1em;}.cover{min-height:70vh;display:flex;flex-direction:column;justify-content:center;text-align:center;}`;
}

function xml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function echapperFichier(value) {
  return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '-');
}

function chargerScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Impossible de charger ${src}`));
    document.head.appendChild(script);
  });
}
