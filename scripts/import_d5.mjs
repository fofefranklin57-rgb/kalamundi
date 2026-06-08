// node scripts/import_d5.mjs
// Enrichissement bibliothèque — Gallica BnF (API search JSON)
// Exécuter depuis C:\kalamundi\ : node scripts/import_d5.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_KEY = 'sb_secret_ighJK-990TP2_9gCC7TmUw_rm9N2cDi';
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTEUR_SYSTEME_ID = 'cd117018-5e89-4d2c-96d6-4f1a6be4a236';
const MAX_OEUVRES       = 30;
const DELAI_MS          = 800;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sha256(t) { return crypto.createHash('sha256').update(t, 'utf8').digest('hex'); }

function detecterGenre(titre, desc = '') {
  const s = (titre + ' ' + desc).toLowerCase();
  if (s.match(/poésie|poème|vers\b/))           return 'poesie';
  if (s.match(/théâtre|drame|comédie|tragédie/)) return 'theatre';
  if (s.match(/conte|fable|nouvelle\b/))          return 'conte';
  if (s.match(/essai|discours|mémoir/))           return 'essai';
  if (s.match(/roman\b/))                         return 'roman';
  return 'roman';
}

/* API Gallica search JSON (plus fiable que SRU) */
async function searchGallica(query, start = 1, nb = 15) {
  const p = new URLSearchParams({
    query,
    lang:     'fr',
    source:   'gallica',
    suggest:  '0',
    res:      String(nb),
    startRecord: String(start),
    output:   'json',
  });
  const url = `https://gallica.bnf.fr/services/engine/search/sru?${p}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KalamudiBot/1.0' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTexteGallica(ark) {
  const url = `https://gallica.bnf.fr/ark:/12148/${ark}/texteBrut`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'KalamudiBot/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return null;
  const ct  = res.headers.get('content-type') ?? '';
  const txt = await res.text();
  if (txt.length < 300) return null;
  if (ct.includes('html') || txt.trimStart().startsWith('<')) {
    const propre = txt
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ').trim();
    return propre.length > 300 ? propre : null;
  }
  return txt.length > 300 ? txt : null;
}

async function assureCompteSysteme() {
  await supabase.from('profiles').upsert({
    id: AUTEUR_SYSTEME_ID, nom: 'Bibliothèque Kalamundi',
    email: 'bibliotheque@kalamundi.com', role: 'auteur', langue_preferee: 'fr',
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
  if (ec) { await supabase.from('oeuvres').delete().eq('id', o.id); throw new Error(ec.message); }
  return o.id;
}

const REQUETES = [
  'dc.type all "monographie" and dc.language all "fre" and dc.subject all "roman"',
  'dc.type all "monographie" and dc.language all "fre" and dc.subject all "conte"',
  'dc.type all "monographie" and dc.language all "fre" and dc.subject all "poésie"',
  'dc.type all "monographie" and dc.language all "fre" and dc.subject all "théâtre"',
];

async function main() {
  console.log('=== Import D5 — Gallica BnF ===');
  await assureCompteSysteme();

  let total = 0, erreurs = 0;

  for (const query of REQUETES) {
    if (total >= MAX_OEUVRES) break;
    console.log(`\nRequête : ${query.split('subject all')[1] || query}`);

    let records;
    try {
      const data = await searchGallica(query, 1, 15);
      records = data?.records?.record ?? [];
      console.log(`  ${records.length} résultats`);
    } catch (e) {
      console.error(`  ✗ ${e.message}`);
      continue;
    }

    for (const rec of records) {
      if (total >= MAX_OEUVRES) break;
      await sleep(DELAI_MS);

      // Extraire ARK et métadonnées
      const ark = rec.header?.identifier?.replace('oai:gallica.bnf.fr:', '') ?? '';
      if (!ark) continue;

      const dcFields = rec.metadata?.['oai_dc:dc'] ?? {};
      const titre = [dcFields['dc:title']].flat()[0]?.trim().slice(0, 200) ?? '';
      if (!titre || titre.length < 3) continue;

      const auteur = [dcFields['dc:creator']].flat()[0] ?? 'Auteur inconnu';
      const desc   = [dcFields['dc:description']].flat()[0] ?? '';

      try {
        if (await doublonExiste(titre)) { console.log(`  ↷ Doublon : ${titre}`); continue; }

        const texte = await fetchTexteGallica(ark);
        if (!texte || texte.length < 300) {
          console.log(`  ↷ Texte indisponible : ${titre.slice(0, 50)}`);
          continue;
        }

        const contenu = texte.slice(0, 500_000);
        const resume  = (desc || contenu).slice(0, 1000);
        const id = await inserer({
          titre, genre: detecterGenre(titre, desc),
          resume: resume.slice(0, 1000),
          langue_originale: 'fr', statut: 'gratuit', prix: 0,
          public_cible: 'tous',
          couverture_url: `https://gallica.bnf.fr/ark:/12148/${ark}/thumbnail`,
          hash_sha256: sha256(contenu), visible: true,
          auteur_id: AUTEUR_SYSTEME_ID,
        }, contenu);

        total++;
        console.log(`  ✓ "${titre.slice(0, 60)}" par ${auteur} (${(contenu.length/1000).toFixed(0)} Ko) → ${id}`);
      } catch (e) {
        erreurs++;
        console.error(`  ✗ "${titre.slice(0, 50)}" : ${e.message}`);
      }
    }
  }

  console.log(`\n=== Terminé : ${total} importées, ${erreurs} erreurs ===`);
}

main().catch(e => { console.error('Erreur fatale :', e); process.exit(1); });
