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
3. **過去のBadデータとの類似度フィルタリング（リロール）**
   - 生成されたパラメータ候補が、過去に👎評価（Bad）された同一レイヤータイプのパラメータ群と正規化類似度で90%以上合致する場合、自動的に再生成（リロール）を行う（最大10回）。
4. **Good指向の引力（Attraction）** [2026-07-17実装済み]
   - 👍評価（Good）された同一レイヤータイプのパラメータ群の平均値(centroid)へ、変異の中心値を引き寄せる。重みは信頼度ランプ型(Good評価0件で0%、5件以上で最大35%)。Good評価が無いレイヤータイプでは重み0%となり、旧来の挙動と完全に一致する。
   - 対象は生成器パラメータと共通FX(rotation含む)の基準値のみ。LFOのmin/max・キーフレーム値のオフセット計算・色相ランダムは対象外(1の相対揺らぎのまま)。
   - 📊学習進捗ダイアログに現在のレイヤータイプの引力状態(有効/弱/なし、サンプル数、重み%)を表示。

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

## 開発ロードマップ ＆ タスク一覧（Claude Code / Antigravity IDE 共通）

プリセット販売へ向けた量産の効率化とバリエーション拡充のため、以下の優先順位で開発・保守を進める。どちらのツールで着手してもよいが、着手・完了時は本リストのチェックを更新し、[TASKLOG.md](TASKLOG.md) に1行追記する。

### 1. 教師モデル・量産機能のアップグレード（優先度：高）
- [x] **Good指向ランダマイザー（引力アルゴリズム）の実装** — 2026-07-17完了。詳細は上記「プリセット量産・教師モデル（Mutation）の仕組み」4番を参照。
- [x] **モデル量産化に向けたパラメータ制御指針の適用（ガチャ要素の劇的な軽減）** — 2026-07-18完了。PositionX/Y, Rotation, Scale, Strobe, Glow, Motion Trails, Trail Spin, Noise Warp, 3D Rotation等のパラメータにユーザー指針によるハードクランプとスローモジュレーション自動設定を統合。
- [x] **全プリセットレイヤー パラメータ意見書Excelの出力** — 2026-07-18完了。全21種類のレイヤーに対する固有パラメータと共通FXパラメータの Score/Move/Comment マトリクス表 `PresetLayerOpinionSheet.xlsx` を生成し、サンプルの評価値・コメントを転記。
- [ ] **多次元重み付き類似度判定への改善**
  - 現在は全パラメータの単純平均差分。色相（Hue）の差、モジュレーションの有無、物量パラメータなど、映像の見た目に与える影響度（ウェイト）をパラメータごとに設定し、より人間の感覚に近い類似度判定を行えるよう `randomizeLayer` の類似度計算を改善する。
- [ ] **アノテーションの拡張**
  - 👎モーダルのアノテーション理由に、販売用透過動画としての品質基準をより満たすための項目を追加（例: `color_monotonous`（配色が地味・単調）、`motion_too_fast`（動きが速すぎて目が疲れる）、`motion_too_slow`（静止しすぎ）など）。それに伴う動的クランプ制約も実装する。

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

