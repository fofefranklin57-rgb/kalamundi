import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';

const svg = readFileSync('./assets/img/icon.svg');
const dir = './assets/img/icons';
mkdirSync(dir, { recursive: true });

const sizes = [72, 96, 128, 192, 512];

for (const size of sizes) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(`${dir}/icon-${size}.png`);
  console.log(`✅ icon-${size}.png`);
}
console.log('Icônes générées.');
