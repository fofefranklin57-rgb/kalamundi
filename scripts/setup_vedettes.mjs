/**
 * setup_vedettes.mjs — Mettre en avant 6 œuvres vedettes sur l'accueil
 * Met à jour couvertures, résumés et nb_lectures pour le tri
 */

const SUPABASE_URL = process.env.SUPABASE_URL || "https://iobieffnaauecyukecds.supabase.co";
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

const HEADERS = {
  "apikey": SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
  "Prefer": "return=representation",
};

// 6 vedettes avec couvertures Wikimedia Commons + résumés soignés
const VEDETTES = [
  {
    titre: "Les Misérables — Tome I (Fantine)",
    auteur: "Victor Hugo",
    couverture_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Les_Mis%C3%A9rables_poster.jpg/400px-Les_Mis%C3%A9rables_poster.jpg",
    resume: "Chef-d'œuvre de Victor Hugo, Les Misérables retrace le destin de Jean Valjean, ancien bagnard en quête de rédemption dans la France du XIXe siècle. Une fresque humaine et sociale inoubliable sur la justice, la grâce et la dignité.",
    nb_lectures: 4200,
  },
  {
    titre: "Le Comte de Monte-Cristo",
    auteur: "Alexandre Dumas",
    couverture_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Edmond_Dantes_escaping.jpg/400px-Edmond_Dantes_escaping.jpg",
    resume: "Edmond Dantès, injustement emprisonné, s'évade du château d'If et devient le mystérieux Comte de Monte-Cristo pour assouvir une vengeance savamment orchestrée. Le roman d'aventure et de trahison le plus lu au monde.",
    nb_lectures: 3800,
  },
  {
    titre: "Germinal",
    auteur: "Émile Zola",
    couverture_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Germinal_premier_edition.jpg/400px-Germinal_premier_edition.jpg",
    resume: "Dans les mines du Nord de la France, Étienne Lantier découvre la misère des mineurs et embrase la révolte. Chef-d'œuvre du naturalisme, Germinal reste le roman social le plus puissant de la littérature française.",
    nb_lectures: 3100,
  },
  {
    titre: "Le Fantôme de l'Opéra",
    auteur: "Gaston Leroux",
    couverture_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Phantom_of_the_Opera_1925.jpg/400px-Phantom_of_the_Opera_1925.jpg",
    resume: "Dans les sous-sols de l'Opéra de Paris vit Erik, le Fantôme — génie musical défiguré et amoureux fou de la soprano Christine Daaé. Un roman gothique et passionné devenu mythe mondial.",
    nb_lectures: 2900,
  },
  {
    titre: "Candide ou l'Optimisme",
    auteur: "Voltaire",
    couverture_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Candide_1759_title_page.jpg/400px-Candide_1759_title_page.jpg",
    resume: "Chassé de son château, Candide traverse guerres, catastrophes et injustices avec un optimisme incurable. Le conte philosophique de Voltaire — drôle, cinglant et universel — reste d'une actualité brûlante.",
    nb_lectures: 2600,
  },
  {
    titre: "Vingt mille lieues sous les mers",
    auteur: "Jules Verne",
    couverture_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Nautilus_from_below.jpg/400px-Nautilus_from_below.jpg",
    resume: "À bord du Nautilus, le mystérieux capitaine Nemo parcourt les profondeurs des océans. Jules Verne imagine avec un siècle d'avance la technologie sous-marine dans ce roman d'aventure et de science qui fascine encore.",
    nb_lectures: 2400,
  },
];

async function sbGet(endpoint, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url, { headers: HEADERS });
  return r.ok ? r.json() : null;
}

async function sbPatch(endpoint, params, body) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const r = await fetch(url, { method: "PATCH", headers: HEADERS, body: JSON.stringify(body) });
  if (!r.ok) console.log(`  ✗ PATCH: ${r.status} — ${await r.text().catch(() => '')}`);
  return r.ok;
}

async function main() {
  console.log("=".repeat(50));
  console.log("Setup vedettes — Kalamundi");
  console.log("=".repeat(50));

  for (const v of VEDETTES) {
    console.log(`\n→ ${v.titre}`);

    // Trouver l'œuvre par titre (commence par)
    const titreDebut = v.titre.split(" — ")[0]; // "Les Misérables"
    const results = await sbGet("oeuvres", {
      "titre": `ilike.${titreDebut}%`,
      "select": "id,titre",
      "limit": "1",
    });

    if (!results?.length) {
      console.log(`  ✗ Introuvable : "${titreDebut}"`);
      continue;
    }

    const id = results[0].id;
    const ok = await sbPatch("oeuvres", { "id": `eq.${id}` }, {
      couverture_url: v.couverture_url,
      resume:         v.resume,
      nb_lectures:    v.nb_lectures,
    });

    console.log(ok ? `  ✓ Mis à jour (id: ${id})` : `  ✗ Échec`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("Vedettes configurées !");
}

main().catch(e => { console.error(e); process.exit(1); });
