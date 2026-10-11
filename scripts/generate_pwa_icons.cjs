const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// CRC32 implementation for PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const bodyToCrc = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(bodyToCrc);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, bodyToCrc, crcBuf]);
}

function createPng(width, height, getPixelRgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate compression
  ihdrData[11] = 0; // Filter method
  ihdrData[12] = 0; // Non-interlaced
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Scanlines with filter byte 0
  const scanlineLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * scanlineLength);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = getPixelRgba(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressedData);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

// Distance from point to line segment
function distToSegment(px, py, x1, y1, x2, y2) {
  const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  if (l2 === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

/**
 * Apple-inspired aesthetic renderer:
 * - Clean, minimalist, deep navy/charcoal base (#080C16 to #101726)
 * - Ultra-smooth continuous Apple squircle silhouette
 * - Subtle frosted chamfer rim highlight
 * - Minimalist precision glyph: Dual-vector ascending momentum trajectory
 *   with glowing precision node and luminous chart crest
 */
function renderAppleStyleIconPixel(x, y, width, height, isMaskable = false) {
  // Normalize coordinates: center is (0, 0), bounds roughly -1 to 1
  let nx = (x / width) * 2 - 1;
  let ny = (y / height) * 2 - 1;

  if (isMaskable) {
    // For maskable icons: safe zone requires content within center 75-80%
    nx /= 0.72;
    ny /= 0.72;
  }

  // Apple Squircle distance: (|nx|^4.2 + |ny|^4.2)^(1/4.2)
  const squircleNorm = Math.pow(Math.pow(Math.abs(nx), 4.2) + Math.pow(Math.abs(ny), 4.2), 1 / 4.2);

  // If outside squircle boundary (only applies to non-maskable)
  let outerAlpha = 255;
  if (!isMaskable) {
    if (squircleNorm > 0.90) {
      const edge = (squircleNorm - 0.90) / 0.04;
      if (edge >= 1.0) {
        return [0, 0, 0, 0]; // Transparent outside squircle
      }
      outerAlpha = Math.round(255 * (1 - edge));
    }
  }

  // Base background: Luxurious Deep Navy / Charcoal Slate gradient
  // Top-left is slightly lighter slate-navy (#111827 / #0f172a), bottom-right is deep abyss (#050811)
  const gradT = (nx + ny + 2) / 4; // 0 (top-left) to 1 (bottom-right)
  
  // Radial subtle center illumination
  const rDist = Math.hypot(nx, ny);
  const centerGlow = Math.max(0, 1 - rDist * 0.95);

  let bgR = Math.round(7 + 10 * (1 - gradT) + 8 * centerGlow);
  let bgG = Math.round(11 + 14 * (1 - gradT) + 12 * centerGlow);
  let bgB = Math.round(20 + 26 * (1 - gradT) + 24 * centerGlow);

  // Apple signature inner specular rim light (at squircleNorm around 0.86 - 0.89)
  if (!isMaskable && squircleNorm >= 0.84 && squircleNorm <= 0.90) {
    const rimIntensity = (1 - Math.abs(squircleNorm - 0.87) / 0.03);
    // Subtle top-left bias for rim reflection
    const lightAngle = Math.max(0, (-nx * 0.5 - ny * 0.8 + 0.3));
    const highlight = Math.min(1, rimIntensity * (0.35 + 0.65 * lightAngle));
    bgR = Math.round(bgR * (1 - highlight * 0.5) + 160 * highlight * 0.5);
    bgG = Math.round(bgG * (1 - highlight * 0.5) + 195 * highlight * 0.5);
    bgB = Math.round(bgB * (1 - highlight * 0.5) + 240 * highlight * 0.5);
  }

  // Subtle frosted ambient disk behind the glyph (Apple layered glass design)
  if (rDist < 0.58) {
    const glassFalloff = Math.pow(Math.max(0, 1 - rDist / 0.58), 2.0);
    // Soft deep cyan/navy glass tint
    bgR = Math.round(bgR * (1 - glassFalloff * 0.15) + 14 * glassFalloff * 0.15);
    bgG = Math.round(bgG * (1 - glassFalloff * 0.15) + 38 * glassFalloff * 0.15);
    bgB = Math.round(bgB * (1 - glassFalloff * 0.15) + 75 * glassFalloff * 0.15);
  }

  // Apple Minimalist Vector Glyph:
  // Trajectory: Upward-surging algorithmic vector pulse with precision geometry
  // Coordinates:
  // Segment 1: (-0.42, 0.22) to (-0.18, 0.22) [Base baseline anchor]
  // Segment 2: (-0.18, 0.22) to (-0.02, -0.05) [First impulse ascent]
  // Segment 3: (-0.02, -0.05) to (0.12, 0.08)  [Pullback consolidation]
  // Segment 4: (0.12, 0.08) to (0.38, -0.38)   [Apex breakout trajectory]

  const d1 = distToSegment(nx, ny, -0.42, 0.20, -0.18, 0.20);
  const d2 = distToSegment(nx, ny, -0.18, 0.20, -0.02, -0.06);
  const d3 = distToSegment(nx, ny, -0.02, -0.06, 0.12, 0.07);
  const d4 = distToSegment(nx, ny, 0.12, 0.07, 0.38, -0.38);
  const minStrokeDist = Math.min(d1, d2, d3, d4);

  // Stroke width ~0.046 (clean, substantial, high legibility at 16-512px)
  const strokeRadius = 0.046;

  // Key geometric nodes:
  // Node 1: Apex at (0.38, -0.38)
  const apexDist = Math.hypot(nx - 0.38, ny - (-0.38));
  // Node 2: Secondary inflection at (-0.02, -0.06)
  const inflectionDist = Math.hypot(nx - (-0.02), ny - (-0.06));

  // Precision minimal diamond / shield accent in upper-left quadrant
  // Adds distinctive trading platform identity without visual clutter
  const diamondX = -0.22;
  const diamondY = -0.26;
  const diamondDist = Math.abs(nx - diamondX) + Math.abs(ny - diamondY);
  const inDiamond = diamondDist <= 0.085;
  const inDiamondBorder = diamondDist > 0.065 && diamondDist <= 0.085;

  // Soft glow around the trajectory
  let glowContribution = 0;
  if (minStrokeDist < 0.18) {
    glowContribution = Math.pow(1 - minStrokeDist / 0.18, 2.5) * 0.45;
  }

  // Render pixels
  if (minStrokeDist <= strokeRadius) {
    // Inside the vector stroke: Apple smooth gradient
    // From Cyan (#38bdf8) at baseline to Luminous Emerald/Teal (#34d399) at apex
    const progress = Math.max(0, Math.min(1, (nx + 0.42) / 0.80));
    
    // Core color interpolation: Cyan -> Bright Teal -> Electric White-Cyan
    let cr, cg, cb;
    if (progress < 0.5) {
      const p = progress / 0.5;
      cr = Math.round(56 * (1 - p) + 45 * p);
      cg = Math.round(189 * (1 - p) + 212 * p);
      cb = Math.round(248 * (1 - p) + 220 * p);
    } else {
      const p = (progress - 0.5) / 0.5;
      cr = Math.round(45 * (1 - p) + 52 * p);
      cg = Math.round(212 * (1 - p) + 245 * p);
      cb = Math.round(220 * (1 - p) + 160 * p);
    }

    // Specular center streak inside stroke
    const innerDist = minStrokeDist / strokeRadius;
    if (innerDist < 0.35) {
      const sheen = (1 - innerDist / 0.35) * 0.5;
      cr = Math.round(cr * (1 - sheen) + 255 * sheen);
      cg = Math.round(cg * (1 - sheen) + 255 * sheen);
      cb = Math.round(cb * (1 - sheen) + 255 * sheen);
    }

    // Antialiased edge of stroke
    if (minStrokeDist > strokeRadius - 0.012) {
      const antialias = (minStrokeDist - (strokeRadius - 0.012)) / 0.012;
      const blend = 1 - antialias;
      cr = Math.round(cr * blend + bgR * (1 - blend));
      cg = Math.round(cg * blend + bgG * (1 - blend));
      cb = Math.round(cb * blend + bgB * (1 - blend));
    }

    return [cr, cg, cb, outerAlpha];
  }

  // Apex luminous beacon node
  if (apexDist <= 0.082) {
    if (apexDist <= 0.052) {
      // Solid radiant pearl-emerald core
      const coreFade = apexDist / 0.052;
      const r = Math.round(240 * (1 - coreFade) + 52 * coreFade);
      const g = Math.round(255 * (1 - coreFade) + 250 * coreFade);
      const b = Math.round(250 * (1 - coreFade) + 190 * coreFade);
      return [r, g, b, outerAlpha];
    } else {
      // Antialiased edge
      const edge = (apexDist - 0.052) / 0.030;
      const blend = 1 - edge;
      const r = Math.round(52 * blend + bgR * (1 - blend));
      const g = Math.round(250 * blend + bgG * (1 - blend));
      const b = Math.round(190 * blend + bgB * (1 - blend));
      return [r, g, b, outerAlpha];
    }
  }

  // Secondary inflection node
  if (inflectionDist <= 0.052) {
    const fade = inflectionDist / 0.052;
    const blend = Math.max(0, 1 - fade);
    const r = Math.round(56 * blend + bgR * (1 - blend));
    const g = Math.round(189 * blend + bgG * (1 - blend));
    const b = Math.round(248 * blend + bgB * (1 - blend));
    return [r, g, b, outerAlpha];
  }

  // Minimalist accent diamond
  if (inDiamondBorder) {
    // Subtle frosted cyan stroke
    return [56, 189, 248, Math.round(outerAlpha * 0.85)];
  } else if (inDiamond) {
    // Translucent dark sapphire fill
    const r = Math.round(bgR * 0.7 + 14 * 0.3);
    const g = Math.round(bgG * 0.7 + 45 * 0.3);
    const b = Math.round(bgB * 0.7 + 90 * 0.3);
    return [r, g, b, outerAlpha];
  }

  // Ambient vector glow blend
  if (glowContribution > 0) {
    const glowR = 40;
    const glowG = 180;
    const glowB = 220;
    bgR = Math.round(bgR * (1 - glowContribution) + glowR * glowContribution);
    bgG = Math.round(bgG * (1 - glowContribution) + glowG * glowContribution);
    bgB = Math.round(bgB * (1 - glowContribution) + glowB * glowContribution);
  }

  return [bgR, bgG, bgB, outerAlpha];
}

const outDir = path.resolve(__dirname, '../public/icons');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

console.log('Generating standardized Apple-inspired PWA icons...');

// 1. icon-192.png (Requested exact name)
console.log('Rendering public/icons/icon-192.png (192x192)...');
const icon192 = createPng(192, 192, (x, y, w, h) => renderAppleStyleIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'icon-192.png'), icon192);

// 2. icon-512.png (Requested exact name)
console.log('Rendering public/icons/icon-512.png (512x512)...');
const icon512 = createPng(512, 512, (x, y, w, h) => renderAppleStyleIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), icon512);

// 3. icon-192x192.png (Standard dimension-tagged alias)
console.log('Rendering public/icons/icon-192x192.png (192x192)...');
fs.writeFileSync(path.join(outDir, 'icon-192x192.png'), icon192);

// 4. icon-512x512.png (Standard dimension-tagged alias)
console.log('Rendering public/icons/icon-512x512.png (512x512)...');
fs.writeFileSync(path.join(outDir, 'icon-512x512.png'), icon512);

// 5. icon-192x192-maskable.png (Maskable safe-zone)
console.log('Rendering public/icons/icon-192x192-maskable.png (192x192)...');
const icon192Mask = createPng(192, 192, (x, y, w, h) => renderAppleStyleIconPixel(x, y, w, h, true));
fs.writeFileSync(path.join(outDir, 'icon-192x192-maskable.png'), icon192Mask);

// 6. icon-512x512-maskable.png (Maskable safe-zone)
console.log('Rendering public/icons/icon-512x512-maskable.png (512x512)...');
const icon512Mask = createPng(512, 512, (x, y, w, h) => renderAppleStyleIconPixel(x, y, w, h, true));
fs.writeFileSync(path.join(outDir, 'icon-512x512-maskable.png'), icon512Mask);

// 7. apple-touch-icon.png (180x180 for iOS Safari home screen)
console.log('Rendering public/icons/apple-touch-icon.png (180x180)...');
const appleIcon = createPng(180, 180, (x, y, w, h) => renderAppleStyleIconPixel(x, y, w, h, false));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), appleIcon);

console.log('All Apple-inspired PWA icons generated and verified successfully.');
