import { MaxRectsPacker } from 'maxrects-packer';
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

export interface Sheet {
    id: number;
    width: number;
    length: number;
    actualUsedLength: number;
    panels: PlacedPanel[];
    efficiency: number;
    wasteArea: number;
    usedArea: number;
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
    private readonly STOCK_WIDTH = 3000; // mm
    private readonly MAX_ROLL_LENGTH = 10000; // mm - standard fabric roll
    private readonly KERF_THICKNESS = 2; // mm - blade width

    /**
     * Main optimization function
     * Groups blinds by fabric, optimizes each group separately
     */
    async optimizeOrder(orderItems: any[]): Promise<Map<string, OptimizationResult>> {
        const results = new Map<string, OptimizationResult>();

        // Group by fabric (Material + FabricType + Colour)
        const fabricGroups = this.groupByFabric(orderItems);

        logger.info(`Optimizing ${fabricGroups.size} fabric groups`);

        // Optimize each fabric group separately
        for (const [fabricKey, items] of fabricGroups) {
            logger.info(`Optimizing fabric group: ${fabricKey} (${items.length} items)`);
            const panels = this.preparePanels(items);
            const optimizationResult = await this.optimizeFabricGroup(fabricKey, panels);
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

        orderItems.forEach((item, index) => {
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
     * Optimize a single fabric group using MaxRects algorithm
     */
    private async optimizeFabricGroup(
        fabricKey: string,
        panels: Panel[]
    ): Promise<OptimizationResult> {
        // Sort panels for optimal packing (First Fit Decreasing)
        const sortedPanels = this.sortPanelsForPacking(panels);

        // Create packer with 3000mm width and 10000mm max height (roll length)
        const packer = new MaxRectsPacker(
            this.STOCK_WIDTH,
            this.MAX_ROLL_LENGTH,
            this.KERF_THICKNESS,
            {
                smart: true,
                pot: false,
                square: false,
                allowRotation: true,
                tag: false,
                border: 0,
            }
        );

        // Add all panels to packer
        sortedPanels.forEach(panel => {
            packer.add(panel.width, panel.length, panel);
        });

        // Convert packer bins to our Sheet format
        const sheets = this.convertBinsToSheets(packer.bins);

        // Calculate statistics
        const statistics = this.calculateStatistics(sheets, panels);

        // Calculate fabric needed
        const totalFabricNeeded = sheets.reduce((sum, sheet) => sum + sheet.actualUsedLength, 0);
        const rollsNeeded = Math.ceil(totalFabricNeeded / this.MAX_ROLL_LENGTH);

        logger.info(`Optimization complete for ${fabricKey}: ${sheets.length} sheets, ${statistics.avgEfficiency.toFixed(2)}% efficiency`);

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
     * Convert MaxRectsPacker bins to our Sheet format
     */
    private convertBinsToSheets(bins: any[]): Sheet[] {
        return bins.map((bin, index) => {
            // Calculate actual used length (highest Y + panel height)
            const actualUsedLength = Math.max(...bin.rects.map((rect: any) =>
                rect.y + (rect.rot ? rect.width : rect.height)
            ));

            // Convert packed rectangles to placed panels
            const panels: PlacedPanel[] = bin.rects.map((rect: any) => ({
                ...rect.data,
                x: rect.x,
                y: rect.y,
                rotated: rect.rot || false,
                width: rect.rot ? rect.height : rect.width,
                length: rect.rot ? rect.width : rect.height,
            }));

            // Calculate areas
            const usedArea = panels.reduce((sum, p) =>
                sum + (p.width * p.length), 0
            );
            const sheetTotalArea = this.STOCK_WIDTH * actualUsedLength;
            const wasteArea = sheetTotalArea - usedArea;
            const efficiency = (usedArea / sheetTotalArea) * 100;

            return {
                id: index + 1,
                width: this.STOCK_WIDTH,
                length: actualUsedLength,
                actualUsedLength,
                panels,
                efficiency: Math.round(efficiency * 100) / 100,
                wasteArea: Math.round(wasteArea),
                usedArea: Math.round(usedArea),
            };
        });
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

            // Get inventory stock
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
