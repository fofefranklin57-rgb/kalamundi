import sharp from 'sharp';

const source = 'assets/img/logo-kalamundi-km-plume.png';
const markOut = 'assets/img/logo-mark-km.png';
const iconSizes = [72, 96, 128, 192, 512];

const image = sharp(source);
const meta = await image.metadata();

const width = meta.width || 1024;
const height = meta.height || 1536;
const cropSize = Math.round(Math.min(width * 0.78, height * 0.55));
const left = Math.max(0, Math.round((width - cropSize) / 2));
const top = Math.max(0, Math.round(height * 0.1));

const mark = sharp(source)
  .extract({ left, top, width: cropSize, height: cropSize })
  .resize(512, 512, { fit: 'contain', background: '#ffffff' })
  .png();

await mark.toFile(markOut);

for (const size of iconSizes) {
  await sharp(markOut)
    .resize(size, size, { fit: 'contain', background: '#ffffff' })
    .png()
    .toFile(`assets/img/icons/icon-${size}.png`);
}

console.log(`Logo mark et icônes PWA générés depuis ${source}.`);
