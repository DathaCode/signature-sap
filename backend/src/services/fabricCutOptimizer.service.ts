import { optimizeCutLayout } from './genetic-optimizer';
import type { GeneticResult, GeneticGenerationStats, GeneticValidation } from './genetic-optimizer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// ── Types ────────────────────────────────────────────────────────────────────

export interface Panel {
    id: string;
    width: number;
    length: number;
    label: string;
    blindNumber: number;
    location: string;
    orderItemId: number;
}

export interface PlacedPanel extends Panel {
    x: number;
    y: number;
    rotated: boolean;
}

export interface CutLine {
    type: 'horizontal' | 'vertical';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    position: number;
    label: string;
}

export interface Sheet {
    id: number;
    width: number;
    length: number;
    actualUsedLength: number;
    panels: PlacedPanel[];
    efficiency: number;
    wasteArea: number;
    usedArea: number;
    cutSequence: CutLine[];
}

export interface OptimizationStatistics {
    totalSheets: number;
    totalPanels: number;
    totalUsedArea: number;
    totalWasteArea: number;
    avgEfficiency: number;
}

export interface OptimizationResult {
    fabricKey: string;
    sheets: Sheet[];
    totalFabricNeeded: number; // mm
    rollsNeeded: number;
    efficiency: number; // %
    wastePercentage: number;
    statistics: OptimizationStatistics;
    // Genetic algorithm metadata
    generationStats?: GeneticGenerationStats;
    validation?: GeneticValidation;
    isGuillotineValid?: boolean;
    strategy?: string;
}

export interface InventoryCheck {
    sufficient: boolean;
    shortages: {
        fabricKey: string;
        needed: number;
        available: number;
        shortage: number;
    }[];
}

// ── Motor-specific width deductions ──────────────────────────────────────────

const MOTOR_DEDUCTIONS: Record<string, number> = {
    // Winders (28mm deduction)
    'TBS winder-32mm': 28,
    'Acmeda winder-29mm': 28,

    // Automate motors (29mm deduction)
    'Automate 1.1NM Li-Ion Quiet Motor': 29,
    'Automate 0.7NM Li-Ion Quiet Motor': 29,
    'Automate 2NM Li-Ion Quiet Motor': 29,
    'Automate 3NM Li-Ion Motor': 29,
    'Automate E6 6NM Motor': 29,

    // Alpha Battery motors (30mm deduction)
    'Alpha 1NM Battery Motor': 30,
    'Alpha 2NM Battery Motor': 30,
    'Alpha 3NM Battery Motor': 30,

    // Alpha AC motors (35mm deduction)
    'Alpha AC 5NM Motor': 35,
};

// ── Service ──────────────────────────────────────────────────────────────────

export class FabricCutOptimizerService {
    private readonly STOCK_WIDTH = 3000; // mm – fixed fabric roll width
    private readonly DROP_ADDITION = 200; // mm added to drop for fabric cutting

    /**
     * Main optimization entry point.
     * Groups blinds by fabric, runs genetic optimizer on each group.
     */
    async optimizeOrder(orderItems: any[]): Promise<Map<string, OptimizationResult>> {
        const results = new Map<string, OptimizationResult>();
        const fabricGroups = this.groupByFabric(orderItems);

        logger.info(`Optimizing ${fabricGroups.size} fabric group(s) (Genetic Algorithm)`);

        for (const [fabricKey, items] of fabricGroups) {
            logger.info(`Optimizing fabric group: ${fabricKey} (${items.length} items)`);
            const panels = this.preparePanels(items);
            const result = this.optimizeFabricGroup(fabricKey, panels);
            results.set(fabricKey, result);
        }

        return results;
    }

    // ── Grouping ─────────────────────────────────────────────────────────────

    private groupByFabric(orderItems: any[]): Map<string, any[]> {
        const groups = new Map<string, any[]>();

        orderItems.forEach(item => {
            const key = `${item.material || 'Unknown'} - ${item.fabricType || 'Unknown'} - ${item.fabricColour || 'Unknown'}`;
            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key)!.push(item);
        });

        return groups;
    }

    // ── Panel preparation ────────────────────────────────────────────────────

    /**
     * Convert order items to panels with motor-specific width deductions
     * and +200mm drop addition.
     */
    private preparePanels(orderItems: any[]): Panel[] {
        return orderItems.map((item) => {
            const widthDeduction = this.getWidthDeduction(item.chainOrMotor || '');
            const fabricCutWidth = item.width - widthDeduction;
            const calculatedDrop = item.drop + this.DROP_ADDITION;

            return {
                id: `panel-${item.id}`,
                width: fabricCutWidth,
                length: calculatedDrop,
                label: `${item.location} (${fabricCutWidth}×${calculatedDrop})`,
                blindNumber: item.itemNumber,
                location: item.location,
                orderItemId: item.id,
            };
        });
    }

    /**
     * Get width deduction based on motor type.
     */
    private getWidthDeduction(motorType: string): number {
        return MOTOR_DEDUCTIONS[motorType] || 28; // Default 28mm for chains
    }

    // ── Core optimization ────────────────────────────────────────────────────

    /**
     * Optimize a single fabric group using the genetic algorithm.
     * Produces one continuous sheet (no multi-bin) with guillotine-valid cuts.
     */
    private optimizeFabricGroup(
        fabricKey: string,
        panels: Panel[]
    ): OptimizationResult {
        // Prepare input for genetic optimizer (numeric IDs for index lookup)
        const gaInput = panels.map((p, index) => ({
            id: index,
            width: p.width,
            height: p.length,
            label: p.label,
        }));

        // Validate all panels can fit in stock width (either orientation)
        for (const panel of gaInput) {
            const minDim = Math.min(panel.width, panel.height);
            if (minDim > this.STOCK_WIDTH) {
                throw new Error(
                    `Panel "${panel.label}" (${panel.width}×${panel.height}mm) ` +
                    `cannot fit in stock width ${this.STOCK_WIDTH}mm even when rotated`
                );
            }
        }

        // Run genetic algorithm
        const gaResult: GeneticResult = optimizeCutLayout(gaInput, {
            stockWidth: this.STOCK_WIDTH,
            populationSize: 150,
            maxGenerations: 800,
            stagnationLimit: 80,
            validate: true,
        });

        if (!gaResult.success) {
            logger.warn(`Genetic optimizer failed for ${fabricKey}`);
            return this.emptyResult(fabricKey, panels.length);
        }

        // Map GA placed panels back to our PlacedPanel format.
        // GA returns PLACED dimensions (post-rotation); we store ORIGINAL dimensions
        // and use the `rotated` flag so the frontend can swap for rendering.
        const placedPanels: PlacedPanel[] = gaResult.panels.map((gp) => {
            const original = panels[gp.id];
            return {
                ...original,
                x: gp.x,
                y: gp.y,
                width: original.width,   // ORIGINAL (unrotated) width
                length: original.length,  // ORIGINAL (unrotated) length
                rotated: gp.rotated,
            };
        });

        const actualUsedLength = Math.ceil(gaResult.dimensions.height);

        // Generate guillotine cut sequence for visualization / PDF
        const cutSequence = this.generateCutSequence(
            placedPanels,
            this.STOCK_WIDTH,
            actualUsedLength
        );

        const sheet: Sheet = {
            id: 1,
            width: this.STOCK_WIDTH,
            length: actualUsedLength,
            actualUsedLength,
            panels: placedPanels,
            efficiency: gaResult.efficiency,
            wasteArea: Math.round(gaResult.materialUsage.wasteArea),
            usedArea: Math.round(gaResult.materialUsage.panelArea),
            cutSequence,
        };

        logger.info(
            `Genetic optimization for ${fabricKey}: ${gaResult.efficiency}% efficiency, ` +
            `${actualUsedLength}mm fabric, guillotine=${gaResult.isGuillotineValid}, ` +
            `gen=${gaResult.generationStats.bestGeneration}/${gaResult.generationStats.totalGenerations}, ` +
            `${gaResult.generationStats.convergenceTime}ms`
        );

        return {
            fabricKey,
            sheets: [sheet],
            totalFabricNeeded: actualUsedLength,
            rollsNeeded: Math.ceil(actualUsedLength / 10000),
            efficiency: gaResult.efficiency,
            wastePercentage: gaResult.materialUsage.wastePercent,
            statistics: {
                totalSheets: 1,
                totalPanels: placedPanels.length,
                totalUsedArea: Math.round(gaResult.materialUsage.panelArea),
                totalWasteArea: Math.round(gaResult.materialUsage.wasteArea),
                avgEfficiency: gaResult.efficiency,
            },
            generationStats: gaResult.generationStats,
            validation: gaResult.validation,
            isGuillotineValid: gaResult.isGuillotineValid,
            strategy: gaResult.strategy,
        };
    }

    private emptyResult(fabricKey: string, panelCount: number): OptimizationResult {
        return {
            fabricKey,
            sheets: [],
            totalFabricNeeded: 0,
            rollsNeeded: 0,
            efficiency: 0,
            wastePercentage: 100,
            statistics: {
                totalSheets: 0,
                totalPanels: panelCount,
                totalUsedArea: 0,
                totalWasteArea: 0,
                avgEfficiency: 0,
            },
        };
    }

    // ── Cut sequence generation ──────────────────────────────────────────────

    /**
     * Generate guillotine cut sequence for visualization.
     * Collects panel edge boundaries as full-width horizontal and
     * full-height vertical cut lines.
     */
    private generateCutSequence(
        panels: PlacedPanel[],
        sheetWidth: number,
        sheetLength: number
    ): CutLine[] {
        const cutLines: CutLine[] = [];

        // Horizontal cuts (across full width)
        const yPositions = new Set<number>();
        panels.forEach(p => {
            const height = p.rotated ? p.width : p.length;
            if (p.y > 0) yPositions.add(p.y);
            const bottomEdge = p.y + height;
            if (bottomEdge < sheetLength - 20) yPositions.add(bottomEdge);
        });

        const sortedY = [...yPositions].sort((a, b) => a - b);
        sortedY.forEach(y => {
            cutLines.push({
                type: 'horizontal',
                x1: 0,
                y1: y,
                x2: sheetWidth,
                y2: y,
                position: y,
                label: `${y}mm`,
            });
        });

        // Vertical cuts (across full height)
        const xPositions = new Set<number>();
        panels.forEach(p => {
            const width = p.rotated ? p.length : p.width;
            if (p.x > 0) xPositions.add(p.x);
            const rightEdge = p.x + width;
            if (rightEdge < sheetWidth - 10) xPositions.add(rightEdge);
        });

        const sortedX = [...xPositions].sort((a, b) => a - b);
        sortedX.forEach(x => {
            cutLines.push({
                type: 'vertical',
                x1: x,
                y1: 0,
                x2: x,
                y2: sheetLength,
                position: x,
                label: `${x}mm`,
            });
        });

        return cutLines;
    }

    // ── Inventory check ──────────────────────────────────────────────────────

    /**
     * Check if inventory has sufficient fabric for the optimization results.
     */
    async checkInventorySufficiency(
        optimizationResults: Map<string, OptimizationResult>
    ): Promise<InventoryCheck> {
        const shortages = [];

        for (const [fabricKey, result] of optimizationResults) {
            const [material, fabricType, colour] = fabricKey.split(' - ');
            const inventoryKey = `${material} - ${fabricType}`;

            const inventoryItem = await prisma.inventoryItem.findFirst({
                where: {
                    category: 'FABRIC',
                    itemName: inventoryKey,
                    colorVariant: colour,
                },
            });

            const availableMm = inventoryItem ? Number(inventoryItem.quantity) : 0;
            const neededMm = result.totalFabricNeeded;

            if (availableMm < neededMm) {
                shortages.push({
                    fabricKey,
                    needed: neededMm,
                    available: availableMm,
                    shortage: neededMm - availableMm,
                });
            }
        }

        return {
            sufficient: shortages.length === 0,
            shortages,
        };
    }
}

// Export singleton instance
export const fabricCutOptimizer = new FabricCutOptimizerService();
