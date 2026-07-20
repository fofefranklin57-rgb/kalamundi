/* Contrôle du flux cadeau de bout en bout (D11 / P3 #13).
   Mock de fetch (Fapshi + Supabase) : vérifie qu'un achat cadeau ne donne
   aucun accès à l'acheteur, et que le webhook confirme le cadeau + crédite
   l'auteur, de façon idempotente. */

import { onRequestPost as pay } from '../functions/api/fapshi-pay.js';
import { onRequestPost as webhook } from '../functions/api/fapshi-webhook.js';

const USER = 'buyer-123';
const OEUVRE = 'oeuvre-abc';
const AUTEUR = 'auteur-xyz';
const TRANS = 'TX-GIFT-001';

const appels = [];
function mockFetch(canned) {
  return async (url, options = {}) => {
    const method = options.method || 'GET';
    appels.push({ method, url: String(url), body: options.body ? JSON.parse(options.body) : null });
    for (const rep of canned) {
      if (rep.method === method && String(url).includes(rep.match)) {
        return {
          ok: rep.ok !== false,
          status: rep.status ?? 200,
          json: async () => rep.json ?? {},
          text: async () => rep.text ?? (rep.json ? JSON.stringify(rep.json) : ''),
        };
      }
    }
    throw new Error(`Appel non mocké : ${method} ${url}`);
  };
}

const env = { SUPABASE_SERVICE_KEY: 'svc', SUPABASE_ANON_KEY: 'anon', FAPSHI_API_USER: 'u', FAPSHI_API_KEY: 'k' };
const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* 1. Achat cadeau — 10 EUR */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET',  match: '/auth/v1/user',   json: { id: USER } },
  { method: 'POST', match: '/initiate-pay',    json: { link: 'https://fapshi/pay/xyz', transId: TRANS } },
  { method: 'POST', match: '/rest/v1/cadeaux', status: 201, text: '' },
]);

const repPay = await pay({
  request: new Request('https://k.test/api/fapshi-pay', {
    method: 'POST',
    headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
    body: JSON.stringify({ cadeau: true, oeuvreId: OEUVRE, montant: 10, devise: 'EUR', userId: USER, message: 'Bonne lecture !' }),
  }),
  env,
});
const bodyPay = await repPay.json();

verifier(repPay.status === 200, `Achat cadeau doit répondre 200 (obtenu ${repPay.status}).`);
verifier(typeof bodyPay.code === 'string' && bodyPay.code.length >= 8, 'La réponse doit contenir un code cadeau.');
verifier(bodyPay.link === 'https://fapshi/pay/xyz', 'La réponse doit contenir le lien de paiement.');

const insertCadeau = appels.find(a => a.method === 'POST' && a.url.includes('/rest/v1/cadeaux'));
verifier(!!insertCadeau, 'Un cadeau doit être inséré.');
verifier(insertCadeau?.body?.statut === 'en_attente', 'Le cadeau doit être créé en_attente.');
verifier(insertCadeau?.body?.paiement_id === TRANS, 'Le cadeau doit référencer la transaction.');
verifier(insertCadeau?.body?.montant_xaf === 6560, `10 EUR doivent tracer 6560 XAF (obtenu ${insertCadeau?.body?.montant_xaf}).`);
verifier(insertCadeau?.body?.devise === 'EUR', 'La devise payée doit être conservée.');
verifier(!appels.some(a => a.url.includes('/rest/v1/acces_premium')), 'Un cadeau ne doit PAS donner d’accès à l’acheteur.');
verifier(!appels.some(a => a.url.includes('/rest/v1/paiements')), 'Un cadeau ne crée pas de ligne paiements.');

/* 2. Webhook confirme */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET',   match: '/rest/v1/paiements', json: [] },
  { method: 'GET',   match: '/rest/v1/cadeaux',   json: [{ id: 'cad-1', oeuvre_id: OEUVRE, montant_xaf: 6560, statut: 'en_attente' }] },
  { method: 'GET',   match: '/rest/v1/commandes_occasion', json: [] },
  { method: 'PATCH', match: '/rest/v1/cadeaux',   status: 204, text: '' },
  { method: 'GET',   match: '/rest/v1/oeuvres',   json: [{ auteur_id: AUTEUR }] },
  { method: 'POST',  match: '/rest/v1/revenus',   status: 201, text: '' },
]);

const repHook = await webhook({
  request: new Request('https://k.test/api/fapshi-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transId: TRANS, status: 'successful' }),
  }),
  env,
});
const bodyHook = await repHook.json();

verifier(repHook.status === 200 && bodyHook.cadeaux === 1, `Le webhook doit confirmer 1 cadeau (obtenu ${bodyHook.cadeaux}).`);
const patchCadeau = appels.find(a => a.method === 'PATCH' && a.url.includes('/rest/v1/cadeaux'));
verifier(patchCadeau?.body?.statut === 'paye', 'Le cadeau doit passer à paye.');
const revenu = appels.find(a => a.method === 'POST' && a.url.includes('/rest/v1/revenus'));
verifier(revenu?.body?.montant === 3280, `Part auteur = 50% de 6560 = 3280 (obtenu ${revenu?.body?.montant}).`);
verifier(revenu?.body?.type === 'vente_cadeau', 'Le revenu doit être marqué vente_cadeau.');
verifier(!appels.some(a => a.url.includes('/rest/v1/acces_premium')), 'Le webhook cadeau ne doit PAS donner d’accès (le bénéficiaire réclamera).');

/* 3. Idempotence */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET', match: '/rest/v1/paiements', json: [] },
  { method: 'GET', match: '/rest/v1/cadeaux',   json: [{ id: 'cad-1', oeuvre_id: OEUVRE, montant_xaf: 6560, statut: 'paye' }] },
  { method: 'GET', match: '/rest/v1/commandes_occasion', json: [] },
]);
const repHook2 = await webhook({
  request: new Request('https://k.test/api/fapshi-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transId: TRANS, status: 'successful' }),
  }),
  env,
});
verifier((await repHook2.json()).cadeaux === 0, 'Un cadeau déjà payé ne doit pas être retraité.');
verifier(!appels.some(a => a.method === 'POST' && a.url.includes('revenus')), 'Pas de double crédit auteur sur webhook répété.');

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Flux cadeau diaspora (achat + webhook + idempotence) OK.');
