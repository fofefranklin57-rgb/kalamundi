/* Contrôle du client payout Fapshi (P4 #14) :
   construction/validation de la requête + envoi (fetch simulé).
   Aucun appel réseau réel : on vérifie le contrat, pas Fapshi. */

import {
  construirePayout,
  envoyerPayout,
  MEDIUMS_PAYOUT,
  MONTANT_MIN_PAYOUT,
} from './lib/fapshi-payout.js';

const erreurs = [];
const verifier = (c, m) => { if (!c) erreurs.push(m); };

/* Construction nominale (Mobile Money) */
const ok = construirePayout({ amount: 1700, phone: '6 70 00 00 00', medium: 'mobile money', name: 'Vendeur', externalId: 'cmd-123' });
verifier(ok.amount === 1700, `Le montant doit être conservé.`);
verifier(ok.phone === '670000000', `Le numéro doit être nettoyé de ses espaces.`);
verifier(ok.medium === 'mobile money', `Le medium doit être transmis.`);
verifier(ok.externalId === 'cmd-123', `L'externalId (id commande) doit être transmis pour la traçabilité.`);

/* Montant : entier, min 100 */
for (const mauvais of [0, 99, -100, 12.5, 'x', NaN]) {
  let leve = false;
  try { construirePayout({ amount: mauvais, phone: '670000000' }); } catch { leve = true; }
  verifier(leve, `Un montant invalide (${mauvais}) doit être refusé.`);
}
verifier(MONTANT_MIN_PAYOUT === 100, `Le minimum Fapshi documenté est 100 XAF.`);

/* Numéro Mobile Money camerounais requis hors compte Fapshi */
for (const mauvais of ['', '12345', '070000000', '6700000', '00237670000000']) {
  let leve = false;
  try { construirePayout({ amount: 500, phone: mauvais }); } catch { leve = true; }
  verifier(leve, `Un numéro invalide (${mauvais}) doit être refusé.`);
}

/* Virement compte-à-compte Fapshi : phone non requis */
let sansPhone = null;
try { sansPhone = construirePayout({ amount: 500, medium: 'fapshi' }); } catch (e) { erreurs.push(`Le payout Fapshi (compte) ne doit pas exiger de numéro : ${e.message}`); }
verifier(sansPhone && sansPhone.amount === 500, `Le medium fapshi doit être accepté sans téléphone.`);

/* Medium inconnu refusé */
let leveMedium = false;
try { construirePayout({ amount: 500, phone: '670000000', medium: 'bitcoin' }); } catch { leveMedium = true; }
verifier(leveMedium, `Un medium inconnu doit être refusé.`);
verifier(MEDIUMS_PAYOUT.length === 3, `Trois mediums de payout attendus (MTN, Orange, Fapshi).`);

/* envoyerPayout : clés absentes → refus net, sans appel réseau */
let reseauAppele = false;
const fetchTemoin = async () => { reseauAppele = true; return { ok: true, json: async () => ({}) }; };
const sansCles = await envoyerPayout({ amount: 500, phone: '670000000' }, {}, fetchTemoin);
verifier(!sansCles.ok && /Clés Fapshi/.test(sansCles.erreur), `Sans clés Fapshi, le payout doit être refusé.`);
verifier(!reseauAppele, `Sans clés, aucun appel réseau ne doit partir.`);

/* envoyerPayout : succès simulé — bon endpoint, bons en-têtes, bon corps */
let requete = null;
const fetchOk = async (url, opts) => {
  requete = { url, opts };
  return { ok: true, status: 200, json: async () => ({ transId: 'PX123', message: 'Payout initiated', dateInitiated: '2026-07-16' }) };
};
const env = { FAPSHI_API_USER: 'u', FAPSHI_API_KEY: 'k', FAPSHI_BASE: 'https://live.fapshi.com' };
const succes = await envoyerPayout({ amount: 1700, phone: '670000000', medium: 'mobile money', externalId: 'cmd-9' }, env, fetchOk);
verifier(succes.ok && succes.transId === 'PX123', `Un payout accepté doit renvoyer le transId.`);
verifier(requete?.url === 'https://live.fapshi.com/payout', `L'appel doit viser POST /payout.`);
verifier(requete?.opts?.headers?.apiuser === 'u' && requete?.opts?.headers?.apikey === 'k', `Les en-têtes apiuser/apikey doivent être posés.`);
verifier(JSON.parse(requete.opts.body).amount === 1700, `Le corps doit porter le montant.`);

/* envoyerPayout : refus Fapshi (ex. payout non activé en live) → erreur remontée */
const fetchRefus = async () => ({ ok: false, status: 403, json: async () => ({ message: 'payout not enabled' }) });
const refus = await envoyerPayout({ amount: 1700, phone: '670000000' }, env, fetchRefus);
verifier(!refus.ok && /payout not enabled/.test(refus.erreur), `Un refus Fapshi doit être remonté clairement (ex. payout non activé).`);

if (erreurs.length) {
  console.error(erreurs.map(e => `- ${e}`).join('\n'));
  process.exit(1);
}
console.log('Client payout Fapshi (construction + envoi) OK.');
