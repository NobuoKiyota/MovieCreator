// Runtime application of Excels/ParameterRanges.xlsx -> data/param_ranges.json (see
// export_param_ranges.py / scripts/seed_param_ranges.mjs). Lets every parameter's min/max be
// tuned from the spreadsheet without touching Generators.js/fxParamRanges.js directly.
import { FX_PARAM_RANGES } from './fxParamRanges.js';

let generatorOverrides = {};

// Must resolve before the first Layer is constructed - LayerManager.initModulations() copies a
// param's min/max into this.modulations[name] ONCE at construction time, not read live
// afterward, so an override that arrives late would silently miss any layer already created
// (including main.js's hardcoded startup demo layers). Call and await this before instantiating
// the app, not fire-and-forget like the unrelated data/move_scores.json load.
export async function loadParamRangeOverrides() {
  // Prefer /api/param-ranges (npm run dev only): this endpoint re-reads Excels/ParameterRanges.xlsx
  // fresh on every request and regenerates data/param_ranges.json, so simply editing the Excel
  // file and reloading the app is enough - no need to remember to run export_param_ranges.py.
  // In a production build (no API middleware) this fetch 404s, so fall back to the plain static
  // file, which reflects whichever export_param_ranges.py run was last committed.
  let data = null;
  try {
    const res = await fetch('/api/param-ranges');
    if (res.ok) data = await res.json();
  } catch (e) {
    // dev API unavailable - fall through to the static file
  }
  if (!data) {
    try {
      const res = await fetch('/data/param_ranges.json');
      if (res.ok) data = await res.json();
    } catch (e) {
      // no committed fallback file either - keep code defaults
    }
  }
  if (data) {
    generatorOverrides = data.generatorParams || {};
    const fxOverrides = data.fxParams || {};
    // FX_PARAM_RANGES is a shared singleton object read directly (via `...R.xxx` spread) by
    // Controls.js's fxConfigs and by LayerManager's initModulations - mutating its entries in
    // place here means every consumer sees the override for free, no other file needs to change.
    for (const name in fxOverrides) {
      if (FX_PARAM_RANGES[name] && typeof fxOverrides[name].min === 'number' && typeof fxOverrides[name].max === 'number') {
        FX_PARAM_RANGES[name].min = fxOverrides[name].min;
        FX_PARAM_RANGES[name].max = fxOverrides[name].max;
      }
    }
  }
}

export function getGeneratorParamOverride(layerType, paramName) {
  const forType = generatorOverrides[layerType];
  if (!forType) return null;
  const override = forType[paramName];
  if (!override || typeof override.min !== 'number' || typeof override.max !== 'number') return null;
  return override;
}
