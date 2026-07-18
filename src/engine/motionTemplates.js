// Normalized keyframe automation shapes (0.0 to 1.0 range).
// These templates define shapes similar to Wwise/DAW automation curves
// and are scaled to the actual parameter range and session duration at runtime.
// Categorized by point count (2P, 3P, 4P, MP) for intuitive UX.
export const MOTION_TEMPLATES = {
  // --- 2-Point Curves (Simple transitions) ---
  "2P_DriftUp": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 1.0, easing: 'ease-in-out' }
  ],
  "2P_DriftDown": [
    { time: 0.0, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],
  "2P_LinearUp": [
    { time: 0.0, value: 0.0, easing: 'linear' },
    { time: 1.0, value: 1.0, easing: 'linear' }
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

  // --- Multi-Point Curves (Multi-cycle LFO / Vibration) ---
  "MP_DoublePingPong": [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.25, value: 1.0, easing: 'ease-in-out' },
    { time: 0.5, value: 0.0, easing: 'ease-in-out' },
    { time: 0.75, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],
  "MP_SineLFO_3x": [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.16, value: 1.0, easing: 'ease-in-out' },
    { time: 0.5, value: 0.0, easing: 'ease-in-out' },
    { time: 0.83, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ],
  "MP_VibratoDecay": [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.2, value: 1.0, easing: 'ease-in-out' },
    { time: 0.4, value: 0.2, easing: 'ease-in-out' },
    { time: 0.6, value: 0.7, easing: 'ease-in-out' },
    { time: 0.8, value: 0.4, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ]
};
