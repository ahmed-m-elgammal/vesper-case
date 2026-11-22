/**
 * Generates the Act 3 art: the study, Peggy's room, Edmund's room and the
 * bathroom (3 layers each, 2400x900) + 8 close-up insets (800x600).
 * Style mirrors the hand-authored Build One/Two art: paper #f4ecdb, ink
 * #2e2a33, feTurbulence wobble, blurred watercolour washes.
 *
 *   node scripts/gen-act3-art.js
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

let seedCounter = 1;
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
  // transparent overlays -- matches the hand-authored Build One/Two art).
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

function floorboards(id, y0 = 640) {
  const lines = [];
  for (let y = y0 + 26; y < 896; y += 46) lines.push(`<path d="M0 ${y} H2400" stroke-width="2" opacity="0.30"/>`);
  const seams = [];
  for (let i = 0; i < 14; i++) {
    const x = 120 + i * 175 + (i % 3) * 40;
    seams.push(`<path d="M${x} ${y0 + 10} V896" stroke-width="2" opacity="0.22"/>`);
  }
  return `<g filter="url(#${id}W)" stroke="${INK}" fill="none">${lines.join('')}${seams.join('')}</g>`;
}

function wainscot(id, y0 = 560) {
  return `<g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M0 ${y0} H2400" stroke-width="4.5"/>
    <path d="M0 ${y0 + 14} H2400" stroke-width="1.8" opacity="0.5"/>
    <path d="M0 626 H2400" stroke-width="2" opacity="0.4"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${i * 340 + 90} ${y0} V626" stroke-width="2" opacity="0.35"/>`).join('')}
  </g>`;
}

function rainWindow(id, x, y, w, h, curtain = true) {
  const bars = `<path d="M${x + w / 2} ${y} V${y + h} M${x} ${y + h * 0.42} H${x + w}" stroke-width="4"/>`;
  const rain = [
    [x + w * 0.16, y + 24], [x + w * 0.34, y + 40], [x + w * 0.6, y + 18], [x + w * 0.82, y + 44],
    [x + w * 0.24, y + h * 0.55], [x + w * 0.52, y + h * 0.6], [x + w * 0.78, y + h * 0.52],
  ].map(([rx, ry]) => `<path d="M${rx} ${ry} q5 44 -2 88" stroke="${PAPER}" stroke-width="2.2" opacity="0.55"/>`).join('');
  const cur = curtain
    ? `<path d="M${x - 46} ${y - 18} q44 66 8 ${h * 0.62} q-6 66 18 ${h * 0.4}" fill="${SAGE}" fill-opacity="0.5" stroke-width="3.6"/>
       <path d="M${x + w + 46} ${y - 18} q-44 66 -8 ${h * 0.62} q6 66 -18 ${h * 0.4}" fill="${SAGE}" fill-opacity="0.5" stroke-width="3.6"/>`
    : '';
  return `<g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linecap="round">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${BLUE}" fill-opacity="0.26" stroke-width="5"/>
    ${bars}${rain}
    <path d="M${x - 8} ${y + h} H${x + w + 8}" stroke-width="6"/>
    ${cur}
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

/* ------------------------------------------------------------ STUDY */

const studyBg = roomSvg('stB', [
  [400, 220, 240, 160, SAGE, 0.16], [1200, 200, 260, 170, GOLD, 0.13], [2050, 240, 220, 160, BLUE, 0.15],
  [700, 760, 320, 130, WOOD, 0.14], [1900, 780, 300, 120, NIGHT, 0.10],
], (id) => `
  ${doorway(id, 0)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M0 66 H2400 M0 96 H2400" stroke-width="7"/>
    <path d="M600 66 V96 M1400 66 V96" stroke-width="4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <rect x="120" y="140" width="420" height="420" fill="${WOOD}" fill-opacity="0.30" stroke-width="5"/>
    ${[230, 320, 410, 500].map((yy) => `<path d="M132 ${yy} H528" stroke-width="3.4"/>`).join('')}
    ${[0, 1, 2, 3].map((r) => Array.from({ length: 9 }, (_, i) =>
      `<rect x="${150 + i * 40}" y="${158 + r * 90}" width="26" height="${52 + (i % 3) * 8}" fill="${[SAGE, GOLD, BLUE, NIGHT][i % 4]}" fill-opacity="0.42" stroke-width="2"/>`).join('')).join('')}
  </g>
  ${rainWindow(id, 820, 140, 300, 340)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <rect x="1520" y="300" width="380" height="280" fill="${NIGHT}" fill-opacity="0.20" stroke-width="5"/>
    <rect x="1560" y="264" width="300" height="40" fill="${WOOD}" fill-opacity="0.5" stroke-width="4"/>
    <path d="M1520 300 H1900" stroke-width="6"/>
    <path d="M1600 330 q60 90 30 210 M1750 340 q-30 100 20 180" stroke-width="2.4" opacity="0.4"/>
  </g>
  ${wainscot(id)}
  ${floorboards(id)}
`);

const studyMid = roomSvg('stM', [
  [800, 620, 380, 120, WOOD, 0.22], [1500, 380, 160, 140, GOLD, 0.16], [2050, 460, 200, 110, SAGE, 0.14],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="460" y="460" width="660" height="36" fill="${WOOD}" fill-opacity="0.55" stroke-width="5"/>
    <path d="M500 496 V700 M1080 496 V700" stroke-width="8"/>
    <path d="M460 540 H1120" stroke-width="2.4" opacity="0.5"/>
    <path d="M460 620 H1120" stroke-width="2.4" opacity="0.5"/>
    <rect x="520" y="400" width="90" height="60" fill="${WOOD}" fill-opacity="0.5" stroke-width="4"/>
    <path d="M565 400 q0 -26 24 -26 M589 374 V366" stroke-width="4"/>
    <path d="M640 430 q80 -14 170 -2" stroke-width="3" opacity="0.6"/>
    <rect x="960" y="408" width="60" height="52" fill="${GOLD}" fill-opacity="0.4" stroke-width="3.5"/>
    <path d="M975 408 V388 M975 388 q10 -8 20 0" stroke-width="3"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="565" y="452" width="170" height="26" rx="6" fill="${NIGHT}" fill-opacity="0.28" stroke-width="3.4"/>
    <path d="M600 452 q40 -8 90 0" stroke-width="2" opacity="0.5"/>
    <path d="M820 446 l70 -10 M828 462 l84 -6" stroke-width="2.4" opacity="0.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1150 430 q60 -18 150 0 l-16 230 q-60 18 -120 0 Z" fill="${SAGE}" fill-opacity="0.35" stroke-width="5"/>
    <path d="M1160 470 q66 -14 130 0 M1156 520 q70 -14 138 0" stroke-width="2.4" opacity="0.5"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1188 620 q50 -16 104 0 l-12 104 q-42 14 -82 0 Z" fill="${WOOD}" fill-opacity="0.45" stroke-width="4.5"/>
    <path d="M1196 636 q42 -10 88 0" stroke-width="2.2" opacity="0.55"/>
    <path d="M1214 600 q20 -22 44 -8 q-6 -20 14 -26 q-4 -18 16 -18 q18 -2 16 16 q16 8 8 24 q12 12 -4 22 q-2 14 -22 12 q-24 8 -40 -6 q-22 -2 -20 -16 Z" fill="${PAPER}" fill-opacity="0.85" stroke-width="2.6"/>
    <path d="M1258 570 l54 -16 M1252 586 l60 -10" stroke-width="2" opacity="0.7"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="1420" y="230" width="230" height="250" fill="${NIGHT}" fill-opacity="0.34" stroke-width="6"/>
    <rect x="1436" y="246" width="198" height="218" fill="${NIGHT}" fill-opacity="0.42" stroke-width="3"/>
    <rect x="1450" y="330" width="170" height="120" fill="${PAPER}" fill-opacity="0.9" stroke-width="3"/>
    <path d="M1450 330 h170 v120 h-170 Z M1452 352 h166 M1452 374 h166 M1452 396 h166" stroke-width="1.8" opacity="0.7"/>
    <text x="1536" y="322" font-size="19" text-anchor="middle" fill="${INK}" stroke="none">40 -- 43</text>
    <rect x="1382" y="252" width="44" height="210" rx="8" fill="${SAGE}" fill-opacity="0.5" stroke-width="4" transform="rotate(-4 1404 357)"/>
    <circle cx="1650" cy="466" r="10" fill="${GOLD}" fill-opacity="0.7" stroke-width="3"/>
    <path d="M1400 176 h270 v72 h-270 Z" fill="${PAPER}" fill-opacity="0.85" stroke-width="5" transform="rotate(-5 1535 212)"/>
    <path d="M1490 214 q24 -34 54 -2 q30 -30 52 0 q-20 30 -52 14 q-30 22 -54 -12 Z" fill="${RUST}" fill-opacity="0.4" stroke-width="2.6" transform="rotate(-5 1535 212)"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1850 500 H2260" stroke-width="7"/>
    <path d="M1870 500 V540 M2230 500 V540" stroke-width="5"/>
    <rect x="1874" y="430" width="44" height="70" fill="${SAGE}" fill-opacity="0.45" stroke-width="3"/>
    <rect x="1926" y="444" width="34" height="56" fill="${GOLD}" fill-opacity="0.45" stroke-width="3"/>
    <path d="M1980 442 q22 -34 44 0 q-22 30 -44 0 Z" fill="${BLUE}" fill-opacity="0.4" stroke-width="2.6"/>
    <path d="M1996 476 V500" stroke-width="3"/>
    <rect x="2016" y="386" width="112" height="114" rx="14" fill="${GOLD}" fill-opacity="0.5" stroke-width="4.5"/>
    <path d="M2016 430 h112" stroke-width="2.6" opacity="0.7"/>
    <ellipse cx="2072" cy="456" rx="44" ry="10" fill="${PAPER}" fill-opacity="0.7" stroke-width="2.4"/>
    <circle cx="2056" cy="456" r="7" fill="${WOOD}" fill-opacity="0.8" stroke-width="2"/>
    <circle cx="2088" cy="456" r="7" fill="${WOOD}" fill-opacity="0.8" stroke-width="2"/>
    <path d="M2148 500 q-6 -84 0 -96 q16 -10 30 2 q8 60 4 94 Z" fill="${PAPER}" fill-opacity="0.8" stroke-width="3"/>
    <path d="M2154 430 h26 M2154 446 h26" stroke-width="1.8" opacity="0.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" opacity="0.9">
    <ellipse cx="820" cy="800" rx="560" ry="56" fill="${RUST}" fill-opacity="0.14" stroke-width="3"/>
    <ellipse cx="820" cy="800" rx="380" ry="34" fill="none" stroke-width="2.4" opacity="0.5"/>
  </g>
`);

const studyFg = roomSvg('stF', [[1200, 860, 900, 160, NIGHT, 0.10]], (id) => vignette(id));

/* ------------------------------------------------------------ PEGGY */

const peggyBg = roomSvg('pgB', [
  [500, 240, 260, 170, GOLD, 0.14], [1300, 220, 240, 160, SAGE, 0.15], [1950, 300, 220, 160, BLUE, 0.16],
  [900, 780, 320, 120, WOOD, 0.12],
], (id) => `
  ${doorway(id, 0)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${300 + i * 360} 0 V560" stroke-width="3" opacity="0.28"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${330 + i * 360} 0 V560" stroke-width="10" opacity="0.14"/>`).join('')}
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <rect x="180" y="160" width="200" height="150" fill="${PAPER}" fill-opacity="0.7" stroke-width="4"/>
    <path d="M210 220 q60 -44 140 -6" stroke-width="2.4" opacity="0.5"/>
    <rect x="470" y="150" width="170" height="130" fill="${PAPER}" fill-opacity="0.7" stroke-width="4"/>
    <path d="M500 200 q50 -36 116 -4" stroke-width="2.2" opacity="0.5"/>
  </g>
  ${rainWindow(id, 1700, 120, 320, 360)}
  ${wainscot(id)}
  ${floorboards(id)}
`);

const peggyMid = roomSvg('pgM', [
  [1850, 560, 420, 150, SAGE, 0.24], [760, 600, 260, 110, GOLD, 0.20], [1240, 560, 140, 90, WOOD, 0.18],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M620 520 H880 M640 520 V680 M860 520 V680" stroke-width="6"/>
    <path d="M620 520 q130 -18 260 0" stroke-width="4"/>
    <path d="M640 680 H860" stroke-width="5"/>
    <path d="M700 490 q-8 -56 24 -52 q30 -4 24 44 q26 6 16 38 Z" fill="${SAGE}" fill-opacity="0.5" stroke-width="3.4"/>
    <path d="M736 486 q40 -22 96 -8 l-6 34 q-52 12 -90 -2 Z" fill="${PAPER}" fill-opacity="0.9" stroke-width="3"/>
    <path d="M744 486 h78 M748 498 h70" stroke-width="1.8" opacity="0.7"/>
    <rect x="820" y="466" width="44" height="34" fill="${PAPER}" fill-opacity="0.8" stroke-width="2.6"/>
    <path d="M826 476 h32 M826 486 h28" stroke-width="1.6" opacity="0.7"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="1150" y="470" width="180" height="30" fill="${WOOD}" fill-opacity="0.55" stroke-width="5"/>
    <path d="M1170 500 V680 M1310 500 V680" stroke-width="7"/>
    <rect x="1198" y="530" width="90" height="80" fill="${WOOD}" fill-opacity="0.35" stroke-width="3"/>
    <circle cx="1243" cy="570" r="7" fill="${GOLD}" fill-opacity="0.7" stroke-width="2.4"/>
    <path d="M1218 470 v-18 q0 -10 12 -10 h26 q12 0 12 10 v18" fill="${GOLD}" fill-opacity="0.5" stroke-width="3.4"/>
    <rect x="1232" y="404" width="24" height="40" fill="${PAPER}" fill-opacity="0.85" stroke-width="3"/>
    <path d="M1244 404 v-58" stroke-width="3.4"/>
    <ellipse cx="1244" cy="392" rx="34" ry="14" fill="${PAPER}" fill-opacity="0.9" stroke-width="2.2"/>
    <path d="M1222 430 q22 10 44 0 q-4 18 -22 18 q-18 0 -22 -18 Z" fill="${PAPER}" fill-opacity="0.95" stroke-width="2.6"/>
    <path d="M1244 446 V470" stroke-width="2.6"/>
    <path d="M1210 470 q34 6 68 0" stroke-width="1.8" opacity="0.5"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1450 420 V700 M2250 340 V700" stroke-width="9"/>
    <path d="M1450 460 H2250" stroke-width="6"/>
    <path d="M1450 620 H2250" stroke-width="6"/>
    <path d="M1450 620 L2250 700" stroke-width="3" opacity="0.4"/>
    <path d="M1450 460 q-24 80 0 160" stroke-width="4"/>
    <path d="M2160 340 q90 -10 90 60 v300" fill="none" stroke-width="9"/>
    <path d="M1470 460 h740 l-30 120 h-680 Z" fill="${SAGE}" fill-opacity="0.4" stroke-width="4"/>
    <path d="M1500 580 h660 l-40 40 h-580 Z" fill="${SAGE}" fill-opacity="0.3" stroke-width="3.4"/>
    <path d="M1520 470 q80 30 200 18 M1900 500 q110 -8 220 24" stroke-width="2.4" opacity="0.6"/>
    <path d="M1560 380 q90 -30 180 -6 q90 -22 170 10 q-80 34 -170 18 q-90 16 -180 -22 Z" fill="${PAPER}" fill-opacity="0.9" stroke-width="3.4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1720 420 l90 6 M1716 436 l96 4" stroke-width="2.6" opacity="0.8"/>
    <path d="M1700 402 q46 -18 116 -2 l-10 26 q-48 10 -96 -4 Z" fill="${PAPER}" fill-opacity="0.85" stroke-width="3"/>
    <path d="M1710 410 h92 M1714 420 h84" stroke-width="1.6" opacity="0.7"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" opacity="0.9">
    <ellipse cx="1300" cy="810" rx="620" ry="52" fill="${BLUE}" fill-opacity="0.16" stroke-width="3"/>
  </g>
`);

const peggyFg = roomSvg('pgF', [[1200, 860, 900, 160, NIGHT, 0.10]], (id) => vignette(id));

/* ------------------------------------------------------------ EDMUND */

const edmundBg = roomSvg('edB', [
  [420, 220, 240, 160, NIGHT, 0.13], [1150, 200, 260, 160, BLUE, 0.15], [2000, 260, 240, 160, SAGE, 0.13],
  [1600, 770, 340, 120, WOOD, 0.12],
], (id) => `
  ${doorway(id, 0)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M0 84 H2400" stroke-width="6"/>
    <rect x="320" y="160" width="180" height="140" fill="${PAPER}" fill-opacity="0.7" stroke-width="4"/>
    <rect x="540" y="160" width="180" height="140" fill="${PAPER}" fill-opacity="0.7" stroke-width="4"/>
    <rect x="760" y="160" width="180" height="140" fill="${PAPER}" fill-opacity="0.7" stroke-width="4"/>
    <path d="M360 230 q30 -44 90 -6 q30 -40 70 4" stroke-width="2.6" opacity="0.6"/>
    <path d="M580 226 q26 -40 80 -2 q28 -34 64 6" stroke-width="2.6" opacity="0.6"/>
    <path d="M800 232 q34 -42 84 -4 q26 -36 66 8" stroke-width="2.6" opacity="0.6"/>
    <path d="M410 268 h60 M630 264 h56 M850 270 h58" stroke-width="2" opacity="0.5"/>
  </g>
  ${rainWindow(id, 1780, 130, 300, 340)}
  ${wainscot(id)}
  ${floorboards(id)}
`);

const edmundMid = roomSvg('edM', [
  [1900, 560, 420, 150, BLUE, 0.22], [1240, 560, 160, 100, WOOD, 0.20], [480, 600, 280, 110, GOLD, 0.16],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M250 400 H700 M250 400 V680 M700 400 V680" stroke-width="7"/>
    <path d="M250 400 q225 -16 450 0" stroke-width="4"/>
    <path d="M270 470 H680 M270 560 H680" stroke-width="2.6" opacity="0.5"/>
    <circle cx="300" cy="530" r="9" fill="${GOLD}" fill-opacity="0.7" stroke-width="2.4"/>
    <circle cx="640" cy="530" r="9" fill="${GOLD}" fill-opacity="0.7" stroke-width="2.4"/>
    <rect x="330" y="330" width="150" height="70" fill="${WOOD}" fill-opacity="0.45" stroke-width="4"/>
    <rect x="356" y="344" width="98" height="44" fill="${PAPER}" fill-opacity="0.85" stroke-width="2.6"/>
    <path d="M368 358 q30 -22 76 -6 M372 372 q26 -16 68 -4" stroke-width="1.8" opacity="0.7"/>
    <ellipse cx="406" cy="356" rx="9" ry="14" fill="${SAGE}" fill-opacity="0.6" stroke-width="2.2"/>
    <path d="M760 340 q-20 120 6 220" fill="none" stroke-width="6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="1130" y="470" width="190" height="30" fill="${WOOD}" fill-opacity="0.55" stroke-width="5"/>
    <path d="M1150 500 V680 M1300 500 V680" stroke-width="7"/>
    <rect x="1160" y="540" width="110" height="90" fill="${WOOD}" fill-opacity="0.35" stroke-width="3"/>
    <circle cx="1215" cy="585" r="8" fill="${GOLD}" fill-opacity="0.7" stroke-width="2.4"/>
    <path d="M1178 470 q66 -14 134 0" stroke-width="3" opacity="0.6"/>
    <path d="M1180 452 q56 -12 112 0 l-8 20 q-48 10 -96 0 Z" fill="${WOOD}" fill-opacity="0.75" stroke-width="3.6"/>
    <path d="M1186 456 h96" stroke-width="1.8" opacity="0.7"/>
    <path d="M1184 456 q-4 20 0 34 M1272 456 q6 22 2 38" stroke-width="3"/>
    <path d="M1190 470 q40 -8 78 -2 M1192 478 q36 -6 74 -2" stroke-width="1.7" opacity="0.75"/>
    <path d="M1290 470 q-4 90 6 160" stroke-width="3" opacity="0.85"/>
    <circle cx="1297" cy="636" r="12" fill="${GOLD}" fill-opacity="0.6" stroke-width="2.6"/>
    <circle cx="1297" cy="636" r="4" fill="${NIGHT}" fill-opacity="0.8" stroke-width="1.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1550 430 V700 M2250 430 V700" stroke-width="9"/>
    <path d="M1550 470 H2250" stroke-width="6"/>
    <path d="M1550 640 H2250" stroke-width="6"/>
    <path d="M1550 470 q-20 86 0 170" stroke-width="4"/>
    <path d="M2250 430 q-80 -12 -80 56 v214" fill="none" stroke-width="9"/>
    <path d="M1580 470 h640 l-26 130 h-588 Z" fill="${BLUE}" fill-opacity="0.32" stroke-width="4"/>
    <path d="M1600 600 h600 l-44 40 h-516 Z" fill="${BLUE}" fill-opacity="0.24" stroke-width="3.4"/>
    <path d="M1620 480 h560 M1610 560 h580" stroke-width="2.2" opacity="0.5"/>
    <path d="M1590 430 q100 -26 200 -8 q100 -18 190 12 q-90 30 -190 16 q-100 14 -200 -20 Z" fill="${PAPER}" fill-opacity="0.9" stroke-width="3.4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" opacity="0.9">
    <ellipse cx="1250" cy="812" rx="600" ry="50" fill="${WOOD}" fill-opacity="0.16" stroke-width="3"/>
  </g>
`);

const edmundFg = roomSvg('edF', [[1200, 860, 900, 160, NIGHT, 0.10]], (id) => vignette(id));

/* ------------------------------------------------------------ BATH */

const bathBg = roomSvg('baB', [
  [500, 240, 240, 170, BLUE, 0.17], [1400, 220, 260, 160, SAGE, 0.14], [2000, 300, 220, 150, NIGHT, 0.10],
  [1100, 800, 400, 110, BLUE, 0.10],
], (id) => `
  ${doorway(id, 0)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M0 480 H2400" stroke-width="6"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((r) => `<path d="M0 ${540 + r * 56} H2400" stroke-width="2.4" opacity="0.3"/>`).join('')}
    ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map((c) => `<path d="M${c * 150 + (c % 2) * 40} 480 V900" stroke-width="2.4" opacity="0.26"/>`).join('')}
    <path d="M0 500 H2400" stroke-width="3" opacity="0.5"/>
  </g>
  ${rainWindow(id, 700, 140, 260, 300, false)}
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M620 130 q150 -22 330 -4" stroke-width="5" opacity="0.7"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none">
    <path d="M1750 130 V480 M2000 130 V480 M1750 130 H2000" stroke-width="4" opacity="0.5"/>
    <path d="M1770 170 V440 M2020 170 V440" stroke-width="2" opacity="0.35"/>
  </g>
`);

const bathMid = roomSvg('baM', [
  [620, 600, 320, 120, SAGE, 0.22], [1400, 380, 200, 130, BLUE, 0.18], [1050, 580, 160, 90, WOOD, 0.16],
], (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M360 470 q-40 160 40 220 q140 40 300 6 q60 -60 30 -226" fill="${PAPER}" fill-opacity="0.6" stroke-width="6"/>
    <path d="M400 470 q-26 130 30 176 q120 34 250 6 q48 -50 26 -182" fill="none" stroke-width="3" opacity="0.6"/>
    <path d="M330 470 h430" stroke-width="7"/>
    <path d="M430 690 q-16 34 16 44 q34 -8 20 -44 M700 686 q-14 36 18 46 q34 -10 18 -46" stroke-width="5"/>
    <path d="M380 500 q120 -26 320 -10" stroke-width="2.4" opacity="0.5"/>
    <path d="M560 460 q120 -20 210 12 l-30 60 q-90 20 -150 0 Z" fill="${PAPER}" fill-opacity="0.85" stroke-width="3"/>
    <path d="M600 470 q60 -8 130 6" stroke-width="2" opacity="0.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M980 470 H1160 M1000 470 V700 M1140 470 V700" stroke-width="6"/>
    <path d="M980 470 q90 -14 180 0" stroke-width="4"/>
    <path d="M1000 560 H1140" stroke-width="2.4" opacity="0.5"/>
    <path d="M1010 420 q30 -50 60 -4 q40 -10 34 40 q-50 16 -94 0 Z" fill="${BLUE}" fill-opacity="0.4" stroke-width="3.4"/>
    <ellipse cx="1090" cy="462" rx="42" ry="12" fill="${PAPER}" fill-opacity="0.9" stroke-width="3"/>
    <path d="M1054 462 q36 -10 72 0" stroke-width="1.8" opacity="0.6"/>
    <path d="M1064 410 V446 M1116 410 V446" stroke-width="3"/>
    <rect x="1078" y="398" width="30" height="14" fill="${PAPER}" fill-opacity="0.8" stroke-width="2.2"/>
    <path d="M1104 508 q40 -8 62 4 l-6 30 q-34 10 -56 -4 Z" fill="${WOOD}" fill-opacity="0.5" stroke-width="2.8"/>
    <path d="M1110 516 h48 M1112 526 h44" stroke-width="1.5" opacity="0.7"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="1290" y="230" width="240" height="300" fill="${PAPER}" fill-opacity="0.5" stroke-width="6"/>
    <rect x="1310" y="250" width="200" height="260" fill="${BLUE}" fill-opacity="0.18" stroke-width="4"/>
    <path d="M1290 230 l-54 26 v270 l54 24" fill="${SAGE}" fill-opacity="0.35" stroke-width="5"/>
    <path d="M1236 258 v268" stroke-width="2.4" opacity="0.5"/>
    <path d="M1530 260 h-18 M1530 500 h-18" stroke-width="4"/>
    <circle cx="1522" cy="384" r="9" fill="${GOLD}" fill-opacity="0.7" stroke-width="2.6"/>
    <path d="M1316 330 H1504 M1316 408 H1504" stroke-width="4"/>
    <rect x="1326" y="282" width="30" height="48" fill="${SAGE}" fill-opacity="0.5" stroke-width="2.6"/>
    <rect x="1364" y="288" width="24" height="42" fill="${BLUE}" fill-opacity="0.5" stroke-width="2.6"/>
    <rect x="1326" y="360" width="34" height="48" fill="${GOLD}" fill-opacity="0.5" stroke-width="2.6"/>
    <rect x="1330" y="356" width="26" height="8" fill="${PAPER}" fill-opacity="0.9" stroke-width="1.8"/>
    <rect x="1370" y="366" width="24" height="42" fill="${PAPER}" fill-opacity="0.75" stroke-width="2.6"/>
    <path d="M1410 356 q20 -24 40 0 q-20 20 -40 0 Z" fill="${WOOD}" fill-opacity="0.4" stroke-width="2.2"/>
    <path d="M1444 360 q18 -20 36 0 q-18 18 -36 0 Z" fill="${SAGE}" fill-opacity="0.4" stroke-width="2.2"/>
    <rect x="1330" y="428" width="52" height="34" fill="${WOOD}" fill-opacity="0.5" stroke-width="2.8"/>
    <path d="M1336 438 h42 M1336 448 h40" stroke-width="1.5" opacity="0.7"/>
    <path d="M1398 434 h60 M1400 448 h56" stroke-width="2" opacity="0.6"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M1720 420 H2060" stroke-width="7"/>
    <path d="M1740 420 V440 M2040 420 V440" stroke-width="5"/>
    <path d="M1760 420 q-8 110 10 150 q60 20 120 0 q20 -50 12 -150" fill="${SAGE}" fill-opacity="0.4" stroke-width="4.5"/>
    <path d="M1790 440 q-6 80 8 110 M1900 436 q6 84 -8 116" stroke-width="2" opacity="0.5"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" opacity="0.9">
    <ellipse cx="700" cy="806" rx="420" ry="42" fill="${BLUE}" fill-opacity="0.14" stroke-width="3"/>
    <ellipse cx="1880" cy="800" rx="330" ry="36" fill="${SAGE}" fill-opacity="0.14" stroke-width="3"/>
  </g>
`);

const bathFg = roomSvg('baF', [[1200, 860, 900, 160, NIGHT, 0.10]], (id) => vignette(id));

/* ------------------------------------------------------------ close-ups */

function anno(id, x, y, text, size = 30) {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${INK}" stroke="none" opacity="0.85" transform="rotate(-3 ${x} ${y})">${text}</text>`;
}

const cuCandle = closeupSvg('cuCa', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M60 470 Q400 448 740 468 L740 548 Q400 566 60 550 Z" fill="${WOOD}" fill-opacity="0.45" stroke-width="4"/>
    <path d="M100 500 Q400 482 700 498 M120 528 Q400 512 680 526" stroke-width="1.8" opacity="0.3"/>
    <path d="M300 470 v-24 q0 -12 14 -12 h40 q14 0 14 12 v24" fill="${GOLD}" fill-opacity="0.5" stroke-width="3.5"/>
    <rect x="330" y="330" width="44" height="104" fill="${PAPER}" fill-opacity="0.95" stroke-width="3.5"/>
    <path d="M330 380 q22 -10 44 0" stroke-width="2" opacity="0.5"/>
    <path d="M322 380 q30 12 60 0 q-2 22 -30 22 q-28 0 -30 -22 Z" fill="${PAPER}" fill-opacity="0.98" stroke-width="2.8"/>
    <path d="M352 402 V470" stroke-width="3"/>
    <ellipse cx="352" cy="300" rx="30" ry="12" fill="${PAPER}" fill-opacity="0.9" stroke-width="2"/>
    <path d="M338 336 h28" stroke-width="2.4" opacity="0.8"/>
    <path d="M318 380 h68" stroke-width="2.6"/>
    <path d="M470 320 q34 -18 66 -2" stroke-width="2.6" opacity="0.8"/>
    ${anno(id, 500, 306, 'the flame died here --')}
    ${anno(id, 508, 340, "the eleven-o'clock mark")}
    <path d="M462 322 L392 356" stroke-width="2.4" opacity="0.8"/>
    <path d="M120 220 q60 -30 130 -4 l-8 120 q-70 20 -122 -8 Z" fill="${PAPER}" fill-opacity="0.8" stroke-width="3"/>
    <path d="M132 244 h104 M134 268 h100" stroke-width="1.7" opacity="0.6"/>
    ${anno(id, 96, 196, 'the novel, bookmark at 11')}
    <circle cx="620" cy="480" r="26" fill="${SAGE}" fill-opacity="0.4" stroke-width="2.6"/>
    <path d="M600 470 q20 -14 40 0" stroke-width="1.8" opacity="0.6"/>
    ${anno(id, 560, 430, 'sewing thread')}
  </g>
`);

const cuIous = closeupSvg('cuIo', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M80 120 q320 -26 640 0 l-14 380 q-306 22 -612 0 Z" fill="${PAPER}" fill-opacity="0.92" stroke-width="3.5"/>
    <text x="120" y="170" font-size="30" letter-spacing="4" fill="${INK}" stroke="none">MERIDIAN CREDIT &amp; LOAN</text>
    <path d="M120 186 H680" stroke-width="2.6"/>
    <text x="120" y="222" font-size="20" fill="${INK}" stroke="none" opacity="0.8">re: account of Mrs. M. Vesper-Croft</text>
    <text x="120" y="256" font-size="20" fill="${INK}" stroke="none" opacity="0.8">final demand -- settlement within 14 days</text>
    <rect x="420" y="280" width="240" height="110" fill="none" stroke="${RUST}" stroke-width="6" opacity="0.8" transform="rotate(-8 540 335)"/>
    <text x="452" y="330" font-size="44" fill="${RUST}" stroke="none" opacity="0.85" transform="rotate(-8 540 335)">FINAL</text>
    <text x="452" y="368" font-size="30" fill="${RUST}" stroke="none" opacity="0.8" transform="rotate(-8 540 335)">NOTICE</text>
    <path d="M110 420 H300 M110 450 H260 M110 480 H290" stroke-width="2" opacity="0.5"/>
    <path d="M96 140 q-20 200 10 340" stroke-width="2" opacity="0.4"/>
  </g>
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M580 430 q90 -10 140 8 l-10 96 q-70 14 -128 -6 Z" fill="${PAPER}" fill-opacity="0.95" stroke-width="2.6"/>
    ${anno(id, 588, 468, 'IOU -- £4, to J.', 20)}
    ${anno(id, 588, 502, 'IOU -- £10, the rent', 20)}
    <path d="M320 470 q80 -14 170 0 l-8 84 q-80 14 -158 -2 Z" fill="${PAPER}" fill-opacity="0.95" stroke-width="2.6"/>
    ${anno(id, 330, 510, 'IOUs, her own hand', 20)}
  </g>
`);

const cuJournal = closeupSvg('cuJo', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M120 110 q280 -22 560 0 l16 380 q-296 22 -592 0 Z" fill="${WOOD}" fill-opacity="0.55" stroke-width="4.5"/>
    <path d="M150 130 q260 -18 500 0 l14 344 q-264 20 -528 0 Z" fill="${PAPER}" fill-opacity="0.94" stroke-width="3"/>
    <path d="M400 132 V474" stroke-width="2.4" opacity="0.5"/>
    <path d="M170 190 H386 M170 226 H380 M170 262 H384 M170 298 H372" stroke-width="2.2" opacity="0.8"/>
    <path d="M414 190 H630 M414 226 H622 M414 262 H606" stroke-width="2.2" opacity="0.8"/>
    ${anno(id, 150, 178, 'R. drew the fox first.', 22)}
    ${anno(id, 412, 178, 'The safe keeps her pages.', 22)}
    ${anno(id, 168, 336, 'mine to keep until the', 22)}
    ${anno(id, 168, 370, 'preface says so out loud', 22)}
    <path d="M520 330 q26 -38 58 -4 q34 -34 60 2 q-24 36 -58 16 q-36 22 -60 -14 Z" fill="${RUST}" fill-opacity="0.35" stroke-width="2.6"/>
    ${anno(id, 470, 396, 'the little key --', 22)}
    ${anno(id, 478, 430, 'on the ribbon', 22)}
    <path d="M400 474 q-4 60 8 96" stroke-width="3" opacity="0.85"/>
    <circle cx="410" cy="578" r="13" fill="${GOLD}" fill-opacity="0.6" stroke-width="2.6"/>
    <circle cx="410" cy="578" r="4.5" fill="${NIGHT}" fill-opacity="0.8" stroke-width="1.6"/>
    ${anno(id, 436, 570, 'still there')}
    <text x="596" y="520" font-size="22" fill="${INK}" stroke="none" opacity="0.6">E.V.</text>
  </g>
`);

const cuCabinet = closeupSvg('cuCa2', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="140" y="90" width="520" height="440" fill="${PAPER}" fill-opacity="0.6" stroke-width="5"/>
    <rect x="160" y="110" width="480" height="400" fill="${BLUE}" fill-opacity="0.16" stroke-width="3.5"/>
    <path d="M160 250 H640 M160 382 H640" stroke-width="4"/>
    <rect x="176" y="150" width="46" height="100" fill="${SAGE}" fill-opacity="0.55" stroke-width="3"/>
    <rect x="186" y="140" width="26" height="12" fill="${WOOD}" fill-opacity="0.7" stroke-width="2"/>
    <text x="199" y="196" font-size="13" text-anchor="middle" fill="${INK}" stroke="none">TONIC</text>
    <path d="M184 210 h30 M186 220 h26" stroke-width="1.4" opacity="0.7"/>
    <rect x="240" y="162" width="40" height="88" fill="${BLUE}" fill-opacity="0.5" stroke-width="3"/>
    <rect x="248" y="152" width="24" height="12" fill="${WOOD}" fill-opacity="0.7" stroke-width="2"/>
    <text x="260" y="200" font-size="12" text-anchor="middle" fill="${INK}" stroke="none">ASPIRIN</text>
    <rect x="300" y="154" width="52" height="96" fill="${GOLD}" fill-opacity="0.55" stroke-width="3"/>
    <rect x="306" y="144" width="40" height="12" fill="${WOOD}" fill-opacity="0.7" stroke-width="2"/>
    <rect x="304" y="180" width="44" height="40" fill="${PAPER}" fill-opacity="0.95" stroke-width="2"/>
    <text x="326" y="196" font-size="11" text-anchor="middle" fill="${INK}" stroke="none">DIGITALIS</text>
    <text x="326" y="210" font-size="10" text-anchor="middle" fill="${INK}" stroke="none">five drops</text>
    <path d="M380 160 q22 -30 44 0 q-22 24 -44 0 Z" fill="${WOOD}" fill-opacity="0.4" stroke-width="2.2"/>
    <path d="M440 164 q20 -26 40 0 q-20 22 -40 0 Z" fill="${SAGE}" fill-opacity="0.4" stroke-width="2.2"/>
    <text x="470" y="140" font-size="18" fill="${INK}" stroke="none" opacity="0.75">her hand, every label</text>
    <rect x="180" y="290" width="120" height="80" fill="${WOOD}" fill-opacity="0.5" stroke-width="3"/>
    <text x="240" y="322" font-size="14" text-anchor="middle" fill="${INK}" stroke="none">receipt book</text>
    <path d="M190 336 h96 M190 350 h92" stroke-width="1.4" opacity="0.6"/>
    ${anno(id, 320, 336, 'refilled monthly')}
    <path d="M470 300 q60 -16 120 0" stroke-width="2.2" opacity="0.5"/>
    <rect x="176" y="420" width="52" height="74" fill="${PAPER}" fill-opacity="0.8" stroke-width="2.6"/>
    <rect x="240" y="426" width="44" height="68" fill="${PAPER}" fill-opacity="0.8" stroke-width="2.6"/>
    <path d="M176 440 h52 M240 446 h44" stroke-width="1.6" opacity="0.5"/>
    ${anno(id, 306, 470, 'lint &amp; bandages')}
    <text x="160" y="560" font-size="22" fill="${INK}" stroke="none" opacity="0.7">Everything ordinary. Everything hers.</text>
  </g>
`);

const cuBlotter = closeupSvg('cuBl', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M90 150 q310 -24 620 0 l-16 330 q-294 22 -588 0 Z" fill="${NIGHT}" fill-opacity="0.34" stroke-width="4"/>
    <path d="M120 170 q280 -18 560 0 l-12 292 q-268 18 -536 0 Z" fill="${NIGHT}" fill-opacity="0.28" stroke-width="2.5"/>
    <path d="M110 170 q290 -20 580 0" stroke-width="3" opacity="0.6"/>
    <ellipse cx="400" cy="330" rx="250" ry="150" fill="${SAGE}" fill-opacity="0.30" stroke-width="3"/>
    <ellipse cx="400" cy="330" rx="210" ry="120" fill="${SAGE}" fill-opacity="0.18" stroke-width="2"/>
    ${anno(id, 210, 260, 'under the torch --')}
    ${anno(id, 236, 306, 'I never meant -- the memoir --')}
    ${anno(id, 206, 346, 'let me make it right by Christmas,')}
    ${anno(id, 250, 386, "only don't go to the societies.")}
    ${anno(id, 456, 428, '-- J.A.')}
    <g transform="rotate(24 640 120)">
      <rect x="612" y="96" width="26" height="64" rx="10" fill="${NIGHT}" fill-opacity="0.7" stroke-width="3"/>
      <circle cx="625" cy="88" r="17" fill="${SAGE}" fill-opacity="0.7" stroke-width="3"/>
      <path d="M613 160 v40 M637 160 v36" stroke-width="4"/>
    </g>
    <path d="M648 128 q-60 60 -170 130" stroke="${SAGE}" stroke-width="2.4" fill="none" opacity="0.6"/>
    ${anno(id, 96, 560, 'a shaking hand, pressed deep')}
  </g>
`);

const cuReceipt = closeupSvg('cuRe', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <path d="M170 110 q230 -18 460 0 l-10 340 q-220 18 -440 0 Z" fill="${PAPER}" fill-opacity="0.95" stroke-width="3"/>
    <path d="M180 140 q210 -14 430 0 M186 200 q200 -12 420 0 M182 260 q214 -14 428 0 M188 320 q198 -12 416 0 M184 380 q220 -14 436 0" stroke-width="1.6" opacity="0.35"/>
    <path d="M214 150 q-18 130 8 260" stroke-width="1.8" opacity="0.5"/>
    <path d="M580 150 q22 140 -6 262" stroke-width="1.8" opacity="0.5"/>
    <text x="230" y="190" font-size="24" letter-spacing="2" fill="${INK}" stroke="none">THE BELL &amp; CURTAIN</text>
    <text x="230" y="222" font-size="17" fill="${INK}" stroke="none" opacity="0.8">licensed cab stand -- night rank</text>
    <path d="M214 246 H586" stroke-width="2.4"/>
    ${anno(id, 226, 300, '10:19 p.m.')}
    ${anno(id, 226, 356, 'to HALL LANE')}
    <text x="470" y="420" font-size="18" fill="${INK}" stroke="none" opacity="0.7">paid -- one shilling</text>
    ${anno(id, 300, 520, 'crumpled once, dropped in the basket')}
    <path d="M330 470 q40 24 90 6 M300 486 q60 26 140 4" stroke-width="2" opacity="0.5"/>
  </g>
`);

const cuSafe = closeupSvg('cuSa', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <rect x="150" y="90" width="480" height="420" fill="${NIGHT}" fill-opacity="0.30" stroke-width="6"/>
    <rect x="176" y="116" width="428" height="368" fill="${NIGHT}" fill-opacity="0.24" stroke-width="3"/>
    <path d="M150 90 l-56 30 v370 l56 26" fill="${SAGE}" fill-opacity="0.4" stroke-width="5"/>
    <path d="M94 122 v366" stroke-width="2.4" opacity="0.5"/>
    <path d="M176 270 H604" stroke-width="4"/>
    <rect x="210" y="140" width="340" height="112" rx="6" fill="${PAPER}" fill-opacity="0.9" stroke-width="3.5"/>
    <path d="M214 170 h330 M214 200 h330 M214 230 h322" stroke-width="1.6" opacity="0.55"/>
    <text x="248" y="164" font-size="22" fill="${INK}" stroke="none">pp. 40 -- 43</text>
    <text x="248" y="196" font-size="17" fill="${INK}" stroke="none" opacity="0.8">carbon copies -- her name on every line</text>
    <rect x="210" y="300" width="300" height="90" rx="6" fill="${PAPER}" fill-opacity="0.85" stroke-width="3"/>
    <path d="M214 328 h290 M214 358 h284" stroke-width="1.6" opacity="0.5"/>
    ${anno(id, 232, 352, 'the confession, doubled')}
    <path d="M510 300 q-30 90 -6 168" stroke-width="2.6" opacity="0.7"/>
    ${anno(id, 232, 470, 'torn stubs -- the originals left the house', 20)}
    <circle cx="566" cy="500" r="14" fill="${GOLD}" fill-opacity="0.6" stroke-width="3"/>
    <path d="M556 500 h20 M566 490 v20" stroke-width="2" opacity="0.7"/>
    <text x="80" y="560" font-size="22" fill="${INK}" stroke="none" opacity="0.7">the fire never saw these</text>
  </g>
`);

const cuTin = closeupSvg('cuTi', (id) => `
  <g filter="url(#${id}W)" stroke="${INK}" fill="none" stroke-linejoin="round">
    <ellipse cx="400" cy="480" rx="270" ry="46" fill="${GOLD}" fill-opacity="0.5" stroke-width="4"/>
    <path d="M130 480 q0 -46 70 -58 q100 -14 200 0 q100 14 200 0 q70 12 70 58" fill="${GOLD}" fill-opacity="0.35" stroke-width="4"/>
    <ellipse cx="400" cy="430" rx="240" ry="34" fill="${WOOD}" fill-opacity="0.4" stroke-width="3.5"/>
    <rect x="180" y="330" width="52" height="84" rx="8" fill="${PAPER}" fill-opacity="0.8" stroke-width="2.6"/>
    <path d="M186 350 h40 M186 372 h40 M186 394 h40" stroke-width="1.4" opacity="0.6"/>
    ${anno(id, 150, 320, 'needles')}
    <path d="M280 350 q10 -40 34 -40 q26 0 30 40 q-30 12 -64 0 Z" fill="${SAGE}" fill-opacity="0.5" stroke-width="2.8"/>
    ${anno(id, 268, 316, 'thread')}
    <rect x="380" y="360" width="70" height="46" rx="6" fill="${WOOD}" fill-opacity="0.5" stroke-width="2.8"/>
    ${anno(id, 372, 348, 'wax')}
    <rect x="480" y="300" width="150" height="106" rx="8" fill="${PAPER}" fill-opacity="0.95" stroke-width="3"/>
    <text x="500" y="336" font-size="20" fill="${INK}" stroke="none">horn buttons</text>
    <path d="M494 352 h120" stroke-width="1.8" opacity="0.6"/>
    <circle cx="512" cy="382" r="17" fill="${WOOD}" fill-opacity="0.85" stroke-width="3"/>
    <circle cx="507" cy="378" r="2.4" fill="${INK}" stroke="none"/>
    <circle cx="517" cy="386" r="2.4" fill="${INK}" stroke="none"/>
    <circle cx="586" cy="382" r="17" fill="${WOOD}" fill-opacity="0.85" stroke-width="3"/>
    <circle cx="581" cy="378" r="2.4" fill="${INK}" stroke="none"/>
    <circle cx="591" cy="386" r="2.4" fill="${INK}" stroke="none"/>
    ${anno(id, 500, 446, 'two spare -- the same cast', 20)}
    ${anno(id, 96, 560, "the stair button's lost brothers")}
  </g>
`);

/* ------------------------------------------------------------ write out */

const files = [
  ['study_bg.svg', studyBg], ['study_mid.svg', studyMid], ['study_fg.svg', studyFg],
  ['peggy_bg.svg', peggyBg], ['peggy_mid.svg', peggyMid], ['peggy_fg.svg', peggyFg],
  ['edmund_bg.svg', edmundBg], ['edmund_mid.svg', edmundMid], ['edmund_fg.svg', edmundFg],
  ['bath_bg.svg', bathBg], ['bath_mid.svg', bathMid], ['bath_fg.svg', bathFg],
];
for (const [name, svg] of files) {
  fs.writeFileSync(path.join(ART, name), svg);
  console.log('wrote', name);
}

const cus = [
  ['cu_candle.svg', cuCandle], ['cu_ious.svg', cuIous], ['cu_journal.svg', cuJournal],
  ['cu_cabinet.svg', cuCabinet], ['cu_blotter.svg', cuBlotter], ['cu_receipt.svg', cuReceipt],
  ['cu_safe.svg', cuSafe], ['cu_tin.svg', cuTin],
];
for (const [name, svg] of cus) {
  fs.writeFileSync(path.join(CU, name), svg);
  console.log('wrote closeups/' + name);
}
console.log('done');
