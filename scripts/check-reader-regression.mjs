import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readerPath = path.join(root, 'assets/js/reader.js');
const reader = fs.readFileSync(readerPath, 'utf8');

const errors = [];

if (/\[\s*etat\.oeuvre\s*,\s*etat\.chapitres\s*\]\s*=\s*await\s+Promise\.all/.test(reader)) {
  errors.push('reader.js ne doit pas charger oeuvre + chapitres dans un Promise.all au démarrage.');
}

if (!reader.includes('etat.oeuvre = await api.getOeuvre(etat.oeuvreId);')) {
  errors.push('reader.js doit charger l’oeuvre avant la liste des chapitres.');
}

if (!reader.includes('chargerChapitresEnLigne(etat.oeuvre)')) {
  errors.push('reader.js doit passer par chargerChapitresEnLigne pour le fallback de chapitres.');
}

if (!reader.includes('function normaliserChapitresOeuvre')) {
  errors.push('reader.js doit garder un fallback depuis les chapitres embarqués dans l’oeuvre.');
}

if (!reader.includes('demarrerLecteurEpubSiDisponible')) {
  errors.push('reader.js doit conserver le démarrage EPUB en parallèle du lecteur chapitres.');
}

if (!reader.includes('https://cdn.jsdelivr.net/npm/epubjs@0.3.93/dist/epub.min.js')) {
  errors.push('reader.js doit charger epub.js pour le lecteur EPUB web.');
}

const readerHtml = fs.readFileSync(path.join(root, 'pages/reader.html'), 'utf8');
if (!readerHtml.includes('id="reader-epub-viewport"')) {
  errors.push('reader.html doit garder le viewport EPUB.');
}

const scanRoots = ['assets', 'pages', 'index.html', 'offline.html', 'sw.js', 'manifest.json'];

function walk(target) {
  const full = path.join(root, target);
  if (!fs.existsSync(full)) return [];
  const stat = fs.statSync(full);
  if (stat.isFile()) return [full];
  const out = [];
  for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
    if (entry.name === 'fonts') continue;
    const child = path.join(full, entry.name);
    if (entry.isDirectory()) out.push(...walk(path.relative(root, child)));
    else out.push(child);
  }
  return out;
}

const textExt = new Set(['.css', '.html', '.js', '.json', '.svg', '.webmanifest']);
for (const file of scanRoots.flatMap(walk)) {
  if (!textExt.has(path.extname(file))) continue;
  const content = fs.readFileSync(file, 'utf8');
  if (/Roboto/i.test(content)) {
    errors.push(`Référence Roboto morte détectée : ${path.relative(root, file)}`);
  }
}

if (errors.length) {
  console.error(errors.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Régression lecteur/Roboto OK.');
