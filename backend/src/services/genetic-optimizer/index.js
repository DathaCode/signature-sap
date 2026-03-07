'use strict';

/**
 * Fabric Cut Optimizer - Production Entry Point
 * 
 * Genetic algorithm + exhaustive heuristic sweep for guillotine bin packing.
 * Optimizes fabric cutting layouts to minimize material waste.
 * 
 * Usage:
 *   const { optimizeCutLayout } = require('./index');
 *   const result = await optimizeCutLayout(panels, options);
 * 
 * @module fabric-cut-optimizer
 */

const { optimize } = require('./genetic-optimizer');
const { validateGuillotine, checkOverlaps, checkBounds } = require('./guillotine-validator');
const { KERF } = require('./packing-strategies');

/**
 * Optimize a fabric cutting layout for a set of panels.
 *
 * @param {Array<Object>} panels - Panels to cut
 * @param {number} panels[].id - Unique panel identifier
 * @param {number} panels[].width - Panel width in mm (after deductions)
 * @param {number} panels[].height - Panel height in mm (after deductions)
 * @param {string} [panels[].label] - Human-readable panel name
 * @param {Object} [options]
 * @param {number} [options.stockWidth=3000] - Fabric roll width in mm
 * @param {number} [options.kerf=2] - Blade thickness in mm
 * @param {number} [options.populationSize=100] - GA population size
 * @param {number} [options.maxGenerations=500] - Maximum GA generations
 * @param {number} [options.stagnationLimit=50] - Stop after N gens without improvement
 * @param {boolean} [options.validate=true] - Run guillotine validation
 * @returns {Object} Optimization result
 */
function optimizeCutLayout(panels, options = {}) {
  const {
    stockWidth = 3000,
    validate = true,
    ...gaOptions
  } = options;

  // Input validation
  if (!Array.isArray(panels) || panels.length === 0) {
    throw new Error('panels must be a non-empty array');
  }

  for (const p of panels) {
    if (!p.width || !p.height || p.width <= 0 || p.height <= 0) {
      throw new Error(`Invalid panel dimensions: ${JSON.stringify(p)}`);
    }
    // Check if panel can fit at all (in either orientation)
    const minDim = Math.min(p.width, p.height);
    if (minDim > stockWidth) {
      throw new Error(
        `Panel "${p.label || p.id}" (${p.width}×${p.height}mm) cannot fit in stock width ${stockWidth}mm`
      );
    }
  }

  // Run optimization
  const result = optimize(panels, { stockWidth, ...gaOptions });

  // Post-processing validation
  if (validate && result.success) {
    const overlaps = checkOverlaps(result.panels);
    const outOfBounds = checkBounds(result.panels, stockWidth);
    const guillotine = validateGuillotine(result.panels);

    result.validation = {
      overlaps: overlaps.length,
      outOfBounds: outOfBounds.length,
      isGuillotineValid: guillotine.valid,
      guillotineStages: guillotine.maxStages,
    };

    result.isGuillotineValid = guillotine.valid;
  }

  // Calculate material usage
  const totalPanelArea = panels.reduce((s, p) => s + p.width * p.height, 0);
  const fabricUsed = stockWidth * result.dimensions.height;

  result.materialUsage = {
    panelArea: totalPanelArea,
    fabricArea: fabricUsed,
    wasteArea: fabricUsed - totalPanelArea,
    wastePercent: Math.round((1 - totalPanelArea / fabricUsed) * 1000) / 10,
    fabricLength: result.dimensions.height,
    fabricWidth: stockWidth,
  };

  return result;
}

module.exports = { optimizeCutLayout };
