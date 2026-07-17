// Shared particle-shape rendering library, reused by FlameGenerator / DryIceGenerator /
// Shape3DParticlesGenerator so all three draw from one shape set instead of each keeping
// its own copy of the shapeType switch (id 0-4 previously triplicated across Generators.js).
//
// Each shape function assumes the caller has already translated/rotated/scaled ctx to the
// particle's local origin and set ctx.globalAlpha for the particle's alpha.

export const PARTICLE_SHAPE_TYPES = [
  { id: 0, name: 'soft-circle', label: 'Soft Circle (ぼかし円)' },
  { id: 1, name: 'circle', label: 'Circle (くっきり円)' },
  { id: 2, name: 'square', label: 'Square' },
  { id: 3, name: 'hexagon', label: 'Hexagon' },
  { id: 4, name: 'star', label: 'Star' },
  { id: 5, name: 'ring', label: 'Ring' },
  { id: 6, name: 'crystal', label: 'Crystal' },
  { id: 7, name: 'sparkle-cross', label: 'Sparkle Cross' },
  { id: 8, name: 'petal', label: 'Petal' },
  { id: 9, name: 'blob', label: 'Organic Blob' },
  { id: 10, name: 'bokeh-texture', label: 'Bokeh (Texture)' },
  { id: 11, name: 'spark-glint', label: 'Spark Glint (Texture)' }
];

export const PARTICLE_SHAPE_COUNT = PARTICLE_SHAPE_TYPES.length;

// Deterministic 0..1 pseudo-random from a numeric seed, stable across frames for a given seed.
function hash(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function rgba(parsedColor, alpha) {
  return `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, ${alpha})`;
}

function shadeRgb(parsedColor, factor, alpha = 1) {
  const r = Math.max(0, Math.min(255, Math.round(parsedColor.r * factor)));
  const g = Math.max(0, Math.min(255, Math.round(parsedColor.g * factor)));
  const b = Math.max(0, Math.min(255, Math.round(parsedColor.b * factor)));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function fillSoftGlow(ctx, parsedColor, radius) {
  const grad = ctx.createRadialGradient(0, 0, radius * 0.1, 0, 0, radius);
  grad.addColorStop(0, rgba(parsedColor, 1));
  grad.addColorStop(0.3, rgba(parsedColor, 0.5));
  grad.addColorStop(1, rgba(parsedColor, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
}

function fillHighlight(ctx, size) {
  // Small offset highlight for a "gem pop" on top of flat/crisp shapes.
  const r = size * 0.22;
  const cx = -size * 0.15;
  const cy = -size * 0.15;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

function polygonPath(ctx, sides, radius, rotationOffset = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotationOffset + (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function starPath(ctx, points, outerR, innerR, rotationOffset = -Math.PI / 2) {
  ctx.beginPath();
  const total = points * 2;
  for (let i = 0; i < total; i++) {
    const angle = rotationOffset + (i / total) * Math.PI * 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// --- Offscreen texture cache for id 10/11: neutral white alpha masks, tinted at draw time
// via 'source-atop' so one cached texture serves any particle color/size. ---
const textureCache = new Map();

function getTexture(name, render) {
  if (textureCache.has(name)) return textureCache.get(name);
  const TEX_SIZE = 128;
  const canvas = document.createElement('canvas');
  canvas.width = TEX_SIZE;
  canvas.height = TEX_SIZE;
  render(canvas.getContext('2d'), TEX_SIZE);
  textureCache.set(name, canvas);
  return canvas;
}

function bokehTexture() {
  return getTexture('bokeh', (tctx, s) => {
    const c = s / 2;
    const grad = tctx.createRadialGradient(c, c, 0, c, c, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.85, 'rgba(255,255,255,0.15)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    tctx.fillStyle = grad;
    tctx.beginPath();
    tctx.arc(c, c, c, 0, Math.PI * 2);
    tctx.fill();
    // Subtle grain so the sprite reads as a texture rather than a flat gradient.
    tctx.globalAlpha = 0.06;
    for (let i = 0; i < 60; i++) {
      tctx.fillStyle = hash(i * 5.3) > 0.5 ? '#fff' : '#000';
      tctx.fillRect(hash(i * 3.1) * s, hash(i * 7.7) * s, 1.5, 1.5);
    }
    tctx.globalAlpha = 1;
  });
}

function sparkGlintTexture() {
  return getTexture('spark-glint', (tctx, s) => {
    const c = s / 2;
    tctx.save();
    tctx.translate(c, c);
    starPath(tctx, 4, c * 0.95, c * 0.12);
    const grad = tctx.createRadialGradient(0, 0, 0, 0, 0, c);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.8)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    tctx.fillStyle = grad;
    tctx.fill();
    tctx.restore();
  });
}

function drawTexturedSprite(ctx, texture, size, parsedColor) {
  const half = size / 2;
  ctx.drawImage(texture, -half, -half, size, size);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = rgba(parsedColor, 1);
  ctx.fillRect(-half, -half, size, size);
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Draws one particle shape at the ctx origin. `seed` (any finite number) makes shapes like
 * "blob" stable across frames for a given particle instead of reshuffling every frame -
 * pass the same value every frame for the same particle (e.g. a value assigned once at
 * particle creation).
 */
export function drawParticleShape(ctx, typeIndex, size, { themeColor, parsedColor, seed = 42 } = {}) {
  const type = Math.round(typeIndex);

  switch (type) {
    case 0: // Soft Circle
      fillSoftGlow(ctx, parsedColor, size);
      fillHighlight(ctx, size);
      return;

    case 1: // Circle
      fillSoftGlow(ctx, parsedColor, size * 0.7);
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      ctx.fill();
      fillHighlight(ctx, size);
      return;

    case 2: // Square
      fillSoftGlow(ctx, parsedColor, size * 0.75);
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.rect(-size / 2, -size / 2, size, size);
      ctx.fill();
      fillHighlight(ctx, size);
      return;

    case 3: // Hexagon
      fillSoftGlow(ctx, parsedColor, size * 0.75);
      ctx.fillStyle = themeColor;
      polygonPath(ctx, 6, size / 2);
      ctx.fill();
      fillHighlight(ctx, size);
      return;

    case 4: // Star
      fillSoftGlow(ctx, parsedColor, size * 0.75);
      ctx.fillStyle = themeColor;
      starPath(ctx, 5, size / 2, size / 4);
      ctx.fill();
      fillHighlight(ctx, size);
      return;

    case 5: { // Ring
      const outerR = size / 2;
      const innerR = outerR * 0.55;
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.arc(0, 0, outerR, 0, Math.PI * 2);
      ctx.moveTo(innerR, 0);
      ctx.arc(0, 0, innerR, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      return;
    }

    case 6: { // Crystal (faceted polygon, alternating facet shading)
      const facets = 6;
      const r = size / 2;
      for (let i = 0; i < facets; i++) {
        const a1 = -Math.PI / 2 + (i / facets) * Math.PI * 2;
        const a2 = -Math.PI / 2 + ((i + 1) / facets) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
        ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r);
        ctx.closePath();
        ctx.fillStyle = shadeRgb(parsedColor, i % 2 === 0 ? 1.0 : 0.65);
        ctx.fill();
      }
      return;
    }

    case 7: // Sparkle Cross
      fillSoftGlow(ctx, parsedColor, size * 0.6);
      ctx.fillStyle = themeColor;
      starPath(ctx, 4, size / 2, size * 0.08);
      ctx.fill();
      return;

    case 8: // Petal
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.bezierCurveTo(size / 2, -size / 4, size / 2, size / 4, 0, size / 2);
      ctx.bezierCurveTo(-size / 2, size / 4, -size / 2, -size / 4, 0, -size / 2);
      ctx.closePath();
      ctx.fill();
      return;

    case 9: { // Organic Blob (seed-jittered polygon, stable across frames for a given seed)
      const points = 10;
      ctx.fillStyle = themeColor;
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const jitter = 0.7 + hash(seed + i * 12.7) * 0.5;
        const r = (size / 2) * jitter;
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }

    case 10: // Bokeh (texture)
      drawTexturedSprite(ctx, bokehTexture(), size, parsedColor);
      return;

    case 11: // Spark Glint (texture)
      drawTexturedSprite(ctx, sparkGlintTexture(), size, parsedColor);
      return;

    default:
      fillSoftGlow(ctx, parsedColor, size);
      return;
  }
}
