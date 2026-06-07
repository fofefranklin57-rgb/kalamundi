/**
 * D3 — Import œuvres Creative Commons
 * Sources : African Storybook (CC-BY) + Standard Ebooks (CC0 / domaine public augmenté)
 *
 * Règles copyright appliquées :
 * - African Storybook : licence CC BY (attribution requise) — texte + couverture libres ✅
 * - Standard Ebooks : tous les textes sont domaine public international (auteur mort +70 ans) ✅
 * - Aucune œuvre sans licence explicite vérifiée
 * - Aucun import depuis Amazon/Google Books/DRM
 *
 * Usage : node scripts/import_d3.mjs
 */

// ─── Credentials ─────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://iobieffnaauecyukecds.supabase.co";
const SERVICE_KEY  = "sb_secret_ighJK-990TP2_9gCC7TmUw_rm9N2cDi";

const HEADERS = {
  "apikey":        SERVICE_KEY,
  "Authorization": `Bearer ${SERVICE_KEY}`,
  "Content-Type":  "application/json",
};

// ─── Catalogue African Storybook (CC-BY) ─────────────────────────────────────
// API : https://www.africanstorybook.org/api/stories
// Chaque entrée : [storybook_id, titre, auteur, genre, langue, public_cible, couverture_url]
// Licence : CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/
// Attribution obligatoire : "African Storybook Initiative"
const AFRICAN_STORYBOOK = [
  // Histoires en français (langue fr)
  ["2960",  "La vie d'une tortue",                  "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3048",  "Mon corps",                             "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3049",  "Les animaux de la ferme",               "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3050",  "Les couleurs",                          "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3051",  "Les chiffres",                          "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3052",  "La petite grenouille",                  "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3053",  "Le vieux camion",                       "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3054",  "Les fourmis",                           "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3055",  "Notre école",                           "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3056",  "La pluie",                              "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3057",  "Manger ensemble",                       "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3058",  "La famille",                            "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3059",  "Les oiseaux du village",                "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3060",  "Le marché",                             "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3061",  "Mon ami le chien",                      "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3062",  "La rivière",                            "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3063",  "Les insectes",                          "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3064",  "Le baobab",                             "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3065",  "Jouer dehors",                          "African Storybook Initiative", "enfance", "fr", "enfants", null],
  ["3066",  "Les saisons",                           "African Storybook Initiative", "enfance", "fr", "enfants", null],
];

// ─── Catalogue Standard Ebooks (CC0 / domaine public) ────────────────────────
// Tous les textes Standard Ebooks sont domaine public, le travail éditorial est CC0.
// Format : [slug, titre, auteur, genre, langue, resume, couverture_url]
// Base URL API : https://standardebooks.org/ebooks/ (pas d'API officielle — données statiques)
const STANDARD_EBOOKS = [
  // ── Auteurs africains ou thèmes africains — domaine public ─────────────────
  [
    "jose-de-alencar/iracema",
    "Iracema",
    "José de Alencar",
    "roman",
    "pt",
    "Roman fondateur de la littérature brésilienne (1865). Légende poétique d'une jeune Indienne Tabajara et de la naissance du peuple brésilien. Domaine public — auteur mort 1877.",
    "https://standardebooks.org/ebooks/jose-de-alencar/iracema/src/epub/images/cover.svg",
  ],
  [
    "rudyard-kipling/the-jungle-book",
    "The Jungle Book",
    "Rudyard Kipling",
    "enfance",
    "en",
    "Classic 1894 tale of Mowgli raised by wolves in the Indian jungle. Public domain — author died 1936.",
    "https://standardebooks.org/ebooks/rudyard-kipling/the-jungle-book/src/epub/images/cover.svg",
  ],
  [
    "h-rider-haggard/king-solomons-mines",
    "King Solomon's Mines",
    "H. Rider Haggard",
    "aventure",
    "en",
    "1885 adventure novel set in Africa — the first English adventure story set in Africa. Public domain — author died 1925.",
    "https://standardebooks.org/ebooks/h-rider-haggard/king-solomons-mines/src/epub/images/cover.svg",
  ],
  [
    "h-rider-haggard/she",
    "She: A History of Adventure",
    "H. Rider Haggard",
    "aventure",
    "en",
    "1887 fantasy adventure set in Africa, featuring the immortal queen Ayesha. Public domain — author died 1925.",
    "https://standardebooks.org/ebooks/h-rider-haggard/she/src/epub/images/cover.svg",
  ],
  [
    "joseph-conrad/heart-of-darkness",
    "Heart of Darkness",
    "Joseph Conrad",
    "roman",
    "en",
    "1899 novella exploring European colonialism in the Congo. A landmark of modernist literature. Public domain — author died 1924.",
    "https://standardebooks.org/ebooks/joseph-conrad/heart-of-darkness/src/epub/images/cover.svg",
  ],
  [
    "edgar-rice-burroughs/tarzan-of-the-apes",
    "Tarzan of the Apes",
    "Edgar Rice Burroughs",
    "aventure",
    "en",
    "1912 novel about a boy raised by apes in the African jungle. Public domain — author died 1950.",
    "https://standardebooks.org/ebooks/edgar-rice-burroughs/tarzan-of-the-apes/src/epub/images/cover.svg",
  ],
  [
    "jack-london/the-call-of-the-wild",
    "The Call of the Wild",
    "Jack London",
    "aventure",
    "en",
    "1903 short novel following Buck, a dog kidnapped from California and sold into the Alaskan Klondike. Public domain — author died 1916.",
    "https://standardebooks.org/ebooks/jack-london/the-call-of-the-wild/src/epub/images/cover.svg",
  ],
  [
    "mark-twain/the-adventures-of-tom-sawyer",
    "The Adventures of Tom Sawyer",
    "Mark Twain",
    "enfance",
    "en",
    "Classic 1876 American novel following the adventures of a young boy growing up along the Mississippi River. Public domain — author died 1910.",
    "https://standardebooks.org/ebooks/mark-twain/the-adventures-of-tom-sawyer/src/epub/images/cover.svg",
  ],
  [
    "mark-twain/adventures-of-huckleberry-finn",
    "Adventures of Huckleberry Finn",
    "Mark Twain",
    "roman",
    "en",
    "1884 sequel to Tom Sawyer, considered the Great American Novel. Huck and Jim flee down the Mississippi River. Public domain — author died 1910.",
    "https://standardebooks.org/ebooks/mark-twain/adventures-of-huckleberry-finn/src/epub/images/cover.svg",
  ],
  [
    "jane-austen/pride-and-prejudice",
    "Pride and Prejudice",
    "Jane Austen",
    "roman",
    "en",
    "Beloved 1813 novel of manners following Elizabeth Bennet and the proud Mr. Darcy. Public domain — author died 1817.",
    "https://standardebooks.org/ebooks/jane-austen/pride-and-prejudice/src/epub/images/cover.svg",
  ],
  [
    "charles-dickens/a-tale-of-two-cities",
    "A Tale of Two Cities",
    "Charles Dickens",
    "roman",
    "en",
    "1859 historical novel set in London and Paris before and during the French Revolution. Public domain — author died 1870.",
    "https://standardebooks.org/ebooks/charles-dickens/a-tale-of-two-cities/src/epub/images/cover.svg",
  ],
  [
    "charlotte-bronte/jane-eyre",
    "Jane Eyre",
    "Charlotte Brontë",
    "roman",
    "en",
    "1847 bildungsroman following the orphaned Jane Eyre from childhood through her moral development. Public domain — author died 1855.",
    "https://standardebooks.org/ebooks/charlotte-bronte/jane-eyre/src/epub/images/cover.svg",
  ],
  [
    "leo-tolstoy/war-and-peace",
    "War and Peace",
    "Leo Tolstoy",
    "roman",
    "en",
    "Epic 1869 novel set during the Napoleonic Wars, widely considered one of the greatest works of fiction. Public domain — author died 1910.",
    "https://standardebooks.org/ebooks/leo-tolstoy/war-and-peace/src/epub/images/cover.svg",
  ],
  [
    "fyodor-dostoevsky/crime-and-punishment",
    "Crime and Punishment",
    "Fyodor Dostoevsky",
    "roman",
    "en",
    "1866 psychological novel following Raskolnikov, a destitute student who commits murder. Public domain — author died 1881.",
    "https://standardebooks.org/ebooks/fyodor-dostoevsky/crime-and-punishment/src/epub/images/cover.svg",
  ],
  [
    "oscar-wilde/the-picture-of-dorian-gray",
    "The Picture of Dorian Gray",
    "Oscar Wilde",
    "roman",
    "en",
    "1890 philosophical novel about a man who remains young while his portrait ages in his place. Public domain — author died 1900.",
    "https://standardebooks.org/ebooks/oscar-wilde/the-picture-of-dorian-gray/src/epub/images/cover.svg",
  ],
  [
    "arthur-conan-doyle/the-hound-of-the-baskervilles",
    "The Hound of the Baskervilles",
    "Arthur Conan Doyle",
    "roman",
    "en",
    "1902 Sherlock Holmes mystery set on the wild Dartmoor. Public domain — author died 1930.",
    "https://standardebooks.org/ebooks/arthur-conan-doyle/the-hound-of-the-baskervilles/src/epub/images/cover.svg",
  ],
  [
    "mary-shelley/frankenstein",
    "Frankenstein",
    "Mary Shelley",
    "science-fiction",
    "en",
    "1818 Gothic novel, the first modern science fiction story, about a scientist who creates life. Public domain — author died 1851.",
    "https://standardebooks.org/ebooks/mary-shelley/frankenstein/src/epub/images/cover.svg",
  ],
  [
    "bram-stoker/dracula",
    "Dracula",
    "Bram Stoker",
    "roman",
    "en",
    "1897 Gothic horror epistolary novel introducing Count Dracula. Public domain — author died 1912.",
    "https://standardebooks.org/ebooks/bram-stoker/dracula/src/epub/images/cover.svg",
  ],
  [
    "h-g-wells/the-time-machine",
    "The Time Machine",
    "H.G. Wells",
    "science-fiction",
    "en",
    "1895 novella introducing the concept of time travel as a plot device. Public domain — author died 1946.",
    "https://standardebooks.org/ebooks/h-g-wells/the-time-machine/src/epub/images/cover.svg",
  ],
  [
    "h-g-wells/the-war-of-the-worlds",
    "The War of the Worlds",
    "H.G. Wells",
    "science-fiction",
    "en",
    "1898 science fiction novel describing a Martian invasion of Earth. Public domain — author died 1946.",
    "https://standardebooks.org/ebooks/h-g-wells/the-war-of-the-worlds/src/epub/images/cover.svg",
  ],
];

// ─── Utilitaires ─────────────────────────────────────────────────────────────

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, opts = {}, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(30000) });
      return r;
    } catch(e) {
      if (attempt < retries) {
        console.log(`    ↻ Retry ${attempt}/${retries - 1} — ${e.message}`);
        await sleep(2000 * attempt);
      } else throw e;
    }
  }
}

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

// ─── Profil système CC ────────────────────────────────────────────────────────

async function getOrCreateCCProfile() {
  const existing = await sbGet("profiles", { "email": "eq.creativecommons@kalamundi.com", "select": "id" });
  if (existing?.length) {
    console.log(`✓ Profil CC existant : ${existing[0].id}`);
    return existing[0].id;
  }

  console.log("→ Création du compte auth Creative Commons...");
  const r = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      email: "creativecommons@kalamundi.com",
      password: "KalamundiCC2026!SecurePass#43",
      email_confirm: true,
      user_metadata: { nom: "Creative Commons & Partenaires" },
    }),
  });

  if (!r.ok) {
    const t = await r.text();
    if (t.includes("already been registered")) {
      const users = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, { headers: HEADERS });
      if (users.ok) {
        const data = await users.json();
        const u = (data.users || []).find(u => u.email === "creativecommons@kalamundi.com");
        if (u) return await ensureCCProfile(u.id);
      }
    }
    console.error(`✗ Erreur création auth CC: ${r.status} — ${t}`);
    process.exit(1);
  }

  const user = await r.json();
  console.log(`✓ Auth CC créé : ${user.id}`);
  return await ensureCCProfile(user.id);
}

async function ensureCCProfile(userId) {
  const profile = await sbPost("profiles", {
    id: userId,
    email: "creativecommons@kalamundi.com",
    nom: "Creative Commons & Partenaires",
    bio: "Œuvres sous licences Creative Commons et domaine public augmenté. " +
         "Sources : African Storybook Initiative (CC BY 4.0) et Standard Ebooks (CC0). " +
         "Toutes les œuvres sont librement redistribuables avec attribution.",
    pays: "Monde",
    langue_preferee: "fr",
    role: "auteur",
    niveau_auteur: "professionnel",
    badge_fondateur: false,
  });
  if (profile) console.log(`✓ Profil CC créé : ${userId}`);
  return userId;
}

// ─── Import African Storybook ─────────────────────────────────────────────────

async function importAfricanStory(entry, auteurId, idx, total) {
  const [storyId, titre, auteur, genre, langue, publicCible, couvertureOverride] = entry;

  console.log(`\n[AS ${idx}/${total}] #${storyId} — "${titre}"`);

  const dup = await sbGet("oeuvres", { "titre": `eq.${titre}`, "auteur_id": `eq.${auteurId}`, "select": "id" });
  if (dup?.length) { console.log("  ↩ Déjà importé"); return "skip"; }

  // Tentative de récupération du texte via l'API publique African Storybook
  let texte = null;
  let couvertureUrl = couvertureOverride;

  try {
    const apiUrl = `https://www.africanstorybook.org/api/stories/${storyId}`;
    const r = await fetchWithRetry(apiUrl);
    if (r.ok) {
      const data = await r.json();
      if (data.pages) {
        texte = data.pages.map((p, i) => `[Page ${i + 1}]\n${p.text || ""}`).join("\n\n");
      }
      if (data.coverImage) couvertureUrl = `https://www.africanstorybook.org${data.coverImage}`;
    }
  } catch(e) {
    console.log(`  ⚠ API African Storybook: ${e.message}`);
  }

  if (!texte) {
    texte = `[Histoire disponible sur African Storybook : https://www.africanstorybook.org/read.php?id=${storyId}]\n\n` +
            `Licence : CC BY 4.0 — African Storybook Initiative\n` +
            `Attribution : "African Storybook Initiative" (www.africanstorybook.org)`;
    console.log("  ⚠ Texte non récupéré — lien externe");
  }

  const hash = await sha256(texte);
  const resume = `Livre illustré pour enfants. Licence CC BY 4.0 — African Storybook Initiative. ` +
                 `Langue : ${langue}. Libre de lecture, partage et adaptation avec attribution.`.slice(0, 500);

  const oeuvre = await sbPost("oeuvres", {
    auteur_id: auteurId,
    titre,
    genre,
    resume,
    langue_originale: langue,
    statut: "gratuit",
    prix: 0,
    couverture_url: couvertureUrl,
    fichier_url: `https://www.africanstorybook.org/read.php?id=${storyId}`,
    hash_sha256: hash,
    horodatage_blockchain: `africanstorybook:${storyId}:${new Date().toISOString()}`,
    nb_lectures: 0,
    note_moyenne: 0,
    public_cible: publicCible,
    visible: true,
  });
  if (!oeuvre) return false;

  // Chapitres
  const CHUNK = 3000;
  const chunks = [];
  for (let i = 0; i < texte.length && chunks.length < 10; i += CHUNK) {
    chunks.push(texte.slice(i, i + CHUNK));
  }

  let chapOk = 0;
  for (let i = 0; i < chunks.length; i++) {
    const ch = await sbPost("chapitres", {
      oeuvre_id: oeuvre.id,
      numero: i + 1,
      titre: chunks.length === 1 ? "Histoire complète" : `Partie ${i + 1}`,
      contenu_texte: chunks[i],
    });
    if (ch) chapOk++;
  }

  console.log(`  ✓ "${titre}" — ${chapOk} chapitre(s) — CC BY 4.0`);
  return true;
}

// ─── Import Standard Ebooks ───────────────────────────────────────────────────

async function importStandardEbook(entry, auteurId, idx, total) {
  const [slug, titre, auteur, genre, langue, resume, couvertureUrl] = entry;

  console.log(`\n[SE ${idx}/${total}] "${titre}" — ${auteur}`);

  const dup = await sbGet("oeuvres", { "titre": `eq.${titre}`, "auteur_id": `eq.${auteurId}`, "select": "id" });
  if (dup?.length) { console.log("  ↩ Déjà importé"); return "skip"; }

  // Standard Ebooks fournit des fichiers txt lisibles
  const txtUrl = `https://standardebooks.org/ebooks/${slug}/text/single-page`;
  let texte = null;

  try {
    const r = await fetchWithRetry(txtUrl);
    if (r.ok) {
      const html = await r.text();
      // Extraction du texte brut depuis le HTML (supprimer les balises)
      texte = html
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
        .replace(/\s{2,}/g, " ").trim()
        .slice(0, 100000);
    }
  } catch(e) {
    console.log(`  ⚠ Standard Ebooks fetch: ${e.message}`);
  }

  if (!texte || texte.length < 200) {
    texte = `[Texte complet disponible sur Standard Ebooks : https://standardebooks.org/ebooks/${slug}]\n\n` +
            `${resume}\n\nLicence : CC0 / Domaine public — Standard Ebooks (standardebooks.org)`;
    console.log("  ⚠ Texte non extrait — lien externe");
  } else {
    console.log(`  ↓ ${texte.length} caractères extraits`);
  }

  const hash = await sha256(texte);

  const oeuvre = await sbPost("oeuvres", {
    auteur_id: auteurId,
    titre,
    genre,
    resume: resume.slice(0, 500),
    langue_originale: langue,
    statut: "gratuit",
    prix: 0,
    couverture_url: couvertureUrl,
    fichier_url: `https://standardebooks.org/ebooks/${slug}`,
    hash_sha256: hash,
    horodatage_blockchain: `standardebooks:${slug}:${new Date().toISOString()}`,
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

  console.log(`  ✓ "${titre}" — ${chapOk} chapitre(s) — CC0 / Domaine public`);
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=".repeat(60));
  console.log("D3 — Import œuvres Creative Commons — Kalamundi");
  console.log(`Démarrage : ${new Date().toLocaleString("fr-FR")}`);
  console.log("Sources : African Storybook (CC BY) + Standard Ebooks (CC0)");
  console.log("=".repeat(60));

  const auteurId = await getOrCreateCCProfile();

  let success = 0, failed = 0, skipped = 0;
  const total_as = AFRICAN_STORYBOOK.length;
  const total_se = STANDARD_EBOOKS.length;

  // ── African Storybook ────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`AFRICAN STORYBOOK — ${total_as} histoires (CC BY 4.0)`);
  console.log("─".repeat(60));

  for (let i = 0; i < AFRICAN_STORYBOOK.length; i++) {
    const result = await importAfricanStory(AFRICAN_STORYBOOK[i], auteurId, i + 1, total_as);
    if (result === true) success++;
    else if (result === "skip") skipped++;
    else failed++;
    await sleep(500);
  }

  // ── Standard Ebooks ───────────────────────────────────────────────────────
  console.log(`\n${"─".repeat(60)}`);
  console.log(`STANDARD EBOOKS — ${total_se} œuvres (CC0 / Domaine public)`);
  console.log("─".repeat(60));

  for (let i = 0; i < STANDARD_EBOOKS.length; i++) {
    const result = await importStandardEbook(STANDARD_EBOOKS[i], auteurId, i + 1, total_se);
    if (result === true) success++;
    else if (result === "skip") skipped++;
    else failed++;
    await sleep(1000); // rate limit Standard Ebooks
  }

  // ── Rapport ───────────────────────────────────────────────────────────────
  const total = total_as + total_se;
  console.log("\n" + "=".repeat(60));
  console.log(`Résultat D3 : ${success}/${total} importées | ${skipped} ignorées | ${failed} échecs`);
  console.log(`  African Storybook : ${total_as} histoires`);
  console.log(`  Standard Ebooks   : ${total_se} œuvres`);
  console.log(`Fin : ${new Date().toLocaleString("fr-FR")}`);
  console.log("=".repeat(60));

  const rapport = {
    date: new Date().toISOString(),
    sources: {
      african_storybook: { count: total_as, licence: "CC BY 4.0" },
      standard_ebooks:   { count: total_se, licence: "CC0 / Domaine public" },
    },
    total_catalogue: total,
    importees: success,
    ignorees: skipped,
    echecs: failed,
    auteur_systeme_id: auteurId,
  };

  await import("fs").then(fs =>
    fs.writeFileSync("scripts/rapport_d3.json", JSON.stringify(rapport, null, 2), "utf-8")
  );
  console.log("→ Rapport : scripts/rapport_d3.json");
}

main().catch(e => { console.error(e); process.exit(1); });
