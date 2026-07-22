// Shared fractal line generation (recursive midpoint displacement), extracted from
// LightningGenerator so other generators needing a similarly fine, all-scale jagged path can
// reuse it instead of re-implementing it. Currently used only by LightningGenerator - despite an
// earlier plan to share this with GlassCrackGenerator too, glass fractures turned out to need a
// visually different shape (mostly-straight lines with a few sharp kinks, not a fine zigzag), so
// GlassCrackGenerator has its own buildShardLine() instead (see its comment). See CLAUDE.md's
// generator-addition guide.

/**
 * Generates a jagged line from (x1,y1) to (x2,y2) via recursive midpoint displacement,
 * returning the main path as an array of {x,y} points. Side-branches spawned along the way
 * (with probability branchChance) are pushed into branchesList as their own point arrays.
 *
 * @param {Function|null} computeBranchTarget - optional (cx, cy, displace, x2, y2) => {bx, by}
 *   controlling where a branch's endpoint goes. Defaults to an omnidirectional random offset;
 *   pass a custom callback for biased branch growth (e.g. lightning's "grow downwards").
 */
export function generateFractalBranch(x1, y1, x2, y2, displace, depth, branchChance, branchesList = [], computeBranchTarget = null) {
  if (depth <= 0) {
    return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  }

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;

  // Normal vector to offset perpendicular to the path
  const nx = -dy / len;
  const ny = dx / len;

  const offset = (Math.random() - 0.5) * displace;
  const cx = midX + nx * offset;
  const cy = midY + ny * offset;

  const left = generateFractalBranch(x1, y1, cx, cy, displace / 2, depth - 1, branchChance, branchesList, computeBranchTarget);
  const right = generateFractalBranch(cx, cy, x2, y2, displace / 2, depth - 1, branchChance, branchesList, computeBranchTarget);

  const segments = left.slice(0, -1).concat(right);

  if (Math.random() < branchChance && depth > 2) {
    const target = computeBranchTarget
      ? computeBranchTarget(cx, cy, displace, x2, y2)
      : { bx: cx + (Math.random() - 0.5) * displace * 2, by: cy + (Math.random() - 0.5) * displace * 2 };
    const branchSegments = generateFractalBranch(cx, cy, target.bx, target.by, displace / 2.5, depth - 2, branchChance, branchesList, computeBranchTarget);
    branchesList.push(branchSegments);
  }

  return segments;
}
