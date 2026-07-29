// Single source of truth for common FX parameter min/max/step ranges, shared by
// LayerManager (modulation bounds) and Controls (inspector sliders/randomizer).
// Keyed by the actual parameter name stored on layer.effects / layer.modulations.
// `step` used to be hardcoded separately per-entry in Controls.js's fxConfigs (duplicated,
// out of sync with this file) - consolidated here so Parameter Ranges (see
// paramRangeOverrides.js) can override it the same way it already overrides min/max.
export const FX_PARAM_RANGES = {
  positionX:           { min: -1,    max: 1,    step: 0.01  }, // fraction of canvas width, 0 = center
  positionY:           { min: -1,    max: 1,    step: 0.01  }, // fraction of canvas height, 0 = center
  rotation:            { min: -360,  max: 360,  step: 1     },
  scale:               { min: 0.1,   max: 5.0,  step: 0.05  },
  strobe:              { min: 0,     max: 30,   step: 0.5   },
  glowIntensity:       { min: 0,     max: 100,  step: 1     },
  feedbackDecay:       { min: 0.0,   max: 0.95, step: 0.01  },
  feedbackRotate:      { min: -0.05, max: 0.05, step: 0.001 },
  distortionIntensity: { min: 0,     max: 40,   step: 1     },
  mirrorMode:          { min: 0,     max: 13,   step: 1     }, // 0=off,1=L-R,2=U-D,3=quad,4/5=6-way(+alt),6/7=8-way(+alt),8/9=12-way(+alt),10/11=16-way(+alt),12/13=20-way(+alt)
  chromaticOffset:     { min: 0,     max: 30,   step: 0.5   },
  hueRotate:           { min: -180,  max: 180,  step: 1     }, // degrees, native CSS/Canvas hue-rotate() filter - lets `color` itself become an LFO/keyframe/Move-scored target without touching any generator's own color param
  rotateX:             { min: -180,  max: 180,  step: 1     },
  rotateY:             { min: -180,  max: 180,  step: 1     },
  rotateZ:             { min: -180,  max: 180,  step: 1     },
  translateZ:          { min: -600,  max: 600,  step: 5     },
  medianBlurIntensity: { min: 0,     max: 100,  step: 1     },
  embossIntensity:     { min: 0,     max: 100,  step: 1     },
  motionBlurIntensity: { min: 0,     max: 60,   step: 1     },
  motionBlurAngle:     { min: 0,     max: 360,  step: 1     },
  radialBlurIntensity: { min: 0,     max: 1,    step: 0.01  },
  edgeDetectIntensity: { min: 0,     max: 100,  step: 1     },
  pixelateBlockSize:   { min: 0,     max: 64,   step: 1     },
  posterizeLevels:     { min: 0,     max: 32,   step: 1     },
  solarizeThreshold:   { min: 0,     max: 255,  step: 1     },
  spherizeIntensity:      { min: 0, max: 100, step: 1 },
  littlePlanetIntensity:  { min: 0, max: 100, step: 1 },
  canvasTextureIntensity: { min: 0, max: 100, step: 1 },
  paperTileIntensity:     { min: 0, max: 100, step: 1 },
  cartoonIntensity:       { min: 0, max: 100, step: 1 },
  oilifyIntensity:        { min: 0, max: 100, step: 1 },
  glassTileIntensity:     { min: 0, max: 100, step: 1 },
  seamlessTileIntensity:  { min: 0, max: 100, step: 1 }
};
