/* Contrôle des restes de P4 #14 (arbitrage litige + orchestration payout +
   liste des annonces occasion) et P3 #12 (prix barré). */

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

// V015 — arbitrage litige
const v015 = path.join(root, 'migrations/V015__arbitrage_litige.sql');
if (!fs.existsSync(v015)) {
  erreurs.push('La migration V015__arbitrage_litige.sql doit exister.');
} else {
  const sql = fs.readFileSync(v015, 'utf8');
  verifier(/CREATE OR REPLACE FUNCTION resoudre_litige/i.test(sql), 'V015 doit exposer resoudre_litige.');
  verifier(/SECURITY DEFINER/i.test(sql), 'resoudre_litige doit être SECURITY DEFINER.');
  verifier(/role = 'admin'/i.test(sql), 'resoudre_litige doit vérifier le rôle admin.');
  verifier(/cmd_occasion_lecture_admin/i.test(sql), 'Une policy de lecture admin doit être ajoutée sur commandes_occasion.');
  verifier(/GRANT EXECUTE ON FUNCTION resoudre_litige\(UUID, TEXT\) TO authenticated/i.test(sql), 'resoudre_litige doit être réservée aux authentifiés (le contrôle admin est interne).');
}

// V016 — prix barré
const v016 = path.join(root, 'migrations/V016__promo_prix_barre.sql');
if (!fs.existsSync(v016)) {
  erreurs.push('La migration V016__promo_prix_barre.sql doit exister.');
} else {
  const sql = fs.readFileSync(v016, 'utf8');
  verifier(/ADD COLUMN IF NOT EXISTS prix_barre/i.test(sql), 'V016 doit ajouter livre_offres.prix_barre.');
}

// api.js
const apiPath = path.join(root, 'assets/js/api.js');
const api = fs.readFileSync(apiPath, 'utf8');
for (const methode of ['adminGetLitiges', 'adminResoudreLitige', 'adminGetPromotions', 'adminDefinirPromo', 'getToutesAnnoncesOccasion']) {
  verifier(api.includes(`async ${methode}(`), `api.js doit exposer ${methode}().`);
}
verifier(/prix_barre/.test(api), 'getOffresLivre doit sélectionner prix_barre.');

// admin.js / admin.html
const adminJs = fs.readFileSync(path.join(root, 'assets/js/admin.js'), 'utf8');
verifier(/window\.chargerLitiges/.test(adminJs), 'admin.js doit exposer chargerLitiges.');
verifier(/window\.resoudreLitige/.test(adminJs), 'admin.js doit exposer resoudreLitige.');
verifier(/window\.chargerPromotions/.test(adminJs), 'admin.js doit exposer chargerPromotions.');
verifier(/window\.sauvegarderPromo/.test(adminJs), 'admin.js doit exposer sauvegarderPromo.');

const adminHtml = fs.readFileSync(path.join(root, 'pages/admin.html'), 'utf8');
verifier(/section-litiges/.test(adminHtml), 'admin.html doit avoir la section Litiges.');
verifier(/section-promotions/.test(adminHtml), 'admin.html doit avoir la section Promotions.');

// Function serveur payout
const payoutFn = path.join(root, 'functions/api/payout-occasion.js');
if (!fs.existsSync(payoutFn)) {
  erreurs.push('functions/api/payout-occasion.js doit exister.');
} else {
  const src = fs.readFileSync(payoutFn, 'utf8');
  verifier(/onRequestPost/.test(src), 'payout-occasion.js doit exporter onRequestPost.');
  verifier(/envoyerPayout/.test(src), 'payout-occasion.js doit appeler envoyerPayout (scripts/lib/fapshi-payout.js).');
  verifier(/payout_statut=eq\.a_verser/.test(src), 'payout-occasion.js doit filtrer sur payout_statut=a_verser.');
  verifier(/payout_statut.*verse.*WHERE|payout_statut.*eq\.a_verser.*PATCH|eq\.a_verser`/.test(src) || /payout_statut=eq\.a_verser`,\s*\{\s*\n\s*method: 'PATCH'/.test(src) || /id=eq.*payout_statut=eq\.a_verser/.test(src),
    'La mise à jour vers "verse" doit être conditionnée à payout_statut=a_verser (idempotence).');
}

// Cron
const cronSrc = fs.readFileSync(path.join(root, 'kalamundi-cron/index.js'), 'utf8');
verifier(/payout-occasion/.test(cronSrc), 'Le cron horaire doit appeler /api/payout-occasion.');

// Page occasion
verifier(fs.existsSync(path.join(root, 'pages/occasion.html')), 'pages/occasion.html doit exister.');
verifier(fs.existsSync(path.join(root, 'assets/js/occasion-listing.js')), 'assets/js/occasion-listing.js doit exister.');

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Litiges, promo prix barré, payout occasion, liste occasion (P4 #14 reste + P3 #12) OK.');
