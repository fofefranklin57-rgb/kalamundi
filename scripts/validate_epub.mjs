#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const files = args.filter(arg => !arg.startsWith('--'));
const json = args.includes('--json');

if (!files.length || args.includes('--help')) {
  console.log(`Usage:
  node scripts/validate_epub.mjs livre.epub [autre.epub]

Configuration epubcheck:
  - définir EPUBCHECK_JAR=C:\\chemin\\epubcheck.jar
  - ou placer le jar dans tools/epubcheck/epubcheck.jar

Le script lance l'epubcheck officiel quand Java + jar sont disponibles.`);
  process.exit(files.length ? 0 : 1);
}

const root = process.cwd();
const jarPath = process.env.EPUBCHECK_JAR
  || path.join(root, 'tools', 'epubcheck', 'epubcheck.jar');

const report = {
  validator: 'epubcheck',
  jarPath,
  javaAvailable: false,
  jarAvailable: fs.existsSync(jarPath),
  files: [],
};

const javaProbe = spawnSync('java', ['-version'], { encoding: 'utf8' });
report.javaAvailable = javaProbe.status === 0;

if (!report.javaAvailable || !report.jarAvailable) {
  const missing = [
    !report.javaAvailable ? 'Java absent' : null,
    !report.jarAvailable ? `epubcheck.jar absent (${jarPath})` : null,
  ].filter(Boolean);
  const message = `Validation epubcheck indisponible : ${missing.join(' ; ')}.`;
  if (json) console.log(JSON.stringify({ ...report, ok: false, skipped: true, message }, null, 2));
  else console.warn(message);
  process.exit(2);
}

let hasError = false;
for (const file of files) {
  const full = path.resolve(file);
  if (!fs.existsSync(full)) {
    hasError = true;
    report.files.push({ file, ok: false, error: 'Fichier introuvable' });
    continue;
  }

  const result = spawnSync('java', ['-jar', jarPath, full], { encoding: 'utf8' });
  const ok = result.status === 0;
  hasError ||= !ok;
  report.files.push({
    file,
    ok,
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  });

  if (!json) {
    console.log(`\n${ok ? 'OK' : 'ERREUR'} — ${file}`);
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    if (output) console.log(output);
  }
}

if (json) console.log(JSON.stringify({ ...report, ok: !hasError }, null, 2));
process.exit(hasError ? 1 : 0);
