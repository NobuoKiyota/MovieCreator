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

// Hue Rotate
// Rotates the hue of the already-rendered layer via the native CSS/Canvas hue-rotate() filter.
// Lets `color` itself become an LFO/keyframe/Move-scored target through the common FX pipeline
// (see FX_PARAM_RANGES.hueRotate) without touching any generator's own color param or needing an
// RGB split - every layer type gets this for free, the same way distortion/glow/etc. already work.
export function applyHueRotate(ctx, canvas, degrees) {
  if (degrees === 0) return;

  const w = canvas.width;
  const h = canvas.height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.filter = `hue-rotate(${degrees}deg)`;
  ctx.drawImage(tempCanvas, 0, 0);
  ctx.filter = 'none';
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
// Shared by applyKaleidoscope (zoom>1, always alternating) and Mirror Mode's radial presets
// (zoom=1, i.e. an undistorted 1:1 copy of the reference wedge, no magnification): clips the
// canvas into `segments` equal angular wedges and draws a rotated copy of the WHOLE source per
// wedge. Because the whole source rotates before clipping, what lands in wedge i is actually
// the same reference content from wedge 0, rotated into position i - a "copy the reference
// wedge, rotating by 360/segments degrees each time" fan, not an independent redraw per wedge.
function drawRadialWedgeCopies(ctx, sourceCanvas, w, h, segments, { zoom = 1, alternate = false } = {}) {
  const angle = (Math.PI * 2) / segments;
  const cx = w / 2;
  const cy = h / 2;

  for (let i = 0; i < segments; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * angle);

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, Math.max(w, h) * 1.5, -angle / 2 - 0.001, angle / 2 + 0.001);
    ctx.closePath();
    ctx.clip();

    if (alternate && i % 2 === 1) {
      ctx.scale(-zoom, zoom);
    } else {
      ctx.scale(zoom, zoom);
    }

    ctx.drawImage(sourceCanvas, -cx, -cy);
    ctx.restore();
  }
}

export function applyKaleidoscope(ctx, canvas, segments = 6) {
  // 2026-07-20: lowered from <3 to <2 so a plain 2-way point mirror (the simplest reading of
  // "mirror around the center") is reachable via the existing slider, instead of requiring a
  // separate dedicated "center mirror" toggle.
  if (segments < 2) return;
  const w = canvas.width;
  const h = canvas.height;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, w, h);

  // Sample a magnified crop of the source per wedge, not a near-1:1 copy - otherwise
  // the mirrored wedges mostly overlap with the original center content and the
  // "kaleidoscope" repetition barely reads as a distinct pattern.
  drawRadialWedgeCopies(ctx, tempCanvas, w, h, segments, { zoom: 1.6, alternate: true });
}

// 6b. Mirror Mode (screen-split mirroring) - 2026-07-20, added alongside a review of
// applyKaleidoscope (which already covers "mirror around the center" via its N-segment radial
// mirror; lowered its minimum from 3 to 2 segments there for a plain point-mirror option instead
// of duplicating that here). This is the distinct one: reflect a rectangular half/quadrant onto
// the rest of the canvas, like a body of water reflecting what's above it, rather than a radial
// kaleidoscope. Revised 2026-07-20 from a 2-value top/bottom-only toggle into a single clearer
// 4-state parameter matching how many "screens" (mirrored copies) are visible:
//   0 = off (1 screen, no mirror)
//   1 = left-right mirror (2 screens): left half is the source, right half is its flipped copy
//   2 = up-down mirror (2 screens): top half is the source, bottom half is its flipped copy
//   3 = left-right + up-down mirror (4 screens): top-left quadrant is the source, mirrored into
//       the other three quadrants (a quad/tile mirror)
// Extended 2026-07-20 with radial N-way presets (modes 4-9) built on the same
// drawRadialWedgeCopies fan used by applyKaleidoscope, but zoom=1 (an undistorted 1:1 copy
// of the reference wedge, not Kaleidoscope's magnified sampling) - "オリジナルを中心点から
// 分割し、360/N度ずつ回転コピー". Each fold count has a plain rotate-only variant and an
// alternating-mirror variant (odd wedges additionally flipped, closer to true kaleidoscope optics):
//   4 = 6-way, 5 = 6-way alternating, 6 = 8-way, 7 = 8-way alternating,
//   8 = 12-way, 9 = 12-way alternating
// Extended further 2026-07-21 (user requested going beyond 12-way) with 10 = 16-way,
// 11 = 16-way alternating, 12 = 20-way, 13 = 20-way alternating - same fan mechanism, just a
// finer wedge angle (360/16=22.5°, 360/20=18°).
const RADIAL_MIRROR_MODES = {
  4: { segments: 6, alternate: false },
  5: { segments: 6, alternate: true },
  6: { segments: 8, alternate: false },
  7: { segments: 8, alternate: true },
  8: { segments: 12, alternate: false },
  9: { segments: 12, alternate: true },
  10: { segments: 16, alternate: false },
  11: { segments: 16, alternate: true },
  12: { segments: 20, alternate: false },
  13: { segments: 20, alternate: true }
};

export function applyMirrorMode(ctx, canvas, mode = 0) {
  if (mode < 0.5) return;
  const w = canvas.width;
  const h = canvas.height;
  const halfW = w / 2;
  const halfH = h / 2;

  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = w;
  tempCanvas.height = h;
  tempCanvas.getContext('2d').drawImage(canvas, 0, 0);

  if (mode < 1.5) {
    // Left-right: right half becomes a flipped copy of the left half.
    ctx.clearRect(halfW, 0, halfW, h);
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(tempCanvas, 0, 0, halfW, h, 0, 0, halfW, h);
    ctx.restore();
  } else if (mode < 2.5) {
    // Up-down: bottom half becomes a flipped copy of the top half.
    ctx.clearRect(0, halfH, w, halfH);
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(tempCanvas, 0, 0, w, halfH, 0, 0, w, halfH);
    ctx.restore();
  } else if (mode < 3.5) {
    // Quad: top-left quadrant is the source, mirrored into the other three.
    ctx.clearRect(halfW, 0, halfW, h);
    ctx.clearRect(0, halfH, halfW, halfH);
    ctx.save();
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(tempCanvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
    ctx.restore();
    ctx.save();
    ctx.translate(0, h);
    ctx.scale(1, -1);
    ctx.drawImage(tempCanvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
    ctx.restore();
    ctx.save();
    ctx.translate(w, h);
    ctx.scale(-1, -1);
    ctx.drawImage(tempCanvas, 0, 0, halfW, halfH, 0, 0, halfW, halfH);
    ctx.restore();
  } else {
    // Radial N-way: 6/8/12-fold rotate-copy of the reference wedge, each with a plain and an
    // alternating-mirror variant. See RADIAL_MIRROR_MODES above.
    const cfg = RADIAL_MIRROR_MODES[Math.round(mode)];
    if (cfg) {
      ctx.clearRect(0, 0, w, h);
      drawRadialWedgeCopies(ctx, tempCanvas, w, h, cfg.segments, { zoom: 1, alternate: cfg.alternate });
    }
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


// 8. Median Blur - flattens the image into posterized color patches (GIMP's "Median Blur" /
// oil-painting look). No native Canvas 2D median filter exists, so this downsamples to a small
// offscreen buffer, runs a real per-channel median filter there (only cheap enough at low res -
// nothing else in this codebase does full-resolution per-pixel processing), then scales back up.
// Shared by applyEmboss below.
function processAtLowRes(ctx, canvas, downsampleRatio, pixelFn) {
  const smallW = Math.max(1, Math.round(canvas.width * downsampleRatio));
  const smallH = Math.max(1, Math.round(canvas.height * downsampleRatio));
  const small = document.createElement('canvas');
  small.width = smallW;
  small.height = smallH;
  const sctx = small.getContext('2d');
  sctx.drawImage(canvas, 0, 0, smallW, smallH);
  const imgData = sctx.getImageData(0, 0, smallW, smallH);
  pixelFn(imgData.data, smallW, smallH);
  sctx.putImageData(imgData, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

// Manual insertion sort into the middle slot - much faster than Array.prototype.sort(cmp) for
// these tiny fixed-size windows (avoids a closure call per comparison; V8 handles tight numeric
// loops over typed arrays far better than dynamic push()/sort() - an earlier version of this
// filter measured 200ms+/frame at 1080p using push()+sort(cmp), this version measures single-digit
// ms for the same input).
function medianOf(buf, n) {
  for (let i = 1; i < n; i++) {
    const v = buf[i];
    let j = i - 1;
    while (j >= 0 && buf[j] > v) { buf[j + 1] = buf[j]; j--; }
    buf[j + 1] = v;
  }
  return buf[n >> 1];
}

export function applyMedianBlur(ctx, canvas, intensity = 0) {
  if (intensity <= 0) return;
  // Capped at radius 2 (not 3) - true per-pixel median has no cheap Canvas 2D shortcut, and
  // radius 3's extra flattening wasn't worth its much higher cost (measured ~55ms/frame at 1080p
  // vs radius 2's ~8-20ms). Downsample ratio also shrinks as radius grows, so frame cost stays in
  // a similar ballpark across the whole intensity range instead of spiking at high settings.
  const radius = intensity > 50 ? 2 : 1;
  const ratio = radius === 2 ? 0.048 : 0.08;
  processAtLowRes(ctx, canvas, ratio, (data, w, h) => {
    const src = Uint8ClampedArray.from(data);
    const maxWin = (radius * 2 + 1) * (radius * 2 + 1);
    const rBuf = new Uint8Array(maxWin);
    const gBuf = new Uint8Array(maxWin);
    const bBuf = new Uint8Array(maxWin);
    for (let y = 0; y < h; y++) {
      const yMin = Math.max(0, y - radius), yMax = Math.min(h - 1, y + radius);
      for (let x = 0; x < w; x++) {
        const xMin = Math.max(0, x - radius), xMax = Math.min(w - 1, x + radius);
        let n = 0;
        for (let ny = yMin; ny <= yMax; ny++) {
          const rowBase = ny * w;
          for (let nx = xMin; nx <= xMax; nx++) {
            const idx = (rowBase + nx) * 4;
            rBuf[n] = src[idx]; gBuf[n] = src[idx + 1]; bBuf[n] = src[idx + 2];
            n++;
          }
        }
        const outIdx = (y * w + x) * 4;
        data[outIdx] = medianOf(rBuf, n);
        data[outIdx + 1] = medianOf(gBuf, n);
        data[outIdx + 2] = medianOf(bBuf, n);
      }
    }
  });
}

// 9. Emboss - classic 3x3 relief-shading kernel over a grayscale-luminance neighborhood, blended
// against the original color by `intensity`. Fixed small kernel (unlike Median Blur's variable
// radius) so this can afford a higher downsample resolution. Row/column bounds are precomputed
// outside the inner loop (same perf lesson as applyMedianBlur above - avoid repeated
// Math.min/Math.max calls per sample).
export function applyEmboss(ctx, canvas, intensity = 0) {
  if (intensity <= 0) return;
  const strength = Math.min(1, intensity / 100);
  const kernel = [-2, -1, 0, -1, 1, 1, 0, 1, 2];
  processAtLowRes(ctx, canvas, 0.15, (data, w, h) => {
    const src = Uint8ClampedArray.from(data);
    for (let y = 0; y < h; y++) {
      const yMin = Math.max(0, y - 1), yMax = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        const xMin = Math.max(0, x - 1), xMax = Math.min(w - 1, x + 1);
        let sum = 0;
        for (let ny = yMin; ny <= yMax; ny++) {
          const kRow = (ny - y + 1) * 3;
          const rowBase = ny * w;
          for (let nx = xMin; nx <= xMax; nx++) {
            const idx = (rowBase + nx) * 4;
            const gray = (src[idx] + src[idx + 1] + src[idx + 2]) * 0.3333333;
            sum += gray * kernel[kRow + (nx - x + 1)];
          }
        }
        const val = Math.min(255, Math.max(0, sum + 128));
        const outIdx = (y * w + x) * 4;
        data[outIdx] = src[outIdx] + (val - src[outIdx]) * strength;
        data[outIdx + 1] = src[outIdx + 1] + (val - src[outIdx + 1]) * strength;
        data[outIdx + 2] = src[outIdx + 2] + (val - src[outIdx + 2]) * strength;
      }
    }
  });
}

// 10. Motion Blur (directional / "ずらし") - accumulation-buffer blur: draws several offset
// copies along `angleDeg` at reduced alpha with 'lighter' blending, the same offset-copy
// compositing technique as applyChromaticAberration, just along an arbitrary angle instead of a
// fixed left/right channel split.
export function applyMotionBlur(ctx, canvas, intensity = 0, angleDeg = 0) {
  if (intensity <= 0) return;
  const samples = 10;
  const rad = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);

  const temp = document.createElement('canvas');
  temp.width = canvas.width;
  temp.height = canvas.height;
  temp.getContext('2d').drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 / samples;
  for (let i = 0; i < samples; i++) {
    const t = (i / (samples - 1)) * 2 - 1; // -1 -> 1
    const offset = t * intensity;
    ctx.drawImage(temp, dx * offset, dy * offset);
  }
  ctx.restore();
}

// 11. Radial Blur (zoom blur) - same accumulation-buffer technique as Motion Blur, but each
// sample is scaled outward from the canvas center instead of translated, giving the classic
// "impact lines" zoom-punch look (Photoshop's Radial Blur / Zoom mode).
export function applyRadialBlur(ctx, canvas, intensity = 0) {
  if (intensity <= 0) return;
  const samples = 10;
  const w = canvas.width;
  const h = canvas.height;

  const temp = document.createElement('canvas');
  temp.width = w;
  temp.height = h;
  temp.getContext('2d').drawImage(canvas, 0, 0);

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 1 / samples;
  for (let i = 0; i < samples; i++) {
    const scale = 1 + (i / (samples - 1)) * intensity;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(scale, scale);
    ctx.translate(-w / 2, -h / 2);
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
