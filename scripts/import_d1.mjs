/**
 * D1 — Import œuvres domaine public
 * Project Gutenberg (Gutendex API) → Supabase Kalamundi
 *
 * Règles copyright :
 * - Auteur mort avant 1956 (70 ans révolus) → domaine public international ✅
 * - Toutes les œuvres vérifiées Project Gutenberg
 * - Aucun import depuis Amazon/Google Books/DRM
 *
 * Usage : node scripts/import_d1.mjs
 */

// ─── Credentials ─────────────────────────────────────────────────────────────
// Usage : SUPABASE_URL=... SERVICE_KEY=... node scripts/import_d1.mjs
const SUPABASE_URL  = process.env.SUPABASE_URL || "https://iobieffnaauecyukecds.supabase.co";
const SERVICE_KEY   = process.env.SERVICE_KEY  || "";

const HEADERS = {
  "apikey":        SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type":  "application/json",
};

// ─── Catalogue curatée — œuvres domaine public ───────────────────────────────
// [gutenberg_id, titre_override|null, auteur_override|null, genre, langue]
const CATALOGUE = [
  // ── Victor Hugo (1802–1885) ──────────────────────────────────────────────
  [17489, "Les Misérables — Tome I (Fantine)",    "Victor Hugo",  "roman",    "fr"],
  [17490, "Les Misérables — Tome II (Cosette)",   "Victor Hugo",  "roman",    "fr"],
  [17491, "Les Misérables — Tome III (Marius)",   "Victor Hugo",  "roman",    "fr"],
  [17492, "Les Misérables — Tome IV (L'Idylle)",  "Victor Hugo",  "roman",    "fr"],
  [17493, "Les Misérables — Tome V (Jean Valjean)","Victor Hugo", "roman",    "fr"],
  [19657, "Notre-Dame de Paris",                  "Victor Hugo",  "roman",    "fr"],
  [8164,  "Les Contemplations",                   "Victor Hugo",  "poesie",   "fr"],
  [8731,  "Hernani",                              "Victor Hugo",  "theatre",  "fr"],

  // ── Émile Zola (1840–1902) ───────────────────────────────────────────────
  [5711,  "Germinal",                             "Émile Zola",   "roman",    "fr"],
  [7804,  "L'Assommoir",                          "Émile Zola",   "roman",    "fr"],
  [7906,  "Nana",                                 "Émile Zola",   "roman",    "fr"],
  [7815,  "Au Bonheur des Dames",                 "Émile Zola",   "roman",    "fr"],
  [7798,  "La Bête Humaine",                      "Émile Zola",   "roman",    "fr"],
  [7803,  "La Terre",                             "Émile Zola",   "roman",    "fr"],

  // ── Honoré de Balzac (1799–1850) ────────────────────────────────────────
  [1237,  "Le Père Goriot",                       "Honoré de Balzac","roman", "fr"],
  [1388,  "Eugénie Grandet",                      "Honoré de Balzac","roman", "fr"],
  [1399,  "La Cousine Bette",                     "Honoré de Balzac","roman", "fr"],
  [1400,  "Le Cousin Pons",                       "Honoré de Balzac","roman", "fr"],

  // ── Alexandre Dumas (1802–1870) ──────────────────────────────────────────
  [13951, "Les Trois Mousquetaires",              "Alexandre Dumas","roman",  "fr"],
  [30,    "Le Comte de Monte-Cristo",             "Alexandre Dumas","roman",  "fr"],
  [1257,  "Vingt ans après",                      "Alexandre Dumas","roman",  "fr"],

  // ── Gustave Flaubert (1821–1880) ─────────────────────────────────────────
  [2413,  "Madame Bovary",                        "Gustave Flaubert","roman","fr"],
  [8326,  "Salammbô",                             "Gustave Flaubert","roman","fr"],
  [8394,  "L'Éducation sentimentale",             "Gustave Flaubert","roman","fr"],

  // ── Guy de Maupassant (1850–1893) ────────────────────────────────────────
  [3843,  "Bel-Ami",                              "Guy de Maupassant","roman","fr"],
  [21327, "Une Vie",                              "Guy de Maupassant","roman","fr"],
  [22421, "Le Horla",                             "Guy de Maupassant","nouvelles","fr"],
  [19978, "Contes du jour et de la nuit",         "Guy de Maupassant","nouvelles","fr"],

  // ── Jules Verne (1828–1905) ──────────────────────────────────────────────
  [800,   "Vingt mille lieues sous les mers",     "Jules Verne","aventure","fr"],
  [1268,  "De la Terre à la Lune",                "Jules Verne","science-fiction","fr"],
  [2154,  "Cinq semaines en ballon",              "Jules Verne","aventure","fr"],
  [4791,  "Les Enfants du capitaine Grant",       "Jules Verne","aventure","fr"],
  [3456,  "Michel Strogoff",                      "Jules Verne","aventure","fr"],
  [1842,  "L'Île mystérieuse",                    "Jules Verne","aventure","fr"],
  [12901, "Le Tour du monde en quatre-vingts jours","Jules Verne","aventure","fr"],
  [54,    "Voyage au centre de la Terre",         "Jules Verne","aventure","fr"],

  // ── Molière (1622–1673) ──────────────────────────────────────────────────
  [2552,  "Le Misanthrope",                       "Molière","theatre","fr"],
  [2780,  "L'Avare",                              "Molière","theatre","fr"],
  [2788,  "Tartuffe",                             "Molière","theatre","fr"],
  [2795,  "Le Bourgeois gentilhomme",             "Molière","theatre","fr"],

  // ── Voltaire (1694–1778) ─────────────────────────────────────────────────
  [19942, "Candide ou l'Optimisme",               "Voltaire","roman","fr"],
  [10912, "Zadig ou la Destinée",                 "Voltaire","roman","fr"],
  [9636,  "Micromégas",                           "Voltaire","roman","fr"],

  // ── Jean-Jacques Rousseau (1712–1778) ────────────────────────────────────
  [17990, "Les Confessions",                      "Jean-Jacques Rousseau","autobiographie","fr"],
  [46,    "Du Contrat social",                    "Jean-Jacques Rousseau","essai","fr"],

  // ── Stendhal (1783–1842) ─────────────────────────────────────────────────
  [44747, "Le Rouge et le Noir",                  "Stendhal","roman","fr"],

  // ── George Sand (1804–1876) ──────────────────────────────────────────────
  [2470,  "La Mare au diable",                    "George Sand","roman","fr"],
  [4271,  "François le Champi",                   "George Sand","roman","fr"],

  // ── Anatole France (1844–1924) ───────────────────────────────────────────
  [5608,  "L'Île des Pingouins",                  "Anatole France","roman","fr"],
  [7002,  "Les Dieux ont soif",                   "Anatole France","roman","fr"],

  // ── Alphonse Daudet (1840–1897) ──────────────────────────────────────────
  [8435,  "Lettres de mon moulin",                "Alphonse Daudet","nouvelles","fr"],
  [8451,  "Tartarin de Tarascon",                 "Alphonse Daudet","roman","fr"],
  [2797,  "Le Petit Chose",                       "Alphonse Daudet","roman","fr"],

  // ── Charles Baudelaire (1821–1867) ───────────────────────────────────────
  [6099,  "Les Fleurs du Mal",                    "Charles Baudelaire","poesie","fr"],
  [19024, "Le Spleen de Paris",                   "Charles Baudelaire","poesie","fr"],

  // ── Arthur Rimbaud (1854–1891) ───────────────────────────────────────────
  [4800,  "Une Saison en enfer",                  "Arthur Rimbaud","poesie","fr"],
  [14954, "Illuminations",                        "Arthur Rimbaud","poesie","fr"],

  // ── Paul Verlaine (1844–1896) ────────────────────────────────────────────
  [5882,  "Poèmes saturniens",                    "Paul Verlaine","poesie","fr"],

  // ── Marcel Proust (1871–1922) ────────────────────────────────────────────
  [7178,  "Du côté de chez Swann",               "Marcel Proust","roman","fr"],

  // ── Pierre Loti (1850–1923) — voyages Afrique/monde ─────────────────────
  [7617,  "Le Roman d'un spahi",                  "Pierre Loti","roman","fr"],
  [7618,  "Aziyadé",                              "Pierre Loti","roman","fr"],

  // ── René Caillié (1799–1838) — explorateur Afrique ──────────────────────
  [25997, "Journal d'un voyage à Tombouctou",     "René Caillié","voyage","fr"],

  // ── Théophile Gautier (1811–1872) ────────────────────────────────────────
  [4656,  "Le Capitaine Fracasse",                "Théophile Gautier","roman","fr"],
  [4829,  "Émaux et Camées",                      "Théophile Gautier","poesie","fr"],

  // ── Prosper Mérimée (1803–1870) ──────────────────────────────────────────
  [2465,  "Carmen",                               "Prosper Mérimée","nouvelles","fr"],

  // ── Alfred de Musset (1810–1857) ─────────────────────────────────────────
  [22939, "Lorenzaccio",                          "Alfred de Musset","theatre","fr"],
  [8538,  "On ne badine pas avec l'amour",        "Alfred de Musset","theatre","fr"],

  // ── Octave Mirbeau (1848–1917) ───────────────────────────────────────────
  [13503, "Le Journal d'une femme de chambre",    "Octave Mirbeau","roman","fr"],

  // ── Hector Malot (1830–1907) ─────────────────────────────────────────────
  [3531,  "Sans famille",                         "Hector Malot","roman","fr"],
  [5659,  "En famille",                           "Hector Malot","roman","fr"],

  // ── Comtesse de Ségur (1799–1874) ────────────────────────────────────────
  [12706, "Les Malheurs de Sophie",               "Comtesse de Ségur","enfance","fr"],
  [13688, "Les Petites Filles modèles",           "Comtesse de Ségur","enfance","fr"],
  [13716, "Un bon petit diable",                  "Comtesse de Ségur","enfance","fr"],

  // ── Jules Renard (1864–1910) ─────────────────────────────────────────────
  [2585,  "Poil de Carotte",                      "Jules Renard","roman","fr"],

  // ── Gaston Leroux (1868–1927) ────────────────────────────────────────────
  [175,   "Le Fantôme de l'Opéra",               "Gaston Leroux","roman","fr"],
  [700,   "Le Mystère de la Chambre Jaune",       "Gaston Leroux","roman","fr"],

  // ── Maurice Leblanc (1864–1941) ──────────────────────────────────────────
  [32095, "Arsène Lupin gentilhomme-cambrioleur", "Maurice Leblanc","roman","fr"],

  // ── Henry Murger (1822–1861) ─────────────────────────────────────────────
  [12873, "Scènes de la vie de bohème",           "Henry Murger","roman","fr"],

  // ── Alfred Jarry (1873–1907) ─────────────────────────────────────────────
  [6223,  "Ubu roi",                              "Alfred Jarry","theatre","fr"],

  // ── Émile Verhaeren (1855–1916) ──────────────────────────────────────────
  [13891, "Les Villes tentaculaires",             "Émile Verhaeren","poesie","fr"],

  // ── Paul Bourget (1852–1935) ─────────────────────────────────────────────
  [14033, "Le Disciple",                          "Paul Bourget","roman","fr"],

  // ── Remy de Gourmont (1858–1915) ─────────────────────────────────────────
  [7080,  "Sixtine",                              "Remy de Gourmont","roman","fr"],

  // ── Émile Zola — suite ───────────────────────────────────────────────────
  [7797,  "L'Argent",                             "Émile Zola","roman","fr"],
  [7805,  "La Débâcle",                           "Émile Zola","roman","fr"],
  [7800,  "Pot-Bouille",                          "Émile Zola","roman","fr"],

  // ── Stendhal — suite ─────────────────────────────────────────────────────
  [1237,  "La Chartreuse de Parme",               "Stendhal","roman","fr"],

  // ── Francis Jammes (1868–1938) ───────────────────────────────────────────
  [10218, "De l'Angélus de l'aube à l'Angélus du soir","Francis Jammes","poesie","fr"],
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function sbGet(endpoint, params = {}) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const r = await fetchWithRetry(url.toString(), { headers: HEADERS });
    if (!r.ok) return null;
    return r.json();
  } catch(e) { console.log(`  ⚠ sbGet: ${e.message}`); return null; }
}

async function sbPost(endpoint, body) {
  try {
    const r = await fetchWithRetry(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
      method: "POST",
      headers: { ...HEADERS, "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text();
      console.log(`  ✗ POST /${endpoint}: ${r.status} — ${txt.slice(0, 200)}`);
      return null;
    }
    const data = await r.json();
    return Array.isArray(data) ? data[0] : data;
  } catch(e) { console.log(`  ✗ sbPost: ${e.message}`); return null; }
}

async function fetchWithRetry(url, opts = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(60000) });
      return r;
    } catch(e) {
      if (attempt < retries) {
        console.log(`    ↻ Retry ${attempt}/${retries-1} — ${e.message}`);
        await sleep(2000 * attempt);
      } else {
        throw e;
      }
    }
  }
}

async function gutendexGet(id) {
  try {
    const r = await fetchWithRetry(`https://gutendex.com/books/${id}/`);
    if (r.ok) return r.json();
  } catch(e) {
    console.log(`  ⚠ Gutendex erreur (${id}): ${e.message}`);
  }
  return null;
}

async function fetchText(book, maxChars = 80000) {
  const formats = book.formats || {};
  const priority = [
    "text/plain; charset=utf-8",
    "text/plain; charset=us-ascii",
    "text/plain",
  ];
  let url = null;
  for (const fmt of priority) {
    if (formats[fmt]) { url = formats[fmt]; break; }
  }
  if (!url) {
    for (const [k, v] of Object.entries(formats)) {
      if (k.includes("text/plain")) { url = v; break; }
    }
  }
  if (!url) return null;

  try {
    const r = await fetchWithRetry(url);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    let text;
    try { text = new TextDecoder("utf-8").decode(buf); }
    catch { text = new TextDecoder("latin1").decode(buf); }
    return text.slice(0, maxChars);
  } catch(e) {
    console.log(`    ⚠ Téléchargement: ${e.message}`);
    return null;
  }
}

// ─── Profil système ───────────────────────────────────────────────────────────

async function getOrCreateSystemProfile() {
  const existing = await sbGet("profiles", { "email": "eq.domainepublic@kalamundi.com" });
  if (existing?.length) {
    const uid = existing[0].id;
    console.log(`✓ Profil système existant : ${uid}`);
    return uid;
  }

  console.log("→ Création du compte auth système...");
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      email: "domainepublic@kalamundi.com",
      password: "KalamundiDP2026!SecurePass#42",
      email_confirm: true,
      user_metadata: { nom: "Domaine Public" },
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    // Peut-être déjà existant dans auth mais pas dans profiles
    if (t.includes("already been registered")) {
      console.log("  → Auth déjà existant, recherche par autre moyen...");
      // Lister les users et trouver par email
      const users = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=domainepublic@kalamundi.com`, { headers: HEADERS });
      if (users.ok) {
        const data = await users.json();
        const u = (data.users || data)?.[0];
        if (u) return await ensureProfile(u.id);
      }
    }
    console.error(`✗ Erreur création auth: ${r.status} — ${t}`);
    process.exit(1);
  }

  const user = await r.json();
  console.log(`✓ Auth créé : ${user.id}`);
  return await ensureProfile(user.id);
}

async function ensureProfile(userId) {
  const profile = await sbPost("profiles", {
    id: userId,
    email: "domainepublic@kalamundi.com",
    nom: "Domaine Public",
    bio: "Œuvres classiques libres de droits — Project Gutenberg & Wikisource. " +
         "Tous les auteurs sont décédés depuis plus de 70 ans (domaine public international).",
    pays: "Monde",
    langue_preferee: "fr",
    role: "auteur",
    niveau_auteur: "professionnel",
    badge_fondateur: false,
  });
  if (profile) console.log(`✓ Profil créé : ${userId}`);
  return userId;
}

// ─── Import d'une œuvre ───────────────────────────────────────────────────────

async function importOeuvre(entry, auteurId, idx, total) {
  const [gutenbergId, titreOverride, auteurOverride, genre, langue] = entry;

  console.log(`\n[${idx}/${total}] Gutenberg #${gutenbergId} — ${titreOverride || "?"}`);

  // Métadonnées Gutendex
  const book = await gutendexGet(gutenbergId);
  if (!book) { console.log("  ✗ Introuvable"); return false; }

  // Titre & auteur
  const titre = titreOverride || book.title || `Œuvre #${gutenbergId}`;
  let auteurNom = auteurOverride;
  if (!auteurNom) {
    const a = (book.authors || [])[0];
    if (a) {
      const parts = (a.name || "").split(", ");
      auteurNom = parts.length === 2 ? `${parts[1]} ${parts[0]}` : (a.name || "Auteur inconnu");
    } else { auteurNom = "Auteur inconnu"; }
  }

  // Doublon
  const dup = await sbGet("oeuvres", { "titre": `eq.${titre}`, "auteur_id": `eq.${auteurId}`, "select": "id" });
  if (dup?.length) { console.log("  ↩ Déjà importé"); return "skip"; }

  // Résumé
  const subjects = (book.subjects || []).slice(0, 5).join("; ");
  const resume = `Œuvre classique du domaine public. Auteur : ${auteurNom}. ${subjects ? "Thèmes : " + subjects + "." : ""} Source : Project Gutenberg #${gutenbergId}.`.slice(0, 500);

  // Couverture
  let couvertureUrl = null;
  for (const [k, v] of Object.entries(book.formats || {})) {
    if (k.includes("image")) { couvertureUrl = v; break; }
  }

  // Texte
  console.log("  ↓ Téléchargement...");
  let texte = await fetchText(book, 100000);
  if (!texte) {
    texte = `[Texte complet disponible sur Project Gutenberg : https://www.gutenberg.org/ebooks/${gutenbergId}]`;
    console.log("  ⚠ Pas de texte brut — métadonnées seulement");
  }

  const hash = await sha256(texte);

  // Insérer œuvre
  const oeuvre = await sbPost("oeuvres", {
    auteur_id: auteurId,
    titre,
    genre,
    resume,
    langue_originale: langue,
    statut: "gratuit",
    prix: 0,
    couverture_url: couvertureUrl,
    fichier_url: `https://www.gutenberg.org/ebooks/${gutenbergId}`,
    hash_sha256: hash,
    horodatage_blockchain: `gutenberg:${gutenbergId}:${new Date().toISOString()}`,
    nb_lectures: 0,
    note_moyenne: 0,
    public_cible: "tous",
    visible: true,
  });
  if (!oeuvre) return false;

  // Chapitres (chunks de 5000 chars, max 20)
  const CHUNK = 5000;
  const chunks = [];
  for (let i = 0; i < texte.length && chunks.length < 20; i += CHUNK) {
    chunks.push(texte.slice(i, i + CHUNK));
  }

  let chapOk = 0;
  for (let i = 0; i < chunks.length; i++) {
    const ch = await sbPost("chapitres", {
      oeuvre_id: oeuvre.id,
      numero: i + 1,
      titre: `Partie ${i + 1}`,
      contenu_texte: chunks[i],
    });
    if (ch) chapOk++;
  }

  console.log(`  ✓ "${titre}" — ${chapOk} chapitre(s)`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("D1 — Import œuvres domaine public — Kalamundi");
  console.log(`Démarrage : ${new Date().toLocaleString("fr-FR")}`);
  console.log("=".repeat(60));

  const auteurId = await getOrCreateSystemProfile();

  // Dédupliquer les IDs du catalogue
  const seen = new Set();
  const catalogue = CATALOGUE.filter(([id]) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  console.log(`\n${catalogue.length} œuvres dans le catalogue\n`);

  let success = 0, failed = 0, skipped = 0;

  for (let i = 0; i < catalogue.length; i++) {
    const result = await importOeuvre(catalogue[i], auteurId, i + 1, catalogue.length);
    if (result === true) success++;
    else if (result === "skip") skipped++;
    else failed++;
    await sleep(700); // rate limit Gutendex
  }

  console.log("\n" + "=".repeat(60));
  console.log(`Résultat : ${success} importées | ${skipped} ignorées | ${failed} échecs`);
  console.log(`Fin : ${new Date().toLocaleString("fr-FR")}`);
  console.log("=".repeat(60));

  const rapport = {
    date: new Date().toISOString(),
    total_catalogue: catalogue.length,
    importees: success,
    ignorees: skipped,
    echecs: failed,
    auteur_systeme_id: auteurId,
  };

  await import("fs").then(fs =>
    fs.writeFileSync("scripts/rapport_d1.json", JSON.stringify(rapport, null, 2), "utf-8")
  );
  console.log("→ Rapport : scripts/rapport_d1.json");
}

main().catch(e => { console.error(e); process.exit(1); });
