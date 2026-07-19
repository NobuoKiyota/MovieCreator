# MovieCreator

ブラウザ上で動作する、ネオン・サイバーパンク風の生成映像・エフェクト映像クリエイター。Vite + vanilla JS(フレームワーク非依存)。詳細な機能一覧は [README.md](README.md) を参照。

## 開発コマンド

- `npm run dev` — 開発サーバー起動(http://localhost:5173/)。`run_app.bat` からも起動可能。
- `npm run build` — `dist/` に本番ビルド出力
- `npm run preview` — ビルド成果物のプレビュー

## 構成

- `src/main.js` — エントリポイント
- `src/engine/LayerManager.js` — レイヤー合成・3Dトランスフォーム・描画パイプラインの中核
- `src/engine/Generators.js` — 各種ジェネレーター(炎・雪結晶・スピログラフ・オーロラ・ドライアイス煙・3Dパーティクル等)
- `src/engine/particleShapes.js` — 粒子系ジェネレーター(炎/ドライアイス/3Dパーティクル)共通のシェイプ描画ライブラリ(全12種)。新しいシェイプを追加する際はここに1箇所追加すれば3ジェネレーター全てに反映される(個別コピペ禁止)
- `src/engine/fractalLine.js` — 中点変位法によるフラクタル状ジャグ折れ線の共通生成関数(`generateFractalBranch`)。稲妻(`LightningGenerator`)とガラスのひび割れ(`GlassCrackGenerator`)が共用。分岐方向はコールバック引数で差し替え可能
- `src/engine/Effects.js` — ポストプロセスFX(万華鏡、色収差、フィードバック等)
- `src/engine/VideoRecorder.js` — MP4/透過WebMエクスポート(mp4-muxer / webm-muxer + WebCodecs)
- `src/ui/Controls.js` — インスペクターUI、LFO、キーフレームタイムライン、評価・教師モデル・ランダマイザーロジック
- `src/server/apiHandler.js` — プロジェクト保存/読込・評価データ保存等のサーバー側処理
- `presets/` — プリセットファイル群(`.mvlayer`形式。`presets260715/` は旧スナップショット)
- `data/scores.json` — 👍/👎の評価アノテーションデータ（教師データ本体）

## 開発フロー(2026-07-17時点)

- **Claude Code をメイン実装**、**Antigravity IDE をサブ/並行実装**として使う運用。両者が同一のgitリポジトリに対して作業するため、**同時に同じファイルを編集しない**こと。ツールを切り替える際は必ず先に `git status` / `git pull` で状態を確認し、作業後はコミットしてから引き継ぐ。
- 記録は **CLAUDE.md(現状・設計方針)+ git履歴(何を・いつ・なぜ変更したか)+ [TASKLOG.md](TASKLOG.md)(一言の進捗ログ)** に一本化。旧来の `liaison.md`(引き継ぎ書)と `ai_archives/`(実装計画・完了報告のペア文書)は過去のアーカイブとして保持するが、**今後は更新しない**。
- 大きめの機能追加はコミットメッセージに背景(なぜ)を残す。細かい経緯をここに追記する必要はない。
- **作業の区切り(着手/完了/中断)ごとに [TASKLOG.md](TASKLOG.md) の先頭に1行追記する**。Claude CodeとAntigravity IDEの両方が同じファイルに書き込む共通の短報ログ。作業開始前に直近数行を読んで状況を把握してから着手する。書式・運用ルールはTASKLOG.md冒頭を参照。

## プリセット量産・教師モデル（Mutation）の仕組み

透過動画プリセットの高品質・高速量産のため、以下の**自己進化型変異（Mutation）ランダマイザー**が搭載されている。

1. **ベース教師値からの変異 (Mutation)**
   - ユーザーが手元で微調整した現在のパラメータ設定値（スライダー値、LFO範囲、キーフレーム位置）を教師ベース値とする。
   - `LFO Spread` 行のスライダー値（`spreadPct`）を基準に、元の値から最大 $\pm(Range \times spread \times 0.2)$ の範囲でランダムな揺らぎ（変異）をパラメータに適用する。
   - LFOの周期（`timePct`）にも $\pm 15\%$ の揺らぎ（周期変異）を適用し、キーフレームアニメーションはイージングやタイミングの個性を維持したまま値の振幅のみを変異させる。
2. **ネガティブ理由（アノテーション）に基づく動的クランプ**
   - 👎評価の際、ユーザーが登録したネガティブ理由に応じて、ランダマイズ時に動的なパラメータ制約が発動する。
     - `nothing_visible`（真っ暗・見えない）: ジェネレーターの数量・サイズ下限を30%引き上げ、カラー輝度下限を40以上、共通FX scale下限を0.8以上、glowIntensity下限を15.0以上に強制クランプし、視認性を担保。
     - `noise_warp_excess`（ノイズ歪みすぎ）: Noise Warp (distortionIntensity) の上限を4.0以下に制限。さらに80%の確率で歪みを完全に無効化(0)。
       - なお、この理由の報告有無に関わらず、ランダマイズ時のNoise Warp上限は常時12.0にクランプされる（スライダー自体の最大値は40だが、ランダマイズ結果が常に歪みすぎるのを防ぐベースライン制限。`randomizeLayer`内`distortionIntensity`のlocalMax初期値）。
     - `strobe_excess`（チカチカしすぎ）: ストロボ発生確率を5%に抑制、有効時も最大1.5にクランプ。
     - `scale_too_small` / `scale_too_large`（サイズ過不足）: scale下限を0.8にし、オブジェクト数量下限を引き上げ。
     - `aspect_break`（回転時の黒い隙間）: rotation有効時、scale下限を対角線カバー率である $1.42$（$\sqrt{2}$）以上に強制クランプ。
     - `too_simple`（シンプルすぎ）: 各種数量・glow・feedbackDecayの下限値を引き上げ、賑やかさを確保。
     - `too_chaotic`（演出過剰）: glowIntensityを最大20.0、feedbackDecayを最大0.80にクランプし、白飛びを防止。
     - `color_monotonous`（配色が地味・単調）[2026-07-19実装]: 生成する色相(hue)が直前の色相と円環距離で90°未満になった場合、最大20回リロールして離す。
     - `motion_too_fast`（動きが速すぎて目が疲れる）[2026-07-19実装]: モーションテンプレートの適用を完全に停止(テンプレートは持続時間内に複数振動を詰め込むため速度調整の余地がない)し、代わりに素のLFOのみを使用。LFO周期(`timePct`、値が大きいほど1周期が長い=遅い)を55%以上に強制クランプ。
     - `motion_too_slow`（静止しすぎ）[2026-07-19実装]: モーションテンプレート適用確率を+30%引き上げ。既存LFOの周期は35%以下(速い)にクランプ。本来は静止(min=max固定)になるはずだったパラメータも、振幅Rangeの15%幅・周期20-35%の軽いLFOを強制付与し、完全な静止を避ける。
3. **過去のBadデータとの類似度フィルタリング（リロール）**
   - 生成されたパラメータ候補が、過去に👎評価（Bad）された同一レイヤータイプのパラメータ群と正規化類似度で90%以上合致する場合、自動的に再生成（リロール）を行う（最大10回）。
4. **Good指向の引力（Attraction）** [2026-07-17実装済み]
   - 👍評価（Good）された同一レイヤータイプのパラメータ群の平均値(centroid)へ、変異の中心値を引き寄せる。重みは信頼度ランプ型(Good評価0件で0%、5件以上で最大35%)。Good評価が無いレイヤータイプでは重み0%となり、旧来の挙動と完全に一致する。
   - 対象は生成器パラメータと共通FX(rotation含む)の基準値、および(2026-07-19実装以降)LFOの振幅・速度。キーフレーム値のオフセット計算・色相ランダムは対象外(1の相対揺らぎのまま)。
   - 📊学習進捗ダイアログに現在のレイヤータイプの引力状態(有効/弱/なし、サンプル数、重み%)を表示。
5. **動きの評価トレース**（`getMotionFeatures`/`motionFeatureDist`/`weightedMotionCentroid`）[2026-07-19実装]
   - **発端のバグ**: `rateLayer()`が評価送信時にLFO状態を`lfoEnabled`/`lfoType`/`lfoRate`/`lfoAmount`という実在しないフィールド名で保存していた(実際は`enabled`/`min`/`max`/`timePct`/`behavior`)。過去に保存された評価データは全てLFOの動きが記録されず、キーフレーム(`keyframeEnabled`+`keyframes`)のみ記録されていた。さらに、記録されていたキーフレームデータも`calculateStatesSimilarity`/`weightedCentroid`のどちらからも一度も参照されておらず、類似度判定・Good引力は静的な値(`params`/`effects`)のみで行われていた(静的な値が同じでも、片方が激しくLFOアニメーションしていてももう片方が完全静止していても「100%同一」と判定されていた)。
   - **対応**: ①フィールド名を修正し実際のLFO状態を記録するように修正。②各パラメータの`modulations`から`{animated: 0|1, amplitude: 0..1, speed: 0..1}`という正規化された「動きの特徴量」を抽出する`getMotionFeatures()`を追加(LFOは`min`/`max`の振れ幅とtimePctから、キーフレームは値のレンジと平均フレーム間隔から算出)。③`calculateStatesSimilarity`の各range系パラメータの距離計算を「静的値65% + 動きの特徴量35%」のブレンドに変更(Bad回避のリロール・バッチの多様性フィルタ・Good近さスコアが全て動きも考慮するようになった)。④Good指向の引力にも`weightedMotionCentroid()`を追加し、現在LFOが有効なパラメータの振幅・速度を「Goodと評価された同パラメータの振幅・速度の平均」へ引き寄せる(オン/オフの判定自体は既存のMove-score/継承状態のまま変更なし。キーフレームの形状学習は対象外、将来課題)。

## 新規ジェネレーター（プリセット種類）の追加手順

新しい描画パターン（ジェネレーター）をシステムに追加し、自動的にランダマイザーやLFO、キーフレームと連動させる手順は以下の通り。

1. **`src/engine/Generators.js` へのクラス追加**
   - `BaseGenerator` を継承したクラスを作成（例: `class HologramGenerator extends BaseGenerator`）。
   - コンストラクタでパラメータのデフォルト値を `this.params = { ... }` に設定。
   - `getParameterConfig()` を実装し、インスペクターに並ぶスライダーの設定を返す。
     ```javascript
     getParameterConfig() {
       return [
         { name: 'count', label: 'Hexagon Count', type: 'range', min: 1, max: 50, step: 1 },
         { name: 'size', label: 'Base Size', type: 'range', min: 5, max: 200, step: 1 },
         ...
       ];
     }
     ```
   - `draw(ctx, time, accumulatedTime)` を実装し、HTML5 Canvas APIを用いた描画ロジックを記述。
2. **`src/engine/LayerManager.js` への登録**
   - ファイル上部で新規ジェネレーターをインポート。
   - `createGenerator(type)` 内の `switch(type)` に、新しいタイプ名（例: `'hologram'`）の `case` を追加し、新規インスタンスを返す。
3. **`index.html` へのオプション追加**
   - `#new-layer-type` セレクトボックス（レイヤー追加用UI）に、新しいジェネレーターの `<option value="hologram">Cyber Hologram</option>` を追加。

### トランジション/カットイン系ジェネレーターの作り方

既存ジェネレーターは全て「無限ループのアンビエント素材」前提。インサート/トランジション/カットイン素材（決まった尺で1回だけ展開し、開始・終了ともに完全透明であるべき素材）を追加する場合は、上記3ステップに加えて以下のパターンに従う（`ShockwaveBurstGenerator`が実例）。

- レンダリングパイプライン（`LayerManager.js`/`main.js`/`VideoRecorder.js`）は無改修のまま、**ジェネレーター自身が`cycleDuration`パラメータ（ミリ秒）を持ち、`time`から`progress`と透明度エンベロープを自前で計算する**。
  ```javascript
  const progress = (time % this.params.cycleDuration) / this.params.cycleDuration; // 0→1
  let envelope = 1.0;
  if (progress < this.params.fadeInFrac) envelope = progress / this.params.fadeInFrac;
  else if (progress > 1 - this.params.fadeOutFrac) envelope = (1 - progress) / this.params.fadeOutFrac;
  envelope = Math.max(0, Math.min(1, envelope));
  if (envelope <= 0.001) return; // 完全透明フレームは描画スキップ
  // ...描画する全要素のアルファに envelope を掛ける
  ```
- ユーザーは書き出し時のDuration設定を`cycleDuration`と一致させれば1回だけの展開になる。`cycleDuration`をDurationより短くすると、その周期で繰り返しパルスする（意図的な柔軟性）。
- `LayerManager.applyModulations(time, duration)`は`duration`を受け取るが`draw()`系には配線されていない（`generator.draw(ctx, width, height, time)`は`time`のみ）ため、他の手段でDurationを取得することはできない。上記の自己完結パターンを使うこと。

**バリエーション: アンビエント素材の「周期ループ」化**（`GrowingSketchGenerator`が実例、2026-07-19）
- 「無限ループのアンビエント素材」であっても、内部で毎フレーム状態を蓄積し不確定なタイミングでリセットするタイプ（例: 育つ線が画面外に出た/一定量成長したらランダムに描き直す）は、Durationに対して不規則な瞬間にリセットが起き、書き出したループ動画の継ぎ目が汚くなる。
- この場合は上記のcycleDuration/progressパターンをそのまま流用しつつ、**透明度エンベロープ(fadeIn/fadeOutFrac)を省略**する(常時表示のアンビエント素材なので、透明→不透明→透明ではなく、形状そのものが周期的に再構築される)。
  - `progress`が0に戻るサイクル境界のたびに、その周期分の軌跡を`Math.random()`込みで**まとめて事前計算**する(`regenerateCycleVariation()`。旧: 毎フレームの逐次成長+不確定な条件でのリセット)。
  - `draw()`では`progress`に応じて事前計算済みの軌跡を**先頭から`progress`分だけ見せる**(reveal)だけにする。
  - こうすることで「必ずcycleDurationちょうどで1周期が完結し、次の周期の見た目はランダムに変わる(オーガニックな変化は維持)が、タイミングだけは常に規則的」になる。書き出し時のDurationをcycleDurationの整数倍に設定すれば継ぎ目のないループになる。

## 開発ロードマップ ＆ タスク一覧（Claude Code / Antigravity IDE 共通）

プリセット販売へ向けた量産の効率化とバリエーション拡充のため、以下の優先順位で開発・保守を進める。どちらのツールで着手してもよいが、着手・完了時は本リストのチェックを更新し、[TASKLOG.md](TASKLOG.md) に1行追記する。

### 1. 教師モデル・量産機能のアップグレード（優先度：高）
- [x] **Good指向ランダマイザー（引力アルゴリズム）の実装** — 2026-07-17完了。詳細は上記「プリセット量産・教師モデル（Mutation）の仕組み」4番を参照。
- [x] **モデル量産化に向けたパラメータ制御指針の適用（ガチャ要素の劇的な軽減）** — 2026-07-18完了。PositionX/Y, Rotation, Scale, Strobe, Glow, Motion Trails, Trail Spin, Noise Warp, 3D Rotation等のパラメータにユーザー指針によるハードクランプとスローモジュレーション自動設定を統合。
- [x] **全プリセットレイヤー パラメータ意見書Excelの出力** — 2026-07-18完了。全21種類のレイヤーに対する固有パラメータと共通FXパラメータの Score/Move/Comment マトリクス表 `PresetLayerOpinionSheet.xlsx` を生成し、サンプルの評価値・コメントを転記。
- [x] **キーフレームモーションテンプレート（プリセット形状）機能の実装** — 2026-07-18完了。DAW風オートメーション形状を点数(2P〜10P)別に整理して定義(`src/engine/motionTemplates.js`)。実際に量産で機能しているのは**Move-score方式**(下記)で、Excel「Motion Mapping」シート連携は現状**未入力・実質不使用**(2026-07-19判明、下記参照)。
  - **Move-score方式(稼働中)**: `PresetLayerOpinionSheet.xlsx`のScore/Move/CommentマトリクスのMove列(0〜5、「動かすと効果的か」の評価)を`export_move_scores.py`→`data/move_scores.json`(全21レイヤー485件)に抽出。`randomizeLayer`はMove≤1のパラメータをLFO/キーフレームなしの固定値にし、それ以外は`RANDOM_TEMPLATE_CHANCE`(30%)の確率でモーションテンプレートをランダム適用する。
  - **ブラウザ上でのScore/Move編集**(2026-07-20実装): Inspectorの📝ボタン(現在アクティブなレイヤータイプに自動スコープ)から、Excelを開かずにScore/Move/Commentを別ウィンドウで編集・保存できる。保存すると`Excels/PresetLayerOpinionSheet.xlsx`への書き戻しと`data/move_scores.json`の再生成([export_move_scores.py](export_move_scores.py)相当のロジックをNode側に移植)が同時に行われ、`export_move_scores.py`を手動実行しなくても即座にランダマイザーへ反映される。実装は`src/server/apiHandler.js`の`GET`/`POST /api/opinion-sheet`(xlsxの読み書きは[SheetJS](https://sheetjs.com/)、`npm`レジストリ版は既知の高深刻度脆弱性が未修正のため`https://cdn.sheetjs.com/xlsx-latest/xlsx-latest.tgz`から導入。ESM版は`XLSX.set_fs(fs)`を明示的に呼ばないと`readFile`/`writeFile`が動かない点に注意)。**既知の制約**: SheetJS無料版はセルスタイル(色・列幅等)を完全には保持できず、保存の度にExcel側の書式は簡略化される(ユーザー確認・許容済み。Score/Move/Comment自体のデータは正しく保持される)。フォーマットを完全に保ちたい場合は将来的にセル単位のXML直接パッチ方式への切り替えを検討。
  - **ガチャ回避パラメータの原因切り分け上の注意**: 共通FX(Position/Rotation/Scale/Strobe/Glow/Motion Trails/Trail Spin/Noise Warp/Kaleidoscope/Chromatic/3D Rotation等)は「ガチャ軽減」対応(2026-07-18)で`randomizeLayer`内に個別ハードコードされており、**Move-scoreを一切参照しない**。特定パラメータが期待通りにならない場合、まずそれが生成器固有パラメータ(Move-score駆動)か共通FX(ハードコード)かを確認すること。実例: Neon LightningのTrail Spin(`feedbackRotate`)が高確率で0以外の値になる不具合(2026-07-20報告)は、Excelの傾向設定とは無関係の、ハードコードされた5択ランダム(4/5が非ゼロ)が原因だった。
  - **Excel「Motion Mapping」シート連携(未入力・コード側は修正済み)**: `export_motion_mapping.py`→`data/motion_mapping.json`という別経路も存在するが、シート573行が未入力のため現状マッピングは空。仮に将来手入力しても、シートの列名(`SlowDriftUp`等6種)が`motionTemplates.js`の実キー命名規則(`2P_`等の点数プレフィックス)と一致せず適用ゼロになるバグがあったため、2026-07-19に`LEGACY_CATEGORY_KEYS`で両者を紐付ける修正と、両エクスポートスクリプトのパスのハードコード(`Z:\MovieCreator\...`)を相対パス化する修正を実施。**シートの手入力自体は今後のタスクとして残っている**(573行は現実的でないため、優先度の高いレイヤー・パラメータから部分的に埋めるのが現実的)。
- [x] **多次元重み付き類似度判定への改善** — 2026-07-19完了。`randomizeLayer`/`generateBatchVariations`で使う類似度計算(旧: 全パラメータ単純平均差分)を`calculateStatesSimilarity`に一本化し重み付けに変更。色/hue系パラメータ名・物量系パラメータ名(count/density等)を固定boost、それ以外はMove-scoreデータ(0〜5)で重み0.6〜1.6倍。あわせて色(color)パラメータ自体が類似度計算から完全に抜け落ちていた既存の抜け穴(hue差を一切見ていなかった)も色相の円環距離で修正。
- [x] **アノテーションの拡張** — 2026-07-19完了。👎モーダルのアノテーション理由に `color_monotonous`（配色が地味・単調）、`motion_too_fast`（動きが速すぎて目が疲れる）、`motion_too_slow`（静止しすぎ）の3項目を追加し、対応する動的クランプを`randomizeLayer`に実装。詳細は上記「プリセット量産・教師モデル（Mutation）の仕組み」2番を参照。

### 2. 量産効率化UI・評価管理の整備（優先度：中）
- [ ] **評価アノテーションデータ（data/scores.json）の管理UI**
  - 間違えて👍や👎を押した場合や、過去の評価基準を見直したい場合のため、過去の評価履歴の一覧表示・個別削除・理由編集を行える「アノテーションエディタ」ダイアログを実装する。
- [x] **量産プレビュー＆一括書き出しバッチ（バッチレンダラー）**
  - 1つの教師モデルからLFO Spreadに基づいて一括で数十パターンの変異体を生成し、グリッド状に並べてプレビュー・一括評価できる機能。または、高評価の変異体を自動でWebM（透過）として連続レンダリング・ファイル保存するバッチエクスポート機能。

### 3. 新規ジェネレーター（プリセット種類）の追加（優先度：中）
- [x] **Lighthouse Beacon（回転灯台）** — 2026-07-17完了。回転ビーム+色相サイクル。Dry Ice Smokeは新規開発の優先度を下げた代替として追加(コード・presetsは維持)。
- [x] **Shockwave Burst（衝撃波）** — 2026-07-17完了。インサート/トランジション/カットイン系ジェネレーター第1弾。「トランジション/カットイン系ジェネレーターの作り方」(上記)のパターンを確立。
- [x] **Glass Crack（ガラスのひび割れ/銃痕）** — 2026-07-17完了。`holeRadius`パラメータで単純ひび割れ⇔銃痕(穴あり)を切り替え可能。`LightningGenerator`のフラクタル折れ線生成を`src/engine/fractalLine.js`に共通化して再利用。
- [ ] **販売用として需要の高い新規ジェネレーターの追加**
  - **CyberHologramGenerator**: 回転するサイバーグリッド、同心円のリング、ハニカムシールドなどを組み合わせた、SFホログラム・UI風ジェネレーター。
  - **GlitchSignalGenerator**: 走査線、カラーノイズ、矩形ブレイクブロックなどをプロシージャルに描画し、デジタルノイズ・グリッチエフェクトを作るジェネレーター。
  - **MagicCircleGenerator**: 精緻な魔法陣、ルーン文字、オカルト幾何学がLFOで重なり合いながら回転するジェネレーター。
  - **DigitalRainGenerator**: マトリックス風に縦方向にサイバー文字やビットストリームが尾を引いて流れ落ちるジェネレーター。

## 保守のガイドライン

- **データファイル（data/scores.json）の保守**:
  - `scores.json` はアノテーションの蓄積により肥大化するため、読み込み・保存のパフォーマンスに注意すること。また、サーバー起動時にファイルが破損している場合のフォールバック（バックアップからの復旧や新規作成）を `apiHandler.js` に実装しておくこと。
- **パフォーマンスとメモリリークの監視**:
  - レンダリング時に多数のパーティクルやトレイル（フィードバック効果）を生成するため、レイヤー削除時やジェネレーター切り替え時に描画オブジェクトやキャッシュが適切に解放されているか確認すること。
  - WebCodecsによる書き出し時は、一時的に解像度が変わるため、キャンバスリサイズやピクセルデータの取得でメモリリークやクラッシュ（特に4Kエクスポート時）が発生しないか確認すること。
- **マルチPC・Git運用の徹底**:
  - 開発フローに記載の通り、作業前は必ず `git pull`、完了後はコミットして `git push` を行い、競合を防ぐ。

## ProRes 4444(透過)MOVエクスポート

- 通常の透過エクスポートはブラウザ完結(WebCodecs VP9 alpha → `.webm`)だが、これに加えて**ローカルffmpegを使ったサーバーサイド変換でProRes 4444(透過)の`.mov`も出力できる**(`npm run dev`時のみ。本番ビルドにはAPIミドルウェアが無いため使用不可)。
- 仕組み: エクスポート画面の「P4444」チェックボックス(`index.html` `#export-prores`)をONにすると、`VideoRecorder.js`の`exportWebMAlpha`が通常の`.webm`ダウンロード後に`transcodeToProRes()`を呼び、生成済みWebM blobを`POST /api/transcode-prores`(`src/server/apiHandler.js`)に送信する。サーバー側は`child_process.spawn`でffmpeg(`-c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le`)を実行し、変換結果の`.mov`をレスポンスとして返す。ブラウザ側は受け取ったMOVを追加でダウンロードする(WebM変換失敗時もWebM自体は正常に手元に残る)。
- **ffmpegバイナリはPCごとに個別配置**(`tools/ffmpeg/ffmpeg.exe`、`.gitignore`対象でgit同期されない)。`findFfmpegBinary()`がまずこのベンダリングパスを探し、無ければPATH上の`ffmpeg`にフォールバックする。新しいPCでこの機能を使う場合は、ffmpeg実行ファイル(`prores_ks`エンコーダ入りビルド)を該当PCの`tools/ffmpeg/`に手動配置するか、システムPATHにffmpegを通しておくこと。
- 変換時の一時ファイル(`.tmp_transcode/`、`.gitignore`対象)はリクエストごとに書き込み・変換後即削除される。

## マルチPC運用(自宅・会社)

- このプロジェクトは自宅PC(`Z:\MovieCreator`、外付けTOSHIBA HDD)と会社PCの2台で作業する。**ローカルパスは環境ごとに異なる**前提で、パスをドキュメントや設定にハードコードしない。
- **コード同期はgit(GitHubリモート `origin` = NobuoKiyota/MovieCreator)を正とする**。作業開始前に必ず `git pull`、作業終了時は `git push` で同期する。Google Driveでリポジトリ本体をライブ同期しない(`.git`内部ファイルの同期競合による破損リスクがあるため)。
- Google Drive(`D:\マイドライブ\MovieCreator_Backup\`)は**書き出し済み成果物のバックアップ専用**。レンダリングしたMP4/WebM、`.mvproj`、presetsのスナップショットなどを手動または任意のタイミングで保存する場所であり、ソースコードの同期経路ではない。
- `ai_archives/` は `.gitignore` 対象のためGit経由では他PCに引き継がれない(過去記録のローカルアーカイブとして自宅PCにのみ残る想定。運用終了済みなので実害なし)。
- **`data/scores.json`(教師データ本体)はgit追跡対象**(2026-07-17〜)。Good引力ランダマイザーの学習データが他PCでも常に最新になるよう、通常のソースコードと同じく`git pull`/`push`で同期する。破損時フォールバック(`apiHandler.js`)が作る`data/*.corrupted-*.json`バックアップのみ`.gitignore`で除外。
- Claude Codeの会話メモリ・個人設定(`~/.claude/`配下)は**作業ディレクトリのパスに紐づく**ため、PCが変わると引き継がれない。プロジェクトの恒久的な情報は個人メモリではなく、この `CLAUDE.md`(git管理下)に書くこと。

### 新しいPC(会社PC等)でのセットアップ手順

1. **前提**: [Node.js (LTS)](https://nodejs.org/) をインストール
2. **クローン**: `git clone https://github.com/NobuoKiyota/MovieCreator.git`(既存クローンがあれば `git pull` のみでよい)
3. **依存関係インストール**: プロジェクトフォルダで `npm install`
4. **起動確認**: `npm run dev`(または `run_app.bat`)→ `http://localhost:5173/` にブラウザでアクセスし、既存プリセットが読み込めること・Good引力の📊ダイアログで評価件数がこのPCでも反映されていることを確認
5. **状況把握**: [TASKLOG.md](TASKLOG.md) の直近数行と、このCLAUDE.mdの「開発ロードマップ＆タスク一覧」のチェック状況を読んで、直前の作業内容・未着手タスクを把握してから着手する
6. **Claude Code固有の設定**(このPCで初めてClaude Codeを使う場合のみ):
   - `.claude/launch.json` はgit管理下なので自動的に引き継がれる(ブラウザプレビューの`npm run dev`起動設定)
   - 個人のグローバル設定(`~/.claude/CLAUDE.md`)は各PCで別ファイルなので、必要であれば手動で作成する(日本語応答・クレジット節約方針など、プロジェクト非依存の個人的な運用ルール)
7. **Google Drive**: そのPCの実際のGoogle Driveパス(自宅PCでは`D:\マイドライブ\`だが、会社PCでは異なる場合がある)に`MovieCreator_Backup`フォルダを用意する。ソースコードとは無関係(バックアップ専用)なので、セットアップの必須項目ではない

## 注意点

- テストコードは未整備。UI/挙動の変更後は `npm run dev` で実ブラウザ動作を確認する。
- エクスポート周りは非同期オフラインレンダリング(WebCodecs)に依存しているため、Chromium系ブラウザでの動作確認が必須。

