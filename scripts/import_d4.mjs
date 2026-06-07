// node scripts/import_d4.mjs
// Enrichissement bibliothèque — Wikisource (API MediaWiki)
// Cible : textes francophones du domaine public
// Exécuter depuis C:\kalamundi\ : node scripts/import_d4.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_KEY = 'sb_secret_ighJK-990TP2_9gCC7TmUw_rm9N2cDi';
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTEUR_SYSTEME_ID = '00000000-0000-0000-0000-000000000001';
const WIKISOURCE_API    = 'https://fr.wikisource.org/w/api.php';
const MAX_OEUVRES       = 30;
const DELAI_MS          = 500;

const CATEGORIES = [
  'Textes_à_exporter',
  'Littérature_africaine',
  'Romans_du_domaine_public',
  'Poèmes_du_domaine_public',
];

const GENRE_MOTS = {
  roman: ['roman', 'novel', 'fiction'],
  poesie: ['poésie', 'poème', 'poem', 'vers'],
  conte: ['conte', 'fable', 'nouvelle', 'tale'],
  essai: ['essai', 'discours', 'mémoire'],
  theatre: ['théâtre', 'drame', 'comédie', 'tragédie'],
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sha256(t) { return crypto.createHash('sha256').update(t, 'utf8').digest('hex'); }

function detecterGenre(titre, categories = []) {
  const s = (titre + ' ' + categories.join(' ')).toLowerCase();
  for (const [genre, mots] of Object.entries(GENRE_MOTS)) {
    if (mots.some(m => s.includes(m))) return genre;
  }
  return 'roman';
}

function nettoyerWikitext(wikitext) {
  let t = wikitext || '';
  // Supprimer les templates {{...}} (plusieurs passes pour les imbriqués)
  for (let i = 0; i < 6; i++) t = t.replace(/\{\{[^{}]*\}\}/g, '');
  // Liens [[Texte|Alias]] → Alias, [[Texte]] → Texte
  t = t.replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, '$1');
  t = t.replace(/\[\[([^\]]*)\]\]/g, '$1');
  // Balises HTML
  t = t.replace(/<[^>]+>/g, '');
  // Commentaires
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  // En-têtes wiki === → newlines
  t = t.replace(/={2,}[^=]+=+/g, '\n');
  // Tableaux
  t = t.replace(/^\s*[|!][-+=]?/gm, '').replace(/\{\|[^|]*\|/g, '').replace(/\|\}/g, '');
  // Nettoyage espaces
  t = t.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

async function getMembresCategorie(categorie) {
  const p = new URLSearchParams({
    action: 'query', list: 'categorymembers',
    cmtitle: `Catégorie:${categorie}`, cmlimit: '50',
    cmtype: 'page', format: 'json', origin: '*',
  });
  const res = await fetch(`${WIKISOURCE_API}?${p}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data?.query?.categorymembers ?? [];
}

async function getContenuPage(titre) {
  const p = new URLSearchParams({
    action: 'parse', page: titre,
    prop: 'wikitext|categories', format: 'json', origin: '*',
  });
  const res = await fetch(`${WIKISOURCE_API}?${p}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(data.error.info);
  return {
    wikitext:   data?.parse?.wikitext?.['*'] ?? '',
    categories: (data?.parse?.categories ?? []).map(c => c['*']),
  };
}

async function getResume(titre) {
  const p = new URLSearchParams({
    action: 'query', titles: titre, prop: 'extracts',
    exintro: '1', exchars: '500', format: 'json', origin: '*',
  });
  const res = await fetch(`${WIKISOURCE_API}?${p}`);
  if (!res.ok) return '';
  const data = await res.json();
  const pages = data?.query?.pages ?? {};
  return (Object.values(pages)[0]?.extract ?? '').replace(/<[^>]+>/g, '').trim();
}

async function assureCompteSysteme() {
  await supabase.from('profiles').upsert({
    id: AUTEUR_SYSTEME_ID,
    nom: 'Bibliothèque Kalamundi',
    email: 'bibliotheque@kalamundi.com',
    role: 'auteur',
    langue_preferee: 'fr',
  }, { onConflict: 'id', ignoreDuplicates: true });
}

async function doublonExiste(titre) {
  const { data } = await supabase.from('oeuvres').select('id')
    .eq('auteur_id', AUTEUR_SYSTEME_ID).ilike('titre', titre.trim()).limit(1);
  return (data?.length ?? 0) > 0;
}

async function inserer(oeuvreData, contenu) {
  const { data: o, error } = await supabase.from('oeuvres').insert(oeuvreData).select('id').single();
  if (error) throw new Error(error.message);
  const { error: ec } = await supabase.from('chapitres').insert({
    oeuvre_id: o.id, numero: 1, titre: 'Texte complet',
    contenu_texte: contenu, type_element: 'chapitre',
  });
  if (ec) {
    await supabase.from('oeuvres').delete().eq('id', o.id);
    throw new Error(ec.message);
  }
  return o.id;
}

async function main() {
  console.log('=== Import D4 — Wikisource ===');
  await assureCompteSysteme();

  const vus = new Set();
  let total = 0, erreurs = 0;

  for (const cat of CATEGORIES) {
    if (total >= MAX_OEUVRES) break;
    console.log(`\nCatégorie : ${cat}`);
    let membres;
    try { membres = await getMembresCategorie(cat); }
    catch (e) { console.error(`  ✗ ${e.message}`); continue; }
    console.log(`  ${membres.length} pages trouvées`);

    for (const m of membres) {
      if (total >= MAX_OEUVRES) break;
      // Ignorer les sous-pages (Titre/Chapitre1)
      if (vus.has(m.title) || m.title.includes('/')) continue;
      vus.add(m.title);
      await sleep(DELAI_MS);

      const titre = m.title.trim().slice(0, 200);
      try {
        if (await doublonExiste(titre)) { console.log(`  ↷ Doublon : ${titre}`); continue; }

        const { wikitext, categories } = await getContenuPage(titre);
        const contenu = nettoyerWikitext(wikitext);
        if (contenu.length < 200) { console.log(`  ↷ Trop court : ${titre}`); continue; }

        let resume = '';
        try { resume = await getResume(titre); await sleep(200); } catch {}
        if (!resume) resume = contenu.slice(0, 400) + '…';

        const id = await inserer({
          titre, genre: detecterGenre(titre, categories),
          resume, langue_originale: 'fr',
          statut: 'gratuit', prix: 0, public_cible: 'tous',
          hash_sha256: sha256(contenu), visible: true,
          auteur_id: AUTEUR_SYSTEME_ID,
        }, contenu.slice(0, 500_000));

        total++;
        console.log(`  ✓ "${titre}" (${(contenu.length / 1000).toFixed(0)} Ko) → ${id}`);
      } catch (e) {
        erreurs++;
        console.error(`  ✗ "${titre}" : ${e.message}`);
      }
    }
  }

  console.log(`\n=== Terminé : ${total} importées, ${erreurs} erreurs ===`);
}

main().catch(e => { console.error('Erreur fatale :', e); process.exit(1); });
