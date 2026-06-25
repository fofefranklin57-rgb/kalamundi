/* ============================================================
   functions/api/notify-publication.js
   Notification des lecteurs/auteurs quand une nouvelle oeuvre est publiee

   Env Cloudflare requis :
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_KEY
   - ONESIGNAL_APP_ID
   - ONESIGNAL_REST_API_KEY
   - RESEND_API_KEY
   - NOTIFICATION_FROM_EMAIL (ex: Kalamundi <notifications@kalamundi.com>)
   - KALAMUNDI_BASE_URL (ex: https://kalamundi.com)
   ============================================================ */

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';

const jsonHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

export async function onRequestPost({ request, env }) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const jwt = authHeader.replace('Bearer ', '').trim();
    if (!jwt) return json({ error: 'Non authentifie.' }, 401);

    const user = await getUser(jwt, env);
    if (!user?.id) return json({ error: 'Session invalide.' }, 401);

    const { oeuvreId } = await request.json();
    if (!oeuvreId) return json({ error: 'ID oeuvre manquant.' }, 400);

    const oeuvre = await getOeuvre(oeuvreId, env);
    if (!oeuvre) return json({ error: 'Oeuvre introuvable.' }, 404);
    if (oeuvre.auteur_id !== user.id) return json({ error: 'Non autorise.' }, 403);

    const baseUrl = (env.KALAMUNDI_BASE_URL || 'https://kalamundi.com').replace(/\/$/, '');
    const oeuvreUrl = `${baseUrl}/pages/work.html?id=${encodeURIComponent(oeuvre.id)}`;
    const auteur = oeuvre.profiles?.nom || user.email?.split('@')[0] || 'Un auteur Kalamundi';
    const titre = oeuvre.titre || 'Nouvelle oeuvre';
    const resume = limiter(oeuvre.resume || 'Une nouvelle oeuvre vient d etre publiee sur Kalamundi.', 180);

    const result = {
      onesignal: await envoyerOneSignal({ env, titre, auteur, resume, oeuvreUrl }),
      email: await envoyerEmails({ env, auteurId: user.id, titre, auteur, resume, oeuvreUrl }),
    };

    return json({ success: true, result });
  } catch (err) {
    return json({ error: err.message || 'Erreur notification.' }, 500);
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: jsonHeaders });
}

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: jsonHeaders });
}

async function getUser(jwt, env) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
    },
  });
  return res.ok ? res.json() : null;
}

async function getOeuvre(oeuvreId, env) {
  const url = `${SUPABASE_URL}/rest/v1/oeuvres?id=eq.${encodeURIComponent(oeuvreId)}&select=id,titre,resume,genre,statut,couverture_url,auteur_id,profiles!oeuvres_auteur_id_fkey(nom,email)`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Erreur Supabase oeuvre: ${await res.text()}`);
  const data = await res.json();
  return data?.[0] || null;
}

async function getDestinatairesEmail(env, auteurId) {
  const url = `${SUPABASE_URL}/rest/v1/profiles?id=neq.${encodeURIComponent(auteurId)}&email=not.is.null&select=email&limit=1000`;
  const res = await fetch(url, {
    headers: {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Erreur Supabase emails: ${await res.text()}`);
  const data = await res.json();
  return [...new Set((data || []).map(p => p.email).filter(Boolean))];
}

async function envoyerOneSignal({ env, titre, auteur, resume, oeuvreUrl }) {
  if (!env.ONESIGNAL_APP_ID || !env.ONESIGNAL_REST_API_KEY) {
    return { skipped: true, reason: 'ONESIGNAL_APP_ID ou ONESIGNAL_REST_API_KEY absent.' };
  }

  const res = await fetch('https://onesignal.com/api/v1/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: env.ONESIGNAL_APP_ID,
      included_segments: ['Subscribed Users'],
      headings: { fr: 'Nouvelle oeuvre sur Kalamundi', en: 'New work on Kalamundi' },
      contents: { fr: `${titre} par ${auteur}. ${resume}`, en: `${titre} by ${auteur}. ${resume}` },
      url: oeuvreUrl,
      data: { type: 'nouvelle_oeuvre', url: oeuvreUrl },
    }),
  });

  const body = await safeJson(res);
  return res.ok ? { sent: true, response: body } : { sent: false, status: res.status, response: body };
}

async function envoyerEmails({ env, auteurId, titre, auteur, resume, oeuvreUrl }) {
  if (!env.RESEND_API_KEY) return { skipped: true, reason: 'RESEND_API_KEY absent.' };

  const destinataires = await getDestinatairesEmail(env, auteurId);
  if (!destinataires.length) return { skipped: true, reason: 'Aucun destinataire email.' };

  const from = env.NOTIFICATION_FROM_EMAIL || 'Kalamundi <notifications@kalamundi.com>';
  const subject = `Nouvelle oeuvre sur Kalamundi : ${titre}`;
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#17211c">
      <h2 style="color:#1B4332">Nouvelle oeuvre publiee</h2>
      <p><strong>${escapeHtml(titre)}</strong> vient d etre publiee par ${escapeHtml(auteur)}.</p>
      <p>${escapeHtml(resume)}</p>
      <p><a href="${oeuvreUrl}" style="background:#1B4332;color:white;padding:10px 14px;border-radius:6px;text-decoration:none">Lire sur Kalamundi</a></p>
    </div>`;

  const lots = chunk(destinataires, 50);
  const responses = [];
  for (const lot of lots) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from, bcc: lot, subject, html }),
    });
    responses.push({ ok: res.ok, status: res.status, response: await safeJson(res), count: lot.length });
  }

  return {
    sent: responses.every(r => r.ok),
    total: destinataires.length,
    batches: responses,
  };
}

async function safeJson(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function limiter(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
