// Normalized keyframe automation shapes (0.0 to 1.0 range).
// These templates define shapes similar to Wwise/DAW automation curves
// and are scaled to the actual parameter range and session duration at runtime.
// Categorized by exact point count (2P to 10P) for intuitive UX.

const BASE_TEMPLATES = {
  // --- 2-Point Curves (Simple transitions) ---
  "2P_LinearUp": [
    { time: 0.0, value: 0.0, easing: 'linear' },
    { time: 1.0, value: 1.0, easing: 'linear' }
  ],
  "2P_DriftUp1": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 1.0, easing: 'ease-in-out' }
  ],
  "2P_DriftUp2": [
    { time: 0.0, value: 0.0, easing: 'ease-in' },
    { time: 1.0, value: 1.0, easing: 'ease-in' }
  ],
  "2P_DriftUp3": [
    { time: 0.0, value: 0.0, easing: 'ease-out' },
    { time: 1.0, value: 1.0, easing: 'ease-out' }
  ],
  "2P_DriftDown1": [
    { time: 0.0, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],
  "2P_DriftDown2": [
    { time: 0.0, value: 1.0, easing: 'ease-in' },
    { time: 1.0, value: 0.0, easing: 'ease-in' }
  ],
  "2P_DriftDown3": [
    { time: 0.0, value: 1.0, easing: 'ease-out' },
    { time: 1.0, value: 0.0, easing: 'ease-out' }
  ],
  "2P_LinearDown": [
    { time: 0.0, value: 1.0, easing: 'linear' },
    { time: 1.0, value: 0.0, easing: 'linear' }
  ],
  "2P_SuddenOn": [
    { time: 0.0, value: 0.0, easing: 'ease-in' },
    { time: 1.0, value: 1.0, easing: 'ease-in' }
  ],
  "2P_SuddenOff": [
    { time: 0.0, value: 1.0, easing: 'ease-in' },
    { time: 1.0, value: 0.0, easing: 'ease-in' }
  ],

  // --- 3-Point Curves (1-cycle PingPong, ADSR Pulse/Decay) ---
  "3P_PingPong": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.5, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],
  "3P_VShape": [
    { time: 0.0, value: 1.0, easing: 'ease-in-out' },
    { time: 0.5, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 1.0, easing: 'ease-in-out' }
  ],
  "3P_PulseDecay": [
    { time: 0.0, value: 0.0, easing: 'ease-out' },
    { time: 0.08, value: 1.0, easing: 'ease-out' },
    { time: 1.0, value: 0.0, easing: 'ease-out' }
  ],
  "3P_DelayedRise": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.5, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 1.0, easing: 'ease-in-out' }
  ],
  "3P_DelayedFall": [
    { time: 0.0, value: 1.0, easing: 'ease-in-out' },
    { time: 0.5, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],

  // --- 4-Point Curves (S-Curve, Steps, Double trigger) ---
  "4P_SCurve": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.33, value: 0.25, easing: 'ease-in-out' },
    { time: 0.66, value: 0.75, easing: 'ease-in-out' },
    { time: 1.0, value: 1.0, easing: 'ease-in-out' }
  ],
  "4P_NCurve": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.35, value: 1.0, easing: 'ease-in-out' },
    { time: 0.65, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 1.0, easing: 'ease-in-out' }
  ],
  "4P_Step3": [
    { time: 0.0, value: 0.0, easing: 'step' },
    { time: 0.33, value: 0.33, easing: 'step' },
    { time: 0.66, value: 0.66, easing: 'step' },
    { time: 1.0, value: 0.0, easing: 'step' }
  ],
  "4P_DoublePulse": [
    { time: 0.0, value: 0.0, easing: 'ease-out' },
    { time: 0.12, value: 1.0, easing: 'ease-out' },
    { time: 0.25, value: 0.0, easing: 'ease-out' },
    { time: 0.38, value: 1.0, easing: 'ease-out' },
    { time: 1.0, value: 0.0, easing: 'ease-out' }
  ],

  // --- 5-Point Curves (Double PingPong, ADSR) ---
  "5P_DoublePingPong": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.25, value: 1.0, easing: 'ease-in-out' },
    { time: 0.5, value: 0.0, easing: 'ease-in-out' },
    { time: 0.75, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],
  "5P_ADSR": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.1, value: 1.0, easing: 'ease-in-out' },
    { time: 0.25, value: 0.65, easing: 'ease-in-out' },
    { time: 0.8, value: 0.65, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],

  // --- 6-Point Curves (Vibrato decay, 2.5x wave) ---
  "6P_VibratoDecay": [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.2, value: 1.0, easing: 'ease-in-out' },
    { time: 0.4, value: 0.2, easing: 'ease-in-out' },
    { time: 0.6, value: 0.7, easing: 'ease-in-out' },
    { time: 0.8, value: 0.4, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ],
  "6P_SineLFO_2.5x": [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.2, value: 1.0, easing: 'ease-in-out' },
    { time: 0.4, value: 0.0, easing: 'ease-in-out' },
    { time: 0.6, value: 1.0, easing: 'ease-in-out' },
    { time: 0.8, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ],

  // --- 7-Point Curves (3x LFO wave, Triple PingPong) ---
  "7P_SineLFO_3x": [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.16, value: 1.0, easing: 'ease-in-out' },
    { time: 0.33, value: 0.0, easing: 'ease-in-out' },
    { time: 0.5, value: 1.0, easing: 'ease-in-out' },
    { time: 0.66, value: 0.0, easing: 'ease-in-out' },
    { time: 0.83, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ],
  "7P_TriplePingPong": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.16, value: 1.0, easing: 'ease-in-out' },
    { time: 0.33, value: 0.0, easing: 'ease-in-out' },
    { time: 0.5, value: 1.0, easing: 'ease-in-out' },
    { time: 0.66, value: 0.0, easing: 'ease-in-out' },
    { time: 0.83, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],

  // --- 8-Point Curves (Stutter pulse, 3.5x wave) ---
  "8P_StutterPulse": [
    { time: 0.0, value: 0.0, easing: 'ease-out' },
    { time: 0.1, value: 1.0, easing: 'ease-out' },
    { time: 0.2, value: 0.0, easing: 'ease-out' },
    { time: 0.3, value: 0.0, easing: 'ease-out' },
    { time: 0.4, value: 1.0, easing: 'ease-out' },
    { time: 0.5, value: 0.0, easing: 'ease-out' },
    { time: 0.7, value: 1.0, easing: 'ease-out' },
    { time: 1.0, value: 0.0, easing: 'ease-out' }
  ],
  "8P_SineLFO_3.5x": [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.14, value: 1.0, easing: 'ease-in-out' },
    { time: 0.28, value: 0.0, easing: 'ease-in-out' },
    { time: 0.42, value: 1.0, easing: 'ease-in-out' },
    { time: 0.56, value: 0.0, easing: 'ease-in-out' },
    { time: 0.7, value: 1.0, easing: 'ease-in-out' },
    { time: 0.84, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ],

  // --- 9-Point Curves (4x wave LFO) ---
  "9P_SineLFO_4x": [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.12, value: 1.0, easing: 'ease-in-out' },
    { time: 0.25, value: 0.0, easing: 'ease-in-out' },
    { time: 0.37, value: 1.0, easing: 'ease-in-out' },
    { time: 0.5, value: 0.0, easing: 'ease-in-out' },
    { time: 0.62, value: 1.0, easing: 'ease-in-out' },
    { time: 0.75, value: 0.0, easing: 'ease-in-out' },
    { time: 0.87, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ],

  // --- 10-Point Curves (Galop Rhythm) ---
  "10P_GalopRhythm": [
    { time: 0.0, value: 0.0, easing: 'ease-out' },
    { time: 0.1, value: 1.0, easing: 'ease-out' },
    { time: 0.18, value: 0.0, easing: 'ease-out' },
    { time: 0.25, value: 1.0, easing: 'ease-out' },
    { time: 0.33, value: 0.0, easing: 'ease-out' },
    { time: 0.5, value: 1.0, easing: 'ease-out' },
    { time: 0.58, value: 0.0, easing: 'ease-out' },
    { time: 0.65, value: 1.0, easing: 'ease-out' },
    { time: 0.73, value: 0.0, easing: 'ease-out' },
    { time: 1.0, value: 0.0, easing: 'ease-out' }
  ]
};

export const MOTION_TEMPLATES = {};

// Auto-generate 1.0, 0.5, 0.25 scaling variations for ALL base templates
for (const [key, kfs] of Object.entries(BASE_TEMPLATES)) {
  // 1.0 (Full strength)
  MOTION_TEMPLATES[key] = kfs;
  
  // 0.5 (Half strength)
  MOTION_TEMPLATES[`${key}_Half`] = kfs.map(kf => ({
    ...kf,
    value: kf.value * 0.5
  }));
  
  // 0.25 (Quarter strength)
  MOTION_TEMPLATES[`${key}_Quarter`] = kfs.map(kf => ({
    ...kf,
    value: kf.value * 0.25
  }));
}
