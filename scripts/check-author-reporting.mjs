import { readFileSync } from 'node:fs';

const fichiers = {
  'pages/author-dashboard.html': readFileSync('pages/author-dashboard.html', 'utf8'),
  'assets/js/author-dashboard.js': readFileSync('assets/js/author-dashboard.js', 'utf8'),
  'assets/js/api.js': readFileSync('assets/js/api.js', 'utf8'),
  'assets/css/dashboard.css': readFileSync('assets/css/dashboard.css', 'utf8'),
};

const controles = [
  ['pages/author-dashboard.html', 'author-kdp'],
  ['pages/author-dashboard.html', 'kdp-ventes'],
  ['pages/author-dashboard.html', 'kdp-pages'],
  ['pages/author-dashboard.html', 'kdp-payout'],
  ['assets/js/api.js', 'getReportingAuteur'],
  ['assets/js/author-dashboard.js', 'rendreReportingKdp'],
  ['assets/js/author-dashboard.js', "formatMontant(stats.revenus.total, 'XAF')"],
  ['assets/css/dashboard.css', '.author-kdp'],
  ['assets/css/dashboard.css', '.author-kdp-card'],
];

const manquants = controles.filter(([fichier, texte]) => !fichiers[fichier].includes(texte));
if (manquants.length) {
  console.error('Reporting auteur incomplet :');
  for (const [fichier, texte] of manquants) {
    console.error(`- ${fichier} ne contient pas ${texte}`);
  }
  process.exit(1);
}

console.log('Reporting auteur KDP OK');
