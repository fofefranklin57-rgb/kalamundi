import { readFileSync } from 'node:fs';

const fichiers = {
  'offline.html': readFileSync('offline.html', 'utf8'),
  'assets/js/offline-page.js': readFileSync('assets/js/offline-page.js', 'utf8'),
  'assets/js/api.js': readFileSync('assets/js/api.js', 'utf8'),
};

const controles = [
  ['offline.html', 'purchased-books'],
  ['offline.html', 'Mes achats'],
  ['assets/js/api.js', 'getAchatsUtilisateur'],
  ['assets/js/offline-page.js', 'rendreAchats'],
  ['assets/js/offline-page.js', 'carteLivreAchete'],
  ['assets/js/offline-page.js', 'Achat Fapshi'],
];

const manquants = controles.filter(([fichier, texte]) => !fichiers[fichier].includes(texte));
if (manquants.length) {
  console.error('Historique achats incomplet :');
  for (const [fichier, texte] of manquants) {
    console.error(`- ${fichier} ne contient pas ${texte}`);
  }
  process.exit(1);
}

console.log('Historique achats OK');
