import { readFileSync } from 'node:fs';

const fichiers = {
  'index.html': readFileSync('index.html', 'utf8'),
  'pages/work.html': readFileSync('pages/work.html', 'utf8'),
  'assets/js/app.js': readFileSync('assets/js/app.js', 'utf8'),
  'assets/js/work.js': readFileSync('assets/js/work.js', 'utf8'),
  'assets/js/api.js': readFileSync('assets/js/api.js', 'utf8'),
  'assets/css/home.css': readFileSync('assets/css/home.css', 'utf8'),
  'assets/css/library.css': readFileSync('assets/css/library.css', 'utf8'),
};

const controles = [
  ['index.html', 'section-rails-commerce'],
  ['index.html', 'home-commerce-rails'],
  ['pages/work.html', 'work-offers-panel'],
  ['assets/js/api.js', 'getOffresLivre'],
  ['assets/js/api.js', 'getRailsMarchands'],
  ['assets/js/app.js', 'chargerRailsCommerce'],
  ['assets/js/work.js', 'renderOffresLivre'],
  ['assets/js/work.js', 'Payer avec Fapshi'],
  ['assets/css/home.css', '.commerce-rail'],
  ['assets/css/library.css', '.work-offers'],
  ['assets/css/library.css', '.offer-card'],
];

const manquants = controles.filter(([fichier, texte]) => !fichiers[fichier].includes(texte));
if (manquants.length) {
  console.error('Commerce rails incomplets :');
  for (const [fichier, texte] of manquants) {
    console.error(`- ${fichier} ne contient pas ${texte}`);
  }
  process.exit(1);
}

console.log('Rails commerce et fiche livre unifiée OK');
