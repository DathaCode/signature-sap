'use strict';

/**
 * Genetic Algorithm Optimizer for Fabric Cut Optimization
 *
 * Uses 3.5-Stage Guillotine Packing (CutLogic-style):
 *   Stage 1: Horizontal cuts → rows
 *   Stage 2: Vertical cuts → cells within rows
 *   Stage 3: Horizontal cuts → at most 2 stacked panels per cell
 *   Stage 3.5: Vertical trimming
 *
 * Chromosome encoding:
 *   - order: permutation of panel indices (placement sequence)
 *   - rotations: boolean array (rotate each panel 90°?)
 *
 * Fitness = total fabric length used (lower is better).
 */

const { stagedPack } = require('./staged-packer');

// ── Utility ─────────────────────────────────────────────────────────────────

function randInt(max) { return Math.floor(Math.random() * max); }
function randFloat() { return Math.random(); }

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Chromosome ──────────────────────────────────────────────────────────────

function createRandomChromosome(n) {
  const order = shuffle(Array.from({ length: n }, (_, i) => i));
  const rotations = Array.from({ length: n }, () => Math.random() < 0.5);
  return { order, rotations };
}

// ── Seeded Chromosomes (smart initial solutions) ────────────────────────────

function createSeededChromosomes(panels, stockWidth) {
  const n = panels.length;
  const seeds = [];

  // Sort by decreasing area
  const byArea = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => (panels[b].width * panels[b].height) - (panels[a].width * panels[a].height));

  // Sort by decreasing max dimension
  const byMaxDim = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => Math.max(panels[b].width, panels[b].height) - Math.max(panels[a].width, panels[a].height));

  // Sort by decreasing height (good for row height setting)
  const byHeight = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => panels[b].height - panels[a].height);

  // Sort by decreasing width
  const byWidth = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => panels[b].width - panels[a].width);

  // Sort by decreasing perimeter
  const byPerimeter = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => (panels[b].width + panels[b].height) - (panels[a].width + panels[a].height));

  // Sort by decreasing min dimension (good for cell width matching)
  const byMinDim = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => Math.min(panels[b].width, panels[b].height) - Math.min(panels[a].width, panels[a].height));

  // Original order
  const byOriginal = Array.from({ length: n }, (_, i) => i);

  // ── Staged-packing-specific sort orders ──

  // Group panels whose heights sum to ~stockWidth (good row pairing)
  const byHeightPairing = createPairedOrder(panels, stockWidth, 'height');

  // Group panels whose widths are similar (good cell stacking)
  const byWidthGrouping = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => {
      const wa = Math.min(panels[a].width, panels[a].height);
      const wb = Math.min(panels[b].width, panels[b].height);
      return wb - wa;
    });

  // Alternate: tallest, shortest, 2nd tallest, 2nd shortest, ...
  const byAlternate = [];
  {
    const sorted = byHeight.slice();
    let lo = 0, hi = sorted.length - 1;
    while (lo <= hi) {
      byAlternate.push(sorted[lo++]);
      if (lo <= hi) byAlternate.push(sorted[hi--]);
    }
  }

  const sortOrders = [
    byArea, byMaxDim, byHeight, byWidth, byPerimeter, byMinDim,
    byOriginal, byHeightPairing, byWidthGrouping, byAlternate,
  ];

  // Rotation strategies
  for (const sortOrder of sortOrders) {
    // No rotation
    seeds.push({ order: sortOrder.slice(), rotations: Array(n).fill(false) });

    // All rotated
    seeds.push({ order: sortOrder.slice(), rotations: Array(n).fill(true) });

    // Smart rotation: rotate so min dimension is width (X), max is height (Y)
    // This makes panels tall and narrow → good for stacking in rows
    const smartRotY = sortOrder.map(i =>
      panels[i].width > panels[i].height // rotate if wider than tall
    );
    seeds.push({ order: sortOrder.slice(), rotations: smartRotY });

    // Opposite: rotate so max dimension is width (X), min is height (Y)
    // This makes panels wide → each occupies less row height
    const smartRotX = sortOrder.map(i =>
      panels[i].height > panels[i].width // rotate if taller than wide
    );
    seeds.push({ order: sortOrder.slice(), rotations: smartRotX });
  }

  // ── Row bin-packing seeds (CutLogic-style column approach) ──
  // These seeds group panels into rows based on width-fitting,
  // choosing rotations to minimize row height (= fabric length).
  const rowPackingSeeds = createRowPackingSeeds(panels, stockWidth);
  for (const s of rowPackingSeeds) {
    seeds.push(s);
  }

  return seeds;
}

/**
 * Create seeds using row bin-packing: group panels into rows where
 * total width ≤ stockWidth, minimizing total height (fabric length).
 *
 * For each panel, two orientations are considered:
 *   Normal:  w = panel.width,  h = panel.height
 *   Rotated: w = panel.height, h = panel.width  (if panel.height ≤ stockWidth)
 *
 * Multiple strategies are tried:
 *   1. FFD by "min-height orientation" — rotate each panel to minimize its Y-span
 *   2. FFD by "max-width orientation" — rotate to maximize X-span (fill rows faster)
 *   3. Width-pairing — pair panels whose widths sum to ~stockWidth
 *   4. Same as above but with BFD (best-fit) instead of FFD
 */
function createRowPackingSeeds(panels, stockWidth) {
  const n = panels.length;
  const seeds = [];

  // For each panel, compute both orientation options
  const opts = panels.map((p, i) => {
    const a = { w: p.width, h: p.height, rotated: false };
    const b = { w: p.height, h: p.width, rotated: true };
    const aFits = a.w <= stockWidth;
    const bFits = b.w <= stockWidth;
    return { idx: i, a: aFits ? a : null, b: bFits ? b : null };
  });

  // Strategy 1: "Min-height" — each panel uses the orientation with smaller h
  //   This is the CutLogic-style approach: tall panels get rotated so their
  //   width becomes the row height (min dimension along fabric length).
  {
    const items = opts.map(o => {
      let best = o.a;
      if (o.b && (!best || o.b.h < best.h)) best = o.b;
      if (!best) best = o.a || o.b;
      return { idx: o.idx, w: best.w, h: best.h, rotated: best.rotated };
    });
    // Sort by decreasing height (tallest rows first = FFD)
    items.sort((a, b) => b.h - a.h);
    const seed = buildRowPackingSeed(items, stockWidth, n);
    if (seed) seeds.push(seed);

    // Also try ascending height (shortest rows first)
    items.sort((a, b) => a.h - b.h);
    const seed2 = buildRowPackingSeed(items, stockWidth, n);
    if (seed2) seeds.push(seed2);
  }

  // Strategy 2: "Max-width" — each panel uses the orientation with larger w
  //   Panels fill more of the row width → fewer panels per row, shorter rows
  {
    const items = opts.map(o => {
      let best = o.a;
      if (o.b && (!best || o.b.w > best.w)) best = o.b;
      if (!best) best = o.a || o.b;
      return { idx: o.idx, w: best.w, h: best.h, rotated: best.rotated };
    });
    items.sort((a, b) => b.h - a.h);
    const seed = buildRowPackingSeed(items, stockWidth, n);
    if (seed) seeds.push(seed);
  }

  // Strategy 3: Width-pairing — pair panels whose widths sum close to stockWidth
  {
    const items = opts.map(o => {
      let best = o.a;
      if (o.b && (!best || o.b.h < best.h)) best = o.b;
      if (!best) best = o.a || o.b;
      return { idx: o.idx, w: best.w, h: best.h, rotated: best.rotated };
    });
    items.sort((a, b) => b.w - a.w);
    const used = new Set();
    const orderedItems = [];
    for (const item of items) {
      if (used.has(item.idx)) continue;
      used.add(item.idx);
      orderedItems.push(item);
      // Find best partner
      let bestPartner = null;
      let bestGap = Infinity;
      for (const other of items) {
        if (used.has(other.idx)) continue;
        if (item.w + other.w <= stockWidth) {
          const gap = stockWidth - item.w - other.w;
          if (gap < bestGap) {
            bestGap = gap;
            bestPartner = other;
          }
        }
      }
      if (bestPartner) {
        used.add(bestPartner.idx);
        orderedItems.push(bestPartner);
      }
    }
    const seed = buildRowPackingSeed(orderedItems, stockWidth, n);
    if (seed) seeds.push(seed);
  }

  // Strategy 4: Best-fit decreasing — place each panel in the row with least remaining width
  {
    for (const rotStrategy of ['min-h', 'max-w']) {
      const items = opts.map(o => {
        let best = o.a;
        if (rotStrategy === 'min-h') {
          if (o.b && (!best || o.b.h < best.h)) best = o.b;
        } else {
          if (o.b && (!best || o.b.w > best.w)) best = o.b;
        }
        if (!best) best = o.a || o.b;
        return { idx: o.idx, w: best.w, h: best.h, rotated: best.rotated };
      });
      items.sort((a, b) => b.w - a.w); // Sort by decreasing width
      const seed = buildRowPackingSeedBFD(items, stockWidth, n);
      if (seed) seeds.push(seed);
    }
  }

  // Strategy 5: Try ALL rotation combos for small n, sample for larger n.
  // For each combo, try multiple row-grouping strategies:
  //   - FFD by decreasing height
  //   - FFD by decreasing width
  //   - Width-complementarity pairing
  if (n <= 16) {
    const totalCombos = 1 << n;
    const maxCombos = n <= 12 ? totalCombos : 4096;
    let bestHeight = Infinity;
    let bestItems = null;

    for (let iter = 0; iter < maxCombos; iter++) {
      const bits = iter < totalCombos ? iter : Math.floor(Math.random() * totalCombos);
      const items = [];
      let valid = true;
      for (let i = 0; i < n; i++) {
        const rotated = !!(bits & (1 << i));
        const p = panels[i];
        const w = rotated ? p.height : p.width;
        const h = rotated ? p.width : p.height;
        if (w > stockWidth) { valid = false; break; }
        items.push({ idx: i, w, h, rotated });
      }
      if (!valid || items.length < n) continue;

      // Try 3 packing strategies for this rotation combo
      // 1. FFD by decreasing height
      const byH = items.slice().sort((a, b) => b.h - a.h);
      const r1 = simulateRowPacking(byH, stockWidth);
      if (r1.totalHeight < bestHeight) {
        bestHeight = r1.totalHeight;
        bestItems = byH;
      }

      // 2. FFD by decreasing width
      const byW = items.slice().sort((a, b) => b.w - a.w);
      const r2 = simulateRowPacking(byW, stockWidth);
      if (r2.totalHeight < bestHeight) {
        bestHeight = r2.totalHeight;
        bestItems = byW;
      }

      // 3. Width-complementarity pairing
      const paired = widthPairingOrder(items, stockWidth);
      const r3 = simulateRowPacking(paired, stockWidth);
      if (r3.totalHeight < bestHeight) {
        bestHeight = r3.totalHeight;
        bestItems = paired;
      }
    }

    if (bestItems) {
      const seed = buildRowPackingSeed(bestItems, stockWidth, n);
      if (seed) seeds.push(seed);
    }
  }

  return seeds;
}

/**
 * Build a chromosome from row-packing items using First-Fit Decreasing.
 * Items are placed into rows; the chromosome order reflects row-by-row placement.
 */
function buildRowPackingSeed(items, stockWidth, n) {
  const rows = []; // { remainingWidth, items: [] }
  for (const item of items) {
    let placed = false;
    for (const row of rows) {
      if (item.w <= row.remainingWidth) {
        row.items.push(item);
        row.remainingWidth -= item.w;
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push({ remainingWidth: stockWidth - item.w, items: [item] });
    }
  }
  // Sort rows by height descending (tallest first tends to pack better)
  rows.sort((a, b) => {
    const ha = Math.max(...a.items.map(i => i.h));
    const hb = Math.max(...b.items.map(i => i.h));
    return hb - ha;
  });
  // Build chromosome: order + rotations
  const order = [];
  const rotations = new Array(n);
  for (const row of rows) {
    // Within each row, sort items by decreasing height
    row.items.sort((a, b) => b.h - a.h);
    for (const item of row.items) {
      order.push(item.idx);
      rotations[item.idx] = item.rotated;
    }
  }
  if (order.length !== n) return null;
  // Re-index rotations to match order
  const rotArr = order.map(i => rotations[i]);
  return { order, rotations: rotArr };
}

/**
 * Build a chromosome using Best-Fit Decreasing.
 * Each panel goes to the row with the LEAST remaining width that still fits.
 */
function buildRowPackingSeedBFD(items, stockWidth, n) {
  const rows = [];
  for (const item of items) {
    let bestRow = -1;
    let bestRemaining = Infinity;
    for (let r = 0; r < rows.length; r++) {
      const rem = rows[r].remainingWidth;
      if (item.w <= rem && rem - item.w < bestRemaining) {
        bestRemaining = rem - item.w;
        bestRow = r;
      }
    }
    if (bestRow >= 0) {
      rows[bestRow].items.push(item);
      rows[bestRow].remainingWidth -= item.w;
    } else {
      rows.push({ remainingWidth: stockWidth - item.w, items: [item] });
    }
  }
  rows.sort((a, b) => {
    const ha = Math.max(...a.items.map(i => i.h));
    const hb = Math.max(...b.items.map(i => i.h));
    return hb - ha;
  });
  const order = [];
  const rotations = new Array(n);
  for (const row of rows) {
    row.items.sort((a, b) => b.h - a.h);
    for (const item of row.items) {
      order.push(item.idx);
      rotations[item.idx] = item.rotated;
    }
  }
  if (order.length !== n) return null;
  const rotArr = order.map(i => rotations[i]);
  return { order, rotations: rotArr };
}

/**
 * Simulate row packing to estimate total height (quick evaluation).
 */
function simulateRowPacking(items, stockWidth) {
  const rows = [];
  for (const item of items) {
    let placed = false;
    for (const row of rows) {
      if (item.w <= row.remainingWidth) {
        row.items.push(item);
        row.remainingWidth -= item.w;
        row.height = Math.max(row.height, item.h);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push({ remainingWidth: stockWidth - item.w, items: [item], height: item.h });
    }
  }
  return { totalHeight: rows.reduce((s, r) => s + r.height, 0), rows };
}

/**
 * Order items by width-complementarity pairing:
 * largest + smallest-that-fits, then next largest + next smallest, etc.
 * Items that don't pair become singles.
 */
function widthPairingOrder(items, stockWidth) {
  const sorted = items.slice().sort((a, b) => b.w - a.w);
  const used = new Set();
  const result = [];

  for (let i = 0; i < sorted.length; i++) {
    if (used.has(i)) continue;
    used.add(i);
    result.push(sorted[i]);

    // Find best partner: widest that still fits
    let bestJ = -1;
    let bestWidth = 0;
    for (let j = sorted.length - 1; j > i; j--) {
      if (used.has(j)) continue;
      if (sorted[i].w + sorted[j].w <= stockWidth && sorted[j].w > bestWidth) {
        bestWidth = sorted[j].w;
        bestJ = j;
      }
    }
    if (bestJ >= 0) {
      used.add(bestJ);
      result.push(sorted[bestJ]);
    }
  }
  return result;
}

/**
 * Create a paired ordering where panels whose heights sum close to stockWidth
 * are placed adjacent. This helps the staged packer form efficient rows.
 */
function createPairedOrder(panels, stockWidth, dimKey) {
  const n = panels.length;
  const indices = Array.from({ length: n }, (_, i) => i);
  const used = new Set();
  const result = [];

  // Sort by dimension descending
  indices.sort((a, b) => Math.max(panels[b].width, panels[b].height) - Math.max(panels[a].width, panels[a].height));

  for (const i of indices) {
    if (used.has(i)) continue;
    used.add(i);
    result.push(i);

    // Find best partner (height sums to ~stockWidth)
    const h1 = Math.max(panels[i].width, panels[i].height);
    let bestJ = -1, bestGap = Infinity;

    for (const j of indices) {
      if (used.has(j)) continue;
      const h2 = Math.min(panels[j].width, panels[j].height);
      const gap = Math.abs(stockWidth - h1 - h2);
      if (gap < bestGap) {
        bestGap = gap;
        bestJ = j;
      }
    }

    if (bestJ >= 0) {
      used.add(bestJ);
      result.push(bestJ);
    }
  }

  return result;
}

// ── Fitness Evaluation ──────────────────────────────────────────────────────

function evaluate(chromosome, panels, stockWidth) {
  const result = stagedPack(panels, chromosome.order, chromosome.rotations, stockWidth);
  return {
    fitness: result.allPlaced ? result.height : Infinity,
    result,
  };
}

// ── Selection ───────────────────────────────────────────────────────────────

function tournamentSelect(population, fitnesses, tournamentSize = 4) {
  let bestIdx = randInt(population.length);
  let bestFit = fitnesses[bestIdx];

  for (let i = 1; i < tournamentSize; i++) {
    const idx = randInt(population.length);
    if (fitnesses[idx] < bestFit) {
      bestFit = fitnesses[idx];
      bestIdx = idx;
    }
  }
  return population[bestIdx];
}

// ── Crossover ───────────────────────────────────────────────────────────────

/** Order Crossover (OX) for permutation part */
function orderCrossover(parent1, parent2) {
  const n = parent1.order.length;
  const start = randInt(n);
  const end = start + 1 + randInt(n - start);

  const childOrder = new Array(n).fill(-1);
  const childRot = new Array(n);

  for (let i = start; i < end && i < n; i++) {
    childOrder[i] = parent1.order[i];
    childRot[i] = parent1.rotations[i];
  }

  const used = new Set(childOrder.filter(v => v !== -1));
  let pos = end % n;
  for (let i = 0; i < n; i++) {
    const idx = (end + i) % n;
    const val = parent2.order[idx];
    if (!used.has(val)) {
      while (childOrder[pos] !== -1) pos = (pos + 1) % n;
      childOrder[pos] = val;
      childRot[pos] = parent2.rotations[idx];
      pos = (pos + 1) % n;
    }
  }

  return { order: childOrder, rotations: childRot };
}

/** Partially Mapped Crossover (PMX) */
function pmxCrossover(parent1, parent2) {
  const n = parent1.order.length;
  const start = randInt(n - 1);
  const end = start + 1 + randInt(n - start - 1);

  const child = { order: new Array(n).fill(-1), rotations: parent1.rotations.slice() };

  const mapping = {};
  for (let i = start; i <= end && i < n; i++) {
    child.order[i] = parent1.order[i];
    mapping[parent1.order[i]] = parent2.order[i];
  }

  for (let i = 0; i < n; i++) {
    if (i >= start && i <= end) continue;
    let val = parent2.order[i];
    while (mapping[val] !== undefined && child.order.includes(val)) {
      val = mapping[val];
    }
    if (child.order.includes(val)) {
      const used = new Set(child.order.filter(v => v !== -1));
      for (let v = 0; v < n; v++) {
        if (!used.has(v)) { val = v; break; }
      }
    }
    child.order[i] = val;
  }

  const used = new Set(child.order.filter(v => v !== -1));
  const missing = [];
  for (let v = 0; v < n; v++) {
    if (!used.has(v)) missing.push(v);
  }
  let mi = 0;
  for (let i = 0; i < n; i++) {
    if (child.order[i] === -1) child.order[i] = missing[mi++];
  }

  return child;
}

// ── Mutation ────────────────────────────────────────────────────────────────

function mutate(chromosome, mutationRate = 0.15) {
  const n = chromosome.order.length;
  const c = {
    order: chromosome.order.slice(),
    rotations: chromosome.rotations.slice(),
  };

  // Swap mutation on order
  if (randFloat() < mutationRate) {
    const i = randInt(n), j = randInt(n);
    [c.order[i], c.order[j]] = [c.order[j], c.order[i]];
  }

  // Inversion mutation (reverse a subsequence)
  if (randFloat() < mutationRate * 0.7) {
    const i = randInt(n), j = randInt(n);
    const [lo, hi] = i < j ? [i, j] : [j, i];
    c.order.splice(lo, hi - lo + 1, ...c.order.slice(lo, hi + 1).reverse());
  }

  // Insertion mutation (move one panel to another position)
  if (randFloat() < mutationRate * 0.5) {
    const from = randInt(n);
    const to = randInt(n);
    const [item] = c.order.splice(from, 1);
    c.order.splice(to, 0, item);
    const [rot] = c.rotations.splice(from, 1);
    c.rotations.splice(to, 0, rot);
  }

  // Rotation mutation
  for (let i = 0; i < n; i++) {
    if (randFloat() < mutationRate * 0.3) {
      c.rotations[i] = !c.rotations[i];
    }
  }

  return c;
}

// ── Scramble mutation (strong disruption) ───────────────────────────────────

function scrambleMutate(chromosome) {
  const n = chromosome.order.length;
  const c = {
    order: chromosome.order.slice(),
    rotations: chromosome.rotations.slice(),
  };

  const start = randInt(n);
  const len = 2 + randInt(Math.min(5, n - start));
  const sub = c.order.slice(start, start + len);
  const subR = c.rotations.slice(start, start + len);
  for (let i = sub.length - 1; i > 0; i--) {
    const j = randInt(i + 1);
    [sub[i], sub[j]] = [sub[j], sub[i]];
    [subR[i], subR[j]] = [subR[j], subR[i]];
  }
  c.order.splice(start, len, ...sub);
  c.rotations.splice(start, len, ...subR);

  return c;
}

// ── Main GA ─────────────────────────────────────────────────────────────────

/**
 * Run the genetic algorithm optimizer with 3.5-stage packing.
 *
 * @param {Array} panels - [{id, width, height, label}]
 * @param {Object} options
 * @param {number} options.stockWidth - Available width (default 3000)
 * @param {number} options.populationSize - Population size (default 100)
 * @param {number} options.maxGenerations - Max generations (default 500)
 * @param {number} options.stagnationLimit - Stop after N gens without improvement
 * @param {number} options.mutationRate - Base mutation rate (default 0.15)
 * @param {number} options.crossoverRate - Crossover probability (default 0.8)
 * @param {number} options.eliteCount - Elites preserved per gen (default 6)
 * @returns {Object} Best solution found
 */
function optimize(panels, options = {}) {
  const {
    stockWidth = 3000,
    populationSize = 150,
    maxGenerations = 800,
    stagnationLimit = 80,
    mutationRate = 0.15,
    crossoverRate = 0.8,
    eliteCount = 8,
    allowRotation = true,
  } = options;

  const n = panels.length;
  const startTime = Date.now();

  // Strip rotations from a chromosome when rotation is disabled
  const noRot = allowRotation
    ? c => c
    : c => ({ order: c.order, rotations: new Array(n).fill(false) });

  // ── Phase 1: Exhaustive heuristic sweep ──────────────────────────────────
  const seeds = createSeededChromosomes(panels, stockWidth).map(noRot);
  let globalBestFitness = Infinity;
  let globalBestChromosome = null;
  let globalBestResult = null;

  for (const seed of seeds) {
    const { fitness, result } = evaluate(seed, panels, stockWidth);
    if (fitness < globalBestFitness) {
      globalBestFitness = fitness;
      globalBestChromosome = seed;
      globalBestResult = result;
    }
  }

  // ── Phase 2: Initialize GA population ────────────────────────────────────
  let population = [];

  const evaluatedSeeds = seeds.map(s => ({
    chromosome: s,
    fitness: evaluate(s, panels, stockWidth).fitness,
  }));
  evaluatedSeeds.sort((a, b) => a.fitness - b.fitness);

  const topSeeds = evaluatedSeeds.slice(0, Math.floor(populationSize * 0.3));
  for (const s of topSeeds) population.push(s.chromosome);

  while (population.length < populationSize) {
    population.push(noRot(createRandomChromosome(n)));
  }

  // Inject mutations of the best seed
  if (globalBestChromosome) {
    for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
      const idx = Math.floor(populationSize * 0.3) + i;
      if (idx < population.length) {
        population[idx] = noRot(mutate(globalBestChromosome, 0.3));
      }
    }
  }

  let fitnesses = population.map(c => evaluate(c, panels, stockWidth).fitness);

  let bestGen = 0;
  let stagnation = 0;
  let adaptiveMutation = mutationRate;

  for (let idx = 0; idx < fitnesses.length; idx++) {
    if (fitnesses[idx] < globalBestFitness) {
      globalBestFitness = fitnesses[idx];
      globalBestChromosome = population[idx];
      globalBestResult = evaluate(population[idx], panels, stockWidth).result;
    }
  }

  // ── Phase 3: Evolution ───────────────────────────────────────────────────
  for (let gen = 0; gen < maxGenerations; gen++) {
    const newPop = [];
    const newFit = [];

    const indices = fitnesses.map((f, i) => i);
    indices.sort((a, b) => fitnesses[a] - fitnesses[b]);

    // Elitism
    for (let e = 0; e < eliteCount && e < indices.length; e++) {
      newPop.push(population[indices[e]]);
      newFit.push(fitnesses[indices[e]]);
    }

    // Generate children
    while (newPop.length < populationSize) {
      let child;

      if (randFloat() < crossoverRate) {
        const p1 = tournamentSelect(population, fitnesses, 4);
        const p2 = tournamentSelect(population, fitnesses, 4);
        child = randFloat() < 0.5 ? orderCrossover(p1, p2) : pmxCrossover(p1, p2);
      } else {
        child = tournamentSelect(population, fitnesses, 3);
        child = { order: child.order.slice(), rotations: child.rotations.slice() };
      }

      if (randFloat() < adaptiveMutation) {
        child = noRot(mutate(child, adaptiveMutation));
      }
      if (randFloat() < adaptiveMutation * 0.3) {
        child = noRot(scrambleMutate(child));
      }

      const { fitness } = evaluate(child, panels, stockWidth);
      newPop.push(child);
      newFit.push(fitness);

      if (fitness < globalBestFitness) {
        globalBestFitness = fitness;
        globalBestChromosome = child;
        globalBestResult = evaluate(child, panels, stockWidth).result;
        bestGen = gen;
        stagnation = 0;
      }
    }

    population = newPop;
    fitnesses = newFit;
    stagnation++;

    if (stagnation > 10) {
      adaptiveMutation = Math.min(0.5, mutationRate + (stagnation - 10) * 0.01);
    } else {
      adaptiveMutation = mutationRate;
    }

    // Immigration when stagnating
    if (stagnation > 0 && stagnation % 15 === 0) {
      const numReplace = Math.floor(populationSize * 0.2);
      const worstIndices = indices.slice(-numReplace);
      for (const wi of worstIndices) {
        if (wi < population.length) {
          population[wi] = noRot(createRandomChromosome(n));
          fitnesses[wi] = evaluate(population[wi], panels, stockWidth).fitness;
        }
      }
    }

    // Inject mutations of global best
    if (stagnation > 0 && stagnation % 10 === 0 && globalBestChromosome) {
      const numInject = Math.floor(populationSize * 0.1);
      for (let i = 0; i < numInject; i++) {
        const wi = indices[indices.length - 1 - i];
        if (wi < population.length) {
          population[wi] = noRot(mutate(globalBestChromosome, 0.25));
          fitnesses[wi] = evaluate(population[wi], panels, stockWidth).fitness;
          if (fitnesses[wi] < globalBestFitness) {
            globalBestFitness = fitnesses[wi];
            globalBestChromosome = population[wi];
            globalBestResult = evaluate(population[wi], panels, stockWidth).result;
            bestGen = gen;
            stagnation = 0;
          }
        }
      }
    }

    if (stagnation >= stagnationLimit) break;
    if (Date.now() - startTime > 5000) break;
  }

  const endTime = Date.now();

  // ── Build output ──────────────────────────────────────────────────────────
  const totalPanelArea = panels.reduce((s, p) => s + p.width * p.height, 0);
  const usedArea = stockWidth * globalBestFitness;
  const efficiency = usedArea > 0 ? (totalPanelArea / usedArea * 100) : 0;

  return {
    success: globalBestResult?.allPlaced ?? false,
    dimensions: {
      width: stockWidth,
      height: Math.round(globalBestFitness),
    },
    efficiency: Math.round(efficiency * 10) / 10,
    panels: globalBestResult?.placed || [],
    generationStats: {
      totalGenerations: Math.min(stagnation > 0 ? bestGen + stagnation : bestGen, maxGenerations),
      bestGeneration: bestGen,
      convergenceTime: endTime - startTime,
      populationSize,
      seedsTested: seeds.length,
    },
    strategy: `3.5-Stage Guillotine + GA (Gen ${bestGen})`,
  };
}

module.exports = { optimize };
