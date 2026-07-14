# MovieCreator - AI間連絡書（liaison.md）

> **このファイルの用途**: Antigravity 2.0（司令塔）とコーディングAIの間をつなぐ引き継ぎ書。
> - コーディングAIは実装完了・マイルストーン到達のたびに必ず更新すること。
> - 司令塔はこのファイルを読み込んでプロジェクトの現状を把握し、次のタスクを指示すること。

---

## 最終更新
2026-07-14（コーディングAI — プロジェクト単位の一括保存・読み込み強化 完了）

---

## 現在の状態（動作状況）

MovieCreator は Vite + vanilla JS で構築されたブラウザベースの生成映像エディタ。
http://localhost:5174/ で動作確認済み（
pm run dev または un_app.bat で起動）。

### ✅ 正常動作中の機能
- **マルチレイヤー合成**: レイヤーの追加・削除・並び替え・選択
- **ジェネレーター切り替え**: Noise Wave / Lissajous / Fractal Web など複数種
- **一括プロジェクト保存・読み込み**: APIサーバー（piHandler.js）およびフロントエンドを拡張し、全レイヤー設定を一括で管理
  - **Save（上書き保存）**: 読み込み済みまたは一度保存済みのプロジェクトであれば、ダイアログなしで直接上書き保存（API通信）を実行。
  - **Save As...（別名保存）**: 新規保存ダイアログを開き、新しい名前でプロジェクトを保存。
  - **New（新規プロジェクト）**: レイヤーおよびプロジェクトの選択状態をクリアし、キャンバスを初期化。
  - **Export（ローカル出力）**: 現在のプロジェクトの全レイヤー設定およびマスターパラメータをブラウザから .mvproj ファイルとしてダウンロード可能。
  - **Import（ローカル読み込み）**: PC上の .mvproj を読み込んでレイヤー構成とLFOパラメータなどを100%忠実に復元可能。
- **インスペクター（フローティング）**: ↗️ Float ボタンでインスペクターを別ウィンドウに切り離し、メイン描画とリアルタイム連動
- **LFOオートメーション**: 全パラメータ（Generator + FX 7種 + Static FX 3種）でLFO設定が可能
- **2列グリッドUI**: Generator Parameters / FX / Post-processing 全フィールドが2列表示
- **LFO常時展開**: アコーディオン廃止。有効化したLFOパネルは常時展開固定
- **カスタム警告ダイアログ**: ネイティブ confirm を廃止し、テーマカラーに沿った統一デザインの確認モーダル（Proceed / Cancel）を実装。

---

## 直近の完了タスク（2026-07-14 実施）

### プロジェクト単位の一括保存・読み込み強化（司令塔 Option B）
1. **index.html — UIの拡張**: Save（上書き）、Save As...（別名保存）、New（新規）、Export（ローカル出力）、Import（ローカル入力）ボタンおよび非表示 input 要素を追加。
2. **Controls.js — イベントバインドと状態追跡**: 	his.currentProjectFile による現在プロジェクト名の保持、ドロップダウン手動変更イベントの紐づけを追加。ファイルリスト再構築中に状態がリセットされないようガードフラグを実装。
3. **Controls.js — クイック上書き保存・新規・ローカルインポート/エクスポートの実装**:
   - piSaveProjectQuick(): 直接上書き保存（API通信）を行うロジック。
   - piNewProject(): レイヤー初期化処理。
   - localExportProject(): .mvproj ファイルとしてのJSONダウンロード。
   - localImportProject(e): 外部 .mvproj ファイル読み込みと完全復元ロジック。
4. **Controls.js — カスタム確認ダイアログの追加**: showConfirmDialog() メソッドを新設し、ロード、新規作成、ローカルインポートの前の警告確認を本モーダルに置き換え。

---

## 判明している問題・懸念点

| 優先度 | 問題 | 詳細 |
|--------|------|------|
| 低 | ポップアップブロッカー対応 | Float時にブロッカーが有効だと lert() を出す。より良いUIへの改善余地あり |
| 低 | 書き出し機能（動画エクスポート）の精度 | MediaRecorder APIを使用しているがFPS精度は環境依存 |

---

## 次にやるべきこと（司令塔向け提案）

- [ ] ポップアップブロッカー対応UI改善（Float時のユーザー体験向上）
- [ ] タイムラインやキーフレーム機能の検討（中長期、Option C）
- [ ] エクスポート品質改善（MP4解像度設定やFPS制御）

---

## キーファイル一覧

| ファイル | 役割 |
|----------|------|
| z:\MovieCreator\index.html | UIレイアウト定義（ヘッダーボタン、レイヤーリスト・インスペクターヘッダー等） |
| z:\MovieCreator\src\ui\Controls.js | UIロジック全般（インスペクタービルド、フローティング、プロジェクト保存・読み込み・インポート/エクスポート制御） |
| z:\MovieCreator\src\style.css | 全スタイル定義（2列グリッド・LFOパネル・ヘッダーボタン配置など） |
| z:\MovieCreator\src\engine\LayerManager.js | レイヤー管理・LFO演算・プリセット適用・initModulations |
| z:\MovieCreator\src\server\apiHandler.js | プロジェクト(.mvproj)・レイヤー(.mvlayer)保存・読み込みAPIサーバー処理 |
| z:\MovieCreator\vite.config.js | Vite設定（APIミドルウェア呼び出し） |
| z:\MovieCreator\presets\ | 保存されたプリセットJSONファイル群 |
| z:\MovieCreator\projects\ | 保存されたプロジェクト .mvproj ファイル群 |
| z:\MovieCreator\ai_archives\ | AI成果物アーカイブ（計画書・完了報告書）←.ignoreでAI自動走査除外済み |
| z:\MovieCreator\.agents\AGENTS.md | このワークスペースのエージェント連携ルール定義 |
