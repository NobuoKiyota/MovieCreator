/**
 * VideoMotionGenerator.js
 * MP4 / WebM 動画ファイルを取り込み、リアルタイムフレームレンダリング、
 * 息づかい(Pulse)、手振れ・浮遊(Floating Shake)、ケン・バーンズ(Pan & Zoom)、
 * 2.5Dパララックス視差、トリミング・再生スピード・ループ同期・マスク切り抜きを提供する専用ジェネレーター
 */

export class VideoMotionGenerator {
  constructor() {
    this.name = 'VideoMotionGenerator';
    
    // 動画要素の個別プロパティ (paramsの中にBase64/BlobUrlを含めないことでJSON.stringifyフリーズを防止)
    this.videoDataUrl = '';
    this.videoElement = null;
    this.videoLoaded = false;
    this.videoError = false;

    this.params = {
      cycleDuration: 5000,    // 共通サイクル時間 (ms)
      loopMode: 'auto',       // auto (自動ループ), sync (マスター長に速度同期), once (1回再生)
      playbackSpeed: 1.0,     // 再生速度 (0.1 〜 3.0x)
      startOffset: 0.0,       // 開始オフセット再生開始位置 (秒)
      parallaxDepth: 0.0,     // 視差奥行き感度 (-2.0 〜 +2.0, デフォルト0)
      fitMode: 'contain',     // contain, cover, fill, original
      opacity: 1.0,           // 不透明度 (0.0 〜 1.0)

      // 自動アニメーション・シネマグラフモーション
      breathAmount: 0.05,     // 息づかい・脈動拡大縮小 (0.0 〜 0.3)
      floatAmount: 15.0,      // ゆらゆら手振れ・浮遊 (0 〜 100 px)
      autoPanZoom: 0.08,      // パン＆ズーム効果 (0.0 〜 0.5)
      motionSpeed: 1.0,       // モーション全体スピード (0.1 〜 5.0)

      // 基本トランスフォーム
      scaleX: 1.0,            // 個別スケールX (0.1 〜 5.0)
      scaleY: 1.0,            // 個別スケールY (0.1 〜 5.0)
      posX: 0,                // オフセット位置X (-500 〜 500)
      posY: 0,                // オフセット位置Y (-500 〜 500)
      rotation: 0,            // 個別回転 (-180 〜 180)
      maskShape: 'none',      // none, circle, ellipse
      maskSize: 1.0           // マスクサイズ (0.1 〜 2.0)
    };
  }

  /**
   * 動画URL/BlobURLの設定および非同期ロード・再生開始
   */
  setVideoUrl(url) {
    if (!url || this.videoDataUrl === url) return;
    this.videoDataUrl = url;
    this.videoLoaded = false;
    this.videoError = false;

    if (this.videoElement) {
      try {
        this.videoElement.pause();
        this.videoElement.src = '';
        this.videoElement.load();
      } catch (e) { /* ignore cleanup errors */ }
    }

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.playsInline = true;
    video.muted = true; // ブラウザの自動再生ポリシーを満たすためミュート化
    video.loop = this.params.loopMode !== 'once';
    video.autoplay = true;

    video.onloadeddata = () => {
      this.videoElement = video;
      this.videoLoaded = true;
      video.play().catch(err => console.warn('Video Motion Generator: Autoplay caught:', err));
    };

    video.onerror = () => {
      this.videoError = true;
      console.warn('Video Motion Generator: Failed to load video src');
    };

    video.src = url;
    video.load();
  }

  getParameterConfig() {
    return [
      { name: 'cycleDuration', label: 'Cycle Duration', type: 'range', min: 500, max: 20000, step: 100, default: 5000 },
      { name: 'playbackSpeed', label: 'Playback Speed', type: 'range', min: 0.1, max: 3.0, step: 0.05, default: 1.0 },
      { name: 'startOffset', label: 'Start Offset (秒)', type: 'range', min: 0.0, max: 60.0, step: 0.1, default: 0.0 },
      { name: 'breathAmount', label: 'Breath Pulse (息づかい)', type: 'range', min: 0.0, max: 0.3, step: 0.005, default: 0.05 },
      { name: 'floatAmount', label: 'Floating Shake (手振れ浮遊)', type: 'range', min: 0.0, max: 100.0, step: 1.0, default: 15.0 },
      { name: 'autoPanZoom', label: 'Ken Burns Pan&Zoom', type: 'range', min: 0.0, max: 0.5, step: 0.01, default: 0.08 },
      { name: 'motionSpeed', label: 'Motion Speed', type: 'range', min: 0.1, max: 5.0, step: 0.1, default: 1.0 },
      { name: 'parallaxDepth', label: 'Parallax Depth', type: 'range', min: -2.0, max: 2.0, step: 0.05, default: 0.0 },
      { name: 'opacity', label: 'Video Opacity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 1.0 },
      { name: 'scaleX', label: 'Scale X', type: 'range', min: 0.1, max: 5.0, step: 0.05, default: 1.0 },
      { name: 'scaleY', label: 'Scale Y', type: 'range', min: 0.1, max: 5.0, step: 0.05, default: 1.0 },
      { name: 'posX', label: 'Position X Offset', type: 'range', min: -500, max: 500, step: 1, default: 0 },
      { name: 'posY', label: 'Position Y Offset', type: 'range', min: -500, max: 500, step: 1, default: 0 },
      { name: 'rotation', label: 'Video Rotation', type: 'range', min: -180, max: 180, step: 1, default: 0 },
      { name: 'maskSize', label: 'Mask Size', type: 'range', min: 0.1, max: 2.0, step: 0.05, default: 1.0 }
    ];
  }

  update(time, frameCount, width, height) {
    if (this.videoElement && this.videoLoaded) {
      // ループモードと再生速度の同期
      const loopMode = this.params.loopMode || 'auto';
      const speed = typeof this.params.playbackSpeed === 'number' && !isNaN(this.params.playbackSpeed) ? this.params.playbackSpeed : 1.0;
      const offset = typeof this.params.startOffset === 'number' && !isNaN(this.params.startOffset) ? Math.max(0, this.params.startOffset) : 0.0;
      
      this.videoElement.loop = loopMode !== 'once';

      if (this.videoElement.playbackRate !== speed && speed > 0 && speed <= 16) {
        try {
          this.videoElement.playbackRate = speed;
        } catch (e) { /* ignore playbackRate errors */ }
      }

      // 開始オフセット位置の監視・巻き戻し補正
      if (offset > 0 && this.videoElement.currentTime < offset - 0.2) {
        try {
          this.videoElement.currentTime = offset;
        } catch (e) { /* ignore seek errors */ }
      }

      // 動画が停止している場合は自動再生を試行
      if (this.videoElement.paused && !this.videoElement.ended) {
        this.videoElement.play().catch(() => {});
      }
    }
  }

  reset() {
    if (this.videoElement && this.videoLoaded) {
      try {
        this.videoElement.currentTime = 0;
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * 描画メイン処理 (リアルタイム動画フレームスキャン描画)
   */
  draw(ctx, width, height, time = 0, globalParallax = { offsetX: 0, offsetY: 0 }) {
    try {
      // params内に旧DataUrlが流れてきた場合はsetVideoUrlに退避
      if (this.params.videoDataUrl) {
        this.setVideoUrl(this.params.videoDataUrl);
        delete this.params.videoDataUrl;
      }

      if (!this.videoDataUrl) {
        this.drawPlaceholder(ctx, width, height);
        return;
      }

      if (this.videoError) {
        this.drawError(ctx, width, height);
        return;
      }

      if (!this.videoLoaded || !this.videoElement) {
        this.drawLoading(ctx, width, height);
        return;
      }

      const video = this.videoElement;
      const vidW = Math.max(1, video.videoWidth || width);
      const vidH = Math.max(1, video.videoHeight || height);

      // --- ⏰ 時間 time に基づく動的アニメーション計算 ---
      const speed = typeof this.params.motionSpeed === 'number' && !isNaN(this.params.motionSpeed) ? this.params.motionSpeed : 1.0;
      const tSec = (time / 1000) * speed;

      // 1. 息づかい・脈動スケール (Breath Pulse)
      const breathAmount = typeof this.params.breathAmount === 'number' && !isNaN(this.params.breathAmount) ? this.params.breathAmount : 0;
      const breathScale = 1.0 + Math.sin(tSec * 1.5) * breathAmount;

      // 2. 浮遊感・手振れ (Floating Shake)
      const floatAmount = typeof this.params.floatAmount === 'number' && !isNaN(this.params.floatAmount) ? this.params.floatAmount : 0;
      const floatX = Math.sin(tSec * 0.8) * floatAmount;
      const floatY = Math.cos(tSec * 1.1) * floatAmount;
      const floatRot = Math.sin(tSec * 0.5) * (floatAmount * 0.05);

      // 3. Ken Burns パン＆ズーム (Pan & Zoom)
      const panZoomAmount = typeof this.params.autoPanZoom === 'number' && !isNaN(this.params.autoPanZoom) ? this.params.autoPanZoom : 0;
      const panZoomScale = 1.0 + (Math.sin(tSec * 0.3) * 0.5 + 0.5) * panZoomAmount;
      const panX = Math.sin(tSec * 0.25) * (width * 0.05 * panZoomAmount);
      const panY = Math.cos(tSec * 0.2) * (height * 0.05 * panZoomAmount);

      // 4. パララックス視差計算
      const depth = typeof this.params.parallaxDepth === 'number' && !isNaN(this.params.parallaxDepth) ? this.params.parallaxDepth : 0.0;
      const parallaxX = (globalParallax.offsetX || 0) * depth * (width * 0.1);
      const parallaxY = (globalParallax.offsetY || 0) * depth * (height * 0.1);

      // フィットモード計算
      const fitMode = this.params.fitMode || 'contain';
      let baseW = width;
      let baseH = height;
      let scaleRatio = 1.0;

      if (fitMode === 'contain') {
        scaleRatio = Math.min(width / vidW, height / vidH);
        baseW = vidW * scaleRatio;
        baseH = vidH * scaleRatio;
      } else if (fitMode === 'cover') {
        scaleRatio = Math.max(width / vidW, height / vidH);
        baseW = vidW * scaleRatio;
        baseH = vidH * scaleRatio;
      } else if (fitMode === 'original') {
        baseW = vidW;
        baseH = vidH;
      } else { // fill
        baseW = width;
        baseH = height;
      }

      const paramScaleX = typeof this.params.scaleX === 'number' && !isNaN(this.params.scaleX) ? this.params.scaleX : 1.0;
      const paramScaleY = typeof this.params.scaleY === 'number' && !isNaN(this.params.scaleY) ? this.params.scaleY : 1.0;
      const paramPosX = typeof this.params.posX === 'number' && !isNaN(this.params.posX) ? this.params.posX : 0;
      const paramPosY = typeof this.params.posY === 'number' && !isNaN(this.params.posY) ? this.params.posY : 0;
      const paramRot = typeof this.params.rotation === 'number' && !isNaN(this.params.rotation) ? this.params.rotation : 0;

      const scaleX = Math.max(0.001, paramScaleX * breathScale * panZoomScale);
      const scaleY = Math.max(0.001, paramScaleY * breathScale * panZoomScale);
      const posX = paramPosX + parallaxX + floatX + panX;
      const posY = paramPosY + parallaxY + floatY + panY;
      const rotation = (paramRot + floatRot) * (Math.PI / 180);

      const drawW = Math.max(1, baseW * scaleX);
      const drawH = Math.max(1, baseH * scaleY);

      const centerX = width / 2 + posX;
      const centerY = height / 2 + posY;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation);

      // マスク切り抜き
      const maskShape = this.params.maskShape || 'none';
      if (maskShape !== 'none') {
        ctx.save();
        ctx.beginPath();
        const maskSize = typeof this.params.maskSize === 'number' && !isNaN(this.params.maskSize) ? Math.max(0.01, this.params.maskSize) : 1.0;
        if (maskShape === 'circle') {
          const radius = Math.max(0.1, Math.min(drawW, drawH) * 0.5 * maskSize);
          ctx.arc(0, 0, radius, 0, Math.PI * 2);
        } else if (maskShape === 'ellipse') {
          const rx = Math.max(0.1, (drawW / 2) * maskSize);
          const ry = Math.max(0.1, (drawH / 2) * maskSize);
          ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
        }
        ctx.clip();
      }

      const opacity = typeof this.params.opacity === 'number' && !isNaN(this.params.opacity) ? Math.max(0, Math.min(1, this.params.opacity)) : 1.0;
      ctx.globalAlpha *= opacity;

      // リアルタイム動画フレーム描画
      ctx.drawImage(video, -drawW / 2, -drawH / 2, drawW, drawH);

      if (maskShape !== 'none') {
        ctx.restore();
      }

      ctx.restore();
    } catch (e) {
      console.error('VideoMotionGenerator rendering exception safely caught:', e);
    }
  }

  drawPlaceholder(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.5)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(width * 0.15, height * 0.15, width * 0.7, height * 0.7);

    ctx.fillStyle = 'rgba(168, 85, 247, 0.9)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎥 Drag & Drop MP4/WebM video here', width / 2, height / 2);
    ctx.restore();
  }

  drawLoading(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Video...', width / 2, height / 2);
    ctx.restore();
  }

  drawError(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ Failed to load video file', width / 2, height / 2);
    ctx.restore();
  }
}

export const videoMotionGenerator = new VideoMotionGenerator();
