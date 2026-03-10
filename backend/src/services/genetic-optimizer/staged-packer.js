'use strict';

/**
 * 3.5-Stage Guillotine Packer
 *
 * Implements CutLogic-style "3.5 stages ver" cutting:
 *   Stage 1: Horizontal cuts → rows (stacked along fabric length / Y-axis)
 *   Stage 2: Vertical cuts within rows → cells (along stock width / X-axis)
 *   Stage 3: Horizontal cuts within cells → at most 2 panels stacked
 *   Stage 3.5: Vertical trimming → trim panel widths to exact size
 *
 * Coordinate system (matches existing GA):
 *   X-axis: 0 to stockWidth (3000mm) — fixed fabric roll width
 *   Y-axis: 0 to fabricLength — variable, minimized
 *
 * @param {Array} panels - [{id, width, height, label}]
 * @param {Array} order - Permutation of panel indices
 * @param {Array} rotations - Boolean array for rotation
 * @param {number} stockWidth - Fabric roll width (3000mm)
 * @returns {{ height: number, placed: Array, allPlaced: boolean }}
 */
function stagedPack(panels, order, rotations, stockWidth) {
  // Rows stack along Y-axis (fabric length direction).
  // Within each row, cells are packed along X-axis (stock width = 3000mm).
  // Each cell holds 1-2 panels stacked along Y (stage 3).
  const rows = []; // { height, cells: [{width, panels}], usedWidth }

  for (let i = 0; i < order.length; i++) {
    const panel = panels[order[i]];
    const preferRotate = rotations[i];

    // Use the chromosome's rotation preference (GA controls rotation)
    // Only fall back to alternate orientation if preferred doesn't fit
    const orientations = [];
    {
      const prW = preferRotate ? panel.height : panel.width;
      const prH = preferRotate ? panel.width : panel.height;
      if (prW <= stockWidth) {
        orientations.push({ pw: prW, ph: prH, rotated: preferRotate });
      }
      // Fallback: only if preferred orientation doesn't fit at all
      if (orientations.length === 0) {
        const altW = preferRotate ? panel.width : panel.height;
        const altH = preferRotate ? panel.height : panel.width;
        if (altW <= stockWidth) {
          orientations.push({ pw: altW, ph: altH, rotated: !preferRotate });
        }
      }
    }

    if (orientations.length === 0) {
      return { height: Infinity, placed: [], allPlaced: false };
    }

    let bestOption = null;
    let bestScore = Infinity;

    for (const ori of orientations) {
      const { pw, ph, rotated } = ori;

      // ── Option A: Stack in existing cell (pair, stage 3) ──
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        for (let ci = 0; ci < row.cells.length; ci++) {
          const cell = row.cells[ci];
          if (cell.panels.length >= 2) continue;

          const existing = cell.panels[0];
          const remainingH = row.height - existing.ph;

          if (pw <= cell.width && ph <= remainingH) {
            // Waste in the remaining cell space
            const heightWaste = remainingH - ph;
            const widthWaste = cell.width - pw;
            const waste = heightWaste * cell.width + widthWaste * ph;
            // Priority 0: best option (no fabric cost, uses allocated space)
            const score = waste;
            if (score < bestScore) {
              bestScore = score;
              bestOption = { type: 'stack', ri, ci, pw, ph, rotated,
                id: panel.id, label: panel.label };
            }
          }
        }
      }

      // ── Option B1: New cell in existing row (fits height) ──
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const remaining = stockWidth - row.usedWidth;
        if (pw > remaining) continue;

        if (ph <= row.height) {
          const waste = (row.height - ph) * pw;
          // Priority 1: no fabric length increase, but uses row width
          const score = 200000000 + waste;
          if (score < bestScore) {
            bestScore = score;
            bestOption = { type: 'cell', ri, pw, ph, rotated,
              id: panel.id, label: panel.label };
          }
        }
      }

      // ── Option B2: New cell in existing row (grows row height) ──
      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        const remaining = stockWidth - row.usedWidth;
        if (pw > remaining) continue;

        if (ph > row.height) {
          const heightIncrease = ph - row.height;
          // Extra waste from growing: all existing cells get taller
          const extraWaste = heightIncrease * row.usedWidth;
          // Compare: if we DON'T grow, panel needs a new row of height ph.
          // Net fabric cost of growing = heightIncrease (vs saving ph for new row).
          // Only grow if heightIncrease is significantly < ph (i.e., saves fabric).
          // Use fabric-area cost model: growing costs heightIncrease * stockWidth,
          // new row costs ph * stockWidth. So grow only if heightIncrease < ph.
          // But also penalize based on ratio: growing by 90% of row height is bad.
          const growRatio = heightIncrease / row.height;
          const fabricCost = heightIncrease * stockWidth;
          // Priority 2: score based on actual fabric cost + growth penalty
          const score = 500000000 + fabricCost + growRatio * 200000000;
          if (score < bestScore) {
            bestScore = score;
            bestOption = { type: 'cell-grow', ri, pw, ph, rotated,
              id: panel.id, label: panel.label };
          }
        }
      }

      // ── Option C: New row ──
      {
        // Priority 3: full fabric cost = ph * stockWidth
        const fabricCost = ph * stockWidth;
        const score = 1000000000 + fabricCost;
        if (score < bestScore) {
          bestScore = score;
          bestOption = { type: 'new-row', pw, ph, rotated,
            id: panel.id, label: panel.label };
        }
      }
    }

    if (!bestOption) {
      return { height: Infinity, placed: [], allPlaced: false };
    }

    // ── Apply placement ──
    const o = bestOption;
    switch (o.type) {
      case 'stack': {
        const cell = rows[o.ri].cells[o.ci];
        const existing = cell.panels[0];
        cell.panels.push({
          id: o.id, label: o.label,
          pw: o.pw, ph: o.ph, rotated: o.rotated,
          yOffset: existing.ph,
        });
        break;
      }
      case 'cell': {
        const row = rows[o.ri];
        row.cells.push({
          width: o.pw,
          panels: [{
            id: o.id, label: o.label,
            pw: o.pw, ph: o.ph, rotated: o.rotated,
            yOffset: 0,
          }],
        });
        row.usedWidth += o.pw;
        break;
      }
      case 'cell-grow': {
        const row = rows[o.ri];
        row.height = o.ph; // grow row to fit this panel
        row.cells.push({
          width: o.pw,
          panels: [{
            id: o.id, label: o.label,
            pw: o.pw, ph: o.ph, rotated: o.rotated,
            yOffset: 0,
          }],
        });
        row.usedWidth += o.pw;
        break;
      }
      case 'new-row': {
        rows.push({
          height: o.ph,
          cells: [{
            width: o.pw,
            panels: [{
              id: o.id, label: o.label,
              pw: o.pw, ph: o.ph, rotated: o.rotated,
              yOffset: 0,
            }],
          }],
          usedWidth: o.pw,
        });
        break;
      }
    }
  }

  // ── Calculate absolute positions ──
  const placed = [];
  let yBase = 0;

  for (const row of rows) {
    let xBase = 0;
    for (const cell of row.cells) {
      for (const p of cell.panels) {
        placed.push({
          id: p.id,
          label: p.label,
          x: xBase,
          y: yBase + p.yOffset,
          width: p.pw,
          height: p.ph,
          rotated: p.rotated,
        });
      }
      xBase += cell.width;
    }
    yBase += row.height;
  }

  return { height: yBase, placed, allPlaced: true };
}

module.exports = { stagedPack };
