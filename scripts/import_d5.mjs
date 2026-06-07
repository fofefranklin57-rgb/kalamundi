// node scripts/import_d5.mjs
// Enrichissement bibliothèque — Gallica BnF (API SRU)
// Cible : monographies francophones du domaine public
// Exécuter depuis C:\kalamundi\ : node scripts/import_d5.mjs

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_KEY = 'sb_secret_ighJK-990TP2_9gCC7TmUw_rm9N2cDi';
const supabase     = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTEUR_SYSTEME_ID = '00000000-0000-0000-0000-000000000001';
const GALLICA_SRU       = 'https://gallica.bnf.fr/SRU';
const MAX_OEUVRES       = 30;
const DELAI_MS          = 600;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sha256(t) { return crypto.createHash('sha256').update(t, 'utf8').digest('hex'); }

function xmlTag(xml, tag) {
  const re = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^:>]+:)?${tag}>`, 'i');
  return (xml.match(re)?.[1] ?? '').replace(/<[^>]+>/g, '').trim();
}

function xmlTags(xml, tag) {
  const re = new RegExp(`<(?:[^:>]+:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^:>]+:)?${tag}>`, 'gi');
  const r = []; let m;
  while ((m = re.exec(xml))) r.push(m[1].replace(/<[^>]+>/g, '').trim());
  return r;
}

function extractArk(xml) {
  const ids = xmlTags(xml, 'identifier');
  for (const id of ids) {
    const m = id.match(/ark:\/12148\/([\w]+)/);
    if (m) return m[1];
  }
  return xml.match(/gallica\.bnf\.fr\/ark:\/12148\/([\w]+)/)?.[1] ?? null;
}

function detecterGenre(titre, desc = '') {
  const s = (titre + ' ' + desc).toLowerCase();
  if (s.match(/poésie|poème|vers\b/))         return 'poesie';
  if (s.match(/théâtre|drame|comédie|tragédi/)) return 'theatre';
  if (s.match(/conte|fable|nouvelle\b/))        return 'conte';
  if (s.match(/essai|discours|mémoir/))         return 'essai';
  if (s.match(/roman\b/))                       return 'roman';
  return 'roman';
}

async function fetchSRU(start = 1, max = 20) {
  const q = 'dc.language = "fre" and dc.type = "monographie"';
  const p = new URLSearchParams({
    operation: 'searchRetrieve', version: '1.2',
    query: q, recordSchema: 'dc',
    maximumRecords: String(max), startRecord: String(start),
  });
  const res = await fetch(`${GALLICA_SRU}?${p}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`SRU HTTP ${res.status}`);
  return res.text();
}

async function fetchTexte(ark) {
  const url = `https://gallica.bnf.fr/ark:/12148/${ark}/texteBrut`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return null;
  const ct  = res.headers.get('content-type') ?? '';
  const txt = await res.text();
  if (txt.length < 300) return null;
  // Si HTML → extraire le texte brut
  if (ct.includes('html') || txt.trimStart().startsWith('<')) {
    return txt
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ').trim();
  }
  return txt;
}

function parseRecords(xml) {
  const re = /<recordData[^>]*>([\s\S]*?)<\/recordData>/gi;
  const records = []; let m;
  while ((m = re.exec(xml))) {
    const r    = m[1];
    const titre = xmlTag(r, 'title');
    const ark   = extractArk(r);
    if (!titre || !ark) continue;
    records.push({
      titre,
      auteur:      xmlTags(r, 'creator').join(', ') || 'Auteur inconnu',
      description: xmlTag(r, 'description'),
      ark,
    });
  }
  return records;
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
  console.log('=== Import D5 — Gallica BnF ===');
  await assureCompteSysteme();

  let total = 0, erreurs = 0, start = 1;

  while (total < MAX_OEUVRES) {
    console.log(`\nRequête SRU start=${start}…`);
    let xml;
    try { xml = await fetchSRU(start, 20); }
    catch (e) { console.error(`  ✗ SRU : ${e.message}`); break; }

    const records = parseRecords(xml);
    if (!records.length) { console.log('  Fin des résultats SRU.'); break; }
    console.log(`  ${records.length} records`);

    for (const rec of records) {
      if (total >= MAX_OEUVRES) break;
      await sleep(DELAI_MS);

      const titre = rec.titre.slice(0, 200);
      try {
        if (await doublonExiste(titre)) { console.log(`  ↷ Doublon : ${titre}`); continue; }

        const texte = await fetchTexte(rec.ark);
        if (!texte || texte.length < 300) {
          console.log(`  ↷ Texte indisponible : ${titre} (ARK: ${rec.ark})`);
          continue;
        }

        const contenu = texte.slice(0, 500_000);
        const resume  = rec.description || contenu.slice(0, 400) + '…';
        const id = await inserer({
          titre, genre: detecterGenre(titre, rec.description),
          resume: resume.slice(0, 1000),
          langue_originale: 'fr', statut: 'gratuit', prix: 0,
          public_cible: 'tous',
          couverture_url: `https://gallica.bnf.fr/ark:/12148/${rec.ark}/thumbnail`,
          hash_sha256: sha256(contenu), visible: true,
          auteur_id: AUTEUR_SYSTEME_ID,
        }, contenu);

        total++;
        console.log(`  ✓ "${titre}" par ${rec.auteur} (${(contenu.length / 1000).toFixed(0)} Ko) → ${id}`);
      } catch (e) {
        erreurs++;
        console.error(`  ✗ "${titre}" : ${e.message}`);
      }
    }

    start += 20;
    await sleep(1000);
  }

  console.log(`\n=== Terminé : ${total} importées, ${erreurs} erreurs ===`);
}

main().catch(e => { console.error('Erreur fatale :', e); process.exit(1); });
