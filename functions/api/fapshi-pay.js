/**
 * Cloudflare Pages Function — POST /api/fapshi-pay
 * Initie un paiement Fapshi et retourne le lien de paiement.
 *
 * Variables d'environnement requises (Cloudflare Pages → Settings → Variables) :
 *   FAPSHI_API_KEY  — clé API Fapshi (dashboard.fapshi.com → API Keys)
 *   FAPSHI_API_USER — email du compte Fapshi
 */

const FAPSHI_BASE = 'https://live.fapshi.com';

export async function onRequestPost({ request, env }) {
  /* CORS */
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin.includes('kalamundi') ? origin : 'https://kalamundi.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), { status: 400, headers: corsHeaders });
  }

  const { montant, devise, description, userId, oeuvreId, plan, redirectUrl } = body;

  /* Montant en XAF (Fapshi travaille en XAF) */
  let montantXAF = parseInt(montant, 10);
  if (devise === 'USD') montantXAF = Math.round(parseFloat(montant) * 655.957);

  if (!montantXAF || montantXAF < 100) {
    return new Response(JSON.stringify({ error: 'Montant invalide (min 100 XAF)' }), { status: 400, headers: corsHeaders });
  }

  /* Appel API Fapshi — initier paiement */
  let fapshiRes;
  try {
    fapshiRes = await fetch(`${FAPSHI_BASE}/initiate-pay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apiuser': env.FAPSHI_API_USER,
        'apikey':  env.FAPSHI_API_KEY,
      },
      body: JSON.stringify({
        amount:      montantXAF,
        message:     description || 'Kalamundi',
        redirect_url: redirectUrl || 'https://kalamundi.com/pages/payment.html?fapshi=success',
        userId:      userId,
        externalId:  oeuvreId || plan || userId,
      }),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Fapshi inaccessible : ' + e.message }), { status: 502, headers: corsHeaders });
  }

  if (!fapshiRes.ok) {
    const txt = await fapshiRes.text();
    return new Response(JSON.stringify({ error: 'Fapshi erreur : ' + txt }), { status: 502, headers: corsHeaders });
  }

  const data = await fapshiRes.json();

  /* Fapshi retourne { link, transId } */
  return new Response(JSON.stringify({ link: data.link, transId: data.transId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
