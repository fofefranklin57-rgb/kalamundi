/**
 * Cloudflare Pages Function — POST /api/fapshi-webhook
 * Confirme un paiement Fapshi et active l'acces correspondant.
 *
 * Variables recommandees :
 *   SUPABASE_SERVICE_KEY
 *   FAPSHI_WEBHOOK_SECRET — optionnel, a envoyer dans x-kalamundi-secret
 */

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';
const SPLIT_AUTEUR_PREMIUM = 0.50;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-kalamundi-secret, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestPost({ request, env }) {
  try {
    if (!env.SUPABASE_SERVICE_KEY) return json({ error: 'SUPABASE_SERVICE_KEY absent.' }, 500);
    if (env.FAPSHI_WEBHOOK_SECRET) {
      const secret = request.headers.get('x-kalamundi-secret') || request.headers.get('Authorization')?.replace('Bearer ', '');
      if (secret !== env.FAPSHI_WEBHOOK_SECRET) return json({ error: 'Webhook non autorise.' }, 401);
    }

    const payload = await request.json().catch(() => ({}));
    const transId = payload.transId || payload.trans_id || payload.reference || payload.transaction_id;
    const status = String(payload.status || payload.statusCode || payload.state || '').toLowerCase();
    if (!transId) return json({ error: 'transId manquant.' }, 400);
    if (status && !['successful', 'success', 'succeeded', 'confirmed', 'completed', 'paid'].includes(status)) {
      return json({ ignored: true, reason: `Statut ignore: ${status}` });
    }

    const paiements = await getPaiements(env, transId);
    const cadeaux = await getCadeaux(env, transId);
    if (!paiements.length && !cadeaux.length) return json({ error: 'Paiement introuvable.' }, 404);

    for (const paiement of paiements) {
      if (paiement.statut !== 'confirme') {
        await updatePaiement(env, paiement.id, { statut: 'confirme', confirme_at: new Date().toISOString() });
      }
      if (paiement.oeuvre_id) {
        await activerAccesOeuvre(env, paiement);
      } else {
        await activerAbonnement(env, paiement);
      }
    }

    /* Cadeaux (diaspora) : on ne donne PAS l'accès à l'acheteur — on marque
       le cadeau « paye » (il deviendra réclamable) et on crédite l'auteur. */
    let cadeauxConfirmes = 0;
    for (const cadeau of cadeaux) {
      if (cadeau.statut !== 'en_attente') continue; // idempotent
      await updateCadeau(env, cadeau.id, { statut: 'paye' });
      await crediterAuteur(env, cadeau.oeuvre_id, Number(cadeau.montant_xaf) || 0, { type: 'vente_cadeau' });
      cadeauxConfirmes++;
    }

    return json({ success: true, count: paiements.length, cadeaux: cadeauxConfirmes });
  } catch (err) {
    return json({ error: err.message || 'Erreur webhook Fapshi.' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}

async function getPaiements(env, reference) {
  const url = `${SUPABASE_URL}/rest/v1/paiements?reference_transaction=eq.${encodeURIComponent(reference)}&select=*`;
  return await supabaseFetch(env, url) || [];
}

async function updatePaiement(env, id, champs) {
  await supabaseFetch(env, `${SUPABASE_URL}/rest/v1/paiements?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(champs),
  });
}

async function activerAccesOeuvre(env, paiement) {
  await supabaseFetch(env, `${SUPABASE_URL}/rest/v1/acces_premium`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: paiement.user_id,
      oeuvre_id: paiement.oeuvre_id,
      paiement_id: paiement.id,
    }),
  });

  await crediterAuteur(env, paiement.oeuvre_id, Number(paiement.montant) || 0, {
    type: 'vente_premium',
    paiementId: paiement.id,
    devise: paiement.devise || 'XAF',
  });
}

/* Crédite l'auteur de sa part (50 %) sur une vente — achat direct OU cadeau.
   L'auteur est payé dans les deux cas : ce qui change, c'est qui reçoit l'accès. */
async function crediterAuteur(env, oeuvreId, montantXaf, { type = 'vente_premium', paiementId = null, devise = 'XAF' } = {}) {
  if (!oeuvreId || !montantXaf) return;

  const oeuvre = await supabaseFetch(
    env,
    `${SUPABASE_URL}/rest/v1/oeuvres?id=eq.${encodeURIComponent(oeuvreId)}&select=auteur_id&limit=1`
  ).then(rows => rows?.[0]);
  if (!oeuvre?.auteur_id) return;

  const partAuteur = Math.round(montantXaf * SPLIT_AUTEUR_PREMIUM * 100) / 100;
  await supabaseFetch(env, `${SUPABASE_URL}/rest/v1/revenus`, {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      auteur_id: oeuvre.auteur_id,
      oeuvre_id: oeuvreId,
      paiement_id: paiementId,
      montant: partAuteur,
      devise,
      type,
      statut: 'en_attente',
    }),
  }).catch(() => {});
}

async function getCadeaux(env, reference) {
  const url = `${SUPABASE_URL}/rest/v1/cadeaux?paiement_id=eq.${encodeURIComponent(reference)}&select=*`;
  return await supabaseFetch(env, url) || [];
}

async function updateCadeau(env, id, champs) {
  await supabaseFetch(env, `${SUPABASE_URL}/rest/v1/cadeaux?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(champs),
  });
}

async function activerAbonnement(env, paiement) {
  const abonnement = {
    abonnement_reader: 'reader_plus',
    abonnement_auteur: 'auteur_pro',
    abonnement_institution: 'institution',
    abonnement_etudiant: 'etudiant',
  }[paiement.type];
  if (!abonnement) return;

  const expire = new Date();
  expire.setMonth(expire.getMonth() + 1);
  await supabaseFetch(env, `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(paiement.user_id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      abonnement,
      abonnement_expire_at: expire.toISOString(),
      updated_at: new Date().toISOString(),
    }),
  });
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
