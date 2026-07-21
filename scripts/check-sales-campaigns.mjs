import { readFileSync, existsSync } from 'node:fs';

const files = {
  migration: 'migrations/V017__campagnes_vente.sql',
  page: 'pages/campaign.html',
  js: 'assets/js/campaign.js',
  app: 'assets/js/app.js',
  api: 'assets/js/api.js',
  admin: 'assets/js/admin.js',
  sw: 'sw.js',
};

for (const [label, path] of Object.entries(files)) {
  if (!existsSync(path)) fail(`${label} manquant : ${path}`);
}

const migration = readFileSync(files.migration, 'utf8');
must(migration, 'CREATE TABLE IF NOT EXISTS campagnes_vente', 'table campagnes_vente absente');
must(migration, 'track_campagne_vente', 'RPC de tracking absente');
must(migration, "statut IN ('brouillon','programmee','active','terminee','suspendue')", 'statuts campagne non cadrés');

const page = readFileSync(files.page, 'utf8');
must(page, '/assets/js/campaign.js', 'landing campagne non branchée');

const js = readFileSync(files.js, 'utf8');
must(js, 'getCampagneVente', 'landing ne charge pas la campagne');
must(js, 'trackCampagneVente(slug, \'vue\')', 'tracking vue absent');
must(js, 'campaign-buy', 'bouton achat absent');
must(js, '/pages/payment.html?', 'paiement Fapshi non relié');

const fapshi = readFileSync('functions/api/fapshi-pay.js', 'utf8');
must(fapshi, 'getCampagneActive', 'prix campagne non relu côté serveur');
must(fapshi, 'Campagne incohérente avec cette œuvre', 'cohérence campagne/œuvre non vérifiée');
must(fapshi, 'campagne_id', 'paiement non attribué à la campagne');

const webhook = readFileSync('functions/api/fapshi-webhook.js', 'utf8');
must(webhook, 'confirmerConversionCampagne', 'conversion campagne non confirmée au webhook');
must(webhook, 'revenu_xaf', 'revenu campagne non incrémenté');

const app = readFileSync(files.app, 'utf8');
must(app, 'chargerCampagnes()', 'accueil ne charge pas les campagnes');
must(app, 'dedupliquerHistorique', 'historique de reprise non dédupliqué');
must(app, 'genererCouvertureOeuvre', 'fallback couverture moderne absent');

const api = readFileSync(files.api, 'utf8');
must(api, 'getCampagnesVenteActives', 'API campagnes actives absente');
must(api, 'adminCreerCampagneVente', 'API création admin absente');

const admin = readFileSync(files.admin, 'utf8');
must(admin, 'chargerCampagnesVente', 'admin campagnes absent');
must(admin, 'creerCampagneVente', 'création campagne admin absente');

const sw = readFileSync(files.sw, 'utf8');
must(sw, 'kala-v34', 'Service Worker non bumpé pour les campagnes');
must(sw, '/pages/campaign.html', 'landing campagne non précachée');

console.log('Campagnes de vente livre OK.');

function must(text, needle, message) {
  if (!text.includes(needle)) fail(message);
}

function fail(message) {
  console.error(`Erreur campagnes : ${message}`);
  process.exit(1);
}
