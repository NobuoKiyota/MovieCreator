import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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
 * ProRes 4444変換に使うffmpegバイナリの絶対パスを解決します。
 * まずプロジェクト直下にベンダリングされたバイナリ(`tools/ffmpeg/`、gitignore対象、
 * PCごとに個別配置)を探し、無ければPATH上の`ffmpeg`にフォールバックします。
 *
 * @param {string} workspaceRoot - ワークスペースの絶対パス
 * @returns {string} spawnに渡すffmpeg実行ファイルのパスまたはコマンド名
 */
function findFfmpegBinary(workspaceRoot) {
  const vendoredDir = path.resolve(workspaceRoot, 'tools', 'ffmpeg');
  const candidate = path.join(vendoredDir, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  return 'ffmpeg'; // PATH上のffmpegにフォールバック
}

/**
 * scores.json(教師データ)を読み込む。JSONが破損している場合は、
 * 破損ファイルをタイムスタンプ付きで退避してから空配列で復旧する
 * （評価データの蓄積が全損しないようにするためのフォールバック）。
 *
 * @param {string} scoresPath - scores.jsonの絶対パス
 * @returns {Array} スコア評価レコードの配列
 */
function loadScoresWithFallback(scoresPath) {
  if (!fs.existsSync(scoresPath)) {
    return [];
  }
  const fileContent = fs.readFileSync(scoresPath, 'utf-8');
  try {
    return JSON.parse(fileContent);
  } catch (err) {
    const backupPath = scoresPath.replace(/\.json$/, `.corrupted-${Date.now()}.json`);
    console.error(`[API Server] scores.json is corrupted (${err.message}). Backing up to ${backupPath} and starting fresh.`);
    try {
      fs.copyFileSync(scoresPath, backupPath);
    } catch (backupErr) {
      console.error('[API Server] Failed to back up corrupted scores.json:', backupErr);
    }
    return [];
  }
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
  const dataDir = path.resolve(workspaceRoot, 'data');
  const scoresPath = path.join(dataDir, 'scores.json');

  // ディレクトリがなければ自動作成する
  try {
    if (!fs.existsSync(projectsDir)) {
      fs.mkdirSync(projectsDir, { recursive: true });
    }
    if (!fs.existsSync(presetsDir)) {
      fs.mkdirSync(presetsDir, { recursive: true });
    }
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(scoresPath)) {
      fs.writeFileSync(scoresPath, '[]', 'utf-8');
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

  // 4. POST /api/score - Save layer parameters and user score evaluation
  if (req.method === 'POST' && pathname === '/api/score') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        if (!body) {
          throw new Error('Request body is empty');
        }
        const parsed = JSON.parse(body);
        const { layerType, params, effects, modulations, score, reasons, rating, comment, paramFlags } = parsed;

        if (!layerType || !score) {
          throw new Error('layerType and score parameters are required');
        }

        // Load current scores.json
        let scores = loadScoresWithFallback(scoresPath);

        // Append new score evaluation record
        const record = {
          id: Date.now() + Math.random().toString(36).substr(2, 5),
          timestamp: new Date().toISOString(),
          layerType,
          params: params || {},
          effects: effects || {},
          modulations: modulations || {},
          score,
          reasons: reasons || [],
          rating: typeof rating === 'number' ? rating : undefined,
          comment: typeof comment === 'string' ? comment : '',
          paramFlags: (paramFlags && typeof paramFlags === 'object') ? paramFlags : {}
        };

        scores.push(record);

        // Write back to scores.json
        fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2), 'utf-8');

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, record }));
      } catch (err) {
        console.error('[API Server] /api/score execution error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 5. GET /api/scores - Retrieve all score histories
  if (req.method === 'GET' && pathname === '/api/scores') {
    try {
      const scores = loadScoresWithFallback(scoresPath);
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(scores));
    } catch (err) {
      console.error('[API Server] /api/scores execution error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 6. POST /api/transcode-prores - 透過WebMをProRes 4444(alpha)のMOVへローカルffmpegで変換
  if (req.method === 'POST' && pathname === '/api/transcode-prores') {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const webmBuffer = Buffer.concat(chunks);
      if (webmBuffer.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Request body (WebM binary) is empty' }));
        return;
      }

      const tmpDir = path.resolve(workspaceRoot, '.tmp_transcode');
      try {
        if (!fs.existsSync(tmpDir)) {
          fs.mkdirSync(tmpDir, { recursive: true });
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `Failed to create temp transcode dir: ${err.message}` }));
        return;
      }

      const baseName = getSafeFilename(searchParams.get('filename'), 'transcode') + `_${Date.now()}`;
      const inputPath = path.join(tmpDir, `${baseName}.webm`);
      const outputPath = path.join(tmpDir, `${baseName}.mov`);

      const cleanup = () => {
        try { if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath); } catch (_) {}
        try { if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath); } catch (_) {}
      };

      try {
        fs.writeFileSync(inputPath, webmBuffer);
      } catch (err) {
        cleanup();
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `Failed to write temp WebM file: ${err.message}` }));
        return;
      }

      const ffmpegPath = findFfmpegBinary(workspaceRoot);
      const ffmpegArgs = [
        '-y',
        '-i', inputPath,
        '-c:v', 'prores_ks',
        '-profile:v', '4444',
        '-pix_fmt', 'yuva444p10le',
        '-vendor', 'apl0',
        outputPath
      ];

      let stderrOutput = '';
      const ffmpegProcess = spawn(ffmpegPath, ffmpegArgs);

      ffmpegProcess.stderr.on('data', (data) => { stderrOutput += data.toString(); });

      ffmpegProcess.on('error', (err) => {
        cleanup();
        console.error('[API Server] /api/transcode-prores ffmpeg spawn error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `ffmpeg could not be launched (${ffmpegPath}): ${err.message}` }));
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0 || !fs.existsSync(outputPath)) {
          cleanup();
          console.error('[API Server] /api/transcode-prores ffmpeg failed:', stderrOutput.slice(-2000));
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: `ffmpeg transcode failed (exit code ${code})`, stderr: stderrOutput.slice(-2000) }));
          return;
        }

        try {
          const movBuffer = fs.readFileSync(outputPath);
          res.writeHead(200, {
            'Content-Type': 'video/quicktime',
            'Content-Disposition': `attachment; filename="${baseName}.mov"`,
            'Content-Length': movBuffer.length
          });
          res.end(movBuffer);
        } catch (err) {
          console.error('[API Server] /api/transcode-prores read output error:', err);
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: `Failed to read transcoded MOV: ${err.message}` }));
        } finally {
          cleanup();
        }
      });
    });
    return;
  }

  // APIルートだが、GET/POST以外のメソッドや、未定義のエンドポイントへのリクエスト
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'API route not found' }));
}
