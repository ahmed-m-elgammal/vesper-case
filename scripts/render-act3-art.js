/**
 * Renders the Act 3 art for visual inspection: composites the four room
 * layer stacks (as Phaser would) and rasterizes the new close-ups onto
 * two contact sheets. Output: /tmp/render/art3/*.png
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outDir = '/tmp/render/art3';
fs.mkdirSync(outDir, { recursive: true });

async function composite(layers, name, w = 1600, h = 600) {
  let img = sharp(Buffer.from(layers[0])).resize(w, h);
  for (let i = 1; i < layers.length; i++) {
    const next = await sharp(Buffer.from(layers[i])).resize(w, h).png().toBuffer();
    img = sharp(await img.png().toBuffer()).composite([{ input: next }]);
  }
  const buf = await img.png().toBuffer();
  await sharp(buf).png().toFile(path.join(outDir, `${name}.png`));
  console.log('rendered', name);
}

async function sheet(list, name) {
  const cellW = 400, cellH = 300;
  const imgs = [];
  for (let i = 0; i < list.length; i++) {
    const buf = await sharp(Buffer.from(fs.readFileSync(list[i][1]))).resize(cellW, cellH).png().toBuffer();
    imgs.push({ input: buf, left: (i % 2) * cellW, top: Math.floor(i / 2) * cellH });
  }
  await sharp({ create: { width: cellW * 2, height: cellH * 2, channels: 3, background: '#ddd' } })
    .composite(imgs).png().toFile(path.join(outDir, `${name}.png`));
  console.log('rendered', name);
}

(async () => {
  const base = 'public/art/';
  await composite(
    [fs.readFileSync(base + 'study_bg.svg'), fs.readFileSync(base + 'study_mid.svg'), fs.readFileSync(base + 'study_fg.svg')],
    'study'
  );
  await composite(
    [fs.readFileSync(base + 'peggy_bg.svg'), fs.readFileSync(base + 'peggy_mid.svg'), fs.readFileSync(base + 'peggy_fg.svg')],
    'peggy'
  );
  await composite(
    [fs.readFileSync(base + 'edmund_bg.svg'), fs.readFileSync(base + 'edmund_mid.svg'), fs.readFileSync(base + 'edmund_fg.svg')],
    'edmund'
  );
  await composite(
    [fs.readFileSync(base + 'bath_bg.svg'), fs.readFileSync(base + 'bath_mid.svg'), fs.readFileSync(base + 'bath_fg.svg')],
    'bath'
  );
  await sheet([
    ['cu_candle', base + 'closeups/cu_candle.svg'],
    ['cu_ious', base + 'closeups/cu_ious.svg'],
    ['cu_journal', base + 'closeups/cu_journal.svg'],
    ['cu_cabinet', base + 'closeups/cu_cabinet.svg'],
  ], 'closeups-a');
  await sheet([
    ['cu_blotter', base + 'closeups/cu_blotter.svg'],
    ['cu_receipt', base + 'closeups/cu_receipt.svg'],
    ['cu_safe', base + 'closeups/cu_safe.svg'],
    ['cu_tin', base + 'closeups/cu_tin.svg'],
  ], 'closeups-b');
  console.log('done ->', outDir);
})();
