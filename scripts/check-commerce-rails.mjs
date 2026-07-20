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

/* Accueil réorganisé le 20/07 : un seul rail « À découvrir — nos auteurs »
   (au lieu de 4 rails mélangeant auteurs et domaine public), patrimoine
   séparé et discret, occasion avec vrai état vide, plus de doublons
   (Œuvres du moment / Nouveautés / Nouveaux talents fusionnés). */
const controles = [
  ['index.html', 'grid-auteurs'],
  ['index.html', 'section-occasion'],
  ['index.html', 'section-patrimoine'],
  ['index.html', 'home-occasion'],
  ['index.html', 'grid-patrimoine'],
  ['assets/js/app.js', 'chargerAuteurs'],
  ['assets/js/app.js', 'chargerOccasion'],
  ['assets/js/app.js', 'chargerPatrimoine'],
  ['assets/js/app.js', 'exclureSysteme: true'], // n'affiche QUE les vrais auteurs
  ['assets/js/app.js', 'Aucune annonce pour l\'instant'], // vrai état vide occasion
  ['assets/js/app.js', 'estOeuvreImportee'], // patrimoine correctement distingué
  ['pages/work.html', 'work-offers-panel'],
  ['assets/js/api.js', 'getOffresLivre'],
  ['assets/js/work.js', 'renderOffresLivre'],
  ['assets/js/work.js', 'Payer avec Fapshi'],
  ['assets/css/library.css', '.work-offers'],
  ['assets/css/library.css', '.offer-card'],
];

const manquants = controles.filter(([fichier, texte]) => !fichiers[fichier].includes(texte));
if (manquants.length) {
  console.error('Accueil réorganisé / fiche livre unifiée incomplets :');
  for (const [fichier, texte] of manquants) {
    console.error(`- ${fichier} ne contient pas ${texte}`);
  }
  process.exit(1);
}

/* Régression : les sections fusionnées/supprimées ne doivent pas revenir
   discrètement (ex. un rail patrimoine mélangé au rail auteurs). */
const interdits = [
  ['index.html', 'grid-vedettes'],
  ['index.html', 'grid-nouveautes'],
  ['index.html', 'grid-premiers-pas'],
  ['index.html', 'home-commerce-rails'],
  ['assets/js/app.js', 'chargerVedettes'],
  ['assets/js/app.js', 'chargerRailsCommerce'],
  ['assets/js/api.js', 'getRailsMarchands'],
];
const revenus = interdits.filter(([fichier, texte]) => fichiers[fichier].includes(texte));
if (revenus.length) {
  console.error('Régression : code supprimé le 20/07 est revenu :');
  for (const [fichier, texte] of revenus) {
    console.error(`- ${fichier} contient à nouveau ${texte}`);
  }
  process.exit(1);
}

console.log('Accueil réorganisé (auteurs/patrimoine/occasion séparés) et fiche livre unifiée OK');
