/**
 * Cloudflare Pages Function — POST /api/payout-occasion
 * Verse les vendeurs d'occasion dont la commande est cloturee et le
 * versement encore en attente (payout_statut = 'a_verser').
 * Idempotent : ne retraite jamais une commande deja versee.
 *
 * Declenchee par le cron horaire kalamundi-cron ET appelable manuellement
 * (bouton admin) avec le meme secret partage que le webhook Fapshi.
 *
 * ⚠️ Le payout Fapshi est desactive par defaut en live tant que le support
 * Fapshi ne l'a pas active (cf. PLANIFICATION_KALAMUNDI.md, P4 #14). Cette
 * fonction est prete mais restera inerte (erreur Fapshi) jusque-la.
 *
 * Variables requises :
 *   SUPABASE_SERVICE_KEY, FAPSHI_API_USER, FAPSHI_API_KEY
 *   PAYOUT_TASK_SECRET — a envoyer dans x-kalamundi-secret
 */

import { envoyerPayout } from '../../scripts/lib/fapshi-payout.js';

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-kalamundi-secret, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SUPABASE_SERVICE_KEY) return json({ error: 'SUPABASE_SERVICE_KEY absent.' }, 500);
    if (env.PAYOUT_TASK_SECRET) {
      const secret = request.headers.get('x-kalamundi-secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
      if (secret !== env.PAYOUT_TASK_SECRET) return json({ error: 'Non autorise.' }, 401);
    }

    const commandes = await supabaseFetch(
      env,
      `${SUPABASE_URL}/rest/v1/commandes_occasion?payout_statut=eq.a_verser&statut=eq.clos&select=id,vendeur_id,montant_vendeur_xaf`
    ) || [];

    let verses = 0;
    const echecs = [];

    for (const cmd of commandes) {
      try {
        const vendeur = await supabaseFetch(
          env,
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(cmd.vendeur_id)}&select=nom,telephone&limit=1`
        ).then(rows => rows?.[0]);

        if (!vendeur?.telephone) {
          echecs.push({ commande: cmd.id, erreur: 'Numero Mobile Money du vendeur introuvable.' });
          continue;
        }

        const resultat = await envoyerPayout({
          amount: Math.round(Number(cmd.montant_vendeur_xaf)),
          phone: vendeur.telephone,
          medium: 'mobile money',
          name: vendeur.nom || undefined,
          externalId: cmd.id,
          message: 'Versement vente occasion Kalamundi',
        }, env);

        if (!resultat.ok) {
          echecs.push({ commande: cmd.id, erreur: resultat.erreur || 'Payout refuse par Fapshi.' });
          continue;
        }

        await supabaseFetch(env, `${SUPABASE_URL}/rest/v1/commandes_occasion?id=eq.${encodeURIComponent(cmd.id)}&payout_statut=eq.a_verser`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ payout_statut: 'verse' }),
        });
        verses++;
      } catch (err) {
        echecs.push({ commande: cmd.id, erreur: err.message || 'Erreur inconnue.' });
      }
    }

    return json({ traitees: commandes.length, verses, echecs });
  } catch (err) {
    return json({ error: err.message || 'Erreur orchestration payout.' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}

async function supabaseFetch(env, url, options = {}) {
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body,
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers });
}
