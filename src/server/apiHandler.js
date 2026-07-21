import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import * as XLSX from 'xlsx';

// SheetJS's ESM build doesn't auto-detect Node's `fs` the way its CJS/UMD build does, so
// XLSX.readFile/writeFile throw "Cannot access file" until this is wired in explicitly.
XLSX.set_fs(fs);

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
 * PresetLayerOpinionSheet.xlsx「Preset Layers Opinion Sheet」タブの行3ヘッダー(表示名)と
 * index.htmlの#layer-type-selectの内部typeコードの対応表。export_move_scores.py/
 * export_motion_mapping.pyのLAYER_NAME_TO_TYPEと同一内容を維持すること(手動同期)。
 */
const OPINION_SHEET_NAME = 'Preset Layers Opinion Sheet';
const LAYER_NAME_TO_TYPE = {
  'Sine Wave': 'sine-wave',
  'Noise Wave': 'noise-wave',
  'Firefly Particles': 'particles',
  'Lissajous Geometry': 'geometry',
  'Growing Sketch': 'growing-sketch',
  'Neon Rain': 'rain',
  'Meteor Shower': 'meteor',
  'Pulse Ripples': 'ripple',
  'Audio Spectrum': 'spectrum',
  '3D Glowing Cube': 'cube-3d',
  'Neon Lightning': 'lightning',
  'Neon Fog': 'fog',
  'Cyber Flame': 'flame',
  'Neon Snowflake': 'snowflake',
  'Neon Spirograph': 'spirograph',
  'Aurora Curtain': 'aurora',
  'Dry Ice Smoke': 'dry-ice',
  '3D Shape Particles': 'shape-3d-particles',
  'Lighthouse Beacon': 'lighthouse',
  'Shockwave Burst': 'shockwave-burst',
  'Glass Crack': 'glass-crack'
};
const TYPE_TO_LAYER_NAME = Object.fromEntries(Object.entries(LAYER_NAME_TO_TYPE).map(([name, type]) => [type, name]));

// Layer types registered into the opinion sheet *after* it was first authored (see
// registerNewLayerColumn) can't be added to the hardcoded LAYER_NAME_TO_TYPE above without a code
// change every time, so their name<->type mapping is persisted here instead and merged on top of
// the hardcoded map on every request - this is what lets a brand new generator (added to
// Generators.js/LayerManager.js/index.html, per the "adding a new generator" steps in CLAUDE.md)
// get picked up by the Opinion Sheet Editor automatically instead of hitting a "not recognized"
// error, without anyone having to remember to also edit this file.
function getCustomLayerNameMapPath(dataDir) {
  return path.join(dataDir, 'opinion_sheet_layer_map.json');
}

function loadCustomLayerNameMap(dataDir) {
  const p = getCustomLayerNameMapPath(dataDir);
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (err) {
    console.error('[API Server] opinion_sheet_layer_map.json is corrupted, ignoring:', err.message);
    return {};
  }
}

function saveCustomLayerNameMap(dataDir, map) {
  fs.writeFileSync(getCustomLayerNameMapPath(dataDir), JSON.stringify(map, null, 2), 'utf-8');
}

// The map actually used to resolve row-3 header text to an internal layer type code - the
// hardcoded 21 plus anything auto-registered later.
function getCombinedLayerNameMap(dataDir) {
  return { ...LAYER_NAME_TO_TYPE, ...loadCustomLayerNameMap(dataDir) };
}

function isBlankOrDash(val) {
  return val === null || val === undefined || (typeof val === 'string' && (val.trim() === '' || val.trim() === '-'));
}

// A literal "-" (not blank) is the explicit "this parameter doesn't apply to this layer" marker
// used throughout the sheet - readOpinionRows uses this (not isBlankOrDash) to decide whether to
// skip a row, so a genuinely blank cell (no score/move entered yet, e.g. right after
// registerNewLayerColumn adds a new column) still shows up in the editor ready to fill in,
// instead of silently vanishing the same way a real "-" would.
function isDash(val) {
  return typeof val === 'string' && val.trim() === '-';
}

/**
 * 行3(0-indexed row 2)をD列(0-indexed col 3)から3列おきにスキャンし、認識したレイヤータイプごとの
 * Score/Move/Comment列(0-indexed)を返す。export_move_scores.pyのlayer_cols構築ロジックと同一。
 * nameToType は getCombinedLayerNameMap() の結果(ハードコード分 + 自動登録分)を渡すこと。
 */
function parseLayerColumns(rows, nameToType) {
  const layerCols = {};
  const headerRow = rows[2] || [];
  for (let col = 3; col < headerRow.length; col += 3) {
    const name = headerRow[col];
    if (!name) continue;
    const layerType = nameToType[String(name).trim()];
    if (layerType) {
      layerCols[layerType] = { score: col, move: col + 1, comment: col + 2 };
    }
  }
  return layerCols;
}

/**
 * ワークブックから該当レイヤーの実データ行を抽出する(「-」で明示的に非該当マークされた行のみ除外。
 * 空欄は「該当するがまだ未評価」を意味し、score/moveをnullにしたまま結果に含める)。
 * rowは書き戻し先を特定するための1-indexed実行番号。
 */
function readOpinionRows(workbook, layerType, nameToType) {
  const ws = workbook.Sheets[OPINION_SHEET_NAME];
  if (!ws) throw new Error(`Sheet not found: ${OPINION_SHEET_NAME}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const layerCols = parseLayerColumns(rows, nameToType);
  const cols = layerCols[layerType];
  if (!cols) throw new Error(`Layer type not recognized in opinion sheet: ${layerType}`);

  const result = [];
  for (let r = 4; r < rows.length; r++) {
    const row = rows[r] || [];
    const colA = row[0];
    if (colA && String(colA).trim().startsWith('---')) continue; // category banner row
    const paramName = row[1];
    if (!paramName) continue;

    const scoreVal = row[cols.score];
    const moveVal = row[cols.move];
    const commentVal = row[cols.comment];
    if (isDash(scoreVal) || isDash(moveVal)) continue; // explicitly marked not applicable to this layer

    result.push({
      row: r + 1,
      param: String(paramName).trim(),
      label: row[2] ? String(row[2]).trim() : String(paramName).trim(),
      score: isBlankOrDash(scoreVal) ? null : Number(scoreVal),
      move: isBlankOrDash(moveVal) ? null : Number(moveVal),
      comment: (commentVal === null || commentVal === undefined) ? '' : String(commentVal)
    });
  }
  return result;
}

/**
 * 指定レイヤーの行群にScore/Move/Commentを書き戻す。updatesの各要素のrowはreadOpinionRowsが
 * 返した1-indexed行番号をそのまま使う。
 */
function writeOpinionRows(workbook, layerType, updates, nameToType) {
  const ws = workbook.Sheets[OPINION_SHEET_NAME];
  if (!ws) throw new Error(`Sheet not found: ${OPINION_SHEET_NAME}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const layerCols = parseLayerColumns(rows, nameToType);
  const cols = layerCols[layerType];
  if (!cols) throw new Error(`Layer type not recognized in opinion sheet: ${layerType}`);

  for (const u of updates) {
    const r0 = u.row - 1;
    if (typeof u.score === 'number' && !Number.isNaN(u.score)) {
      XLSX.utils.sheet_add_aoa(ws, [[u.score]], { origin: { r: r0, c: cols.score } });
    }
    if (typeof u.move === 'number' && !Number.isNaN(u.move)) {
      XLSX.utils.sheet_add_aoa(ws, [[u.move]], { origin: { r: r0, c: cols.move } });
    }
    if (typeof u.comment === 'string') {
      XLSX.utils.sheet_add_aoa(ws, [[u.comment]], { origin: { r: r0, c: cols.comment } });
    }
  }
}

/**
 * 全レイヤー分のMove列を再スキャンし、data/move_scores.jsonを再生成する。export_move_scores.py
 * を手動実行しなくても保存時点で常に最新化されるようにするため、同じロジックをここに移植。
 */
function regenerateMoveScores(workbook, dataDir, nameToType) {
  const ws = workbook.Sheets[OPINION_SHEET_NAME];
  if (!ws) throw new Error(`Sheet not found: ${OPINION_SHEET_NAME}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const layerCols = parseLayerColumns(rows, nameToType);

  const mapping = {};
  for (const layerType of Object.values(nameToType)) mapping[layerType] = {};

  for (let r = 4; r < rows.length; r++) {
    const row = rows[r] || [];
    const colA = row[0];
    if (colA && String(colA).trim().startsWith('---')) continue;
    const paramName = row[1];
    if (!paramName) continue;
    const pName = String(paramName).trim();

    for (const [layerType, cols] of Object.entries(layerCols)) {
      const moveVal = row[cols.move];
      if (isBlankOrDash(moveVal)) continue;
      const num = Number(moveVal);
      if (!Number.isNaN(num)) mapping[layerType][pName] = num;
    }
  }

  const outPath = path.join(dataDir, 'move_scores.json');
  fs.writeFileSync(outPath, JSON.stringify(mapping, null, 2), 'utf-8');
  return mapping;
}

/**
 * Appends a brand-new Score/Move/Comment column block to the opinion sheet for a layer type it
 * has never seen before, so newly added generators (Milky Way, and anything added after it) stop
 * needing a manual Excel edit before the Opinion Sheet Editor / Move-score gating can see them.
 *
 * - Adds one new 3-column block at the end of the header row (row 3 = display name, row 4 =
 *   Score/Move/Comment), with `displayName` as the label.
 * - For every existing param row: if its Parameter name (column B) is one of this layer's own
 *   params (from `paramList`), the new column's cells are left blank (= "applicable, not yet
 *   scored" - readOpinionRows only skips a row when a layer's cells are blank/dash *there*, so a
 *   blank cell here means it'll show up in the editor ready to fill in). Rows under the "Common
 *   FX" category are always left blank too, since every layer goes through the same FX pipeline.
 *   Anything else gets "-" (not applicable), matching how the existing 21 columns are marked.
 * - Any of this layer's own params that don't already have a row anywhere get one appended after
 *   the last existing row (Category left as 'Generator' even though it lands after the FX
 *   section - readOpinionRows/parseLayerColumns only look at columns A/B for these rows, not
 *   position, so this is functionally fine, just not as tidy for someone reading the raw Excel).
 *   Every *other* already-registered layer's cells on these brand new rows are marked "-" as they
 *   didn't have this param at all.
 *
 * Mutates `ws` in place; does not touch the workbook. Returns nothing - caller re-reads via
 * readOpinionRows() with the now-updated nameToType map to hand back the fresh rows.
 */
function registerNewLayerColumn(workbook, layerType, displayName, paramList, nameToType) {
  const ws = workbook.Sheets[OPINION_SHEET_NAME];
  if (!ws) throw new Error(`Sheet not found: ${OPINION_SHEET_NAME}`);
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const existingLayerCols = parseLayerColumns(rows, nameToType);

  // Next free 3-column block, right after the last registered layer's Comment column.
  let maxCol = 2; // column C (label) is the last fixed column before the first layer block at D
  for (const cols of Object.values(existingLayerCols)) {
    maxCol = Math.max(maxCol, cols.comment);
  }
  const newCol = maxCol + 1;

  XLSX.utils.sheet_add_aoa(ws, [[displayName]], { origin: { r: 2, c: newCol } });
  XLSX.utils.sheet_add_aoa(ws, [['Score', 'Move', 'Comment']], { origin: { r: 3, c: newCol } });

  const ownParamNames = new Set((paramList || []).map(p => String(p.name)));
  const foundNames = new Set();
  let lastRowIndex = 4; // 0-indexed; rows.length may already exceed this

  for (let r = 4; r < rows.length; r++) {
    lastRowIndex = Math.max(lastRowIndex, r);
    const row = rows[r] || [];
    const colA = row[0];
    if (colA && String(colA).trim().startsWith('---')) continue; // category banner row
    const paramName = row[1];
    if (!paramName) continue;
    const pName = String(paramName).trim();

    const isCommonFx = colA && String(colA).trim() === 'Common FX';
    if (isCommonFx || ownParamNames.has(pName)) {
      if (ownParamNames.has(pName)) foundNames.add(pName);
      continue; // leave this layer's 3 new cells blank - applicable, not yet scored
    }
    XLSX.utils.sheet_add_aoa(ws, [['-', '-', '-']], { origin: { r, c: newCol } });
  }

  // Any of this layer's own params with no existing row anywhere get a fresh one appended at the
  // bottom, with every other already-registered layer marked "-" (this param didn't exist for
  // them) and this layer's own cells left blank (applicable, not yet scored).
  let nextRow = lastRowIndex + 1;
  for (const p of (paramList || [])) {
    const pName = String(p.name);
    if (foundNames.has(pName)) continue;
    const label = p.label ? String(p.label) : pName;
    XLSX.utils.sheet_add_aoa(ws, [['Generator', pName, label]], { origin: { r: nextRow, c: 0 } });
    for (const cols of Object.values(existingLayerCols)) {
      XLSX.utils.sheet_add_aoa(ws, [['-', '-', '-']], { origin: { r: nextRow, c: cols.score } });
    }
    nextRow++;
  }

  // sheet_add_aoa keeps !ref in sync with the cells it touches, but make sure the sheet's
  // recorded range actually extends far enough right/down in case some writes above landed
  // beyond whatever !ref previously covered (e.g. no rows were appended this call).
  const range = XLSX.utils.decode_range(ws['!ref']);
  range.e.c = Math.max(range.e.c, newCol + 2);
  range.e.r = Math.max(range.e.r, nextRow - 1);
  ws['!ref'] = XLSX.utils.encode_range(range);
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
  const outputDir = path.resolve(workspaceRoot, 'output');
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
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
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

  // 6. GET /api/opinion-sheet - 指定レイヤータイプのScore/Move/Comment行を読み込む。
  // レイヤータイプが未登録の場合、displayName/paramsクエリが渡っていれば新しい列を自動追加する
  // (registerNewLayerColumn参照) - 新規ジェネレーター追加のたびにこのファイルを手動で触らずに済む。
  if (req.method === 'GET' && pathname === '/api/opinion-sheet') {
    try {
      const layerType = searchParams.get('layer');
      if (!layerType) {
        throw new Error('layer query parameter is required');
      }
      const excelPath = path.resolve(workspaceRoot, 'Excels', 'PresetLayerOpinionSheet.xlsx');
      if (!fs.existsSync(excelPath)) {
        throw new Error(`Opinion sheet not found: ${excelPath}`);
      }
      const workbook = XLSX.readFile(excelPath);
      let nameToType = getCombinedLayerNameMap(dataDir);
      let rows;
      try {
        rows = readOpinionRows(workbook, layerType, nameToType);
      } catch (notFoundErr) {
        const displayName = searchParams.get('displayName');
        const paramsRaw = searchParams.get('params');
        if (!displayName || !paramsRaw) throw notFoundErr;

        let paramList;
        try {
          paramList = JSON.parse(paramsRaw);
        } catch (_) {
          throw new Error('params query parameter must be valid JSON');
        }

        registerNewLayerColumn(workbook, layerType, displayName, paramList, nameToType);
        const customMap = loadCustomLayerNameMap(dataDir);
        customMap[displayName] = layerType;
        saveCustomLayerNameMap(dataDir, customMap);
        XLSX.writeFile(workbook, excelPath, { compression: true });

        nameToType = getCombinedLayerNameMap(dataDir);
        regenerateMoveScores(workbook, dataDir, nameToType);
        rows = readOpinionRows(workbook, layerType, nameToType);
        console.log(`[API Server] Auto-registered new opinion sheet column for layer type "${layerType}" ("${displayName}")`);
      }
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ layerType, rows }));
    } catch (err) {
      console.error('[API Server] /api/opinion-sheet GET execution error:', err);
      res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 6b. POST /api/opinion-sheet - Score/Move/Commentを書き戻し、data/move_scores.jsonを再生成
  if (req.method === 'POST' && pathname === '/api/opinion-sheet') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        if (!body) {
          throw new Error('Request body is empty');
        }
        const parsed = JSON.parse(body);
        const { layerType, updates } = parsed;
        if (!layerType || !Array.isArray(updates)) {
          throw new Error('layerType and updates (array) are required');
        }

        const excelPath = path.resolve(workspaceRoot, 'Excels', 'PresetLayerOpinionSheet.xlsx');
        if (!fs.existsSync(excelPath)) {
          throw new Error(`Opinion sheet not found: ${excelPath}`);
        }
        const workbook = XLSX.readFile(excelPath);
        const nameToType = getCombinedLayerNameMap(dataDir);
        writeOpinionRows(workbook, layerType, updates, nameToType);
        // 2026-07-20: SheetJSの無料版はスタイル情報を完全には保持できず、フォーマットは簡略化される
        // (ユーザー確認済み・許容範囲。データ本体は正しく保持される)。compression:trueが無いと
        // ファイルサイズが約7倍に膨張するため必須。
        XLSX.writeFile(workbook, excelPath, { compression: true });

        // 保存直後にdata/move_scores.jsonも再生成し、export_move_scores.pyの手動実行を不要にする
        regenerateMoveScores(workbook, dataDir, nameToType);

        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        console.error('[API Server] /api/opinion-sheet POST execution error:', err);
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 7. POST /api/transcode-prores - 透過WebMをProRes 4444(alpha)のMOVへローカルffmpegで変換
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

  // 8. POST /api/save-export - 書き出した動画(MP4/WebM/MOV)をブラウザのダウンロードフォルダではなく
  // ワークスペース直下のoutput/へ直接保存する。ブラウザのdownload属性は保存先ディレクトリを
  // JS側から指定できない(ブラウザの設定に依存する)ため、サーバー側でfsに書き込むことで
  // 自宅/会社PCどちらでも常に同じ場所に集約する。開発サーバー(npm run dev)経由でのみ有効。
  if (req.method === 'POST' && pathname === '/api/save-export') {
    const chunks = [];
    req.on('data', chunk => { chunks.push(chunk); });
    req.on('end', () => {
      const fileBuffer = Buffer.concat(chunks);
      if (fileBuffer.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Request body (video binary) is empty' }));
        return;
      }

      const requestedName = searchParams.get('filename') || 'export';
      const ext = path.extname(requestedName) || '.mp4';
      const baseNoExt = requestedName.slice(0, requestedName.length - ext.length);
      const filename = `${getSafeFilename(baseNoExt, 'export')}${ext}`;
      const filePath = path.join(outputDir, filename);

      // ディレクトリトラバーサル防止 (念のためベース名チェック)
      if (path.basename(filename) !== filename) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: 'Invalid file path manipulation detected' }));
        return;
      }

      try {
        fs.writeFileSync(filePath, fileBuffer);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, file: filename, path: filePath }));
      } catch (err) {
        console.error('[API Server] /api/save-export write error:', err);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: `Failed to write export file: ${err.message}` }));
      }
    });
    return;
  }

  // APIルートだが、GET/POST以外のメソッドや、未定義のエンドポイントへのリクエスト
  res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: 'API route not found' }));
}
