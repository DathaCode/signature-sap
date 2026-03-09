'use strict';

/**
 * Genetic Algorithm Optimizer for Fabric Cut Optimization
 *
 * Chromosome encoding:
 *   - order: permutation of panel indices (placement sequence)
 *   - rotations: boolean array (rotate each panel 90°?)
 *   - rectChoice: rectangle selection heuristic key
 *   - splitRule: guillotine split rule index
 *   - useMerge: whether to use merge variant
 *
 * Fitness = fabric height used (lower is better). Infinity if any panel can't be placed.
 */

const { guillotinePack, guillotinePackWithMerge, SplitRules } = require('./packing-strategies');

const RECT_CHOICES = ['BAF', 'BSSF', 'BLSF', 'WAF', 'BL'];
const SPLIT_RULES = [SplitRules.SLS, SplitRules.LLS, SplitRules.SAS, SplitRules.LAS, SplitRules.HSPLIT, SplitRules.VSPLIT];

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
  return {
    order,
    rotations,
    rectChoice: RECT_CHOICES[randInt(RECT_CHOICES.length)],
    splitRule: SPLIT_RULES[randInt(SPLIT_RULES.length)],
    useMerge: Math.random() < 0.3,
  };
}

// ── Seeded Chromosomes (smart initial solutions) ────────────────────────────

function createSeededChromosomes(panels) {
  const n = panels.length;
  const seeds = [];

  // Sort by decreasing area
  const byArea = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => (panels[b].width * panels[b].height) - (panels[a].width * panels[a].height));

  // Sort by decreasing width
  const byWidth = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => Math.max(panels[b].width, panels[b].height) - Math.max(panels[a].width, panels[a].height));

  // Sort by decreasing height
  const byHeight = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => panels[b].height - panels[a].height);

  // Sort by decreasing perimeter
  const byPerimeter = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => (panels[b].width + panels[b].height) - (panels[a].width + panels[a].height));

  // Sort by max dimension
  const byMaxDim = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => Math.max(panels[b].width, panels[b].height) - Math.max(panels[a].width, panels[a].height));

  // Sort by min dimension (pack narrow panels together)
  const byMinDim = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => Math.min(panels[b].width, panels[b].height) - Math.min(panels[a].width, panels[a].height));

  // Original order (user's blind sequence)
  const byOriginal = Array.from({ length: n }, (_, i) => i);

  const sortOrders = [byArea, byWidth, byHeight, byPerimeter, byMaxDim, byMinDim, byOriginal];

  // Try no-rotation and smart-rotation for each sort
  for (const sortOrder of sortOrders) {
    // No rotation
    for (const rc of RECT_CHOICES) {
      for (const sr of SPLIT_RULES) {
        for (const merge of [false, true]) {
          seeds.push({
            order: sortOrder.slice(),
            rotations: Array(n).fill(false),
            rectChoice: rc,
            splitRule: sr,
            useMerge: merge,
          });
        }
      }
    }

    // Smart rotation: rotate if panel is wider than tall (prefer tall panels in vertical packing)
    const smartRot = sortOrder.map(i => panels[i].width > panels[i].height);
    for (const rc of RECT_CHOICES) {
      for (const sr of SPLIT_RULES) {
        seeds.push({
          order: sortOrder.slice(),
          rotations: smartRot.slice(),
          rectChoice: rc,
          splitRule: sr,
          useMerge: false,
        });
      }
    }

    // All rotated
    for (const rc of RECT_CHOICES) {
      for (const sr of SPLIT_RULES) {
        seeds.push({
          order: sortOrder.slice(),
          rotations: Array(n).fill(true),
          rectChoice: rc,
          splitRule: sr,
          useMerge: false,
        });
      }
    }
  }

  return seeds;
}

// ── Fitness Evaluation ──────────────────────────────────────────────────────

function evaluate(chromosome, panels, stockWidth) {
  const packFn = chromosome.useMerge ? guillotinePackWithMerge : guillotinePack;
  const result = packFn(
    panels,
    chromosome.order,
    chromosome.rotations,
    stockWidth,
    chromosome.rectChoice,
    chromosome.splitRule,
  );

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

  // Copy segment from parent1
  for (let i = start; i < end && i < n; i++) {
    childOrder[i] = parent1.order[i];
    childRot[i] = parent1.rotations[i];
  }

  // Fill remaining from parent2 in order
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

  return {
    order: childOrder,
    rotations: childRot,
    rectChoice: Math.random() < 0.5 ? parent1.rectChoice : parent2.rectChoice,
    splitRule: Math.random() < 0.5 ? parent1.splitRule : parent2.splitRule,
    useMerge: Math.random() < 0.5 ? parent1.useMerge : parent2.useMerge,
  };
}

/** Partially Mapped Crossover (PMX) */
function pmxCrossover(parent1, parent2) {
  const n = parent1.order.length;
  const start = randInt(n - 1);
  const end = start + 1 + randInt(n - start - 1);

  const child = { ...parent1, order: new Array(n).fill(-1), rotations: parent1.rotations.slice() };

  // Copy segment from parent1
  const mapping = {};
  for (let i = start; i <= end && i < n; i++) {
    child.order[i] = parent1.order[i];
    mapping[parent1.order[i]] = parent2.order[i];
  }

  // Fill from parent2
  for (let i = 0; i < n; i++) {
    if (i >= start && i <= end) continue;
    let val = parent2.order[i];
    while (mapping[val] !== undefined && child.order.includes(val)) {
      val = mapping[val];
    }
    // If val already placed, find next available
    if (child.order.includes(val)) {
      const used = new Set(child.order.filter(v => v !== -1));
      for (let v = 0; v < n; v++) {
        if (!used.has(v)) { val = v; break; }
      }
    }
    child.order[i] = val;
  }

  // Fix any remaining -1s
  const used = new Set(child.order.filter(v => v !== -1));
  const missing = [];
  for (let v = 0; v < n; v++) {
    if (!used.has(v)) missing.push(v);
  }
  let mi = 0;
  for (let i = 0; i < n; i++) {
    if (child.order[i] === -1) child.order[i] = missing[mi++];
  }

  child.rectChoice = Math.random() < 0.5 ? parent1.rectChoice : parent2.rectChoice;
  child.splitRule = Math.random() < 0.5 ? parent1.splitRule : parent2.splitRule;
  child.useMerge = Math.random() < 0.5 ? parent1.useMerge : parent2.useMerge;

  return child;
}

// ── Mutation ────────────────────────────────────────────────────────────────

function mutate(chromosome, mutationRate = 0.15) {
  const n = chromosome.order.length;
  const c = {
    order: chromosome.order.slice(),
    rotations: chromosome.rotations.slice(),
    rectChoice: chromosome.rectChoice,
    splitRule: chromosome.splitRule,
    useMerge: chromosome.useMerge,
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

  // Heuristic mutation
  if (randFloat() < mutationRate * 0.4) {
    c.rectChoice = RECT_CHOICES[randInt(RECT_CHOICES.length)];
  }
  if (randFloat() < mutationRate * 0.4) {
    c.splitRule = SPLIT_RULES[randInt(SPLIT_RULES.length)];
  }
  if (randFloat() < mutationRate * 0.15) {
    c.useMerge = !c.useMerge;
  }

  return c;
}

// ── Scramble mutation (strong disruption) ───────────────────────────────────

function scrambleMutate(chromosome) {
  const n = chromosome.order.length;
  const c = {
    order: chromosome.order.slice(),
    rotations: chromosome.rotations.slice(),
    rectChoice: chromosome.rectChoice,
    splitRule: chromosome.splitRule,
    useMerge: chromosome.useMerge,
  };

  // Scramble a random subsequence
  const start = randInt(n);
  const len = 2 + randInt(Math.min(5, n - start));
  const sub = c.order.slice(start, start + len);
  const subR = c.rotations.slice(start, start + len);
  // Fisher-Yates on sub
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
 * Run the genetic algorithm optimizer.
 *
 * @param {Array} panels - [{id, width, height, label}]
 * @param {Object} options
 * @param {number} options.stockWidth - Available width (default 3000)
 * @param {number} options.populationSize - Population size (default 80)
 * @param {number} options.maxGenerations - Max generations (default 400)
 * @param {number} options.stagnationLimit - Stop after N gens without improvement (default 40)
 * @param {number} options.mutationRate - Base mutation rate (default 0.15)
 * @param {number} options.crossoverRate - Crossover probability (default 0.8)
 * @param {number} options.eliteCount - Number of elites preserved (default 4)
 * @returns {Object} Best solution found
 */
function optimize(panels, options = {}) {
  const {
    stockWidth = 3000,
    populationSize = 100,
    maxGenerations = 500,
    stagnationLimit = 50,
    mutationRate = 0.15,
    crossoverRate = 0.8,
    eliteCount = 6,
  } = options;

  const n = panels.length;
  const startTime = Date.now();

  // ── Phase 1: Exhaustive heuristic sweep ──────────────────────────────────
  // Test all deterministic heuristic combinations first
  const seeds = createSeededChromosomes(panels);
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

  // Include the best seeds
  const evaluatedSeeds = seeds.map(s => ({ chromosome: s, fitness: evaluate(s, panels, stockWidth).fitness }));
  evaluatedSeeds.sort((a, b) => a.fitness - b.fitness);
  const topSeeds = evaluatedSeeds.slice(0, Math.floor(populationSize * 0.3));
  for (const s of topSeeds) population.push(s.chromosome);

  // Fill rest with random
  while (population.length < populationSize) {
    population.push(createRandomChromosome(n));
  }

  // Also inject mutations of the best seed
  if (globalBestChromosome) {
    for (let i = 0; i < Math.floor(populationSize * 0.2); i++) {
      const idx = Math.floor(populationSize * 0.3) + i;
      if (idx < population.length) {
        population[idx] = mutate(globalBestChromosome, 0.3);
      }
    }
  }

  let fitnesses = population.map(c => evaluate(c, panels, stockWidth).fitness);

  // Track best
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

    // Elitism: keep top N
    const indices = fitnesses.map((f, i) => i);
    indices.sort((a, b) => fitnesses[a] - fitnesses[b]);

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
        child = {
          order: child.order.slice(),
          rotations: child.rotations.slice(),
          rectChoice: child.rectChoice,
          splitRule: child.splitRule,
          useMerge: child.useMerge,
        };
      }

      // Mutate
      if (randFloat() < adaptiveMutation) {
        child = mutate(child, adaptiveMutation);
      }

      // Occasional strong mutation
      if (randFloat() < adaptiveMutation * 0.3) {
        child = scrambleMutate(child);
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

    // Adaptive mutation: increase when stagnating
    if (stagnation > 10) {
      adaptiveMutation = Math.min(0.5, mutationRate + (stagnation - 10) * 0.01);
    } else {
      adaptiveMutation = mutationRate;
    }

    // Inject fresh random individuals when stagnating
    if (stagnation > 0 && stagnation % 15 === 0) {
      const numReplace = Math.floor(populationSize * 0.2);
      const worstIndices = indices.slice(-numReplace);
      for (const wi of worstIndices) {
        if (wi < population.length) {
          population[wi] = createRandomChromosome(n);
          fitnesses[wi] = evaluate(population[wi], panels, stockWidth).fitness;
        }
      }
    }

    // Also periodically inject mutations of the global best
    if (stagnation > 0 && stagnation % 10 === 0 && globalBestChromosome) {
      const numInject = Math.floor(populationSize * 0.1);
      for (let i = 0; i < numInject; i++) {
        const wi = indices[indices.length - 1 - i];
        if (wi < population.length) {
          population[wi] = mutate(globalBestChromosome, 0.25);
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

    // Early termination
    if (stagnation >= stagnationLimit) break;

    // Time limit (3000ms)
    if (Date.now() - startTime > 3000) break;
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
    strategy: `Genetic Algorithm + Heuristic Sweep (Gen ${bestGen})`,
    chromosome: globalBestChromosome ? {
      rectChoice: globalBestChromosome.rectChoice,
      splitRule: globalBestChromosome.splitRule,
      useMerge: globalBestChromosome.useMerge,
    } : null,
  };
}

module.exports = { optimize };
