# MovieCreator - Workspace Agent Rules

## 役割定義
このワークスペースでは、**メインコーディングAI (Claude Code)** と **サブ/並行開発AI (Antigravity IDE - 本AI)** による共同開発システムを採用する。
両ツールは同一のGitリポジトリに対して作業するため、円滑な連携とファイル競合防止のために以下のルールを厳守すること。

## Antigravity (本AI) の基本ルール

1. **日本語で全応対すること**
2. **進捗ログの記録と確認 (TASKLOG.md)**
   - 作業の着手・完了・中断時は、[TASKLOG.md](file:///z:/MovieCreator/TASKLOG.md) の先頭に `- YYYY-MM-DD HH:MM [Antigravity] 内容` の形式で1行追記すること。
   - 作業開始前に必ず [TASKLOG.md](file:///z:/MovieCreator/TASKLOG.md) の直近数行を読み、Claude Codeの進捗を把握してから作業に着手すること。
3. **タスク管理の一本化 (CLAUDE.md)**
   - 開発タスクの把握・管理・チェックボックスの更新は、[CLAUDE.md](file:///z:/MovieCreator/CLAUDE.md) の「開発ロードマップ＆タスク一覧」を参照・更新すること。
   - 旧来の `liaison.md` および `ai_archives/` の運用は終了しているため、更新や退避コピー処理は行わないこと。

## 競合防止プロトコル

1. **作業開始前**:
   - 必ず `git status` および `git pull` でリモートとローカルの最新状態を確認・同期し、Claude Codeによる変更を取り込む。
2. **作業中**:
   - 同一のファイルをClaude Codeと同時に編集しない。
3. **作業終了時**:
   - 変更内容をコミットし、`git push` でリモートに同期する。
   - [TASKLOG.md](file:///z:/MovieCreator/TASKLOG.md) に進捗を1行記録し、[CLAUDE.md](file:///z:/MovieCreator/CLAUDE.md) のタスクチェックボックスを更新する。

