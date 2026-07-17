import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const html = fs.readFileSync(path.join(root, 'pages/publish.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets/js/publish.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'assets/js/api.js'), 'utf8');
const errors = [];

for (const id of [
  'sous-titre',
  'categorie-principale',
  'mots-cles',
  'isbn',
  'editeur',
  'territoires',
  'drm-protection',
  'recap-categories',
  'recap-mots-cles',
]) {
  if (!html.includes(`id="${id}"`)) errors.push(`Champ standard publication manquant dans publish.html : ${id}`);
}

for (const needle of [
  'collecterMetadonneesPublication',
  'lireMotsCles',
  'validerChecklistFinale',
  'verifierRatioCouverture',
  'couvertureOk',
  'qualitePublication < 85',
  'metadata_publication',
]) {
  if (!js.includes(needle)) errors.push(`Logique standard publication manquante dans publish.js : ${needle}`);
}

for (const needle of [
  'sous_titre',
  'isbn13',
  'mots_cles',
  'kalamundi_kdp_like_v1',
]) {
  if (!api.includes(needle)) errors.push(`Synchronisation Livre standard manquante dans api.js : ${needle}`);
}

if (errors.length) {
  console.error(errors.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Standards publication OK.');
