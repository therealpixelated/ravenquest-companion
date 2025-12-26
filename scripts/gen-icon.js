const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

async function main() {
  const src = path.join(__dirname, '..', 'assets', 'icon.jpg');
  const dest = path.join(__dirname, '..', 'assets', 'icon.ico');
  if (!fs.existsSync(src)) {
    console.error('Source icon.jpg not found in assets');
    process.exit(1);
  }
  try {
    await sharp(src).resize(256, 256, { fit: 'cover' }).toFile(dest);
    console.log('icon.ico regenerated');
  } catch (err) {
    console.error('Failed to generate icon.ico', err);
    process.exit(1);
  }
}

main();
