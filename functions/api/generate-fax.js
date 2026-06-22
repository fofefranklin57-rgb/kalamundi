/**
 * POST /api/generate-fax
 * Génère un corrigé (fax) complet via Claude claude-haiku-4-5
 * Body: { matiere, annee, type_epreuve, semestre, filiere, categorie, description }
 */
export async function onRequestPost({ request, env }) {
  const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY manquante' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'Body JSON invalide' }), { status: 400 }); }

  const { matiere, annee, type_epreuve, semestre, filiere, categorie, description } = body;
  if (!matiere) {
    return new Response(JSON.stringify({ error: 'matiere requise' }), { status: 400 });
  }

  const typeLabel = {
    cc: 'Controle Continu (CC)', session_normale: 'Session Normale',
    rattrapage: 'Rattrapage', concours: 'Concours', partiel: 'Partiel',
    td: 'Travaux Diriges (TD)', tp: 'Travaux Pratiques (TP)',
  }[type_epreuve] || type_epreuve || 'Examen';

  const catLabel = {
    droit_sciences_juridiques: 'Droit / Sciences Juridiques',
    medecine_sante: 'Medecine / Sante',
    sciences_exactes: 'Sciences Exactes (Maths, Physique, Chimie)',
    economie_gestion: 'Economie / Gestion',
    informatique_tech: 'Informatique / Technologie',
    lettres_langues: 'Lettres / Langues',
    sciences_humaines: 'Sciences Humaines (Sociologie, Psychologie, Histoire-Geo)',
    sciences_education: 'Sciences de l\'Education / ENS / ENSET',
    agronomie: 'Agronomie / Sciences Agricoles',
    concours_grandes_ecoles: 'Grandes Ecoles (ENAM, EMIA, ESSEC, IRIC)',
    concours_fonctions_publiques: 'Fonctions Publiques (Police, Gendarmerie, FP, Magistrature)',
  }[categorie] || filiere || 'Universite';

  const systemPrompt = `Tu es un enseignant expert et correcteur universitaire camerounais.
Tu fournis des corriges detailles, pedagogiques et rigoureux.
Tes reponses sont en francais (ou anglais si la matiere l'exige).
Structure toujours ton corrige clairement : Introduction / Corps (parties numerotees) / Conclusion.
Pour les calculs, montre toutes les etapes. Pour le droit, cite les textes applicables.
Pour les sciences, justifie chaque raisonnement. Sois precis et academique.`;

  const userPrompt = `Redige un corrige complet et detaille pour l'epreuve suivante :

Matiere : ${matiere}
Filiere : ${filiere || catLabel}
Domaine : ${catLabel}
Type d'epreuve : ${typeLabel}
Annee academique : ${annee || 'non precise'}
Semestre : ${semestre || 'non precise'}
${description ? `Informations complementaires : ${description}` : ''}

Instructions :
- Redige un corrige complet comme si tu avais l'epreuve devant toi
- Si tu n'as pas le sujet exact, propose un corrige-type representatif pour cette matiere/filiere
- Structure ton corrige avec des parties claires et numerotees
- Inclus l'introduction, le developpement, la conclusion
- Pour les exercices de calcul : toutes les etapes
- Pour le droit : les articles et textes applicables au contexte camerounais/OHADA si pertinent
- Longueur : au moins 600 mots, ideal 1000-1500 mots
- Commence directement par le corrige, pas de preambule`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        system:     systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      return new Response(JSON.stringify({ error: 'Anthropic API : ' + err }), { status: 502 });
    }

    const data    = await resp.json();
    const contenu = data.content?.[0]?.text || '';

    return new Response(JSON.stringify({ contenu }), {
      status: 200,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin':  '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
