'use strict';

/**
 * Guillotine Bin Packing - Placement Strategies
 * 
 * Implements guillotine-compatible rectangle packing with multiple heuristics.
 * Each placement splits free space into exactly two sub-rectangles via a
 * full-width or full-height cut (guillotine constraint).
 */

const KERF = 1; // blade clearance in mm (fabric cutting — near-zero kerf)

// ── Free-rectangle selection rules ──────────────────────────────────────────

const RectChoiceHeuristics = {
  /** Best Area Fit: pick smallest-area free rect that fits */
  BAF: (freeRect, w, h) => freeRect.w * freeRect.h - w * h,
  /** Best Short Side Fit: minimize shorter leftover side */
  BSSF: (freeRect, w, h) => Math.min(freeRect.w - w, freeRect.h - h),
  /** Best Long Side Fit: minimize longer leftover side */
  BLSF: (freeRect, w, h) => Math.max(freeRect.w - w, freeRect.h - h),
  /** Worst Area Fit: pick largest free rect (fill big spaces first) */
  WAF: (freeRect, w, h) => -(freeRect.w * freeRect.h - w * h),
  /** Bottom-Left: prefer lowest Y, then leftmost X */
  BL: (freeRect) => freeRect.y * 100000 + freeRect.x,
};

// ── Split rules after placing a panel ───────────────────────────────────────

const SplitRules = {
  /**
   * Shorter Leftover Split: split to minimize the shorter remaining side.
   * Tends to create more square-ish leftovers (better for future panels).
   */
  SLS: 0,
  /** Longer Leftover Split */
  LLS: 1,
  /** Split along shorter free-rect axis */
  SAS: 2,
  /** Split along longer free-rect axis */
  LAS: 3,
  /** Horizontal split (cut horizontally below panel) */
  HSPLIT: 4,
  /** Vertical split (cut vertically right of panel) */
  VSPLIT: 5,
};

/**
 * Decide split direction after placing panel (w×h) in freeRect.
 * Returns true for horizontal split, false for vertical split.
 *
 *  Horizontal split:              Vertical split:
 *  ┌──────┬────────┐              ┌──────┬────────┐
 *  │Panel │  Right │              │Panel │        │
 *  │ w×h  │        │              │ w×h  │ Right  │
 *  ├──────┴────────┤              ├──────┤        │
 *  │    Bottom     │              │Below │        │
 *  └───────────────┘              └──────┴────────┘
 */
function chooseSplit(freeRect, w, h, splitRule) {
  const remW = freeRect.w - w - KERF;
  const remH = freeRect.h - h - KERF;

  switch (splitRule) {
    case SplitRules.SLS:
      return remW < remH; // horizontal if width leftover is shorter
    case SplitRules.LLS:
      return remW >= remH;
    case SplitRules.SAS:
      return freeRect.w < freeRect.h;
    case SplitRules.LAS:
      return freeRect.w >= freeRect.h;
    case SplitRules.HSPLIT:
      return true;
    case SplitRules.VSPLIT:
      return false;
    default:
      return remW < remH;
  }
}

/**
 * Core guillotine packing engine.
 *
 * @param {Array} panels       - [{id, width, height, label}]
 * @param {Array} order        - Permutation indices into panels
 * @param {Array} rotations    - Boolean array, rotate[i] for panels[order[i]]
 * @param {number} stockWidth  - Available width (3000mm)
 * @param {string} rectChoice  - Key from RectChoiceHeuristics
 * @param {number} splitRule   - Value from SplitRules
 * @returns {{ height: number, placed: Array, allPlaced: boolean }}
 */
function guillotinePack(panels, order, rotations, stockWidth, rectChoice = 'BAF', splitRule = SplitRules.SLS) {
  const heuristic = RectChoiceHeuristics[rectChoice] || RectChoiceHeuristics.BAF;

  // Start with one huge free rectangle
  const freeRects = [{ x: 0, y: 0, w: stockWidth, h: 99999 }];
  const placed = [];
  let maxY = 0;

  for (let i = 0; i < order.length; i++) {
    const panel = panels[order[i]];
    const rotate = rotations[i];
    let pw = rotate ? panel.height : panel.width;
    let ph = rotate ? panel.width : panel.height;

    // Ensure panel fits in stock width
    if (pw > stockWidth && ph > stockWidth) {
      return { height: Infinity, placed, allPlaced: false };
    }
    if (pw > stockWidth) {
      // Force rotation
      [pw, ph] = [ph, pw];
    }

    // Find best free rectangle
    let bestIdx = -1;
    let bestScore = Infinity;
    let bestW = pw, bestH = ph;

    for (let r = 0; r < freeRects.length; r++) {
      const fr = freeRects[r];

      // Try original orientation
      if (pw <= fr.w && ph <= fr.h) {
        const score = heuristic(fr, pw, ph);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = r;
          bestW = pw;
          bestH = ph;
        }
      }

      // Try rotated (if different and fits)
      if (pw !== ph && ph <= fr.w && pw <= fr.h) {
        const score = heuristic(fr, ph, pw);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = r;
          bestW = ph;
          bestH = pw;
        }
      }
    }

    if (bestIdx === -1) {
      return { height: Infinity, placed, allPlaced: false };
    }

    const fr = freeRects[bestIdx];

    // Place panel at top-left of free rectangle
    placed.push({
      id: panel.id,
      label: panel.label,
      x: fr.x,
      y: fr.y,
      width: bestW,
      height: bestH,
      rotated: bestW !== panel.width,
    });

    maxY = Math.max(maxY, fr.y + bestH);

    // Split the free rectangle (guillotine cut)
    const horizontal = chooseSplit(fr, bestW, bestH, splitRule);
    freeRects.splice(bestIdx, 1);

    if (horizontal) {
      // Right remainder (above the cut line)
      const rw = fr.w - bestW - KERF;
      if (rw > 10 && bestH > 10) {
        freeRects.push({ x: fr.x + bestW + KERF, y: fr.y, w: rw, h: bestH });
      }
      // Bottom remainder (below the cut line)
      const bh = fr.h - bestH - KERF;
      if (bh > 10 && fr.w > 10) {
        freeRects.push({ x: fr.x, y: fr.y + bestH + KERF, w: fr.w, h: bh });
      }
    } else {
      // Right remainder (full height)
      const rw = fr.w - bestW - KERF;
      if (rw > 10 && fr.h > 10) {
        freeRects.push({ x: fr.x + bestW + KERF, y: fr.y, w: rw, h: fr.h });
      }
      // Bottom remainder (under panel only)
      const bh = fr.h - bestH - KERF;
      if (bh > 10 && bestW > 10) {
        freeRects.push({ x: fr.x, y: fr.y + bestH + KERF, w: bestW, h: bh });
      }
    }
  }

  return { height: maxY, placed, allPlaced: true };
}

/**
 * Merging variant: after each placement, try to merge adjacent free rectangles
 * that share an edge and can form a larger guillotine-valid rectangle.
 */
function guillotinePackWithMerge(panels, order, rotations, stockWidth, rectChoice = 'BAF', splitRule = SplitRules.SLS) {
  const heuristic = RectChoiceHeuristics[rectChoice] || RectChoiceHeuristics.BAF;
  const freeRects = [{ x: 0, y: 0, w: stockWidth, h: 99999 }];
  const placed = [];
  let maxY = 0;

  function mergeFreeRects() {
    for (let i = 0; i < freeRects.length; i++) {
      for (let j = i + 1; j < freeRects.length; j++) {
        const a = freeRects[i], b = freeRects[j];

        // Merge horizontally adjacent (same y, same height)
        if (a.y === b.y && a.h === b.h) {
          if (Math.abs((a.x + a.w + KERF) - b.x) <= KERF) {
            a.w = (b.x + b.w) - a.x;
            freeRects.splice(j, 1);
            return true;
          }
          if (Math.abs((b.x + b.w + KERF) - a.x) <= KERF) {
            a.x = b.x;
            a.w = (a.x + a.w) - b.x;
            freeRects.splice(j, 1);
            return true;
          }
        }

        // Merge vertically adjacent (same x, same width)
        if (a.x === b.x && a.w === b.w) {
          if (Math.abs((a.y + a.h + KERF) - b.y) <= KERF) {
            a.h = (b.y + b.h) - a.y;
            freeRects.splice(j, 1);
            return true;
          }
          if (Math.abs((b.y + b.h + KERF) - a.y) <= KERF) {
            a.y = b.y;
            a.h = (a.y + a.h) - b.y;
            freeRects.splice(j, 1);
            return true;
          }
        }
      }
    }
    return false;
  }

  for (let i = 0; i < order.length; i++) {
    const panel = panels[order[i]];
    const rotate = rotations[i];
    let pw = rotate ? panel.height : panel.width;
    let ph = rotate ? panel.width : panel.height;

    if (pw > stockWidth && ph > stockWidth) {
      return { height: Infinity, placed, allPlaced: false };
    }
    if (pw > stockWidth) [pw, ph] = [ph, pw];

    // Try merging before placement
    let merged = true;
    while (merged) merged = mergeFreeRects();

    let bestIdx = -1, bestScore = Infinity, bestW = pw, bestH = ph;

    for (let r = 0; r < freeRects.length; r++) {
      const fr = freeRects[r];
      if (pw <= fr.w && ph <= fr.h) {
        const score = heuristic(fr, pw, ph);
        if (score < bestScore) { bestScore = score; bestIdx = r; bestW = pw; bestH = ph; }
      }
      if (pw !== ph && ph <= fr.w && pw <= fr.h) {
        const score = heuristic(fr, ph, pw);
        if (score < bestScore) { bestScore = score; bestIdx = r; bestW = ph; bestH = pw; }
      }
    }

    if (bestIdx === -1) return { height: Infinity, placed, allPlaced: false };

    const fr = freeRects[bestIdx];
    placed.push({
      id: panel.id, label: panel.label,
      x: fr.x, y: fr.y, width: bestW, height: bestH,
      rotated: bestW !== panel.width,
    });
    maxY = Math.max(maxY, fr.y + bestH);

    const horizontal = chooseSplit(fr, bestW, bestH, splitRule);
    freeRects.splice(bestIdx, 1);

    if (horizontal) {
      const rw = fr.w - bestW - KERF;
      if (rw > 10 && bestH > 10) freeRects.push({ x: fr.x + bestW + KERF, y: fr.y, w: rw, h: bestH });
      const bh = fr.h - bestH - KERF;
      if (bh > 10 && fr.w > 10) freeRects.push({ x: fr.x, y: fr.y + bestH + KERF, w: fr.w, h: bh });
    } else {
      const rw = fr.w - bestW - KERF;
      if (rw > 10 && fr.h > 10) freeRects.push({ x: fr.x + bestW + KERF, y: fr.y, w: rw, h: fr.h });
      const bh = fr.h - bestH - KERF;
      if (bh > 10 && bestW > 10) freeRects.push({ x: fr.x, y: fr.y + bestH + KERF, w: bestW, h: bh });
    }
  }

  return { height: maxY, placed, allPlaced: true };
}

module.exports = {
  guillotinePack,
  guillotinePackWithMerge,
  RectChoiceHeuristics,
  SplitRules,
  KERF,
};
