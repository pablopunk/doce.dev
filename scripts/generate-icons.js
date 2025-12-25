import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sourceDir = path.join(__dirname, '../public');
const sourceFile = path.join(sourceDir, 'icon-1080.png');

const sizes = [16, 20, 32, 64, 80, 128, 256, 512];

async function generateIcons() {
  try {
    console.log(`📦 Generating icons from ${sourceFile}...`);

    for (const size of sizes) {
      const outputFile = path.join(sourceDir, `icon-${size}.png`);
      await sharp(sourceFile).resize(size, size).png().toFile(outputFile);
      console.log(`✓ Generated icon-${size}.png`);
    }

    console.log('\n✨ All icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
