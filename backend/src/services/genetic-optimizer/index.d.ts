/**
 * Type declarations for the genetic-optimizer module.
 *
 * 3.5-Stage Guillotine Packing with Genetic Algorithm optimization.
 * Matches CutLogic "3.5 stages ver": V-H-V-H staged cutting.
 *
 * The optimizer uses a hybrid approach:
 *   Phase 1 - Exhaustive heuristic sweep (~40 deterministic seed combinations)
 *   Phase 2 - GA population initialization (top seeds + random + mutations)
 *   Phase 3 - Evolution (tournament selection, OX/PMX crossover, adaptive mutation)
 *
 * Produces 3.5-stage guillotine-valid layouts — no nested cuts.
 */

export interface GeneticPanel {
    id: number;
    width: number;
    height: number;
    label?: string;
}

export interface GeneticOptions {
    stockWidth?: number;
    kerf?: number;
    populationSize?: number;
    maxGenerations?: number;
    stagnationLimit?: number;
    mutationRate?: number;
    crossoverRate?: number;
    eliteCount?: number;
    validate?: boolean;
}

export interface PlacedGeneticPanel {
    id: number;
    label: string;
    x: number;
    y: number;
    /** Placed width (after rotation applied) */
    width: number;
    /** Placed height (after rotation applied) */
    height: number;
    rotated: boolean;
}

export interface GeneticValidation {
    overlaps: number;
    outOfBounds: number;
    isGuillotineValid: boolean;
    guillotineStages: number;
}

export interface GeneticGenerationStats {
    totalGenerations: number;
    bestGeneration: number;
    convergenceTime: number;
    populationSize: number;
    seedsTested: number;
}

export interface GeneticMaterialUsage {
    panelArea: number;
    fabricArea: number;
    wasteArea: number;
    wastePercent: number;
    fabricLength: number;
    fabricWidth: number;
}

export interface GeneticResult {
    success: boolean;
    dimensions: {
        width: number;
        height: number;
    };
    efficiency: number;
    panels: PlacedGeneticPanel[];
    materialUsage: GeneticMaterialUsage;
    validation: GeneticValidation;
    isGuillotineValid: boolean;
    generationStats: GeneticGenerationStats;
    strategy: string;
}

export function optimizeCutLayout(panels: GeneticPanel[], options?: GeneticOptions): GeneticResult;
