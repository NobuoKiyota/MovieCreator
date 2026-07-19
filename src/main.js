import { LayerManager } from './engine/LayerManager.js';
import { VideoRecorder } from './engine/VideoRecorder.js';
import { Controls } from './ui/Controls.js';

class MovieCreatorApp {
  constructor() {
    this.canvas = document.getElementById('preview-canvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Virtual resolution is fixed to 1280x720 (HD 16:9)
    // CSS handles scale-to-fit responsiveness
    this.width = 1280;
    this.height = 720;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    // Core Managers
    this.layerManager = new LayerManager(this.width, this.height);
    this.recorder = new VideoRecorder(this.canvas, this.layerManager);
    this.controls = new Controls(this.layerManager, this);

    // Playback States
    this.isPlaying = true;
    this.frameCount = 0;
    this.startTime = performance.now();
    this.lastTime = 0;
    this.accumulatedTime = 0; // Pausing keeps time relative

    // Overlay Elements
    this.recordingOverlayEl = document.getElementById('recording-overlay');
    this.recordingStatusEl = document.getElementById('recording-status');
    this.recordingProgressEl = document.getElementById('recording-progress');

    // Timecode overlay
    this.showTimecode = false;
    this.btnTimecodeToggleEl = document.getElementById('btn-timecode-toggle');
  }

  init() {
    // 1. Setup default gorgeous template layers so the user is wowed immediately!
    const waveLayer = this.layerManager.addLayer('noise-wave');
    waveLayer.name = 'Neon Horizon (Noise Wave)';
    waveLayer.generator.params.amplitude = 120;
    waveLayer.generator.params.frequency = 0.004;
    waveLayer.generator.params.speed = 1.2;
    waveLayer.generator.params.color = '#06b6d4'; // Cyan
    waveLayer.effects.glowIntensity = 20;
    waveLayer.effects.feedbackDecay = 0.85; // Heavy neon tail!
    waveLayer.effects.feedbackScale = 1.001;
    waveLayer.effects.feedbackRotate = 0.002;

    const fireflyLayer = this.layerManager.addLayer('particles');
    fireflyLayer.name = 'Magic Sparks (Fireflies)';
    fireflyLayer.generator.params.count = 60;
    fireflyLayer.generator.params.color = '#eab308'; // Gold
    fireflyLayer.generator.params.glow = 15;
    fireflyLayer.effects.glowIntensity = 10;
    fireflyLayer.effects.feedbackDecay = 0.9; // Smooth glowing trails

    // Setup a default LFO on Wave Frequency to demonstrate modulations immediately
    waveLayer.modulations.frequency.enabled = true;
    waveLayer.modulations.frequency.min = 0.002;
    waveLayer.modulations.frequency.max = 0.015;
    waveLayer.modulations.frequency.timePct = 40; // 40% of duration cycle
    waveLayer.modulations.frequency.behavior = 'return'; // Swings back and forth smoothly

    // 2. Initialize UI Controls
    this.controls.init();

    // T.C toggle button
    if (this.btnTimecodeToggleEl) {
      this.btnTimecodeToggleEl.addEventListener('click', () => {
        this.showTimecode = !this.showTimecode;
        this.btnTimecodeToggleEl.classList.toggle('active', this.showTimecode);
        this.btnTimecodeToggleEl.setAttribute('aria-pressed', this.showTimecode);
        if (!this.isPlaying) this.renderSingleFrame();
      });
    }

    // 3. Start Main Render Loop
    this.lastTime = performance.now();
    this.tick();
  }

  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.lastTime = performance.now();
    this.controls.updatePlayPauseButton(true);
    this.tick();
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.controls.updatePlayPauseButton(false);
  }

  /**
   * Seeks playback (paused or running) back to time 0. Also resets each generator's own
   * internal state (same reset() hook used before export) since stateful particle-field
   * generators (Rain, Snowflake, ...) accumulate live spawn history that a plain
   * accumulatedTime rewind can't undo on its own - this gives a genuine fresh start rather
   * than just rewinding the clock while particles stay wherever they last were.
   */
  rewindToStart() {
    this.accumulatedTime = 0;
    this.frameCount = 0;
    for (let layer of this.layerManager.layers) {
      if (layer.generator.reset) layer.generator.reset();
      if (layer.feedbackHandler) layer.feedbackHandler.clear();
    }
    if (!this.isPlaying) {
      this.renderSingleFrame();
    }
  }

  tick() {
    if (!this.isPlaying || this.recorder.isRecording) return;

    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    // Track simulated time (ignoring paused periods)
    this.accumulatedTime += deltaTime;
    this.frameCount++;

    // Retrieve global export settings
    const duration = parseFloat(document.getElementById('export-duration').value) || 10;
    const bgMode = document.getElementById('export-bg').value;

    // Loop: reset time when duration is exceeded
    const durationMs = duration * 1000;
    if (this.accumulatedTime >= durationMs) {
      this.accumulatedTime = this.accumulatedTime % durationMs;
      // Also reset frameCount to keep in sync
      this.frameCount = Math.floor(this.accumulatedTime / 1000 * 60);
    }

    // 1. Evaluate Dynamic Modulations (LFO)
    this.layerManager.applyModulations(this.accumulatedTime, duration);

    // 2. Synchronize UI knobs/values with calculated modulation states
    this.controls.updateUIValues();

    // 3. Update physics / particle simulations
    this.layerManager.update(this.accumulatedTime, this.frameCount);

    // 4. Draw layers and composition onto Master Context
    this.layerManager.draw(this.ctx, this.accumulatedTime, this.frameCount, bgMode, 1.0);

    // 5. Draw Timecode Overlay (preview only, not during export)
    if (this.showTimecode) {
      this.drawTimecodeOverlay(this.accumulatedTime);
    }

    requestAnimationFrame(() => this.tick());
  }

  /**
   * Forces a single frame render. Useful for updating the preview canvas 
   * instantly when paused and parameters or randomizer change.
   */
  renderSingleFrame() {
    const duration = parseFloat(document.getElementById('export-duration').value) || 10;
    const bgMode = document.getElementById('export-bg').value;

    // Apply parameter modulations for current time
    this.layerManager.applyModulations(this.accumulatedTime, duration);
    // Sync UI display
    this.controls.updateUIValues();
    // Render master frame
    this.layerManager.draw(this.ctx, this.accumulatedTime, this.frameCount, bgMode, 1.0);
    // Timecode overlay
    if (this.showTimecode) {
      this.drawTimecodeOverlay(this.accumulatedTime);
    }
  }

  /**
   * Draws a timecode overlay on the top-right of the preview canvas.
   * Format: xx.yyy  Frame: NNNN
   * Only called during live preview; never during export.
   */
  drawTimecodeOverlay(timeMs) {
    const ctx = this.ctx;
    const totalSec = timeMs / 1000;
    const sec = Math.floor(totalSec);
    const ms = Math.floor(totalSec * 1000) % 1000;
    const frame = Math.floor(totalSec * 60);

    const secStr = String(sec).padStart(2, '0');
    const msStr  = String(ms).padStart(3, '0');
    const tcStr  = `${secStr}.${msStr}`;
    const fStr   = `Frame: ${frame}`;

    const x = this.width - 16;
    const y1 = 20;
    const fontSize1 = 28;
    const fontSize2 = 16;

    ctx.save();
    // MUST reset composite/alpha — LayerManager may leave these non-default after blending
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;
    ctx.textBaseline = 'top';

    // Measure both lines first (set font before measuring)
    ctx.font = `bold ${fontSize1}px 'JetBrains Mono', monospace`;
    const tcWidth = ctx.measureText(tcStr).width;
    ctx.font = `${fontSize2}px 'JetBrains Mono', monospace`;
    const frWidth = ctx.measureText(fStr).width;

    const boxW = Math.max(tcWidth, frWidth) + 20;
    const boxH = fontSize1 + fontSize2 + 14;

    // Semi-transparent dark background pill for readability
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(x - boxW - 8, y1 - 6, boxW + 12, boxH, 6);
    ctx.fill();

    // Timecode text (white)
    ctx.font = `bold ${fontSize1}px 'JetBrains Mono', monospace`;
    ctx.textAlign = 'right';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(tcStr, x, y1);

    // Frame label (cyan)
    ctx.font = `${fontSize2}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = 'rgb(6, 182, 212)';
    ctx.fillText(fStr, x, y1 + fontSize1 + 4);

    ctx.restore();
  }

  /**
   * Triggers offline high-quality video generation
   * @param {Object} options - Export settings
   */
  async exportVideo(options) {
    this.pause(); // Pause standard preview rendering loop

    // Show Progress Overlay
    this.recordingOverlayEl.classList.remove('hidden');
    this.recordingStatusEl.textContent = 'Preparing render engine...';
    this.recordingProgressEl.value = 0;

    // Run Video Recorder
    await this.recorder.export(
      options,
      // Progress Callback
      (percent) => {
        this.recordingStatusEl.textContent = `Rendering: ${percent}%`;
        this.recordingProgressEl.value = percent;
      },
      // Completion Callback
      () => {
        this.recordingOverlayEl.classList.add('hidden');
        this.play(); // Auto-resume preview loop after export
      }
    );
  }
}

// Instantiate and start app on load
window.addEventListener('DOMContentLoaded', () => {
  const app = new MovieCreatorApp();
  app.init();
});
