// node scripts/import_d7.mjs
// Enrichissement bibliothèque — Internet Archive
// API : https://archive.org/advancedsearch.php
// Cible : œuvres domaine public, texte disponible, langues africaines + FR/EN

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const SUPABASE_URL = 'https://iobieffnaauecyukecds.supabase.co';
const SUPABASE_KEY = 'sb_secret_ighJK-990TP2_9gCC7TmUw_rm9N2cDi';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const AUTEUR_SYSTEME_ID = 'cd117018-5e89-4d2c-96d6-4f1a6be4a236';
const MAX_OEUVRES = 30;
const DELAI_MS    = 600;

/* ── Mapping genre Archive → Kalamundi ─────────────────── */
const GENRE_MAP = {
  'fiction':       'roman',
  'novel':         'roman',
  'poetry':        'poesie',
  'poem':          'poesie',
  'short story':   'nouvelle',
  'essay':         'essai',
  'autobiography': 'autobiographie',
  'biography':     'autobiographie',
  'drama':         'roman',
  'tale':          'conte',
};

function mapGenre(subjects = []) {
  const s = subjects.join(' ').toLowerCase();
  for (const [k, v] of Object.entries(GENRE_MAP)) {
    if (s.includes(k)) return v;
  }
  return 'roman';
}

function mapLangue(lang = '') {
  const l = lang.toLowerCase();
  if (l.includes('fre') || l === 'fr') return 'fr';
  if (l.includes('eng') || l === 'en') return 'en';
  if (l.includes('ara') || l === 'ar') return 'ar';
  if (l.includes('swa'))               return 'sw';
  if (l.includes('hau'))               return 'ha';
  if (l.includes('yor'))               return 'yo';
  if (l.includes('ibo') || l.includes('igb')) return 'ig';
  if (l.includes('lin'))               return 'ln';
  if (l.includes('wol'))               return 'wo';
  if (l.includes('bam'))               return 'bm';
  if (l.includes('por') || l === 'pt') return 'pt';
  if (l.includes('spa') || l === 'es') return 'es';
  return 'en';
}

function sha256(texte) {
  return crypto.createHash('sha256').update(texte, 'utf8').digest('hex');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function assureCompteSysteme() {
  await supabase.from('profiles').upsert({
    id:    AUTEUR_SYSTEME_ID,
    nom:   'Bibliothèque Kalamundi',
    email: 'bibliotheque@kalamundi.com',
    role:  'auteur',
    langue_preferee: 'fr',
  }, { onConflict: 'id', ignoreDuplicates: true });
}

async function doublonExiste(titre) {
  const { data } = await supabase
    .from('oeuvres')
    .select('id')
    .eq('auteur_id', AUTEUR_SYSTEME_ID)
    .ilike('titre', titre.trim())
    .limit(1);
  return data?.length > 0;
}

/* ── Récupérer le texte brut depuis Archive.org ─────────── */
async function fetchTexte(identifier) {
  try {
    // Chercher les fichiers texte disponibles
    const metaRes = await fetch(`https://archive.org/metadata/${identifier}/files`);
    if (!metaRes.ok) return null;
    const meta = await metaRes.json();

    // Préférer DjVuTXT, puis txt, puis _abbyy.gz ignoré
    const fichiers = (meta?.result || []);
    const txt = fichiers.find(f =>
      f.name?.endsWith('_djvu.txt') ||
      (f.name?.endsWith('.txt') && !f.name?.includes('_meta'))
    );
    if (!txt) return null;

    const url = `https://archive.org/download/${identifier}/${txt.name}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const texte = await res.text();
    // Tronquer à 500 Ko pour ne pas surcharger Supabase
    return texte.length > 500_000 ? texte.slice(0, 500_000) + '\n\n[Texte tronqué]' : texte;
  } catch {
    return null;
  }
}

/* ── Requête principale ─────────────────────────────────── */
async function chercherOeuvres(langue, sujet = 'roman', start = 0) {
  const langCode = langue === 'fr' ? 'fre' : langue === 'ar' ? 'ara' : langue === 'sw' ? 'swa' : 'eng';
  const q = [
    `language:${langCode}`,
    'mediatype:texts',
    `subject:${sujet}`,
    '-subject:magazine -subject:journal -subject:newspaper -subject:periodical',
  ].join(' AND ');

  const url = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl=identifier,title,creator,description,subject,language,date&rows=15&start=${start}&output=json`;
  const res = await fetch(url, { headers: { 'User-Agent': 'KalamudiLibrary/1.0' }, signal: AbortSignal.timeout(15_000) });
  if (!res.ok) return [];
  const data = await res.json();
  return data?.response?.docs || [];
}

/* ── Import d'une œuvre ─────────────────────────────────── */
async function importerOeuvre(doc) {
  const titre = (doc.title || '').trim();
  if (!titre || titre.length < 3) return false;

  if (await doublonExiste(titre)) {
    console.log(`  ↷ Doublon ignoré : ${titre}`);
    return false;
  }

  const texte = await fetchTexte(doc.identifier);
  if (!texte || texte.length < 500) {
    console.log(`  ✗ Texte indisponible : ${titre}`);
    return false;
  }

  const langue = mapLangue(Array.isArray(doc.language) ? doc.language[0] : doc.language);
  const genre  = mapGenre(Array.isArray(doc.subject) ? doc.subject : [doc.subject || '']);
  const auteur = Array.isArray(doc.creator) ? doc.creator[0] : (doc.creator || 'Auteur inconnu');
  const resume = (Array.isArray(doc.description) ? doc.description[0] : doc.description || '').slice(0, 1000);

  const { data: oeuvre, error } = await supabase.from('oeuvres').insert({
    auteur_id:        AUTEUR_SYSTEME_ID,
    titre,
    genre,
    resume:           resume || `Œuvre de ${auteur} — domaine public via Internet Archive.`,
    langue_originale: langue,
    statut:           'gratuit',
    prix:             0,
    public_cible:     'tous',
    hash_sha256:      sha256(texte),
    visible:          true,
  }).select('id').single();

  if (error) {
    console.error(`  ✗ Erreur INSERT oeuvre "${titre}" :`, error.message);
    return false;
  }

  const { error: errCh } = await supabase.from('chapitres').insert({
    oeuvre_id:     oeuvre.id,
    numero:        1,
    titre:         `${titre} — texte complet`,
    contenu_texte: texte,
    type_element:  'chapitre',
  });

  if (errCh) {
    console.error(`  ✗ Erreur INSERT chapitre "${titre}" :`, errCh.message);
    await supabase.from('oeuvres').delete().eq('id', oeuvre.id);
    return false;
  }

  console.log(`  ✓ Importé : "${titre}" (${langue}) [${(texte.length / 1000).toFixed(0)} Ko]`);
  return true;
}

/* ── Point d'entrée ─────────────────────────────────────── */
async function main() {
  console.log('=== Import D7 — Internet Archive ===');
  await assureCompteSysteme();

  let total = 0;
  const requetes = [
    { langue: 'fr', sujet: 'roman' },
    { langue: 'fr', sujet: 'conte' },
    { langue: 'fr', sujet: 'poésie' },
    { langue: 'en', sujet: 'novel' },
    { langue: 'ar', sujet: 'literature' },
    { langue: 'sw', sujet: 'literature' },
  ];

  for (const { langue, sujet } of requetes) {
    if (total >= MAX_OEUVRES) break;
    console.log(`\n--- ${langue} / sujet:${sujet} ---`);
    const docs = await chercherOeuvres(langue, sujet);
    console.log(`  ${docs.length} résultats`);

    for (const doc of docs) {
      if (total >= MAX_OEUVRES) break;
      const ok = await importerOeuvre(doc);
      if (ok) total++;
      await sleep(DELAI_MS);
    }
  }

  console.log(`\n=== Terminé : ${total} œuvres importées depuis Internet Archive ===`);
}

main().catch(err => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
