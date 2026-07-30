# MP4 to SpriteSheet Studio & Converter

MP4動画の一部（指定範囲クロップ、指定フレーム/時間範囲）を切り出し、黒背景の自動透過（クロマキーアルファ抽出）を行った上で、**Cocos Creator** や **Unity** などのゲームエンジンで直接利用できるスプライトシート（PNG + メタデータ）に変換するツールセットです。

---

## 🚀 ツール概要

1. **Web GUI ツール (完全ローカル処理)**
   - インストール不要。`index.html` をブラウザで開くだけで即座に使用可能です。
   - サーバーへの動画アップロード不要でセキュリティ的にも安全・高速。
   - 画面上でマウスドラッグによる直感的な**矩形クロップ（範囲切り出し）**。
   - IN点/OUT点シークバー指定、FPS抽出設定。
   - 黒抜き感度 (Black Threshold) とエッジぼかし (Softness) の**リアルタイム透過プレビュー**。
   - 出力形式: `.png` (スプライトシート), `.plist` (Cocos Creator用), `.json` (Unity / Generic用), 連番PNG `.zip`

2. **Python CLI スクリプト (`mp4_to_sprite.py`)**
   - コマンドラインからのバッチ処理・自動処理用スクリプト。
   - OpenCV + Pillow + NumPy ベース。

---

## 📖 使い方 (Web GUI ツール)

1. `index.html` をブラウザ（Chrome, Edge, Firefox, Safari等）でダブルクリックして開きます。
2. 画面上の領域にMP4動画をドラッグ＆ドロップ（または「ファイルを開く」）。
3. プレビュー画面上でドラッグして**切り出したい部分（クロップ枠）**を指定します。
4. シークバーで「IN点設定」「OUT点設定」を押し、抽出時間範囲を指定します。
5. 「黒抜き感度」と「エッジぼかし」の数値をスライダーで調整し、プレビュー画面で透過具合を確認します。
6. 「✨ スプライトシートを生成する」ボタンをクリックします。
7. 出力されたPNG画像および Cocos Creator 用 `.plist` / `.json` をダウンロードします。

---

## 🐍 使い方 (Python スクリプト)

### 必要な環境 setup
```bash
pip install -r requirements.txt
```

### コマンド例

#### 基本的な実行（全体から15FPSで抽出、黒抜き透過）
```bash
python mp4_to_sprite.py -i input.mp4 -o sprite_sheet.png
```

#### 時間範囲指定・クロップ範囲・Cocos Creator用.plist出力
```bash
python mp4_to_sprite.py -i input.mp4 -o attack_anim.png --start 1.2 --end 3.5 --fps 12 --crop "100,50,400,400" --threshold 25 --softness 10 --plist
```

#### オプション一覧
- `-i`, `--input`: 入力MP4動画パス (必須)
- `-o`, `--output`: 出力PNG画像パス (デフォルト: `sprite_sheet.png`)
- `--start`: 開始秒数 (デフォルト: 0.0)
- `--end`: 終了秒数 (デフォルト: 動画末尾)
- `--fps`: 抽出コマ数 (デフォルト: 15)
- `--crop`: 矩形範囲 `"x,y,w,h"` ピクセル
- `--threshold`: 黒抜き輝度閾値 0~255 (デフォルト: 20)
- `--softness`: 境界ぼかし感度 1~50 (デフォルト: 10)
- `--cols`: 横列数 (省略時は自動計算)
- `--plist`: Cocos Creator 互換 `.plist` メタデータ出力
- `--json`: Unity / Generic `.json` メタデータ出力

---

## 🎮 Cocos Creator への取り込み・使用手順

1. 出力された `sprite_sheet.png` と `sprite_sheet.plist` を、Cocos Creator の `assets` フォルダへドラッグ＆ドロップします。
2. Cocos Creator が自動的に `.plist` を解析し、1つ1つのフレーム（SpriteFrame）としてアセットブラウザに展開されます。
3. **Animation クリップの作成**:
   - アニメーションクリップ（`.anim`）を作成し、Sprite コンポーネントの `spriteFrame` プロパティのタイムラインへドラッグ＆ドロップでフレームを順に配置します。
4. **加算合成（Additive Blend）を行う場合**:
   - スプライトの Node の Sprite コンポーネントで、Blend Factor を `SRC_ALPHA`, `ONE` に設定することで、エフェクトの輝きを一層強調できます。
