import { construireEpub } from './build_epub.mjs';
import { normaliserLivreDepuisTexte } from './lib/book-normalizer.mjs';

const manuscrit = `
Kalamundi Test

Chapitre 1

La première page pose le monde et installe la voix du récit.

Chapitre 2

La deuxième page vérifie que le découpage garde des identifiants stables.
`;

const livre = normaliserLivreDepuisTexte(manuscrit, {
  titre: 'Kalamundi Test',
  auteur: 'Codex',
  langue_originale: 'fr',
  format_source: 'txt',
});

const erreurs = [];

if (livre.chapitres.length !== 2) {
  erreurs.push(`Le normaliseur devait trouver 2 chapitres, trouvé : ${livre.chapitres.length}.`);
}

if (livre.chapitres.some(ch => !/^kalamundi-test-ch-\d{3}-[0-9a-f]{8}$/.test(ch.chapitre_id))) {
  erreurs.push('Chaque chapitre normalisé doit recevoir un chapitre_id stable et prévisible.');
}

const epub = construireEpub(livre);
if (!Buffer.isBuffer(epub) || epub.subarray(0, 2).toString('utf8') !== 'PK') {
  erreurs.push('Le générateur EPUB doit produire une archive ZIP EPUB.');
}

const brut = epub.toString('utf8');
for (const attendu of [
  'application/epub+zip',
  'META-INF/container.xml',
  'OEBPS/content.opf',
  'OEBPS/nav.xhtml',
  'data-kalamundi-chapitre-id=',
]) {
  if (!brut.includes(attendu)) erreurs.push(`EPUB incomplet : ${attendu} absent.`);
}

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Pipeline EPUB/chapitres OK.');
