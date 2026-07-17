import { readFileSync } from 'node:fs';

const fichiers = {
  'assets/js/cart.js': readFileSync('assets/js/cart.js', 'utf8'),
  'assets/js/work.js': readFileSync('assets/js/work.js', 'utf8'),
  'assets/js/payment.js': readFileSync('assets/js/payment.js', 'utf8'),
  'functions/api/fapshi-pay.js': readFileSync('functions/api/fapshi-pay.js', 'utf8'),
  'functions/api/fapshi-webhook.js': readFileSync('functions/api/fapshi-webhook.js', 'utf8'),
};

const controles = [
  ['assets/js/cart.js', 'addToCart'],
  ['assets/js/cart.js', 'cartTotal'],
  ['assets/js/work.js', 'js-cart'],
  ['assets/js/payment.js', 'PARAMS.cart'],
  ['assets/js/payment.js', 'chargerPanier'],
  ['assets/js/payment.js', 'items:'],
  ['functions/api/fapshi-pay.js', 'items.length'],
  ['functions/api/fapshi-pay.js', 'Total panier incohérent'],
  ['functions/api/fapshi-webhook.js', 'getPaiements'],
  ['functions/api/fapshi-webhook.js', 'for (const paiement of paiements)'],
];

const manquants = controles.filter(([fichier, texte]) => !fichiers[fichier].includes(texte));
if (manquants.length) {
  console.error('Checkout panier incomplet :');
  for (const [fichier, texte] of manquants) {
    console.error(`- ${fichier} ne contient pas ${texte}`);
  }
  process.exit(1);
}

console.log('Panier et checkout Fapshi OK');
