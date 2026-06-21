/**
 * Cloudflare Pages Function — POST /api/generate-questions
 * Génère des questions QCM via Claude (claude-haiku-4-5) quand la DB n'en a pas.
 *
 * Variables d'environnement requises (Cloudflare Pages → Settings → Variables) :
 *   ANTHROPIC_API_KEY — clé API Anthropic
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL         = 'claude-haiku-4-5-20251001';

export async function onRequestPost({ request, env }) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Corps JSON invalide' }, 400, corsHeaders); }

  const { matiere, examen, serie, nb = 10 } = body;
  if (!matiere || !examen) return json({ error: 'matiere et examen requis' }, 400, corsHeaders);

  const nbQ = Math.min(Math.max(parseInt(nb, 10) || 10, 5), 20);

  const prompt = `Tu es un professeur expert au Cameroun qui prépare des élèves aux examens officiels.

Génère exactement ${nbQ} questions QCM pour :
- Matière : ${matiere}
- Examen : ${examen}${serie ? ` (Série ${serie})` : ''}
- Niveau : lycée camerounais

Règles strictes :
1. Chaque question a exactement 4 choix (A, B, C, D)
2. Un seul choix correct
3. Questions variées en difficulté et thèmes
4. Formulation claire, sans ambiguïté
5. Réponse en JSON uniquement, aucun texte avant/après

Format JSON attendu (tableau de ${nbQ} objets) :
[
  {
    "enonce": "Texte de la question",
    "choix": ["Choix A", "Choix B", "Choix C", "Choix D"],
    "bonne_reponse": 0,
    "explication": "Courte explication de la bonne réponse",
    "theme": "Thème de la question",
    "difficulte": "facile|moyen|difficile"
  }
]`;

  let claudeRes;
  try {
    claudeRes = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
  } catch (e) {
    return json({ error: 'Claude inaccessible : ' + e.message }, 502, corsHeaders);
  }

  if (!claudeRes.ok) {
    const txt = await claudeRes.text();
    return json({ error: 'Erreur Claude : ' + txt }, 502, corsHeaders);
  }

  const claudeData = await claudeRes.json();
  const texte = claudeData.content?.[0]?.text || '';

  let questions;
  try {
    /* Extraire le JSON même si Claude ajoute du texte autour */
    const match = texte.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('Pas de JSON trouvé');
    questions = JSON.parse(match[0]);
  } catch (e) {
    return json({ error: 'Parsing JSON échoué : ' + e.message, raw: texte }, 500, corsHeaders);
  }

  /* Normaliser au format attendu par examen-sim.js */
  const normalized = questions.map((q, i) => ({
    id:            `ai_${Date.now()}_${i}`,
    matiere,
    examen,
    serie:         serie || null,
    theme:         q.theme || matiere,
    enonce:        q.enonce,
    choix:         q.choix,
    bonne_reponse: q.bonne_reponse,
    explication:   q.explication || '',
    difficulte:    q.difficulte || 'moyen',
    source:        'ia',
    visible:       true,
  }));

  return json({ questions: normalized }, 200, corsHeaders);
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

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
