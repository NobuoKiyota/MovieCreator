import { drawParticleShape, PARTICLE_SHAPE_COUNT } from './particleShapes.js';
import { generateFractalBranch } from './fractalLine.js';

// Simple Noise Generator helper (Value Noise)
class SimpleNoise {
  constructor() {
    this.p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) this.p[i] = Math.floor(Math.random() * 256);
  }
  
  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }
  
  grad1D(hash, x) {
    return (hash & 1) === 0 ? x : -x;
  }
  
  noise1D(x) {
    const X = Math.floor(x) & 255;
    x -= Math.floor(x);
    const u = this.fade(x);
    return this.lerp(u, this.grad1D(this.p[X], x), this.grad1D(this.p[X + 1], x - 1)) * 2;
  }

  noise2D(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const A = this.p[X] + Y;
    const B = this.p[X + 1] + Y;
    
    return this.lerp(v, 
      this.lerp(u, this.grad2D(this.p[A & 255], x, y), this.grad2D(this.p[B & 255], x - 1, y)),
      this.lerp(u, this.grad2D(this.p[(A + 1) & 255], x, y - 1), this.grad2D(this.p[(B + 1) & 255], x - 1, y - 1))
    );
  }

  grad2D(hash, x, y) {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }
}

const noiseInst = new SimpleNoise();

/**
 * Converts Hex to {h, s, l} (0-360 / 0-100 / 0-100).
 */
function hexToHsl(hex) {
  if (!hex || hex.charAt(0) !== '#') return { h: 0, s: 0, l: 50 };

  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);

  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0; // achromatic
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h < 60) { r1 = c; g1 = x; b1 = 0; }
  else if (h < 120) { r1 = x; g1 = c; b1 = 0; }
  else if (h < 180) { r1 = 0; g1 = c; b1 = x; }
  else if (h < 240) { r1 = 0; g1 = x; b1 = c; }
  else if (h < 300) { r1 = x; g1 = 0; b1 = c; }
  else { r1 = c; g1 = 0; b1 = x; }
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

/**
 * Replaces the L (Lightness) component of hex and returns an HSL string.
 * This enables modulating the brightness of a color dynamically via LFO!
 */
function adjustColorLightness(hex, lightness) {
  if (!hex || hex.charAt(0) !== '#') return hex;
  const { h, s } = hexToHsl(hex);
  return `hsl(${h}, ${s}%, ${Math.round(lightness)}%)`;
}

/**
 * Like adjustColorLightness, but also rotates the hue by hueOffsetDeg - used for
 * per-particle color variance (colorVariance param). Returns both the CSS string (for
 * fillStyle) and the parsed RGB ints (for gradients built from parsedColor), kept in sync
 * so glow/shading never mismatches the fill hue.
 */
function jitterHue(hex, lightness, hueOffsetDeg) {
  const { h, s } = hexToHsl(hex);
  const jitteredH = h + hueOffsetDeg;
  const l = Math.max(0, Math.min(100, Math.round(lightness)));
  return {
    css: `hsl(${jitteredH}, ${s}%, ${l}%)`,
    rgb: hslToRgb(jitteredH, s, l)
  };
}

function hexToRgba(hex, opacity) {
  if (!hex || hex.charAt(0) !== '#') return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function parseHexToRgb(hex) {
  if (!hex || hex.charAt(0) !== '#') return { r: 255, g: 255, b: 255 };
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// Base Generator Class
export class BaseGenerator {
  constructor(params = {}) {
    this.params = { ...this.defaultParams(), ...params };
  }

  defaultParams() {
    return {};
  }

  update(time, frameCount) {}

  draw(ctx, width, height, time) {}

  getParameterConfig() {
    return [];
  }
}

// 1. Sine Wave Generator
export class SineWaveGenerator extends BaseGenerator {
  defaultParams() {
    return {
      amplitude: 100,
      frequency: 0.005,
      speed: 2,
      strokeWidth: 3,
      color: '#06b6d4',
      colorLightness: 50, // LFO-able brightness (0 to 100)
      yOffset: 0.5
    };
  }

  getParameterConfig() {
    return [
      { name: 'amplitude', label: 'Amplitude', type: 'range', min: 10, max: 300, step: 1 },
      { name: 'frequency', label: 'Frequency', type: 'range', min: 0.001, max: 0.03, step: 0.001 },
      { name: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 10, step: 0.1 },
      { name: 'strokeWidth', label: 'Thickness', type: 'range', min: 1, max: 20, step: 0.5 },
      { name: 'yOffset', label: 'Y Position', type: 'range', min: 0, max: 1, step: 0.05 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  draw(ctx, width, height, time) {
    ctx.strokeStyle = adjustColorLightness(this.params.color, this.params.colorLightness);
    ctx.lineWidth = this.params.strokeWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const centerY = height * this.params.yOffset;
    const speedOffset = time * this.params.speed * 0.05;

    for (let x = 0; x < width; x++) {
      const y = centerY + Math.sin(x * this.params.frequency + speedOffset) * this.params.amplitude;
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

// 2. Noise Wave Generator
export class NoiseWaveGenerator extends BaseGenerator {
  defaultParams() {
    return {
      amplitude: 150,
      frequency: 0.003,
      speed: 1.5,
      strokeWidth: 4,
      color: '#a855f7',
      colorLightness: 50,
      yOffset: 0.5,
      roughness: 0.5
    };
  }

  getParameterConfig() {
    return [
      { name: 'amplitude', label: 'Amplitude', type: 'range', min: 10, max: 350, step: 1 },
      { name: 'frequency', label: 'Frequency', type: 'range', min: 0.001, max: 0.02, step: 0.001 },
      { name: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 8, step: 0.1 },
      { name: 'strokeWidth', label: 'Thickness', type: 'range', min: 1, max: 20, step: 0.5 },
      { name: 'yOffset', label: 'Y Position', type: 'range', min: 0, max: 1, step: 0.05 },
      { name: 'roughness', label: 'Roughness', type: 'range', min: 0.1, max: 2.0, step: 0.1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  draw(ctx, width, height, time) {
    ctx.strokeStyle = adjustColorLightness(this.params.color, this.params.colorLightness);
    ctx.lineWidth = this.params.strokeWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();

    const centerY = height * this.params.yOffset;
    const speedOffset = time * this.params.speed * 0.01;

    for (let x = 0; x < width; x += 2) {
      let noiseVal = noiseInst.noise2D(x * this.params.frequency, speedOffset);
      noiseVal += noiseInst.noise2D(x * this.params.frequency * 2.5, speedOffset * 1.5) * this.params.roughness * 0.5;

      const y = centerY + noiseVal * this.params.amplitude;
      
      if (x === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

// 3. Firefly Particles Generator
export class ParticlesGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.particles = [];
    this.lastCount = 0;
  }

  defaultParams() {
    return {
      count: 80,
      minSize: 2,
      maxSize: 8,
      speed: 1.5,
      color: '#eab308',
      colorLightness: 50,
      glow: 15
    };
  }

  getParameterConfig() {
    return [
      { name: 'count', label: 'Particle Count', type: 'range', min: 10, max: 300, step: 5 },
      { name: 'minSize', label: 'Min Size', type: 'range', min: 1, max: 10, step: 0.5 },
      { name: 'maxSize', label: 'Max Size', type: 'range', min: 2, max: 30, step: 0.5 },
      { name: 'speed', label: 'Max Speed', type: 'range', min: 0.1, max: 10, step: 0.1 },
      { name: 'glow', label: 'Glow Blur', type: 'range', min: 0, max: 50, step: 1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  initParticles(width, height) {
    this.particles = [];
    for (let i = 0; i < this.params.count; i++) {
      this.particles.push(this.createParticle(width, height));
    }
    this.lastCount = this.params.count;
  }

  createParticle(width, height) {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * this.params.speed,
      vy: (Math.random() - 0.5) * this.params.speed,
      size: Math.random() * (this.params.maxSize - this.params.minSize) + this.params.minSize,
      alpha: Math.random() * 0.5 + 0.5,
      pulseSpeed: Math.random() * 0.05 + 0.01,
      angle: Math.random() * Math.PI * 2
    };
  }

  update(time, frameCount, width, height) {
    const targetCount = Math.round(this.params.count);
    if (this.particles.length !== targetCount) {
      if (this.particles.length < targetCount) {
        while (this.particles.length < targetCount) {
          this.particles.push(this.createParticle(width, height));
        }
      } else {
        this.particles.length = targetCount;
      }
    }

    for (let p of this.particles) {
      const noiseAngle = noiseInst.noise2D(p.x * 0.005, p.y * 0.005) * Math.PI * 2;
      p.vx += Math.cos(noiseAngle) * 0.1;
      p.vy += Math.sin(noiseAngle) * 0.1;

      const speedVal = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (speedVal > this.params.speed) {
        p.vx = (p.vx / speedVal) * this.params.speed;
        p.vy = (p.vy / speedVal) * this.params.speed;
      }

      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.pulseSpeed;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;
    }
  }

  draw(ctx, width, height, time) {
    if (this.particles.length === 0) {
      this.initParticles(width, height);
    }

    ctx.save();
    
    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);

    if (this.params.glow > 0) {
      ctx.shadowBlur = this.params.glow;
      ctx.shadowColor = themeColor;
    }

    for (let p of this.particles) {
      const currentAlpha = p.alpha * (0.6 + Math.sin(p.angle) * 0.4);
      const currentSize = p.size * (0.75 + Math.sin(p.angle + Math.PI / 2) * 0.25);
      
      ctx.fillStyle = themeColor;
      ctx.globalAlpha = currentAlpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}

// 4. Lissajous Geometry Generator
export class GeometryGenerator extends BaseGenerator {
  defaultParams() {
    return {
      freqA: 3,
      freqB: 4,
      speed: 1,
      strokeWidth: 2,
      color: '#10b981',
      colorLightness: 50,
      radius: 200,
      scaleX: 1.5,
      phaseOffset: 1.5
    };
  }

  getParameterConfig() {
    return [
      { name: 'freqA', label: 'Frequency X', type: 'range', min: 1, max: 20, step: 1 },
      { name: 'freqB', label: 'Frequency Y', type: 'range', min: 1, max: 20, step: 1 },
      { name: 'speed', label: 'Speed', type: 'range', min: 0.1, max: 5, step: 0.1 },
      { name: 'strokeWidth', label: 'Thickness', type: 'range', min: 0.5, max: 15, step: 0.5 },
      { name: 'radius', label: 'Radius', type: 'range', min: 50, max: 400, step: 5 },
      { name: 'scaleX', label: 'Horizontal Scale', type: 'range', min: 0.5, max: 3.0, step: 0.1 },
      { name: 'phaseOffset', label: 'Phase Shift', type: 'range', min: 0, max: Math.PI * 2, step: 0.1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  draw(ctx, width, height, time) {
    ctx.strokeStyle = adjustColorLightness(this.params.color, this.params.colorLightness);
    ctx.lineWidth = this.params.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const cx = width / 2;
    const cy = height / 2;
    const timeFactor = time * this.params.speed * 0.01;

    const pointsCount = 400;
    for (let i = 0; i <= pointsCount; i++) {
      const theta = (i / pointsCount) * Math.PI * 2;
      
      const x = cx + Math.sin(theta * this.params.freqA + timeFactor) * this.params.radius * this.params.scaleX;
      const y = cy + Math.sin(theta * this.params.freqB + this.params.phaseOffset + timeFactor * 0.5) * this.params.radius;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
}

// 5. Growing Sketch Generator
export class GrowingSketchGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.reset();
  }

  defaultParams() {
    return {
      growSpeed: 3,
      branchCount: 5,
      noiseScale: 0.8,
      strokeWidth: 2,
      color: '#f43f5e',
      colorLightness: 50,
      density: 100
    };
  }

  getParameterConfig() {
    return [
      { name: 'growSpeed', label: 'Grow Speed', type: 'range', min: 0.5, max: 10, step: 0.5 },
      { name: 'branchCount', label: 'Branches', type: 'range', min: 1, max: 20, step: 1 },
      { name: 'noiseScale', label: 'Wiggle', type: 'range', min: 0.1, max: 3.0, step: 0.1 },
      { name: 'strokeWidth', label: 'Thickness', type: 'range', min: 0.5, max: 10, step: 0.5 },
      { name: 'density', label: 'Max Length', type: 'range', min: 50, max: 500, step: 10 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  reset() {
    this.sketchTime = 0;
    this.paths = [];
  }

  initPaths(width, height) {
    this.paths = [];
    const cx = width / 2;
    const cy = height / 2;

    for (let i = 0; i < this.params.branchCount; i++) {
      const angle = (i / this.params.branchCount) * Math.PI * 2;
      this.paths.push({
        points: [{ x: cx, y: cy }],
        angle: angle,
        speed: Math.random() * 2 + 1,
        active: true
      });
    }
    this.sketchTime = 0;
  }

  update(time, frameCount, width, height) {
    const targetBranches = Math.round(this.params.branchCount);
    if (this.paths.length !== targetBranches) {
      this.initPaths(width, height);
    }

    this.sketchTime += this.params.growSpeed;

    const maxDensity = Math.round(this.params.density);
    for (let path of this.paths) {
      if (!path.active) continue;
      if (path.points.length >= maxDensity) {
        path.active = false;
        continue;
      }

      const lastPt = path.points[path.points.length - 1];
      const noiseAngle = noiseInst.noise2D(lastPt.x * 0.01, lastPt.y * 0.01 + this.sketchTime * 0.005) * this.params.noiseScale;
      const currentAngle = path.angle + noiseAngle;

      const nextX = lastPt.x + Math.cos(currentAngle) * path.speed * this.params.growSpeed;
      const nextY = lastPt.y + Math.sin(currentAngle) * path.speed * this.params.growSpeed;

      if (nextX < 0 || nextX > width || nextY < 0 || nextY > height) {
        path.active = false;
      } else {
        path.points.push({ x: nextX, y: nextY });
      }
    }

    const allInactive = this.paths.every(p => !p.active);
    if (allInactive || this.sketchTime > 1500) {
      this.initPaths(width, height);
    }
  }

  draw(ctx, width, height, time) {
    if (this.paths.length === 0) {
      this.initPaths(width, height);
    }

    ctx.strokeStyle = adjustColorLightness(this.params.color, this.params.colorLightness);
    ctx.lineWidth = this.params.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (let path of this.paths) {
      if (path.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    }
  }
}

// 6. Neon Rain Generator
export class RainGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.drops = [];
  }

  defaultParams() {
    return {
      count: 120,
      speed: 15,
      length: 25,
      thickness: 1.5,
      angle: 15,
      color: '#06b6d4',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'count', label: 'Rain Count', type: 'range', min: 10, max: 300, step: 5 },
      { name: 'speed', label: 'Rain Speed', type: 'range', min: 2, max: 40, step: 1 },
      { name: 'length', label: 'Rain Length', type: 'range', min: 5, max: 80, step: 1 },
      { name: 'thickness', label: 'Thickness', type: 'range', min: 0.5, max: 8, step: 0.5 },
      { name: 'angle', label: 'Slant Angle', type: 'range', min: -45, max: 45, step: 1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  initDrops(width, height) {
    this.drops = [];
    for (let i = 0; i < this.params.count; i++) {
      this.drops.push({
        x: Math.random() * width,
        y: Math.random() * height,
        speed: (Math.random() * 0.4 + 0.8) * this.params.speed,
        length: (Math.random() * 0.5 + 0.75) * this.params.length
      });
    }
  }

  update(time, frameCount, width, height) {
    const targetCount = Math.round(this.params.count);
    if (this.drops.length !== targetCount) {
      if (this.drops.length < targetCount) {
        while (this.drops.length < targetCount) {
          this.drops.push({
            x: Math.random() * width,
            y: -20,
            speed: (Math.random() * 0.4 + 0.8) * this.params.speed,
            length: (Math.random() * 0.5 + 0.75) * this.params.length
          });
        }
      } else {
        this.drops.length = targetCount;
      }
    }

    const rad = (this.params.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    
    for (let d of this.drops) {
      d.y += d.speed;
      d.x += d.speed * dx;

      if (d.y > height + 20) {
        d.y = -d.length;
        d.x = Math.random() * width;
        d.speed = (Math.random() * 0.4 + 0.8) * this.params.speed;
        d.length = (Math.random() * 0.5 + 0.75) * this.params.length;
      }
      if (d.x < -20) d.x = width + 20;
      if (d.x > width + 20) d.x = -20;
    }
  }

  draw(ctx, width, height, time) {
    if (this.drops.length === 0) {
      this.initDrops(width, height);
    }

    ctx.strokeStyle = adjustColorLightness(this.params.color, this.params.colorLightness);
    ctx.lineWidth = this.params.thickness;
    ctx.lineCap = 'round';

    const rad = (this.params.angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = Math.cos(rad);

    ctx.beginPath();
    for (let d of this.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + d.length * dx, d.y + d.length * dy);
    }
    ctx.stroke();
  }
}

// 7. Meteor Shower Generator
export class MeteorGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.meteors = [];
    this.spawnTimer = 0;
  }

  defaultParams() {
    return {
      spawnRate: 4,
      speed: 16,
      tailLength: 60,
      thickness: 2,
      color: '#a855f7',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'spawnRate', label: 'Frequency', type: 'range', min: 1, max: 10, step: 0.5 },
      { name: 'speed', label: 'Meteor Speed', type: 'range', min: 5, max: 35, step: 1 },
      { name: 'tailLength', label: 'Tail Length', type: 'range', min: 10, max: 150, step: 5 },
      { name: 'thickness', label: 'Thickness', type: 'range', min: 0.5, max: 10, step: 0.5 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  update(time, frameCount, width, height) {
    this.spawnTimer++;
    const threshold = Math.max(5, 60 - this.params.spawnRate * 5);
    if (this.spawnTimer >= threshold) {
      this.spawnTimer = 0;
      this.meteors.push({
        x: Math.random() * (width + 200) - 100,
        y: -50,
        speed: (Math.random() * 0.5 + 0.75) * this.params.speed,
        length: (Math.random() * 0.4 + 0.8) * this.params.tailLength,
        alpha: 1.0,
        active: true
      });
    }

    for (let m of this.meteors) {
      m.x -= m.speed * 0.8;
      m.y += m.speed;
      
      if (m.y > height + 100 || m.x < -100) {
        m.active = false;
      }
    }

    this.meteors = this.meteors.filter(m => m.active);
  }

  draw(ctx, width, height, time) {
    ctx.lineCap = 'round';
    
    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);

    for (let m of this.meteors) {
      const gradient = ctx.createLinearGradient(
        m.x, m.y, 
        m.x + m.length * 0.8, m.y - m.length
      );
      gradient.addColorStop(0, themeColor);
      gradient.addColorStop(0.3, themeColor);
      gradient.addColorStop(1, 'transparent');

      ctx.strokeStyle = gradient;
      ctx.lineWidth = this.params.thickness;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x + m.length * 0.8, m.y - m.length);
      ctx.stroke();
    }
  }
}

// 8. Neon Ripples Generator
export class RippleGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.ripples = [];
    this.spawnTimer = 0;
  }

  defaultParams() {
    return {
      spawnRate: 3,
      expansionSpeed: 2.5,
      thickness: 1.5,
      maxRadius: 160,
      color: '#10b981',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'spawnRate', label: 'Frequency', type: 'range', min: 0.5, max: 10, step: 0.5 },
      { name: 'expansionSpeed', label: 'Spread Speed', type: 'range', min: 0.5, max: 8, step: 0.1 },
      { name: 'thickness', label: 'Line Weight', type: 'range', min: 0.5, max: 10, step: 0.5 },
      { name: 'maxRadius', label: 'Max Radius', type: 'range', min: 30, max: 400, step: 5 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  update(time, frameCount, width, height) {
    this.spawnTimer++;
    const threshold = Math.max(8, 70 - this.params.spawnRate * 6);
    if (this.spawnTimer >= threshold) {
      this.spawnTimer = 0;
      this.ripples.push({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: 5,
        speed: (Math.random() * 0.3 + 0.85) * this.params.expansionSpeed,
        active: true
      });
    }

    const maxR = this.params.maxRadius;
    for (let r of this.ripples) {
      r.radius += r.speed;
      if (r.radius >= maxR) {
        r.active = false;
      }
    }

    this.ripples = this.ripples.filter(r => r.active);
  }

  draw(ctx, width, height, time) {
    ctx.lineWidth = this.params.thickness;
    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);

    for (let r of this.ripples) {
      const progress = r.radius / this.params.maxRadius;
      const alpha = 1.0 - progress;

      ctx.strokeStyle = themeColor;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1.0;
  }
}

// 9. Audio Spectrum (Faux Analyzer) Generator
export class SpectrumGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.bands = [];
  }

  defaultParams() {
    return {
      bandCount: 32,
      sensitivity: 1.5,
      speed: 3,
      maxHeight: 250,
      barWidth: 8,
      gap: 3,
      color: '#f43f5e',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'bandCount', label: 'Bands', type: 'range', min: 8, max: 64, step: 2 },
      { name: 'sensitivity', label: 'Sensitivity', type: 'range', min: 0.1, max: 5, step: 0.1 },
      { name: 'speed', label: 'Speed/Jitter', type: 'range', min: 0.5, max: 10, step: 0.5 },
      { name: 'maxHeight', label: 'Max Height', type: 'range', min: 50, max: 500, step: 10 },
      { name: 'barWidth', label: 'Bar Width', type: 'range', min: 2, max: 30, step: 1 },
      { name: 'gap', label: 'Gap', type: 'range', min: 0, max: 20, step: 1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  update(time, frameCount, width, height) {
    const targetBands = Math.round(this.params.bandCount);
    if (this.bands.length !== targetBands) {
      this.bands = new Array(targetBands).fill(0);
    }

    const tFactor = time * 0.002 * this.params.speed;

    for (let i = 0; i < this.bands.length; i++) {
      const noise = noiseInst.noise2D(i * 0.15, tFactor);
      const sine = Math.sin(i * 0.3 + tFactor * 1.5) * 0.3;
      const targetVal = Math.max(0.05, (noise + sine + 0.5) * this.params.sensitivity);
      
      this.bands[i] += (targetVal - this.bands[i]) * 0.35;
    }
  }

  draw(ctx, width, height, time) {
    if (this.bands.length === 0) return;

    ctx.fillStyle = adjustColorLightness(this.params.color, this.params.colorLightness);

    const totalWidth = this.bands.length * this.params.barWidth + (this.bands.length - 1) * this.params.gap;
    const startX = (width - totalWidth) / 2;
    const bottomY = height - 50;

    for (let i = 0; i < this.bands.length; i++) {
      const h = Math.min(this.params.maxHeight, this.bands[i] * this.params.maxHeight * 0.6);
      const x = startX + i * (this.params.barWidth + this.params.gap);
      const y = bottomY - h;

      ctx.fillRect(x, y, this.params.barWidth, h);
    }
  }
}

// 10. 3D Rotating Glowing Cube Generator
export class Cube3DGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.angleX = 0;
    this.angleY = 0;
    this.angleZ = 0;
  }

  defaultParams() {
    return {
      size: 150,
      speedX: 0.5,
      speedY: 0.8,
      speedZ: 0.3,
      thickness: 3,
      fillOpacity: 0.15,
      color: '#a855f7',
      fillColor: '#06b6d4',
      colorLightness: 50,
      glow: 25
    };
  }

  getParameterConfig() {
    return [
      { name: 'size', label: 'Size', type: 'range', min: 20, max: 400, step: 5 },
      { name: 'speedX', label: 'Rotate Speed X', type: 'range', min: 0, max: 5, step: 0.1 },
      { name: 'speedY', label: 'Rotate Speed Y', type: 'range', min: 0, max: 5, step: 0.1 },
      { name: 'speedZ', label: 'Rotate Speed Z', type: 'range', min: 0, max: 5, step: 0.1 },
      { name: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 15, step: 0.5 },
      { name: 'fillOpacity', label: 'Fill Opacity', type: 'range', min: 0, max: 1, step: 0.05 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'glow', label: 'Glow Blur', type: 'range', min: 0, max: 80, step: 1 },
      { name: 'color', label: 'Wireframe Color', type: 'color' },
      { name: 'fillColor', label: 'Face Color', type: 'color' }
    ];
  }

  update(time, frameCount, width, height) {
    this.angleX += this.params.speedX * 0.01;
    this.angleY += this.params.speedY * 0.01;
    this.angleZ += this.params.speedZ * 0.01;
  }

  draw(ctx, width, height, time) {
    const cx = width / 2;
    const cy = height / 2;
    const size = this.params.size;

    const vertices = [
      { x: -size, y: -size, z: -size },
      { x: size, y: -size, z: -size },
      { x: size, y: size, z: -size },
      { x: -size, y: size, z: -size },
      { x: -size, y: -size, z: size },
      { x: size, y: -size, z: size },
      { x: size, y: size, z: size },
      { x: -size, y: size, z: size }
    ];

    const cosX = Math.cos(this.angleX);
    const sinX = Math.sin(this.angleX);
    const cosY = Math.cos(this.angleY);
    const sinY = Math.sin(this.angleY);
    const cosZ = Math.cos(this.angleZ);
    const sinZ = Math.sin(this.angleZ);

    const rotated = vertices.map(v => {
      let x1 = v.x * cosY - v.z * sinY;
      let z1 = v.x * sinY + v.z * cosY;
      let y2 = v.y * cosX - z1 * sinX;
      let z2 = v.y * sinX + z1 * cosX;
      let x3 = x1 * cosZ - y2 * sinZ;
      let y3 = x1 * sinZ + y2 * cosZ;
      
      return { x: x3, y: y3, z: z2 };
    });

    const fov = 600;
    const viewerDist = 300;
    const projected = rotated.map(v => {
      const scale = fov / (fov + v.z + viewerDist);
      return {
        x: v.x * scale + cx,
        y: v.y * scale + cy,
        z: v.z
      };
    });

    const color = adjustColorLightness(this.params.color, this.params.colorLightness);
    const fillColor = adjustColorLightness(this.params.fillColor, this.params.colorLightness);

    const faces = [
      { indices: [0, 1, 2, 3], avgZ: 0 },
      { indices: [4, 5, 6, 7], avgZ: 0 },
      { indices: [0, 1, 5, 4], avgZ: 0 },
      { indices: [2, 3, 7, 6], avgZ: 0 },
      { indices: [0, 3, 7, 4], avgZ: 0 },
      { indices: [1, 2, 6, 5], avgZ: 0 }
    ];

    faces.forEach(face => {
      face.avgZ = (
        projected[face.indices[0]].z +
        projected[face.indices[1]].z +
        projected[face.indices[2]].z +
        projected[face.indices[3]].z
      ) / 4;
    });

    faces.sort((a, b) => b.avgZ - a.avgZ);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    faces.forEach(face => {
      ctx.beginPath();
      const p0 = projected[face.indices[0]];
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < 4; i++) {
        const p = projected[face.indices[i]];
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();

      if (this.params.fillOpacity > 0) {
        ctx.fillStyle = hexToRgba(fillColor, this.params.fillOpacity);
        ctx.fill();
      }

      const glow = this.params.glow;
      if (glow > 0) {
        ctx.shadowColor = color;
        ctx.shadowBlur = glow;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = this.params.thickness;
      ctx.stroke();

      ctx.shadowBlur = 0;
    });
  }
}

// 11. Neon Lightning Generator
export class LightningGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.currentLightning = null; // { main: Point[], branches: Point[][] }
    this.flashTimer = 0;          // Seconds elapsed since last flash
    this.activeOpacity = 0.0;     // Current fade-out state
  }

  defaultParams() {
    return {
      thickness: 3,
      complexity: 6,      // Midpoint division depth (4-8)
      displace: 65,       // Maximum offset amount for jaggedness
      branchChance: 0.3,  // Probability of spawning a side-branch
      frequency: 2.0,     // Time interval between flashes (seconds)
      glow: 20,
      color: '#00f2ff',   // Neon Cyan
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'thickness', label: 'Thickness', type: 'range', min: 1, max: 10, step: 0.5 },
      { name: 'complexity', label: 'Detail (Complexity)', type: 'range', min: 3, max: 8, step: 1 },
      { name: 'displace', label: 'Displacement', type: 'range', min: 10, max: 200, step: 5 },
      { name: 'branchChance', label: 'Branching Chance', type: 'range', min: 0, max: 0.9, step: 0.05 },
      { name: 'frequency', label: 'Interval (Sec)', type: 'range', min: 0.5, max: 5.0, step: 0.1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'glow', label: 'Glow Blur', type: 'range', min: 0, max: 50, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  // Generates recursive segments of lightning main path, collects branches in branchesList.
  // Delegates the fractal midpoint-displacement math to the shared fractalLine.js helper,
  // passing a "grow downwards" branch-target callback to preserve lightning's original look.
  generateLightningBranch(x1, y1, x2, y2, displace, depth, branchesList = []) {
    return generateFractalBranch(x1, y1, x2, y2, displace, depth, this.params.branchChance, branchesList,
      (cx, cy, d, ex, ey) => ({
        bx: cx + (Math.random() - 0.5) * d * 2,
        by: cy + (Math.random() * 0.4 + 0.6) * (ey - cy)
      })
    );
  }

  update(time, frameCount, width, height) {
    // 1. Fast decay (fade-out) simulation
    if (this.activeOpacity > 0) {
      this.activeOpacity -= 0.08; // Disappear in ~12 frames
      if (this.activeOpacity < 0) this.activeOpacity = 0;
    }

    // 2. Flash trigger timing
    this.flashTimer += 0.016; 
    
    if (this.flashTimer >= this.params.frequency) {
      this.flashTimer = 0;
      this.activeOpacity = 1.0; // Trigger full flash

      // Top start bounds, bottom target bounds
      const startX = Math.random() * width * 0.6 + width * 0.2;
      const startY = 0;
      const endX = startX + (Math.random() - 0.5) * width * 0.3;
      const endY = height;

      const branchesList = [];
      const mainPath = this.generateLightningBranch(
        startX, startY,
        endX, endY,
        this.params.displace,
        Math.round(this.params.complexity),
        branchesList
      );

      this.currentLightning = {
        main: mainPath,
        branches: branchesList
      };
    }
  }

  draw(ctx, width, height, time) {
    if (!this.currentLightning || this.activeOpacity <= 0) return;

    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);

    // Apply glow effect via Canvas Shadow
    const glow = this.params.glow;
    if (glow > 0) {
      ctx.shadowColor = themeColor;
      ctx.shadowBlur = glow;
    }

    ctx.strokeStyle = themeColor;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'miter';
    ctx.globalAlpha = this.activeOpacity;

    // 1. Render Main lightning path
    ctx.beginPath();
    ctx.lineWidth = this.params.thickness;
    const main = this.currentLightning.main;
    if (main && main.length > 0) {
      ctx.moveTo(main[0].x, main[0].y);
      for (let i = 1; i < main.length; i++) {
        ctx.lineTo(main[i].x, main[i].y);
      }
      ctx.stroke();
    }

    // 2. Render Secondary branches (thinner)
    ctx.lineWidth = this.params.thickness * 0.5;
    for (let branch of this.currentLightning.branches) {
      if (branch && branch.length > 0) {
        ctx.beginPath();
        ctx.moveTo(branch[0].x, branch[0].y);
        for (let i = 1; i < branch.length; i++) {
          ctx.lineTo(branch[i].x, branch[i].y);
        }
        ctx.stroke();
      }
    }

    // Clean up canvas states
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;
  }
}

// 12. Neon Fog (霧) Generator
export class FogGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.fogPuffs = []; // Array of fog particles
  }

  defaultParams() {
    return {
      density: 12,        // Maximum number of active fog puffs
      size: 260,          // Base radius of each puff
      speed: 0.3,         // Maximum speed multiplier
      fadeSpeed: 0.003,   // How slowly the fog fades in and out (0.001 - 0.015)
      maxOpacity: 0.15,   // Maximum opacity limit for the fog
      color: '#e2e8f0',   // Mist grey
      colorLightness: 80
    };
  }

  getParameterConfig() {
    return [
      { name: 'density', label: 'Density', type: 'range', min: 2, max: 30, step: 1 },
      { name: 'size', label: 'Size', type: 'range', min: 100, max: 600, step: 10 },
      { name: 'speed', label: 'Drift Speed', type: 'range', min: 0, max: 2, step: 0.05 },
      { name: 'fadeSpeed', label: 'Fade Duration', type: 'range', min: 0.001, max: 0.015, step: 0.0005 },
      { name: 'maxOpacity', label: 'Max Thickness', type: 'range', min: 0.05, max: 0.5, step: 0.01 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  // Helper to initialize a single fog particle (puff)
  createFogPuff(width, height, isInitial = false) {
    const size = this.params.size * (0.8 + Math.random() * 0.4);
    const speed = this.params.speed;
    const maxOpacity = this.params.maxOpacity * (0.7 + Math.random() * 0.6);

    // Initial puffs are randomly scattered, respawned ones start slightly outside screen bounds
    let x = Math.random() * width;
    let y = Math.random() * height;

    if (!isInitial) {
      // Pick a random edge to spawn on
      const edge = Math.floor(Math.random() * 4);
      if (edge === 0) { x = -size; y = Math.random() * height; } // Left
      else if (edge === 1) { x = width + size; y = Math.random() * height; } // Right
      else if (edge === 2) { x = Math.random() * width; y = -size; } // Top
      else { x = Math.random() * width; y = height + size; } // Bottom
    }

    return {
      x,
      y,
      vx: (Math.random() - 0.5) * speed,
      vy: (Math.random() - 0.5) * speed,
      radius: size,
      opacity: isInitial ? Math.random() * maxOpacity : 0.0, // Initial puffs can start partially opaque
      targetOpacity: maxOpacity,
      fadeState: 'in', // 'in' or 'out'
      angle: Math.random() * Math.PI * 2,
      angleSpeed: (Math.random() - 0.5) * 0.002,
      dying: false // true once excess from a density decrease - fades out instead of respawning
    };
  }

  update(time, frameCount, width, height) {
    // 1. Maintain correct density
    const targetDensity = Math.round(this.params.density);

    // Adjust puff count: grow immediately (new puffs fade in via fadeState below), but
    // shrink by marking excess puffs to fade out naturally instead of truncating the array.
    while (this.fogPuffs.length < targetDensity) {
      this.fogPuffs.push(this.createFogPuff(width, height, this.fogPuffs.length === 0));
    }
    for (let i = targetDensity; i < this.fogPuffs.length; i++) {
      this.fogPuffs[i].dying = true;
      this.fogPuffs[i].fadeState = 'out';
    }

    // 2. Update each active fog puff
    const fadeSpeed = this.params.fadeSpeed;
    const speedMultiplier = this.params.speed;

    for (let i = this.fogPuffs.length - 1; i >= 0; i--) {
      let p = this.fogPuffs[i];

      // Update drift velocity relative to speed parameter updates
      p.vx = Math.sign(p.vx || 1) * Math.random() * speedMultiplier;
      p.vy = Math.sign(p.vy || 1) * Math.random() * speedMultiplier;

      p.x += p.vx;
      p.y += p.vy;
      p.angle += p.angleSpeed;

      // Update particle sizes in real-time based on control panel size
      p.radius = this.params.size * (0.85 + 0.3 * Math.sin(p.angle * 0.5));

      // Handle the natural fade-in / fade-out lifecycle
      if (p.fadeState === 'in') {
        p.opacity += fadeSpeed;
        const currentMax = this.params.maxOpacity;
        if (p.opacity >= currentMax) {
          p.opacity = currentMax;
          // Random chance to start fading out, or if it exceeds target
          if (Math.random() < 0.005) {
            p.fadeState = 'out';
          }
        }
      } else {
        p.opacity -= fadeSpeed;
        if (p.opacity <= 0) {
          p.opacity = 0;
          if (p.dying) {
            // Excess from a density decrease - remove instead of respawning
            this.fogPuffs.splice(i, 1);
            continue;
          }
          // Respawn this puff at screen boundary
          this.fogPuffs[i] = this.createFogPuff(width, height, false);
        }
      }

      // If limits are changed in real-time, clamp opacity
      if (p.opacity > this.params.maxOpacity) {
        p.opacity = this.params.maxOpacity;
      }
    }
  }

  draw(ctx, width, height, time) {
    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);
    
    // Convert hex to rgb format for radial gradient stops
    let rgb = { r: 226, g: 232, b: 240 };
    if (this.params.color.startsWith('#')) {
      const hex = this.params.color;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        rgb = { r, g, b };
      }
    }

    ctx.save();
    
    // Render each puff with a soft radial gradient
    for (let p of this.fogPuffs) {
      if (p.opacity <= 0) continue;

      const grad = ctx.createRadialGradient(p.x, p.y, p.radius * 0.1, p.x, p.y, p.radius);
      // Soft center fading completely to transparent at edge
      grad.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity})`);
      grad.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${p.opacity * 0.6})`);
      grad.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

  }
}

// 13. Cyber Flame Generator
export class FlameGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.particles = [];
  }

  defaultParams() {
    return {
      density: 80,
      speed: 5,
      wiggle: 1.5,
      height: 250,
      strokeWidth: 15,
      shapeType: 0, // See particleShapes.js PARTICLE_SHAPE_TYPES for the full list (0-11)
      colorVariance: 0, // 0-100: per-particle hue jitter, 0 = uniform color (legacy behavior)
      color: '#ef4444',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'density', label: 'Density / Count', type: 'range', min: 10, max: 200, step: 5 },
      { name: 'speed', label: 'Rise Speed', type: 'range', min: 1, max: 15, step: 0.5 },
      { name: 'wiggle', label: 'Wiggle Intensity', type: 'range', min: 0.1, max: 5.0, step: 0.1 },
      { name: 'height', label: 'Flame Height', type: 'range', min: 50, max: 500, step: 10 },
      { name: 'strokeWidth', label: 'Particle Size', type: 'range', min: 1, max: 30, step: 1 },
      { name: 'shapeType', label: `Shape Type (0-${PARTICLE_SHAPE_COUNT - 1})`, type: 'range', min: 0, max: PARTICLE_SHAPE_COUNT - 1, step: 1 },
      { name: 'colorVariance', label: 'Color Variance', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  update(time, frameCount, width, height) {
    const targetCount = Math.round(this.params.density);
    const spawnRate = Math.max(1, Math.round(targetCount / 30));
    for (let i = 0; i < spawnRate; i++) {
      if (this.particles.length < targetCount) {
        this.particles.push({
          x: width / 2 + (Math.random() - 0.5) * (width * 0.2),
          y: height + 10,
          vx: (Math.random() - 0.5) * this.params.wiggle,
          vy: -this.params.speed * (0.6 + Math.random() * 0.8),
          life: 1.0,
          decay: 0.01 + Math.random() * 0.02 * (200 / this.params.height),
          seed: Math.random() * 100,
          varietySeed: Math.random(),
          // 3D angles
          angleX: Math.random() * Math.PI * 2,
          angleY: Math.random() * Math.PI * 2,
          angleZ: Math.random() * Math.PI * 2,
          rx: (Math.random() - 0.5) * 0.05,
          ry: (Math.random() - 0.5) * 0.05,
          rz: (Math.random() - 0.5) * 0.05
        });
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const noiseVal = noiseInst.noise2D(p.x * 0.01, (time + p.seed * 10) * 0.002);
      p.x += p.vx + noiseVal * this.params.wiggle;
      p.y += p.vy;

      // Update 3D angles
      p.angleX += p.rx;
      p.angleY += p.ry;
      p.angleZ += p.rz;
    }
  }

  draw(ctx, width, height, time) {
    ctx.save();

    for (let p of this.particles) {
      const size = this.params.strokeWidth * p.life;
      const alpha = p.life * 0.8;
      if (size <= 0.1) continue;

      ctx.save();
      ctx.translate(p.x, p.y);

      // Stretch along the particle's actual rise/wiggle direction for a flame-tongue look,
      // using the stored base velocity (not the per-frame noise offset) so the stretch axis
      // doesn't flicker. Rotate to align local Y with velocity, scale, rotate back so the
      // pseudo-3D transform below still operates in the particle's original local frame.
      const speed = Math.hypot(p.vx, p.vy);
      if (speed > 0.01) {
        const velAngle = Math.atan2(p.vy, p.vx) + Math.PI / 2;
        const stretch = 1 + Math.min(1.5, speed * 0.12);
        ctx.rotate(velAngle);
        ctx.scale(1, stretch);
        ctx.rotate(-velAngle);
      }

      ctx.rotate(p.angleZ);
      ctx.scale(Math.cos(p.angleY), Math.sin(p.angleX));

      ctx.globalAlpha = alpha;

      // Life-based color: bright/hot near spawn (life close to 1, near the flame base),
      // cooling toward dark embers as the particle ages and rises (life -> 0). Only the
      // lightness is modulated so the user's chosen hue (color param) is always respected.
      const baseLightness = this.params.colorLightness;
      const lifeLightness = p.life > 0.7
        ? baseLightness + (96 - baseLightness) * ((p.life - 0.7) / 0.3)
        : baseLightness * (0.15 + 0.85 * (p.life / 0.7));
      const hueOffset = this.params.colorVariance > 0
        ? (p.varietySeed - 0.5) * 2 * this.params.colorVariance * 1.8
        : 0;
      const particleColor = jitterHue(this.params.color, lifeLightness, hueOffset);

      drawParticleShape(ctx, this.params.shapeType, size, {
        themeColor: particleColor.css,
        parsedColor: particleColor.rgb,
        seed: p.varietySeed * 1000
      });
      ctx.restore();
    }
    ctx.restore();
  }
}

// 14. Neon Snowflake Generator
export class SnowflakeGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.particles = [];
  }

  defaultParams() {
    return {
      count: 50,
      symmetry: 6,
      radius: 30,
      speed: 2.0,
      thickness: 1.5,
      color: '#38bdf8',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'count', label: 'Snowflake Count', type: 'range', min: 10, max: 150, step: 5 },
      { name: 'symmetry', label: 'Symmetry', type: 'range', min: 3, max: 12, step: 1 },
      { name: 'radius', label: 'Snowflake Size', type: 'range', min: 10, max: 150, step: 1 },
      { name: 'speed', label: 'Fall Speed', type: 'range', min: 0.5, max: 8.0, step: 0.1 },
      { name: 'thickness', label: 'Line Thickness', type: 'range', min: 0.5, max: 5.0, step: 0.1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  createParticle(width, height) {
    return {
      x: Math.random() * width,
      y: Math.random() * (height + 100) - 100, // Spawn throughout screen initially
      vy: this.params.speed * (0.6 + Math.random() * 0.8),
      size: this.params.radius * (0.6 + Math.random() * 0.8),
      alpha: Math.random() * 0.5 + 0.5,
      seed: Math.random() * 100,
      // 3D Angles
      angleX: Math.random() * Math.PI * 2,
      angleY: Math.random() * Math.PI * 2,
      angleZ: Math.random() * Math.PI * 2,
      // Rotation speeds
      rx: (Math.random() - 0.5) * 0.03,
      ry: (Math.random() - 0.5) * 0.03,
      rz: (Math.random() - 0.5) * 0.03,
      fadeMul: 0, // ramps 0->1 on spawn, 1->0 when dying, so count changes fade instead of pop
      dying: false
    };
  }

  update(time, frameCount, width, height) {
    const targetCount = Math.round(this.params.count);
    while (this.particles.length < targetCount) {
      this.particles.push(this.createParticle(width, height));
    }
    for (let i = targetCount; i < this.particles.length; i++) {
      this.particles[i].dying = true;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.fadeMul += p.dying ? -0.05 : 0.05;
      p.fadeMul = Math.max(0, Math.min(1, p.fadeMul));
      if (p.dying && p.fadeMul <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Fall down
      p.y += p.vy;

      // Drift left/right using noise
      const drift = noiseInst.noise2D(p.x * 0.005, p.y * 0.005 + time * 0.0001);
      p.x += drift * 1.5;

      // Update 3D angles
      p.angleX += p.rx;
      p.angleY += p.ry;
      p.angleZ += p.rz;

      // Wrap around screen boundaries
      if (p.y > height + p.size) {
        p.y = -p.size;
        p.x = Math.random() * width;
        p.vy = this.params.speed * (0.6 + Math.random() * 0.8);
        p.size = this.params.radius * (0.6 + Math.random() * 0.8);
      }
      if (p.x < -p.size) p.x = width + p.size;
      if (p.x > width + p.size) p.x = -p.size;
    }
  }

  draw(ctx, width, height, time) {
    if (this.particles.length === 0) {
      this.particles = [];
      const targetCount = Math.round(this.params.count);
      for (let i = 0; i < targetCount; i++) {
        this.particles.push(this.createParticle(width, height));
      }
    }

    ctx.save();
    ctx.strokeStyle = adjustColorLightness(this.params.color, this.params.colorLightness);
    ctx.lineWidth = this.params.thickness;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const sym = Math.round(this.params.symmetry);
    const angle = (Math.PI * 2) / sym;

    for (let p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Z-rotation and X/Y-rotation via scale (3D effect)
      ctx.rotate(p.angleZ);
      ctx.scale(Math.cos(p.angleY), Math.sin(p.angleX));

      ctx.globalAlpha = p.alpha * p.fadeMul;

      const r = p.size;

      // Draw symmetrical snowflake branch vectors
      for (let s = 0; s < sym; s++) {
        ctx.save();
        ctx.rotate(s * angle);
        
        // Main branch line
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(r, 0);
        ctx.stroke();

        // Branch spikes
        const branchCount = 3;
        for (let i = 1; i <= branchCount; i++) {
          const branchX = r * (i / (branchCount + 1));
          const branchLength = (r - branchX) * 0.6;
          if (branchLength <= 0) continue;

          ctx.beginPath();
          ctx.moveTo(branchX, 0);
          ctx.lineTo(branchX + branchLength * 0.5, branchLength * 0.866);
          ctx.moveTo(branchX, 0);
          ctx.lineTo(branchX + branchLength * 0.5, -branchLength * 0.866);
          ctx.stroke();
        }

        ctx.restore();
      }

      ctx.restore();
    }
    ctx.restore();
  }
}

// 15. Neon Spirograph Generator
export class SpirographGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.currentPhase = 0;
  }

  update(time, frameCount, width, height) {
    this.currentPhase += this.params.speed * 0.01;
  }

  defaultParams() {
    return {
      R: 150,
      r: 90,
      d: 80,
      revolutions: 10,
      speed: 1.0,
      strokeWidth: 1.5,
      color: '#10b981',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'R', label: 'Outer Radius (R)', type: 'range', min: 50, max: 300, step: 2 },
      { name: 'r', label: 'Inner Radius (r)', type: 'range', min: 10, max: 200, step: 2 },
      { name: 'd', label: 'Pen Distance (d)', type: 'range', min: 10, max: 300, step: 2 },
      { name: 'revolutions', label: 'Revolutions', type: 'range', min: 1, max: 30, step: 1 },
      { name: 'speed', label: 'Animation Speed', type: 'range', min: 0.1, max: 4.0, step: 0.1 },
      { name: 'strokeWidth', label: 'Thickness', type: 'range', min: 0.5, max: 10, step: 0.5 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  draw(ctx, width, height, time) {
    ctx.save();
    ctx.strokeStyle = adjustColorLightness(this.params.color, this.params.colorLightness);
    ctx.lineWidth = this.params.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const cx = width / 2;
    const cy = height / 2;
    const R = this.params.R;
    const r = this.params.r;
    const d = this.params.d;
    const revs = this.params.revolutions;
    
    const phase = this.currentPhase;
    const totalPoints = revs * 150;

    for (let i = 0; i <= totalPoints; i++) {
      const theta = (i / 150) * Math.PI * 2;
      
      const x = (R - r) * Math.cos(theta + phase) + d * Math.cos(((R - r) / r) * theta + phase);
      const y = (R - r) * Math.sin(theta + phase) - d * Math.sin(((R - r) / r) * theta + phase);

      const px = cx + x;
      const py = cy + y;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

// 16. Aurora Curtain Generator
export class AuroraGenerator extends BaseGenerator {
  defaultParams() {
    return {
      bands: 3,
      height: 350,
      waveFreq: 0.004,
      speed: 1.0,
      color: '#10b981',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'bands', label: 'Aurora Bands', type: 'range', min: 1, max: 5, step: 1 },
      { name: 'height', label: 'Curtain Height', type: 'range', min: 100, max: 600, step: 10 },
      { name: 'waveFreq', label: 'Wave Frequency', type: 'range', min: 0.001, max: 0.01, step: 0.0005 },
      { name: 'speed', label: 'Wave Speed', type: 'range', min: 0.1, max: 3.0, step: 0.1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  draw(ctx, width, height, time) {
    ctx.save();
    
    const bandsCount = Math.round(this.params.bands);
    const speedOffset = time * this.params.speed * 0.0005;

    for (let b = 0; b < bandsCount; b++) {
      const bandOffset = b * 40;

      for (let x = 0; x < width; x += 3) {
        const n1 = noiseInst.noise2D(x * this.params.waveFreq + bandOffset, speedOffset);
        const n2 = noiseInst.noise2D(x * this.params.waveFreq * 2 + bandOffset * 1.5, speedOffset * 0.8) * 0.5;
        const waveY = (height * 0.25) + (n1 + n2) * (height * 0.12);

        const slitIntensity = 0.4 + 0.6 * Math.abs(noiseInst.noise1D(x * 0.15 + bandOffset));
        const curtainH = this.params.height * (0.8 + 0.4 * noiseInst.noise1D(x * 0.02 + speedOffset));
        const gradient = ctx.createLinearGradient(x, waveY, x, waveY + curtainH);
        
        const rgbaBase = hexToRgba(this.params.color, 0.4 * slitIntensity);
        const rgbaFade = hexToRgba(this.params.color, 0.0);
        
        gradient.addColorStop(0, rgbaBase);
        gradient.addColorStop(0.3, hexToRgba(this.params.color, 0.2 * slitIntensity));
        gradient.addColorStop(1, rgbaFade);

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x, waveY);
        ctx.lineTo(x, waveY + curtainH);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

// 17. Dry Ice Smoke Generator
export class DryIceGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.particles = [];
  }

  defaultParams() {
    return {
      density: 120,
      fallSpeed: 2.5,
      diffusion: 1.5,
      maxSize: 40,
      shapeType: 0, // See particleShapes.js PARTICLE_SHAPE_TYPES for the full list (0-11)
      colorVariance: 0, // 0-100: per-particle hue jitter, 0 = uniform color (legacy behavior)
      color: '#ffffff',
      colorLightness: 80
    };
  }

  getParameterConfig() {
    return [
      { name: 'density', label: 'Density / Count', type: 'range', min: 10, max: 250, step: 5 },
      { name: 'fallSpeed', label: 'Fall Speed', type: 'range', min: 0.5, max: 8.0, step: 0.1 },
      { name: 'diffusion', label: 'Horizontal Wind', type: 'range', min: 0.1, max: 4.0, step: 0.1 },
      { name: 'maxSize', label: 'Max Smoke Size', type: 'range', min: 5, max: 80, step: 1 },
      { name: 'shapeType', label: `Shape Type (0-${PARTICLE_SHAPE_COUNT - 1})`, type: 'range', min: 0, max: PARTICLE_SHAPE_COUNT - 1, step: 1 },
      { name: 'colorVariance', label: 'Color Variance', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  update(time, frameCount, width, height) {
    const targetCount = Math.round(this.params.density);
    const spawnRate = Math.max(1, Math.round(targetCount / 40));

    for (let i = 0; i < spawnRate; i++) {
      if (this.particles.length < targetCount) {
        this.particles.push({
          x: Math.random() * width,
          y: -20,
          vx: (Math.random() - 0.5) * this.params.diffusion,
          vy: this.params.fallSpeed * (0.8 + Math.random() * 0.4),
          life: 1.0,
          decay: 0.005 + Math.random() * 0.015,
          size: Math.random() * (this.params.maxSize * 0.5) + this.params.maxSize * 0.5,
          seed: Math.random() * 200,
          varietySeed: Math.random(),
          // 3D angles
          angleX: Math.random() * Math.PI * 2,
          angleY: Math.random() * Math.PI * 2,
          angleZ: Math.random() * Math.PI * 2,
          rx: (Math.random() - 0.5) * 0.03,
          ry: (Math.random() - 0.5) * 0.03,
          rz: (Math.random() - 0.5) * 0.03
        });
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      const windNoise = noiseInst.noise2D(p.x * 0.005, p.y * 0.005 + time * 0.0002);
      p.x += p.vx + windNoise * this.params.diffusion;
      p.y += p.vy;

      // Update 3D angles
      p.angleX += p.rx;
      p.angleY += p.ry;
      p.angleZ += p.rz;
    }
  }

  draw(ctx, width, height, time) {
    ctx.save();
    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);
    const parsedColor = parseHexToRgb(this.params.color);

    for (let p of this.particles) {
      const currentSize = p.size * (1.0 + (1.0 - p.life) * 0.8);
      const alpha = p.life * 0.3;
      if (currentSize <= 0.1) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angleZ);
      ctx.scale(Math.cos(p.angleY), Math.sin(p.angleX));

      ctx.globalAlpha = alpha;

      let particleThemeColor = themeColor;
      let particleParsedColor = parsedColor;
      if (this.params.colorVariance > 0) {
        const hueOffset = (p.varietySeed - 0.5) * 2 * this.params.colorVariance * 1.8;
        const jittered = jitterHue(this.params.color, this.params.colorLightness, hueOffset);
        particleThemeColor = jittered.css;
        particleParsedColor = jittered.rgb;
      }

      drawParticleShape(ctx, this.params.shapeType, currentSize, {
        themeColor: particleThemeColor,
        parsedColor: particleParsedColor,
        seed: p.varietySeed * 1000
      });
      ctx.restore();
    }
    ctx.restore();
  }
}

// 18. 3D Shape Particles Generator
export class Shape3DParticlesGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.particles = [];
  }

  defaultParams() {
    return {
      count: 80,
      shapeType: 0, // See particleShapes.js PARTICLE_SHAPE_TYPES for the full list (0-11)
      colorVariance: 0, // 0-100: per-particle hue jitter, 0 = uniform color (legacy behavior)
      speed: 2.0,
      rotSpeedX: 0.02,
      rotSpeedY: 0.03,
      rotSpeedZ: 0.05,
      minSize: 5,
      maxSize: 20,
      color: '#eab308',
      colorLightness: 50
    };
  }

  getParameterConfig() {
    return [
      { name: 'count', label: 'Particle Count', type: 'range', min: 10, max: 250, step: 5 },
      { name: 'shapeType', label: `Shape Type (0-${PARTICLE_SHAPE_COUNT - 1})`, type: 'range', min: 0, max: PARTICLE_SHAPE_COUNT - 1, step: 1 },
      { name: 'speed', label: 'Max Speed', type: 'range', min: 0.5, max: 10.0, step: 0.1 },
      { name: 'rotSpeedX', label: 'Rot Speed X', type: 'range', min: 0.0, max: 0.1, step: 0.005 },
      { name: 'rotSpeedY', label: 'Rot Speed Y', type: 'range', min: 0.0, max: 0.1, step: 0.005 },
      { name: 'rotSpeedZ', label: 'Rot Speed Z', type: 'range', min: 0.0, max: 0.2, step: 0.005 },
      { name: 'minSize', label: 'Min Size', type: 'range', min: 2, max: 10, step: 0.5 },
      { name: 'maxSize', label: 'Max Size', type: 'range', min: 5, max: 40, step: 0.5 },
      { name: 'colorVariance', label: 'Color Variance', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  createParticle(width, height) {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * this.params.speed,
      vy: (Math.random() - 0.5) * this.params.speed,
      size: Math.random() * (this.params.maxSize - this.params.minSize) + this.params.minSize,
      alpha: Math.random() * 0.5 + 0.5,
      varietySeed: Math.random(),
      // 3D Angles
      angleX: Math.random() * Math.PI * 2,
      angleY: Math.random() * Math.PI * 2,
      angleZ: Math.random() * Math.PI * 2,
      // Custom variations for rotation speeds
      rx: (Math.random() - 0.5) * this.params.rotSpeedX,
      ry: (Math.random() - 0.5) * this.params.rotSpeedY,
      rz: (Math.random() - 0.5) * this.params.rotSpeedZ,
      fadeMul: 0, // ramps 0->1 on spawn, 1->0 when dying, so count changes fade instead of pop
      dying: false
    };
  }

  update(time, frameCount, width, height) {
    const targetCount = Math.round(this.params.count);
    while (this.particles.length < targetCount) {
      this.particles.push(this.createParticle(width, height));
    }
    for (let i = targetCount; i < this.particles.length; i++) {
      this.particles[i].dying = true;
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.fadeMul += p.dying ? -0.05 : 0.05;
      p.fadeMul = Math.max(0, Math.min(1, p.fadeMul));
      if (p.dying && p.fadeMul <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      p.x += p.vx;
      p.y += p.vy;

      // Update angles
      p.angleX += p.rx;
      p.angleY += p.ry;
      p.angleZ += p.rz;

      if (p.x < -p.size) p.x = width + p.size;
      if (p.x > width + p.size) p.x = -p.size;
      if (p.y < -p.size) p.y = height + p.size;
      if (p.y > height + p.size) p.y = -p.size;
    }
  }

  draw(ctx, width, height, time) {
    if (this.particles.length === 0) {
      this.particles = [];
      const targetCount = Math.round(this.params.count);
      for (let i = 0; i < targetCount; i++) {
        this.particles.push(this.createParticle(width, height));
      }
    }

    ctx.save();
    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);
    const parsedColor = parseHexToRgb(this.params.color);

    for (let p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);

      // Rotate on Z, scale on X/Y to emulate 3D rotation (2.5D)
      ctx.rotate(p.angleZ);
      ctx.scale(Math.cos(p.angleY), Math.sin(p.angleX));

      ctx.globalAlpha = p.alpha * p.fadeMul;

      let particleThemeColor = themeColor;
      let particleParsedColor = parsedColor;
      if (this.params.colorVariance > 0) {
        const hueOffset = (p.varietySeed - 0.5) * 2 * this.params.colorVariance * 1.8;
        const jittered = jitterHue(this.params.color, this.params.colorLightness, hueOffset);
        particleThemeColor = jittered.css;
        particleParsedColor = jittered.rgb;
      }

      drawParticleShape(ctx, this.params.shapeType, p.size, {
        themeColor: particleThemeColor,
        parsedColor: particleParsedColor,
        seed: p.varietySeed * 1000
      });
      ctx.restore();
    }
    ctx.restore();
  }
}

// 19. Lighthouse Beacon Generator
export class LighthouseGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.currentAngle = 0;
  }

  update(time, frameCount, width, height) {
    this.currentAngle += this.params.rotationSpeed * 0.01;
  }

  defaultParams() {
    return {
      beamCount: 2,
      rotationSpeed: 1.0,
      beamWidth: 12,
      beamLength: 600,
      hueCycleSpeed: 0, // 0 = static color (color/colorLightness as-is), >0 = hue cycles over time
      fogIntensity: 40, // 0 = perfectly clean beam (legacy look); >0 = patchy density + slight angular warp
      occluderCount: 2, // fixed dark bands the beam dims as it sweeps through (0 = none)
      occluderWidth: 20, // degrees
      occluderStrength: 70, // 0-100: how much an occluder dims the beam at its center
      color: '#fbbf24',
      colorLightness: 60
    };
  }

  getParameterConfig() {
    return [
      { name: 'beamCount', label: 'Beam Count', type: 'range', min: 1, max: 4, step: 1 },
      { name: 'rotationSpeed', label: 'Rotation Speed', type: 'range', min: 0.2, max: 4.0, step: 0.1 },
      { name: 'beamWidth', label: 'Beam Width (deg)', type: 'range', min: 2, max: 60, step: 1 },
      { name: 'beamLength', label: 'Beam Length', type: 'range', min: 100, max: 1500, step: 10 },
      { name: 'hueCycleSpeed', label: 'Hue Cycle Speed', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'fogIntensity', label: 'Fog / Distortion', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'occluderCount', label: 'Occluder Count', type: 'range', min: 0, max: 3, step: 1 },
      { name: 'occluderWidth', label: 'Occluder Width (deg)', type: 'range', min: 5, max: 60, step: 1 },
      { name: 'occluderStrength', label: 'Occluder Strength', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  // Fixed-in-world-space dimming zones the beam sweeps through, simulating a distant
  // obstruction (terrain, structure) partially blocking the light - independent of the
  // natural "flash" a viewer sees when a narrow beam points at them.
  occlusionAt(absAngle, occluderCount, occluderWidthRad, occluderStrength) {
    if (occluderCount <= 0) return 1.0;
    let minDist = Infinity;
    for (let k = 0; k < occluderCount; k++) {
      const occAngle = (k / occluderCount) * Math.PI * 2;
      let d = Math.abs(absAngle - occAngle) % (Math.PI * 2);
      if (d > Math.PI) d = Math.PI * 2 - d;
      if (d < minDist) minDist = d;
    }
    if (minDist > occluderWidthRad) return 1.0;
    const t = minDist / occluderWidthRad; // 0 at occluder center, 1 at its edge
    return 1 - (1 - t) * occluderStrength;
  }

  draw(ctx, width, height, time) {
    const cx = width / 2;
    const cy = height / 2;
    const rotation = this.currentAngle;
    const hueOffset = this.params.hueCycleSpeed > 0
      ? (time * 0.001 * this.params.hueCycleSpeed * 36) % 360
      : 0;
    const beamColor = jitterHue(this.params.color, this.params.colorLightness, hueOffset);
    const halfWidthRad = (this.params.beamWidth * Math.PI / 180) / 2;
    const beamCount = Math.round(this.params.beamCount);
    const fogAmt = this.params.fogIntensity / 100;
    const occluderCount = Math.round(this.params.occluderCount);
    const occluderWidthRad = this.params.occluderWidth * Math.PI / 180;
    const occluderStrength = this.params.occluderStrength / 100;

    ctx.save();

    // Lamp housing: a small always-lit core at the pivot (the source itself isn't fogged,
    // only the beam travelling through the air is).
    const coreR = this.params.beamLength * 0.08;
    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR);
    coreGrad.addColorStop(0, `rgba(${beamColor.rgb.r}, ${beamColor.rgb.g}, ${beamColor.rgb.b}, 1)`);
    coreGrad.addColorStop(1, `rgba(${beamColor.rgb.r}, ${beamColor.rgb.g}, ${beamColor.rgb.b}, 0)`);
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fill();

    // Each beam is drawn as a series of thin annular (ring) segments along its length
    // rather than one smooth gradient sector, so density/angle can vary per segment for
    // the fog-patch and distortion effect.
    const SEGMENTS = 18;

    for (let i = 0; i < beamCount; i++) {
      const beamAngle = rotation + (i / beamCount) * Math.PI * 2;

      for (let s = 0; s < SEGMENTS; s++) {
        const r0 = (s / SEGMENTS) * this.params.beamLength;
        const r1 = ((s + 1) / SEGMENTS) * this.params.beamLength;
        const rMid = (r0 + r1) / 2;

        const falloff = Math.pow(1 - rMid / this.params.beamLength, 1.3);

        // Patchy fog density: slowly drifting noise sampled along the beam's length/angle.
        const fogNoise = noiseInst.noise2D(rMid * 0.008, beamAngle * 3 + time * 0.0002 + i * 11);
        const fogFactor = 1 - fogAmt * Math.max(0, -fogNoise) * 0.9;

        // Slight angular warp of this segment, as if refracted by uneven mist.
        const warpNoise = noiseInst.noise2D(rMid * 0.015, time * 0.0003 + i * 7.3);
        const segAngle = beamAngle + warpNoise * fogAmt * halfWidthRad * 0.6;

        const occlusion = this.occlusionAt(segAngle, occluderCount, occluderWidthRad, occluderStrength);

        const alpha = 0.85 * falloff * fogFactor * occlusion;
        if (alpha <= 0.01) continue;

        ctx.beginPath();
        ctx.arc(cx, cy, r1, segAngle - halfWidthRad, segAngle + halfWidthRad);
        ctx.arc(cx, cy, r0, segAngle + halfWidthRad, segAngle - halfWidthRad, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(${beamColor.rgb.r}, ${beamColor.rgb.g}, ${beamColor.rgb.b}, ${alpha})`;
        ctx.fill();
      }
    }

    ctx.restore();
  }
}

// 20. Shockwave Burst Generator (transition/cut-in: one-shot, fades to fully
// transparent at both ends of its own cycleDuration - see CLAUDE.md "トランジション/
// カットイン系ジェネレーターの作り方" for the cycleDuration/progress/envelope pattern
// this and future transition-style generators should follow).
export class ShockwaveBurstGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.lastCycleIndex = -1;
    this.spikeProfiles = []; // one jagged radius-multiplier profile per ring, cached per cycle
  }

  defaultParams() {
    return {
      cycleDuration: 1500, // ms; match the project's export Duration for a single burst
      ringCount: 1,
      maxRadius: 800,
      ringThickness: 30,
      jaggedness: 0.35, // 0 = perfect circle (old look); higher = sharp spiky silhouette, not a smooth wobble
      windupFrac: 0.12, // fraction of the cycle spent coiling inward before the burst fires outward
      fadeInFrac: 0.05,
      fadeOutFrac: 0.3,
      color: '#22d3ee',
      colorLightness: 60
    };
  }

  getParameterConfig() {
    return [
      { name: 'cycleDuration', label: 'Cycle Duration (ms)', type: 'range', min: 500, max: 5000, step: 100 },
      { name: 'ringCount', label: 'Ring Count', type: 'range', min: 1, max: 3, step: 1 },
      { name: 'maxRadius', label: 'Max Radius', type: 'range', min: 200, max: 1500, step: 10 },
      { name: 'ringThickness', label: 'Ring Thickness', type: 'range', min: 5, max: 100, step: 1 },
      { name: 'jaggedness', label: 'Jaggedness', type: 'range', min: 0, max: 1, step: 0.05 },
      { name: 'windupFrac', label: 'Windup Fraction', type: 'range', min: 0, max: 0.3, step: 0.01 },
      { name: 'fadeInFrac', label: 'Fade In Fraction', type: 'range', min: 0, max: 0.3, step: 0.01 },
      { name: 'fadeOutFrac', label: 'Fade Out Fraction', type: 'range', min: 0, max: 0.5, step: 0.01 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  // Builds one jagged radius-multiplier profile per ring for this cycle - sharp alternating
  // near/far spike points around the circle (a real jagged silhouette, not a smooth sine wobble).
  // Cached per cycle so the burst reads as one consistent spiky shape as it expands, rather than
  // flickering noise from frame to frame.
  generateSpikeProfiles() {
    const ringCount = Math.round(this.params.ringCount);
    const jag = this.params.jaggedness;
    this.spikeProfiles = [];
    for (let i = 0; i < ringCount; i++) {
      const spikeCount = 12 + Math.floor(Math.random() * 10); // 12-21 points, varies per ring
      const profile = [];
      for (let s = 0; s < spikeCount; s++) {
        const angle = (s / spikeCount) * Math.PI * 2;
        const isOuter = s % 2 === 0;
        const mult = isOuter
          ? 1.0 + jag * (0.15 + Math.random() * 0.15)
          : 1.0 - jag * (0.35 + Math.random() * 0.25);
        profile.push({ angle, mult: Math.max(0.05, mult) });
      }
      this.spikeProfiles.push(profile);
    }
  }

  // Two-phase radius curve: a brief inward "windup" compression down toward the center, then a
  // snappy ease-out burst back outward - a real explosion coils back before it fires, unlike a
  // plain ripple that only ever expands. Returns a 0..1 fraction of maxRadius.
  computeRadiusFrac(progress) {
    const windupFrac = this.params.windupFrac;
    if (windupFrac > 0 && progress < windupFrac) {
      const wp = progress / windupFrac;
      return 0.22 * (1 - wp) + 0.02 * wp;
    }
    const ep = windupFrac < 1 ? (progress - windupFrac) / (1 - windupFrac) : progress;
    const epClamped = Math.max(0, Math.min(1, ep));
    return 0.02 + 0.98 * (1 - Math.pow(1 - epClamped, 3));
  }

  draw(ctx, width, height, time) {
    const cycleDuration = this.params.cycleDuration;
    const cycleIndex = Math.floor(time / cycleDuration);
    if (cycleIndex !== this.lastCycleIndex) {
      this.lastCycleIndex = cycleIndex;
      this.generateSpikeProfiles();
    }

    const progress = (time % cycleDuration) / cycleDuration;

    let envelope = 1.0;
    if (progress < this.params.fadeInFrac) {
      envelope = progress / this.params.fadeInFrac;
    } else if (progress > 1 - this.params.fadeOutFrac) {
      envelope = (1 - progress) / this.params.fadeOutFrac;
    }
    envelope = Math.max(0, Math.min(1, envelope));
    if (envelope <= 0.001) return; // fully transparent this frame, nothing to draw

    const cx = width / 2;
    const cy = height / 2;
    const parsedColor = parseHexToRgb(this.params.color);
    const ringCount = Math.round(this.params.ringCount);
    const jag = this.params.jaggedness;

    ctx.save();
    for (let i = 0; i < ringCount; i++) {
      const ringProgress = Math.max(0, progress - i * 0.15);
      const radius = this.computeRadiusFrac(ringProgress) * this.params.maxRadius;
      if (radius <= 0) continue;

      const grad = ctx.createRadialGradient(cx, cy, Math.max(0, radius - this.params.ringThickness), cx, cy, radius);
      grad.addColorStop(0, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0)`);
      grad.addColorStop(0.5, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, ${0.8 * envelope})`);
      grad.addColorStop(1, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0)`);
      ctx.fillStyle = grad;

      ctx.beginPath();
      const profile = this.spikeProfiles[i];
      if (jag <= 0.001 || !profile) {
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      } else {
        profile.forEach((p, idx) => {
          const r = radius * p.mult;
          const x = cx + Math.cos(p.angle) * r;
          const y = cy + Math.sin(p.angle) * r;
          if (idx === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();
  }
}

// 21. Glass Crack Generator (transition/cut-in: one-shot impact effect, holeRadius=0 for a
// plain crack or >0 for a bullet-hole-style punch-through - see CLAUDE.md "トランジション/
// カットイン系ジェネレーターの作り方" for the cycleDuration/progress/envelope pattern).
export class GlassCrackGenerator extends BaseGenerator {
  constructor(params) {
    super(params);
    this.lastCycleIndex = -1;
    this.cracks = [];
    this.microCracks = [];
    this.rings = [];
    this.holePoly = null;
    this.holeFlakes = [];
  }

  defaultParams() {
    return {
      cycleDuration: 1200,
      crackCount: 10,
      crackLength: 500,
      complexity: 4,
      displace: 30,
      branchChance: 0.2,
      ringCount: 3,
      holeRadius: 0, // 0 = plain crack, >0 = bullet-hole-style punch-through at center
      growFrac: 0.15,
      fadeOutFrac: 0.35,
      color: '#e0f2fe',
      colorLightness: 85
    };
  }

  getParameterConfig() {
    return [
      { name: 'cycleDuration', label: 'Cycle Duration (ms)', type: 'range', min: 500, max: 4000, step: 100 },
      { name: 'crackCount', label: 'Crack Count', type: 'range', min: 4, max: 24, step: 1 },
      { name: 'crackLength', label: 'Crack Length', type: 'range', min: 100, max: 1200, step: 10 },
      { name: 'complexity', label: 'Detail (Complexity)', type: 'range', min: 2, max: 6, step: 1 },
      { name: 'displace', label: 'Jaggedness', type: 'range', min: 5, max: 80, step: 1 },
      { name: 'branchChance', label: 'Branching Chance', type: 'range', min: 0, max: 0.6, step: 0.05 },
      { name: 'ringCount', label: 'Web Ring Count', type: 'range', min: 0, max: 5, step: 1 },
      { name: 'holeRadius', label: 'Hole Radius (Bullet Hole)', type: 'range', min: 0, max: 150, step: 1 },
      { name: 'growFrac', label: 'Grow Fraction', type: 'range', min: 0.05, max: 0.5, step: 0.01 },
      { name: 'fadeOutFrac', label: 'Fade Out Fraction', type: 'range', min: 0, max: 0.6, step: 0.01 },
      { name: 'colorLightness', label: 'Brightness', type: 'range', min: 0, max: 100, step: 1 },
      { name: 'color', label: 'Color', type: 'color' }
    ];
  }

  // Builds a mostly-straight crack line with a few sharp kinks - real glass fractures follow
  // stress lines and only bend at flaws, unlike the fine all-scale zigzag of a lightning bolt's
  // midpoint-displacement path. At every kink (including the tip) independently rolls forkChance
  // to spin off a shorter branch crack, so a single radial line can end up feeding several smaller
  // cracks along its length rather than just one fork right at the end.
  buildShardLine(x1, y1, angle, length, kinkCount, kinkJitterDeg, forkChance) {
    const segCount = Math.max(1, Math.round(kinkCount) + 1);
    const weights = [];
    let wSum = 0;
    for (let i = 0; i < segCount; i++) {
      const w = 0.7 + Math.random() * 0.6;
      weights.push(w);
      wSum += w;
    }

    const points = [{ x: x1, y: y1 }];
    const branches = [];
    let curX = x1, curY = y1, curAngle = angle;
    for (let i = 0; i < segCount; i++) {
      if (i > 0) curAngle += (Math.random() - 0.5) * 2 * (kinkJitterDeg * Math.PI / 180);
      const segLen = length * (weights[i] / wSum);
      curX += Math.cos(curAngle) * segLen;
      curY += Math.sin(curAngle) * segLen;
      points.push({ x: curX, y: curY });

      if (Math.random() < forkChance) {
        const branchAngle = curAngle + (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 22) * Math.PI / 180;
        const branchLen = segLen * (0.5 + Math.random() * 0.5);
        branches.push([
          { x: curX, y: curY },
          { x: curX + Math.cos(branchAngle) * branchLen, y: curY + Math.sin(branchAngle) * branchLen }
        ]);
      }
    }

    return { points, branches };
  }

  // Builds one fresh randomized crack pattern (radial shard cracks with tip forks, a dense
  // cluster of short "hackle" micro-cracks around the impact point, irregular partially-broken
  // connecting web rings, and an optional star-shaped shattered hole). Called once per cycle,
  // not per frame, so the pattern stays stable for the life of a single playthrough.
  generateCrackGeometry() {
    const crackCount = Math.max(1, Math.round(this.params.crackCount));
    const kinkCount = Math.max(1, Math.round(this.params.complexity));
    const kinkJitterDeg = 10 + this.params.displace * 0.4;
    const holeR = this.params.holeRadius > 0 ? this.params.holeRadius : 0;

    const cracks = [];
    for (let i = 0; i < crackCount; i++) {
      const angle = (i / crackCount) * Math.PI * 2 + (Math.random() - 0.5) * (Math.PI * 2 / crackCount) * 0.6;
      const len = this.params.crackLength * (0.6 + Math.random() * 0.4);
      const startR = holeR > 0 ? holeR * (0.9 + Math.random() * 0.2) : 0;
      const x1 = Math.cos(angle) * startR;
      const y1 = Math.sin(angle) * startR;
      const { points, branches } = this.buildShardLine(x1, y1, angle, len, kinkCount, kinkJitterDeg, this.params.branchChance);
      cracks.push({ main: points, branches });
    }

    // Dense cluster of short micro-cracks around the impact point (hackle marks) - this is
    // what gives a fresh break its "shattered" look right at the point of impact.
    const microCount = Math.max(8, Math.ceil(crackCount * 1.5));
    const microCracks = [];
    for (let i = 0; i < microCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const len = this.params.crackLength * (0.08 + Math.random() * 0.10);
      const startR = holeR > 0 ? holeR * (0.85 + Math.random() * 0.35) : Math.random() * this.params.crackLength * 0.02;
      const x1 = Math.cos(angle) * startR;
      const y1 = Math.sin(angle) * startR;
      const { points } = this.buildShardLine(x1, y1, angle, len, 1 + Math.round(Math.random()), kinkJitterDeg * 1.4, 0);
      microCracks.push(points);
    }

    // Irregular, partially-broken connecting web rings between neighboring radial cracks.
    const ringCount = Math.round(this.params.ringCount);
    const rings = [];
    for (let r = 0; r < ringCount; r++) {
      const baseRadius = (holeR > 0 ? holeR : this.params.crackLength * 0.08) +
        (this.params.crackLength - (holeR > 0 ? holeR : 0)) * ((r + 1) / (ringCount + 1));
      for (let i = 0; i < crackCount; i++) {
        if (Math.random() < 0.2) continue; // leave some segments broken/missing, not a full ring
        const a1 = (i / crackCount) * Math.PI * 2;
        const a2 = ((i + 1) / crackCount) * Math.PI * 2;
        const jr1 = baseRadius * (0.85 + Math.random() * 0.3);
        const jr2 = baseRadius * (0.85 + Math.random() * 0.3);
        const midA = (a1 + a2) / 2 + (Math.random() - 0.5) * 0.15;
        const midR = (jr1 + jr2) / 2 * (0.85 + Math.random() * 0.3);
        rings.push([
          { x: Math.cos(a1) * jr1, y: Math.sin(a1) * jr1 },
          { x: Math.cos(midA) * midR, y: Math.sin(midA) * midR },
          { x: Math.cos(a2) * jr2, y: Math.sin(a2) * jr2 }
        ]);
      }
    }

    // Shattered hole (bullet-hole mode only). Real punch-through holes aren't an
    // independent shape stamped on top of the cracks - the hole boundary IS the set of
    // radial cracks near the impact point: glass tears cleanly along each radial crack
    // (an outward "point" of the hole), while the pane fragment trapped between two
    // neighboring radial cracks has no fracture line to cling to and falls out entirely
    // (an inward "valley"). So the polygon is built directly from the roots of `cracks`
    // rather than from an independent random n-gon.
    let holePoly = null;
    let holeFlakes = [];
    if (holeR > 0) {
      holePoly = [];
      for (let i = 0; i < crackCount; i++) {
        const outerPt = cracks[i].main[0];
        holePoly.push({ x: outerPt.x, y: outerPt.y });

        const nextPt = cracks[(i + 1) % crackCount].main[0];
        const angleA = Math.atan2(outerPt.y, outerPt.x);
        const angleB = Math.atan2(nextPt.y, nextPt.x);
        let da = angleB - angleA;
        while (da <= -Math.PI) da += Math.PI * 2;
        while (da > Math.PI) da -= Math.PI * 2;
        const valleyAngle = angleA + da / 2 + (Math.random() - 0.5) * 0.08;
        const valleyR = holeR * (0.3 + Math.random() * 0.25);
        holePoly.push({ x: Math.cos(valleyAngle) * valleyR, y: Math.sin(valleyAngle) * valleyR });
      }

      // Rim flakes cling to the actual fracture lines (the "point" vertices), not to the
      // smooth crushed-out valleys, so only even indices (crack roots) are eligible bases.
      const flakeCount = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < flakeCount; i++) {
        const base = holePoly[Math.floor(Math.random() * crackCount) * 2];
        const ang = Math.atan2(base.y, base.x);
        const flakeLen = holeR * (0.2 + Math.random() * 0.3);
        const spread = 0.2 + Math.random() * 0.15;
        holeFlakes.push([
          { x: base.x, y: base.y },
          { x: base.x + Math.cos(ang - spread) * flakeLen, y: base.y + Math.sin(ang - spread) * flakeLen },
          { x: base.x + Math.cos(ang + spread) * flakeLen, y: base.y + Math.sin(ang + spread) * flakeLen }
        ]);
      }
    }

    this.cracks = cracks;
    this.microCracks = microCracks;
    this.rings = rings;
    this.holePoly = holePoly;
    this.holeFlakes = holeFlakes;
  }

  // Fills a series of per-segment quads (all in a single fill call) whose half-width is
  // linearly interpolated between widthStart and widthEnd - the cheapest way to get a
  // tapering line out of Canvas 2D, which has no native variable-width stroke.
  fillTaperedLine(ctx, points, widthStart, widthEnd, revealFrac, fillStyle) {
    if (!points || points.length < 2 || revealFrac <= 0) return;
    const total = points.length - 1;
    const revealCount = Math.max(1, Math.floor(total * revealFrac));

    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    for (let i = 0; i < revealCount; i++) {
      const p1 = points[i], p2 = points[i + 1];
      const w1 = widthStart + (widthEnd - widthStart) * (i / total);
      const w2 = widthStart + (widthEnd - widthStart) * ((i + 1) / total);
      const dx = p2.x - p1.x, dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const h1 = w1 / 2, h2 = w2 / 2;
      ctx.moveTo(p1.x + nx * h1, p1.y + ny * h1);
      ctx.lineTo(p2.x + nx * h2, p2.y + ny * h2);
      ctx.lineTo(p2.x - nx * h2, p2.y - ny * h2);
      ctx.lineTo(p1.x - nx * h1, p1.y - ny * h1);
      ctx.closePath();
    }
    ctx.fill();
  }

  // Draws one crack segment as a dark tapered "shadow" fill plus a slimmer, brighter tapered
  // "highlight" fill down its center - approximates the beveled look of light catching the
  // fracture's cut edge without needing a real offset light source.
  drawCrackLine(ctx, points, revealFrac, hueSat, lightness, baseWidth) {
    this.fillTaperedLine(ctx, points, baseWidth, baseWidth * 0.12, revealFrac, 'rgba(8, 8, 12, 0.55)');
    this.fillTaperedLine(ctx, points, baseWidth * 0.4, baseWidth * 0.05, revealFrac, `hsla(${hueSat.h}, ${hueSat.s}%, ${lightness}%, 0.85)`);
  }

  draw(ctx, width, height, time) {
    const cycleDuration = this.params.cycleDuration;
    const cycleIndex = Math.floor(time / cycleDuration);
    if (cycleIndex !== this.lastCycleIndex) {
      this.lastCycleIndex = cycleIndex;
      this.generateCrackGeometry();
    }

    const progress = (time % cycleDuration) / cycleDuration;

    let envelope = 1.0;
    if (progress > 1 - this.params.fadeOutFrac) {
      envelope = (1 - progress) / this.params.fadeOutFrac;
    }
    envelope = Math.max(0, Math.min(1, envelope));
    if (envelope <= 0.001) return;

    const growProgress = Math.min(1, progress / this.params.growFrac);
    const microRampFrac = Math.max(0.01, this.params.growFrac * 0.15);
    const microProgress = Math.min(1, progress / microRampFrac);
    const ringGrowProgress = Math.max(0, Math.min(1, (progress - this.params.growFrac * 0.3) / this.params.growFrac));

    const cx = width / 2;
    const cy = height / 2;
    const hueSat = hexToHsl(this.params.color);
    const lightness = this.params.colorLightness;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = envelope;

    if (this.holePoly && microProgress > 0) {
      ctx.globalAlpha = envelope * microProgress;

      const R = this.params.holeRadius;
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 1.2);
      grad.addColorStop(0, 'rgba(8, 8, 12, 0.95)');
      grad.addColorStop(0.7, 'rgba(15, 15, 20, 0.85)');
      grad.addColorStop(1, 'rgba(20, 20, 25, 0.4)');
      ctx.beginPath();
      this.holePoly.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.fillStyle = 'rgba(8, 8, 12, 0.85)';
      for (const flake of this.holeFlakes) {
        ctx.beginPath();
        flake.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
        ctx.closePath();
        ctx.fill();
      }

      ctx.globalAlpha = envelope;
    }

    if (microProgress > 0) {
      for (const mc of this.microCracks) {
        this.drawCrackLine(ctx, mc, microProgress, hueSat, lightness, 1.8);
      }
    }

    for (const crack of this.cracks) {
      this.drawCrackLine(ctx, crack.main, growProgress, hueSat, lightness, 4.5);
      for (const branch of crack.branches) {
        this.drawCrackLine(ctx, branch, growProgress, hueSat, lightness, 2.4);
      }
    }

    if (ringGrowProgress > 0) {
      for (const ring of this.rings) {
        this.drawCrackLine(ctx, ring, ringGrowProgress, hueSat, lightness, 1.6);
      }
    }

    ctx.restore();
  }
}
