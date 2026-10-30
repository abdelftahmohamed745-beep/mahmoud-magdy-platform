'use strict';
/*
 * يولّد أغلفة الكورسات وصور المدرسين (SVG) داخل public/media.
 * الصور جزء من التصميم المحلي ولا تمثل صورًا حقيقية من المنصة الأصلية.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'public', 'media');

const PALETTES = [
  ['#064556', '#0b6b7d', '#8FA82A'],
  ['#12302f', '#175E6C', '#C3D14F'],
  ['#2b1b12', '#7a4b2a', '#E0A32E'],
  ['#231a2e', '#4c2f63', '#8FA82A'],
  ['#0d2a3a', '#1b5e7a', '#4E8B99'],
  ['#33201c', '#8a4a3a', '#D25B4B'],
  ['#1c2b1a', '#3f5a2c', '#C3D14F'],
  ['#241f33', '#494066', '#8FA82A']
];

function cover(index) {
  const [bg1, bg2, accent] = PALETTES[index % PALETTES.length];
  const cx = 610 - (index % 3) * 40;
  const cy = 150 + (index % 4) * 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" role="img" aria-label="Physics Society course cover">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="0.55" stop-color="${bg2}"/>
      <stop offset="1" stop-color="${bg1}"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.7" cy="0.25" r="0.6">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="450" fill="url(#g)"/>
  <rect width="800" height="450" fill="url(#glow)"/>
  <g fill="none" stroke="${accent}" stroke-opacity="0.75" stroke-width="2">
    <ellipse cx="${cx}" cy="${cy}" rx="150" ry="58" transform="rotate(-24 ${cx} ${cy})"/>
    <ellipse cx="${cx}" cy="${cy}" rx="150" ry="58" transform="rotate(36 ${cx} ${cy})"/>
    <ellipse cx="${cx}" cy="${cy}" rx="150" ry="58" transform="rotate(96 ${cx} ${cy})"/>
    <circle cx="${cx}" cy="${cy}" r="16" fill="${accent}" stroke="none" fill-opacity="0.95"/>
  </g>
  <g fill="#ffffff" fill-opacity="0.85">
    <circle cx="120" cy="330" r="4"/>
    <circle cx="170" cy="270" r="2.5"/>
    <circle cx="230" cy="350" r="3"/>
    <circle cx="300" cy="120" r="2.5"/>
    <circle cx="360" cy="70" r="2"/>
    <circle cx="80" cy="120" r="2"/>
  </g>
  <g font-family="'Sharp Grotesk', 'Segoe UI', Arial, sans-serif" fill="#ffffff">
    <text x="60" y="112" font-size="17" letter-spacing="7" fill-opacity="0.8">PHYSICS SOCIETY</text>
    <text x="60" y="215" font-size="86" font-weight="700" fill-opacity="0.16">${String(index + 1).padStart(2, '0')}</text>
  </g>
  <g font-family="'Almarai', 'Tajawal', 'Segoe UI', Arial, sans-serif" fill="#ffffff" direction="rtl" text-anchor="end">
    <text x="742" y="392" font-size="26" font-weight="700" fill-opacity="0.92">محمود مجدي</text>
    <text x="742" y="422" font-size="16" fill-opacity="0.6">Physics · Society</text>
  </g>
  <rect x="0" y="0" width="800" height="450" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="6"/>
</svg>
`;
}

function portrait(initials, bg1, bg2, accent) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="Teacher portrait">
  <defs>
    <linearGradient id="p" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/>
      <stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#p)"/>
  <g fill="none" stroke="${accent}" stroke-opacity="0.7" stroke-width="3">
    <ellipse cx="300" cy="300" rx="210" ry="80" transform="rotate(-20 300 300)"/>
    <ellipse cx="300" cy="300" rx="210" ry="80" transform="rotate(40 300 300)"/>
    <ellipse cx="300" cy="300" rx="210" ry="80" transform="rotate(100 300 300)"/>
    <circle cx="300" cy="300" r="22" fill="${accent}" stroke="none"/>
  </g>
  <circle cx="300" cy="300" r="120" fill="#000" fill-opacity="0.18"/>
  <text x="300" y="345" text-anchor="middle" font-family="'Sharp Grotesk', Arial, sans-serif" font-size="110" font-weight="700" fill="#ffffff" fill-opacity="0.92">${initials}</text>
  <text x="300" y="540" text-anchor="middle" font-family="'Almarai', Arial, sans-serif" font-size="26" fill="#ffffff" fill-opacity="0.7" direction="rtl">Physics Society</text>
</svg>
`;
}

fs.mkdirSync(path.join(OUT, 'covers'), { recursive: true });
for (let i = 0; i < 8; i++) {
  fs.writeFileSync(path.join(OUT, 'covers', `course-${i + 1}.svg`), cover(i));
}
fs.writeFileSync(path.join(OUT, 'teacher-1.svg'), portrait('MM', '#064556', '#0b6b7d', '#C3D14F'));
fs.writeFileSync(path.join(OUT, 'teacher-2.svg'), portrait('AS', '#33201c', '#8a4a3a', '#E0A32E'));
console.log('assets generated');
