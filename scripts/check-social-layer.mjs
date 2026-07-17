import { readFileSync } from 'node:fs';

const fichiers = {
  'migrations/V010__etageres_sociales_stats.sql': readFileSync('migrations/V010__etageres_sociales_stats.sql', 'utf8'),
  'assets/js/api.js': readFileSync('assets/js/api.js', 'utf8'),
  'assets/js/work.js': readFileSync('assets/js/work.js', 'utf8'),
  'pages/work.html': readFileSync('pages/work.html', 'utf8'),
  'assets/css/library.css': readFileSync('assets/css/library.css', 'utf8'),
};

const controles = [
  ['migrations/V010__etageres_sociales_stats.sql', 'CREATE TABLE IF NOT EXISTS oeuvre_etageres'],
  ['migrations/V010__etageres_sociales_stats.sql', 'get_oeuvre_social_stats'],
  ['migrations/V010__etageres_sociales_stats.sql', 'auth.uid() = user_id'],
  ['assets/js/api.js', 'getStatsSocialesOeuvre'],
  ['assets/js/api.js', 'setEtagereOeuvre'],
  ['assets/js/api.js', 'retirerEtagereOeuvre'],
  ['assets/js/work.js', 'chargerCoucheSociale'],
  ['assets/js/work.js', 'brancherActionsSociales'],
  ['pages/work.html', 'work-social-panel'],
  ['assets/css/library.css', '.work-social'],
  ['assets/css/library.css', '.shelf-action'],
];

const manquants = controles.filter(([fichier, texte]) => !fichiers[fichier].includes(texte));
if (manquants.length) {
  console.error('Couche sociale incomplète :');
  for (const [fichier, texte] of manquants) {
    console.error(`- ${fichier} ne contient pas ${texte}`);
  }
  process.exit(1);
}

console.log('Couche sociale lecteur OK');
