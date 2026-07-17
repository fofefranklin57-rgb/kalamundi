import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const translate = fs.readFileSync(path.join(root, 'assets/js/translate.js'), 'utf8');
const reader = fs.readFileSync(path.join(root, 'assets/js/reader.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'assets/js/api.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'migrations/V009__traductions_chapitres_stables.sql'), 'utf8');
const errors = [];

if (!translate.includes('normaliserReferenceChapitre')) {
  errors.push('translate.js doit normaliser une référence de chapitre stable.');
}
if (!translate.includes('chapitre_id') || !translate.includes('source_hash')) {
  errors.push('translate.js doit utiliser chapitre_id/source_hash pour le cache.');
}
if (!reader.includes('obtenirTraduction(chapitre, contenu')) {
  errors.push('reader.js doit passer l’objet chapitre complet au traducteur.');
}
if (!api.includes('chapitre_ref') || !api.includes('langue_source')) {
  errors.push('api.js doit lire/écrire les traductions via chapitre_ref et langue_source.');
}
if (!migration.includes('idx_traductions_chapitre_ref_langue')) {
  errors.push('La migration V009 doit créer l’index unique chapitre_ref/langue.');
}

if (errors.length) {
  console.error(errors.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Traduction normalisée OK.');
