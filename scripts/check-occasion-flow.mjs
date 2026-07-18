/* Contrôle du flux de paiement d'occasion (P4 #14).
   Mock fetch (Fapshi + Supabase) : vérifie que le montant est relu côté
   serveur (pas depuis le client), que le webhook gèle l'argent
   (paye_sequestre) SANS payer le vendeur, et que c'est idempotent. */

import { onRequestPost as pay } from '../functions/api/fapshi-pay.js';
import { onRequestPost as webhook } from '../functions/api/fapshi-webhook.js';

const USER = 'buyer-1';
const AUTRE = 'someone-else';
const CMD = 'cmd-occ-1';
const TRANS = 'TX-OCC-1';

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

const payer = (body) => pay({
  request: new Request('https://k.test/api/fapshi-pay', {
    method: 'POST', headers: { Authorization: 'Bearer jwt', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }), env,
});

/* 1. Paiement d'une commande : le montant vient de la commande, pas du client */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET',   match: '/auth/v1/user', json: { id: USER } },
  { method: 'GET',   match: '/rest/v1/commandes_occasion', json: [{ id: CMD, acheteur_id: USER, statut: 'en_attente_paiement', montant_xaf: 2000 }] },
  { method: 'POST',  match: '/initiate-pay', json: { link: 'https://fapshi/pay/x', transId: TRANS } },
  { method: 'PATCH', match: '/rest/v1/commandes_occasion', status: 204, text: '' },
]);
const rep1 = await payer({ commandeOccasionId: CMD, userId: USER, montant: 5 }); // le client tente 5, doit être ignoré
const body1 = await rep1.json();
verifier(rep1.status === 200, `Paiement occasion doit répondre 200 (obtenu ${rep1.status}).`);
verifier(body1.commandeId === CMD, `La réponse doit référencer la commande.`);
const initiate = appels.find(a => a.method === 'POST' && a.url.includes('/initiate-pay'));
verifier(initiate?.body?.amount === 2000, `Le montant doit venir de la commande (2000), pas du client (5) — obtenu ${initiate?.body?.amount}.`);
verifier(initiate?.body?.externalId === `occ-${CMD}`, `L'externalId doit identifier la commande occasion.`);
const patch = appels.find(a => a.method === 'PATCH' && a.url.includes('/rest/v1/commandes_occasion'));
verifier(patch?.body?.paiement_id === TRANS, `La commande doit être reliée au paiement (paiement_id = transId).`);
verifier(!appels.some(a => a.url.includes('/payout')), `Aucun versement ne doit partir à l'initiation du paiement.`);

/* 2. Commande d'autrui : refusée */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET', match: '/auth/v1/user', json: { id: USER } },
  { method: 'GET', match: '/rest/v1/commandes_occasion', json: [{ id: CMD, acheteur_id: AUTRE, statut: 'en_attente_paiement', montant_xaf: 2000 }] },
]);
const rep2 = await payer({ commandeOccasionId: CMD, userId: USER });
verifier(rep2.status === 403, `Payer la commande d'autrui doit être refusé (403), obtenu ${rep2.status}.`);

/* 3. Commande déjà payée : refusée (pas de double paiement) */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET', match: '/auth/v1/user', json: { id: USER } },
  { method: 'GET', match: '/rest/v1/commandes_occasion', json: [{ id: CMD, acheteur_id: USER, statut: 'paye_sequestre', montant_xaf: 2000 }] },
]);
const rep3 = await payer({ commandeOccasionId: CMD, userId: USER });
verifier(rep3.status === 409, `Une commande déjà payée ne doit pas être repayée (409), obtenu ${rep3.status}.`);

/* 4. Webhook : gèle l'argent (paye_sequestre) SANS payer le vendeur */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET',   match: '/rest/v1/paiements', json: [] },
  { method: 'GET',   match: '/rest/v1/cadeaux', json: [] },
  { method: 'GET',   match: '/rest/v1/commandes_occasion', json: [{ id: CMD, statut: 'en_attente_paiement' }] },
  { method: 'PATCH', match: '/rest/v1/commandes_occasion', status: 204, text: '' },
]);
const repHook = await webhook({
  request: new Request('https://k.test/api/fapshi-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transId: TRANS, status: 'successful' }),
  }), env,
});
const bodyHook = await repHook.json();
verifier(repHook.status === 200 && bodyHook.occasion === 1, `Le webhook doit confirmer 1 commande occasion (obtenu ${bodyHook.occasion}).`);
const patchHook = appels.find(a => a.method === 'PATCH' && a.url.includes('/rest/v1/commandes_occasion'));
verifier(patchHook?.body?.statut === 'paye_sequestre', `La commande doit passer en paye_sequestre (l'argent est gelé).`);
verifier(!!patchHook?.body?.paye_at, `La date de paiement doit être posée.`);
verifier(!appels.some(a => a.url.includes('/payout')), `Le webhook ne doit PAS payer le vendeur (versement seulement à la réception).`);
verifier(!appels.some(a => a.url.includes('/rest/v1/revenus')), `Aucune écriture de revenu vendeur à ce stade.`);

/* 5. Idempotence : rejouer le webhook ne re-confirme pas */
appels.length = 0;
global.fetch = mockFetch([
  { method: 'GET',   match: '/rest/v1/paiements', json: [] },
  { method: 'GET',   match: '/rest/v1/cadeaux', json: [] },
  { method: 'GET',   match: '/rest/v1/commandes_occasion', json: [{ id: CMD, statut: 'paye_sequestre' }] },
]);
const repHook2 = await webhook({
  request: new Request('https://k.test/api/fapshi-webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transId: TRANS, status: 'successful' }),
  }), env,
});
const bodyHook2 = await repHook2.json();
verifier(bodyHook2.occasion === 0, `Rejouer le webhook ne doit rien reconfirmer (idempotent).`);
verifier(!appels.some(a => a.method === 'PATCH'), `Aucune écriture au second passage.`);

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Flux paiement occasion (séquestre + idempotence) OK.');
