import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['assets/js', 'functions/api', 'scripts'];
const files = ['sw.js'];

function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(fullPath);
      continue;
    }
    if (entry.isFile() && /\.(mjs|js)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
}

for (const root of roots) {
  try {
    if (statSync(root).isDirectory()) collect(root);
  } catch {
    // Optional folder absent.
  }
}

let failed = false;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) failed = true;
}

if (failed) process.exit(1);
console.log(`Syntaxe JavaScript OK (${files.length} fichiers).`);
