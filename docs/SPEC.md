# MovieCreator 設計仕様書

> 対象読者: このリポジトリを**初めて見る第三者**で、アプリを**編集(機能追加・修正)または再設計(別基盤での作り直し)**する人。
> 対になる文書: [MANUAL.md](MANUAL.md)(操作説明 + 改修レシピ)。
> 根拠: 2026-10-04 時点の `main`(`b80ab1e` 以降)の実コードを読んで記述。CLAUDE.md / TASKLOG.md は経緯の記録であり、**食い違う場合はこの文書とコードを正とする**(CLAUDE.md には削除済み機能の記述が残っている箇所がある。§14.4 参照)。
> 行番号は変化しうるため、関数名・クラス名で参照している。

---

## 0. この文書の読み方

| 目的 | 読む章 |
|---|---|
| 全体像を30分で掴む | §1, §2, §3 |
| 新しい描画パターン/FXを足したい | §4, §5, §6 → MANUAL §11 |
| ファイル形式を維持したまま中身を作り直したい | §3, §10, §11, §14 |
| 別言語/別フレームワークで再実装したい | §14.5(最小コア仕様)を起点に全章 |
| 学習(ランダマイザー/評価)の仕組みを変えたい | §8, §10.4〜10.6 |

---

## 1. 製品概要

### 1.1 目的
ブラウザ上で動作する、**ネオン/サイバーパンク調の生成映像(ジェネレーティブ・ビジュアル)素材メーカー**。VJ・動画編集用の**ループ素材(透過WebM / MP4)をプリセットとして量産し、販売する**ことが一次目的。

設計思想(コードから読み取れる優先順位):
1. **量産効率**: 1つのパラメータ群を「教師」にして変異体を大量に作り、👍/👎評価で好みを学習する(§8)。
2. **ループ安全性**: 周期型ジェネレーターは `cycleDuration` と書き出し Duration を揃えれば継ぎ目なくループする(§6.2)。
3. **ガチャの軽減**: 完全ランダムでなく「ベース値からの小さな変異」+「効果が破綻しがちなFXは常にOFF固定」(§8.3)。
4. **整った見た目 > 無秩序**: 対称(Mirror)・量子化(Pixelate/Posterize)など「秩序を与える」FXを重視(§5)。

### 1.2 非目標(現状やらないこと)
- 音声処理(書き出しは無音)。`SpectrumGenerator` は「見た目だけのフェイク」でマイク/音源入力は無い。
- 本番ホスティング時のサーバー機能(保存・評価・ProRes変換は `npm run dev` 専用。§11)。
- 自動テスト(テストコードは存在しない)。
- 書き出し結果のビット単位の再現性(§13.1)。

### 1.3 動作要件
- Chromium系ブラウザ(WebCodecs の `VideoEncoder` / `VideoFrame` が必須。Chrome推奨。`run_app.bat` は `BROWSER=chrome` を設定)。
- 透過WebM(VP9 alpha)は一部のEdge等で非対応。非対応時はアラートで通知(`exportWebMAlpha` の事前チェック)。
- Node.js(LTS。開発確認は v24)。Pythonは周辺ツール用(任意)。
- OS: 実運用は Windows(`.bat`、`explorer.exe` 起動、`cmd.exe`)。コア(ブラウザ側)はOS非依存。

---

## 2. システム構成

### 2.1 論理構成

```
┌──────────────────────────── Browser (Vite dev server が配信) ────────────────────────────┐
│  index.html ─ src/main.js (MovieCreatorApp: 再生ループ・時間管理)                          │
│     │                                                                                     │
│     ├─ engine/LayerManager.js ── Layer[]  (合成・FXパイプライン・LFO評価)                 │
│     │       ├─ Generators.js   (29種の描画クラス)  ← particleShapes / crackedWallShared    │
│     │       ├─ ImageMotionGenerator / VideoMotionGenerator                                 │
│     │       ├─ Effects.js      (ポストプロセスFX + FeedbackTrail)                          │
│     │       ├─ fxParamRanges.js / paramRangeOverrides.js (範囲レジストリ)                  │
│     │       └─ motionTemplates.js (キーフレーム形状ライブラリ)                              │
│     ├─ engine/VideoRecorder.js ── オフライン書き出し (WebCodecs + mp4/webm-muxer)           │
│     └─ ui/Controls.js (5.9k行: 全UI・タイムライン・ランダマイザー・評価・各種ダイアログ)    │
│            ├─ ui/fxRandomizerRules.js  (共通FXのランダム化ルール)                           │
│            └─ ui/paramDescriptions.js  (パラメータ説明文)                                   │
└───────────────┬───────────────────────────────────────────────────────────────────────────┘
                │ fetch('/api/...')   (開発サーバーのみ)
┌───────────────▼──────────────── Vite middleware: src/server/apiHandler.js ───────────────┐
│  projects/*.mvproj  presets/*.mvlayer  data/*.json  Excels/*.xlsx  output/  forSprite/    │
│  ffmpeg(任意) / explorer.exe / .bat 起動                                                  │
└───────────────────────────────────────────────────────────────────────────────────────────┘
周辺(独立): scripts/*.py (販売パッケージ・SNS自動投稿・動画合成GUI)  tools/mp4_to_sprite, tools/sprite_viewer
```

**フレームワーク無し**(vanilla JS / ES Modules / Canvas 2D)。状態管理ライブラリ・仮想DOM・バンドル設定は無く、UIは `innerHTML` + `addEventListener` の手書き。

### 2.2 ディレクトリと責務

| パス | 責務 | git |
|---|---|---|
| `index.html` | 静的UI骨格。**DOM id を `Controls.js` が直接参照**(§14.3)。レイヤー種別 `<select id="layer-type-select">` の定義元 | ○ |
| `src/main.js` | アプリ本体。再生ループ、時間、パララックス、タイムコード表示 | ○ |
| `src/engine/LayerManager.js` | `Layer`(1レイヤーの状態+描画)と `LayerManager`(レイヤー配列・合成) | ○ |
| `src/engine/Generators.js` | `BaseGenerator` と全ジェネレーター(約4.3k行) | ○ |
| `src/engine/Effects.js` | 画像処理FX群と `FeedbackTrail` | ○ |
| `src/engine/fxParamRanges.js` | 共通FX全パラメータの `{min,max,step}` の**単一の真実** | ○ |
| `src/engine/paramRangeOverrides.js` | Excel由来の範囲上書きを起動時に適用 | ○ |
| `src/engine/motionTemplates.js` | 正規化キーフレーム形状(0〜1)。基本形×強度3段階を自動展開 | ○ |
| `src/engine/particleShapes.js` | 粒子系3ジェネレーター共通のシェイプ描画(12種) | ○ |
| `src/engine/crackedWallShared.js` | Cracked/Magma Wall 共通の亀裂ネットワーク・カメラ・うごめき | ○ |
| `src/engine/fractalLine.js` | 中点変位フラクタル折れ線(現状 Lightning のみ使用) | ○ |
| `src/engine/ImageMotionGenerator.js` / `VideoMotionGenerator.js` | 静止画/動画のモーション化(**`BaseGenerator`を継承しない**独立クラス) | ○ |
| `src/engine/VideoRecorder.js` | MP4/透過WebM/ProRes書き出し | ○ |
| `src/ui/Controls.js` | UI全部 + 学習ロジック(§14.2で分割推奨) | ○ |
| `src/ui/fxRandomizerRules.js` | 共通FXごとのランダム化ルール(純関数) | ○ |
| `src/ui/paramDescriptions.js` | パラメータ説明(日本語1行)。パラメータレンジ編集UIで表示 | ○ |
| `src/server/apiHandler.js` | Viteミドルウェア `handleApiRequest`。ファイルI/O・xlsx・ffmpeg | ○ |
| `src/style.css` | 全スタイル(ダークテーマ、CSS変数) | ○ |
| `presets/` | レイヤープリセット `*.mvlayer`(JSON)。約178個。`presets260715/` は旧スナップショット | ○ |
| `projects/` | プロジェクト `*.mvproj`(JSON) | ○ |
| `data/scores.json` | **教師データ本体**(評価履歴)。マルチPC同期のため追跡対象 | ○ |
| `data/move_scores.json` | レイヤー×パラメータの Move スコア(Excelから生成) | ○ |
| `data/param_ranges.json` | パラメータ範囲上書き(Excelから生成) | ○ |
| `data/opinion_sheet_layer_map.json` | 意見書の表示名→type の追加マップ(自動登録分) | ○ |
| `Excels/` | `PresetLayerOpinionSheet.xlsx`、`ParameterRanges.xlsx`、`ParamComments.xlsx` | ○ |
| `output/` | 書き出し動画の保存先 | ✕ |
| `forSprite/` | スプライトシート成果物(PNG/plist/json) | ○ |
| `exports/` | 販売パッケージ用素材・ライセンス文 | ○ |
| `scripts/` | Python周辺ツール(§12) | ○(`config.json` は秘匿) |
| `tools/mp4_to_sprite`, `tools/sprite_viewer` | 静的HTMLツール(Vite配信下で動作) | ○ |
| `tools/ffmpeg/` | ProRes用ffmpeg(PC別配置) | ✕ |
| `dist/`, `node_modules/`, `.tmp_transcode/` | 生成物 | ✕ |
| `ai_archives/`, `liaison.md`, `HANDOFF_*.md` | 過去の引継ぎ記録(更新停止) | 一部 |

### 2.3 依存関係
- 実行時: `mp4-muxer ^5.2.2`、`webm-muxer ^2.0.2`(ブラウザ側)、`xlsx`(SheetJS 公式CDN tarball。**npmレジストリ版は高深刻度の既知脆弱性があるため意図的に避けている**。サーバー側のみ使用)。
- 開発: `vite ^5.4.11`。
- Python(任意): `opencv-python, pillow, numpy, openpyxl, requests`(+ scripts側で tweepy / flask / line-bot-sdk)。
- 外部CSS: Google Fonts(Outfit, JetBrains Mono)を `index.html` で読み込み(オフライン時はフォールバック)。

### 2.4 ビルドと起動
- `npm run dev`(Vite、`server.open: true`)→ `http://localhost:5173/`。`vite.config.js` の自作プラグイン `api-server-middleware` が `configureServer` で `handleApiRequest(req,res,next,__dirname)` を**全リクエストの前段**に挿す(`/api/` 以外は `next()`)。
- `npm run build` → `dist/`(静的)。この成果物には `/api/*` が無いので、保存・評価・ProRes・パラメータレンジ読込は失敗し、ブラウザダウンロードや同梱の `data/*.json` へフォールバックする箇所だけが動く(§11.3)。
- 初期セットアップ: `setup.bat`(npm install + pip install -r requirements.txt)。

---

## 3. 実行時モデル

### 3.1 起動シーケンス(`src/main.js`)
1. `DOMContentLoaded` → `await loadParamRangeOverrides()` → `new MovieCreatorApp()` → `app.init()`。
   - **範囲上書きのロードは必ず先に完了させる**。`Layer.initModulations()` が各パラメータの min/max を**構築時に一度だけ**モジュレーション状態へ焼き込むため、遅れて届いた上書きは既存レイヤーに反映されない(§10.7)。
2. `MovieCreatorApp` コンストラクタ: キャンバス `#preview-canvas` を **論理解像度 1280×720** に固定。`LayerManager`、`VideoRecorder`、`Controls` を生成。
3. `init()`: デモ用の2レイヤー(Noise Wave + Particles、それぞれglow/feedback/LFO設定済み)を追加 → `controls.init()` → `tick()` 開始。

### 3.2 時間モデル
- `accumulatedTime`(ms): 再生中の擬似時間。一時停止中は進まない。`tick()` で `performance.now()` の差分を加算。
- **ループ**: `accumulatedTime >= Duration(秒)×1000` で剰余を取って巻き戻し、`frameCount = floor(accumulatedTime/1000*60)` に同期。
- `frameCount`: プレビューは `tick` ごとに +1(実フレーム数)、ただしループ時は上式で再同期。**書き出しでは `frame` 番号そのもの**。
- 「現在フレーム」の定義が2系統ある点に注意: LFO/キーフレームは `currentFrame = time/1000 * 60`(**常に60fps換算**)、書き出しFPSが30でも同じ。

### 3.3 1フレームの処理順(`tick()` / `VideoRecorder` ループ共通)

```
1. layerManager.applyModulations(time, durationSec)   // LFO/キーフレーム → generator.params / layer.effects へ書き込み
2. controls.updateUIValues()                          // (プレビューのみ) スライダー表示を同期
3. layerManager.update(time, frameCount)              // generator.update(): 粒子等の状態シミュレーション
4. layerManager.draw(ctx, time, frameCount, bgMode, fade, parallax)
5. (プレビューのみ) タイムコード描画 → requestAnimationFrame
```
- 書き出しは 2 を行わず、5 も無い。パララックスは**書き出しでは渡されない**(`draw` の既定値 `{0,0}`)。
- `renderSingleFrame()` は 1,2,4 のみ(`update` を呼ばない)。一時停止中のパラメータ変更反映用。したがって**状態蓄積型ジェネレーターは一時停止中のスライダー操作では粒子が動かない**。

### 3.4 レイヤー1枚の描画パイプライン(`Layer.draw`)
キャッシュ用に **2枚のオフスクリーンCanvas** を持つ: `rawCanvas`(ジェネレーター+フィードバック)と `canvas`(FX適用後の最終)。

```
0. Spawn Jitter 判定: spawnCycleIndex = floor(time / (generator.params.cycleDuration || 2000))
   変化したら applySpawnJitter()        // 🎲ジッター有効パラメータを再抽選
1. rawCanvas:
     feedbackDecay <= 0 : clear → [3D変換] → generator.draw(rawCtx,w,h,time,parallax)
     feedbackDecay  > 0 : FeedbackTrail.process(前フレームを decay で減衰+scale/rotate して再描画) → generator.draw を重ね描き
2. canvas: clear → [positionX/Y平行移動] → 中心へ → rotation → orbitRadius(+X方向) → scale → rawCanvas を drawImage
3. FX(canvas上でin-place、**この順序**):
     Distortion → Spherize → LittlePlanet → GlassTile → SeamlessTile
     → MedianBlur → Oilify → Emboss → EdgeDetect → Pixelate → Posterize → Solarize → Cartoon
     → HueRotate → Glow → CanvasTexture → PaperTile → MirrorMode → ChromaticAberration
     → MotionBlur → RadialBlur
4. strobe: opacity *= (sin(2π·t·strobe) > 0 ? 1 : 0)   // 矩形波ON/OFF。結果は currentRenderOpacity に保持
```
- 3D変換(`apply3DTransform`)は**疑似3D**: `scale(scaleZ·cos(ry), scaleZ·cos(rx)) → rotate(rz)`(`fov=400`)。遠近は付かない。`rawCanvas` 側に掛かるのでフィードバックの履歴にも影響する。
- 例外は `try/catch` で握りつぶしてコンソールに出力(1レイヤーの失敗で全体を止めない)。
- **FXの順序は仕様の一部**。順序を変えると見た目が変わる(例: Glow を Mosaic の前/後で変えるとブロックの縁の発光が変わる)。

### 3.5 レイヤー合成と最終処理(`LayerManager.draw`)
1. 背景: `transparent`=clear / `black` / `white` / `green`(#00ff00クロマキー用)で塗りつぶし。
2. 配列順(先頭=最背面)に `visible` なレイヤーだけ `layer.draw` → `globalAlpha = currentRenderOpacity × fade`、`globalCompositeOperation = blendMode` で `drawImage`。
   - 既定ブレンド `lighter`(加算発光)。`color-wash` のみ `color`。選択肢は 17種(`source-over, lighter, screen, multiply, difference, exclusion, overlay, soft-light, hard-light, color-dodge, color-burn, darken, lighten, hue, saturation, color, luminosity`)。
3. マスターポスト(**背景が透過でない時のみ**): Vignette(`masterVignette`=0.3)、FilmGrain(`masterFilmGrain`=0.03、`Math.random` による毎フレーム乱数点)。
   - これらの値は**UIから変更できない**。`.mvproj` の `master.vignette / master.grain` にだけ保存される。
4. フェード: `fadeFactor < 1` のとき、透過背景ならピクセルのα値を乗算(`getImageData`/`putImageData`)、それ以外は黒/白の矩形を `1-fade` で重ねる。
   - 書き出し: 最後の `fadeOutDuration` 秒で `fade = 1 - (frame - fadeStart)/(total - fadeStart)`。

### 3.6 解像度の扱い
- プレビュー: 論理 1280×720。CSSで縮小表示。
- 書き出し: `VideoRecorder.export` が**キャンバスと全レイヤーのCanvasを一時的に書き出し解像度へリサイズ**(`LayerManager.resize`)し、終了時に戻す(720p/1080p/4K)。
- **px単位のパラメータは解像度に比例して拡大されない**(例: Noise Wave の `amplitude=120` は常に120px)。`width/height` を使って相対化しているジェネレーター(Dot Design 等)と、そうでないジェネレーターが混在。プレビューと書き出しで構図が変わる原因になるので、新規ジェネレーターは**寸法を `width/height` 基準で計算する**ことを推奨(§14.2)。
- 解像度変更時 `FeedbackTrail.resize` は no-op(履歴キャンバスを持たず `rawCanvas` 自身が履歴)。

---

## 4. ドメインモデル

### 4.1 Layer(`LayerManager.js` の `class Layer`)

| フィールド | 型 | 説明 |
|---|---|---|
| `id` | number | `LayerManager.nextId++` で採番。プロジェクト読込時は 1 から再採番 |
| `type` | string | ジェネレーター種別キー(§6.1)。**永続化・学習データ・Excel列の主キー** |
| `name` | string | 表示名(既定は `getDefaultName(type)`)。プリセット保存名の接頭辞になる |
| `visible`, `opacity`, `blendMode` | | 合成設定 |
| `generator` | BaseGenerator系 | 描画実体。`generator.params` が現在値 |
| `effects` | object | 共通FXの現在値(`getDefaultEffects()` のキー群、§5) |
| `modulations` | `{[paramName]: Modulation}` | **ジェネレーターパラメータ(type:range)と共通FX全部**の自動化状態(§4.3) |
| `rawCanvas`, `canvas` | HTMLCanvasElement | §3.4 |
| `feedbackHandler` | FeedbackTrail | 実質ステートレス |
| `randomSpread` | number | ランダマイザーの揺らぎ幅(%)。既定 30(旧データは 50) |
| `currentPresetName` | string | 適用中モーションプリセット名(§4.4) |
| `currentRenderOpacity` | number | `opacity × strobe` の直近計算結果(合成時に使用) |
| `lastSpawnCycleIndex` | number | Spawn Jitter 再抽選の検出用 |

主なメソッド: `applyModulations(time,duration)`, `update`, `draw`, `applyPreset(name)`, `resetToDefaults()`, `clearAllAutomation()`, `applySpawnJitter()/applySpawnJitterOne(name)`, `getRangeConfig(name)`, `resize(w,h)`。

`LayerManager`: `layers[]`, `addLayer(type)`, `removeLayer(id)`, `reorderLayers(old,new)`, `applyModulations`, `update`, `draw`, `resize`, `masterVignette`, `masterFilmGrain`。

**生成時の既定動作(重要)**: コンストラクタの最後で `applyPreset(getDefaultPresetName(type))` を呼ぶ。`applyPreset` は冒頭で `effects.glowIntensity = 15`、`rotation=0, scale=1, strobe=0` を**強制**した上でプリセットのLFOを有効化する。つまり**新規レイヤーは Dot Design なら rotation/scale のLFO(cosmic-spin)が最初から掛かっている**など、型ごとにデフォルトで動いている(§4.4)。検証・テスト時は予期せぬ回転/拡縮の原因になる。

### 4.2 Generator 契約(`BaseGenerator`)

```js
class BaseGenerator {
  constructor(params = {})            // this.params = { ...defaultParams(), ...params }
  defaultParams()  -> object          // 初期値(同時に「ダブルクリックでリセット」の既定値)
  getParameterConfig() -> Config[]    // UI/LFO/ランダマイザーが読む唯一のスキーマ
  update(time, frameCount, width, height)   // 任意。状態シミュレーション(粒子など)
  draw(ctx, width, height, time, globalParallax)  // 必須。ctx は透明にクリアされた(または減衰済み履歴入り)レイヤーCanvas
  reset()                             // 任意。巻き戻し/書き出し前の状態初期化
  getPatternParamNames() -> string[]  // 任意。「形状を決めるパラメータ」宣言(§6.4)
}
```

`Config` は3種:
- `{ name, label, type:'range', min, max, step }` → スライダー + LFO/キーフレーム/ジッター/ランダマイザーの対象
- `{ name, label, type:'color' }` → `<input type=color>`。LFO対象外。ランダマイザーは色相をランダム再抽選(`hsl(h, 85〜99, 45〜59)`)
- `{ name, label, type:'select', options:[{value,label}] }` → セレクト(現状 `Cube3D.shapeType` のみ)。LFO対象外

**スキーマ変更の影響範囲**: `getParameterConfig()` に `range` を足すと、`Layer.initModulations()` が自動で modulation を生成し、インスペクター・ランダマイザー・類似度計算・学習データに自動で乗る。**ただし** Excel の Move/Score 列・Parameter Ranges シート・`paramDescriptions.js` は手動/自動登録が別途必要(MANUAL §11.1)。

`createGenerator(type)` は `getParameterConfig` をラップし、`getGeneratorParamOverride(type, name)`(Excel由来)があれば min/max(/step)を差し替える。**生成器クラス内のスキーマ値はあくまで既定で、実効値はこの上書き後**。

**例外**: `ImageMotionGenerator` / `VideoMotionGenerator` は `BaseGenerator` を継承せず `constructor` で `this.params` を直接定義する(`defaultParams()` を持たない)。そのため `Layer.resetToDefaults()` や「ダブルクリックでデフォルトへ」は意図通り動かない場合がある。また画像/動画のデータURLは `params` に入れず別プロパティ(`imageDataUrl`/`videoDataUrl`)に保持している(`JSON.stringify` の巨大化・フリーズ回避)。

### 4.3 Modulation(自動化状態)

```jsonc
"modulations": {
  "<paramName>": {
    "enabled": false,          // LFO ON/OFF
    "min": 0, "max": 0,        // LFO の振れ幅(値域内)。LFO OFF時は現在値に追従
    "timePct": 50,             // 1周期が Duration に占める割合(%)。大きいほど遅い
    "behavior": "return",      // repeat | repeatReverse | return | one | oneReverse
    "keyframeEnabled": false,  // キーフレーム ON/OFF(LFOと排他)
    "keyframes": [ { "frame": 0, "value": 0.0, "easing": "linear" } ],
    "spawnJitter": false,      // 🎲 周期ごとの再抽選
    "jitterBase": 0.0,         // ジッター中心値(ユーザーが設定した値)
    "jitterWidth": 20          // 範囲の%(ノブのドラッグで変更)
  }
}
```

**評価規則(`Layer.applyModulations`, 毎フレーム)**:
1. `visible` でないレイヤーは評価しない(→ 非表示中は時間が進んでも値が変わらない)。
2. 各 `key` について:
   - `keyframeEnabled`: キーフレーム補間(下記)。キーフレームが0個なら `mod.min`、1個ならその値。
   - そうでなく `!enabled` → **その key は何もしない(`continue`)**。つまり手動スライダー値はそのまま保持される。
   - `enabled`: `cycle = duration × timePct/100`(秒)。`factor` を behavior で算出し `val = min + (max-min)·factor`。
3. `val` は `key in generator.params` なら generator へ、そうでなく `key in effects` なら effects へ書き込む(**同名キーはgenerator優先**)。実害のある例: 画像/動画ジェネレーターは `rotation` を自前の `params` に持つため、そのレイヤータイプでは共通FXの `rotation` は**LFO/キーフレームで駆動されず**、画像側の `rotation` が駆動される。しかも `initModulations` は生成器パラメータの後に FX を**無条件で上書き登録**するので、その `modulations.rotation` の範囲は FX 側(±360)になり、画像側スライダー(±180)と食い違う。同名キーを新設するときは衝突に注意(§14.2 に追記すべき設計上の落とし穴)。

**LFO behavior の factor**(`t`=秒):
| behavior | 式 |
|---|---|
| `one` | `min(1, t/cycle)`(一度上がって max で保持) |
| `oneReverse` | `max(0, 1 - t/cycle)` |
| `repeat` | `(t % cycle)/cycle`(ノコギリ波) |
| `repeatReverse` | `1 - (t % cycle)/cycle` |
| `return` | `phase=(t % 2cycle)/cycle; factor = phase<=1 ? phase : 2-phase`(三角波、往復) |

**キーフレーム補間**: 隣接キー間を線形補間し、`easing`(キー A 側の値)で `t` を変換。`linear / ease-in (t²) / ease-out (t(2-t)) / ease-in-out / step (t<1→0, 到達で1)`。範囲外は端の値で保持。`frame` は 60fps 換算フレーム。

**排他**: LFO ON ⇒ keyframeEnabled=false、keyframe ON ⇒ enabled=false(UIが強制)。ジッターは LFO/キーフレーム中の key には効かない。

**Spawn Jitter**: `target[name] = clamp(jitterBase + (rand·2-1)·range·(jitterWidth/100)·0.75)`。再抽選タイミングは §3.4 の `spawnCycleIndex` 変化時(`cycleDuration` を持つ生成器はその周期ごと、持たない生成器は **既定2000msごと**)。

### 4.4 モーションプリセット(`Layer.applyPreset`)
7種: `static-none, slow-evolution, pulsing-heart, cosmic-spin, hyper-strobe, growing-spiral, glitch-chaos`。いずれも**特定パラメータのLFOを固定値で有効化**する関数(例: `cosmic-spin` = rotation ±90°/timePct55 + scale 0.8–1.3/timePct30)。型→既定プリセット対応は `getDefaultPresetName`(例: geometry/dot-design→cosmic-spin、noise-glitch→glitch-chaos、lightning→hyper-strobe、cracked/magma-wall→static-none、その他→static-none)。`slow-evolution` は `frequency/amplitude` を持つ型でのみ効く(他では無害)。

### 4.5 パラメータ範囲のレジストリ
- 共通FX: `FX_PARAM_RANGES`(`fxParamRanges.js`)。`Controls.fxConfigs` が `...R.xxx` で展開して `label/type` を足す。`Layer.initModulations` も同じ表から min/max を取る。
- 起動時に `loadParamRangeOverrides()` が `GET /api/param-ranges`(失敗時 `/data/param_ranges.json`)を読み、**`FX_PARAM_RANGES` を直接ミューテート**して全コンシューマに反映。ジェネレーター側は `getGeneratorParamOverride` で参照。
- ソース・オブ・トゥルースの優先順位: **Excel(ParameterRanges.xlsx) > param_ranges.json(キャッシュ) > コード内の既定値**。

---

## 5. 共通FX仕様

### 5.1 パラメータ一覧(`FX_PARAM_RANGES` 現行値。Excelで上書きされうる)

| キー(UIラベル) | 範囲 / step | 既定 | 処理(要約) |
|---|---|---|---|
| `positionX/Y`(Position X/Y) | -1〜1 / 0.01 | 0 | 合成後の平行移動(キャンバス幅/高の割合) |
| `rotation`(Rotation) | -360〜360 / 1 | 0 | 中心回転 |
| `orbitRadius`(Orbit Radius) | 0〜800 / 1 | 0 | 回転後に+X方向へ平行移動 → rotation と組み合わせて**公転** |
| `scale`(Scale) | 0.1〜5 / 0.05 | 1 | 中心拡縮 |
| `strobe`(Strobe Speed) | 0〜30 / 0.5 | 0 | 矩形波で不透明度ON/OFF(Hz) |
| `glowIntensity`(Neon Glow) | 0〜100 / 1 | 0(新規レイヤーは preset適用で15) | `ctx.filter=blur(i px)` を `lighter` 合成。`mix=min(1, glowMix + i/100·0.4)`、`glowMix` 既定0.5(UI無し) |
| `feedbackDecay`(Motion Trails) | 0〜0.95 / 0.01 | 0 | 前フレームを `decay` 倍で減衰しつつ `feedbackScale`(1.002)・`feedbackRotate` で変形して残す |
| `feedbackRotate`(Trail Spin) | -0.05〜0.05 / 0.001 | 0.005 | 残像の回転(rad/フレーム) |
| `distortionIntensity`(Noise Warp) | 0〜40 / 1 | 0 | 水平スライス(4px)を `sin(y·freq + t·speed·0.02)·(i²/40)` px ずらす。`distortionFrequency`=0.008、`distortionSpeed`=1.5(UI無し) |
| `mirrorMode`(Mirror Mode) | 0〜13 / 1 | 0 | 0=OFF, 1=左右, 2=上下, 3=四分割(左上基準)。4〜13=放射N分割(6/8/12/16/20、奇数番は交互反転版)。`drawRadialWedgeCopies` で `zoom=1` 回転コピー |
| `chromaticOffset`(Chromatic Aberr) | 0〜30 / 0.5 | 0 | R/G/B を `multiply` で分離し ±`offset×1.6` px ずらして `lighter` 合成 |
| `hueRotate`(Hue Rotate) | -180〜180 / 1 | 0 | `ctx.filter=hue-rotate(deg)`。`color` をLFO対象にできない代わりの色相アニメ手段 |
| `rotateX/Y/Z`(Rotate X/Y/Z) | ±180 / 1 | 0 | §3.4 の疑似3D |
| `translateZ`(Depth Z) | -600〜600 / 5 | 0 | `scaleZ = 400/(400+z)` |
| `medianBlurIntensity` | 0〜100 | 0 | 低解像度化(8%/4.8%)して3×3/5×5メディアン |
| `embossIntensity` | 0〜100 | 0 | 3×3レリーフ核を低解像度(15%)で適用、原色と `strength` で混合 |
| `motionBlurIntensity` / `motionBlurAngle` | 0〜60 / 0〜360 | 0 | 角度方向に10サンプルのオフセット加算(蓄積バッファ法) |
| `radialBlurIntensity` | 0〜1 / 0.01 | 0 | 中心からのスケール違い10サンプル加算(ズームブラー) |
| `edgeDetectIntensity` | 0〜100 | 0 | Sobel。**αを勾配強度にしRGBは元色**=透明背景上の発光輪郭 |
| `pixelateBlockSize` | 0〜64 | 0 | `w/blockSize` に縮小→補間なしで拡大 |
| `posterizeLevels` | 0〜32 | 0 | 各チャンネルを N 段階にLUT量子化(50%解像度経由) |
| `solarizeThreshold` | 0〜255 | 0 | 閾値超のチャンネルを反転 |
| `spherizeIntensity` | 0〜100 | 0 | 魚眼バルジ(`r^k` で中心拡大) |
| `littlePlanetIntensity` | 0〜100 | 0 | 極座標ラップ(角度→X、半径→Y)を恒等写像とブレンド |
| `canvasTextureIntensity` / `paperTileIntensity` | 0〜100 | 0 | 50%グレーのタイルを `overlay` で重ねる(**元αでマスク**して透明部に出ないようにする) |
| `cartoonIntensity` | 0〜100 | 0 | 3×3ぼかし→ポスタライズ→Sobel輪郭で暗く(αは元のまま) |
| `oilifyIntensity` | 0〜100 | 0 | 近傍の最頻輝度ビンの平均色(半径1〜3) |
| `glassTileIntensity` | 0〜100 | 0 | 44px相当のタイルごとに局所バルジ+継ぎ目ハイライト |
| `seamlessTileIntensity` | 0〜100 | 0 | トーラスシフト+継ぎ目付近のみぼかし(シフト量も intensity に比例) |

実装共通の設計判断(`Effects.js` 冒頭コメントの要約):
- `getImageData/putImageData` は1080pで約14ms固定コストがあるため、画素処理系は `processAtLowRes`(縮小→処理→拡大)で面積を減らす。**「見た目の粗さ」はこの縮小率に依存**しており、仕様の一部。
- 近傍系(Median/Oilify)は `intensity` が上がるほど半径を増やし縮小率も下げて**総コストをほぼ一定**に保つ。
- 毎フレーム `document.createElement('canvas')` で一時Canvasを作る(GC負荷あり。§14.2)。

### 5.2 「OFF固定」FX(ランダマイザーが常に0にする)
`positionX/Y, strobe, distortionIntensity, mirrorMode, chromaticOffset, rotateY/Z, translateZ` と、**新設のスタイライズ系全部**(median〜seamlessTile, motionBlur*, radialBlur)。理由: 偶然では見た目が改善しにくく、人が意図して選ぶ演出だから(§8.3)。`orbitRadius`・`hueRotate` は switch に無く `default: continue`(=ランダマイザーは**触らない**。現在値のまま)。

### 5.3 削除済みのFX(混同注意)
- **Kaleidoscope**(`kaleidoscopeSegment`)は 2026-07-29 に削除。Mirror Mode の放射プリセットに統合。古い `.mvlayer`/`scores.json`/`move_scores.json` には `kaleidoscopeSegment` が残っているが、ロード時に `effects` へ未知キーとして入るだけで無害(§10.3)。
- `waterMirror`(旧名)→ `mirrorMode`。
- `Mosaic` / `Stepped Motion` を一時期検討・試作したが**現行コードには存在しない**(Mosaic相当は `pixelateBlockSize`)。

---

## 6. ジェネレーター仕様

### 6.1 カタログ(`type` キー → クラス)
`LayerManager.instantiateGenerator` の switch、`getDefaultName`、`index.html` の `<select>` が**3箇所で独立に**この一覧を持つ(§14.3)。

| type | クラス | 既定名 | 種別 | 要点 |
|---|---|---|---|---|
| `sine-wave` | SineWave | Sine Wave Layer | 純関数 | サイン波1本。`yOffset` で縦位置 |
| `noise-wave` | NoiseWave | Neon Horizon (Noise) | 純関数 | 2オクターブノイズの波。`roughness` |
| `particles` | Particles | Magic Sparks (Fireflies) | 状態蓄積 | ホタル。ノイズ場で操舵、粒子ごとに場へのオフセット(収束防止) |
| `geometry` | Geometry | Lissajous Orbit | 純関数 | リサージュ曲線400点 |
| `growing-sketch` | GrowingSketch | Sketch Growth | **周期** | 1周期分の枝経路を事前計算し `progress` 分だけ表示 |
| `rain` | Rain | Neon Rain | 状態蓄積 | 傾き `angle` の雨線 |
| `meteor` | Meteor | Meteor Shower | 状態蓄積 | テーパー尾+揺れ+頭部グロー |
| `ripple` | Ripple | Pulse Ripples | 状態蓄積 | ランダム位置に広がる円 |
| `spectrum` | Spectrum | Audio Spectrum | 状態蓄積 | **フェイク**(ノイズ+サインでバンド高さ生成) |
| `cube-3d` | Cube3D | Rotating Glowing Cube | 状態蓄積(角度) | `shapeType`: cube/正4・8・12・20面体/N角錐/N角柱/N双角錐/星型錐/トーラス。painter's algorithm(平均Zソート)、`fov=600, viewerDist=300` |
| `lightning` | Lightning | Neon Lightning | 状態蓄積 | 中点変位フラクタル+枝。`frequency` 秒ごとに発光→約12フレームで減衰 |
| `fog` | Fog | Neon Fog | 状態蓄積 | 放射グラデの「パフ」。**`density` 下限8**(低密度は輝度が運任せで不安定) |
| `flame` | Flame | Cyber Flame | 状態蓄積 | 粒子シェイプ12種、寿命で色が冷める |
| `snowflake` | Snowflake | Neon Snowflake | 状態蓄積 | `symmetry` 回対称の枝、擬似3D回転 |
| `spirograph` | Spirograph | Neon Spirograph | 状態蓄積(位相) | `R,r,d` ハイポトロコイド |
| `aurora` | Aurora | Aurora Curtain | 純関数 | ノイズで縦縞カーテン(線形グラデ) |
| `dry-ice` | DryIce | Dry Ice Smoke | 状態蓄積 | 落下する煙粒子(シェイプ12種) |
| `shape-3d-particles` | Shape3DParticles | 3D Shape Particles | 状態蓄積 | |
| `lighthouse` | Lighthouse | Lighthouse Beacon | 状態蓄積(角度) | 回転ビーム、霧ノイズ、遮蔽帯、色相サイクル |
| `shockwave-burst` | ShockwaveBurst | Shockwave Burst | **周期(1回展開)** | 収縮→保持→爆発の3相、デブリ、コアフラッシュ。両端フェードで透明 |
| `glass-crack` | GlassCrack | Glass Crack | **周期(1回展開)** | 放射ひび+微細ひび+ウェブリング、`holeRadius>0` で銃痕(三角ファン+フレーク) |
| `dot-design` | DotDesign | Dot Design | **周期** | 12モード(§6.5) |
| `noise-glitch` | NoiseGlitch | Noise Glitch | 状態(バーストタイマー) | 平常=薄い1本、確率でバースト(RGB分離帯+ブロック)。常時走査線 |
| `milky-way` | MilkyWay | Milky Way | 状態蓄積(火花) | 星場を一度ベイク→帯状マスクで再利用。雲ブロブ、火花 |
| `color-wash` | ColorWash | Color Wash | 純関数 | 全面HSL塗り。**レイヤー合成を `color` ブレンドにして下層を着色**する用途 |
| `cracked-wall` | CrackedWall | Cracked Wall | **周期** | 亀裂ネットワーク+ループするカメラ(§6.6) |
| `magma-wall` | MagmaWall | Magma Wall | **周期** | 同上、低速・太線・暖色のチューニング違い |
| `image` | ImageMotion | Image Layer (Motionizer) | 純関数 | 静止画。息づかい/浮遊/ケンバーンズ/視差/マスク |
| `video` | VideoMotion | (既定名は"Custom Layer") | 外部要素 | `<video>` をフレーム描画。`getDefaultName` に `video` の case が無い |

**種別の意味**
- **純関数**: `draw` が `time` だけから決まる。`update` 不要。一時停止中のスライダー操作でも見た目が即更新される。
- **状態蓄積**: `update()` で配列(粒子等)を進める。`reset()` 相当が無い型は書き出し前/巻き戻しでも**前回の粒子状態が残る**(`reset()` を実装するのは GrowingSketch / NoiseGlitch / ImageMotion / VideoMotion の4つだけ。周期型のShockwave/GlassCrack/DotDesign/Wall系は状態が `time` と周期インデックスから再構築されるため実害なし。Particles/Rain/Meteor/Ripple/Fog/Flame/Snowflake/DryIce/Shape3D/Lightning/MilkyWay/Cube3D/Spirograph/Lighthouse/Spectrum は**未実装=書き出し前でも前回状態を引きずる**)。
- **周期**: `cycleDuration`(ms)ごとに内部状態(乱数配置)を再生成し、`progress=(time % cycleDuration)/cycleDuration` で表示を決める。

### 6.2 周期型の規約(ループ素材の要)
`cycleDuration` を持つ生成器は、`Layer.draw` の Spawn Jitter 検出と**同じ式**(`floor(time/cycleDuration)`)で周期境界を共有する。実装パターン:

```js
const progress = (time % cycleDuration) / cycleDuration;   // 0→1
const cycleIndex = Math.floor(time / cycleDuration);
if (cycleIndex !== this.lastCycleIndex) { this.lastCycleIndex = cycleIndex; this.regenerate(); }  // 乱数を周期頭でまとめて確定
// one-shot(トランジション/カットイン)系はさらに envelope(fadeIn/fadeOut) を全アルファに掛け、envelope≈0 なら描画スキップ
```
- 書き出し Duration を `cycleDuration` と一致(または整数倍)にすれば継ぎ目なくループ。`cycleDuration` を Duration より短くすると周期ごとに繰り返す(意図的な柔軟性)。
- **`draw` へ Duration は渡されない**(`generator.draw(ctx,w,h,time,parallax)` のみ)。したがって「Duration に自動で合わせる」ことは生成器からはできず、ユーザーが `cycleDuration` を手で合わせる運用。
- 乱数は `Math.random()` で、**シード固定ではない**。毎周期・毎セッションで見た目が変わる(§13.1)。例外: Dot Design は `patternSeedX/Y` + ノイズ場でセル別の擬似乱数を作り、周期をまたいで同一(`cellRand`)。ただしそのノイズ場自体は `SimpleNoise` 構築時の `Math.random` で並び替えた順列なので**ページリロードで変わる**。
- `cycleDuration` の範囲は全生成器で 500〜20000ms/step100 に統一済み(2026-07-22)。

### 6.3 状態蓄積型の注意
- 粒子数の変更は「増やす=即追加、減らす=`dying` フラグでフェードアウト」(Snowflake/Shape3D/Fog)か「配列を切り詰める」(Particles/Rain)で挙動が違う。
- `rewindToStart()` は全レイヤーの `generator.reset()`(あれば)と `feedbackHandler.clear()` を呼ぶが、`reset` を実装していない状態蓄積型は粒子が残る。**再設計時は全生成器に `reset()` を必須化することを推奨**。

### 6.4 パターン再抽選フック `getPatternParamNames()`
「形状」を決めるパラメータ名の配列を返すと、インスペクターに **「🔀 Pattern」ボタン**が出て、そのパラメータだけを範囲内で一様乱数→`snapToStep` で再抽選する(色・速度・サイズ等のスタイルは不変)。宣言しているのは Dot Design(`patternMode, reverse, sweepAngle, symmetry, noiseScale, patternSeedX, patternSeedY`)と Cracked/Magma Wall(`seed, veinDensity, complexity, displace, branchChance, branchLength, hairlineCount, cameraPathMode`)。空配列ならボタン非表示。

### 6.5 Dot Design 仕様(最も複雑な生成器)
グリッド(`gridSize`=短辺方向の列数)の各セルを、`patternMode` に応じた判定で点灯。セルは `fillAmount`% の大きさの正方形/円(`dotShape`)。`progress` は `reverse` で反転(拡大⇔収束)。

| mode | 名称 | 判定(`dotDist` を 0〜1 に正規化し `edge = progress + jitter - dotDist >= 0` で点灯) |
|---|---|---|
| 0 | Radial | 中心からの距離 / 対角半径 |
| 1 | Sweep | `sweepAngle` 方向への射影 |
| 2 | Star Burst | 距離 / (半径×(0.65+0.35·cos(角度×symmetry)))=棘のある星形 |
| 3 | Arrow | 角度 `sweepAngle` 方向へ進むシェブロン(三角帯) |
| 4 | Noise Kaleidoscope | 角度を `symmetry` 分割の1ウェッジに折り畳んだ座標でノイズ→`threshold` 超で点灯(旧実装、後方互換) |
| 5 | Sequential Fill | 回転座標で「行(バンド)→行内位置」の順に埋める。正規化は**矩形の実半径**(`cx|sin|+cy|cos|`)を使う(対角線長だと行が潰れる既知バグの修正) |
| 6 | Ripple | `|progress - dotDist + jitter| < 0.1` のリング状のみ点灯(通過後は消える) |
| 7 | Random Sparkle | セルごとの固定 onset/持続(8〜22%)。立上り20%・減衰80% |
| 8 | Star | 五芒星の一筆書き(線分への距離 ≤ 線幅) |
| 9 | Alphabet | A〜Z の手書きストローク。`charSeed=|round(seedX·13+seedY·37)|` で文字を選ぶ |
| 10 | Roman Numeral | I〜X |
| 11 | Hieroglyph | アンク / ホルスの目 / ジェド柱 |

8〜11 は「ストローク折れ線を総延長×progress だけ描き進める」方式(`activeSegments`)。
`colorMode=1` は **選択色の色相・彩度を保ち、明度のみ `colorLightness` を中心に ±6/18/32 の6段階に量子化**したパレット(`buildRetroPalette`)から、セルごとの擬似乱数で色を選ぶ(同セルは常に同色)。

**色の落とし穴(再発防止)**: `adjustColorLightness(hex, l)` は **CSS文字列 `hsl(...)`** を返す。数値RGBが要る場面では `colorLightnessToRgb(hex, l)` を使う。`parseHexToRgb(adjustColorLightness(...))` は `#` 始まりでない文字列に対し**黙って白(255,255,255)を返す**ため、色が常に白になる(実際に Dot Design/Noise Glitch で発生した過去バグ)。

### 6.6 Cracked Wall / Magma Wall(共通ロジック `crackedWallShared.js`)
- 亀裂ネットワーク: 視野の1.6倍半径の仮想フィールドに、**幹**(`veinDensity`本、折れ点`complexity`、`displace`で屈曲、`branchChance`で分岐)と**ヘアライン**(`hairlineCount`本、短く細い)を散布。各線に「うごめき署名」(整数調波2つ・位相)を付与。
- 描画: `lighter` 合成でテーパー付きグロー線を塗り、`glowBoost`>0 なら幹だけ `shadowBlur` の芯グローを追加。
- **うごめき**: 各点を法線方向へ `sin(整数調波×2π·progress + 位相)` で変位。整数調波なので `progress=0` と `1` で完全一致=**継ぎ目なしループ**。
- **カメラ**(`computeCameraPose`): `cameraCycleDuration` 周期の閉曲線。`cameraPathMode` 0=Orbit(楕円周回) / 1=Sweep&Return(斜め往復) / 2=Slow Spiral Zoom(1周回転+呼吸ズーム)。全項が整数調波なので閉ループ。
- ネットワーク再生成キー(`geomKey`)は `cycleIndex|seed|サイズ|veinDensity|complexity|displace|branchChance|branchLength|hairlineCount`。**`seed` はジオメトリ再生成のトリガーとして使われるだけで、実際の乱数は `Math.random()`**(同じ seed でも毎回別のパターン)。真の再現性が欲しければ乱数源を差し替える必要がある(§14.2)。
- Cracked(高速・細線・赤)と Magma(低速・太線・橙)は**同一ロジックの別クラス**。ランダマイザー/Moveスコア/類似度が `layer.type` 単位で分離されるため、チューニング傾向の異なるものを1つの空間に混ぜない意図的設計。

### 6.7 Image / Video レイヤー
入力: ファイル選択、ウィンドウへの **ドラッグ&ドロップ**(画像・動画)、**クリップボード貼り付け**(画像・動画)。共通パラメータ:
`cycleDuration, breathAmount(拡縮の呼吸), floatAmount(浮遊px), autoPanZoom(ケンバーンズ), motionSpeed, parallaxDepth(マウス視差), opacity, scaleX/Y, posX/Y, rotation, maskSize` + 非rangeの `fitMode(contain|cover|fill|original)`、`maskShape(none|circle|ellipse)`。
Video 追加: `playbackSpeed, startOffset, loopMode(auto|once)`。動画は `muted/playsInline/autoplay`、`update()` で再生速度とオフセットを監視。**動画は `time` に同期せず実時間で再生される**ため、書き出し(オフライン高速/低速レンダリング)ではフレーム内容が時間と対応しない。**動画レイヤーを含む書き出しは再現性が無い**(既知の制約、§13.2)。
パララックスは `main.js` がマウス位置(または自動のゆるいLFO)から `globalParallax` を作り、`draw` の引数で渡す。

---

## 7. UI仕様(要点)

### 7.1 画面構成(`index.html`)
- **ヘッダ(transport)**: レイヤー評価バッジ(👍/👎/件数)、⏮ 巻き戻し、▶ Play/Pause、T.C(タイムコード表示)、Dur(秒、1〜120)、BG(Transparent/Black/Green/White)、P4444、Res(720p/1080p/4K)、FPS(30/60)、Fade(秒)、🎬 Export、プロジェクト選択+📂読込/💾上書き/💾+新規保存/📄新規、⬇⬆(`.mvproj` のローカル書出/読込)、📐 パラメータレンジ編集、📁 output / forSprite を開く、Sprite Studio/Viewer 起動。
- **プレビュー**(1280×720 Canvas、ドロップオーバーレイ、書き出し進捗オーバーレイ)。
- **キーフレームタイムライン**(Canvas)。
- **右パネル**: Layers(+Add、プリセットImport、レイヤー一覧)と Inspector(選択レイヤーの全設定)。Inspector は **別ウィンドウへ切り離し**(`↗️ Float`、`window.open` + 同一JS空間の参照共有)可能。

### 7.2 キーボード/マウス
- `Space`: 再生/一時停止。`Numpad .`: 先頭へ。入力欄フォーカス中は無効。
- タイムライン: キー選択時 `Delete/Backspace` で削除、`Ctrl+C` / `Ctrl+V` で単一キーのコピー(現在位置へ貼付、スナップ適用)。
- **スライダー**: ダブルクリックで既定値へリセット(`defaultParams()`/`getDefaultEffects()`)。数値表示のダブルクリックで直接入力(step にスナップ、範囲クランプ、Enter確定/Esc取消)。
- 🎲 ノブ: クリックでジッターON/OFF、**縦ドラッグで幅(0〜100%)**。🧬: LFO、🔑: キーフレーム(+Key で現在時刻に追加)。
- レイヤー一覧: `☰` ドラッグで並べ替え(UIは最前面が上=配列を逆順表示)、👁 表示切替、🗑 削除。

### 7.3 Inspector 構成(上から)
1. LFO Spread スライダー(10〜100%)+ **🎲 Random LFO** + (**🔀 Pattern**:対応生成器のみ)+ ↺ リセット + 📊 学習状況 + 📝 意見書エディタ + ⭐ 評価。
2. 画像/動画レイヤーの専用設定(ファイル、fit、mask、loop)。
3. **Batch Generator**(Count / Filter% / ウィザード起動)。
4. Motion Preset セレクト + 🧹 Clear All(自動化フラグ全解除。現在値は保持)。
5. Layer Compositing(Opacity、Blend Mode)。
6. Generator Parameters(`getParameterConfig()` 順)。
7. FX / Post-processing(`fxConfigs` 順)。

### 7.4 タイムラインの挙動(`initTimeline`)
横軸=フレーム(0〜Duration×60)、縦軸=パラメータ範囲。**ダブルクリックでキー追加**(ルーラー領域は不可)、ドラッグで移動、ルーラーのクリック/ドラッグで**シーク**(キーのヒット判定が優先: 値1.0のキーがルーラー境界に重なるため)。Snap: 横(off/1/5/10/15/30/60f)、縦(off/2/5/10/20/25/50 %)。Ease: linear/ease-in/ease-out/ease-in-out/step。Template: 内蔵(`motionTemplates.js`、2P〜10P、各 ×1/×0.5/×0.25)+ カスタム(`localStorage['motion_templates_custom']`、JSON Exp/Imp 可)。Copy/Paste(全キー)は貼付時に値を新パラメータの範囲へクランプ。

---

## 8. ランダマイザーと学習(教師モデル)

### 8.1 構成
1. **Random LFO(`Controls.randomizeLayer(layer, spreadPct)`)** — 現在値を「教師」として変異体を1つ生成し適用。
2. **評価(`rateLayer`)** — 1〜10 のレーティング+コメント+理由タグ+パラメータ別フラグを `POST /api/score` で `data/scores.json` に追記。
3. **学習への反映** — Bad回避リロール、Good引力、類似度計算、Move スコアによる自動化の抑制/促進。
4. **Batch Generator** — 手動フラグ駆動で変異体を一括生成→目視レビュー→採用分のみ書き出し/保存。
5. **意見書(Opinion Sheet)** — レイヤー×パラメータの Score/Move/Comment を人が編集(Excel↔JSON)。

### 8.2 変異の数式(`randomizeLayer`、`spread = spreadPct/100`)
- **試行**: 最大 **10回**生成し、ソフトスコア(後述)が最良のものを採用。早期終了条件 = `maxBadSimilarity < 0.90` かつ(Good評価なし or `maxGoodSimilarity >= 0.6`)。
- **生成器 range パラメータ**: `base = 現在値`(Good引力あり時は重心へ補間)→ `new = clamp(base + U(-1,1)·range·spread·0.75)` → `snapToStep`。`snapToStep` は整数ステップのパラメータに小数が入ると状態が壊れる(例: Growing Sketch の枝数)ことへの対策で**必須**。
- **color パラメータ**: 色相を一様ランダム、彩度 85〜99、明度 45〜59。
- **モジュレーション**(各 range パラメータ):
  - Move スコア ≤1 → LFO/キーフレーム無しの固定値。
  - 既にキーフレームあり → 各キー値を同じ式で揺らす(形状・イージングは維持)。
  - そうでなければ確率 `min(1, 0.3 + (Move>2 ? (Move-2)/3·0.6 : 0))`(`motion_too_fast` なら0)で**ランダムなモーションテンプレート**を適用(範囲の両端10%を除いた区間にスケール)。
  - LFO有効なら min/max を揺らし、`timePct` を ±15 揺らす。
  - それ以外は固定(`min=max=new`)。`motion_too_slow` の場合は範囲15%幅・timePct 20〜34 の軽LFOを強制付与。
- **Good引力**: `weight = 0.35 · min(1, Good件数/5)`。`base = base·(1-w) + centroid·w`。重心は評価の `rating`(なければ8)で重み付け、パラメータ別フラグ `bad`→除外、`good`→ `max(rating,9)`。LFOの振幅・速度も `weightedMotionCentroid` で引き寄せ。
- **共通FX**: §5.2 の OFF固定以外は `fxRandomizerRules.js` の個別関数(`rotation`: 15%で1〜2回転のキーフレーム / `scale`: 下限1.0で小さな揺らぎ・遅いLFO / `glowIntensity`: 下限40 / `feedbackDecay`: 0.70〜0.92(上限0.92は暴走防止ハードキャップ)/ `feedbackRotate`: 20%だけ非0 / `rotateX`: 30%で±15°の遅いLFO)。

### 8.3 理由タグによる動的制約(👎評価時に選択、同レイヤータイプの過去Badに1つでも含まれれば発動)
`nothing_visible`(個数/サイズ下限+30%、明度≥40、scale≥1.2、glow≥60)/ `noise_warp_excess` / `strobe_excess` / `scale_too_small`・`scale_too_large` / `aspect_break`(回転時 scale≥√2)/ `too_simple` / `too_chaotic`(glow≤80、feedbackDecay≤0.85)/ `color_monotonous`(色相を直前から90°以上離す、20回までリロール)/ `motion_too_fast`(テンプレート停止、timePct≥55)/ `motion_too_slow`(テンプレート確率+30%、timePct≤35)。(UIの選択肢に出るタグは `showRatingDialog` で定義。`noise_warp_excess`・`strobe_excess` は `randomizeLayer` 内でフラグ変数(`hasNoiseWarpExcess`/`hasStrobeExcess`)が算出されるだけで**現行コードでは未使用**。両FXは §5.2 のとおり常にOFF固定なので実害は無いが、CLAUDE.md の「Noise Warp 上限12.0にクランプ」等の記述は現行コードと一致しない。再設計時はタグ体系ごと見直す価値がある。)

### 8.4 類似度(`calculateStatesSimilarity`、1.0=同一)
全 range パラメータと全共通FXについて `w·(0.65·|正規化値差| + 0.35·motionFeatureDist)` の重み付き平均を 1 から引く。color は色相の円環距離。
- `w` = 色/hue系 ×2.2、物量系(count/density/…)×1.6、Move スコア ×(0.6 + Move/5)、`paramFlags`: bad ×3 / good ×0.3。
- `getMotionFeatures(mod)` → `{animated, amplitude, speed}`(LFO: 振れ幅/範囲、`1-(timePct-1)/99`。キーフレーム: 値の幅/範囲、キー間隔)。
- ランダマイザーのスコア = `maxGoodSimilarity(なければ0) - maxBadSimilarity`。バッチ生成の多様性フィルタも同じ関数を使う(`threshold`% 以上似ていたら最大20回リロール)。

### 8.5 Batch Generator ウィザード
別ウィンドウ(`MovieCreatorBatchGenerator`、プレビューを隠さないためオーバーレイでなくポップアップ)。Step1: 対象プリセット選択(または現レイヤー)→ Step2: パラメータごとに **Random(ジッター) / LFO / KeyFrame** をトグル、Count/Filter 設定 → Step3: 候補を1件ずつプレビューし採用/不採用/評価 → 採用分だけを**透明WebMで連続書き出し**、または `autoSaveCandidateAsPreset`(`<名前> Batch <ISO日時> v<N>.mvlayer`)で保存。適用優先順位は **KeyFrame > LFO > Random > 固定**(1パラメータは1つの変化様式のみ)。

### 8.6 意見書(Opinion Sheet)と Move スコア
- `Excels/PresetLayerOpinionSheet.xlsx` シート `Preset Layers Opinion Sheet`: **行3(0始まり2)の D列から3列おき**にレイヤー表示名、各レイヤーに `Score / Move / Comment` の3列。行5以降が各パラメータ(A列=`---` で始まる行はカテゴリ見出しとして無視、B列=パラメータ名、C列=ラベル)。セルが文字列 `-` は「このレイヤーに該当しない」、空欄は「未評価」。
- 保存(`POST /api/opinion-sheet`)で xlsx 書き戻し **と** `data/move_scores.json`(`{layerType:{paramName:move}}`)を同時再生成。`export_move_scores.py` と同ロジックのNode移植。
- **新ジェネレーターの自動登録**: `GET /api/opinion-sheet?layer=<type>&displayName=..&params=[..]` で未登録なら列を末尾に追加し、表示名↔type を `data/opinion_sheet_layer_map.json` に保存。
- **既知の制約**: SheetJS無料版は書式を完全保持できず、保存のたびに色・列幅が簡略化される(許容済み。データは保たれる)。`XLSX.writeFile` に `{compression:true}` が無いと容量が約7倍に膨らむ。

---

## 9. 書き出し(`VideoRecorder`)

### 9.1 共通
`export(options)`: 解像度を一時変更 → `totalFrames = duration·fps` → 全レイヤー `generator.reset()` + `feedbackHandler.clear()` → フレームループ → 解像度復元 → `onComplete`。ループ内は §3.3(`applyModulations` → `update` → `draw` → `VideoFrame` → `encode`)。キーフレームは **2秒間隔** (`frame % (fps*2) === 0`)。プレビューは一時停止され、`isRecording` が `tick` を止める。

### 9.2 方式
| BG | 経路 | コーデック | 備考 |
|---|---|---|---|
| `black/white/green` | `exportMP4` | H.264(`avc1.640028`→`4d0028`→`42E01E` の順に `isConfigSupported` で選択)、12Mbps、`latencyMode:'realtime'`、`hardwareAcceleration:'prefer-hardware'` | `mp4-muxer`、`fastStart:'in-memory'`。**`encodeQueueSize > 4` の間 `setTimeout(0)` で待つ**(realtime モードがキュー過多でフレームを黙って落とすのを防ぐ。オフライン書き出しでは1フレームも落とせないため) |
| `transparent` | `exportWebMAlpha` | VP9(`vp09.00.10.08`、`alpha:'keep'`)、12Mbps | `webm-muxer`(`alpha:true`)。事前に `isConfigSupported` でチェックし非対応ならアラートして中止 |
| H.264非対応 | `exportWebMFallback` | MediaRecorder(vp9/vp8/webm) | **実時間かかる**(`setTimeout(frameInterval)`)。フレーム精度は保証されない |
| +P4444 | 上記WebM出力後に `transcodeToProRes` | ffmpeg `prores_ks -profile:v 4444 -pix_fmt yuva444p10le -vendor apl0` | `POST /api/transcode-prores`。WebM 出力自体は成功扱いのまま残る |

### 9.3 保存先
`saveOrDownloadBlob`: まず `POST /api/save-export?filename=` でサーバーが `output/` へ直接保存(PC/ブラウザ設定に依存しない集約)。失敗時のみ `<a download>` にフォールバック(URL は30秒後に revoke。巨大ファイルで即 revoke すると Firefox 等でダウンロードが死ぬため)。
ファイル名: **最前面(`layers` 配列の末尾の visible)レイヤー名 + `_YYYYMMDD_HHMMSS`**(`buildExportFilename`)。バッチ書き出しは `MovieCreator_Batch_<type>_var<N>_<timestamp>`。サーバー側で `getSafeFilename` により禁止文字を `_` に置換。

### 9.4 フェードアウト
`fadeOutDuration`(秒)。透過は α 乗算、不透明は黒/白の重ね塗り(`LayerManager.draw`)。`fadeStart = total - fadeOut·fps`。

---

## 10. 永続化フォーマット

### 10.1 プロジェクト `*.mvproj`(`projects/`、JSON)
```jsonc
{
  "version": "1.0",
  "master": { "duration": 10, "bgMode": "black", "fadeOut": 0, "vignette": 0.3, "grain": 0.03 },
  "layers": [ {
    "type": "dot-design", "name": "...", "visible": true, "opacity": 1, "blendMode": "lighter",
    "randomSpread": 30, "currentPresetName": "cosmic-spin",
    "imageDataUrl": "data:..."?, "videoDataUrl": "blob:..."?,   // image/video のみ
    "params": { /* generator.params 全部 */ },
    "effects": { /* layer.effects 全部 */ },
    "modulations": { /* §4.3 の全キー */ }
  } ]
}
```
読込: 既存レイヤーを全削除 → `addLayer(type)` → `params/effects` を**スプレッドで上書き**(未知キーも保持、足りないキーは新規既定で補完)→ modulations を**既存キーのみ**に対して手動コピー(`jitterBase` は存在すれば)。**後方互換はこの「上書きマージ」で担保**されており、スキーマ変更時は「新キー追加=安全 / キー削除・改名=古いデータに孤児が残る」。

### 10.2 レイヤープリセット `*.mvlayer`(`presets/`)
```jsonc
{ "version": "1.0", "type": "movie-creator-layer-preset",
  "layer": { "type", "name", "opacity", "blendMode", "randomSpread", "currentPresetName",
             "imageDataUrl"?, "videoDataUrl"?, "params", "effects", "modulations" } }
```
命名規約: `<getDefaultName(type)><連番2桁><任意の接尾辞>.mvlayer`(`suggestNextPresetName` が次番号を提案)。Import UI は `Controls.PRESET_GROUP_PREFIXES`(= `getDefaultName` の戻り値群を長い順に並べたもの)でグルーピングするため、**新ジェネレーター追加時はこのリストにも名前を足す**(忘れると「その他」扱い)。Import 時の名前は `"<name> (Imported)"`、バッチ用読込は `"(Batch)"`。

### 10.3 後方互換の実例
`kaleidoscopeSegment`(削除)、`waterMirror`(改名)、`lfoEnabled/lfoType/...`(誤フィールド)が古い `scores.json` や `.mvlayer` に残る。読込側が「未知キーを無視/保持」するので壊れないが、**類似度計算は現在の `fxConfigs` だけを走査する**ので孤児キーは学習に寄与しない。

### 10.4 評価データ `data/scores.json`(JSON配列、追記のみ)
```jsonc
{ "id": "<Date.now()><rand>", "timestamp": "ISO", "layerType": "noise-wave",
  "params": {...}, "effects": {...},
  "modulations": { "<name>": { "enabled","min","max","timePct","behavior","keyframeEnabled","keyframes" } },
  "score": "good|bad|neutral",   // rating>=7 good / <=4 bad / 5-6 neutral
  "rating": 1-10, "comment": "", "reasons": ["too_simple", ...], "paramFlags": { "<name>": "good|bad" } }
```
- `score`(バケット)と `rating`(数値)の二重持ち: 旧データは `score` のみ(重み8扱い)。
- 現在 約690件。肥大化するため読み書き性能に注意。サーバーは破損時 `data/scores.corrupted-*.json` へ退避して復旧(`loadScoresWithFallback`)。**git追跡対象**(教師データを他PCと共有するため)で、`*.corrupted-*` のみ除外。
- **既知の弱点**: 全件読込→配列追記→全件書込(排他制御なし)。同時書込・巨大化に弱い。

### 10.5 `data/move_scores.json`
`{ "<layerType>": { "<paramName>": 0-5, ... } }`(共通FX名も同じマップに入る)。起動時 `Controls.loadMoveScores` が `fetch('/data/move_scores.json')`(Vite静的配信)で取得(`/api` ではない)。`motion_mapping.json` は 2026-07-22 に廃止(Excel「Motion Mapping」シートの手入力方式を撤回)。

### 10.6 `data/param_ranges.json` と `Excels/ParameterRanges.xlsx`
JSON: `{ "generatorParams": { "<type>": { "<param>": {min,max,step} } }, "fxParams": { "<param>": {min,max,step} } }`。
Excel: シート `Generator Params`(列: type, paramName, label, **step**, **min**, **max**, …参考列)、`Common FX Params`(列: paramName, label, **step**, **min**, **max**, …)。`GET /api/param-ranges` は**毎回Excelを再読込してJSONを再生成**(Excelを編集して保存→ページリロードで反映)。`?detail=1` は編集UI用の全行(label/step付)。`POST` は検証(`min<max`、`step>0`)の上、**保存前に `.bak` を作成**(過去にこのファイルが反復読み書きで破損し「修復」ダイアログが出た経緯への安全網)。Excel破損時は `.bak` へフォールバック、それも無ければ `node scripts/seed_param_ranges.mjs` での再生成を促す。

### 10.7 範囲の焼き込みタイミング(落とし穴)
`Layer.initModulations()` はレイヤー構築時に `mod.min/max` を設定値から**1回だけ**コピーする。後から範囲が変わっても既存レイヤーの modulation には反映されない。そのため範囲を変更する経路は**必ず再同期が必要**で、パラメータレンジ編集UIの保存後は `Controls.refreshParamRangesLive()` が (1) `loadParamRangeOverrides()` を再実行、(2) `Controls.fxConfigs` の min/max/step を `FX_PARAM_RANGES` から再コピー(`fxConfigs` は構築時のスナップショットで、`FX_PARAM_RANGES` へのライブ参照ではない)、(3) 全レイヤーの全 modulation の min/max を更新し、現在値を新範囲へクランプ、(4) Inspector再構築、を行う。起動時は `main.js` が先に上書きをロードすることで同じ問題を回避している。**範囲を扱う新機能を足すときはこの3つ(FX_PARAM_RANGES / fxConfigs / modulations)の同期を忘れないこと**。

### 10.8 ブラウザ内ストレージ
`localStorage['motion_templates_custom']` のみ(カスタムキーフレーム形状)。他の状態は保持しない(リロードでレイヤーは初期デモに戻る)。**自動保存は無い**。

---

## 11. サーバーAPI(開発サーバー専用 `src/server/apiHandler.js`)

共通: 認証・CORS・レート制限なし(ローカル開発前提)。`/api/` 以外は素通し。起動時に `projects/ presets/ data/ output/ forSprite/` を自動作成、`data/scores.json` が無ければ `[]` を作る。ファイル名は `getSafeFilename`(禁止文字 `\ / : * ? " < > |` を `_`、制御文字除去、空なら `<prefix>_<時刻>`)と `path.basename` でトラバーサル防止。

| メソッド/パス | 入力 | 出力 | 用途 |
|---|---|---|---|
| `GET /api/files` | - | `{projects:[...], presets:[...]}` | 一覧(拡張子で絞り込み) |
| `POST /api/save` | `{type:'project'|'preset', name, data}` | `{success, file}` | `.mvproj`/`.mvlayer` 保存(整形JSON) |
| `GET /api/load?type=&file=` | | JSON本体 | 読込(404/400) |
| `POST /api/score` | `{layerType, params, effects, modulations, score, reasons, rating, comment, paramFlags}` | `{success, record}` | 評価追記 |
| `GET /api/scores` | | 配列 | 全評価 |
| `GET/POST /api/opinion-sheet` | `?layer=` / `{layerType, updates:[{row,score,move,comment}]}` | rows / `{success}` | §8.6 |
| `GET/POST /api/param-ranges` | `?detail=1` / `{generatorUpdates, fxUpdates}` | §10.6 | 範囲上書き |
| `POST /api/transcode-prores?filename=` | WebMバイナリ | `video/quicktime` | ffmpeg変換(`tools/ffmpeg/ffmpeg.exe` → PATH) |
| `POST /api/save-export?filename=` | バイナリ | `{success, file, path}` | `output/` 保存 |
| `POST /api/open-folder?target=output|forSprite` | | `{success}` | OSのファイラ起動(win=`explorer.exe`/mac=`open`/他=`xdg-open`) |
| `POST /api/open-sprite-studio` / `open-sprite-viewer` | | | `.bat` を `cmd.exe /c` でデタッチ起動(無ければ HTML を直接開く) |
| `POST /api/save-sprite-project` | `{filenameBase, config, pngDataUrl, plistText, jsonText}` | `{savedFiles}` | `forSprite/` へ一括保存 |
| `GET /api/forsprite-files` | | `{projects[], allFiles}` | `forSprite/` をベース名でグルーピング |
| `GET /api/load-forsprite-file?file=` | | 拡張子別 Content-Type | |
| `POST /api/save-sprite-export` | `{filenameBase, ext, dataContent, isBase64}` | `{savedFile}` | 単体書込 |

### 11.3 本番ビルドでの劣化挙動
`/api/*` が 404 になるため: プロジェクト/プリセットのサーバー保存・評価・意見書・ProRes は不可。書き出しは `<a download>` フォールバック、`param_ranges.json` は同梱静的ファイル、`move_scores.json` は静的取得で動く。**再設計で本番ホスティングを目指すなら §14.5 の「ストレージ抽象化」が必須**。

---

## 12. 周辺ツール

| ツール | 起動 | 概要 |
|---|---|---|
| Pipeline GUI | `run_pipeline_gui.bat` / `scripts/pipeline_gui.py` | tkinter。Web UI起動、パッケージ生成、SNS Autopilot、Webhookサーバー、config編集を一括操作・ログ監視 |
| 販売パッケージ | `scripts/package_builder.py` | `exports/` の動画からサムネイル、商用ライセンス(JP/EN)、`MovieCreator_AssetPack.zip` を生成 |
| SNS Autopilot | `scripts/sns_autopilot.py` + `server_bot.py` | 動画をランダム選択→5秒プレビュー→Gemini等でPR文生成→LINE Flexで承認→承認時にtweepyでX投稿 |
| Video Mixer | `run_video_mixer.bat` / `scripts/video_mixer.py` | tkinter+OpenCV。複数動画の黒抜き合成、フィルタ、速度、**ランダム量産**(無音MP4) |
| Sprite Studio | `open_sprite_studio.bat` → `/tools/mp4_to_sprite/index.html` | MP4→透過スプライトシート(PNG + Cocos `.plist` + Unity `.json`)。`INTEGRATION_GUIDE.md` あり |
| Sprite Viewer | `open_sprite_viewer.bat` | `forSprite/` 成果物の再生ビューア |
| 変換スクリプト | `export_move_scores.py`, `export_param_ranges.py`, `scripts/seed_param_ranges.mjs` | Excel→JSON(アプリ内APIが同等処理を持つため手動実行は不要になった)。seedは `ParameterRanges.xlsx` の初期生成 |

秘匿情報: `scripts/config.json`(APIキー類)。`config.example.json` を雛形に各PCで作成。**再設計時もこのファイルはgit管理に載せない**。

---

## 13. 品質特性・制約

### 13.1 再現性(決定性)
- **ビット再現不可**。乱数は全面的に `Math.random()`(生成器の粒子/ひび/パターン、Film Grain、ペーパーテクスチャのタイル生成など)。`SimpleNoise` の順列も構築時に `Math.random()` で決まる。
- 同じ `.mvlayer` を開いても、状態蓄積型・乱数配置型は毎回違うフレームになる(**パラメータは再現するが映像は再現しない**)。
- 周期型でも周期ごとに乱数が引き直されるため、Duration が `cycleDuration` の数倍だと周期ごとに見た目が変わる(これは仕様)。
- 検証時の落とし穴: マスター Film Grain(0.03)が毎フレーム別ノイズを描くため、フレーム同一性比較には `layerManager.masterFilmGrain = 0` が必要。

### 13.2 性能
- 重い処理: 画素系FX(§5.1)、`Glow`(`filter: blur`)、Milky Way(星場ベイクは `starDensity/size/color` 変更時のみ再生成)、`Distortion`(スライス数=h/4回の `drawImage`)。
- 毎フレーム `createElement('canvas')` が各FXで発生(GC)。4K書き出しは特に重い。メモリリーク監視(CLAUDE.md の保守指針)。
- 書き出しは `await setTimeout(0)` でUIスレッドを譲りつつ実行。実時間より遅い/速いは負荷次第(オフライン)。ただし**動画レイヤーは例外**(§6.7)。

### 13.3 セキュリティ
- ローカル開発サーバー前提で**無認証**。`/api/open-folder`・`.bat` 起動・ffmpeg 実行・任意ファイル書込(`output/` `forSprite/` `presets/` `projects/` 配下に限定、basename強制)を持つため、**LAN公開/本番公開してはならない**(`vite --host` 禁止)。
- `scripts/config.json` に各種APIキー。コミット禁止。

### 13.4 ブラウザ互換
Chromium必須(WebCodecs)。Safari/Firefox は書き出しの一部が不可。`ctx.filter`(blur, hue-rotate)・`roundRect` を使用。

---

## 14. 編集・再設計のための指針

### 14.1 守るべき不変条件(変えると既存資産が壊れる)
1. **`layer.type` の文字列キー**: `.mvlayer/.mvproj`、`scores.json`、`move_scores.json`、`param_ranges.json`、Excel列、プリセット名接頭辞の主キー。改名は全部の移行が必要。
2. **パラメータ名**(`params`/`effects` のキー): 同上。改名するなら読込時マイグレーションを書く。
3. **周期型のループ契約**: `progress=(time % cycleDuration)/cycleDuration` が閉曲線(0と1で同一)であること。一方向の累積状態を持ち込むとループが壊れる。
4. **FXの適用順**(§3.4)と `rawCanvas`(フィードバックはFX前)/`canvas`(FX後)の分離: Glow/Distortion がフィードバックに食われて発散するのを防いでいる。
5. **LFOとキーフレームの排他**、**`applyModulations` が毎フレーム値を上書きする**こと(手動スライダーは modulation OFF 時のみ有効)。
6. **`getParameterConfig()` が唯一のスキーマ**であること(UI/学習/LFOが全部これを読む)。生成器内に別系統のパラメータ定義を持たない。
7. 教師データの互換: `scores.json` の `params/effects/modulations` スキーマ。古いレコードを読んで類似度計算できること。

### 14.2 技術的負債と推奨リファクタ(優先度順)

| # | 問題 | 影響 | 推奨 |
|---|---|---|---|
| 1 | **`Controls.js` 5.9k行のモノリス**(UI・タイムライン・ランダマイザー・類似度・評価・ダイアログ・API呼出・Float窓が同居)。`this.xxxEl` で index.html の id に直結 | 変更の波及が読めない。UI差し替え不能 | `RandomizerService`(`randomizeLayer/similarity/getMotionFeatures`)、`TimelineView`、`InspectorView`、`ProjectStore(api)`、`Dialogs` に分割。まず**純ロジック(randomize/similarity)をDOM非依存に切り出す**のが最も効く |
| 2 | **レイヤー直列化の重複**(`apiSaveProject/apiSaveProjectQuick/localExportProject/apiExportLayer/autoSaveCandidateAsPreset` と、読込側 `apiLoadProject/localImportProject/apiImportLayer/createLayerFromPresetFile` で同じコピーが5〜4箇所) | 片方だけ直して不整合(実際に `videoDataUrl` が一部経路で欠落) | `Layer.toJSON()` / `Layer.fromJSON()` を `LayerManager.js` に1つ作り全経路から呼ぶ |
| 3 | **レイヤー種別の列挙が分散**: `index.html`、`instantiateGenerator`、`getDefaultName`、`getDefaultPresetName`、`Controls.PRESET_GROUP_PREFIXES`、`apiHandler.LAYER_NAME_TO_TYPE`(+自動登録マップ)、`export_move_scores.py`(`LAYER_NAME_TO_TYPE`、手動同期)、`scripts/seed_param_ranges.mjs`(`TYPE_TO_CLASS`、27種=image/video を除く)、`paramDescriptions.js`、Excel | 追加時に1つ忘れると**サイレントに壊れる**(例: `video` は `getDefaultName` に無く「Custom Layer」) | `GeneratorRegistry`(`{type, class, displayName, defaultPreset, group}` の配列)を1ファイルに作り、UI/サーバー/変換スクリプトは生成物か実行時インポートで参照 |
| 3b | 画像/動画ジェネレーターが `BaseGenerator` 非継承 | `reset/defaultParams` 非対応 | 継承させ、データURLは `serialize()/hydrate()` フックで扱う |
| 4 | **乱数が非シード**(§13.1) | 同じプリセットが再現しない。バグ再現/回帰テスト不能 | `Math.random` を差し替え可能な `rng`(mulberry32等)に集約し、レイヤーに `seed` を持たせ、書き出し時に固定。`SimpleNoise` も seed 由来に |
| 5 | **解像度非依存でないpx値**(§3.6) | プレビューと書き出しで構図が変わる | 寸法パラメータを「画面高さ比」単位にするか、描画前に `ctx.scale(w/1280, h/720)` で論理座標系を固定(最も安全) |
| 6 | **状態蓄積型の `reset()` 欠落**(§6.3)と `renderSingleFrame` が `update` を呼ばない | 一時停止中に粒子が更新されない/書き出し前に状態が残る | 契約に `reset()` を必須化。`update` の副作用を時間引数の純関数化(可能な型から) |
| 7 | **一時Canvasの毎フレーム生成**(各FX) | GC/4K負荷 | プール化(同サイズ再利用) |
| 8 | **開発サーバー専用API**に永続化が集中 | 本番デプロイ・他環境で保存不能 | `Storage` インターフェース(`saveProject/loadProject/listPresets/appendScore/...`)を定義し、`ApiStorage`(現行)/`FileSystemAccessStorage`/`IndexedDBStorage` を差し替え可能に |
| 9 | `scores.json` が全件読書・排他なし・肥大 | 破損・遅延 | JSON Lines 追記 or SQLite。読込時にスキーマバージョンを付与 |
| 10 | `Math.random` 由来のモジュレーション再抽選 `applySpawnJitter` が `cycleDuration||2000` で全生成器に発火 | 周期の無い生成器でも2秒ごとに値が動く(意図しない場合あり) | `cycleDuration` 未定義なら発火しない、を既定に |
| 11 | `masterVignette/FilmGrain` がUI無し・`Math.random` | 書き出しごとにノイズが違う、調整不可 | UI追加+シード化 |
| 12 | 型安全なし(JS)・テスト無し | 回帰検知不能 | JSDoc型 or TypeScript化、`Effects.js`(純関数)と `randomize/similarity` から単体テスト |

### 14.3 UI/DOM結合の地図(UI差し替え時の注意)
`Controls` のコンストラクタが取得する id: `layers-list, btn-add-layer, layer-selector-container, layer-type-select, btn-confirm-add-layer, inspector-layer-name, inspector-content, layer-status-*, btn-play-pause, btn-rewind-start, btn-export, export-duration, export-bg, export-prores, export-resolution, export-fps, master-fade-out, project-select, btn-api-*, btn-project-new, btn-local-*, input-local-import-project, timeline-*, key-precise-*, btn-key-*, preset-picker-*, preset-select(非表示のselectが「選択ファイル」の唯一の状態), btn-api-import-layer, btn-api-export-layer-inspector, btn-detach-inspector`。`main.js` も `export-duration/export-bg/preview-canvas/recording-*/btn-timecode-toggle` を直接参照。Float化したInspectorは**別ウィンドウのDocument**に要素を作るため、`createElement` は `this.activeDocument` 経由で生成する決まり(`document.createElement` を直書きするとFloat時に壊れる箇所がある)。

### 14.4 ドキュメントとコードの既知の乖離(CLAUDE.md を読む際の注意)
- Kaleidoscope/Water Mirror/Mosaic/Stepped Motion の記述は**現行コードには無い**(§5.3)。
- 「`GlassCrack` と `fractalLine.js` を共有」→ 現在は独自 `buildShardLine`。`fractalLine.js` は Lightning のみ。
- `Excel「Motion Mapping」連携` は廃止済み。
- 自宅PCのパス `Z:\MovieCreator` 表記が残る箇所あり(`AGENTS.md` 等)。パスは環境依存で、コードは相対解決している。

### 14.5 別基盤で再実装する場合の最小コア仕様
資産(プリセット/教師データ)を活かす最小互換セット:
1. **データモデル**: §4 の Layer/Generator/Modulation と §10.1〜10.5 のJSON。ここが互換なら既存 `presets/` 178個・`scores.json` 690件がそのまま使える。
2. **評価関数**: §4.3 の `applyModulations`(LFO5種+キーフレーム5イージング)と §3.4 のレイヤー描画順・FX順。
3. **周期型ループ契約**(§6.2)と、Duration=`cycleDuration` で閉じること。
4. **ランダマイザー**(§8.2〜8.4)は、`getParameterConfig` 相当のスキーマ+`scores.json` だけから再実装可能(純粋関数化しやすい)。
5. **書き出し**: 「決定的な時刻列でフレームを生成→エンコード」(§9)。透過は VP9 alpha / ProRes 4444 が販売要件。
任意(後回し可): Float窓、Batchウィザード、Opinion Sheet、スプライトツール、SNS自動化。

### 14.6 再設計の方向性メモ(提案、未実装)
- **レンダリングをWebGL/WebGPU化**: 現行Canvas2Dは画素系FXが低解像度経由の近似。シェーダーなら本来の解像度で安価に実現でき、毎フレームCanvas生成も不要。ただし Generators の描画(パス描画・グラデ・shadowBlur)の移植コストが大きいので、**FXだけ先にGPU化**し、ジェネレーターは Canvas2D のまま `texImage2D` で取り込むのが現実的。
- **シーングラフの宣言化**: 生成器を `{params schema, draw}` の純データ+関数に寄せ、UIはスキーマから自動生成(現状も `getParameterConfig` が近いので延長線上)。
- **Worker/OffscreenCanvas**で書き出しを別スレッド化(プレビューを止めない)。
- 「秩序化FX」(対称/量子化/整列)を増やす方向が運用上の評価が高い(Mirror Mode が有用だったが単調化したため別ベクトルが求められている、というのが直近のフィードバック)。

---

## 付録A. 用語集
| 用語 | 意味 |
|---|---|
| ジェネレーター | `type` ごとの描画クラス。レイヤーの中身 |
| 共通FX | 全レイヤー共通のポストプロセス/トランスフォーム(`layer.effects`) |
| モジュレーション | パラメータの時間変化(LFO/キーフレーム/ジッター) |
| LFO | 周期的な往復/ノコギリ波などでパラメータを動かす仕組み。`timePct` は Duration に対する周期の割合 |
| Spread | ランダマイザーの揺らぎ幅(%) |
| Good引力 | 高評価パラメータの重み付き平均へ変異中心を寄せる処理 |
| Move スコア | 「そのパラメータを動かすと良いか」の人手評価(0〜5) |
| 教師データ | `data/scores.json`(評価履歴) |
| 周期型 / 純関数 / 状態蓄積型 | §6.1 参照 |
| Pattern 再抽選 | §6.4 |
| 透過WebM / P4444 | VP9 alpha / ProRes 4444(アルファ付き)。販売素材の主形式 |

## 付録B. ファイル別行数(2026-10-04)
`Controls.js` 5897 / `Generators.js` 4266 / `apiHandler.js` 1311 / `Effects.js` 1105 / `LayerManager.js` 975 / `VideoRecorder.js` 488 / `paramDescriptions.js` 344 / `fxRandomizerRules.js` 332 / `VideoMotionGenerator.js` 306 / `main.js` 306 / `particleShapes.js` 280 / `ImageMotionGenerator.js` 256 / `motionTemplates.js` 229 / `crackedWallShared.js` 202 / `paramRangeOverrides.js` 56 / `fractalLine.js` 52 / `fxParamRanges.js` 42。
