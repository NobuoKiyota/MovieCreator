// Single source of truth for common FX parameter min/max ranges, shared by
// LayerManager (modulation bounds) and Controls (inspector sliders/randomizer).
// Keyed by the actual parameter name stored on layer.effects / layer.modulations.
export const FX_PARAM_RANGES = {
  rotation:            { min: -360,  max: 360 },
  scale:               { min: 0.1,   max: 5.0 },
  strobe:              { min: 0,     max: 30  },
  glowIntensity:       { min: 0,     max: 50  },
  feedbackDecay:       { min: 0.0,   max: 0.95 },
  feedbackRotate:      { min: -0.05, max: 0.05 },
  distortionIntensity: { min: 0,     max: 40  },
  kaleidoscopeSegment: { min: 0,     max: 12  },
  chromaticOffset:     { min: 0,     max: 30  },
  rotateX:             { min: -180,  max: 180 },
  rotateY:             { min: -180,  max: 180 },
  rotateZ:             { min: -180,  max: 180 },
  translateZ:          { min: -600,  max: 600 }
};
