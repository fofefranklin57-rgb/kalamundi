/**
 * Redécoupe les œuvres Kalamundi qui ont été enregistrées comme un seul gros chapitre.
 *
 * Usage conseillé :
 *   node scripts/redecouper_chapitres.mjs --dry-run
 *   node scripts/redecouper_chapitres.mjs --id <uuid> --dry-run
 *   node scripts/redecouper_chapitres.mjs --id <uuid> --apply
 *   node scripts/redecouper_chapitres.mjs --apply --limit 20
 *
 * Variables d'environnement :
 *   SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_SERVICE_KEY
 *   SUPABASE_URL optionnel, sinon le projet Kalamundi est utilisé
 */

import { createClient } from '@supabase/supabase-js';
import { decouperEnChapitres } from './lib/book-normalizer.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://iobieffnaauecyukecds.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.SERVICE_KEY;

if (!SERVICE_KEY) {
  throw new Error('Clé service Supabase manquante : définis SUPABASE_SERVICE_ROLE_KEY.');
}

const args = new Set(process.argv.slice(2));
const getArg = (nom, defaut = null) => {
  const i = process.argv.indexOf(nom);
  return i >= 0 ? process.argv[i + 1] : defaut;
};

const APPLY = args.has('--apply');
const DRY_RUN = args.has('--dry-run') || !APPLY;
const OEUVRE_ID = getArg('--id');
const LIMIT = Number(getArg('--limit', '80'));
const MIN_LENGTH = Number(getArg('--min-length', '12000'));
const FORCER_MULTI = args.has('--all');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function chargerOeuvres() {
  let query = supabase
    .from('oeuvres')
    .select('id, titre, auteur_id, statut, chapitres_gratuits, visible, created_at')
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
    .select('id, numero, titre, contenu, contenu_texte, type_element, visible, date_publication')
    .eq('oeuvre_id', oeuvreId)
    .order('numero');
  if (error) throw error;
  return data || [];
}

async function redecouperOeuvre(oeuvre) {
  const chapitres = await chargerChapitres(oeuvre.id);
  if (!chapitres.length) return { statut: 'ignore', raison: 'aucun chapitre' };
  if (!FORCER_MULTI && chapitres.length !== 1) {
    return { statut: 'ignore', raison: `${chapitres.length} chapitres existants` };
  }

  const base = chapitres[0];
  const contenu = (FORCER_MULTI ? chapitres.map(c => c.contenu_texte || c.contenu || '').join('\n\n') : (base.contenu_texte || base.contenu || '')).trim();
  if (contenu.length < MIN_LENGTH) return { statut: 'ignore', raison: `texte court (${contenu.length} caractères)` };

  const nouveaux = decouperEnChapitres(contenu);
  if (nouveaux.length <= 1) return { statut: 'ignore', raison: 'aucun vrai découpage trouvé' };

  console.log(`\n- ${oeuvre.titre}`);
  console.log(`  Avant : ${chapitres.length} chapitre(s), ${contenu.length} caractères`);
  console.log(`  Après : ${nouveaux.length} chapitre(s)`);
  console.log(`  Début : ${nouveaux.slice(0, 5).map(c => c.titre || `Chapitre ${c.numero}`).join(' | ')}`);

  if (DRY_RUN) return { statut: 'dry-run', chapitres: nouveaux.length };

  if (FORCER_MULTI && chapitres.length > 1) {
    const idsASupprimer = chapitres.slice(1).map(c => c.id);
    if (idsASupprimer.length) {
      const { error: delError } = await supabase.from('chapitres').delete().in('id', idsASupprimer);
      if (delError) throw delError;
    }
  }

  const commun = {
    oeuvre_id: oeuvre.id,
    type_element: base.type_element || 'chapitre',
    visible: base.visible ?? true,
    date_publication: base.date_publication || null,
  };

  const { error: updateError } = await supabase
    .from('chapitres')
    .update({
      numero: 1,
      titre: nouveaux[0].titre,
      contenu_texte: nouveaux[0].contenu,
      chapitre_id: nouveaux[0].chapitre_id,
      source_hash: nouveaux[0].source_hash,
      format_source: 'normalise',
      metadata: {
        normalisation: 'redecoupage_auto',
        outil: 'scripts/redecouper_chapitres.mjs',
      },
      type_element: commun.type_element,
      visible: commun.visible,
      date_publication: commun.date_publication,
    })
    .eq('id', base.id);
  if (updateError) throw updateError;

  const inserts = nouveaux.slice(1).map(ch => ({
    ...commun,
    numero: ch.numero,
    titre: ch.titre,
    contenu_texte: ch.contenu,
    chapitre_id: ch.chapitre_id,
    source_hash: ch.source_hash,
    format_source: 'normalise',
    metadata: {
      normalisation: 'redecoupage_auto',
      outil: 'scripts/redecouper_chapitres.mjs',
    },
  }));

  if (inserts.length) {
    const { error: insertError } = await supabase.from('chapitres').insert(inserts);
    if (insertError) throw insertError;
  }

  return { statut: 'ok', chapitres: nouveaux.length };
}

async function main() {
  console.log('Redécoupage automatique des œuvres Kalamundi');
  console.log(DRY_RUN ? 'Mode test : aucune modification en base' : 'Mode écriture : modification réelle en base');
  if (OEUVRE_ID) console.log(`Œuvre ciblée : ${OEUVRE_ID}`);

  const oeuvres = await chargerOeuvres();
  const stats = { ok: 0, 'dry-run': 0, ignore: 0, erreur: 0 };

  for (const oeuvre of oeuvres) {
    try {
      const res = await redecouperOeuvre(oeuvre);
      stats[res.statut] = (stats[res.statut] || 0) + 1;
      if (res.statut === 'ignore') console.log(`- ${oeuvre.titre} : ignoré (${res.raison})`);
    } catch (err) {
      stats.erreur++;
      console.error(`- ${oeuvre.titre} : erreur (${err.message})`);
    }
  }

  console.log('\nRésumé');
  console.log(`  Modifiées : ${stats.ok}`);
  console.log(`  À modifier en test : ${stats['dry-run']}`);
  console.log(`  Ignorées : ${stats.ignore}`);
  console.log(`  Erreurs : ${stats.erreur}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
