// node scripts/import_d9.mjs
// Enrichissement bibliothèque — OpenAlex (métadonnées livres académiques open access)
// API : https://api.openalex.org — gratuite, pas de clé requise
// Exécuter depuis C:\kalamundi\ : node scripts/import_d9.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_KEY;
if (!SUPABASE_KEY) throw new Error('SUPABASE_SERVICE_KEY manquant dans l environnement.');
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTEUR_SYSTEME_ID = 'cd117018-5e89-4d2c-96d6-4f1a6be4a236';
const OPENALEX_API      = 'https://api.openalex.org';
const MAX_OEUVRES       = 40;
const DELAI_MS          = 400;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sha256(t) { return crypto.createHash('sha256').update(t, 'utf8').digest('hex'); }

function mapLangue(lang = '') {
  const l = (lang || '').toLowerCase();
  if (l === 'fr') return 'fr';
  if (l === 'ar') return 'ar';
  if (l === 'pt') return 'pt';
  if (l === 'es') return 'es';
  if (l === 'sw') return 'sw';
  if (l === 'ha') return 'ha';
  if (l === 'yo') return 'yo';
  return 'en';
}

function mapGenre(topics = [], titre = '') {
  const s = (topics.map(t => t.display_name || '').join(' ') + ' ' + titre).toLowerCase();
  if (s.match(/littéra|roman|fiction|novel|poésie|poem/))   return 'roman';
  if (s.match(/philosophi/))                                  return 'philosophie';
  if (s.match(/autobio|memoir/))                              return 'autobiographie';
  if (s.match(/essai|essay|political|économi/))               return 'essai';
  if (s.match(/histoire|histor/))                             return 'essai';
  return 'essai';
}

async function assureCompteSysteme() {
  await supabase.from('profiles').upsert({
    id: AUTEUR_SYSTEME_ID,
    nom: 'Bibliothèque Kalamundi',
    email: 'bibliotheque@kalamundi.com',
    role: 'auteur', langue_preferee: 'fr',
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
    oeuvre_id: o.id, numero: 1, titre: 'Présentation',
    contenu_texte: contenu, type_element: 'introduction',
  });
  if (ec) {
    await supabase.from('oeuvres').delete().eq('id', o.id);
    throw new Error(ec.message);
  }
  return o.id;
}

async function searchOpenAlex(langue, cursor = '*') {
  const filter = [
    'type:book',
    'is_oa:true',
    `language:${langue}`,
  ].join(',');

  const p = new URLSearchParams({
    filter,
    'per-page': '25',
    cursor,
    select: 'id,title,authorships,abstract_inverted_index,language,topics,best_oa_location,publication_year',
    'mailto': 'bibliotheque@kalamundi.com',
  });

  const res = await fetch(`${OPENALEX_API}/works?${p}`, {
    headers: { 'User-Agent': 'KalamudiBot/1.0 (bibliotheque@kalamundi.com)' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function reconstructAbstract(inverted) {
  // OpenAlex encode l'abstract en index inversé : {mot: [positions]}
  if (!inverted) return '';
  const mots = [];
  for (const [mot, positions] of Object.entries(inverted)) {
    for (const pos of positions) mots[pos] = mot;
  }
  return mots.filter(Boolean).join(' ');
}

async function main() {
  console.log('=== Import D9 — OpenAlex (Open Access Books) ===');
  await assureCompteSysteme();

  let total = 0, erreurs = 0;
  const langues = ['fr', 'en', 'ar', 'pt'];

  for (const langue of langues) {
    if (total >= MAX_OEUVRES) break;
    console.log(`\n--- Langue : ${langue} ---`);

    let cursor = '*';
    let page   = 0;

    while (total < MAX_OEUVRES && page < 4) {
      let data;
      try {
        data = await searchOpenAlex(langue, cursor);
      } catch (e) {
        console.error(`  ✗ API : ${e.message}`);
        break;
      }

      const results = data?.results ?? [];
      cursor = data?.meta?.next_cursor;
      page++;

      if (!results.length) { console.log('  Fin des résultats.'); break; }
      console.log(`  Page ${page} : ${results.length} résultats`);

      for (const work of results) {
        if (total >= MAX_OEUVRES) break;
        await sleep(DELAI_MS);

        const titre = (work.title || '').trim().slice(0, 200);
        if (!titre || titre.length < 5) continue;

        const auteurs = (work.authorships || [])
          .map(a => a.author?.display_name).filter(Boolean).join(', ') || 'Auteur inconnu';

        const abstract = reconstructAbstract(work.abstract_inverted_index);
        const lienOA   = work.best_oa_location?.pdf_url || work.best_oa_location?.landing_page_url || '';
        const annee    = work.publication_year || '';

        const contenu = [
          titre,
          auteurs !== 'Auteur inconnu' ? `Par ${auteurs}` : '',
          annee ? `Année : ${annee}` : '',
          lienOA ? `Accès libre : ${lienOA}` : '',
          '',
          abstract || 'Résumé non disponible.',
          '',
          'Source : OpenAlex — Open Access scholarly works.',
        ].filter(Boolean).join('\n');

        if (contenu.length < 80) continue;

        try {
          if (await doublonExiste(titre)) { console.log(`  ↷ Doublon : ${titre.slice(0, 50)}`); continue; }

          const resume = (abstract || contenu).slice(0, 1000);
          const id = await inserer({
            titre,
            genre: mapGenre(work.topics || [], titre),
            resume,
            langue_originale: mapLangue(work.language),
            statut: 'gratuit', prix: 0, public_cible: 'tous',
            hash_sha256: sha256(contenu), visible: true,
            auteur_id: AUTEUR_SYSTEME_ID,
          }, contenu);

          total++;
          console.log(`  ✓ "${titre.slice(0, 60)}" (${work.language}) → ${id}`);
        } catch (e) {
          erreurs++;
          console.error(`  ✗ "${titre.slice(0, 50)}" : ${e.message}`);
        }
      }

      if (!cursor) break;
    }
  }

  console.log(`\n=== Terminé : ${total} importées, ${erreurs} erreurs ===`);
}

main().catch(e => { console.error('Erreur fatale :', e); process.exit(1); });
