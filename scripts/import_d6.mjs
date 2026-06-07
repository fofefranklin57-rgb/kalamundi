// node scripts/import_d6.mjs
// Enrichissement bibliothèque — DOAB (Directory of Open Access Books)
// Cible : livres CC francophones / anglophones / arabes
// Exécuter depuis C:\kalamundi\ : node scripts/import_d6.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_KEY = 'sb_secret_ighJK-990TP2_9gCC7TmUw_rm9N2cDi';
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTEUR_SYSTEME_ID = '00000000-0000-0000-0000-000000000001';
const DOAB_API          = 'https://directory.doabooks.org/rest/search';
const MAX_OEUVRES       = 30;
const DELAI_MS          = 600;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sha256(t) { return crypto.createHash('sha256').update(t, 'utf8').digest('hex'); }

function dcGet(meta, key) {
  if (!Array.isArray(meta)) return '';
  for (const m of meta) {
    if (m.key !== key) continue;
    if (Array.isArray(m.values) && m.values.length) return m.values[0];
    if (m.value) return m.value;
  }
  return '';
}

function dcGetAll(meta, key) {
  if (!Array.isArray(meta)) return [];
  for (const m of meta) {
    if (m.key !== key) continue;
    if (Array.isArray(m.values)) return m.values;
    if (m.value) return [m.value];
  }
  return [];
}

function estLicenceCC(meta) {
  const champs = ['dc.rights', 'dc.rights.license', 'dc.rights.uri'];
  const tout   = champs.flatMap(k => dcGetAll(meta, k)).join(' ').toLowerCase();
  return tout.includes('creative') || tout.includes('cc-by') || tout.includes('cc0') || tout.includes('creativecommons');
}

function mapLangue(meta) {
  const l = (dcGet(meta, 'dc.language') || dcGet(meta, 'dc.language.iso') || 'en').toLowerCase();
  if (l.match(/^fr|french|français/))   return 'fr';
  if (l.match(/^ar|arabic|arabe/))      return 'ar';
  if (l.match(/^pt|portug/))            return 'pt';
  if (l.match(/^es|spanish|espagnol/))  return 'es';
  if (l.match(/^sw|swahili/))           return 'sw';
  return 'en';
}

function detecterGenre(titre, desc = '') {
  const s = (titre + ' ' + desc).toLowerCase();
  if (s.match(/poésie|poème|poetry|poem/))       return 'poesie';
  if (s.match(/roman|novel|fiction/))             return 'roman';
  if (s.match(/conte|fable|tale|nouvelle\b/))     return 'conte';
  if (s.match(/essai|essay/))                     return 'essai';
  if (s.match(/philosophi/))                      return 'philosophie';
  if (s.match(/autobio|memoir/))                  return 'autobiographie';
  return 'essai';
}

async function searchDOAB(langue, start = 0, rows = 30) {
  const langLabel = { fr: 'French', en: 'English', ar: 'Arabic', pt: 'Portuguese' }[langue] ?? 'English';
  const p = new URLSearchParams({
    query: `language:${langLabel}`,
    expand: 'metadata', rows: String(rows), start: String(start),
  });
  const res = await fetch(`${DOAB_API}?${p}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'KalamudiLibrary/1.0' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
    .eq('auteur_id', AUTEUR_SYSTEME_ID).ilike('titre', titre).limit(1);
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

async function main() {
  console.log('=== Import D6 — DOAB (Open Access Books) ===');
  await assureCompteSysteme();

  let total = 0, erreurs = 0;
  const langues = ['fr', 'en', 'ar', 'pt'];

  for (const langue of langues) {
    if (total >= MAX_OEUVRES) break;
    console.log(`\n--- Langue : ${langue} ---`);

    let livres;
    try {
      const raw = await searchDOAB(langue, 0, 40);
      livres = Array.isArray(raw) ? raw : (raw?.response?.docs ?? []);
    } catch (e) {
      console.error(`  ✗ API DOAB : ${e.message}`);
      continue;
    }
    console.log(`  ${livres.length} livres reçus`);

    for (const livre of livres) {
      if (total >= MAX_OEUVRES) break;
      await sleep(DELAI_MS);

      const meta   = livre.metadata ?? [];
      if (!estLicenceCC(meta)) continue;

      const titre  = (dcGet(meta, 'dc.title') || livre.name || '').slice(0, 200).trim();
      if (!titre)  continue;

      const auteur  = dcGetAll(meta, 'dc.contributor.author').join(', ')
                   || dcGet(meta, 'dc.creator') || 'Auteur inconnu';
      const desc    = dcGet(meta, 'dc.description.abstract') || dcGet(meta, 'dc.description') || '';
      const editeur = dcGet(meta, 'dc.publisher') || '';
      const handle  = dcGet(meta, 'dc.identifier.uri') || '';
      const droits  = dcGet(meta, 'dc.rights.license') || dcGet(meta, 'dc.rights') || 'CC';
      const langue2 = mapLangue(meta);

      try {
        if (await doublonExiste(titre)) { console.log(`  ↷ Doublon : ${titre}`); continue; }

        // Contenu = résumé enrichi + lien (on ne parse pas les PDF)
        const contenu = [
          titre,
          auteur !== 'Auteur inconnu' ? `Par ${auteur}` : '',
          editeur ? `Éditeur : ${editeur}` : '',
          `Licence : ${droits}`,
          '',
          desc || 'Résumé non disponible.',
          '',
          handle ? `Accès libre (PDF) : ${handle}` : '',
          'Source : OAPEN / DOAB — Directory of Open Access Books',
        ].filter(Boolean).join('\n');

        const resume = (desc || contenu).slice(0, 1000);
        const id = await inserer({
          titre, genre: detecterGenre(titre, desc),
          resume, langue_originale: langue2,
          statut: 'gratuit', prix: 0, public_cible: 'tous',
          hash_sha256: sha256(contenu), visible: true,
          auteur_id: AUTEUR_SYSTEME_ID,
        }, contenu);

        total++;
        console.log(`  ✓ "${titre.slice(0, 60)}" (${langue2}) → ${id}`);
      } catch (e) {
        erreurs++;
        console.error(`  ✗ "${titre}" : ${e.message}`);
      }
    }
  }

  console.log(`\n=== Terminé : ${total} importées, ${erreurs} erreurs ===`);
}

main().catch(e => { console.error('Erreur fatale :', e); process.exit(1); });
