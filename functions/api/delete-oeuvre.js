/* ============================================================
   functions/api/delete-oeuvre.js
   Suppression sécurisée d'une œuvre (soft delete via service role)
   - Vérifie le JWT de l'utilisateur
   - Vérifie que l'utilisateur est bien l'auteur
   - Met visible=false avec la clé service role (bypass RLS)
   ============================================================ */

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';

export async function onRequestPost(context) {
  const { request, env } = context;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };

  try {
    // 1. Récupérer le JWT depuis le header Authorization
    const authHeader = request.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: 'Non authentifié.' }), { status: 401, headers: corsHeaders });
    }

    // 2. Vérifier le JWT et obtenir l'utilisateur
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'apikey': env.SUPABASE_ANON_KEY,
      },
    });
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: 'Session invalide.' }), { status: 401, headers: corsHeaders });
    }
    const userData = await userRes.json();
    const userId = userData?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Utilisateur introuvable.' }), { status: 401, headers: corsHeaders });
    }

    // 3. Récupérer l'ID de l'œuvre depuis le body
    const { oeuvreId } = await request.json();
    if (!oeuvreId) {
      return new Response(JSON.stringify({ error: 'ID œuvre manquant.' }), { status: 400, headers: corsHeaders });
    }

    // 4. Vérifier que l'utilisateur est bien l'auteur (avec anon key — lecture publique OK)
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/oeuvres?id=eq.${oeuvreId}&select=auteur_id`,
      {
        headers: {
          'apikey': env.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const checkData = await checkRes.json();
    if (!checkData?.length) {
      return new Response(JSON.stringify({ error: 'Œuvre introuvable.' }), { status: 404, headers: corsHeaders });
    }
    if (checkData[0].auteur_id !== userId) {
      return new Response(JSON.stringify({ error: 'Non autorisé.' }), { status: 403, headers: corsHeaders });
    }

    // 5. Soft delete avec la clé service role (bypass RLS garanti)
    const delRes = await fetch(
      `${SUPABASE_URL}/rest/v1/oeuvres?id=eq.${oeuvreId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': env.SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ visible: false }),
      }
    );

    if (!delRes.ok) {
      const errText = await delRes.text();
      return new Response(JSON.stringify({ error: `Erreur Supabase: ${errText}` }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
  }
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
