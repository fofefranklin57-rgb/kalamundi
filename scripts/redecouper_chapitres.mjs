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

function decouperEnChapitres(texte) {
  const source = String(texte || '').trim();
  if (!source) return [{ numero: 1, titre: null, contenu: '' }];

  const matches = detecterTitresChapitres(source);
  if (!matches.length) return decouperParTaille(source);

  const chapitres = [];
  const avantPremier = source.slice(0, matches[0].index).trim();
  if (avantPremier && avantPremier.length > 260) {
    chapitres.push({ numero: chapitres.length + 1, titre: 'Avant-propos', contenu: avantPremier });
  }

  matches.forEach((match, index) => {
    const debut = match.index + match.raw.length;
    const fin = index + 1 < matches.length ? matches[index + 1].index : source.length;
    const titre = nettoyerTitreChapitre(match.titre);
    const contenu = source.slice(debut, fin).trim();
    if (contenu) chapitres.push({ numero: chapitres.length + 1, titre, contenu });
  });

  if (chapitres.length <= 1 && source.length > 18000) return decouperParTaille(source);
  return chapitres.length ? chapitres : [{ numero: 1, titre: null, contenu: source }];
}

function detecterTitresChapitres(source) {
  const lignes = source.split('\n');
  const titres = [];
  let index = 0;

  lignes.forEach((ligne, i) => {
    const raw = ligne;
    const propre = raw.trim();
    const debut = index;
    index += raw.length + 1;
    if (!propre || propre.length > 140) return;
    if (!estTitreChapitre(propre, lignes[i - 1], lignes[i + 1])) return;
    titres.push({ index: debut, raw, titre: propre });
  });

  return filtrerTitresTropProches(titres);
}

function estTitreChapitre(ligne, avant = '', apres = '') {
  const propre = ligne.replace(/\s+/g, ' ').trim();
  const bas = propre.toLowerCase();
  const ligneIsolee = !String(avant || '').trim() || !String(apres || '').trim();
  const ponctuationForte = /[!?;:]{2,}|[.!?]$/.test(propre);
  const mots = propre.split(/\s+/).length;

  if (/^(prologue|epilogue|épilogue|avant-propos|préface|preface|introduction|conclusion)$/i.test(propre)) return true;
  if (/^(chapitre|chapter)\s+(premier|[0-9]+|[ivxlcdm]+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\b/i.test(propre)) return true;
  if (/^(livre|book|partie|part)\s+(premier|[0-9]+|[ivxlcdm]+|un|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/i.test(propre)) return true;
  if (/^[-—–]\s*(chapitre|chapter|[0-9]+|[ivxlcdm]+)\s*[-—–]?$/i.test(propre)) return true;
  if (/^([0-9]{1,3}|[ivxlcdm]{1,8})[.)]\s+.{0,90}$/i.test(propre) && ligneIsolee && !ponctuationForte) return true;

  const estMajuscule = propre === propre.toUpperCase() && /[A-ZÀ-Ý]/.test(propre);
  if (ligneIsolee && estMajuscule && mots <= 10 && propre.length >= 4 && !ponctuationForte) {
    if (!/^(TABLE|SOMMAIRE|COPYRIGHT|ISBN|NOTES?|REMERCIEMENTS?)\b/i.test(propre)) return true;
  }

  return bas === '***' || bas === '* * *';
}

function filtrerTitresTropProches(titres) {
  const retenus = [];
  titres.forEach(t => {
    const precedent = retenus[retenus.length - 1];
    if (precedent && t.index - precedent.index < 500) {
      precedent.titre = `${precedent.titre} - ${t.titre}`;
      precedent.raw += `\n${t.raw}`;
    } else {
      retenus.push(t);
    }
  });
  return retenus;
}

function nettoyerTitreChapitre(titre) {
  return String(titre || '')
    .replace(/^\s*[-—–]\s*/, '')
    .replace(/\s*[-—–]\s*$/, '')
    .trim() || null;
}

function decouperParTaille(source) {
  const tailleCible = 9000;
  if (source.length <= tailleCible * 1.4) return [{ numero: 1, titre: null, contenu: source }];

  const blocs = source.split(/\n{2,}/);
  const chapitres = [];
  let courant = '';

  blocs.forEach(bloc => {
    const ajout = courant ? `${courant}\n\n${bloc}` : bloc;
    if (ajout.length > tailleCible && courant.length > 2500) {
      chapitres.push({ numero: chapitres.length + 1, titre: `Partie ${chapitres.length + 1}`, contenu: courant.trim() });
      courant = bloc;
    } else {
      courant = ajout;
    }
  });

  if (courant.trim()) chapitres.push({ numero: chapitres.length + 1, titre: `Partie ${chapitres.length + 1}`, contenu: courant.trim() });
  return chapitres.length ? chapitres : [{ numero: 1, titre: null, contenu: source }];
}

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
