// Normalized keyframe automation shapes (0.0 to 1.0 range).
// These templates define shapes similar to Wwise/DAW automation curves
// and are scaled to the actual parameter range and session duration at runtime.
export const MOTION_TEMPLATES = {
  SlowDriftUp: [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 1.0, easing: 'ease-in-out' }
  ],
  SlowDriftDown: [
    { time: 0.0, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],
  PingPong: [
    { time: 0.0, value: 0.0, easing: 'ease-in-out' },
    { time: 0.5, value: 1.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.0, easing: 'ease-in-out' }
  ],
  PulseDecay: [
    { time: 0.0, value: 0.0, easing: 'ease-out' },
    { time: 0.08, value: 1.0, easing: 'ease-out' },
    { time: 1.0, value: 0.0, easing: 'ease-out' }
  ],
  SineLFO: [
    { time: 0.0, value: 0.5, easing: 'ease-in-out' },
    { time: 0.25, value: 1.0, easing: 'ease-in-out' },
    { time: 0.75, value: 0.0, easing: 'ease-in-out' },
    { time: 1.0, value: 0.5, easing: 'ease-in-out' }
  ],
  StepHold: [
    { time: 0.0, value: 0.0, easing: 'step' },
    { time: 0.33, value: 0.5, easing: 'step' },
    { time: 0.66, value: 1.0, easing: 'step' },
    { time: 1.0, value: 0.0, easing: 'step' }
  ]
};
