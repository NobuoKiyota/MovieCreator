# MovieCreator 説明書

> 対になる文書: [SPEC.md](SPEC.md)(設計仕様書)。ここでは**手順(やり方)**を書き、理由・内部仕様は SPEC の該当章を参照する(`→SPEC §x`)。
> 構成: **Part A 使う人向け(§1〜§9)** / **Part B 直す人・作り直す人向け(§10〜§14)**。
> 根拠: 2026-10-04 時点の `main` の実コード。

---

# Part A. 使い方

## 1. セットアップ

### 1.1 初回(Windows)
1. [Node.js (LTS)](https://nodejs.org/) をインストール。Python は周辺ツールを使う場合のみ。
2. リポジトリを取得(`git clone https://github.com/NobuoKiyota/MovieCreator.git`)。
3. フォルダ内の **`setup.bat`** を実行(`npm install` と `pip install -r requirements.txt`)。
4. **`run_app.bat`** を実行(`npm run dev`。Chrome を優先して起動)→ `http://localhost:5173/`。

### 1.2 必須条件
- **Chrome(Chromium系)**。書き出しは WebCodecs が必要(§6)。
- 保存・評価・ProRes・パラメータレンジ編集は **`npm run dev` 中のみ**動作(→SPEC §11)。`npm run build` した成果物では動かない。
- **公開しない**: 開発サーバーは認証が無く、ファイル書込・外部プロセス起動ができる。`--host` や外部公開は禁止(→SPEC §13.3)。

### 1.3 ProRes 4444(透過MOV)を使う場合
`tools/ffmpeg/ffmpeg.exe`(`prores_ks` エンコーダ入りビルド)を**自分で置く**か、PATH に `ffmpeg` を通す。このフォルダは git 管理外(PC別)。

### 1.4 複数PCで使う
`git pull` → 作業 → コミット → `git push`。**`data/scores.json`(評価データ)も git で同期**される。Google Drive 等でリポジトリ本体を同期しない(`.git` 破損の恐れ)。

## 2. 画面の見かた

```
┌ ヘッダ: 👍👎バッジ ⏮ ▶ T.C │ Dur BG P4444 Res FPS Fade 🎬Export │ Project 📂💾💾+📄 ⬇⬆ │ 📐 📁output 📁forSprite 🎨Studio 👁Viewer ┐
│ ┌ プレビュー(16:9) ─────────────┐ ┌ Layers [+Add][Import Preset▼][Import] ─────────┐ │
│ │                               │ │  ☰ 👁 レイヤー名  [type] 🗑   ← 上が最前面   │ │
│ └───────────────────────────────┘ ├ Inspector [名前][↗Float][💾Save] ──────────────┤ │
│ ┌ 🔑 KEYFRAME TIMELINE ─────────┐ │  🎲Random LFO 🔀Pattern ↺ 📊 📝 ⭐ / Batch /      │ │
│ │ (パラメータを選ぶと波形表示)  │ │  Motion Preset / Layer Compositing /             │ │
│ └───────────────────────────────┘ │  Generator Parameters / FX Post-processing        │ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
- ヘッダ左の **バッジ**(例 `noise-wave 👍29 / 👎61 (101件)`)= 選択中レイヤータイプの評価件数。
- **Dur(秒)** は「プレビューのループ長」「LFO の周期計算の基準」「書き出し長」を兼ねる。

## 3. 基本操作

### 3.1 レイヤーを作る
- **`+ Add`** → 種類を選び **Add**。追加直後から**種類ごとの既定モーション**が付く(例 Dot Design は回転+拡縮。→SPEC §4.4)。気になるなら Inspector の `Motion Preset` を `Static (No LFO)` に。
- **プリセット**: `-- Import Preset --` で `presets/*.mvlayer` を選び `Import`。
- **画像/動画**: ウィンドウへ**ドラッグ&ドロップ**、または **Ctrl+V** で貼付(画像・動画)。Inspector から選ぶことも可。
- 並べ替え: `☰` をドラッグ。👁=表示切替、🗑=削除。**リストの上=最前面**。

### 3.2 パラメータを触る
| 操作 | 結果 |
|---|---|
| スライダーをドラッグ | 値変更(LFO/キーフレームが有効だと**毎フレーム上書きされる**ので変わらない) |
| スライダーを**ダブルクリック** | 既定値に戻す |
| 数値表示を**ダブルクリック** | 数値を直接入力(Enter確定 / Esc取消。stepに丸め・範囲内にクランプ) |
| 🧬 | LFO を ON/OFF |
| 🔑 | キーフレームを ON/OFF(LFOと排他)。`+ Key` で現在時刻にキー追加 |
| 🎲 ノブ | クリックで「周期ごと再抽選(Spawn Jitter)」ON/OFF、**上下ドラッグで幅**(0〜100%) |
| 行をクリック | その項目をタイムラインに表示 |

### 3.3 LFO(🧬)
`LFO MIN / MAX`(振れ幅)、`TIME %`(1周期が Dur の何%か。**大きいほど遅い**)、`LFO MODE`:
- **Repeat**: 最小→最大のノコギリ波 / **Repeat (Reverse)**: 最大→最小
- **Return**: 最小↔最大の往復(三角波)
- **One**: 最小→最大へ一度上がって保持 / **One (Reverse)**: 逆

### 3.4 キーフレーム(🔑)とタイムライン
- **ダブルクリックでキー追加**、ドラッグで移動、`Delete` で削除、`Ctrl+C`/`Ctrl+V` で単一キーを現在位置へコピー。
- 上端の**ルーラーをクリック/ドラッグでシーク**。
- 上部 `F:`(フレーム)`V:`(値)`Ease:` で数値指定。`Snap` で時間(1〜60f)・値(2〜50%)に吸着。
- `Template`: 内蔵 2〜10点の形状(各 ×1 / ×0.5 / ×0.25 強度)。`Save` で自作形状を保存(ブラウザの `localStorage`)、`Exp`/`Imp` で JSON 受け渡し。`Copy`/`Paste` で全キーを別パラメータへ(新範囲にクランプ)。
- フレームは **常に 60fps 換算**(書き出し 30fps でも同じ)。Dur 10秒なら 0〜600。

### 3.5 FX(下段 FX / Post-processing)
全レイヤー共通。値を上げた分だけ効く(0=OFF)。**効果は上から順に重なる**(順序は固定。→SPEC §3.4)。
よく使うもの:
- **Neon Glow**: 発光。**Motion Trails**: 残像(0.95で暴走しやすい)。**Trail Spin**: 残像の回転。
- **Mirror Mode**: `1`左右 / `2`上下 / `3`四分割 / `4〜13`放射 6・8・12・16・20 分割(奇数番は交互反転)。**「整った見た目」を作る強力な手段**。
- **Pixelate / Posterize / Solarize / Cartoon / Oilify / Median Blur**: 量子化・絵画調。**Edge Detect**: 透明背景上の発光輪郭。
- **Hue Rotate**: 色相を回す(色パラメータの代わりにアニメできる)。
- **Orbit Radius**: Rotation と組み合わせて公転。

### 3.6 Random LFO / Pattern / Reset
- **LFO Spread**(10〜100%): 変異の大きさ。小さい=今の見た目に近い変化。
- **🎲 Random LFO**: 現在の見た目を基準に変異体を作る。評価データがあれば**低評価に似たものを避け、高評価に寄せる**(最大10回試行)。
- **🔀 Pattern**(Dot Design / Cracked Wall / Magma Wall のみ): **形状に関わるパラメータだけ**を引き直す。色・速度などは変えない。
- **↺**: パラメータ・FX・モーションを初期状態へ(元に戻せない)。**🧹 Clear All**: LFO/キーフレーム/ジッターだけ全解除(今の値は保持)。

### 3.7 Batch Generator(量産)
1. Inspector の `Batch Generator...`(Count 件数 / Filter 類似度%)。別ウィンドウが開く。
2. 対象プリセットを選び、**パラメータごとに Random / LFO / KeyFrame** を選ぶ(優先順位 KeyFrame > LFO > Random)。
3. 生成された候補を1つずつプレビュー→ **採用 / 不採用(評価付き)**。
4. 採用分を**透過WebMで連続書き出し**、または**プリセットとして保存**(`<名前> Batch <日時> v<N>.mvlayer`)。
- Filter(既定90%)以上似た候補は引き直される。

## 4. 評価して学習させる(⭐ Rate / 📊 / 📝)
- **⭐ Rate**: 1〜10 点 + コメント + 理由タグ(例 `too_simple`, `nothing_visible`, `motion_too_fast` …)+ 「このパラメータが良い/悪い」フラグ。**7以上=Good、4以下=Bad、5〜6=どちらでもない**。`data/scores.json` に追記される。
- **📊**: そのレイヤータイプの学習状況(Good/Bad件数、引力の強さ)。Good が 5 件で引力が最大(35%)になる。
- **📝 Opinion Sheet**: レイヤータイプ別に各パラメータの **Score(重要度)/ Move(動かすと良いか 0〜5)/ Comment** を編集。保存で Excel と `data/move_scores.json` が更新され、**Move ≤1 のパラメータは Random LFO で固定**、Move が高いほど動く確率が上がる。
- 運用のコツ: 良い物は迷わず 8〜10、悪い物は理由タグを付ける(再発防止の制約が効く)。評価データは git で共有される。

## 5. プロジェクトとプリセット

| 種類 | 拡張子 | 保存先 | 内容 |
|---|---|---|---|
| プロジェクト | `.mvproj` | `projects/` | 全レイヤー + Dur/BG/Fade(+ vignette/grain) |
| レイヤープリセット | `.mvlayer` | `presets/` | 1レイヤー分(Inspector の `💾 Save`) |

- ヘッダ `💾`=上書き保存(未保存なら名前入力)、`💾+`=名前を付けて保存、`📄`=新規、`📂`=読込。`⬇⬆` で任意の場所へ `.mvproj` を書き出し/読み込み(サーバー不要)。
- プリセット名は `<種類名><連番>` が自動提案される。**Import Preset の分類は名前の先頭で決まる**ので、種類名の接頭辞を変えないこと。
- **注意**: アプリを閉じるとレイヤーは起動時のデモ2枚に戻る。**自動保存は無い**。

## 6. 書き出し

### 6.1 設定
| 項目 | 選択肢 | 備考 |
|---|---|---|
| Dur | 1〜120 秒 | **周期型ジェネレーターの `Cycle Duration` と揃える/整数倍にするとシームレスループ** |
| BG | Transparent(WebM) / Black / Green / White(MP4) | 透過は VP9 alpha、他は H.264 |
| P4444 | チェック | 透過WebMの後に ProRes 4444 MOV も出力(ffmpeg 必須) |
| Res | 720p / 1080p / 4K | **px指定のパラメータは拡大されない**ので、プレビューと構図が変わる場合あり |
| FPS | 30 / 60 | |
| Fade | 秒 | 終端のフェードアウト |

### 6.2 手順
1. Dur・BG を決め、プレビューをループ再生して確認。
2. `🎬 Export`。進捗オーバーレイが出る(完了まで操作しない)。
3. 保存先は **`output/`**(`📁 output` ボタンで開く)。ファイル名は `最前面レイヤー名_YYYYMMDD_HHMMSS`。
4. 失敗時の典型: 「WebM alpha encoding failed」→ Chrome を使う / GPU・ブラウザ更新 / BG を Black に。ProRes は `tools/ffmpeg` を確認。

### 6.3 品質上の注意
- **動画レイヤーを含むと書き出しの時間同期が取れない**(`<video>` が実時間再生のため)。
- 書き出しごとに粒子・ひび割れの乱数が変わる(再現性なし)。気に入った映像は**そのファイルを保存**する(同じ設定で撮り直しても同じ映像にはならない)。
- ループ素材にする場合、**フィードバック(Motion Trails)は始端が空→徐々に蓄積**するため、頭と終端が繋がらないことがある。長めに書き出して中間を使う、またはTrailsを使わない構成で。

## 7. 画像・動画レイヤー
- 追加方法は §3.1。共通: **Breath Pulse**(拡縮の呼吸)、**Floating Shake**(浮遊 px)、**Ken Burns Pan&Zoom**、**Parallax Depth**(マウス位置で視差。プレビューのみ)、Fit(Contain/Cover/Fill/Original)、Mask(Circle/Ellipse + Mask Size)。
- 動画: `Playback Speed`、`Start Offset`(秒)、Loop(Auto/Once)。
- 画像・動画はプロジェクトに**データとして埋め込まれ**(動画は blob URL のため保存経路により欠落しうる。→SPEC §14.2 #2)、ファイルが大きくなる。

## 8. パラメータの範囲を調整する(📐)
ヘッダの 📐 で全パラメータの **Min/Max/Step** を一覧編集。保存すると `Excels/ParameterRanges.xlsx`(`.bak` バックアップ付き)と `data/param_ranges.json` が更新され、その場で全レイヤーに反映(値は新範囲へクランプ)。
- Excel を直接編集しても、**ページをリロードすれば**反映される(`npm run dev` 時)。Excel を開いたままアプリで保存すると衝突するので、**どちらか一方で編集**する。
- 破損したときは `Excels/ParameterRanges.xlsx.bak` を元に戻す、無ければ `node scripts/seed_param_ranges.mjs` で再生成。

## 9. 付属ツール

| やりたいこと | 使うもの |
|---|---|
| ツール一括起動(Web UI / パッケージ生成 / SNS / Webhook / config) | `run_pipeline_gui.bat` |
| 販売パッケージ(サムネ・ライセンス JP/EN・ZIP)生成 | `python scripts/package_builder.py`(`exports/` 内の動画が対象) |
| 動画の黒抜き合成・ランダム量産 | `run_video_mixer.bat`(OpenCV。出力は無音MP4) |
| MP4 → スプライトシート(PNG + Cocos plist + Unity json) | ヘッダ `🎨 Sprite Studio`。成果物は `forSprite/` |
| スプライトの再生確認 | ヘッダ `👁 Viewer` |
| X(Twitter)自動投稿(LINE承認式) | `scripts/sns_autopilot.py` + `scripts/server_bot.py`(`scripts/config.json` にAPIキー。**コミット禁止**) |

---

# Part B. 直す人・作り直す人向け

## 10. 開発の基本

### 10.1 手順と原則
- 起動: `npm run dev`。HMR は効くが、**`Generators.js` などの編集で全ページリロードになり、ブラウザ内の状態(レイヤー)が消える**ことが多い。
- テストは無い。**必ず実ブラウザで確認**する(§13 の検証手順)。
- 変更前に `git pull`、後に TASKLOG.md へ1行追記(運用ルール)。Claude Code と Antigravity IDE が同じリポジトリを触るので**同時に同じファイルを編集しない**。
- 大きな機能は「なぜそうしたか」をコミットメッセージへ。

### 10.2 まず読むファイル(この順)
1. `src/engine/LayerManager.js`(`Layer`, `LayerManager`:全体の骨格)
2. `src/engine/Generators.js` の `BaseGenerator` と、手本にする1クラス(周期型なら `GrowingSketchGenerator`、状態蓄積型なら `RainGenerator`)
3. `src/engine/Effects.js`(1つのFX関数が何をしているか)
4. `src/ui/Controls.js` の `rebuildInspector` → `createModulatableField` → `randomizeLayer`

## 11. 改修レシピ(チェックリスト)

### 11.1 新しいジェネレーターを追加する
**必須(忘れると動かない/壊れる)**
1. `src/engine/Generators.js`: `class XxxGenerator extends BaseGenerator`。
   - `defaultParams()`(**全パラメータの既定値**)、`getParameterConfig()`(`range/color/select`)、`draw(ctx, width, height, time)`。
   - 状態を持つなら `update(time, frameCount, width, height)` と **`reset()`**。
   - 寸法は `width/height` 基準で(解像度非依存。→SPEC §3.6)。色は `adjustColorLightness`(CSS文字列)/ `colorLightnessToRgb`(数値RGB)を**使い分ける**(`parseHexToRgb(adjustColorLightness())` は常に白になる)。
   - ループ素材なら周期型にする(→§11.2)。
2. `src/engine/LayerManager.js`: ① `import`、② `instantiateGenerator` の `case`、③ `getDefaultName` の `case`、④ 必要なら `getDefaultPresetName`。
3. `index.html`: `#layer-type-select` に `<option value="新type">`。

**強く推奨(忘れると体験が欠ける)**
4. `src/ui/Controls.js`: `PRESET_GROUP_PREFIXES` に**`getDefaultName` と同じ文字列**を追加(Import Preset の分類)。
5. `src/ui/paramDescriptions.js`: パラメータ説明(日本語1行)。無くても動く。
6. 意見書(📝): 初めて開くと `GET /api/opinion-sheet` が**列を自動登録**する。Move スコアを後で入れる。
7. Parameter Ranges(📐 に出したい場合): `scripts/seed_param_ranges.mjs` の **`TYPE_TO_CLASS` に1行追加**して `node scripts/seed_param_ranges.mjs` を実行する。**再実行は安全**(既存行の `Min/Max (Actual)`=人が編集した値は保持し、`Reference` 列を更新、新規行だけ追記)。やらなくても**コード内の範囲で動く**(Excel未登録=上書き無し)。
8. 形状を再抽選したいなら `getPatternParamNames()` を実装(→🔀 Pattern が出る)。
9. TASKLOG.md に1行、CLAUDE.md のロードマップ更新。

**動作確認**: 追加→プレイ→🎲 Random LFO を20回→ Pattern(あれば)→ Dur と `cycleDuration` を揃えて書き出し→ 最初と最後のフレームが一致するか。

### 11.2 周期型(ループ素材)にする
```js
draw(ctx, width, height, time) {
  const cd = Math.max(1, this.params.cycleDuration);
  const idx = Math.floor(time / cd);
  if (idx !== this.lastCycleIndex) { this.lastCycleIndex = idx; this.regenerate(width, height); } // 乱数はここで一括確定
  const progress = (time % cd) / cd;          // 0→1
  // progress だけから描く。ワンショット(カットイン)なら envelope を全アルファに掛け、≈0 なら return
}
```
- `getParameterConfig` に `cycleDuration`(500〜20000, step100)を入れる。
- progress の**閉曲線性**(0と1が同じ見た目)を守る。連続的な周回運動は**整数調波**の sin/cos で作る(`crackedWallShared.getWriggledPoints/computeCameraPose` が手本)。
- 乱数を毎フレーム引かない(ちらつく)。固定したい配置は周期頭で作る。

### 11.3 新しい共通FXを追加する
1. `src/engine/Effects.js`: `export function applyXxx(ctx, canvas, intensity)`。**in-place**(`canvas` を読み、同じ `ctx` に書く)。`intensity<=0` で即 return。画素処理が要るなら `processAtLowRes`(低解像度経由)を使う(1080pで `getImageData` だけで約14ms)。一時Canvasは最小限に。
2. `src/engine/fxParamRanges.js`: `FX_PARAM_RANGES` に `{min,max,step}`。
3. `src/engine/LayerManager.js`: ① `import`、② `getDefaultEffects()` に既定値(通常0)、③ `Layer.draw` の FX 列の**適切な位置**に `if (this.effects.xxx > 0) applyXxx(...)`。順序は見た目に直結(→SPEC §3.4)。
4. `src/ui/Controls.js`: ① `fxConfigs` に `{name,label,...R.xxx,type:'range'}`、② **`randomizeLayer` の switch に case を足す**(強いFXなら `forceFxOff(0)` の列に。足さないと `default: continue`=ランダマイザーは触らない。どちらも動くが**意図を明示する**)。
5. (任意)`paramDescriptions.js`、Excel の Common FX Params 行。
6. `index.html` の編集は不要(FXは `fxConfigs` から自動でUI化される)。

**同期3点セット**: `FX_PARAM_RANGES` / `Controls.fxConfigs`(構築時コピー)/ 各 `layer.modulations`(構築時コピー)。範囲を後から変える処理を書くなら `refreshParamRangesLive` と同じ再同期を行う。

### 11.4 新しいランダマイザー規則(共通FX)
`src/ui/fxRandomizerRules.js` に `{value, modulation}` を返す**純関数**を足し、`Controls.randomizeLayer` の switch から呼ぶ。DOM・`this` を触らない(Good重心などは呼び出し側で計算して値で渡す)。OFF固定したいだけなら `forceFxOff(0)`。

### 11.5 新しい理由タグ(👎)を足す
1. `showRatingDialog` の選択肢配列に `{id, text}`。
2. `randomizeLayer` に `const hasXxx = badEvaluations.some(e => e.reasons && e.reasons.includes('id'))` と、生成器パラメータ/FXへの制約。
3. `showLearningStatsDialog` のカウンタ表にも追加(件数表示用)。
※ 既存の `strobe_excess`/`noise_warp_excess` は変数だけ算出されて**未使用**(SPEC §8.3)。

### 11.6 ファイル形式(`.mvlayer/.mvproj`)を変える
- **キー追加**は安全(読込側が「既定 + 上書きマージ」)。
- **改名・削除**は古いデータが孤児キーを持つ(無害だが学習に効かない)。必要なら**読込時マイグレーション**を `Layer.fromJSON` 相当に書く(現状は同じコードが5〜4箇所に重複している。→§11.7)。
- `scores.json` のスキーマ変更は**追記互換**を保つ(旧レコードを読んで `calculateStatesSimilarity` が動くこと)。

### 11.7 レイヤーの保存/復元ロジックを触る(要注意)
同じ「レイヤー→JSON」変換が **`apiSaveProject` / `apiSaveProjectQuick` / `localExportProject` / `apiExportLayer` / `autoSaveCandidateAsPreset`**、逆変換が **`apiLoadProject` / `localImportProject` / `apiImportLayer` / `createLayerFromPresetFile`** に**コピペ**されている(経路により `videoDataUrl` の有無などが食い違う)。仕様を変えるなら**全経路を修正**するか、先に `Layer.toJSON()/fromJSON()` に統合してから変える(推奨。→SPEC §14.2 #2)。

### 11.8 サーバーAPIを足す
`src/server/apiHandler.js` の `handleApiRequest` に `if (req.method === ... && pathname === '/api/xxx')` を足す(ファイル名は `getSafeFilename` + `path.basename`、失敗は JSON `{error}` と 4xx/5xx)。クライアントは `fetch('/api/xxx')`。**開発サーバー専用**である点を忘れず、失敗時のフォールバック(ブラウザDL等)を用意する。

### 11.9 書き出し形式を足す
`VideoRecorder.export` の分岐(`bgMode`)に経路を足す。`applyModulations → update → draw → VideoFrame → encode` の**順序は変えない**(LFOがフリーズする)。`encodeQueueSize` のバックプレッシャ待ちを必ず入れる(フレーム欠落防止)。保存は `saveOrDownloadBlob` を使う。

### 11.10 新しいモーションプリセット/テンプレート
- プリセット: `Layer.applyPreset` の `switch` に case、`Controls` の `.motion-preset-select` の `<option>`、必要なら `getDefaultPresetName`。
- テンプレート: `motionTemplates.js` の `BASE_TEMPLATES` に `"<N>P_Name": [{time,value,easing}]`(`time/value` は 0〜1 の正規化)。×1/×0.5/×0.25 は自動展開。UI のグループ名は先頭の `<N>P_` から作られる。

## 12. 再設計ガイド(作り直す人向け)

### 12.1 何を捨てて何を残すか
| 残す(資産) | 作り直してよい |
|---|---|
| `presets/` 178個・`projects/`・`data/scores.json`(約690件)の**JSON形式**(SPEC §10) | `Controls.js` 全体(UI層) |
| `layer.type` / パラメータ名 / modulation 形式(SPEC §4) | Canvas2D描画の実装方式(WebGL等へ) |
| 周期型ループ契約(SPEC §6.2) | Float窓・ウィザードの見た目 |
| FX の適用順(SPEC §3.4) | サーバー実装(Vite middleware → 別バックエンド) |
| 評価・類似度・ランダマイザーの**考え方**(SPEC §8) | Excel連携(UI直編集に一本化してもよい) |

### 12.2 推奨する移行順(壊さず進める)
1. **純ロジックの切り出し**: `randomizeLayer` / `calculateStatesSimilarity` / `getMotionFeatures` を DOM 非依存モジュールへ。ここに**単体テスト**を足す(入出力が JSON なので簡単)。
2. **`Layer.toJSON/fromJSON` 統合**(§11.7)。保存経路が1本になる。
3. **`GeneratorRegistry` 導入**(type の列挙を1箇所に。SPEC §14.2 #3)。
4. **乱数のシード化**(`rng` 注入)。再現性が得られ、回帰テストが書ける。
5. **論理座標系の固定**(`ctx.scale(w/1280,h/720)`)で解像度依存を解消。
6. **Storage 抽象化**(API/FileSystemAccess/IndexedDB 差し替え)。本番ホスティングが可能になる。
7. UI 分割 → 好きなフレームワークへ。
8. FX の GPU 化 → ジェネレーターの GPU 化(任意)。

各ステップ後に **既存プリセットを数十個ロード → 書き出し → 目視比較**(完全一致はしないので、構図・明るさ・動きの傾向で判断)。

### 12.3 作り直しで特に外せない仕様
- LFO は「`enabled=false` なら**触らない**」(手動値の保持)。キーフレームは `enabled` より優先。
- FX は `rawCanvas`(フィードバック込み)と `canvas`(FX後)の**2段**。FXの出力をフィードバックに戻さない。
- ランダマイザーは整数stepへ**スナップ**。
- 透過書き出しは**背景を塗らない**(`transparent` 時は clear)、マスターポスト(Vignette/Grain)は透過では**スキップ**。
- 書き出しで**フレーム欠落させない**(キュー待ち)、`reset()` 後に開始。

## 13. 検証手順(テスト無しの代わり)

### 13.1 ブラウザでの手動確認
1. `npm run dev` → Chrome で開く → DevTools のコンソールを開いておく(エラー0が基本)。
2. 変更した機能を**実UI**で操作(追加→パラメータ→LFO→書き出し)。
3. レイヤー追加→🎲 Random LFO を 20〜40 回連打してエラーが出ないか(ランダマイザー経路の網羅に有効)。
4. 書き出し(透過WebM / MP4)→ 再生確認。

### 13.2 画素レベルの確認(スクリーンショットが使えない/小さい時)
プレビューが小さい・非表示だと画像で判断しにくい。DevTools コンソールで:
```js
const c = document.getElementById('preview-canvas'), x = c.getContext('2d');
const d = x.getImageData(0, 0, c.width, c.height).data;   // 例: セル中心の輝度を走査してASCII化
```
- **BG が黒だと α は常に 255**。点灯判定は α でなく **RGB の合計**で行う。
- **マスターの Film Grain は毎フレーム乱数**。フレーム同一性を調べるなら `layerManager.masterFilmGrain = 0`(と `masterVignette = 0`)にする。
- **新規レイヤーには既定モーションが掛かっている**(rotation/scale/strobe 等)。パターンが斜めに崩れて見えたら、`layer.modulations.rotation/scale/strobe.enabled=false` と `layer.effects.rotation=0; scale=1; strobe=0` を先に設定する(これを知らないと「バグ」と誤認しやすい)。
- 状態を直接触るには、**一時的に** `window.__mcApp = app;` を `main.js` の `DOMContentLoaded` 内に足し、`__mcApp.layerManager.layers[...]`、`__mcApp.renderSingleFrame()`、`__mcApp.accumulatedTime = ms` を使う(**検証後は必ず削除**)。
- 一時停止中は `renderSingleFrame()` が `update` を呼ばない。粒子系は `layerManager.update(t, fc)` を自分で呼ぶ。

### 13.3 ループ書き出しの確認
Dur = `cycleDuration` にして書き出し、最初と最後のフレームが一致するか(周期型)。`time=0` と `time=Dur` の `progress` が同じ見た目かを `renderSingleFrame` で確認するのが早い。

### 13.4 よくある落とし穴(過去に実際に踏んだもの)
| 症状 | 原因 |
|---|---|
| Dot Design/Noise Glitch の色が常に白 | `parseHexToRgb(adjustColorLightness(...))`。`colorLightnessToRgb` を使う |
| 整数stepのパラメータが小数になり生成器が壊れる(Growing Sketch の枝数) | ランダマイザーの `snapToStep` 漏れ |
| ガチャで「何も映らない」 | `density` 等の下限が低い(Neon Fog の `density` 下限を2→8にした) |
| 一時停止中にスライダーを動かしても粒子が動かない | `renderSingleFrame` は `update` を呼ばない仕様 |
| 範囲を変えたのにスライダー/LFOが古い範囲のまま | `FX_PARAM_RANGES` / `fxConfigs` / `modulations` の3点同期漏れ(§11.3) |
| Float化したInspectorで一部UIが壊れる | `document.createElement` 直書き。`this.createElement` を使う |
| 修正したのに挙動が変わらない | HMRで全リロードされレイヤーが消えている/古いタブ。再読み込みして再現 |
| テストで「全部点灯している」ように見える | 複数のテストレイヤーが重なっている(`addLayer` を繰り返した)。1枚だけにする |
| Mirror/Mosaic系の画素比較が合わない | Glow/Feedback が後段で非対称な残像を足している。比較時は `glowIntensity=0; feedbackDecay=0` |

## 14. トラブルシューティング(利用者向け)

| 症状 | 対処 |
|---|---|
| `WebM alpha encoding failed` | Chrome(最新)を使う。Edge等は VP9 alpha 非対応のことがある。BG を Black(MP4)に切り替えれば出力可 |
| 書き出しが保存されない | `npm run dev` が動いているか。`output/` への保存失敗時はブラウザのダウンロードに落ちる |
| `ProRes 4444 transcode failed` | `tools/ffmpeg/ffmpeg.exe` を置く/PATHにffmpeg。WebM 自体は出力済み |
| 保存・評価ボタンが効かない | 本番ビルド/`file://` では API が無い。`npm run dev` で開く |
| 起動するとレイヤーが2枚だけ | 仕様(自動保存なし)。`📂` でプロジェクトを開く |
| Excel が「修復が必要」と言う | Excel を開いたままアプリで保存しない。`ParameterRanges.xlsx.bak` で復元 / `node scripts/seed_param_ranges.mjs` |
| 画面が真っ暗 | BG が Black で `Opacity`/`Intensity`(Color Wash は既定 0)が 0 ではないか、Dot Design の `progress` が 0 付近(拡大系は開始直後は何も点灯しない) |
| スライダーを動かしても変わらない | その項目の 🧬 または 🔑 が ON(毎フレーム上書き)。OFF にするか LFO の Min/Max を調整 |
| 評価バッジが 0 件 | `data/scores.json` が空/未pull。`git pull` → リロード |
| 動画レイヤーが書き出しで動かない/ズレる | 動画は実時間再生で時間同期しない(仕様上の制約)。素材として先に別途レンダリングしておく |
| 重い/カクつく | Glow・画素系FX・`Milky Way` の Star Density・Particles 数を下げる。4K書き出しは特に時間がかかる |

---

## 付録. 用語・参照
- 仕様の根拠・数式・スキーマ・API: [SPEC.md](SPEC.md)
- 経緯・方針(参考。**現行コードと食い違う記述あり**。SPEC §14.4): `CLAUDE.md`, `TASKLOG.md`, `HANDOFF_2026-07-20.md`
- サブツール: `tools/mp4_to_sprite/README.md`, `tools/mp4_to_sprite/INTEGRATION_GUIDE.md`, `AGENTS.md`
