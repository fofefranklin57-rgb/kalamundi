/* Contrôle multi-devises (D11 / P3 #13).
   Verrouille les deux bugs corrigés le 16/07 :
   - l'euro traité comme des XAF (10 EUR -> 10 FCFA)
   - le dollar converti avec la parité fixe de l'euro (655,957) */

import fs from 'node:fs';
import path from 'node:path';
import {
  convertirVersXaf,
  detaillerConversion,
  estDeviseSupportee,
  formaterMontant,
  tauxUsdDepuisEnv,
  tauxVersXaf,
  EUR_XAF,
  USD_XAF_DEFAUT,
  DEVISES_SUPPORTEES,
} from './lib/devises.mjs';

const root = process.cwd();
const erreurs = [];
const verifier = (condition, message) => { if (!condition) erreurs.push(message); };

/* --- Parité fixe de l'euro (légale, invariable) --- */
verifier(EUR_XAF === 655.957, 'La parité EUR→XAF doit rester exactement 655,957.');
verifier(convertirVersXaf(10, 'EUR') === 6560, `10 EUR doivent valoir 6560 XAF, obtenu ${convertirVersXaf(10, 'EUR')}.`);
verifier(convertirVersXaf(1, 'EUR') === 656, `1 EUR doit valoir 656 XAF, obtenu ${convertirVersXaf(1, 'EUR')}.`);

/* --- Régression : l'euro ne doit JAMAIS être traité comme des XAF --- */
verifier(convertirVersXaf(10, 'EUR') !== 10, 'Régression : 10 EUR ne doivent pas devenir 10 XAF.');

/* --- Le dollar flotte : il ne doit pas utiliser la parité de l'euro --- */
verifier(tauxVersXaf('USD') !== EUR_XAF, 'Régression : le dollar ne doit pas utiliser la parité fixe de l’euro (655,957).');
verifier(tauxVersXaf('USD') === USD_XAF_DEFAUT, 'Sans config, le taux USD doit être le repli documenté.');
verifier(
  convertirVersXaf(10, 'USD', { tauxUsdXaf: 610 }) === 6100,
  `10 USD à 610 doivent valoir 6100 XAF, obtenu ${convertirVersXaf(10, 'USD', { tauxUsdXaf: 610 })}.`
);

/* --- Un taux USD aberrant doit être refusé (garde-fou anti-655,957) --- */
for (const taux of [655.957, 0, -5, 1200, 'abc', NaN]) {
  let leve = false;
  try { tauxVersXaf('USD', { tauxUsdXaf: taux }); } catch { leve = true; }
  verifier(leve, `Un taux USD aberrant (${taux}) doit être refusé.`);
}

/* --- XAF : identité, sans décimales --- */
verifier(convertirVersXaf(1500, 'XAF') === 1500, 'Le XAF doit rester inchangé.');
verifier(tauxVersXaf('XAF') === 1, 'Le taux XAF→XAF doit valoir 1.');

/* --- Devise inconnue : REFUSÉE, jamais traitée comme des XAF --- */
for (const devise of ['GBP', 'NGN', 'BTC', '', 'xyz']) {
  let leve = false;
  try { convertirVersXaf(10, devise); } catch { leve = true; }
  verifier(leve, `La devise « ${devise} » doit être refusée, pas traitée comme des XAF.`);
}
verifier(!estDeviseSupportee('GBP'), 'GBP ne doit pas être déclarée supportée.');
verifier(['XAF', 'EUR', 'USD'].every(estDeviseSupportee), 'XAF, EUR et USD doivent être supportées.');
verifier(DEVISES_SUPPORTEES.length === 3, 'Trois devises attendues pour la diaspora.');

/* --- Casse et espaces --- */
verifier(convertirVersXaf(10, ' eur ') === 6560, 'La devise doit être normalisée (casse/espaces).');

/* --- Montants invalides --- */
for (const montant of [-1, 'abc', NaN, Infinity]) {
  let leve = false;
  try { convertirVersXaf(montant, 'EUR'); } catch { leve = true; }
  verifier(leve, `Un montant invalide (${montant}) doit être refusé.`);
}

/* --- Lecture de l'environnement --- */
verifier(tauxUsdDepuisEnv({}) === USD_XAF_DEFAUT, 'Sans TAUX_USD_XAF, le repli documenté s’applique.');
verifier(tauxUsdDepuisEnv({ TAUX_USD_XAF: '615' }) === 615, 'TAUX_USD_XAF doit être lu depuis l’environnement.');

/* --- Formatage --- */
verifier(/FCFA$/.test(formaterMontant(1500, 'XAF')), 'Le XAF doit s’afficher suffixé « FCFA ».');
verifier(!formaterMontant(1500, 'XAF').includes(','), 'Le XAF ne doit pas afficher de décimales.');
verifier(formaterMontant(10, 'EUR').startsWith('€'), 'L’euro doit s’afficher préfixé « € ».');
verifier(formaterMontant(10, 'USD').startsWith('$'), 'Le dollar doit s’afficher préfixé « $ ».');

/* --- Transparence acheteur --- */
const detail = detaillerConversion(10, 'EUR');
verifier(detail.montant_xaf === 6560 && detail.taux_fixe === true, 'Le détail EUR doit exposer 6560 XAF et un taux fixe.');
verifier(detaillerConversion(10, 'USD', { tauxUsdXaf: 610 }).taux_fixe === false, 'Le détail USD doit indiquer un taux non fixe.');

/* --- Le paiement doit utiliser le module, plus de conversion en dur --- */
const pay = fs.readFileSync(path.join(root, 'functions/api/fapshi-pay.js'), 'utf8');
verifier(pay.includes('convertirVersXaf'), 'fapshi-pay.js doit convertir via scripts/lib/devises.mjs.');
verifier(!/655\.957/.test(pay), 'fapshi-pay.js ne doit plus contenir de conversion en dur (655.957).');
verifier(pay.includes('tauxUsdDepuisEnv'), 'fapshi-pay.js doit lire le taux USD depuis l’environnement.');

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}

console.log('Multi-devises diaspora (XAF/EUR/USD) OK.');
