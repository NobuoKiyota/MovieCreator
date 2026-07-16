import { 
  SineWaveGenerator, 
  NoiseWaveGenerator, 
  ParticlesGenerator, 
  GeometryGenerator, 
  GrowingSketchGenerator,
  RainGenerator,
  MeteorGenerator,
  RippleGenerator,
  SpectrumGenerator,
  Cube3DGenerator,
  LightningGenerator,
  FogGenerator,
  FlameGenerator,
  SnowflakeGenerator,
  SpirographGenerator,
  AuroraGenerator,
  DryIceGenerator,
  Shape3DParticlesGenerator
} from './Generators.js';

import { 
  applyGlow, 
  FeedbackTrail, 
  applyDistortion,
  applyVignette,
  applyFilmGrain,
  applyKaleidoscope,
  applyChromaticAberration
} from './Effects.js';

export class Layer {
  constructor(id, type, width, height) {
    this.id = id;
    this.type = type;
    this.name = this.getDefaultName(type);
    this.visible = true;
    this.opacity = 1.0;
    this.blendMode = 'lighter'; // Default to additive blending for neon wow-effect
    
    // Create dedicated offscreen canvas for isolated layer drawing
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    // Create raw canvas to separate generator & feedback from glowing post-effects
    this.rawCanvas = document.createElement('canvas');
    this.rawCanvas.width = width;
    this.rawCanvas.height = height;
    this.rawCtx = this.rawCanvas.getContext('2d');
    
    // Instantiate appropriate generator
    this.generator = this.createGenerator(type);
    
    // Setup dedicated effect handlers
    this.feedbackHandler = new FeedbackTrail();
    
    // Default effect settings (including Rotation, Scale, Strobe)
    this.effects = {
      // Transforms
      rotation: 0,       // degrees (-360 to 360)
      scale: 1.0,        // 0.1 to 5.0
      strobe: 0,         // Speed / Frequency (0 to 30 Hz)
      
      // Glow
      glowIntensity: 0,  // 0 to 50
      glowMix: 0.5,
      // Feedback trails
      feedbackDecay: 0.0, // 0.0 (off) to 0.99
      feedbackScale: 1.002,
      feedbackRotate: 0.005,
      // Distortion
      distortionIntensity: 0, // 0 to 30
      distortionFrequency: 0.02,
      distortionSpeed: 3,
      kaleidoscopeSegment: 0,
      chromaticOffset: 0
    };

    // Keep track of opacity multiplied by strobe
    this.currentRenderOpacity = 1.0;

    // State preservation for randomizer Spread value
    this.randomSpread = 50;

    // Modulation (LFO-like Parameter Automation)
    this.modulations = {};
    this.initModulations();

    // Apply aesthetic default dynamic motion presets for instant "WOW" on Add Layer
    this.currentPresetName = this.getDefaultPresetName(type);
    this.applyPreset(this.currentPresetName);
  }

  getDefaultName(type) {
    switch (type) {
      case 'sine-wave': return 'Sine Wave Layer';
      case 'noise-wave': return 'Neon Horizon (Noise)';
      case 'particles': return 'Magic Sparks (Fireflies)';
      case 'geometry': return 'Lissajous Orbit';
      case 'growing-sketch': return 'Sketch Growth';
      case 'rain': return 'Neon Rain';
      case 'meteor': return 'Meteor Shower';
      case 'ripple': return 'Pulse Ripples';
      case 'spectrum': return 'Audio Spectrum';
      case 'cube-3d': return 'Rotating Glowing Cube';
      case 'lightning': return 'Neon Lightning';
      case 'fog': return 'Neon Fog';
      case 'flame': return 'Cyber Flame';
      case 'snowflake': return 'Neon Snowflake';
      case 'spirograph': return 'Neon Spirograph';
      case 'aurora': return 'Aurora Curtain';
      case 'dry-ice': return 'Dry Ice Smoke';
      case 'shape-3d-particles': return '3D Shape Particles';
      default: return 'Custom Layer';
    }
  }

  createGenerator(type) {
    switch (type) {
      case 'sine-wave': return new SineWaveGenerator();
      case 'noise-wave': return new NoiseWaveGenerator();
      case 'particles': return new ParticlesGenerator();
      case 'geometry': return new GeometryGenerator();
      case 'growing-sketch': return new GrowingSketchGenerator();
      case 'rain': return new RainGenerator();
      case 'meteor': return new MeteorGenerator();
      case 'ripple': return new RippleGenerator();
      case 'spectrum': return new SpectrumGenerator();
      case 'cube-3d': return new Cube3DGenerator();
      case 'lightning': return new LightningGenerator();
      case 'fog': return new FogGenerator();
      case 'flame': return new FlameGenerator();
      case 'snowflake': return new SnowflakeGenerator();
      case 'spirograph': return new SpirographGenerator();
      case 'aurora': return new AuroraGenerator();
      case 'dry-ice': return new DryIceGenerator();
      case 'shape-3d-particles': return new Shape3DParticlesGenerator();
      default: throw new Error(`Unknown generator type: ${type}`);
    }
  }

  initModulations() {
    // 1. Initialize modulations for Generator dynamic ranges
    const configs = this.generator.getParameterConfig();
    configs.forEach(config => {
      if (config.type === 'range') {
        this.modulations[config.name] = {
          enabled: false,
          min: config.min,
          max: config.max,
          timePct: 50, // 50% of the total duration by default
          behavior: 'return', // 'repeat' (saw), 'return' (ping-pong), 'one' (ramp & hold)
          keyframeEnabled: false,
          keyframes: []
        };
      }
    });

    // 2. Initialize modulations for FX parameters (Rotation, Scale, Strobe, Glow)
    const fxConfigs = [
      { name: 'rotation',            min: -360,  max: 360  },
      { name: 'scale',               min: 0.1,   max: 5.0  },
      { name: 'strobe',              min: 0,     max: 30   },
      { name: 'glowIntensity',       min: 0,     max: 50   },
      { name: 'feedbackDecay',       min: 0.0,   max: 0.95, timePct: 50, behavior: 'return' },
      { name: 'feedbackRotate',      min: -0.05, max: 0.05, timePct: 50, behavior: 'return' },
      { name: 'distortionIntensity', min: 0,     max: 40,   timePct: 50, behavior: 'return' },
      { name: 'kaleidoscopeSegment', min: 0,     max: 12,   timePct: 50, behavior: 'return' },
      { name: 'chromaticOffset',     min: 0,     max: 30,   timePct: 50, behavior: 'return' }
    ];
    fxConfigs.forEach(config => {
      this.modulations[config.name] = {
        enabled: false,
        min: config.min,
        max: config.max,
        timePct: config.timePct !== undefined ? config.timePct : 50,
        behavior: config.behavior !== undefined ? config.behavior : 'return',
        keyframeEnabled: false,
        keyframes: []
      };
    });
  }

  getDefaultPresetName(type) {
    switch (type) {
      case 'sine-wave':
      case 'noise-wave':
      case 'rain':
      case 'meteor':
      case 'ripple':
      case 'spectrum':
      case 'fog':
        return 'slow-evolution';
      case 'particles':
      case 'cube-3d':
        return 'pulsing-heart';
      case 'geometry':
        return 'cosmic-spin';
      case 'growing-sketch':
        return 'growing-spiral';
      case 'lightning':
        return 'hyper-strobe';
      default:
        return 'static-none';
    }
  }

  /**
   * Applies a complete motion preset mapping LFO bounds and options
   */
  applyPreset(presetName) {
    // Reset all modulations
    for (let key in this.modulations) {
      this.modulations[key].enabled = false;
    }
    // Revert FX defaults
    this.effects.rotation = 0;
    this.effects.scale = 1.0;
    this.effects.strobe = 0;
    this.effects.glowIntensity = 15;

    this.currentPresetName = presetName;

    switch (presetName) {
      case 'slow-evolution':
        if (this.modulations.frequency) {
          this.modulations.frequency.enabled = true;
          this.modulations.frequency.min = 0.002;
          this.modulations.frequency.max = 0.015;
          this.modulations.frequency.timePct = 35;
          this.modulations.frequency.behavior = 'return';
        }
        if (this.modulations.amplitude) {
          this.modulations.amplitude.enabled = true;
          this.modulations.amplitude.min = 60;
          this.modulations.amplitude.max = 220;
          this.modulations.amplitude.timePct = 40;
          this.modulations.amplitude.behavior = 'return';
        }
        break;

      case 'pulsing-heart':
        this.modulations.scale.enabled = true;
        this.modulations.scale.min = 0.8;
        this.modulations.scale.max = 1.4;
        this.modulations.scale.timePct = 25;
        this.modulations.scale.behavior = 'return';

        this.modulations.glowIntensity.enabled = true;
        this.modulations.glowIntensity.min = 5;
        this.modulations.glowIntensity.max = 35;
        this.modulations.glowIntensity.timePct = 25;
        this.modulations.glowIntensity.behavior = 'return';
        break;

      case 'cosmic-spin':
        this.modulations.rotation.enabled = true;
        this.modulations.rotation.min = -90;
        this.modulations.rotation.max = 90;
        this.modulations.rotation.timePct = 55;
        this.modulations.rotation.behavior = 'return';

        this.modulations.scale.enabled = true;
        this.modulations.scale.min = 0.8;
        this.modulations.scale.max = 1.3;
        this.modulations.scale.timePct = 30;
        this.modulations.scale.behavior = 'return';
        break;

      case 'hyper-strobe':
        this.modulations.strobe.enabled = true;
        this.modulations.strobe.min = 0.0;
        this.modulations.strobe.max = 10.0;
        this.modulations.strobe.timePct = 30;
        this.modulations.strobe.behavior = 'return';

        this.modulations.glowIntensity.enabled = true;
        this.modulations.glowIntensity.min = 15;
        this.modulations.glowIntensity.max = 45;
        this.modulations.glowIntensity.timePct = 15;
        this.modulations.glowIntensity.behavior = 'return';
        break;

      case 'growing-spiral':
        this.effects.scale = 0.1;
        this.modulations.scale.enabled = true;
        this.modulations.scale.min = 0.1;
        this.modulations.scale.max = 1.8;
        this.modulations.scale.timePct = 70;
        this.modulations.scale.behavior = 'one';

        this.modulations.rotation.enabled = true;
        this.modulations.rotation.min = 0;
        this.modulations.rotation.max = 270;
        this.modulations.rotation.timePct = 70;
        this.modulations.rotation.behavior = 'one';
        break;

      case 'glitch-chaos':
        this.effects.distortionIntensity = 20;
        this.modulations.strobe.enabled = true;
        this.modulations.strobe.min = 1.0;
        this.modulations.strobe.max = 25.0;
        this.modulations.strobe.timePct = 15;
        this.modulations.strobe.behavior = 'repeat';

        this.modulations.scale.enabled = true;
        this.modulations.scale.min = 0.6;
        this.modulations.scale.max = 1.6;
        this.modulations.scale.timePct = 10;
        this.modulations.scale.behavior = 'repeat';
        break;

      case 'static-none':
      default:
        break;
    }
  }

  /**
   * Evaluates automation state for each active dynamic parameter.
   * @param {number} time - Current simulation time in milliseconds.
   * @param {number} duration - Total duration of the workspace session / export in seconds.
   */
  applyModulations(time, duration) {
    if (!this.visible) return;

    const tSec = time / 1000;
    const currentFrame = tSec * 60; // Calculate current frame based on 60fps

    for (let key in this.modulations) {
      const mod = this.modulations[key];
      if (!mod.keyframes) {
        mod.keyframes = [];
      }
      let val;

      if (mod.keyframeEnabled) {
        if (!mod.keyframes || mod.keyframes.length === 0) {
          // If no keyframes, use minimum modulation bound as initial fallback
          val = mod.min;
        } else if (mod.keyframes.length === 1) {
          val = mod.keyframes[0].value;
        } else {
          // Linear interpolation between the two nearest keyframes surrounding currentFrame
          const kfs = mod.keyframes;
          if (currentFrame <= kfs[0].frame) {
            val = kfs[0].value;
          } else if (currentFrame >= kfs[kfs.length - 1].frame) {
            val = kfs[kfs.length - 1].value;
          } else {
            // Find surrounding points
            let idx = 0;
            for (let i = 0; i < kfs.length - 1; i++) {
              if (currentFrame >= kfs[i].frame && currentFrame <= kfs[i + 1].frame) {
                idx = i;
                break;
              }
            }
            const kfA = kfs[idx];
            const kfB = kfs[idx + 1];
            const frameDiff = kfB.frame - kfA.frame;
            if (frameDiff <= 0) {
              val = kfB.value;
            } else {
              const t = (currentFrame - kfA.frame) / frameDiff;
              const easing = kfA.easing || 'linear';
              let tPrime = t;
              if (easing === 'step') {
                tPrime = t < 1.0 ? 0.0 : 1.0;
              } else if (easing === 'ease-in') {
                tPrime = t * t;
              } else if (easing === 'ease-out') {
                tPrime = t * (2.0 - t);
              } else if (easing === 'ease-in-out') {
                tPrime = t < 0.5 ? 2.0 * t * t : -1.0 + (4.0 - 2.0 * t) * t;
              }
              val = kfA.value + (kfB.value - kfA.value) * tPrime;
            }
          }
        }
      } else {
        if (!mod.enabled) continue;

        const cycleDuration = duration * (mod.timePct / 100);
        if (cycleDuration <= 0) continue;

        let factor = 0.0;

        if (mod.behavior === 'one') {
          factor = Math.min(1.0, tSec / cycleDuration);
        } else if (mod.behavior === 'repeat') {
          factor = (tSec % cycleDuration) / cycleDuration;
        } else if (mod.behavior === 'return') {
          const phase = (tSec % (cycleDuration * 2)) / cycleDuration;
          factor = phase <= 1.0 ? phase : 2.0 - phase;
        }

        // Linear interpolation between custom min and max bounds
        val = mod.min + (mod.max - mod.min) * factor;
      }

      // Assign calculated value into the appropriate parameter slot
      if (key in this.generator.params) {
        this.generator.params[key] = val;
      } else if (key in this.effects) {
        this.effects[key] = val;
      }
    }
  }

  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.rawCanvas.width = width;
      this.rawCanvas.height = height;
      this.feedbackHandler.resize(width, height);
    }
  }

  update(time, frameCount, width, height) {
    if (!this.visible) return;
    this.generator.update(time, frameCount, width, height);
  }

  draw(time, frameCount) {
    if (!this.visible) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // 1. Process feedback on the RAW canvas to avoid feedback looping glow/distortion!
    if (this.effects.feedbackDecay <= 0.0) {
      this.rawCtx.clearRect(0, 0, w, h);
      this.generator.draw(this.rawCtx, w, h, time);
    } else {
      // Process feedback trail on raw canvas
      this.feedbackHandler.process(this.rawCtx, this.rawCanvas, {
        decay: this.effects.feedbackDecay,
        scale: this.effects.feedbackScale,
        rotate: this.effects.feedbackRotate
      });
      // Draw fresh generator frames on top of raw faded history trail
      this.generator.draw(this.rawCtx, w, h, time);
    }

    // 2. Clear output canvas and copy raw canvas contents with Scale & Rotation transforms applied
    this.ctx.clearRect(0, 0, w, h);
    this.ctx.save();
    
    // Apply layout transformations centered on canvas
    this.ctx.translate(w / 2, h / 2);
    if (this.effects.rotation !== 0) {
      this.ctx.rotate(this.effects.rotation * Math.PI / 180);
    }
    if (this.effects.scale !== 1.0) {
      this.ctx.scale(this.effects.scale, this.effects.scale);
    }
    this.ctx.translate(-w / 2, -h / 2);
    
    this.ctx.drawImage(this.rawCanvas, 0, 0);
    this.ctx.restore();

    // 3. Apply post-process effects on the output canvas ONLY
    // Apply Distortion
    if (this.effects.distortionIntensity > 0) {
      applyDistortion(this.ctx, this.canvas, time, {
        intensity: this.effects.distortionIntensity,
        frequency: this.effects.distortionFrequency,
        speed: this.effects.distortionSpeed
      });
    }

    // Apply Glow
    if (this.effects.glowIntensity > 0) {
      applyGlow(this.ctx, this.canvas, this.effects.glowIntensity, this.effects.glowMix);
    }

    // Apply Kaleidoscope
    if (this.effects.kaleidoscopeSegment >= 3) {
      applyKaleidoscope(this.ctx, this.canvas, this.effects.kaleidoscopeSegment);
    }

    // Apply Chromatic Aberration
    if (this.effects.chromaticOffset > 0) {
      applyChromaticAberration(this.ctx, this.canvas, this.effects.chromaticOffset);
    }

    // 4. Calculate strobe opacity
    let currentOpacity = this.opacity;
    if (this.effects.strobe > 0) {
      const strobeTimeSec = time / 1000;
      // Strobe square wave: alternates between full alpha and 0
      const strobeVal = Math.sin(strobeTimeSec * Math.PI * 2 * this.effects.strobe);
      currentOpacity *= strobeVal > 0 ? 1.0 : 0.0;
    }
    this.currentRenderOpacity = currentOpacity;
  }
}

export class LayerManager {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.layers = [];
    this.nextId = 1;
    this.masterVignette = 0.3;
    this.masterFilmGrain = 0.03;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    for (let layer of this.layers) {
      layer.resize(width, height);
    }
  }

  addLayer(type) {
    const layer = new Layer(this.nextId++, type, this.width, this.height);
    this.layers.push(layer);
    return layer;
  }

  removeLayer(id) {
    const index = this.layers.findIndex(l => l.id === id);
    if (index !== -1) {
      this.layers.splice(index, 1);
      return true;
    }
    return false;
  }

  reorderLayers(oldIndex, newIndex) {
    if (newIndex >= this.layers.length) {
      let k = newIndex - this.layers.length + 1;
      while (k--) {
        this.layers.push(undefined);
      }
    }
    this.layers.splice(newIndex, 0, this.layers.splice(oldIndex, 1)[0]);
  }

  /**
   * Applies modulation updates to all active layers
   * @param {number} time - Simulated time in ms
   * @param {number} duration - Maximum DURATION in seconds
   */
  applyModulations(time, duration) {
    for (let layer of this.layers) {
      layer.applyModulations(time, duration);
    }
  }

  update(time, frameCount) {
    for (let layer of this.layers) {
      layer.update(time, frameCount, this.width, this.height);
    }
  }

  draw(masterCtx, time, frameCount, backgroundMode, fadeFactor = 1.0) {
    // 1. Draw Background
    masterCtx.save();
    if (backgroundMode === 'transparent') {
      masterCtx.clearRect(0, 0, this.width, this.height);
    } else {
      switch (backgroundMode) {
        case 'black':
          masterCtx.fillStyle = '#000000';
          break;
        case 'white':
          masterCtx.fillStyle = '#ffffff';
          break;
        case 'green':
          masterCtx.fillStyle = '#00ff00'; // Pure chroma green
          break;
        default:
          masterCtx.fillStyle = '#000000';
      }
      masterCtx.fillRect(0, 0, this.width, this.height);
    }
    masterCtx.restore();

    // 2. Draw and composite each visible layer
    for (let layer of this.layers) {
      if (!layer.visible) continue;
      
      // Update and filter offscreen Canvas
      layer.draw(time, frameCount);

      // Composite onto Master using the strobe-integrated render opacity
      masterCtx.save();
      masterCtx.globalAlpha = layer.currentRenderOpacity * fadeFactor;
      masterCtx.globalCompositeOperation = layer.blendMode;
      masterCtx.drawImage(layer.canvas, 0, 0);
      masterCtx.restore();
    }

    // 3. Apply Master Post-effects (except on transparent background to preserve alpha transparency)
    if (backgroundMode !== 'transparent') {
      if (this.masterVignette > 0) {
        applyVignette(masterCtx, this.width, this.height, this.masterVignette);
      }
      if (this.masterFilmGrain > 0) {
        applyFilmGrain(masterCtx, this.width, this.height, this.masterFilmGrain);
      }
    }

    // 4. Apply Master Fade factor (Fade out / In control)
    if (fadeFactor < 1.0) {
      masterCtx.save();
      // Apply black fade or transparency fade depending on export bg
      if (backgroundMode === 'transparent') {
        // Transparency fade: Multiply pixel alpha
        const imgData = masterCtx.getImageData(0, 0, this.width, this.height);
        const data = imgData.data;
        for (let i = 3; i < data.length; i += 4) {
          data[i] = data[i] * fadeFactor;
        }
        masterCtx.putImageData(imgData, 0, 0);
      } else {
        // Black/White fade: overlay color with opacity
        masterCtx.globalAlpha = 1.0 - fadeFactor;
        masterCtx.fillStyle = backgroundMode === 'white' ? '#ffffff' : '#000000';
        masterCtx.fillRect(0, 0, this.width, this.height);
      }
      masterCtx.restore();
    }
  }
}
