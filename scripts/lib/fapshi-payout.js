/* ============================================================
   fapshi-payout.js — Reversement (payout) vers le Mobile Money d'un vendeur
   Kalamundi — La Plume du Monde  (P4 #14)

   Fapshi expose POST /payout (disbursement). Ce module construit et valide
   la requête selon le contrat documenté (docs.fapshi.com/en/api-reference/
   endpoint/payout), et l'envoie. La construction est pure et testable ; seul
   envoyerPayout() touche le réseau.

   ⚠️ Le payout est DÉSACTIVÉ par défaut en live chez Fapshi : il faut demander
   son activation au support. Sans activation, l'appel renverra une erreur —
   ce module est donc « prêt mais inerte » jusque-là.

   Règle de sécurité : ne JAMAIS appeler ceci depuis le client. Réservé au
   serveur (Function déclenchée par un admin / une tâche), avec les clés Fapshi.
   ============================================================ */

export const MEDIUMS_PAYOUT = Object.freeze(['mobile money', 'orange money', 'fapshi']);
export const MONTANT_MIN_PAYOUT = 100; // XAF, contrainte Fapshi

/* Construit (et valide) le corps de la requête /payout.
   Lève si les données sont incohérentes : on préfère refuser que reverser
   un montant faux ou vers un numéro absent. */
export function construirePayout({ amount, phone, medium, name, userId, externalId, message } = {}) {
  const montant = Number(amount);
  if (!Number.isInteger(montant) || montant < MONTANT_MIN_PAYOUT) {
    throw new Error(`Montant de payout invalide : « ${amount} » (entier, min ${MONTANT_MIN_PAYOUT} XAF).`);
  }

  if (medium !== undefined && !MEDIUMS_PAYOUT.includes(medium)) {
    throw new Error(`Medium de payout invalide : « ${medium} ». Attendu : ${MEDIUMS_PAYOUT.join(', ')}.`);
  }

  const versCompteFapshi = medium === 'fapshi';

  /* phone requis sauf virement compte-à-compte Fapshi (qui utilise email). */
  if (!versCompteFapshi) {
    const numero = String(phone || '').replace(/\s+/g, '');
    if (!/^6\d{8}$/.test(numero)) {
      throw new Error(`Numéro Mobile Money invalide : « ${phone} » (9 chiffres camerounais commençant par 6).`);
    }
  }

  const corps = { amount: montant };
  if (phone) corps.phone = String(phone).replace(/\s+/g, '');
  if (medium) corps.medium = medium;
  if (name) corps.name = String(name).slice(0, 100);
  if (userId) corps.userId = String(userId).slice(0, 100);
  if (externalId) corps.externalId = String(externalId).slice(0, 100);
  if (message) corps.message = String(message).slice(0, 200);
  return corps;
}

/* Envoie le payout. `fetchImpl` injectable pour les tests.
   Retourne { ok, transId, message, statusHttp, erreur }. */
export async function envoyerPayout(params, env = {}, fetchImpl = fetch) {
  const base = env.FAPSHI_BASE || 'https://live.fapshi.com';
  const apiuser = env.FAPSHI_API_USER;
  const apikey = env.FAPSHI_API_KEY;
  if (!apiuser || !apikey) {
    return { ok: false, erreur: 'Clés Fapshi absentes (FAPSHI_API_USER / FAPSHI_API_KEY).' };
  }

  let corps;
  try {
    corps = construirePayout(params);
  } catch (error) {
    return { ok: false, erreur: error.message };
  }

  let reponse;
  try {
    reponse = await fetchImpl(`${base}/payout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apiuser, apikey },
      body: JSON.stringify(corps),
    });
  } catch (error) {
    return { ok: false, erreur: `Réseau Fapshi : ${error.message}` };
  }

  let data = {};
  try { data = await reponse.json(); } catch { /* réponse non-JSON */ }

  if (!reponse.ok) {
    return {
      ok: false,
      statusHttp: reponse.status,
      erreur: data?.message || `Fapshi a refusé le payout (HTTP ${reponse.status}).`,
    };
  }

  return { ok: true, transId: data.transId || null, message: data.message || null, dateInitiated: data.dateInitiated || null };
}
