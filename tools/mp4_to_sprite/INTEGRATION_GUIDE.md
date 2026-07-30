# MovieCreator へのスプライトアニメ生成機能 移植・連携ガイド

本ツール (`Z:\MovieCreator\tools\mp4_to_sprite\`) は、MP4動画から特定のフレーム範囲・クロップ領域を切り出し、黒背景の自動透過（クロマキーアルファ抽出）を行ってスプライトシートおよび `.plist` / `.json` メタデータを生成する機能を提供します。

---

## 🛠 `MovieCreator` 側への機能移植・連携方法

`MovieCreator` のWeb UIやエンジン (`src/engine/Generators.js` 等) に本ツールのコア機能を組み込む場合のアーキテクチャおよび指示文です。

### 1. コアロジックの抽出モジュール (`app.js` より)

`tools/mp4_to_sprite/app.js` に含まれるコア関数は以下の通りです：

#### A. 黒抜きクロマキーアルファ抽出 (`applyBlackChromaKey`)
```javascript
function applyBlackChromaKey(ctx, width, height, threshold = 20, softness = 10) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const soft = Math.max(1, softness);

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const maxVal = Math.max(r, g, b);

    // アルファ値の計算 (0.0 ~ 1.0)
    let alpha = Math.min(1.0, Math.max(0.0, (maxVal - threshold) / soft));
    data[i + 3] = Math.round(alpha * 255);

    // 背景黒のアンプレマルチプライエッジ補正
    if (alpha > 0.01) {
      const factor = 1.0 / Math.max(alpha, 0.3);
      data[i] = Math.min(255, Math.round(r * factor));
      data[i + 1] = Math.min(255, Math.round(g * factor));
      data[i + 2] = Math.min(255, Math.round(b * factor));
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
```

#### B. 画質補正 (カラー＆3x3畳み込みシャープネス)
```javascript
// CanvasコンテクストへのCSS Filter適用
ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) hue-rotate(${hue}deg)`;

// 3x3 畳み込み演算シャープネス関数
function applySharpenFilter(ctx, w, h, amount) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const src = imgData.data;
  const output = ctx.createImageData(w, h);
  const dst = output.data;
  
  const a = amount * 0.25;
  const kCenter = 1 + 4 * a;
  const kEdge = -a;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        const val = src[i + c] * kCenter +
          (src[((y - 1) * w + x) * 4 + c] +
           src[((y + 1) * w + x) * 4 + c] +
           src[(y * w + (x - 1)) * 4 + c] +
           src[(y * w + (x + 1)) * 4 + c]) * kEdge;
        dst[i + c] = Math.min(255, Math.max(0, val));
      }
      dst[i + 3] = src[i + 3];
    }
  }
  ctx.putImageData(output, 0, 0);
}
```

---

## 🤖 AI向け組み込み実装時のプロンプト指示文 (コピー用)

もし `MovieCreator` 側の開発で「スプライト生成機能を動画生成エンジンに組み込みたい」場合にAIに送る指示文のテンプレートです：

> **【指示文例】**  
> `Z:\MovieCreator\tools\mp4_to_sprite\app.js` に実装されている MP4動画のクロップ・黒抜き透過（`applyBlackChromaKey`）・カラーシャープ補正（`applySharpenFilter`）・スプライトシートパッキングロジックを、`src/engine/Generators.js` （または新規モジュール `src/engine/SpriteStudioExporter.js`）へインポート・共通関数化して組み込んでください。

---

## 📁 ツール構成
- **GUI起動バッチ**: `Z:\MovieCreator\open_sprite_studio.bat`
- **スタンドアロンWeb画面**: `Z:\MovieCreator\tools\mp4_to_sprite\index.html`
- **Python CLI変換器**: `Z:\MovieCreator\tools\mp4_to_sprite\mp4_to_sprite.py`
