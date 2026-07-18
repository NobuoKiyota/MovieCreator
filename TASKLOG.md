# TASKLOG — 進捗の短報ログ

Claude CodeとAntigravity IDEの間で「今どのタスクをどこまでやったか」を一言で共有するための場所。
詳しい内容は各コミットメッセージ、または [CLAUDE.md](CLAUDE.md) のタスク一覧を参照。

**書式**: `- YYYY-MM-DD HH:MM [ツール名] 内容 (任意: commitハッシュ)`

**運用ルール**:
- 区切りの良い作業(タスク着手・完了・中断)のたびに、**一番上**に1行追記する(新しい順)。
- 1行で収まる長さに留める。詳細はコミットメッセージ側に書く。
- 作業開始時は直近数行に目を通し、他方のツールが何をしたか・今何が進行中かを把握してから着手する。
- 実際の日時は `date "+%Y-%m-%d %H:%M"` などで確認してから書く(記憶で書かない)。

---

- 2026-07-18 11:00 [Antigravity] 量産化に向けたランダマイザー改善と全21レイヤーの意見書Excel生成完了
- 2026-07-18 10:57 [Antigravity] 量産化に向けたランダマイザー改善と意見書Excel出力の作業に着手
- 2026-07-18 02:24 [Claude Code] ガチャ感軽減の第一弾: ①FADEデフォルトを2.0→0に変更(ループ動画用途)、ついでに`|| 2.0`のfalsy-zeroバグ(FADE=0にしても書き出し時2.0に戻る)を8箇所修正 ②`randomizeLayer`にGood側のソフトランキングを追加(Bad類似度だけでなくGood類似度もスコア化し、複数試行中で最良スコアを採用)、LFO Spread/Spawn Jitter幅のデフォルトを50%/30%→30%/20%に引き下げ。テストの結果、単一パラメータに絞ると効果は明確(Good距離41→13)だが、実際の全パラメータ平均だと効果が薄まることを確認 → 根本改善にはCLAUDE.mdロードマップの「多次元重み付き類似度判定」が必要と判明。動作確認済み・未コミット
- 2026-07-18 01:58 [Claude Code] Spawn Jitterノブの2点修正: ①`.btn-spawn-jitter-toggle`にCSS未定義でブラウザ既定の白背景ボタンになっていた問題を`.btn-modulation-toggle`と同じ透明背景スタイルで修正(style.css) ②幅バッジをパラメータ単位の±実数値(桁数がパラメータごとにバラバラで行崩れの原因)から固定幅の整数%表示に変更、詳細な±実数値はhoverツールチップに退避。動作確認済み・未コミット
- 2026-07-18 01:52 [Claude Code] Spawn Jitterトグルの🎲絵文字をDAWノブ風SVGインジケーター(円+ドット、値に応じて位置と色の濃さが変化)に置き換え。ドラッグ中もリアルタイムにノブを再描画。動作確認済み・未コミット
- 2026-07-18 01:17 [Claude Code] Shockwave Burstを波紋(Ripple)との差別化のため作り直し: ①ジグザグ多角形(`jaggedness`/`spikeCount`をサイクル毎キャッシュ)で滑らかな円ではなく尖った星形シルエットに、②`windupFrac`で「一度中心へ収縮してから爆発的に拡大(ease-out)」する2段階の半径カーブに変更。新規パラメータ2つ(jaggedness, windupFrac)追加、既存プリセットはdefaultParamsのマージでそのまま読み込み可能。動作確認済み・未コミット
- 2026-07-18 00:54 [Claude Code] Spawn Jitter UIをフィードバックで再設計: 共有%スライダーを廃止し、各パラメータの🎲ボタン自体を上下ドラッグ(DAWノブ風)して個別の揺らぎ幅を設定する方式に変更(クリック=ON/OFFトグル、ドラッグ=幅調整、ドラッグ中±実数値バッジ表示)。LayerManager側は`mod.jitterWidth`(パラメータ毎)+`applySpawnJitterOne(name)`に分離、randomizeLayer適用・プロジェクト/プリセット読込の5箇所も追従・動作確認済み・未コミット
- 2026-07-18 00:41 [Claude Code] 全プリセット共通の拡張3点を実装・動作確認済み・未コミット: ①Glass Crackの各ヒビの全キンクでbranchChance判定する多点分岐(新規パラメータなし) ②全ジェネレーター共通の`positionX`/`positionY`スポーン位置オフセット(LayerManager合成段階にtranslate追加、FX_PARAM_RANGES経由でLFO/キーフレームも自動対応) ③パラメータ行ごとの🎲Spawn Jitterトグル+共有%スライダー(レイヤー追加時+cycleDuration系ジェネレーターのサイクル再スタート毎に再抽選、jitterBaseで非ドリフト保証)。詳細はCLAUDE.mdへの追記を検討
- 2026-07-18 00:07 [Claude Code] Glass Crackの銃痕(holeRadius)を物理的に導出する方式に変更: 独立ランダム星形ポリゴンをやめ、放射クラックの根元点をそのまま穴の頂点(尖り)、隣接クラック間の中間角度を谷(欠落)として穴形状を構築。crackCount 4/10/24・holeRadius 0(穴なし)で描画確認・エラーなし・未コミット
- 2026-07-17 21:12 [Claude Code] Glass Crackの描画クオリティを刷新(先細りライン・中心の微細ひび密集・星形の欠け穴+破片フレーク・不規則な連結リング)、参照画像相当まで改善・動作確認済み・未コミット
- 2026-07-17 20:45 [Claude Code] Glass Crackジェネレーター(ひび割れ/銃痕)新設、LightningGeneratorのフラクタル折れ線をfractalLine.jsに共通化・動作確認・コミット (feat 1cc899a, docs 3d7aae5)
- 2026-07-17 20:18 [Claude Code] 他PC再開用セットアップ手順をCLAUDE.mdに整備。data/scores.jsonをgit追跡化(教師データ同期の欠落を修正)、ユーザー作成プリセット取り込み (chore c4efa8f, docs dbdec60, ほか)
- 2026-07-17 19:33 [Claude Code] Lighthouse Beaconにフォグ濃淡・角度歪み・遮光帯を追加(セグメント分割描画に変更)、動作確認・コミット (feat 2da98fe)
- 2026-07-17 18:24 [Claude Code] ヘッダーツールバーが横に広すぎる問題を修正(プロジェクト管理ボタンをアイコンのみ化、セレクトの幅固定、余白圧縮) (fix 5d1cfea)
- 2026-07-17 16:30 [Claude Code] トランジション/カットイン系ジェネレーター第1弾 Shockwave Burst 実装・動作確認・コミット (feat bcf4951)。cycleDuration/progress/envelopeパターンをCLAUDE.mdに明文化
- 2026-07-17 16:09 [Claude Code] バッチ書き出し機能をレビュー、exportWebMFallbackのBlob構築バグを修正・コミット (fix 8295f0d)。以後②トランジション/インサート/カットイン新レイヤー種別の設計に着手
- 2026-07-17 16:04 [Antigravity] バッチ書き出し(量産レンダラー)の実装完了
- 2026-07-17 15:58 [Antigravity] バッチ書き出し(量産レンダラー)の実装に着手
- 2026-07-17 15:21 [Claude Code] パーティクルシェイプ12種拡充(particleShapes.js新設)+colorVariance+FlameGenerator色ライフサイクル/伸び実装・動作確認・コミット (feat 9fb92df, docs/rules sync e70a5dd)
- 2026-07-17 12:35 [Antigravity] 共同開発フロー整備: .agents/AGENTS.md を新しいルール（TASKLOG/CLAUDE.md運用）にアップデート
- 2026-07-17 12:29 [Claude Code] コードベース保守監査→重複・矛盾を修正してコミット (refactor 631ae83, docs 48d7026, chore d7de9a8)
- 2026-07-17 (午前) [Claude Code] Good指向ランダマイザー(引力アルゴリズム)実装・動作確認・コミット (feat 50b81c1)
- 2026-07-17 (午前) [Claude Code] Claude Code運用セットアップ: CLAUDE.md作成、liaison.md/ai_archives運用終了、マルチPC/Google Drive方針決定 (docs 7fb6172)
