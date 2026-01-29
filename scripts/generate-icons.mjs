import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');
const iconsDir = join(publicDir, 'icons');

const svgBuffer = readFileSync(join(iconsDir, 'icon.svg'));

const sizes = [192, 512];

async function generateIcons() {
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(join(iconsDir, `icon-${size}.png`));
    console.log(`Generated icon-${size}.png`);
  }

  // Also generate Apple touch icon (180x180)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png()
    .toFile(join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');

  // Favicon (32x32)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(join(publicDir, 'favicon.png'));
  console.log('Generated favicon.png');

  // Also create a standard favicon.ico (16x16 and 32x32)
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(join(publicDir, 'favicon-16.png'));
  console.log('Generated favicon-16.png');

  console.log('All icons generated!');
}

generateIcons().catch(console.error);
