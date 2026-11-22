/**
 * Renders the Act 2 art for visual inspection: composites the kitchen and
 * landing layer stacks over each other (as Phaser would) and rasterizes the
 * new close-ups. Output: /tmp/render/art/*.png
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/render/art';
fs.mkdirSync(outDir, { recursive: true });

async function composite(layers, name, w = 2400, h = 900) {
  // Composite bottom-up: bg first, then mid, then fg (all full-frame).
  let img = sharp(Buffer.from(layers[0])).resize(w, h);
  for (let i = 1; i < layers.length; i++) {
    const next = await sharp(Buffer.from(layers[i])).resize(w, h).png().toBuffer();
    img = sharp(await img.png().toBuffer()).composite([{ input: next }]);
  }
  const buf = await img.png().toBuffer();
  await sharp(buf).resize(1600, 600).png().toFile(path.join(outDir, `${name}.png`));
  console.log('rendered', name);
}

async function one(file, name) {
  await sharp(Buffer.from(fs.readFileSync(file))).resize(800, 600).png().toFile(path.join(outDir, `${name}.png`));
  console.log('rendered', name);
}

(async () => {
  const base = 'public/art/';
  await composite(
    [fs.readFileSync(base + 'kitchen_bg.svg'), fs.readFileSync(base + 'kitchen_mid.svg'), fs.readFileSync(base + 'kitchen_fg.svg')],
    'kitchen'
  );
  await composite(
    [fs.readFileSync(base + 'landing_bg.svg'), fs.readFileSync(base + 'landing_mid.svg'), fs.readFileSync(base + 'landing_fg.svg')],
    'landing'
  );
  for (const c of ['cu_loaf', 'cu_lantern', 'cu_radio', 'cu_flags', 'cu_ledgerpage', 'cu_runner', 'cu_tonic']) {
    await one(base + 'closeups/' + c + '.svg', c);
  }
  console.log('done ->', outDir);
})();
