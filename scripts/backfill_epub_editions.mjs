#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { construireEpub } from './build_epub.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iobieffnaauecyukecds.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_KEY;

const args = new Set(process.argv.slice(2));
const getArg = (nom, defaut = null) => {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : defaut;
};

const APPLY = args.has('--apply');
const LIMIT = Number(getArg('--limit', '20'));
const OEUVRE_ID = getArg('--id');

if (!SERVICE_KEY) {
  throw new Error('Clé service Supabase manquante : définis SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function chargerOeuvres() {
  let query = supabase
    .from('oeuvres')
    .select('id, auteur_id, titre, resume, langue_originale, statut, prix, chapitres_gratuits, couverture_url, public_cible, visible, hash_sha256, created_at, updated_at')
    .eq('visible', true)
    .order('created_at', { ascending: false })
    .limit(LIMIT);
  if (OEUVRE_ID) query = query.eq('id', OEUVRE_ID).limit(1);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function chargerChapitres(oeuvreId) {
  const { data, error } = await supabase
    .from('chapitres')
    .select('id, numero, titre, contenu_texte, chapitre_id, source_hash, type_element, visible, date_publication')
    .eq('oeuvre_id', oeuvreId)
    .eq('visible', true)
    .order('numero');
  if (error) throw error;
  return (data || []).map((ch, index) => ({
    id: ch.id,
    numero: Number(ch.numero || index + 1),
    titre: ch.titre || `Chapitre ${index + 1}`,
    contenu: ch.contenu_texte || '',
    chapitre_id: ch.chapitre_id || `ch-${String(ch.numero || index + 1).padStart(3, '0')}-${String(ch.id).slice(0, 8)}`,
    source_hash: ch.source_hash || null,
    type_element: ch.type_element || 'chapitre',
  })).filter(ch => ch.contenu.trim());
}

async function upsertLivreEtEdition(oeuvre, chapitres, epubPath) {
  const { data: livre, error: livreError } = await supabase
    .from('livres')
    .upsert({
      oeuvre_id: oeuvre.id,
      auteur_id: oeuvre.auteur_id,
      titre: oeuvre.titre,
      description: oeuvre.resume || null,
      langue_originale: oeuvre.langue_originale || 'fr',
      couverture_url: oeuvre.couverture_url || null,
      public_cible: oeuvre.public_cible || 'tous',
      statut: 'actif',
      type_catalogue: 'auto_edition',
      metadata: {
        source: 'backfill_epub',
        hash_sha256: oeuvre.hash_sha256 || null,
      },
    }, { onConflict: 'oeuvre_id' })
    .select()
    .single();
  if (livreError) throw livreError;

  const editionPayloads = [
    {
      livre_id: livre.id,
      source_oeuvre_id: oeuvre.id,
      format: 'chapitres',
      statut: 'active',
      version: '1.0',
      nb_chapitres: chapitres.length,
      metadata: { generated_by: 'backfill_epub_editions' },
    },
    {
      livre_id: livre.id,
      source_oeuvre_id: oeuvre.id,
      format: 'epub',
      statut: 'active',
      version: '1.0',
      fichier_url: epubPath,
      epub_url: epubPath,
      nb_chapitres: chapitres.length,
      metadata: { generated_by: 'backfill_epub_editions', canonical: true },
    },
  ];

  const { error: editionsError } = await supabase
    .from('livre_editions')
    .upsert(editionPayloads, { onConflict: 'livre_id,format,source_oeuvre_id' });
  if (editionsError) throw editionsError;

  const typeOffre = oeuvre.statut === 'premium' ? 'achat_numerique' : 'lecture_gratuite';
  const { error: offreError } = await supabase
    .from('livre_offres')
    .upsert({
      livre_id: livre.id,
      source_oeuvre_id: oeuvre.id,
      vendeur_id: oeuvre.auteur_id,
      type: typeOffre,
      statut: 'active',
      prix: oeuvre.statut === 'premium' ? Number(oeuvre.prix || 0) : 0,
      devise: 'XAF',
      fapshi_enabled: oeuvre.statut === 'premium',
      chapitres_gratuits: Number(oeuvre.chapitres_gratuits || 0),
      royalties_auteur_pct: oeuvre.statut === 'premium' ? 50 : 0,
      royalties_plateforme_pct: oeuvre.statut === 'premium' ? 50 : 0,
      ordre: oeuvre.statut === 'premium' ? 20 : 10,
    }, { onConflict: 'source_oeuvre_id,type' });
  if (offreError) throw offreError;
}

async function traiterOeuvre(oeuvre) {
  const chapitres = await chargerChapitres(oeuvre.id);
  if (!chapitres.length) return { statut: 'ignore', raison: 'aucun chapitre lisible' };

  const epub = construireEpub({
    titre: oeuvre.titre,
    auteur: 'Kalamundi',
    langue_originale: oeuvre.langue_originale || 'fr',
    format_source: 'chapitres',
    chapitres,
  });
  const chemin = `oeuvres/${oeuvre.id}/canonique.epub`;

  if (!APPLY) {
    return { statut: 'dry-run', chapitres: chapitres.length, chemin, taille: epub.length };
  }

  const { error: uploadError } = await supabase.storage
    .from('oeuvres-privees')
    .upload(chemin, epub, { upsert: true, contentType: 'application/epub+zip' });
  if (uploadError) throw uploadError;

  await upsertLivreEtEdition(oeuvre, chapitres, chemin);
  return { statut: 'ok', chapitres: chapitres.length, chemin, taille: epub.length };
}

async function main() {
  console.log('Backfill EPUB canonique Kalamundi');
  console.log(APPLY ? 'Mode écriture : upload + DB' : 'Mode test : aucune modification');
  const oeuvres = await chargerOeuvres();
  const stats = { ok: 0, 'dry-run': 0, ignore: 0, erreur: 0 };

  for (const oeuvre of oeuvres) {
    try {
      const res = await traiterOeuvre(oeuvre);
      stats[res.statut] = (stats[res.statut] || 0) + 1;
      console.log(`- ${oeuvre.titre} : ${res.statut}${res.raison ? ` (${res.raison})` : ` — ${res.chapitres} chapitre(s), ${res.chemin}`}`);
    } catch (err) {
      stats.erreur++;
      console.error(`- ${oeuvre.titre} : erreur (${err.message})`);
    }
  }

  console.log('\nRésumé');
  console.log(`  Générées : ${stats.ok}`);
  console.log(`  À générer en test : ${stats['dry-run']}`);
  console.log(`  Ignorées : ${stats.ignore}`);
  console.log(`  Erreurs : ${stats.erreur}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
