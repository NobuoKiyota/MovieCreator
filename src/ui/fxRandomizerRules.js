/**
 * Per-common-FX-parameter randomization rules used by Controls.js's randomizeLayer(). Extracted
 * from a single 400+ line `for (let fxName in this.fxConfigs)` loop full of `if (fxName === 'X')`
 * branches, so each parameter's bespoke tuning (clamps, mutation magnitude, LFO/keyframe
 * handling) has a name and a home instead of being buried in one giant function. Pure functions
 * only (no `this`) - callers precompute anything that needs DOM/closure access (export duration,
 * Good-attraction centroids) and pass the resulting plain values in.
 *
 * Each function returns { value, modulation } matching what the caller assigns into
 * candidateEffects[fxName] / candidateModulations[fxName].
 */

// Shared shape for FX parameters deliberately excluded from randomization (see CLAUDE.md's
// "ガチャ回避" notes) - almost never improves the look left to chance, so always forced to a
// fixed value with modulation disabled. Used by positionX, positionY, strobe,
// distortionIntensity, kaleidoscopeSegment, mirrorMode, chromaticOffset, rotateY, rotateZ,
// translateZ.
export function forceFxOff(value = 0) {
  return {
    value,
    modulation: {
      enabled: false,
      min: 0,
      max: 0,
      timePct: 50,
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    }
  };
}

// rotation: Basically 0. Occasionally rotate 1 or 2 turns over export duration.
export function randomizeRotation({ durationVal }) {
  const isSpin = Math.random() < 0.15; // 15% chance to rotate
  if (isSpin) {
    const maxFrames = durationVal * 60;
    const turns = Math.random() < 0.5 ? 1 : 2;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const finalRot = 360 * turns * dir;
    return {
      value: 0,
      modulation: {
        enabled: false,
        min: 0,
        max: 0,
        timePct: 50,
        behavior: 'repeat',
        keyframeEnabled: true,
        keyframes: [
          { frame: 0, value: 0, easing: 'linear' },
          { frame: maxFrames, value: finalRot, easing: 'linear' }
        ]
      }
    };
  }
  return {
    value: 0,
    modulation: {
      enabled: false,
      min: 0,
      max: 0,
      timePct: 50,
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    }
  };
}

// scale: Minimum 1.0. Move very slowly when animated.
export function randomizeScale({ layer, config, spread, hasScaleIssue, hasNothingVisible, hasAspectBreak, tempRotation, goodAttractionWeight, goodScaleCentroid }) {
  const range = config.max - config.min;
  let localMin = config.min;
  const localMax = config.max;

  localMin = Math.max(1.0, localMin);
  if (hasScaleIssue || hasNothingVisible) {
    localMin = Math.max(1.2, localMin);
  }
  if (hasAspectBreak && Math.abs(tempRotation) > 5) {
    localMin = Math.max(1.42, localMin); // cover diagonal
  }

  let baseVal = layer.effects['scale'] !== undefined ? layer.effects['scale'] : 1.0;
  baseVal = Math.max(localMin, baseVal);
  if (goodScaleCentroid !== null && goodAttractionWeight > 0) {
    baseVal = baseVal * (1 - goodAttractionWeight) + goodScaleCentroid * goodAttractionWeight;
  }
  const offset = (Math.random() * 2 - 1) * (range * spread * 0.08); // small mutation offset
  let newVal = baseVal + offset;
  newVal = Math.max(localMin, Math.min(localMax, newVal));

  const mod = layer.modulations['scale'];
  let modulation;
  if (mod) {
    const candidateMod = JSON.parse(JSON.stringify(mod));
    candidateMod.jitterBase = newVal;
    if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
      candidateMod.keyframes.forEach(kf => {
        const kfOffset = (Math.random() * 2 - 1) * (range * spread * 0.05); // slowly move
        let newKfVal = kf.value + kfOffset;
        newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
        kf.value = newKfVal;
      });
    } else if (mod.enabled) {
      const offsetMin = (Math.random() * 2 - 1) * 0.05;
      const offsetMax = (Math.random() * 2 - 1) * 0.05;
      let newMin = mod.min + offsetMin;
      let newMax = mod.max + offsetMax;
      newMin = Math.max(localMin, Math.min(localMax, newMin));
      newMax = Math.max(localMin, Math.min(localMax, newMax));
      if (Math.abs(newMax - newMin) > 0.4) {
        newMax = newMin + 0.25; // limit variance to prevent large scale breaks
      }
      candidateMod.min = newMin;
      candidateMod.max = newMax;
      candidateMod.timePct = 80 + Math.floor(Math.random() * 20); // very slow (80% - 100%)
    } else {
      candidateMod.min = newVal;
      candidateMod.max = newVal;
    }
    modulation = candidateMod;
  } else {
    modulation = {
      enabled: false,
      min: newVal,
      max: newVal,
      timePct: 50,
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    };
  }

  return { value: newVal, modulation };
}

// glowIntensity: Neon Glow - make it highly visible (above 40-50)
export function randomizeGlowIntensity({ layer, config, spread, hasNothingVisible, hasTooChaotic, goodAttractionWeight, goodGlowCentroid }) {
  const range = config.max - config.min;
  let localMin = config.min;
  let localMax = config.max;

  localMin = Math.max(40, localMin);
  if (hasNothingVisible) {
    localMin = Math.max(60, localMin);
  }
  if (hasTooChaotic) {
    localMax = Math.min(80, localMax);
  }
  let baseVal = layer.effects['glowIntensity'] !== undefined ? layer.effects['glowIntensity'] : 65;
  if (baseVal < 40) baseVal = 55 + Math.random() * 25;

  if (goodGlowCentroid !== null && goodAttractionWeight > 0) {
    baseVal = baseVal * (1 - goodAttractionWeight) + goodGlowCentroid * goodAttractionWeight;
  }

  const offset = (Math.random() * 2 - 1) * (range * spread * 0.15);
  let newVal = baseVal + offset;
  newVal = Math.max(localMin, Math.min(localMax, newVal));

  const mod = layer.modulations['glowIntensity'];
  let modulation;
  if (mod) {
    const candidateMod = JSON.parse(JSON.stringify(mod));
    candidateMod.jitterBase = newVal;
    if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
      candidateMod.keyframes.forEach(kf => {
        const kfOffset = (Math.random() * 2 - 1) * (range * spread * 0.1);
        let newKfVal = kf.value + kfOffset;
        newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
        kf.value = newKfVal;
      });
    } else if (mod.enabled) {
      const offsetMin = (Math.random() * 2 - 1) * (range * spread * 0.1);
      const offsetMax = (Math.random() * 2 - 1) * (range * spread * 0.1);
      let newMin = mod.min + offsetMin;
      let newMax = mod.max + offsetMax;
      newMin = Math.max(localMin, Math.min(localMax, newMin));
      newMax = Math.max(localMin, Math.min(localMax, newMax));
      candidateMod.min = newMin;
      candidateMod.max = newMax;
    } else {
      candidateMod.min = newVal;
      candidateMod.max = newVal;
    }
    modulation = candidateMod;
  } else {
    modulation = {
      enabled: false,
      min: newVal,
      max: newVal,
      timePct: 50,
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    };
  }

  return { value: newVal, modulation };
}

// feedbackDecay: Motion Trails - highly effective. High value, slow keyframes.
export function randomizeFeedbackDecay({ layer, config, spread, hasTooChaotic, goodAttractionWeight, goodDecayCentroid }) {
  const range = config.max - config.min;
  let localMin = config.min;
  let localMax = config.max;

  localMin = Math.max(0.70, localMin);
  localMax = Math.min(0.92, localMax); // Hard cap 0.92
  if (hasTooChaotic) {
    localMax = Math.min(0.85, localMax);
  }

  let baseVal = layer.effects['feedbackDecay'] !== undefined ? layer.effects['feedbackDecay'] : 0.84;
  if (baseVal < 0.70) baseVal = 0.78 + Math.random() * 0.08;

  if (goodDecayCentroid !== null && goodAttractionWeight > 0) {
    baseVal = baseVal * (1 - goodAttractionWeight) + goodDecayCentroid * goodAttractionWeight;
  }

  const offset = (Math.random() * 2 - 1) * (range * spread * 0.05); // very small fluctuation
  let newVal = baseVal + offset;
  newVal = Math.max(localMin, Math.min(localMax, newVal));

  // 30% chance to auto-enable slow LFO if not modulated, as it creates great random movement elements
  let mod = layer.modulations['feedbackDecay'];
  if (!mod && Math.random() < 0.3) {
    mod = {
      enabled: true,
      min: 0.75,
      max: 0.88,
      timePct: 80 + Math.floor(Math.random() * 20),
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    };
  }

  let modulation;
  if (mod) {
    const candidateMod = JSON.parse(JSON.stringify(mod));
    candidateMod.jitterBase = newVal;
    if (mod.keyframeEnabled && mod.keyframes && mod.keyframes.length > 0) {
      candidateMod.keyframes.forEach(kf => {
        const kfOffset = (Math.random() * 2 - 1) * 0.03; // slow changes
        let newKfVal = kf.value + kfOffset;
        newKfVal = Math.max(localMin, Math.min(localMax, newKfVal));
        kf.value = newKfVal;
      });
    } else if (mod.enabled) {
      const offsetMin = (Math.random() * 2 - 1) * 0.02;
      const offsetMax = (Math.random() * 2 - 1) * 0.02;
      let newMin = mod.min + offsetMin;
      let newMax = mod.max + offsetMax;
      newMin = Math.max(localMin, Math.min(localMax, newMin));
      newMax = Math.max(localMin, Math.min(localMax, newMax));
      candidateMod.min = newMin;
      candidateMod.max = newMax;
      candidateMod.timePct = 80 + Math.floor(Math.random() * 20); // slow (80% - 100%)
    } else {
      candidateMod.min = newVal;
      candidateMod.max = newVal;
    }
    modulation = candidateMod;
  } else {
    modulation = {
      enabled: false,
      min: newVal,
      max: newVal,
      timePct: 50,
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    };
  }

  return { value: newVal, modulation };
}

// feedbackRotate: Trail Spin - effect is extreme, keyframes have almost no effect. Mostly off,
// occasional spice (2026-07-20: was 80% nonzero, users reported unwanted spin showing up even
// when 0 was clearly correct - now matches the "mostly off" pattern used by rotation/rotateX).
export function randomizeFeedbackRotate() {
  const isSpin = Math.random() < 0.2;
  const spinOpts = [-0.015, 0.015, -0.006, 0.006];
  const val = isSpin ? spinOpts[Math.floor(Math.random() * spinOpts.length)] : 0;
  return {
    value: val,
    modulation: {
      enabled: false,
      min: val,
      max: val,
      timePct: 50,
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    }
  };
}

// rotateX: can be used if rotated slowly (30% chance of a slow LFO).
export function randomizeRotateX() {
  const isAnimateX = Math.random() < 0.3;
  if (isAnimateX) {
    return {
      value: 0,
      modulation: {
        enabled: true,
        min: -15,
        max: 15,
        timePct: 80 + Math.floor(Math.random() * 20), // slow movement
        behavior: 'return',
        keyframeEnabled: false,
        keyframes: []
      }
    };
  }
  return {
    value: 0,
    modulation: {
      enabled: false,
      min: 0,
      max: 0,
      timePct: 50,
      behavior: 'return',
      keyframeEnabled: false,
      keyframes: []
    }
  };
}
