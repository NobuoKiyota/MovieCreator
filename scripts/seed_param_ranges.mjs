// Seeds/updates Excels/ParameterRanges.xlsx from the current hardcoded min/max values in
// src/engine/Generators.js (getParameterConfig() per generator class) and
// src/engine/fxParamRanges.js (FX_PARAM_RANGES, shared across all layers).
//
// Run manually: `node scripts/seed_param_ranges.mjs`
// Safe to re-run at any time (e.g. after adding a new generator or parameter): existing rows keep
// their Min/Max (Actual) columns untouched (that's the user's deliberately-edited value) while
// Min/Max (Reference) is refreshed to whatever the code currently ships with; only genuinely new
// (generator, param) or FX param rows get appended.
//
// After editing Min/Max (Actual) in Excel, run `python export_param_ranges.py` to sync the
// edits into data/param_ranges.json, which is what the app actually reads at runtime.

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

// SheetJS's ESM build doesn't auto-detect Node's s the way its CJS/UMD build does (same gotcha
// documented in src/server/apiHandler.js) - readFile/writeFile throw until this is wired in.
XLSX.set_fs(fs);

// MilkyWayGenerator's constructor calls document.createElement('canvas') to pre-allocate an
// offscreen buffer for later draw() calls - harmless in a browser, but this script runs in plain
// Node (no DOM). getParameterConfig() itself never touches canvas, so a minimal stub that just
// avoids throwing at construction time is enough; no real browser/jsdom dependency needed.
globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const EXCEL_PATH = path.join(PROJECT_ROOT, 'Excels', 'ParameterRanges.xlsx');

const { FX_PARAM_RANGES } = await import('../src/engine/fxParamRanges.js');
const Gen = await import('../src/engine/Generators.js');

// Mirrors LayerManager.js's createGenerator(type) switch 1:1 - keep in sync when adding a new
// generator type (the same 3-step registration process documented in CLAUDE.md already touches
// this exact list of files, so adding a line here is a natural 4th step).
const TYPE_TO_CLASS = {
  'sine-wave': Gen.SineWaveGenerator,
  'noise-wave': Gen.NoiseWaveGenerator,
  'particles': Gen.ParticlesGenerator,
  'geometry': Gen.GeometryGenerator,
  'growing-sketch': Gen.GrowingSketchGenerator,
  'rain': Gen.RainGenerator,
  'meteor': Gen.MeteorGenerator,
  'ripple': Gen.RippleGenerator,
  'spectrum': Gen.SpectrumGenerator,
  'cube-3d': Gen.Cube3DGenerator,
  'lightning': Gen.LightningGenerator,
  'fog': Gen.FogGenerator,
  'flame': Gen.FlameGenerator,
  'snowflake': Gen.SnowflakeGenerator,
  'spirograph': Gen.SpirographGenerator,
  'aurora': Gen.AuroraGenerator,
  'dry-ice': Gen.DryIceGenerator,
  'shape-3d-particles': Gen.Shape3DParticlesGenerator,
  'lighthouse': Gen.LighthouseGenerator,
  'shockwave-burst': Gen.ShockwaveBurstGenerator,
  'glass-crack': Gen.GlassCrackGenerator,
  'dot-design': Gen.DotDesignGenerator,
  'noise-glitch': Gen.NoiseGlitchGenerator,
  'milky-way': Gen.MilkyWayGenerator,
  'color-wash': Gen.ColorWashGenerator,
  'cracked-wall': Gen.CrackedWallGenerator,
  'magma-wall': Gen.MagmaWallGenerator
};

const GEN_SHEET_NAME = 'Generator Params';
const FX_SHEET_NAME = 'Common FX Params';
const GEN_HEADER = ['Generator Type', 'Param Name', 'Label', 'Step', 'Min (Actual)', 'Max (Actual)', 'Min (Reference)', 'Max (Reference)'];
const FX_HEADER = ['Param Name', 'Label', 'Step', 'Min (Actual)', 'Max (Actual)', 'Min (Reference)', 'Max (Reference)'];

function collectGeneratorRows() {
  const rows = [];
  for (const [type, GeneratorClass] of Object.entries(TYPE_TO_CLASS)) {
    const instance = new GeneratorClass();
    const configs = instance.getParameterConfig();
    for (const config of configs) {
      if (config.type !== 'range') continue; // 'color' params have no min/max to manage here
      rows.push({
        type,
        name: config.name,
        label: config.label,
        step: config.step,
        min: config.min,
        max: config.max
      });
    }
  }
  return rows;
}

function collectFxRows() {
  // FX_PARAM_RANGES only has min/max; label/step come from Controls.js's fxConfigs, which isn't
  // easily importable standalone in Node (it's built inside the Controls class constructor
  // alongside a lot of DOM-dependent setup) - a small hand-maintained label map is simpler and
  // more robust than trying to import/stub the whole Controls module just for this.
  const LABELS = {
    positionX: 'Position X', positionY: 'Position Y', rotation: 'Rotation', scale: 'Scale',
    strobe: 'Strobe Speed', glowIntensity: 'Neon Glow', feedbackDecay: 'Motion Trails',
    feedbackRotate: 'Trail Spin', distortionIntensity: 'Noise Warp', kaleidoscopeSegment: 'Kaleidoscope',
    mirrorMode: 'Mirror Mode', chromaticOffset: 'Chromatic Aberr', hueRotate: 'Hue Rotate',
    rotateX: 'Rotate X', rotateY: 'Rotate Y', rotateZ: 'Rotate Z', translateZ: 'Depth (Z)',
    medianBlurIntensity: 'Median Blur', embossIntensity: 'Emboss', motionBlurIntensity: 'Motion Blur',
    motionBlurAngle: 'Motion Blur Angle', radialBlurIntensity: 'Radial Blur'
  };
  return Object.entries(FX_PARAM_RANGES).map(([name, range]) => ({
    name,
    label: LABELS[name] || name,
    step: null,
    min: range.min,
    max: range.max
  }));
}

function sheetToRecords(ws, header) {
  if (!ws) return [];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  const records = [];
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row || row.every(v => v === null)) continue;
    const record = {};
    header.forEach((h, i) => { record[h] = row[i]; });
    records.push(record);
  }
  return records;
}

function mergeGeneratorRows(existingRecords, currentRows) {
  const existingByKey = new Map();
  for (const rec of existingRecords) {
    existingByKey.set(`${rec['Generator Type']}|${rec['Param Name']}`, rec);
  }
  const merged = [];
  for (const row of currentRows) {
    const key = `${row.type}|${row.name}`;
    const existing = existingByKey.get(key);
    if (existing) {
      merged.push([
        row.type, row.name, row.label, row.step,
        existing['Min (Actual)'], existing['Max (Actual)'], // preserve user edits
        row.min, row.max // refresh reference to current code
      ]);
      existingByKey.delete(key);
    } else {
      merged.push([row.type, row.name, row.label, row.step, row.min, row.max, row.min, row.max]);
    }
  }
  // Rows for (generator, param) combos no longer present in code (removed param/generator) are
  // preserved as-is at the end rather than silently deleted, so no data is lost unexpectedly.
  for (const rec of existingByKey.values()) {
    merged.push(GEN_HEADER.map(h => rec[h] ?? null));
  }
  return merged;
}

function mergeFxRows(existingRecords, currentRows) {
  const existingByKey = new Map();
  for (const rec of existingRecords) existingByKey.set(rec['Param Name'], rec);
  const merged = [];
  for (const row of currentRows) {
    const existing = existingByKey.get(row.name);
    if (existing) {
      merged.push([
        row.name, row.label, row.step,
        existing['Min (Actual)'], existing['Max (Actual)'],
        row.min, row.max
      ]);
      existingByKey.delete(row.name);
    } else {
      merged.push([row.name, row.label, row.step, row.min, row.max, row.min, row.max]);
    }
  }
  for (const rec of existingByKey.values()) {
    merged.push(FX_HEADER.map(h => rec[h] ?? null));
  }
  return merged;
}

const currentGenRows = collectGeneratorRows();
const currentFxRows = collectFxRows();

let workbook;
let existingGenRecords = [];
let existingFxRecords = [];
try {
  workbook = XLSX.readFile(EXCEL_PATH);
  existingGenRecords = sheetToRecords(workbook.Sheets[GEN_SHEET_NAME], GEN_HEADER);
  existingFxRecords = sheetToRecords(workbook.Sheets[FX_SHEET_NAME], FX_HEADER);
  console.log(`Existing workbook found: ${existingGenRecords.length} generator rows, ${existingFxRecords.length} FX rows.`);
} catch (e) {
  console.log('No existing workbook found - creating a new one from scratch.');
  workbook = XLSX.utils.book_new();
}

const genAoa = [GEN_HEADER, ...mergeGeneratorRows(existingGenRecords, currentGenRows)];
const fxAoa = [FX_HEADER, ...mergeFxRows(existingFxRecords, currentFxRows)];

const genSheet = XLSX.utils.aoa_to_sheet(genAoa);
const fxSheet = XLSX.utils.aoa_to_sheet(fxAoa);

// delete only removes the sheet's data, not its name from SheetNames, so re-adding via
// book_append_sheet would throw "already exists" on a re-run - replace the Sheets entry directly
// for names that already exist, and only use book_append_sheet for genuinely new sheet names.
const upsertSheet = (wb, sheet, name) => {
  if (wb.SheetNames.includes(name)) {
    wb.Sheets[name] = sheet;
  } else {
    XLSX.utils.book_append_sheet(wb, sheet, name);
  }
};
upsertSheet(workbook, genSheet, GEN_SHEET_NAME);
upsertSheet(workbook, fxSheet, FX_SHEET_NAME);

XLSX.writeFile(workbook, EXCEL_PATH, { compression: true });

console.log(`Written: ${EXCEL_PATH}`);
console.log(`Generator Params: ${genAoa.length - 1} rows. Common FX Params: ${fxAoa.length - 1} rows.`);
