import https from 'https';
import fs from 'fs';
import path from 'path';

const DIR = 'C:/kalamundi/assets/fonts';

const fonts = [
  { url: 'https://fonts.gstatic.com/s/roboto/v51/KFOMCnqEu92Fr1ME7kSn66aGLdTylUAMa3yUBA.woff2', file: 'roboto-300.woff2' },
  { url: 'https://fonts.gstatic.com/s/roboto/v51/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2',             file: 'roboto-400.woff2' },
  { url: 'https://fonts.gstatic.com/s/roboto/v51/KFOlCnqEu92Fr1MmEU9fBBc4AMP6lQ.woff2',         file: 'roboto-500.woff2' },
  { url: 'https://fonts.gstatic.com/s/roboto/v51/KFOlCnqEu92Fr1MmWUlfBBc4AMP6lQ.woff2',         file: 'roboto-700.woff2' },
];

function downloadFont(url, dest) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      res.pipe(out);
      out.on('finish', () => resolve(fs.statSync(dest).size));
    }).on('error', reject);
  });
}

for (const { url, file } of fonts) {
  const dest = path.join(DIR, file);
  try {
    const size = await downloadFont(url, dest);
    console.log(`✓ ${file} — ${(size/1024).toFixed(0)} Ko`);
  } catch (e) {
    console.error(`✗ ${file} : ${e.message}`);
  }
}
console.log('=== Terminé ===');
