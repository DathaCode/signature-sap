import { packer } from 'guillotine-packer';
import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

// Types
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
    fabricKey: string; // "Material - FabricType - Colour"
    sheets: Sheet[];
    totalFabricNeeded: number; // in mm
    rollsNeeded: number; // number of 10m rolls
    efficiency: number; // overall %
    wastePercentage: number;
    statistics: OptimizationStatistics;
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

/**
 * Motor-specific width deduction mapping
 * Fabric cut width = Blind width - Motor deduction
 */
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

export class FabricCutOptimizerService {
    private readonly STOCK_WIDTH = 3000; // mm - fixed fabric roll width
    private readonly CONTINUOUS_STOCK_LENGTH = 99999; // mm - continuous roll for optimization
    private readonly KERF_THICKNESS = 2; // mm - blade width

    /**
     * Main optimization function
     * Groups blinds by fabric, optimizes each group separately
     */
    async optimizeOrder(orderItems: any[]): Promise<Map<string, OptimizationResult>> {
        const results = new Map<string, OptimizationResult>();

        // Group by fabric (Material + FabricType + Colour)
        const fabricGroups = this.groupByFabric(orderItems);

        logger.info(`Optimizing ${fabricGroups.size} fabric groups (Guillotine algorithm)`);

        // Optimize each fabric group separately
        for (const [fabricKey, items] of fabricGroups) {
            logger.info(`Optimizing fabric group: ${fabricKey} (${items.length} items)`);
            const panels = this.preparePanels(items);
            const optimizationResult = this.optimizeFabricGroup(fabricKey, panels);
            results.set(fabricKey, optimizationResult);
        }

        return results;
    }

    /**
     * Group order items by fabric type
     */
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

    /**
     * Convert order items to panels with motor-specific width deductions
     */
    private preparePanels(orderItems: any[]): Panel[] {
        const panels: Panel[] = [];

        orderItems.forEach((item) => {
            // Apply width deduction based on motor type
            const widthDeduction = this.getWidthDeduction(item.chainOrMotor || '');
            const fabricCutWidth = item.width - widthDeduction;
            const calculatedDrop = item.drop + 150; // Always +150mm

            panels.push({
                id: `panel-${item.id}`,
                width: fabricCutWidth,
                length: calculatedDrop,
                label: `${item.location} (${fabricCutWidth}×${calculatedDrop})`,
                blindNumber: item.itemNumber,
                location: item.location,
                orderItemId: item.id,
            });
        });

        return panels;
    }

    /**
     * Get width deduction based on motor type
     */
    private getWidthDeduction(motorType: string): number {
        return MOTOR_DEDUCTIONS[motorType] || 28; // Default for chains
    }

    /**
     * Optimize a single fabric group using Guillotine algorithm
     * Uses continuous stock length to find minimum fabric needed
     */
    private optimizeFabricGroup(
        fabricKey: string,
        panels: Panel[]
    ): OptimizationResult {
        // Sort panels for optimal packing (First Fit Decreasing)
        const sortedPanels = this.sortPanelsForPacking(panels);

        // Prepare items for guillotine-packer (uses width/height convention)
        const items = sortedPanels.map(p => ({
            width: p.width,
            height: p.length,
            panelData: p,
        }));

        // Run guillotine packer with continuous stock length
        // When strategies are undefined, the packer tries ALL combinations
        // and returns the best result
        const result = packer(
            {
                binWidth: this.STOCK_WIDTH,
                binHeight: this.CONTINUOUS_STOCK_LENGTH,
                items,
            },
            {
                kerfSize: this.KERF_THICKNESS,
                allowRotation: true,
            }
        );

        // Handle null result (packing failed)
        if (!result || result.length === 0) {
            logger.warn(`Guillotine packing returned no bins for ${fabricKey}`);
            return {
                fabricKey,
                sheets: [],
                totalFabricNeeded: 0,
                rollsNeeded: 0,
                efficiency: 0,
                wastePercentage: 100,
                statistics: {
                    totalSheets: 0,
                    totalPanels: panels.length,
                    totalUsedArea: 0,
                    totalWasteArea: 0,
                    avgEfficiency: 0,
                },
            };
        }

        // Convert packer bins to our Sheet format
        const sheets = this.convertBinsToSheets(result);

        // Calculate statistics
        const statistics = this.calculateStatistics(sheets, panels);

        // Calculate fabric needed (sum of actual used lengths)
        const totalFabricNeeded = sheets.reduce((sum, sheet) => sum + sheet.actualUsedLength, 0);
        const rollsNeeded = Math.ceil(totalFabricNeeded / 10000);

        logger.info(
            `Guillotine optimization for ${fabricKey}: ${sheets.length} sheets, ` +
            `${statistics.avgEfficiency.toFixed(2)}% efficiency, ${totalFabricNeeded}mm fabric`
        );

        return {
            fabricKey,
            sheets,
            totalFabricNeeded,
            rollsNeeded,
            efficiency: statistics.avgEfficiency,
            wastePercentage: 100 - statistics.avgEfficiency,
            statistics,
        };
    }

    /**
     * Convert guillotine-packer bins to our Sheet format
     */
    private convertBinsToSheets(bins: any[][]): Sheet[] {
        return bins.map((bin, index) => {
            // Convert packed items to placed panels
            const panels: PlacedPanel[] = bin.map((rect: any) => {
                const originalItem = rect.item;
                const panel = originalItem.panelData as Panel;

                // Detect rotation: placed dimensions differ from original input
                const isRotated = rect.width !== originalItem.width || rect.height !== originalItem.height;

                return {
                    ...panel,
                    x: rect.x,
                    y: rect.y,
                    // Store ORIGINAL (unrotated) dimensions
                    // Frontend swaps based on rotated flag for on-screen rendering
                    width: panel.width,
                    length: panel.length,
                    rotated: isRotated,
                };
            });

            // Calculate actual used length (not 99,999mm!)
            const actualUsedLength = this.calculateActualUsedLength(panels);

            // Calculate areas based on actual used length
            const usedArea = panels.reduce((sum, p) =>
                sum + (p.width * p.length), 0
            );
            const sheetTotalArea = this.STOCK_WIDTH * actualUsedLength;
            const wasteArea = sheetTotalArea - usedArea;
            const efficiency = sheetTotalArea > 0 ? (usedArea / sheetTotalArea) * 100 : 0;

            // Generate guillotine cut sequence for visualization
            const cutSequence = this.generateCutSequence(panels, this.STOCK_WIDTH, actualUsedLength);

            return {
                id: index + 1,
                width: this.STOCK_WIDTH,
                length: actualUsedLength,
                actualUsedLength,
                panels,
                efficiency: Math.round(efficiency * 100) / 100,
                wasteArea: Math.round(wasteArea),
                usedArea: Math.round(usedArea),
                cutSequence,
            };
        });
    }

    /**
     * Calculate actual used length from panel positions
     * This is the KEY to continuous stock optimization — only deduct what's actually used
     */
    private calculateActualUsedLength(panels: PlacedPanel[]): number {
        if (panels.length === 0) return 0;

        // Find the highest point of any panel (accounting for rotation)
        const maxY = Math.max(...panels.map(panel => {
            const onSheetHeight = panel.rotated ? panel.width : panel.length;
            return panel.y + onSheetHeight;
        }));

        // Add small buffer for blade clearance
        return Math.ceil(maxY + 10);
    }

    /**
     * Generate guillotine cut sequence for visualization
     * Guillotine cuts go completely across the sheet or sub-rectangle
     */
    private generateCutSequence(
        panels: PlacedPanel[],
        sheetWidth: number,
        sheetLength: number
    ): CutLine[] {
        const cutLines: CutLine[] = [];

        // Collect all unique Y boundaries (horizontal cuts across full width)
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

        // Collect all unique X boundaries (vertical cuts across full height)
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

    /**
     * Sort panels for optimal packing (First Fit Decreasing)
     */
    private sortPanelsForPacking(panels: Panel[]): Panel[] {
        return [...panels].sort((a, b) => {
            // Sort by area (largest first)
            const areaA = a.width * a.length;
            const areaB = b.width * b.length;
            if (areaA !== areaB) return areaB - areaA;

            // If same area, sort by longest dimension
            const maxA = Math.max(a.width, a.length);
            const maxB = Math.max(b.width, b.length);
            return maxB - maxA;
        });
    }

    /**
     * Calculate optimization statistics
     */
    private calculateStatistics(sheets: Sheet[], panels: Panel[]): OptimizationStatistics {
        const totalUsedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
        const totalWasteArea = sheets.reduce((sum, s) => sum + s.wasteArea, 0);
        const totalArea = totalUsedArea + totalWasteArea;
        const avgEfficiency = totalArea > 0 ? (totalUsedArea / totalArea) * 100 : 0;

        return {
            totalSheets: sheets.length,
            totalPanels: panels.length,
            totalUsedArea: Math.round(totalUsedArea),
            totalWasteArea: Math.round(totalWasteArea),
            avgEfficiency: Math.round(avgEfficiency * 100) / 100,
        };
    }

    /**
     * Check if inventory has sufficient fabric
     */
    async checkInventorySufficiency(
        optimizationResults: Map<string, OptimizationResult>
    ): Promise<InventoryCheck> {
        const shortages = [];

        for (const [fabricKey, result] of optimizationResults) {
            const [material, fabricType, colour] = fabricKey.split(' - ');

            // Fabric inventory key: itemName = "Material - FabricType", colorVariant = "Colour"
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
