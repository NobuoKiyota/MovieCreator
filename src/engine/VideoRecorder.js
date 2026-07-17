import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import WebmMuxer from 'webm-muxer';

/**
 * Handles frame-by-frame offline rendering and exporting to MP4 (via WebCodecs & mp4-muxer)
 * or Transparent WebM (via WebCodecs & webm-muxer).
 */
export class VideoRecorder {
  constructor(canvas, layerManager) {
    this.canvas = canvas;
    this.layerManager = layerManager;
    this.isRecording = false;
  }

  /**
   * Main export orchestrator
   * @param {Object} options - Export settings
   * @param {Function} onProgress - Callback for rendering progress (0 to 100)
   * @param {Function} onComplete - Callback when export finishes
   */
  async export(options = {}, onProgress, onComplete) {
    if (this.isRecording) return;
    this.isRecording = true;

    const {
      duration = 10,       // Duration in seconds
      fps = 60,            // Export Frame Rate
      bgMode = 'black',    // Background Mode
      fadeOutDuration = 2.0, // Master fade out duration in seconds
      width = 1920,
      height = 1080,
      filename = `MovieCreator_Render_${Date.now()}`
    } = options;

    const totalFrames = duration * fps;
    const originalWidth = this.canvas.width;
    const originalHeight = this.canvas.height;

    // Temporarily resize canvas and layerManager for export resolution
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.layerManager && this.layerManager.resize) {
      this.layerManager.resize(width, height);
    }

    try {
      // Use webm-muxer + WebCodecs VP9 for transparent WebM export
      if (bgMode === 'transparent') {
        await this.exportWebMAlpha(totalFrames, fps, bgMode, fadeOutDuration, onProgress, filename);
      } else {
        await this.exportMP4(totalFrames, fps, bgMode, fadeOutDuration, onProgress, filename);
      }
    } catch (err) {
      console.error('Export process encountered error:', err);
    } finally {
      // Safely restore original screen resolution
      this.canvas.width = originalWidth;
      this.canvas.height = originalHeight;
      if (this.layerManager && this.layerManager.resize) {
        this.layerManager.resize(originalWidth, originalHeight);
      }
      this.isRecording = false;
      if (onComplete) onComplete();
    }
  }

  /**
   * Off-line high-quality MP4 export using WebCodecs (No frame drops, frame-accurate)
   * Falls back through codec profiles automatically if a codec is unsupported.
   */
  async exportMP4(totalFrames, fps, bgMode, fadeOutDuration, onProgress, filename) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.canvas.getContext('2d');
    const fadeStartFrame = totalFrames - (fadeOutDuration * fps);

    // Reset layer generator states before offline render
    for (let layer of this.layerManager.layers) {
      if (layer.generator.reset) layer.generator.reset();
      if (layer.feedbackHandler) layer.feedbackHandler.clear();
    }

    // --- Codec auto-detection with isConfigSupported() ---
    // Try H.264 profiles in descending quality order
    const codecCandidates = [
      { codec: 'avc1.640028', muxerCodec: 'avc', ext: 'mp4', mime: 'video/mp4' },  // H.264 High
      { codec: 'avc1.4d0028', muxerCodec: 'avc', ext: 'mp4', mime: 'video/mp4' },  // H.264 Main
      { codec: 'avc1.42E01E', muxerCodec: 'avc', ext: 'mp4', mime: 'video/mp4' },  // H.264 Baseline
    ];

    let chosenCodec = null;
    for (const candidate of codecCandidates) {
      try {
        const support = await VideoEncoder.isConfigSupported({
          codec: candidate.codec,
          width, height,
          bitrate: 12_000_000,
          framerate: fps,
          latencyMode: 'realtime',
          avc: { format: 'avc' },
          hardwareAcceleration: 'prefer-hardware'
        });
        if (support.supported) {
          chosenCodec = candidate;
          break;
        }
      } catch (_) {
        // isConfigSupported itself may throw in some environments
      }
    }

    if (!chosenCodec) {
      // H.264 not available at all — fall back to real-time WebM export
      console.warn('H.264 not supported. Falling back to WebM (MediaRecorder) export.');
      await this.exportWebMFallback(totalFrames, fps, bgMode, fadeOutDuration, onProgress, filename);
      return;
    }

    // 1. Initialize MP4 Muxer with chosen codec (Standard MP4 with moov at front for Windows compatibility)
    const muxer = new Mp4Muxer({
      target: new Mp4ArrayBufferTarget(),
      video: {
        codec: chosenCodec.muxerCodec,
        width, height
      },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset'
    });

    let encoder = null;
    try {
      let hasEncoderError = false;

      encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          console.error('VideoEncoder error:', e);
          hasEncoderError = true;
        }
      });

      encoder.configure({
        codec: chosenCodec.codec,
        width, height,
        bitrate: 12_000_000,
        framerate: fps,
        latencyMode: 'realtime', // Avoids B-frames to prevent DTS jitter and monotonic timestamp errors
        avc: { format: 'avc' }, // Force AVCC format (required for mp4-muxer / Firefox compatibility)
        hardwareAcceleration: 'prefer-hardware' // GPU acceleration produces highly standard compatible streams
      });

      // 2. Frame-by-frame render loop
      for (let frame = 0; frame < totalFrames; frame++) {
        if (hasEncoderError) break;

        const time = (frame / fps) * 1000;
        const frameTimeUs = Math.round((frame / fps) * 1_000_000);

        this.layerManager.update(time, frame);

        let fadeFactor = 1.0;
        if (frame > fadeStartFrame && fadeOutDuration > 0) {
          fadeFactor = 1.0 - ((frame - fadeStartFrame) / (totalFrames - fadeStartFrame));
        }

        this.layerManager.draw(ctx, time, frame, bgMode, fadeFactor);

        // duration must be provided in microseconds for mp4-muxer to work correctly
        const frameDurationUs = Math.round(1_000_000 / fps);
        const videoFrame = new VideoFrame(this.canvas, {
          timestamp: frameTimeUs,
          duration: frameDurationUs
        });
        const keyFrame = frame % (fps * 2) === 0;
        encoder.encode(videoFrame, { keyFrame });
        videoFrame.close();

        // Yield to event loop every 2 frames (prevents encoder queue overflow)
        if (frame % 2 === 0 || encoder.encodeQueueSize > 10) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (onProgress) {
          onProgress(Math.round((frame / totalFrames) * 100));
        }
      }

      if (!hasEncoderError) {
        // 3. Flush and finalize
        await encoder.flush();
        muxer.finalize();

        const buffer = muxer.target.buffer;
        const blob = new Blob([buffer], { type: chosenCodec.mime });
        this.downloadBlob(blob, `${filename}.${chosenCodec.ext}`);
      } else {
        alert('MP4 encoding failed during render. Please try WebM export instead (background mode → Transparent).');
      }

    } catch (err) {
      console.error('Export failed:', err);
      alert(`Export failed: ${err.message}`);
    } finally {
      try { if (encoder && encoder.state !== 'closed') encoder.close(); } catch (_) {}
    }
  }

  /**
   * Fallback WebM export using MediaRecorder (used when WebCodecs H.264 is unsupported)
   */
  async exportWebMFallback(totalFrames, fps, bgMode, fadeOutDuration, onProgress, filename) {
    console.log('Using MediaRecorder fallback for WebM export...');

    const stream = this.canvas.captureStream(fps);
    let mimeType = 'video/webm; codecs=vp9';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm; codecs=vp8';
    if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';

    const mediaRecorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const recorderPromise = new Promise((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob([chunks], { type: 'video/webm' });
        this.downloadBlob(blob, `${filename}.webm`);
        resolve();
      };
    });

    mediaRecorder.start();

    const ctx = this.canvas.getContext('2d');
    const fadeStartFrame = totalFrames - (fadeOutDuration * fps);
    const frameInterval = 1000 / fps;

    for (let layer of this.layerManager.layers) {
      if (layer.generator.reset) layer.generator.reset();
      if (layer.feedbackHandler) layer.feedbackHandler.clear();
    }

    try {
      for (let frame = 0; frame < totalFrames; frame++) {
        const time = (frame / fps) * 1000;
        this.layerManager.update(time, frame);

        let fadeFactor = 1.0;
        if (frame > fadeStartFrame && fadeOutDuration > 0) {
          fadeFactor = 1.0 - ((frame - fadeStartFrame) / (totalFrames - fadeStartFrame));
        }

        this.layerManager.draw(ctx, time, frame, bgMode, fadeFactor);
        await new Promise(resolve => setTimeout(resolve, frameInterval));

        if (onProgress) onProgress(Math.round((frame / totalFrames) * 100));
      }

      mediaRecorder.stop();
      await recorderPromise;
    } catch (err) {
      console.error('WebM fallback export failed:', err);
      alert('Export failed: ' + err.message);
    }
  }

  /**
   * Off-line high-quality transparent WebM export using WebCodecs (VP9) and webm-muxer
   */
  async exportWebMAlpha(totalFrames, fps, bgMode, fadeOutDuration, onProgress, filename) {
    const width = this.canvas.width;
    const height = this.canvas.height;
    const ctx = this.canvas.getContext('2d');
    const fadeStartFrame = totalFrames - (fadeOutDuration * fps);

    // Reset sketches/particles
    for (let layer of this.layerManager.layers) {
      if (layer.generator.reset) layer.generator.reset();
      if (layer.feedbackHandler) layer.feedbackHandler.clear();
    }

    // 1. Initialize WebM Muxer with VP9 Alpha config
    const muxer = new WebmMuxer({
      target: 'buffer',
      video: {
        codec: 'V_VP9',
        width, height,
        alpha: true // Muxer configuration to output transparent WebM
      }
    });

    let encoder = null;
    try {
      let hasEncoderError = false;

      encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => {
          console.error('VideoEncoder error:', e);
          hasEncoderError = true;
        }
      });

      // Configure VP9 codec for alpha transparency support
      encoder.configure({
        codec: 'vp09.00.10.08',
        width, height,
        bitrate: 12_000_000,
        framerate: fps,
        alpha: 'keep' // Retain alpha channel in encoded frames
      });

      // 2. Frame-by-frame rendering loop
      for (let frame = 0; frame < totalFrames; frame++) {
        if (hasEncoderError) break;

        const time = (frame / fps) * 1000;
        const frameTimeUs = Math.round((frame / fps) * 1_000_000);

        this.layerManager.update(time, frame);

        let fadeFactor = 1.0;
        if (frame > fadeStartFrame && fadeOutDuration > 0) {
          fadeFactor = 1.0 - ((frame - fadeStartFrame) / (totalFrames - fadeStartFrame));
        }

        // Draw with transparent background setting
        this.layerManager.draw(ctx, time, frame, bgMode, fadeFactor);

        const frameDurationUs = Math.round(1_000_000 / fps);
        const videoFrame = new VideoFrame(this.canvas, {
          timestamp: frameTimeUs,
          duration: frameDurationUs,
          alpha: 'keep' // Preserves transparency at Frame level
        });
        const keyFrame = frame % (fps * 2) === 0;
        encoder.encode(videoFrame, { keyFrame });
        videoFrame.close();

        // Prevent queue lockups
        if (frame % 2 === 0 || encoder.encodeQueueSize > 10) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }

        if (onProgress) {
          onProgress(Math.round((frame / totalFrames) * 100));
        }
      }

      if (!hasEncoderError) {
        await encoder.flush();
        const buffer = muxer.finalize();
        if (buffer) {
          const blob = new Blob([buffer], { type: 'video/webm' });
          this.downloadBlob(blob, `${filename}.webm`);
        } else {
          alert('WebM alpha encoding failed (empty buffer).');
        }
      } else {
        alert('WebM alpha encoding failed.');
      }

    } catch (err) {
      console.error('WebM alpha export failed:', err);
      alert(`WebM alpha export failed: ${err.message}`);
    } finally {
      try { if (encoder && encoder.state !== 'closed') encoder.close(); } catch (_) {}
    }
  }

  /**
   * Helper to trigger native browser file download
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    // Clean up
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  }
}
