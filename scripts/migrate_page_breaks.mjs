/**
 * migrate_page_breaks.mjs
 * ──────────────────────────────────────────────────────────────
 * Re-traite tous les PDFs déjà en base pour ajouter les marqueurs
 * ---PAGE--- dans le contenu des chapitres.
 *
 * Exécution :
 *   node scripts/migrate_page_breaks.mjs
 *
 * Options :
 *   --dry-run   Affiche ce qui serait fait, sans écrire en base
 *   --id <uuid> Traite une seule oeuvre (pour tester)
 * ──────────────────────────────────────────────────────────────
 */

import { createClient } from '@supabase/supabase-js';
import * as pdfjsLib    from 'pdfjs-dist/legacy/build/pdf.mjs';

/* ── Config ───────────────────────────────────────────────── */
const SUPABASE_URL      = 'https://iobieffnaauecyukecds.supabase.co';
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_KEY;
if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_KEY manquant dans l environnement.');
const BUCKET            = 'oeuvres-privees';

const DRY_RUN  = process.argv.includes('--dry-run');
const ID_SEUL  = process.argv.includes('--id')
  ? process.argv[process.argv.indexOf('--id') + 1]
  : null;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/* ── Extraction PDF avec marqueurs de pages ───────────────── */
async function extrairePdfAvecPages(buffer) {
  const data = new Uint8Array(buffer);
  const pdf  = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;

  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Reconstituer le texte en préservant les sauts de ligne internes (Y-axis)
    let lignes = '';
    let lastY  = null;
    for (const item of content.items) {
      if (!item.str) continue;
      if (lastY !== null && Math.abs(item.transform[5] - lastY) > 5) {
        lignes += '\n';
      }
      lignes += item.str;
      lastY = item.transform[5];
    }
    const page_texte = lignes.trim();
    if (page_texte) pages.push(page_texte);
  }

  return pages.join('\n---PAGE---\n');
}

/* ── Découpage en chapitres (même logique que upload.js) ──── */
function decouperEnChapitres(texte) {
  const regex = /\n\s*(chapitre\s+\d+|chapter\s+\d+|partie\s+\d+|[IVXivx]+\.|—\s*\d+\s*—|\*{3})\s*\n/gi;
  const parties = texte.split(regex);

  if (parties.length <= 1) {
    return [{ numero: 1, titre: null, contenu: texte.trim() }];
  }

  const chapitres = [];
  let numero = 1;
  for (let i = 0; i < parties.length; i += 2) {
    const titre   = parties[i + 1]?.trim() || null;
    const contenu = parties[i]?.trim();
    if (contenu) chapitres.push({ numero: numero++, titre, contenu });
  }
  return chapitres;
}

/* ── Traitement d'une oeuvre ──────────────────────────────── */
async function traiterOeuvre(oeuvre) {
  const label = `"${oeuvre.titre}" (${oeuvre.id.slice(0, 8)}…)`;
  console.log(`\n▶ ${label}`);

  /* 1. Télécharger le PDF depuis Storage */
  if (!oeuvre.fichier_url) {
    console.log(`  ⚠ Pas de fichier_url — ignoré`);
    return { statut: 'skip', raison: 'pas de fichier_url' };
  }

  // Extraire le chemin relatif depuis l'URL publique/signée
  let cheminStorage = oeuvre.fichier_url;
  // Format attendu : .../storage/v1/object/public/oeuvres-privees/<path>
  // ou .../object/sign/oeuvres-privees/<path>
  const match = cheminStorage.match(/oeuvres-privees\/(.+)/);
  if (!match) {
    console.log(`  ⚠ Impossible d'extraire le chemin Storage depuis : ${cheminStorage}`);
    return { statut: 'skip', raison: 'chemin introuvable' };
  }
  const chemin = match[1].split('?')[0]; // retirer les query params

  console.log(`  📥 Téléchargement : ${chemin}`);
  const { data: fileData, error: dlErr } = await supabase.storage
    .from(BUCKET)
    .download(chemin);

  if (dlErr || !fileData) {
    console.log(`  ✗ Erreur téléchargement : ${dlErr?.message}`);
    return { statut: 'erreur', raison: dlErr?.message };
  }

  const buffer = await fileData.arrayBuffer();

  /* 2. Ré-extraire avec marqueurs de pages */
  console.log(`  🔍 Extraction PDF (${Math.round(buffer.byteLength / 1024)} Ko)…`);
  let texteComplet;
  try {
    texteComplet = await extrairePdfAvecPages(buffer);
  } catch (e) {
    console.log(`  ✗ Erreur PDF.js : ${e.message}`);
    return { statut: 'erreur', raison: e.message };
  }

  const nbPages = (texteComplet.match(/---PAGE---/g) || []).length + 1;
  console.log(`  📄 ${nbPages} page(s) détectée(s)`);

  if (nbPages <= 1) {
    console.log(`  ⚠ Une seule page — pas de marqueurs à ajouter`);
    return { statut: 'skip', raison: 'une seule page' };
  }

  /* 3. Découper en chapitres */
  const chapitresNouveaux = decouperEnChapitres(texteComplet);
  console.log(`  📚 ${chapitresNouveaux.length} chapitre(s) après re-découpage`);

  /* 4. Récupérer les chapitres existants en base */
  const { data: chapitresExistants, error: chErr } = await supabase
    .from('chapitres')
    .select('id, numero, titre')
    .eq('oeuvre_id', oeuvre.id)
    .order('numero');

  if (chErr) {
    console.log(`  ✗ Erreur lecture chapitres : ${chErr.message}`);
    return { statut: 'erreur', raison: chErr.message };
  }

  if (DRY_RUN) {
    console.log(`  ✅ [DRY-RUN] Aurait mis à jour ${Math.min(chapitresNouveaux.length, chapitresExistants.length)} chapitre(s)`);
    return { statut: 'dry-run', nbPages };
  }

  /* 5. Mettre à jour le contenu de chaque chapitre */
  let majCount = 0;
  for (let i = 0; i < chapitresExistants.length; i++) {
    const chExistant = chapitresExistants[i];
    // Correspondance par numéro (le re-découpage peut changer le nb de chapitres)
    const chNouveau  = chapitresNouveaux[i] || chapitresNouveaux[chapitresNouveaux.length - 1];

    const { error: updErr } = await supabase
      .from('chapitres')
      .update({ contenu_texte: chNouveau.contenu })
      .eq('id', chExistant.id);

    if (updErr) {
      console.log(`  ✗ Chapitre ${chExistant.numero} : ${updErr.message}`);
    } else {
      majCount++;
    }
  }

  console.log(`  ✅ ${majCount}/${chapitresExistants.length} chapitre(s) mis à jour`);
  return { statut: 'ok', nbPages, majCount };
}

/* ── Point d'entrée ───────────────────────────────────────── */
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Migration : ajout marqueurs ---PAGE--- en base');
  console.log(DRY_RUN ? '  MODE : DRY-RUN (aucune écriture)' : '  MODE : ÉCRITURE RÉELLE');
  console.log('═══════════════════════════════════════════════════');

  // Récupérer les œuvres à traiter
  let query = supabase
    .from('oeuvres')
    .select('id, titre, fichier_url')
    .not('fichier_url', 'is', null);

  if (ID_SEUL) {
    query = query.eq('id', ID_SEUL);
    console.log(`\n⚡ Traitement limité à l'œuvre : ${ID_SEUL}`);
  }

  const { data: oeuvres, error } = await query;
  if (error) { console.error('Erreur Supabase :', error.message); process.exit(1); }
  console.log(`\n📖 ${oeuvres.length} œuvre(s) avec fichier PDF trouvées\n`);

  const stats = { ok: 0, skip: 0, erreur: 0, totalPages: 0 };

  for (const oeuvre of oeuvres) {
    const res = await traiterOeuvre(oeuvre);
    stats[res.statut === 'dry-run' ? 'ok' : res.statut]++;
    if (res.nbPages) stats.totalPages += res.nbPages;
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ Succès  : ${stats.ok}`);
  console.log(`  ⏭  Ignorés : ${stats.skip}`);
  console.log(`  ✗  Erreurs : ${stats.erreur}`);
  console.log(`  📄 Pages totales détectées : ${stats.totalPages}`);
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch(err => { console.error(err); process.exit(1); });
