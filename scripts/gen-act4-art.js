/**
 * Generates the Act 4 art: the attic studio, the cellar and the laundry/cot
 * (3 layers each, 2400x900) + 7 close-up insets (800x600).
 * Style mirrors the hand-authored Build One/Two/Three art: paper #f4ecdb,
 * ink #2e2a33, feTurbulence wobble, blurred watercolour washes.
 *
 *   node scripts/gen-act4-art.js
 */
const fs = require('fs');
const path = require('path');

const ART = path.join(__dirname, '..', 'public', 'art');
const CU = path.join(ART, 'closeups');

const INK = '#2e2a33';
const PAPER = '#f4ecdb';
const WOOD = '#8a6a4f';
const BLUE = '#8fa3b0';
const GOLD = '#c9a25e';
const NIGHT = '#3a3f52';
const SAGE = '#9aa88f';
const RUST = '#b4552d';
const COPPER = '#a8663c';
const BRICK = '#9c5a41';

let seedCounter = 40;
function defs(id) {
  const s = seedCounter++;
  return `<defs>
    <filter id="${id}W" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.011 0.014" numOctaves="2" seed="${s}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7"/></filter>
    <filter id="${id}S" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>`;
}

function washes(gid, list) {
  return `<g filter="url(#${gid}S)">` + list.map(([cx, cy, rx, ry, fill, op]) =>
    `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${op}"/>`).join('') + '</g>';
}

function roomSvg(id, washesList, body) {
  // Only background layers carry the opaque paper base (mid/fg are
  // transparent overlays -- matches the hand-authored Build One/Two/Three art).
  const withPaper = id.endsWith('B');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2400 900" width="2400" height="900">
  ${defs(id)}
  ${withPaper ? `<rect width="2400" height="900" fill="${PAPER}"/>` : ''}
  ${washes(id, washesList)}
  ${body(id)}
</svg>
`;
}

function closeupSvg(id, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  ${defs(id)}
  <rect width="800" height="600" fill="${PAPER}"/>
  ${washes(id, [[80, 80, 58, 38, BLUE, 0.14], [730, 520, 66, 42, GOLD, 0.12], [700, 90, 46, 30, NIGHT, 0.10], [90, 540, 50, 30, SAGE, 0.10]])}
  <g filter="url(#${id}W)" fill="none" stroke="${INK}" stroke-linecap="round">
    <rect x="14" y="14" width="772" height="572" stroke-width="2.8"/>
    <rect x="22" y="22" width="756" height="556" stroke-width="1.6" opacity="0.75"/>
  </g>
  ${body(id)}
</svg>
`;
}

/* ------------------------------------------------------------ shared room bits */

function doorway(id, x = 0) {
  return `<g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linecap="round">
    <rect x="${x - 10}" y="180" width="130" height="560" fill="${NIGHT}" fill-opacity="0.30" stroke-width="6"/>
    <rect x="${x + 4}" y="196" width="102" height="544" fill="${NIGHT}" fill-opacity="0.38" stroke-width="3.5"/>
    <path d="M${x - 10} 180 q65 -26 130 0" stroke-width="6"/>
    <path d="M${x + 40} 196 V740" stroke-width="2.2" opacity="0.5"/>
  </g>`;
}

function vignette(id) {
  return `<g filter="url(#${id}S)">
    <ellipse cx="1200" cy="-60" rx="1500" ry="220" fill="${NIGHT}" opacity="0.10"/>
    <ellipse cx="-40" cy="460" rx="240" ry="620" fill="${NIGHT}" opacity="0.14"/>
    <ellipse cx="2440" cy="460" rx="220" ry="600" fill="${NIGHT}" opacity="0.12"/>
  </g>
  <g fill="${INK}">
    <circle cx="520" cy="210" r="2.2" opacity="0.20"/><circle cx="940" cy="330" r="1.8" opacity="0.18"/>
    <circle cx="1500" cy="180" r="2.4" opacity="0.20"/><circle cx="1980" cy="300" r="1.7" opacity="0.16"/>
    <circle cx="700" cy="520" r="1.9" opacity="0.15"/><circle cx="1740" cy="470" r="2.1" opacity="0.15"/>
  </g>`;
}

function skylight(id, x, y, w, h, tilt) {
  const rain = [
    [x + w * 0.18, y + 26], [x + w * 0.4, y + 44], [x + w * 0.66, y + 20], [x + w * 0.84, y + 48],
    [x + w * 0.28, y + h * 0.56], [x + w * 0.58, y + h * 0.6], [x + w * 0.8, y + h * 0.5],
  ].map(([rx, ry]) => `<path d="M${rx} ${ry} q5 40 -2 80" stroke="${PAPER}" stroke-width="2" opacity="0.5"/>`).join('');
  return `<g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linecap="round" transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BLUE}" fill-opacity="0.24" stroke-width="5"/>
    <path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h * 0.42} H${x + w}" stroke-width="4"/>
    ${rain}
    <path d="M${x - 10} ${y + h} H${x + w + 10}" stroke-width="6"/>
  </g>`;
}

function stoneFloor(id, y0 = 640) {
  const slabs = [];
  for (let y = y0; y < 896; y += 52) {
    for (let i = 0; i < 9; i++) {
      const x = (i * 280 + ((y - y0) / 52) * 90) % 2400;
      slabs.push(`<rect x="${x}" y="${y}" width="272" height="46" fill="${NIGHT}" fill-opacity="${(i + (y - y0) / 52) % 3 === 0 ? 0.10 : 0.06}" stroke-width="2.4"/>`);
    }
  }
  return `<g filter="url(#${id}W)" stroke="${INK}" fill="none">${slabs.join('')}</g>`;
}

function brickWall(id, y0, y1, x0 = 0, x1 = 2400) {
  const rows = [];
  let r = 0;
  for (let y = y0; y < y1; y += 26, r++) {
    const off = r % 2 ? 28 : 0;
    const segs = [];
    for (let x = x0 - off; x < x1; x += 56) {
      const a = Math.max(x0, x), b = Math.min(x1, x + 52);
      if (b > a) segs.push(`<path d="M${a} ${y} H${b}" stroke-width="1.6" opacity="0.30"/>`);
    }
    rows.push(segs.join(''));
  }
  return `<g filter="url(#${id}W)" stroke="${BRICK}" fill="none" opacity="0.55">${rows.join('')}</g>`;
}

/* ------------------------------------------------------------ ATTIC STUDIO */

const atticBg = roomSvg('atB', [
  [400, 220, 240, 170, GOLD, 0.13], [1200, 220, 280, 180, BLUE, 0.16], [2050, 260, 230, 170, SAGE, 0.14],
  [700, 770, 330, 130, WOOD, 0.12], [1900, 790, 300, 120, NIGHT, 0.10],
], (id) => `
  ${doorway(id, 0)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M0 110 L2400 40" stroke-width="9"/>
    <path d="M0 190 L2400 120" stroke-width="5" opacity="0.6"/>
    <path d="M0 268 L2400 200" stroke-width="3" opacity="0.35"/>
    <path d="M340 110 V40 M860 96 V26 M1380 82 V12 M1900 68 V-2" stroke-width="7"/>
    <path d="M600 110 L600 40 M1180 96 L1180 26 M1740 82 L1740 12" stroke-width="4" opacity="0.5"/>
  </g>
  ${skylight(id, 900, 150, 290, 300, -3)}
  ${skylight(id, 1290, 130, 260, 280, -3)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <circle cx="1120" cy="470" r="56" fill="${NIGHT}" fill-opacity="0.16" stroke-width="5"/>
    <circle cx="1120" cy="470" r="40" stroke-width="3" opacity="0.55"/>
    <path d="M1120 414 V470 M1096 470 H1144" stroke-width="3.4" opacity="0.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M60 300 L180 300 L180 640 L60 640" stroke-width="4" opacity="0.35"/>
    <path d="M60 340 H180 M60 380 H180 M60 420 H180" stroke-width="2" opacity="0.3"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    ${[0, 1, 2, 3, 4].map((i) => `<path d="M${300 + i * 430} 300 V640" stroke-width="8" opacity="0.22"/>`).join('')}
  </g>
`);

const atticMid = roomSvg('atM', [
  [430, 560, 420, 140, WOOD, 0.22], [1870, 560, 460, 150, WOOD, 0.24], [1160, 330, 130, 90, GOLD, 0.14],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="128" y="330" width="88" height="142" fill="${WOOD}" fill-opacity="0.5" stroke-width="4.5"/>
    <path d="M146 352 q0 -12 12 -12 q12 0 12 12 M170 352 q0 -12 12 -12 q12 0 12 12" stroke-width="3.4"/>
    <path d="M146 352 V376 M170 352 V376 M194 352 V376" stroke-width="4"/>
    <ellipse cx="152" cy="386" rx="8" ry="13" fill="${GOLD}" fill-opacity="0.6" stroke-width="2.4"/>
    <ellipse cx="200" cy="386" rx="8" ry="13" fill="${GOLD}" fill-opacity="0.6" stroke-width="2.4"/>
    <circle cx="176" cy="390" r="9" fill="${PAPER}" fill-opacity="0.55" stroke-width="2.6"/>
    <path d="M168 390 q8 -9 16 0 q-8 9 -16 0" stroke-width="1.8" opacity="0.7"/>
    <rect x="148" y="404" width="48" height="18" fill="${PAPER}" fill-opacity="0.7" stroke-width="2"/>
    <text x="172" y="418" font-size="13" text-anchor="middle" fill="${INK}" stroke="none">STUDIO</text>
    <path d="M138 470 H206" stroke-width="3" opacity="0.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="52" y="656" width="146" height="16" fill="${WOOD}" fill-opacity="0.55" stroke-width="3.6"/>
    <path d="M60 656 V620 M188 656 V620" stroke-width="4"/>
    <rect x="74" y="622" width="52" height="16" rx="6" fill="${PAPER}" fill-opacity="0.85" stroke-width="2.6" transform="rotate(-4 100 630)"/>
    <path d="M126 638 q-4 -14 10 -16 q16 -2 14 12" fill="${PAPER}" fill-opacity="0.9" stroke-width="2.4"/>
    <path d="M84 622 q-2 -10 8 -12" stroke-width="2" opacity="0.7"/>
    <path d="M140 640 l16 12 M150 636 l18 10" stroke-width="1.8" opacity="0.5"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="300" y="168" width="272" height="238" fill="${WOOD}" fill-opacity="0.32" stroke-width="5"/>
    ${[214, 268, 322, 376].map((yy) => `<path d="M308 ${yy} H564" stroke-width="3.4"/>`).join('')}
    ${[0, 1, 2, 3].map((r) => Array.from({ length: 7 }, (_, i) =>
      `<rect x="${316 + i * 34}" y="${182 + r * 54}" width="22" height="${40 + (i % 3) * 7}" fill="${[RUST, SAGE, GOLD, BLUE][i % 4]}" fill-opacity="0.40" stroke-width="2.2" transform="rotate(${((i + r) % 3) - 1} ${327 + i * 34} ${202 + r * 54})"/>`).join('')).join('')}
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="610" y="180" width="180" height="210" fill="${PAPER}" fill-opacity="0.72" stroke-width="4" transform="rotate(2 700 285)"/>
    <path d="M656 300 q26 -40 62 -6 q34 -38 58 2 q-26 34 -60 12 q-34 26 -60 -8 Z" fill="${RUST}" fill-opacity="0.35" stroke-width="2.4" transform="rotate(2 700 285)"/>
    <path d="M672 268 q-4 -18 14 -22" stroke-width="2" opacity="0.6" transform="rotate(2 700 285)"/>
    <text x="702" y="374" font-size="15" text-anchor="middle" fill="${INK}" stroke="none" transform="rotate(2 700 285)">the fox, again</text>
    <path d="M700 180 V150 M688 150 l12 -14 12 14" stroke-width="3"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="300" y="470" width="420" height="34" fill="${WOOD}" fill-opacity="0.55" stroke-width="5"/>
    <path d="M330 504 V700 M690 504 V700" stroke-width="8"/>
    <path d="M300 548 H720 M300 632 H720" stroke-width="2.4" opacity="0.5"/>
    <rect x="330" y="420" width="70" height="50" fill="${WOOD}" fill-opacity="0.4" stroke-width="3.4"/>
    <path d="M336 430 h56 M336 444 h40" stroke-width="1.8" opacity="0.7"/>
    <ellipse cx="540" cy="462" rx="40" ry="10" fill="${PAPER}" fill-opacity="0.7" stroke-width="2.6"/>
    <ellipse cx="600" cy="458" rx="14" ry="14" fill="${BLUE}" fill-opacity="0.45" stroke-width="2.6"/>
    <path d="M336 470 l24 -10 M348 474 l30 -8" stroke-width="1.8" opacity="0.55"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="1450" y="500" width="740" height="34" fill="${WOOD}" fill-opacity="0.55" stroke-width="5"/>
    <path d="M1490 534 V730 M2130 534 V730" stroke-width="8"/>
    <path d="M1450 590 H2190 M1450 668 H2190" stroke-width="2.4" opacity="0.5"/>
    <rect x="1560" y="430" width="60" height="70" fill="${WOOD}" fill-opacity="0.45" stroke-width="3.6"/>
    <path d="M1590 430 V404 M1590 404 q-26 -6 -26 14 M1590 404 q26 -6 26 14" stroke-width="3.2"/>
    <ellipse cx="1590" cy="398" rx="30" ry="10" fill="${PAPER}" fill-opacity="0.8" stroke-width="2.6"/>
    <path d="M1576 398 q14 -12 28 0 q-14 12 -28 0" fill="${GOLD}" fill-opacity="0.4" stroke-width="2"/>
    <ellipse cx="1700" cy="492" rx="26" ry="10" fill="${NIGHT}" fill-opacity="0.3" stroke-width="2.4"/>
    <rect x="1740" y="452" width="40" height="48" fill="${PAPER}" fill-opacity="0.7" stroke-width="2.6"/>
    <path d="M1748 462 h26 M1748 474 h20 M1748 486 h24" stroke-width="1.6" opacity="0.7"/>
    <path d="M1880 534 q30 -22 66 -2" stroke-width="2.4" opacity="0.5"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="1538" y="452" width="192" height="52" rx="5" fill="${PAPER}" fill-opacity="0.92" stroke-width="3" transform="rotate(-1.5 1634 478)"/>
    <path d="M1560 470 q40 -26 76 -4 q-2 10 -10 16 q-34 8 -66 -12 Z" fill="${INK}" fill-opacity="0.45" stroke-width="1.6" transform="rotate(-1.5 1634 478)"/>
    <path d="M1626 480 l34 -10" stroke-width="3" opacity="0.85" transform="rotate(-1.5 1634 478)"/>
    <path d="M1700 466 l24 8 M1702 480 l22 6" stroke-width="1.8" opacity="0.6" transform="rotate(-1.5 1634 478)"/>
    <text x="1646" y="500" font-size="13" text-anchor="middle" fill="${RUST}" stroke="none" transform="rotate(-1.5 1634 478)">ch. vi -- 10:47</text>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="1856" y="254" width="238" height="206" fill="${WOOD}" fill-opacity="0.26" stroke-width="5"/>
    <path d="M1856 254 l-14 -20 M2094 254 l14 -20" stroke-width="3.4" opacity="0.6"/>
    <rect x="1874" y="274" width="94" height="76" fill="${PAPER}" fill-opacity="0.8" stroke-width="2.8" transform="rotate(-3 1921 312)"/>
    <path d="M1886 322 q16 -26 40 -4 q18 -22 32 2 q-16 18 -36 6 q-20 14 -36 -4 Z" fill="${SAGE}" fill-opacity="0.4" stroke-width="2" transform="rotate(-3 1921 312)"/>
    <rect x="1984" y="272" width="94" height="80" fill="${PAPER}" fill-opacity="0.9" stroke-width="2.8" transform="rotate(2 2031 312)"/>
    <path d="M1996 324 q16 -26 40 -4 q18 -22 32 2 q-16 18 -36 6 q-20 14 -36 -4 Z" fill="${INK}" fill-opacity="0.5" stroke-width="2.2" transform="rotate(2 2031 312)"/>
    <rect x="1892" y="376" width="88" height="62" fill="${COPPER}" fill-opacity="0.4" stroke-width="2.8" transform="rotate(-2 1936 407)"/>
    <path d="M1902 396 h66 M1902 410 h50" stroke-width="1.6" opacity="0.7" transform="rotate(-2 1936 407)"/>
    <text x="1936" y="432" font-size="12" text-anchor="middle" fill="${PAPER}" stroke="none" transform="rotate(-2 1936 407)">aged w/ tea</text>
    <path d="M2044 388 l40 -8 M2044 400 l40 -6" stroke-width="2" opacity="0.5"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" opacity="0.9">
    <ellipse cx="1250" cy="800" rx="620" ry="56" fill="${RUST}" fill-opacity="0.12" stroke-width="3"/>
    <ellipse cx="1250" cy="800" rx="420" ry="34" fill="none" stroke-width="2.4" opacity="0.5"/>
  </g>
`);

const atticFg = roomSvg('atF', [[1200, 860, 900, 160, NIGHT, 0.10]], (id) => vignette(id));

/* ------------------------------------------------------------ CELLAR */

const cellarBg = roomSvg('ceB', [
  [500, 260, 260, 180, NIGHT, 0.14], [1250, 240, 300, 190, BLUE, 0.13], [2120, 380, 260, 220, NIGHT, 0.18],
  [700, 780, 340, 130, WOOD, 0.10], [1900, 800, 320, 120, NIGHT, 0.12],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M0 300 Q300 140 600 300 M600 300 Q900 140 1200 300 M1200 300 Q1500 140 1800 300 M1800 300 Q2100 140 2400 300" stroke-width="7"/>
    <path d="M0 340 Q300 190 600 340 M600 340 Q900 190 1200 340 M1200 340 Q1500 190 1800 340 M1800 340 Q2100 190 2400 340" stroke-width="3" opacity="0.4"/>
    <path d="M300 190 V640 M900 150 V640 M1500 190 V640 M2100 150 V640" stroke-width="6" opacity="0.5"/>
  </g>
  ${brickWall(id, 360, 640)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <rect x="-14" y="230" width="140" height="520" fill="${NIGHT}" fill-opacity="0.36" stroke-width="6"/>
    <path d="M0 560 L110 640 M0 610 L60 640 M0 510 L150 610" stroke-width="5"/>
    <path d="M4 480 L120 556 M4 434 L120 502" stroke-width="4" opacity="0.7"/>
    <path d="M60 700 q-20 -60 0 -120" stroke-width="3" opacity="0.4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M1240 140 V90 M1240 90 q40 14 0 24" stroke-width="3.4"/>
    <circle cx="1240" cy="128" r="20" fill="${PAPER}" fill-opacity="0.6" stroke-width="3.4"/>
    <path d="M1226 128 h28 M1240 114 v28" stroke-width="2.4" opacity="0.6"/>
  </g>
`);

const cellarMid = roomSvg('ceM', [
  [700, 470, 340, 160, WOOD, 0.20], [1130, 500, 260, 130, GOLD, 0.14], [2170, 430, 260, 190, NIGHT, 0.22],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="520" y="300" width="380" height="270" fill="${WOOD}" fill-opacity="0.30" stroke-width="5"/>
    ${[356, 420, 484].map((yy) => `<path d="M528 ${yy} H892" stroke-width="3.4"/>`).join('')}
    ${[0, 1, 2].map((r) => Array.from({ length: 8 }, (_, i) =>
      `<rect x="${544 + i * 42}" y="${318 + r * 64}" width="26" height="${40 + (i % 3) * 6}" rx="6" fill="${[SAGE, GOLD, BLUE, RUST][i % 4]}" fill-opacity="0.4" stroke-width="2.2"/>`).join('')).join('')}
    <path d="M528 646 l30 14 M860 646 l-30 14" stroke-width="3" opacity="0.4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1010 360 h300 M1010 360 V600 M1310 360 V600" stroke-width="5.5"/>
    ${[0, 1, 2].map((r) => Array.from({ length: 4 }, (_, i) =>
      `<ellipse cx="${1058 + i * 66}" cy="${412 + r * 62}" rx="24" ry="34" fill="${NIGHT}" fill-opacity="0.35" stroke-width="2.6"/>`).join('')).join('')}
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M2400 60 L1980 330 L1980 560 L2400 300 Z" fill="${NIGHT}" fill-opacity="0.34" stroke-width="6"/>
    <path d="M2400 60 L1980 330 M2320 110 L2000 310 M2240 160 L2010 292" stroke-width="4" opacity="0.65"/>
    <path d="M1980 330 H2130" stroke-width="6"/>
    <rect x="1984" y="332" width="132" height="24" fill="${WOOD}" fill-opacity="0.6" stroke-width="3.4" transform="rotate(-6 2050 344)"/>
    <ellipse cx="2060" cy="470" rx="150" ry="52" fill="${NIGHT}" fill-opacity="0.42" stroke-width="3"/>
    <path d="M1914 470 q146 -30 292 0" stroke-width="2.6" opacity="0.6"/>
    <path d="M1990 520 q70 -16 140 0 M2010 546 q50 -12 100 0" stroke-width="2" opacity="0.4"/>
    <path d="M2160 540 q30 -10 60 0 q-4 14 -24 14 q-24 2 -36 -14 Z" fill="${PAPER}" fill-opacity="0.5" stroke-width="2.4"/>
    <path d="M2196 540 l-6 24" stroke-width="2.4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" opacity="0.9">
    <ellipse cx="1250" cy="800" rx="620" ry="56" fill="${NIGHT}" fill-opacity="0.14" stroke-width="3"/>
    <ellipse cx="1250" cy="800" rx="420" ry="34" fill="none" stroke-width="2.4" opacity="0.5"/>
  </g>
`);

const cellarFg = roomSvg('ceF', [[1200, 860, 900, 160, NIGHT, 0.12]], (id) => vignette(id));

/* ------------------------------------------------------------ LAUNDRY */

const laundryBg = roomSvg('laB', [
  [500, 260, 260, 170, BLUE, 0.13], [1300, 240, 280, 170, SAGE, 0.13], [2050, 280, 240, 170, NIGHT, 0.14],
  [800, 780, 340, 130, WOOD, 0.12], [1900, 800, 300, 120, NIGHT, 0.10],
], (id) => `
  ${doorway(id, 0)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M0 66 H2400 M0 96 H2400" stroke-width="7"/>
    <path d="M700 66 V96 M1500 66 V96" stroke-width="4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M900 250 H2000" stroke-width="3.4"/>
    <path d="M900 250 q-6 -20 8 -34 M1500 250 q-6 -20 8 -34 M2000 250 q-6 -20 8 -34" stroke-width="2.6" opacity="0.6"/>
    <path d="M1020 250 q-16 90 -8 178 q-40 10 -78 0 q10 -92 8 -178 q38 -12 78 0 Z" fill="${PAPER}" fill-opacity="0.5" stroke-width="3"/>
    <path d="M1600 250 q-16 84 -8 166 q-42 10 -80 0 q10 -86 8 -166 q40 -12 80 0 Z" fill="${PAPER}" fill-opacity="0.45" stroke-width="3"/>
    <path d="M1880 250 q-12 70 -6 140 q-34 8 -66 0 q8 -72 6 -140 q32 -10 66 0 Z" fill="${PAPER}" fill-opacity="0.4" stroke-width="3"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <rect x="2080" y="150" width="200" height="170" fill="${BLUE}" fill-opacity="0.20" stroke-width="5"/>
    <path d="M2180 150 V320 M2080 235 H2280" stroke-width="4"/>
    <path d="M2110 180 q5 36 -2 72 M2160 170 q5 36 -2 72 M2210 190 q5 36 -2 72" stroke-width="2" opacity="0.5"/>
  </g>
`);

const laundryMid = roomSvg('laM', [
  [700, 520, 380, 150, COPPER, 0.16], [2000, 620, 420, 140, WOOD, 0.20], [770, 380, 160, 90, GOLD, 0.16],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M560 330 H1010 M560 330 V470 M1010 330 V470" stroke-width="5"/>
    <rect x="712" y="330" width="126" height="112" rx="10" fill="${GOLD}" fill-opacity="0.5" stroke-width="4"/>
    <path d="M712 372 h126" stroke-width="2.6" opacity="0.7"/>
    <ellipse cx="775" cy="366" rx="52" ry="12" fill="${GOLD}" fill-opacity="0.6" stroke-width="3"/>
    <path d="M748 350 h54 M748 362 h40" stroke-width="1.8" opacity="0.75"/>
    <rect x="738" y="316" width="74" height="16" rx="8" fill="${RUST}" fill-opacity="0.5" stroke-width="2.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <ellipse cx="640" cy="560" rx="90" ry="110" fill="${COPPER}" fill-opacity="0.45" stroke-width="5"/>
    <ellipse cx="640" cy="462" rx="64" ry="16" fill="${COPPER}" fill-opacity="0.6" stroke-width="4"/>
    <path d="M640 446 V400 q30 -10 54 6" stroke-width="4.5"/>
    <path d="M598 520 q-10 60 6 96 M682 520 q10 60 -6 96" stroke-width="3" opacity="0.55"/>
    <path d="M560 660 H730" stroke-width="6"/>
    <rect x="830" y="500" width="220" height="60" fill="${WOOD}" fill-opacity="0.4" stroke-width="4.5"/>
    <circle cx="884" cy="530" r="18" fill="${PAPER}" fill-opacity="0.6" stroke-width="3.4"/>
    <circle cx="986" cy="530" r="18" fill="${PAPER}" fill-opacity="0.6" stroke-width="3.4"/>
    <path d="M884 512 V548 M986 512 V548" stroke-width="2.6" opacity="0.7"/>
    <path d="M1004 530 h60 M1064 530 q20 -8 24 10" stroke-width="3.4"/>
    <path d="M840 560 V660 M1040 560 V660" stroke-width="5"/>
    <path d="M830 660 H1060" stroke-width="6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1760 600 H2270 M1770 600 V730 M2260 600 V730" stroke-width="6"/>
    <path d="M1770 600 q250 -26 490 0" stroke-width="4"/>
    <rect x="1810" y="560" width="240" height="44" rx="12" fill="${SAGE}" fill-opacity="0.45" stroke-width="3.4"/>
    <rect x="2120" y="568" width="120" height="34" rx="10" fill="${PAPER}" fill-opacity="0.85" stroke-width="2.6"/>
    <path d="M2130 580 h100 M2130 590 h80" stroke-width="1.6" opacity="0.7"/>
    <path d="M1800 730 h80 v-40 h-80 Z" fill="${WOOD}" fill-opacity="0.4" stroke-width="3"/>
    <rect x="1930" y="716" width="44" height="26" fill="${GOLD}" fill-opacity="0.55" stroke-width="2.6"/>
    <path d="M1938 716 v-8 q0 -6 6 -6 h16 q6 0 6 6 v8" fill="${GOLD}" fill-opacity="0.6" stroke-width="2.4"/>
    <path d="M2230 716 q-4 -18 10 -22" stroke-width="2.2" opacity="0.5"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" opacity="0.9">
    <ellipse cx="1250" cy="800" rx="620" ry="56" fill="${BLUE}" fill-opacity="0.12" stroke-width="3"/>
    <ellipse cx="1250" cy="800" rx="420" ry="34" fill="none" stroke-width="2.4" opacity="0.5"/>
  </g>
`);

const laundryFg = roomSvg('laF', [[1200, 860, 900, 160, NIGHT, 0.10]], (id) => vignette(id));

/* ------------------------------------------------------------ close-ups */

const cuSketchbooks = closeupSvg('cuSB', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M120 480 q280 -30 560 0" stroke-width="6"/>
    <path d="M400 470 V120" stroke-width="5"/>
    <path d="M130 150 q130 -18 260 -6 l-6 306 q-128 12 -254 4 Z" fill="${PAPER}" fill-opacity="0.95" stroke-width="3.4"/>
    <path d="M414 144 q128 -16 254 -4 l4 300 q-126 12 -252 6 Z" fill="${PAPER}" fill-opacity="0.95" stroke-width="3.4"/>
    <path d="M158 200 q90 -40 200 -10 M158 250 q100 -34 208 -8 M158 296 q96 -30 202 -6" stroke-width="2.2" opacity="0.6"/>
    <path d="M452 210 q30 -44 64 -6 q34 -36 58 4 q-26 30 -58 10 q-30 24 -64 -8 Z" fill="${RUST}" fill-opacity="0.4" stroke-width="2.4"/>
    <path d="M470 180 q-6 -22 16 -26" stroke-width="2" opacity="0.6"/>
    <path d="M452 370 q90 -28 200 -8" stroke-width="2" opacity="0.5"/>
    <text x="168" y="428" font-size="20" fill="${INK}" stroke="none">R.M. -- 1947</text>
    <text x="452" y="428" font-size="20" fill="${INK}" stroke="none">1948 -- the lane</text>
    <path d="M400 470 q-6 -290 0 -346 M400 124 q6 56 0 346" stroke-width="2" opacity="0.4"/>
    <text x="410" y="530" font-size="21" font-style="italic" fill="${INK}" stroke="none">H. carried the light away -- R.</text>
    <path d="M406 540 q200 -14 380 -2" stroke-width="1.6" opacity="0.4"/>
    <path d="M396 508 q10 -8 18 0" stroke-width="2" opacity="0.7"/>
  </g>
`);

const cuKeyhook = closeupSvg('cuKH', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="220" y="80" width="360" height="380" fill="${WOOD}" fill-opacity="0.5" stroke-width="5"/>
    <path d="M238 110 h324 M238 130 h300" stroke-width="2" opacity="0.4"/>
    <text x="400" y="164" font-size="22" text-anchor="middle" fill="${INK}" stroke="none">7 HOLLOW LANE</text>
    <path d="M300 220 q0 -16 14 -16 q14 0 14 16" fill="none" stroke-width="4"/>
    <path d="M396 220 q0 -16 14 -16 q14 0 14 16" fill="none" stroke-width="4"/>
    <path d="M486 220 q0 -16 14 -16 q14 0 14 16" fill="none" stroke-width="4"/>
    <circle cx="314" cy="268" r="20" fill="${GOLD}" fill-opacity="0.7" stroke-width="3"/>
    <path d="M314 288 V330 M314 330 l-16 24 M314 330 l18 22" stroke-width="4"/>
    <circle cx="500" cy="268" r="20" fill="${GOLD}" fill-opacity="0.7" stroke-width="3"/>
    <path d="M500 288 V326 M500 326 l14 26" stroke-width="4"/>
    <circle cx="410" cy="272" r="24" fill="${PAPER}" fill-opacity="0.5" stroke-width="2.6"/>
    <circle cx="410" cy="272" r="14" stroke-width="2" opacity="0.5"/>
    <path d="M398 300 q12 8 24 0" stroke-width="1.8" opacity="0.6"/>
    <text x="410" y="356" font-size="17" text-anchor="middle" fill="${RUST}" stroke="none">gone -- dust keeps its shape</text>
    <path d="M240 430 h320" stroke-width="3" opacity="0.5"/>
  </g>
`);

const cuCandlestub = closeupSvg('cuCS', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M80 480 H720 M80 480 V180 M720 480 V180" stroke-width="6"/>
    <path d="M120 200 q10 90 -6 280 M700 200 q-10 90 6 280" stroke-width="3" opacity="0.4"/>
    <path d="M300 480 l20 -90 q40 -18 80 0 l20 90" fill="${NIGHT}" fill-opacity="0.14" stroke-width="4"/>
    <path d="M298 392 h124" stroke-width="5"/>
    <rect x="330" y="330" width="58" height="64" rx="8" fill="${PAPER}" fill-opacity="0.95" stroke-width="3" transform="rotate(-8 359 362)"/>
    <path d="M340 336 q22 -8 40 2 M342 350 q20 -6 36 2" stroke-width="1.8" opacity="0.6" transform="rotate(-8 359 362)"/>
    <path d="M352 330 q-2 -20 12 -24" stroke-width="2.4" transform="rotate(-8 359 362)"/>
    <path d="M364 306 q6 -14 2 -22" stroke-width="2" opacity="0.5" transform="rotate(-8 359 362)"/>
    <path d="M420 380 q-10 -20 8 -26 q20 -6 22 12 q16 4 10 20" fill="${PAPER}" fill-opacity="0.92" stroke-width="2.6"/>
    <path d="M430 412 q30 14 60 4 M440 428 q26 10 48 2" stroke-width="2" opacity="0.5"/>
    <text x="400" y="540" font-size="20" text-anchor="middle" fill="${INK}" stroke="none">wax cold since 1949 -- the frame kept it</text>
  </g>
`);

const cuSketchstop = closeupSvg('cuSS', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="140" y="90" width="520" height="380" fill="${PAPER}" fill-opacity="0.95" stroke-width="3.4" transform="rotate(-1.5 400 280)"/>
    <path d="M200 380 q40 -70 90 -10 q50 -60 96 -6 q-30 44 -92 22 q-56 26 -94 -6 Z" fill="${INK}" fill-opacity="0.5" stroke-width="2.4" transform="rotate(-1.5 400 280)"/>
    <path d="M300 260 q-8 -50 30 -58" stroke-width="2.4" transform="rotate(-1.5 400 280)"/>
    <path d="M370 340 l90 -22" stroke-width="3.4" transform="rotate(-1.5 400 280)"/>
    <path d="M460 318 l110 -30" stroke-width="3" opacity="0.6" transform="rotate(-1.5 400 280)"/>
    <path d="M460 318 q40 -6 56 8 q20 -4 34 -14" stroke-width="2.6" opacity="0.5" transform="rotate(-1.5 400 280)"/>
    <circle cx="470" cy="322" r="7" fill="${RUST}" fill-opacity="0.6" stroke-width="1.6" transform="rotate(-1.5 400 280)"/>
    <text x="560" y="440" font-size="19" fill="${RUST}" stroke="none" transform="rotate(-1.5 400 280)">10:47 -- dark</text>
    <text x="188" y="440" font-size="19" fill="${INK}" stroke="none" transform="rotate(-1.5 400 280)">11:21 -- the lamp relit mid-line</text>
    <ellipse cx="620" cy="500" rx="70" ry="26" fill="${GOLD}" fill-opacity="0.4" stroke-width="3"/>
    <path d="M600 500 h40 M620 486 v28" stroke-width="2.4" opacity="0.6"/>
  </g>
`);

const cuGhostdrafts = closeupSvg('cuGD', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="70" y="110" width="300" height="220" fill="${PAPER}" fill-opacity="0.9" stroke-width="3" transform="rotate(-2 220 220)"/>
    <path d="M100 260 q30 -46 62 -6 q34 -40 58 4 q-26 28 -58 10 q-30 22 -62 -8 Z" fill="${SAGE}" fill-opacity="0.5" stroke-width="2.4" transform="rotate(-2 220 220)"/>
    <path d="M120 200 q-8 -30 22 -34 M180 180 q-4 -22 18 -26" stroke-width="2" opacity="0.6" transform="rotate(-2 220 220)"/>
    <text x="100" y="300" font-size="17" fill="${INK}" stroke="none" transform="rotate(-2 220 220)">the ghost pencil</text>
    <rect x="420" y="96" width="310" height="236" fill="${PAPER}" fill-opacity="0.95" stroke-width="3" transform="rotate(1.5 575 214)"/>
    <path d="M450 262 q30 -46 62 -6 q34 -40 58 4 q-26 28 -58 10 q-30 22 -62 -8 Z" fill="${INK}" fill-opacity="0.6" stroke-width="2.6" transform="rotate(1.5 575 214)"/>
    <path d="M470 200 q-8 -30 22 -34 M530 180 q-4 -22 18 -26" stroke-width="2.4" opacity="0.7" transform="rotate(1.5 575 214)"/>
    <text x="452" y="306" font-size="17" fill="${INK}" stroke="none" transform="rotate(1.5 575 214)">the published ink</text>
    <rect x="120" y="380" width="380" height="130" fill="${COPPER}" fill-opacity="0.35" stroke-width="3.4"/>
    <path d="M140 420 h340 M140 444 h300" stroke-width="1.8" opacity="0.6"/>
    <rect x="150" y="400" width="80" height="52" fill="${PAPER}" fill-opacity="0.6" stroke-width="2" transform="rotate(-3 190 426)"/>
    <rect x="250" y="404" width="80" height="52" fill="${PAPER}" fill-opacity="0.55" stroke-width="2" transform="rotate(2 290 430)"/>
    <ellipse cx="580" cy="440" rx="70" ry="40" fill="${PAPER}" fill-opacity="0.85" stroke-width="3"/>
    <ellipse cx="580" cy="436" rx="54" ry="20" fill="${COPPER}" fill-opacity="0.5" stroke-width="2.4"/>
    <text x="580" y="502" font-size="17" text-anchor="middle" fill="${INK}" stroke="none">tea ages a drawing ten years</text>
    <path d="M540 400 q10 -18 34 -12" stroke-width="2.2" opacity="0.6"/>
  </g>
`);

const cuHoistin = closeupSvg('cuHT', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="150" y="150" width="500" height="330" rx="14" fill="${GOLD}" fill-opacity="0.45" stroke-width="5"/>
    <rect x="150" y="270" width="500" height="26" stroke-width="3.4" fill="${GOLD}" fill-opacity="0.3"/>
    <text x="400" y="212" font-size="21" text-anchor="middle" fill="${INK}" stroke="none">VICTOR BISCUITS</text>
    <path d="M170 300 h460" stroke-width="2" opacity="0.4"/>
    <rect x="200" y="312" width="150" height="90" fill="${PAPER}" fill-opacity="0.9" stroke-width="2.6" transform="rotate(-3 275 357)"/>
    <path d="M216 336 h118 M216 352 h96 M216 368 h108" stroke-width="1.8" opacity="0.7" transform="rotate(-3 275 357)"/>
    <text x="220" y="392" font-size="15" fill="${RUST}" stroke="none" transform="rotate(-3 275 357)">from the tin</text>
    <rect x="400" y="312" width="120" height="80" fill="${PAPER}" fill-opacity="0.85" stroke-width="2.6" transform="rotate(2 460 352)"/>
    <path d="M414 334 h92 M414 350 h72" stroke-width="1.8" opacity="0.7" transform="rotate(2 460 352)"/>
    <text x="412" y="376" font-size="15" fill="${INK}" stroke="none" transform="rotate(2 460 352)">E. B. owes</text>
    <rect x="560" y="312" width="70" height="86" fill="${PAPER}" fill-opacity="0.7" stroke-width="2.4" transform="rotate(-4 595 355)"/>
    <path d="M572 336 h46 M572 350 h40 M572 364 h44" stroke-width="1.6" opacity="0.7" transform="rotate(-4 595 355)"/>
    <text x="180" y="446" font-size="18" fill="${INK}" stroke="none">housekeeping money -- and the page she tore out</text>
    <path d="M480 440 q60 -12 130 0" stroke-width="2" opacity="0.5"/>
  </g>
`);

const cuCoalhatch = closeupSvg('cuCH', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    ${brickWall(id, 100, 500)}
    <path d="M560 110 L340 400 L340 500 L560 220 Z" fill="${NIGHT}" fill-opacity="0.35" stroke-width="5"/>
    <path d="M560 110 L340 400" stroke-width="7"/>
    <path d="M520 150 L360 370 M480 190 L380 340" stroke-width="3" opacity="0.6"/>
    <rect x="250" y="380" width="130" height="26" fill="${WOOD}" fill-opacity="0.6" stroke-width="3.4" transform="rotate(-38 315 393)"/>
    <path d="M270 372 l96 -60 M282 384 l96 -60" stroke-width="2" opacity="0.5" transform="rotate(-38 315 393)"/>
    <ellipse cx="360" cy="470" rx="120" ry="34" fill="${NIGHT}" fill-opacity="0.4" stroke-width="3"/>
    <path d="M260 470 q100 -22 200 0" stroke-width="2.4" opacity="0.6"/>
    <path d="M120 520 H700 M120 520 q290 -34 580 0" stroke-width="4"/>
    <path d="M150 556 q250 -20 500 0" stroke-width="2.4" opacity="0.5"/>
    <text x="400" y="560" font-size="20" text-anchor="middle" fill="${INK}" stroke="none">the dust lies whole -- no hand, no boot, no sack</text>
  </g>
`);

/* ------------------------------------------------------------ write files */

const roomFiles = {
  'attic_bg.svg': atticBg, 'attic_mid.svg': atticMid, 'attic_fg.svg': atticFg,
  'cellar_bg.svg': cellarBg, 'cellar_mid.svg': cellarMid, 'cellar_fg.svg': cellarFg,
  'laundry_bg.svg': laundryBg, 'laundry_mid.svg': laundryMid, 'laundry_fg.svg': laundryFg,
};

const cuFiles = {
  'cu_sketchbooks.svg': cuSketchbooks,
  'cu_keyhook.svg': cuKeyhook,
  'cu_candlestub.svg': cuCandlestub,
  'cu_sketchstop.svg': cuSketchstop,
  'cu_ghostdrafts.svg': cuGhostdrafts,
  'cu_hoistin.svg': cuHoistin,
  'cu_coalhatch.svg': cuCoalhatch,
};

let written = 0;
for (const [name, svg] of Object.entries(roomFiles)) {
  fs.writeFileSync(path.join(ART, name), svg);
  written++;
}
for (const [name, svg] of Object.entries(cuFiles)) {
  fs.writeFileSync(path.join(CU, name), svg);
  written++;
}
console.log(`gen-act4-art: wrote ${written} SVGs`);
