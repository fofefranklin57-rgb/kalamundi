/**
 * Cloudflare Pages Function — POST /api/fapshi-pay
 * Initie un paiement Fapshi et retourne le lien de paiement.
 *
 * Variables d'environnement requises (Cloudflare Pages → Settings → Variables) :
 *   FAPSHI_API_KEY  — clé API Fapshi (dashboard.fapshi.com → API Keys)
 *   FAPSHI_API_USER — email du compte Fapshi
 *
 * Optionnel (diaspora, D11) :
 *   TAUX_USD_XAF    — taux USD→XAF courant (le dollar flotte, à rafraîchir).
 *                     L'euro n'en a pas besoin : parité fixe 655,957.
 */

import { convertirVersXaf, tauxUsdDepuisEnv, DEVISE_BASE } from '../../scripts/lib/devises.mjs';
import { genererCodeCadeau } from '../../scripts/lib/cadeaux.mjs';

const FAPSHI_BASE = 'https://live.fapshi.com';
const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';

export async function onRequestPost({ request, env }) {
  /* CORS */
  const origin = request.headers.get('Origin') || '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin.includes('kalamundi') ? origin : 'https://kalamundi.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Corps JSON invalide' }), { status: 400, headers: corsHeaders });
  }

  let { montant, devise, description, userId, oeuvreId, plan, redirectUrl } = body;
  const campaignSlug = body.campaign || null;

  /* Vente suspendue (2026-07-20) : la fonctionnalité équipe/tableau de bord
     n'est pas construite (cf. ERROR_LOG.md). Le blocage frontend seul n'est
     pas suffisant — un appel direct à cet endpoint pourrait encaisser un
     abonnement qui ne livre rien, donc le vrai verrou est ici. */
  if (plan === 'abonnement_institution') {
    return new Response(JSON.stringify({ error: "L'abonnement Institution n'est pas encore en vente." }), { status: 403, headers: corsHeaders });
  }

  const estCadeau = body.cadeau === true;
  const commandeOccasionId = body.commandeOccasionId || null;
  const estOccasion = !!commandeOccasionId;
  const items = estCadeau ? [] : Array.isArray(body.items)
    ? body.items
        .filter(item => item?.oeuvreId && Number(item.prix || 0) > 0)
        .map(item => ({
          oeuvreId: item.oeuvreId,
          titre: item.titre || 'Livre Kalamundi',
          montant: parseInt(item.prix, 10),
        }))
    : [];
  const authHeader = request.headers.get('Authorization') || '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  const user = await getUser(jwt, env);
  if (!user?.id || user.id !== userId) {
    return new Response(JSON.stringify({ error: 'Session invalide.' }), { status: 401, headers: corsHeaders });
  }

  /* Campagne de vente : le prix vient du serveur, jamais de l'URL.
     Une pub sociale pointe vers payment.html avec un montant visible, mais
     l'acheteur peut modifier cette URL ; on relit donc la campagne active
     avec la clé service avant d'initier Fapshi. */
  if (campaignSlug && !estCadeau && !estOccasion && !items.length) {
    const campagne = await getCampagneActive(env, campaignSlug).catch(() => null);
    if (!campagne) {
      return new Response(JSON.stringify({ error: 'Campagne inactive ou introuvable.' }), { status: 404, headers: corsHeaders });
    }
    if (oeuvreId && campagne.oeuvre_id !== oeuvreId) {
      return new Response(JSON.stringify({ error: 'Campagne incohérente avec cette œuvre.' }), { status: 400, headers: corsHeaders });
    }
    oeuvreId = campagne.oeuvre_id;
    montant = Number(campagne.prix_campagne || campagne.oeuvres?.prix || 0);
    devise = campagne.devise || 'XAF';
    description = description || `Campagne Kalamundi — ${campagne.titre || campagne.oeuvres?.titre || 'Livre'}`;
    body.campagneId = campagne.id;
  }

  /* Montant en XAF (Fapshi encaisse en XAF).
     La conversion passe par scripts/lib/devises.mjs : une devise inconnue est
     refusée, jamais traitée comme des XAF (10 EUR ne doivent pas devenir
     10 FCFA), et le dollar n'utilise plus la parité fixe de l'euro. */
  /* Occasion : le montant N'EST PAS pris du client mais relu depuis la commande
     (on ne fait jamais confiance à un prix envoyé par le navigateur pour de
     l'argent entre inconnus). On vérifie aussi que l'acheteur est bien le sien. */
  let commandeOcc = null;
  let montantXAF;
  if (estOccasion) {
    commandeOcc = await getCommandeOccasion(env, commandeOccasionId).catch(() => null);
    if (!commandeOcc) {
      return new Response(JSON.stringify({ error: 'Commande introuvable.' }), { status: 404, headers: corsHeaders });
    }
    if (commandeOcc.acheteur_id !== userId) {
      return new Response(JSON.stringify({ error: 'Cette commande ne vous appartient pas.' }), { status: 403, headers: corsHeaders });
    }
    if (commandeOcc.statut !== 'en_attente_paiement') {
      return new Response(JSON.stringify({ error: 'Commande déjà payée ou clôturée.' }), { status: 409, headers: corsHeaders });
    }
    montantXAF = Number(commandeOcc.montant_xaf);
  } else {
    try {
      montantXAF = convertirVersXaf(montant, devise || DEVISE_BASE, { tauxUsdXaf: tauxUsdDepuisEnv(env) });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    }
  }

  if (!montantXAF || montantXAF < 100) {
    return new Response(JSON.stringify({ error: 'Montant invalide (min 100 XAF)' }), { status: 400, headers: corsHeaders });
  }
  if (estCadeau && !oeuvreId) {
    return new Response(JSON.stringify({ error: 'Cadeau : œuvre à offrir manquante.' }), { status: 400, headers: corsHeaders });
  }
  if (items.length) {
    const totalItems = items.reduce((sum, item) => sum + item.montant, 0);
    if (Math.abs(totalItems - montantXAF) > 1) {
      return new Response(JSON.stringify({ error: 'Total panier incohérent.' }), { status: 400, headers: corsHeaders });
    }
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
        message:     description || (items.length ? `Kalamundi — ${items.length} livre(s)` : 'Kalamundi'),
        redirect_url: redirectUrl || 'https://kalamundi.com/pages/payment.html?fapshi=success',
        userId:      userId,
        externalId:  estOccasion ? `occ-${commandeOccasionId}`
                   : estCadeau ? `gift-${userId}-${Date.now()}`
                   : items.length ? `cart-${userId}-${Date.now()}`
                   : campaignSlug ? `campaign-${campaignSlug}-${userId}-${Date.now()}`
                   : (oeuvreId || plan || userId),
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

  if (estOccasion) {
    /* On relie la commande au paiement (paiement_id = transId) ; le webhook
       la fera passer en « paye_sequestre » (l'argent est alors gelé). */
    await marquerPaiementCommandeOccasion(env, commandeOccasionId, data.transId).catch(() => {});
    return new Response(JSON.stringify({ link: data.link, transId: data.transId, commandeId: commandeOccasionId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  if (estCadeau) {
    /* Un cadeau ne donne PAS d'accès à l'acheteur : on crée une ligne cadeaux
       en attente, réclamable via un code. Le webhook la passera à « paye ». */
    const code = await enregistrerCadeau({
      env,
      offreurId: userId,
      oeuvreId,
      montant,
      devise: (devise || DEVISE_BASE).toUpperCase(),
      montantXaf: montantXAF,
      transId: data.transId,
      beneficiaireContact: body.beneficiaireContact,
      message: body.message,
    }).catch(() => null);

    if (!code) {
      return new Response(JSON.stringify({ error: 'Cadeau non enregistré.' }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ link: data.link, transId: data.transId, code }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  await enregistrerPaiement({
    env,
    userId,
    oeuvreId,
    plan,
    montant: montantXAF,
    transId: data.transId,
    items,
    campagneId: body.campagneId || null,
  }).catch(() => {});

  /* Fapshi retourne { link, transId } */
  return new Response(JSON.stringify({ link: data.link, transId: data.transId }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function getCampagneActive(env, slug) {
  if (!env.SUPABASE_SERVICE_KEY || !slug) return null;
  const now = new Date().toISOString();
  const url = `${SUPABASE_URL}/rest/v1/campagnes_vente?slug=eq.${encodeURIComponent(slug)}&statut=eq.active&date_debut=lte.${encodeURIComponent(now)}&or=(date_fin.is.null,date_fin.gte.${encodeURIComponent(now)})&select=id,oeuvre_id,titre,prix_campagne,devise,oeuvres(prix,titre)&limit=1`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function getCommandeOccasion(env, id) {
  if (!env.SUPABASE_SERVICE_KEY || !id) return null;
  const url = `${SUPABASE_URL}/rest/v1/commandes_occasion?id=eq.${encodeURIComponent(id)}&select=id,acheteur_id,statut,montant_xaf&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` },
  });
  if (!res.ok) return null;
  const rows = await res.json();
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function marquerPaiementCommandeOccasion(env, id, transId) {
  if (!env.SUPABASE_SERVICE_KEY || !id || !transId) return;
  await fetch(`${SUPABASE_URL}/rest/v1/commandes_occasion?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ paiement_id: transId }),
  });
}

async function enregistrerCadeau({ env, offreurId, oeuvreId, montant, devise, montantXaf, transId, beneficiaireContact, message }) {
  if (!env.SUPABASE_SERVICE_KEY || !offreurId || !oeuvreId || !transId) return null;

  /* Insertion avec code unique ; en cas de collision (rarissime), on régénère. */
  for (let tentative = 0; tentative < 3; tentative++) {
    const code = genererCodeCadeau();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/cadeaux`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        offreur_id: offreurId,
        oeuvre_id: oeuvreId,
        code,
        beneficiaire_contact: beneficiaireContact || null,
        message: message ? String(message).slice(0, 500) : null,
        montant: Number(montant) || 0,
        devise,
        montant_xaf: montantXaf,
        paiement_id: transId,
        statut: 'en_attente',
      }),
    });

    if (res.ok) return code;
    const texte = await res.text();
    if (!/duplicate|unique/i.test(texte)) throw new Error(texte); // vraie erreur : on ne réessaie pas
  }
  throw new Error('Impossible de générer un code cadeau unique.');
}

async function enregistrerPaiement({ env, userId, oeuvreId, plan, montant, transId, items = [], campagneId = null }) {
  if (!env.SUPABASE_SERVICE_KEY || !userId || !transId) return;
  const payload = items.length
    ? items.map(item => ({
        user_id: userId,
        oeuvre_id: item.oeuvreId,
        type: 'achat_oeuvre',
        montant: item.montant,
        devise: 'XAF',
        methode: 'fapshi',
        reference_transaction: transId,
        statut: 'en_attente',
      }))
    : {
        user_id: userId,
        oeuvre_id: oeuvreId || null,
        type: plan || 'achat_oeuvre',
        montant,
        devise: 'XAF',
        methode: 'fapshi',
        reference_transaction: transId,
        statut: 'en_attente',
        campagne_id: campagneId,
      };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/paiements`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok && campagneId) {
    const texte = await res.text();
    if (/campagne_id|Could not find|schema cache/i.test(texte)) {
      const payloadSansCampagne = Array.isArray(payload)
        ? payload.map(({ campagne_id, ...ligne }) => ligne)
        : (({ campagne_id, ...ligne }) => ligne)(payload);
      const retry = await fetch(`${SUPABASE_URL}/rest/v1/paiements`, {
        method: 'POST',
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(payloadSansCampagne),
      });
      if (!retry.ok) throw new Error(await retry.text());
      return;
    }
    throw new Error(texte);
  }
  if (!res.ok) throw new Error(await res.text());
}

async function getUser(jwt, env) {
  if (!jwt || !env.SUPABASE_ANON_KEY) return null;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  return res.ok ? res.json() : null;
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
