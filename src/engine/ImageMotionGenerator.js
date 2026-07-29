/**
 * ImageMotionGenerator.js
 * 静止画（イラスト・写真・スクリーンショット）を取り込み、
 * 2.5Dパララックス視差、トランスフォーム、フィットモード、フェザーマスク切り抜き、
 * シネマグラフ表現の基盤を提供する専用ジェネレーター
 */

export class ImageMotionGenerator {
  constructor() {
    this.name = 'ImageMotionGenerator';
    this.imgMap = new Map(); // src/dataUrl -> HTMLImageElement キャッシュ

    this.params = {
      imageDataUrl: '',       // DataURL または URL
      cycleDuration: 5000,    // 共通サイクル時間 (ms)
      parallaxDepth: 0.5,     // 視差奥行き感度 (-2.0 〜 +2.0)
      fitMode: 'contain',     // contain, cover, fill, original
      opacity: 1.0,           // 不透明度 (0.0 〜 1.0)
      scaleX: 1.0,            // 個別スケールX (0.1 〜 5.0)
      scaleY: 1.0,            // 個別スケールY (0.1 〜 5.0)
      posX: 0,                // オフセット位置X (-500 〜 500)
      posY: 0,                // オフセット位置Y (-500 〜 500)
      rotation: 0,            // 個別回転 (-180 〜 180)
      maskShape: 'none',      // none, circle, ellipse
      maskSize: 1.0           // マスクサイズ (0.1 〜 2.0)
    };
  }

  getParameterConfig() {
    return [
      { name: 'cycleDuration', label: 'Cycle Duration', type: 'range', min: 500, max: 20000, step: 100, default: 5000 },
      { name: 'parallaxDepth', label: 'Parallax Depth', type: 'range', min: -2.0, max: 2.0, step: 0.05, default: 0.5 },
      { name: 'opacity', label: 'Image Opacity', type: 'range', min: 0.0, max: 1.0, step: 0.01, default: 1.0 },
      { name: 'scaleX', label: 'Scale X', type: 'range', min: 0.1, max: 5.0, step: 0.05, default: 1.0 },
      { name: 'scaleY', label: 'Scale Y', type: 'range', min: 0.1, max: 5.0, step: 0.05, default: 1.0 },
      { name: 'posX', label: 'Position X Offset', type: 'range', min: -500, max: 500, step: 1, default: 0 },
      { name: 'posY', label: 'Position Y Offset', type: 'range', min: -500, max: 500, step: 1, default: 0 },
      { name: 'rotation', label: 'Image Rotation', type: 'range', min: -180, max: 180, step: 1, default: 0 },
      { name: 'maskSize', label: 'Mask Size', type: 'range', min: 0.1, max: 2.0, step: 0.05, default: 1.0 }
    ];
  }

  /**
   * 画像オブジェクトの事前生成/読み込みキャッシュを取得
   */
  getImage(src) {
    if (!src) return null;
    if (this.imgMap.has(src)) {
      const img = this.imgMap.get(src);
      return img.complete && img.naturalWidth !== 0 ? img : null;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = src;
    this.imgMap.set(src, img);
    return null;
  }

  /**
   * 描画メイン処理
   * @param {CanvasRenderingContext2D} ctx 
   * @param {number} width キャンバス幅
   * @param {number} height キャンバス高さ
   * @param {number} time 経過時間 (ms)
   * @param {Object} globalParallax { offsetX, offsetY } グローバル視差オフセット
   */
  draw(ctx, width, height, time = 0, globalParallax = { offsetX: 0, offsetY: 0 }) {
    const src = this.params.imageDataUrl || this.params.imageSrc;
    if (!src) {
      this.drawPlaceholder(ctx, width, height);
      return;
    }

    const img = this.getImage(src);
    if (!img) {
      this.drawLoading(ctx, width, height);
      return;
    }

    const imgW = img.naturalWidth || width;
    const imgH = img.naturalHeight || height;

    // パララックス視差計算 (parallaxDepth: -2.0 〜 +2.0)
    const depth = this.params.parallaxDepth !== undefined ? this.params.parallaxDepth : 0.0;
    const parallaxX = (globalParallax.offsetX || 0) * depth * (width * 0.1);
    const parallaxY = (globalParallax.offsetY || 0) * depth * (height * 0.1);

    // フィットモード計算 (cover, contain, fill, original)
    const fitMode = this.params.fitMode || 'contain';
    let baseW = width;
    let baseH = height;
    let scaleRatio = 1.0;

    if (fitMode === 'contain') {
      scaleRatio = Math.min(width / imgW, height / imgH);
      baseW = imgW * scaleRatio;
      baseH = imgH * scaleRatio;
    } else if (fitMode === 'cover') {
      scaleRatio = Math.max(width / imgW, height / imgH);
      baseW = imgW * scaleRatio;
      baseH = imgH * scaleRatio;
    } else if (fitMode === 'original') {
      baseW = imgW;
      baseH = imgH;
    } else { // fill
      baseW = width;
      baseH = height;
    }

    const scaleX = this.params.scaleX !== undefined ? this.params.scaleX : 1.0;
    const scaleY = this.params.scaleY !== undefined ? this.params.scaleY : 1.0;
    const posX = (this.params.posX !== undefined ? this.params.posX : 0) + parallaxX;
    const posY = (this.params.posY !== undefined ? this.params.posY : 0) + parallaxY;
    const rotation = (this.params.rotation || 0) * (Math.PI / 180);

    const drawW = baseW * scaleX;
    const drawH = baseH * scaleY;

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
      if (maskShape === 'circle') {
        const radius = Math.min(drawW, drawH) * 0.5 * (this.params.maskSize || 1.0);
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
      } else if (maskShape === 'ellipse') {
        const rx = (drawW / 2) * (this.params.maskSize || 1.0);
        const ry = (drawH / 2) * (this.params.maskSize || 1.0);
        ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      }
      ctx.clip();
    }

    const opacity = this.params.opacity !== undefined ? this.params.opacity : 1.0;
    ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));

    // 中央配置描画
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);

    if (maskShape !== 'none') {
      ctx.restore();
    }

    ctx.restore();
  }

  drawPlaceholder(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(width * 0.15, height * 0.15, width * 0.7, height * 0.7);

    ctx.fillStyle = 'rgba(0, 229, 255, 0.8)';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🖼️ Drag & Drop image here, or Paste (Ctrl+V)', width / 2, height / 2);
    ctx.restore();
  }

  drawLoading(ctx, width, height) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading Image...', width / 2, height / 2);
    ctx.restore();
  }
}

export const imageMotionGenerator = new ImageMotionGenerator();
