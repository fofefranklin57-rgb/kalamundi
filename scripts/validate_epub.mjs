#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { validerEpub } from './lib/epub-validator.mjs';

const args = process.argv.slice(2);
const files = args.filter(arg => !arg.startsWith('--'));
const json = args.includes('--json');

if (!files.length || args.includes('--help')) {
  console.log(`Usage:
  node scripts/validate_epub.mjs livre.epub [autre.epub]

Deux passes :
  1. Validation structurelle native (toujours) — OCF, OPF, manifest/spine, namespaces XML.
  2. epubcheck officiel (optionnel, passe profonde) si Java + jar disponibles :
     - EPUBCHECK_JAR=C:\\chemin\\epubcheck.jar
     - ou tools/epubcheck/epubcheck.jar

La passe native seule suffit à faire échouer le script : un EPUB
structurellement invalide ne doit jamais être publié.`);
  process.exit(files.length ? 0 : 1);
}

const root = process.cwd();
const jarPath = process.env.EPUBCHECK_JAR || path.join(root, 'tools', 'epubcheck', 'epubcheck.jar');

const jarAvailable = fs.existsSync(jarPath);
const javaAvailable = spawnSync('java', ['-version'], { encoding: 'utf8' }).status === 0;
const epubcheckDispo = jarAvailable && javaAvailable;

const report = { validator: 'kalamundi-native', epubcheck: { jarPath, jarAvailable, javaAvailable, used: epubcheckDispo }, files: [] };
let hasError = false;

for (const file of files) {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) {
    hasError = true;
    report.files.push({ file, ok: false, erreurs: ['Fichier introuvable'] });
    if (!json) console.error(`ERREUR — ${file} : fichier introuvable`);
    continue;
  }

  /* Passe 1 — native, toujours */
  const natif = validerEpub(fs.readFileSync(full));
  const entree = { file, ok: natif.ok, erreurs: natif.erreurs, avertissements: natif.avertissements };
  hasError ||= !natif.ok;

  /* Passe 2 — epubcheck officiel, si disponible */
  if (epubcheckDispo) {
    const result = spawnSync('java', ['-jar', jarPath, full], { encoding: 'utf8' });
    entree.epubcheck = { ok: result.status === 0, status: result.status, sortie: `${result.stdout || ''}${result.stderr || ''}`.trim() };
    if (result.status !== 0) hasError = true;
  }

  report.files.push(entree);

  if (!json) {
    console.log(`\n${entree.ok ? 'OK' : 'ERREUR'} — ${file} (validation native)`);
    natif.erreurs.forEach(e => console.error(`  - ${e}`));
    natif.avertissements.forEach(a => console.warn(`  ~ ${a}`));
    if (entree.epubcheck) {
      console.log(`${entree.epubcheck.ok ? 'OK' : 'ERREUR'} — ${file} (epubcheck)`);
      if (entree.epubcheck.sortie) console.log(entree.epubcheck.sortie);
    } else {
      console.log('epubcheck non exécuté (Java ou jar absent) — passe native uniquement.');
    }
  }
}

if (json) console.log(JSON.stringify({ ...report, ok: !hasError }, null, 2));
process.exit(hasError ? 1 : 0);
