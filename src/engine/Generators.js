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
 * Converts Hex to HSL, replaces the L (Lightness) component, and returns an HSL string.
 * This enables modulating the brightness of a color dynamically via LFO!
 */
function adjustColorLightness(hex, lightness) {
  // Safe hex check
  if (!hex || hex.charAt(0) !== '#') return hex;
  
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

  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(lightness); // override lightness (0-100)

  return `hsl(${h}, ${s}%, ${l}%)`;
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

  // Generates recursive segments of lightning main path, collects branches in branchesList
  generateLightningBranch(x1, y1, x2, y2, displace, depth, branchesList = []) {
    if (depth <= 0) {
      return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
    }

    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);

    // Compute normal vector to offset perpendicular to path
    const nx = -dy / len;
    const ny = dx / len;

    const offset = (Math.random() - 0.5) * displace;
    const cx = midX + nx * offset;
    const cy = midY + ny * offset;

    const left = this.generateLightningBranch(x1, y1, cx, cy, displace / 2, depth - 1, branchesList);
    const right = this.generateLightningBranch(cx, cy, x2, y2, displace / 2, depth - 1, branchesList);

    const segments = left.slice(0, -1).concat(right);

    // Generate secondary branch with probability, pushing it to branchesList
    if (Math.random() < this.params.branchChance && depth > 2) {
      const bx = cx + (Math.random() - 0.5) * displace * 2;
      const by = cy + (Math.random() * 0.4 + 0.6) * (y2 - cy); // Grow downwards
      const branchSegments = this.generateLightningBranch(cx, cy, bx, by, displace / 2.5, depth - 2, branchesList);
      branchesList.push(branchSegments);
    }

    return segments;
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
      angleSpeed: (Math.random() - 0.5) * 0.002
    };
  }

  update(time, frameCount, width, height) {
    // 1. Maintain correct density
    const targetDensity = Math.round(this.params.density);
    
    // Adjust puff count
    while (this.fogPuffs.length < targetDensity) {
      this.fogPuffs.push(this.createFogPuff(width, height, this.fogPuffs.length === 0));
    }
    if (this.fogPuffs.length > targetDensity) {
      this.fogPuffs.length = targetDensity;
    }

    // 2. Update each active fog puff
    const fadeSpeed = this.params.fadeSpeed;
    const speedMultiplier = this.params.speed;

    for (let i = 0; i < this.fogPuffs.length; i++) {
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
      shapeType: 0, // 0=Soft Circle(ぼかし円), 1=Circle(くっきり円), 2=Square, 3=Hexagon, 4=Star
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
      { name: 'shapeType', label: 'Shape Type (0-4)', type: 'range', min: 0, max: 4, step: 1 },
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
    const themeColor = adjustColorLightness(this.params.color, this.params.colorLightness);
    const parsedColor = parseHexToRgb(this.params.color);

    for (let p of this.particles) {
      const size = this.params.strokeWidth * p.life;
      const alpha = p.life * 0.8;
      if (size <= 0.1) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angleZ);
      ctx.scale(Math.cos(p.angleY), Math.sin(p.angleX));

      ctx.globalAlpha = alpha;

      const type = Math.round(this.params.shapeType);
      ctx.beginPath();
      if (type === 0) {
        // Soft Circle (ぼかし円)
        const grad = ctx.createRadialGradient(0, 0, size * 0.1, 0, 0, size);
        grad.addColorStop(0, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 1)`);
        grad.addColorStop(0.3, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0.5)`);
        grad.addColorStop(1, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0)`);
        ctx.fillStyle = grad;
        ctx.arc(0, 0, size, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 1) {
        // Circle (くっきり円)
        ctx.fillStyle = themeColor;
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 2) {
        // Square
        ctx.fillStyle = themeColor;
        ctx.rect(-size / 2, -size / 2, size, size);
        ctx.fill();
      } else if (type === 3) {
        // Hexagon
        ctx.fillStyle = themeColor;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * (size / 2);
          const y = Math.sin(angle) * (size / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      } else if (type === 4) {
        // Star
        ctx.fillStyle = themeColor;
        const outerR = size / 2;
        const innerR = size / 4;
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
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
      rz: (Math.random() - 0.5) * 0.03
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

      ctx.globalAlpha = p.alpha;

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
    
    const phase = time * 0.001 * this.params.speed;
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
      shapeType: 0, // 0=Soft Circle(ぼかし円), 1=Circle(くっきり円), 2=Square, 3=Hexagon, 4=Star
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
      { name: 'shapeType', label: 'Shape Type (0-4)', type: 'range', min: 0, max: 4, step: 1 },
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

      const type = Math.round(this.params.shapeType);
      ctx.beginPath();
      if (type === 0) {
        // Soft Circle (ぼかし円)
        const grad = ctx.createRadialGradient(0, 0, currentSize * 0.1, 0, 0, currentSize);
        grad.addColorStop(0, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 1)`);
        grad.addColorStop(0.3, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0.5)`);
        grad.addColorStop(1, `rgba(${parsedColor.r}, ${parsedColor.g}, ${parsedColor.b}, 0)`);
        ctx.fillStyle = grad;
        ctx.arc(0, 0, currentSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 1) {
        // Circle (くっきり円)
        ctx.fillStyle = themeColor;
        ctx.arc(0, 0, currentSize / 2, 0, Math.PI * 2);
        ctx.fill();
      } else if (type === 2) {
        // Square
        ctx.fillStyle = themeColor;
        ctx.rect(-currentSize / 2, -currentSize / 2, currentSize, currentSize);
        ctx.fill();
      } else if (type === 3) {
        // Hexagon
        ctx.fillStyle = themeColor;
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * (currentSize / 2);
          const y = Math.sin(angle) * (currentSize / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      } else if (type === 4) {
        // Star
        ctx.fillStyle = themeColor;
        const outerR = currentSize / 2;
        const innerR = currentSize / 4;
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
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
      shapeType: 0, // 0=Circle, 1=Square, 2=Hexagon, 3=Star
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
      { name: 'shapeType', label: 'Shape (0-3)', type: 'range', min: 0, max: 3, step: 1 },
      { name: 'speed', label: 'Max Speed', type: 'range', min: 0.5, max: 10.0, step: 0.1 },
      { name: 'rotSpeedX', label: 'Rot Speed X', type: 'range', min: 0.0, max: 0.1, step: 0.005 },
      { name: 'rotSpeedY', label: 'Rot Speed Y', type: 'range', min: 0.0, max: 0.1, step: 0.005 },
      { name: 'rotSpeedZ', label: 'Rot Speed Z', type: 'range', min: 0.0, max: 0.2, step: 0.005 },
      { name: 'minSize', label: 'Min Size', type: 'range', min: 2, max: 10, step: 0.5 },
      { name: 'maxSize', label: 'Max Size', type: 'range', min: 5, max: 40, step: 0.5 },
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
      // 3D Angles
      angleX: Math.random() * Math.PI * 2,
      angleY: Math.random() * Math.PI * 2,
      angleZ: Math.random() * Math.PI * 2,
      // Custom variations for rotation speeds
      rx: (Math.random() - 0.5) * this.params.rotSpeedX,
      ry: (Math.random() - 0.5) * this.params.rotSpeedY,
      rz: (Math.random() - 0.5) * this.params.rotSpeedZ
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

    for (let p of this.particles) {
      ctx.save();
      ctx.translate(p.x, p.y);
      
      // Rotate on Z, scale on X/Y to emulate 3D rotation (2.5D)
      ctx.rotate(p.angleZ);
      ctx.scale(Math.cos(p.angleY), Math.sin(p.angleX));

      ctx.fillStyle = themeColor;
      ctx.globalAlpha = p.alpha;

      const type = Math.round(this.params.shapeType);
      const size = p.size;

      ctx.beginPath();
      if (type === 0) {
        // Circle
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
      } else if (type === 1) {
        // Square
        ctx.rect(-size / 2, -size / 2, size, size);
      } else if (type === 2) {
        // Hexagon
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const x = Math.cos(angle) * (size / 2);
          const y = Math.sin(angle) * (size / 2);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      } else if (type === 3) {
        // Star (5-pointed)
        const outerR = size / 2;
        const innerR = size / 4;
        for (let i = 0; i < 10; i++) {
          const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? outerR : innerR;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
}
