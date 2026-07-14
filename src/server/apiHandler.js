import fs from 'fs';
import path from 'path';

/**
 * OSでファイル名として使用不可能な文字や制御文字を安全に置換・削除し、
 * 日本語やスペースを維持した安全なファイル名を作成します。
 * 
 * @param {string} name - ユーザーが入力した名前
 * @param {string} fallbackPrefix - フォールバック時の接頭辞
 * @returns {string} サニタイズされた安全なファイルベース名
 */
export function getSafeFilename(name, fallbackPrefix = 'file') {
  if (!name || typeof name !== 'string') {
    return `${fallbackPrefix}_${Date.now()}`;
  }

  // Windows, macOS, Linuxのファイルシステムで禁止されている文字、および制御文字を置換・削除
  // 禁止文字: \ / : * ? " < > |
  let safeName = name
    .replace(/[\\/:*?"<>|]/g, '_') // 禁止文字をアンダースコアに置換
    .replace(/[\x00-\x1f\x7f]/g, '') // 制御文字を削除
    .trim();

  // 空文字、または記号（ドット、アンダースコア、ハイフン）やスペースのみになってしまった場合の安全なフォールバック
  if (!safeName || /^[._\-\s]+$/.test(safeName)) {
    safeName = `${fallbackPrefix}_${Date.now()}`;
  }

  return safeName;
}

/**
 * MovieCreatorのAPIリクエストを処理するミドルウェアハンドラー。
 * Viteの `configureServer` から呼び出されることを想定しています。
 * 
 * @param {import('http').IncomingMessage} req - リクエストオブジェクト
 * @param {import('http').ServerResponse} res - レスポンスオブジェクト
 * @param {Function} next - 次のミドルウェアを呼び出すコールバック
 * @param {string} workspaceRoot - ワークスペースの絶対パス
 */
export function handleApiRequest(req, res, next, workspaceRoot) {
  // /api/ で始まらないリクエストはViteの静的ファイル処理やHMRにパスする
  if (!req.url || !req.url.startsWith('/api/')) {
    return next();
  }

  const parts = req.url.split('?');
  const pathname = parts[0];
  const queryString = parts[1] || '';
  const searchParams = new URLSearchParams(queryString);

  const projectsDir = path.resolve(workspaceRoot, 'projects');
  const presetsDir = path.resolve(workspaceRoot, 'presets');

  // ディレクトリがなければ自動作成する
  try {
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }
    if (!fs.existsSync(presetsDir)) {
      fs.mkdirSync(presetsDir, { recursive: true });
    }
  } catch (err) {
    console.error('[API Server] Storage directories creation failed:', err);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Server failed to initialize storage: ${err.message}` }));
    return;
  }

  // 1. GET /api/files - プロジェクトおよびプリセットのファイル一覧取得
  if (req.method === 'GET' && pathname === '/api/files') {
    try {
      const projects = fs.existsSync(projectsDir)
        ? fs.readdirSync(projectsDir).filter(f => f.endsWith('.mvproj'))
        : [];
      const presets = fs.existsSync(presetsDir)
        ? fs.readdirSync(presetsDir).filter(f => f.endsWith('.mvlayer'))
        : [];

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ projects, presets }));
    } catch (err) {
      console.error('[API Server] /api/files execution error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. POST /api/save - JSONデータの保存
  if (req.method === 'POST' && pathname === '/api/save') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        if (!body) {
          throw new Error('Request body is empty');
        }

        const parsed = JSON.parse(body);
        const { type, name, data } = parsed;

        if (!type || (type !== 'project' && type !== 'preset')) {
          throw new Error('Invalid type: must be "project" or "preset"');
        }
        if (!name) {
          throw new Error('Filename (name) is required');
        }
        if (!data) {
          throw new Error('Data payload is required');
        }

        // ファイル名を安全にサニタイズ
        const safeName = getSafeFilename(name, type);
        const dir = type === 'project' ? projectsDir : presetsDir;
        const ext = type === 'project' ? '.mvproj' : '.mvlayer';
        const filename = `${safeName}${ext}`;
        const filePath = path.join(dir, filename);

        // ディレクトリトラバーサル防止 (念のためベース名チェック)
        if (path.basename(filename) !== filename) {
          throw new Error('Invalid file path manipulation detected');
        }

        // ファイルへJSON書き込み (UTF-8)
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, file: filename }));
      } catch (err) {
        console.error('[API Server] /api/save execution error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. GET /api/load - JSONデータの読み込み
  if (req.method === 'GET' && pathname === '/api/load') {
    try {
      const type = searchParams.get('type');
      const file = searchParams.get('file');

      if (!type || (type !== 'project' && type !== 'preset')) {
        throw new Error('Invalid type parameter: must be "project" or "preset"');
      }
      if (!file) {
        throw new Error('Filename (file) parameter is required');
      }

      // ディレクトリトラバーサル攻撃対策: パス区切り文字を削除し、ファイル名だけを抽出
      const safeFile = path.basename(file);
      const dir = type === 'project' ? projectsDir : presetsDir;
      const filePath = path.join(dir, safeFile);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `File not found: ${safeFile}` }));
        return;
      }

      // ファイルの読み込みと送信
      const content = fs.readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(content);
    } catch (err) {
      console.error('[API Server] /api/load execution error:', err);
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // APIルートだが、GET/POST以外のメソッドや、未定義のエンドポイントへのリクエスト
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'API route not found' }));
}
