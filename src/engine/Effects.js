/**
 * Post-processing effects library designed to be applied to layer contexts or the master context.
 */

// 1. Glow / Bloom Effect
// Employs canvas filter blurring and additive blending to create a premium luminescent glow.
export function applyGlow(ctx, canvas, intensity = 15, mix = 0.6) {
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Ramp opacity together with blur radius, so higher intensity reads as brighter -
  // not just blurrier (blur alone just spreads existing light, it doesn't add any).
  const effectiveMix = Math.min(1, mix + (intensity / 100) * 0.4);
  ctx.globalAlpha = effectiveMix;

  // Apply CSS-like blur filter on context
  ctx.filter = `blur(${intensity}px)`;
  ctx.drawImage(canvas, 0, 0);

  ctx.restore();
}

// 2. Feedback / Motion Trails
// Uses a temporary frame buffer to apply decay and transformation to the target canvas.
export class FeedbackTrail {
  constructor() {
    // No accumulator canvas needed with the self-history buffer approach
  }

  resize(width, height) {
    // No-op, no internal persistent canvas to resize
  }

  clear() {
    // No-op, target canvas clear is handled externally or during process
  }

  /**
   * Applies feedback to layer context by copying history, fading it, and transforming it.
   * @param {CanvasRenderingContext2D} targetCtx - The target rendering context (rawLayer)
   * @param {HTMLCanvasElement} targetCanvas - The target layer canvas
   * @param {Object} params - Feedback configurations
   */
  process(targetCtx, targetCanvas, params = {}) {
    const {
      decay = 0.92,      // Trails persistence (0.0 - 1.0)
      scale = 1.002,     // Feedback scaling (zooming trail)
      rotate = 0.001,    // Feedback rotation (swirling trail)
      offsetX = 0,
      offsetY = 0
    } = params;

    const w = targetCanvas.width;
    const h = targetCanvas.height;

    // 1. Copy last frame (which is currently sitting in targetCanvas) to temp buffer
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(targetCanvas, 0, 0);

    // 2. Clear target layer entirely
    targetCtx.clearRect(0, 0, w, h);

    // 3. Draw the faded and transformed history back onto the target
    targetCtx.save();
    targetCtx.globalAlpha = decay;
    
    // Set transform origin to center
    targetCtx.translate(w / 2 + offsetX, h / 2 + offsetY);
    targetCtx.rotate(rotate);
    targetCtx.scale(scale, scale);
    targetCtx.translate(-w / 2, -h / 2);
    
    targetCtx.drawImage(tempCanvas, 0, 0);
    targetCtx.restore();
    
    // Target now contains faded history. The caller will draw the new frame directly on top.
  }
}

// 3. GPU-Accelerated Slice Distortion (Wave / Glitch Distortion)
// Slices canvas into horizontal bands and shifts them in X direction using mathematical formulas.
export function applyDistortion(ctx, canvas, time, params = {}) {
  const {
    intensity = 8,      // Shift offset in pixels
    frequency = 0.02,   // Frequency of wave distortion
    speed = 4,          // Speed of wiggle animation
    sliceHeight = 4     // Height of sliced bands (smaller = smoother, larger = retro/glitch)
  } = params;

  if (intensity <= 0) return;

  const w = canvas.width;
  const h = canvas.height;

  // Clone current canvas to read from
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  // Clear target context
  ctx.clearRect(0, 0, w, h);

  const speedOffset = time * speed * 0.02;

  // Quadratic curve: low/mid dial values stay calm, only the top of the range gets
  // dramatic (intensity=12, the randomizer's hard cap -> ~3.6px; intensity=40, the
  // slider max -> 40px, unchanged) - raw linear intensity felt "always nauseating".
  const effectiveIntensity = (intensity * intensity) / 40;

  // Draw slice by slice with sinus offset
  for (let y = 0; y < h; y += sliceHeight) {
    const sliceH = Math.min(sliceHeight, h - y);
    // Dynamic X offset based on sine wave
    const dx = Math.sin(y * frequency + speedOffset) * effectiveIntensity;
    
    ctx.drawImage(
      tempCanvas, 
      0, y, w, sliceH,  // Source sub-rectangle
      dx, y, w, sliceH  // Destination position with offset
    );
  }
}

// 4. Vignette Master Effect
// Darkens the corners of the canvas to draw attention to the center.
export function applyVignette(ctx, width, height, opacity = 0.4) {
  if (opacity <= 0) return;

  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  
  const gradient = ctx.createRadialGradient(
    width / 2, height / 2, Math.max(width, height) * 0.3,
    width / 2, height / 2, Math.max(width, height) * 0.7
  );
  
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, `rgba(0, 0, 0, ${opacity})`);
  
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

// 5. Film Grain / Noise Overlay
// Overlays sub-visible shifting noise to add cinematic texture.
export function applyFilmGrain(ctx, width, height, opacity = 0.05) {
  if (opacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = '#ffffff';

  const grainSize = 1;
  const density = 0.3; // Ratio of screen pixels to fill
  const amount = Math.floor(width * height * density * 0.01);

  for (let i = 0; i < amount; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle = Math.random() > 0.5 ? '#ffffff' : '#000000';
    ctx.fillRect(x, y, grainSize, grainSize);
  }

  ctx.restore();
}

// 6. Kaleidoscope Symmetry Mirror
export function applyKaleidoscope(ctx, canvas, segments = 6) {
  if (segments < 3) return;
  const w = canvas.width;
  const h = canvas.height;
  
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, w, h);

  const angle = (Math.PI * 2) / segments;
  const cx = w / 2;
  const cy = h / 2;
  // Sample a magnified crop of the source per wedge, not a near-1:1 copy - otherwise
  // the mirrored wedges mostly overlap with the original center content and the
  // "kaleidoscope" repetition barely reads as a distinct pattern.
  const zoom = 1.6;

  for (let i = 0; i < segments; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(w, h) * 1.5, -angle / 2 - 0.001, angle / 2 + 0.001);
    ctx.closePath();
    ctx.clip();

    if (i % 2 === 1) {
      ctx.scale(-zoom, zoom);
    } else {
      ctx.scale(zoom, zoom);
    }

    ctx.drawImage(tempCanvas, -cx, -cy);
    ctx.restore();
  }
}

// 7. Chromatic Aberration (RGB Color Splitting)
export function applyChromaticAberration(ctx, canvas, offset = 5) {
  if (offset <= 0) return;
  // Thin neon linework (this app's dominant look) has low area coverage, so the raw
  // offset reads as barely-there against mostly-black backgrounds - boost it.
  const effectiveOffset = offset * 1.6;
  const w = canvas.width;
  const h = canvas.height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, w, h);

  // Red Channel Canvas
  const rCanvas = document.createElement('canvas');
  rCanvas.width = w;
  rCanvas.height = h;
  const rCtx = rCanvas.getContext('2d');
  rCtx.drawImage(tempCanvas, 0, 0);
  rCtx.globalCompositeOperation = 'multiply';
  rCtx.fillStyle = '#ff0000';
  rCtx.fillRect(0, 0, w, h);

  // Green Channel Canvas
  const gCanvas = document.createElement('canvas');
  gCanvas.width = w;
  gCanvas.height = h;
  const gCtx = gCanvas.getContext('2d');
  gCtx.drawImage(tempCanvas, 0, 0);
  gCtx.globalCompositeOperation = 'multiply';
  gCtx.fillStyle = '#00ff00';
  gCtx.fillRect(0, 0, w, h);

  // Blue Channel Canvas
  const bCanvas = document.createElement('canvas');
  bCanvas.width = w;
  bCanvas.height = h;
  const bCtx = bCanvas.getContext('2d');
  bCtx.drawImage(tempCanvas, 0, 0);
  bCtx.globalCompositeOperation = 'multiply';
  bCtx.fillStyle = '#0000ff';
  bCtx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  
  ctx.drawImage(rCanvas, -effectiveOffset, 0);
  ctx.drawImage(gCanvas, 0, 0);
  ctx.drawImage(bCanvas, effectiveOffset, 0);
  
  ctx.restore();
}
