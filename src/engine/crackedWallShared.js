// Shared geometry/camera/wriggle math for CrackedWallGenerator (fast, jagged, instant-snap) and
// MagmaWallGenerator (slow, thick, undulating) - both are "camera glides across an infinite
// cracked/veined wall" generators built from the same angular shard-network algorithm and the
// same closed-loop camera/wriggle math, differing only in their tuned parameter defaults/ranges.
// Kept out of Generators.js so the two classes' own defaultParams()/getParameterConfig() stay
// independently tunable without their randomizer/Move-score similarity space (keyed per
// layer.type) ever mixing incompatible fast-snap vs slow-undulating parameter combinations.

// Builds a mostly-straight, sharply-kinked crack line with occasional forks - same technique as
// GlassCrackGenerator.buildShardLine (real fractures bend only at flaws, unlike a fine all-scale
// zigzag), duplicated here as a standalone function since Generators.js doesn't export the
// instance-method version and both wall generators need it independent of any one instance.
export function buildShardLine(x1, y1, angle, length, kinkCount, kinkJitterDeg, forkChance) {
  const segCount = Math.max(1, Math.round(kinkCount) + 1);
  const weights = [];
  let wSum = 0;
  for (let i = 0; i < segCount; i++) {
    const w = 0.7 + Math.random() * 0.6;
    weights.push(w);
    wSum += w;
  }

  const points = [{ x: x1, y: y1 }];
  const branches = [];
  let curX = x1, curY = y1, curAngle = angle;
  for (let i = 0; i < segCount; i++) {
    if (i > 0) curAngle += (Math.random() - 0.5) * 2 * (kinkJitterDeg * Math.PI / 180);
    const segLen = length * (weights[i] / wSum);
    curX += Math.cos(curAngle) * segLen;
    curY += Math.sin(curAngle) * segLen;
    points.push({ x: curX, y: curY });

    if (Math.random() < forkChance) {
      const branchAngle = curAngle + (Math.random() < 0.5 ? -1 : 1) * (18 + Math.random() * 22) * Math.PI / 180;
      const branchLen = segLen * (0.5 + Math.random() * 0.5);
      branches.push([
        { x: curX, y: curY },
        { x: curX + Math.cos(branchAngle) * branchLen, y: curY + Math.sin(branchAngle) * branchLen }
      ]);
    }
  }

  return { points, branches };
}

// Uniform-area scatter of a point within radius `fieldRadius * areaFrac` of the origin
// (sqrt(Math.random()) so points don't bunch up near the center).
export function scatterFieldPoint(fieldRadius, areaFrac = 0.85) {
  const ang = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * fieldRadius * areaFrac;
  return { x: Math.cos(ang) * r, y: Math.sin(ang) * r };
}

// Assigns each vein a persistent wriggle "signature" (random phase, per-point wave-phase step,
// and two INTEGER harmonic numbers) once at generation time, so per-frame wriggle is just a
// couple of sin() calls per point and closes perfectly over one cycle (see getWriggledPoints).
export function assignWriggleSignature(vein) {
  vein.harmonicA = 2 + Math.floor(Math.random() * 3); // 2-4
  vein.harmonicB = vein.harmonicA + 1 + Math.floor(Math.random() * 2); // +1 or +2, still an integer
  vein.wavePhaseStep = 0.6 + Math.random() * 1.2;
  vein.ampJitter = 0.6 + Math.random() * 0.8;
  vein.basePhase = Math.random() * Math.PI * 2;
}

// Builds a full shard network (trunks + forked branches + independent hairline cracks) covering
// a virtual field. Field radius is deliberately tighter than a first attempt's 2.2x maxDim (that
// version read as far too sparse/scattered) - 1.6x maxDim packs the same vein/hairline counts into
// a visibly denser "wall of cracks" instead of a few marks lost in empty space.
export function generateShardNetwork(width, height, params) {
  const maxDim = Math.max(width, height);
  const fieldRadius = maxDim * 1.6;

  const trunkCount = Math.max(1, Math.round(params.veinDensity));
  const kinkCount = Math.max(1, Math.round(params.complexity));
  const kinkJitterDeg = 10 + params.displace * 0.4;
  const primaryWidth = params.primaryWidth;
  const hairlineWidth = primaryWidth * params.hairlineWidthRatio;

  const veins = [];

  for (let i = 0; i < trunkCount; i++) {
    const s = scatterFieldPoint(fieldRadius, 0.85);
    const angle = Math.random() * Math.PI * 2;
    const len = params.branchLength * (0.7 + Math.random() * 0.6);
    const { points, branches } = buildShardLine(s.x, s.y, angle, len, kinkCount, kinkJitterDeg, params.branchChance);
    veins.push({ points, width: primaryWidth * (0.8 + Math.random() * 0.4), isPrimary: true });
    for (const b of branches) {
      veins.push({ points: b, width: hairlineWidth * (1.3 + Math.random() * 0.6), isPrimary: false });
    }
  }

  // Fine standalone hairline cracks, independent of any trunk - fills in the "resting" area
  // between major fissures so the network reads as one continuous cracked surface rather than a
  // handful of isolated lines.
  const hairlineCount = Math.max(0, Math.round(params.hairlineCount));
  for (let i = 0; i < hairlineCount; i++) {
    const s = scatterFieldPoint(fieldRadius, 0.9);
    const angle = Math.random() * Math.PI * 2;
    const len = params.branchLength * (0.12 + Math.random() * 0.18);
    const { points } = buildShardLine(s.x, s.y, angle, len, 1 + Math.round(Math.random()), kinkJitterDeg * 1.3, 0);
    veins.push({ points, width: hairlineWidth * (0.6 + Math.random() * 0.5), isPrimary: false });
  }

  veins.forEach(v => assignWriggleSignature(v));

  return { veins, fieldRadius };
}

// Returns a wriggled copy of one vein's point array at a given progress (0-1): each point is
// pushed along its local normal by an offset built from sin() of INTEGER harmonics of
// progress*2*PI, so pose(progress=1) === pose(progress=0) exactly (guaranteed seamless loop, same
// closure technique as computeCameraPose below). Per-point phase increases with point index
// (wavePhaseStep), so the wriggle travels along the crack like a living squirm rather than the
// whole line rocking rigidly in phase.
export function getWriggledPoints(vein, progress, wriggleAmount) {
  if (wriggleAmount <= 0) return vein.points;
  const ang = progress * Math.PI * 2;
  const pts = vein.points;
  const n = pts.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[i > 0 ? i - 1 : 0];
    const next = pts[i < n - 1 ? i + 1 : n - 1];
    const dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const phase = vein.basePhase + i * vein.wavePhaseStep;
    const offset = wriggleAmount * vein.ampJitter *
      (Math.sin(vein.harmonicA * ang + phase) + 0.5 * Math.sin(vein.harmonicB * ang + phase * 1.7 + 1.3));
    out[i] = { x: p.x + nx * offset, y: p.y + ny * offset };
  }
  return out;
}

// Camera pose as a closed function of progress (0->1): every term is built from sin/cos of an
// INTEGER harmonic of progress*2*PI, so pose(progress=1) === pose(progress=0) exactly - guaranteed
// seamless looping. Mode 2's rotation is the one exception, closed for a different reason:
// rotating a full 2*PI turn renders identically to not rotating at all.
export function computeCameraPose(progress, params, maxDim) {
  const ang = progress * Math.PI * 2;
  const mode = Math.round(params.cameraPathMode);
  const panRange = maxDim * 0.5 * params.cameraPanAmplitude;
  const zoomBase = params.cameraZoomBase;
  const zoomAmp = params.cameraZoomAmplitude;
  const rotAmpRad = (params.cameraRotationAmplitude * Math.PI) / 180;
  const seedKey = Math.round(params.seed) || 0;

  let x = 0, y = 0, zoom = zoomBase, rot = 0;

  if (mode === 1) {
    // Sweep & Return: linear back-and-forth dolly along one diagonal axis. Axis angle derives
    // from the seed so different rerolls read as sliding a different direction.
    const axis = (seedKey % 8) * (Math.PI / 4);
    const t = Math.sin(ang); // -1 -> 1 -> -1, smooth reversal at both ends
    x = Math.cos(axis) * t * panRange;
    y = Math.sin(axis) * t * panRange;
    zoom = zoomBase + zoomAmp * Math.cos(ang) * 0.6;
    rot = rotAmpRad * Math.sin(ang * 2) * 0.4;
  } else if (mode === 2) {
    // Slow Spiral Zoom: one full 360deg revolution per cycle plus a slow breathing zoom.
    rot = ang;
    x = Math.cos(ang) * panRange * 0.5;
    y = Math.sin(ang) * panRange * 0.5;
    zoom = zoomBase + zoomAmp * Math.sin(ang);
  } else {
    // Mode 0 (default): Orbit - a slow elliptical loop around a point in the vein field.
    x = Math.cos(ang) * panRange;
    y = Math.sin(ang) * panRange * 0.65;
    zoom = zoomBase + zoomAmp * Math.sin(ang);
    rot = rotAmpRad * Math.sin(ang);
  }

  zoom = Math.max(0.5, zoom);
  return { x, y, zoom, rot };
}

// Fills a tapered (variable-width) glow line through a point array in a single flat color/alpha -
// the "light fissure glowing in darkness" look this pair of generators wants, as opposed to
// GlassCrackGenerator's dark-shadow+bright-highlight bevel fill (which assumes a lit surface being
// cut, the wrong metaphor for a glowing crack in a dark wall).
export function fillTaperedGlowLine(ctx, points, widthStart, widthEnd, rgb, alpha) {
  if (!points || points.length < 2) return;
  const total = points.length - 1;
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  ctx.beginPath();
  for (let i = 0; i < total; i++) {
    const p1 = points[i], p2 = points[i + 1];
    const w1 = widthStart + (widthEnd - widthStart) * (i / total);
    const w2 = widthStart + (widthEnd - widthStart) * ((i + 1) / total);
    const dx = p2.x - p1.x, dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const h1 = w1 / 2, h2 = w2 / 2;
    ctx.moveTo(p1.x + nx * h1, p1.y + ny * h1);
    ctx.lineTo(p2.x + nx * h2, p2.y + ny * h2);
    ctx.lineTo(p2.x - nx * h2, p2.y - ny * h2);
    ctx.lineTo(p1.x - nx * h1, p1.y - ny * h1);
    ctx.closePath();
  }
  ctx.fill();
}
