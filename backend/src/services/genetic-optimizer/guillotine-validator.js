'use strict';

/**
 * Guillotine Cut Validator
 *
 * Validates that a given panel layout can be achieved through a sequence of
 * guillotine cuts (each cut goes fully edge-to-edge across one dimension).
 *
 * Uses recursive subdivision: a valid guillotine layout can always be split
 * by at least one full-width horizontal or full-height vertical cut that
 * doesn't pass through any panel.
 */

const KERF = 0; // fabric cutting uses rotary blade — zero kerf
const TOLERANCE = 3; // mm tolerance for edge alignment

/**
 * Check if a set of placed panels in a bounding box is guillotine-valid.
 * Uses recursive approach: find a cut that splits all panels into two groups,
 * then validate each group recursively.
 *
 * @param {Array} panels - [{x, y, width, height}]
 * @param {Object} bounds - {x, y, w, h} bounding box
 * @param {number} depth - recursion depth (for stage counting)
 * @returns {{ valid: boolean, maxStages: number, cuts: Array }}
 */
function validateGuillotine(panels, bounds = null, depth = 0) {
  if (!bounds) {
    // Compute bounding box from panels
    let maxX = 0, maxY = 0;
    for (const p of panels) {
      maxX = Math.max(maxX, p.x + p.width);
      maxY = Math.max(maxY, p.y + p.height);
    }
    bounds = { x: 0, y: 0, w: maxX, h: maxY };
  }

  // Base cases
  if (panels.length <= 1) return { valid: true, maxStages: 0, cuts: [] };

  // Collect all potential horizontal cut positions (panel top and bottom edges)
  const hCuts = new Set();
  const vCuts = new Set();

  for (const p of panels) {
    hCuts.add(p.y);
    hCuts.add(p.y + p.height);
    hCuts.add(p.y + p.height + KERF);
    vCuts.add(p.x);
    vCuts.add(p.x + p.width);
    vCuts.add(p.x + p.width + KERF);
  }

  // Try each horizontal cut position
  for (const cutY of hCuts) {
    if (cutY <= bounds.y + TOLERANCE || cutY >= bounds.y + bounds.h - TOLERANCE) continue;

    const above = [];
    const below = [];
    let valid = true;

    for (const p of panels) {
      const pTop = p.y;
      const pBot = p.y + p.height;

      if (pBot <= cutY + TOLERANCE) {
        above.push(p);
      } else if (pTop >= cutY - TOLERANCE) {
        below.push(p);
      } else {
        // Panel is split by this cut
        valid = false;
        break;
      }
    }

    if (valid && above.length > 0 && below.length > 0) {
      const aboveBounds = { x: bounds.x, y: bounds.y, w: bounds.w, h: cutY - bounds.y };
      const belowBounds = { x: bounds.x, y: cutY, w: bounds.w, h: bounds.y + bounds.h - cutY };

      const aResult = validateGuillotine(above, aboveBounds, depth + 1);
      const bResult = validateGuillotine(below, belowBounds, depth + 1);

      if (aResult.valid && bResult.valid) {
        return {
          valid: true,
          maxStages: Math.max(aResult.maxStages, bResult.maxStages) + 1,
          cuts: [{ type: 'horizontal', y: cutY, depth }, ...aResult.cuts, ...bResult.cuts],
        };
      }
    }
  }

  // Try each vertical cut position
  for (const cutX of vCuts) {
    if (cutX <= bounds.x + TOLERANCE || cutX >= bounds.x + bounds.w - TOLERANCE) continue;

    const left = [];
    const right = [];
    let valid = true;

    for (const p of panels) {
      const pLeft = p.x;
      const pRight = p.x + p.width;

      if (pRight <= cutX + TOLERANCE) {
        left.push(p);
      } else if (pLeft >= cutX - TOLERANCE) {
        right.push(p);
      } else {
        valid = false;
        break;
      }
    }

    if (valid && left.length > 0 && right.length > 0) {
      const leftBounds = { x: bounds.x, y: bounds.y, w: cutX - bounds.x, h: bounds.h };
      const rightBounds = { x: cutX, y: bounds.y, w: bounds.x + bounds.w - cutX, h: bounds.h };

      const lResult = validateGuillotine(left, leftBounds, depth + 1);
      const rResult = validateGuillotine(right, rightBounds, depth + 1);

      if (lResult.valid && rResult.valid) {
        return {
          valid: true,
          maxStages: Math.max(lResult.maxStages, rResult.maxStages) + 1,
          cuts: [{ type: 'vertical', x: cutX, depth }, ...lResult.cuts, ...rResult.cuts],
        };
      }
    }
  }

  // No valid cut found - layout is not guillotine-valid
  return { valid: false, maxStages: -1, cuts: [] };
}

/**
 * Quick check: are any panels overlapping?
 */
function checkOverlaps(panels) {
  const overlaps = [];
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      const a = panels[i], b = panels[j];
      if (a.x < b.x + b.width && a.x + a.width > b.x &&
          a.y < b.y + b.height && a.y + a.height > b.y) {
        overlaps.push([a, b]);
      }
    }
  }
  return overlaps;
}

/**
 * Check all panels fit within stock dimensions.
 */
function checkBounds(panels, stockWidth) {
  const outOfBounds = [];
  for (const p of panels) {
    if (p.x < -TOLERANCE || p.x + p.width > stockWidth + TOLERANCE) {
      outOfBounds.push({ panel: p, reason: 'exceeds width' });
    }
  }
  return outOfBounds;
}

module.exports = { validateGuillotine, checkOverlaps, checkBounds };
