import { logger } from '../config/logger';

// Types
export interface PanelInput {
    width: number;
    length: number;
    qty: number;
    label: string;
    originalWidth?: number;
    originalDrop?: number;
    orderItemId?: number;
}

export interface PlacedPanel {
    id: string;
    width: number;
    length: number;
    x: number;
    y: number;
    rotated: boolean;
    label: string;
    originalIndex: number;
    originalWidth?: number;
    originalDrop?: number;
    orderItemId?: number;
}

interface FreeRectangle {
    x: number;
    y: number;
    width: number;
    length: number;
}

export interface Sheet {
    id: number;
    width: number;
    length: number;
    panels: PlacedPanel[];
    freeRectangles: FreeRectangle[];
    usedArea: number;
    wastedArea: number;
    efficiency: number;
}

export interface OptimizationStatistics {
    usedStockSheets: number;
    stockDimensions: string;
    totalUsedArea: number;
    totalWastedArea: number;
    wastePercentage: number;
    efficiency: number;
    totalCuts: number;
    totalPanels: number;
    totalFabricNeeded: number; // mm to deduct from inventory
}

export interface CutEntry {
    cutNumber: number;
    sheetNumber: number;
    x: number;
    y: number;
    width: number;
    length: number;
    rotated: boolean;
    label: string;
}

export interface OptimizationResult {
    sheets: Sheet[];
    statistics: OptimizationStatistics;
    cuts: CutEntry[];
}

interface ExpandedPanel {
    id: string;
    width: number;
    length: number;
    originalIndex: number;
    label: string;
    rotated: boolean;
    originalWidth?: number;
    originalDrop?: number;
    orderItemId?: number;
}

export interface CutlistOptimizerConfig {
    stockWidth?: number;
    stockLength?: number;
    kerfThickness?: number;
}

export class CutlistOptimizer {
    private stockWidth: number;
    private stockLength: number;
    private kerfThickness: number;

    constructor(config: CutlistOptimizerConfig = {}) {
        this.stockWidth = config.stockWidth || 3000;
        this.stockLength = config.stockLength || 10000;
        this.kerfThickness = config.kerfThickness || 0;
    }

    optimize(panels: PanelInput[]): OptimizationResult {
        const expandedPanels = this.expandPanels(panels);
        const sortedPanels = this.sortPanels(expandedPanels);
        const sheets = this.packPanels(sortedPanels);
        const statistics = this.calculateStatistics(sheets, panels);
        const cuts = this.generateCutList(sheets);

        return { sheets, statistics, cuts };
    }

    private expandPanels(panels: PanelInput[]): ExpandedPanel[] {
        const expanded: ExpandedPanel[] = [];
        panels.forEach((panel, index) => {
            for (let i = 0; i < panel.qty; i++) {
                expanded.push({
                    id: `${index}-${i}`,
                    width: panel.width,
                    length: panel.length,
                    originalIndex: index,
                    label: panel.label || `${panel.width}x${panel.length}`,
                    rotated: false,
                    originalWidth: panel.originalWidth,
                    originalDrop: panel.originalDrop,
                    orderItemId: panel.orderItemId,
                });
            }
        });
        return expanded;
    }

    private sortPanels(panels: ExpandedPanel[]): ExpandedPanel[] {
        return [...panels].sort((a, b) => {
            const areaA = a.width * a.length;
            const areaB = b.width * b.length;
            if (areaA !== areaB) return areaB - areaA;
            const maxA = Math.max(a.width, a.length);
            const maxB = Math.max(b.width, b.length);
            return maxB - maxA;
        });
    }

    private packPanels(panels: ExpandedPanel[]): Sheet[] {
        const sheets: Sheet[] = [];
        let currentSheetIndex = 0;

        for (const panel of panels) {
            let placed = false;

            for (const sheet of sheets) {
                if (this.tryPlacePanel(sheet, panel)) {
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                const newSheet = this.createNewSheet(currentSheetIndex++);
                if (this.tryPlacePanel(newSheet, panel)) {
                    sheets.push(newSheet);
                } else {
                    logger.warn(`Panel too large for stock sheet: ${panel.label} (${panel.width}x${panel.length})`);
                }
            }
        }

        return sheets;
    }

    private createNewSheet(index: number): Sheet {
        return {
            id: index + 1,
            width: this.stockWidth,
            length: this.stockLength,
            panels: [],
            freeRectangles: [{
                x: 0,
                y: 0,
                width: this.stockWidth,
                length: this.stockLength,
            }],
            usedArea: 0,
            wastedArea: this.stockWidth * this.stockLength,
            efficiency: 0,
        };
    }

    private tryPlacePanel(sheet: Sheet, panel: ExpandedPanel): boolean {
        for (let i = 0; i < sheet.freeRectangles.length; i++) {
            const rect = sheet.freeRectangles[i];

            // Try normal orientation
            if (this.canFit(panel.width, panel.length, rect)) {
                this.placePanel(sheet, panel, rect, i, false);
                return true;
            }

            // Try rotated orientation
            if (panel.width !== panel.length &&
                this.canFit(panel.length, panel.width, rect)) {
                this.placePanel(sheet, panel, rect, i, true);
                return true;
            }
        }
        return false;
    }

    private canFit(width: number, length: number, rect: FreeRectangle): boolean {
        return width + this.kerfThickness <= rect.width &&
               length + this.kerfThickness <= rect.length;
    }

    private placePanel(
        sheet: Sheet,
        panel: ExpandedPanel,
        rect: FreeRectangle,
        rectIndex: number,
        rotated: boolean
    ): void {
        const placedPanel: PlacedPanel = {
            id: panel.id,
            x: rect.x,
            y: rect.y,
            width: rotated ? panel.length : panel.width,
            length: rotated ? panel.width : panel.length,
            rotated,
            label: panel.label,
            originalIndex: panel.originalIndex,
            originalWidth: panel.originalWidth,
            originalDrop: panel.originalDrop,
            orderItemId: panel.orderItemId,
        };

        sheet.panels.push(placedPanel);
        sheet.usedArea += placedPanel.width * placedPanel.length;
        const totalArea = sheet.width * sheet.length;
        sheet.wastedArea = totalArea - sheet.usedArea;
        sheet.efficiency = Math.round((sheet.usedArea / totalArea) * 100);

        // Remove used rectangle
        sheet.freeRectangles.splice(rectIndex, 1);

        // Split remaining space (Guillotine split)
        this.splitRectangle(sheet, rect, placedPanel);
    }

    private splitRectangle(sheet: Sheet, rect: FreeRectangle, panel: PlacedPanel): void {
        const kerfWidth = panel.width + this.kerfThickness;
        const kerfLength = panel.length + this.kerfThickness;

        // Right rectangle
        if (rect.width > kerfWidth) {
            sheet.freeRectangles.push({
                x: rect.x + kerfWidth,
                y: rect.y,
                width: rect.width - kerfWidth,
                length: rect.length,
            });
        }

        // Top rectangle
        if (rect.length > kerfLength) {
            sheet.freeRectangles.push({
                x: rect.x,
                y: rect.y + kerfLength,
                width: kerfWidth,
                length: rect.length - kerfLength,
            });
        }

        // Merge overlapping rectangles
        this.mergeFreeRectangles(sheet);
    }

    private mergeFreeRectangles(sheet: Sheet): void {
        sheet.freeRectangles = sheet.freeRectangles.filter((rect, i) => {
            return !sheet.freeRectangles.some((other, j) => {
                if (i === j) return false;
                return this.isRectangleInside(rect, other);
            });
        });
    }

    private isRectangleInside(rect1: FreeRectangle, rect2: FreeRectangle): boolean {
        return rect1.x >= rect2.x &&
               rect1.y >= rect2.y &&
               rect1.x + rect1.width <= rect2.x + rect2.width &&
               rect1.y + rect1.length <= rect2.y + rect2.length;
    }

    private calculateStatistics(sheets: Sheet[], originalPanels: PanelInput[]): OptimizationStatistics {
        const totalStockArea = sheets.length * this.stockWidth * this.stockLength;
        const totalUsedArea = sheets.reduce((sum, s) => sum + s.usedArea, 0);
        const totalWastedArea = totalStockArea - totalUsedArea;
        const totalCuts = sheets.reduce((sum, s) => sum + s.panels.length, 0);
        const totalPanels = originalPanels.reduce((sum, p) => sum + p.qty, 0);

        // Total fabric needed in mm (sheets × stockLength)
        const totalFabricNeeded = sheets.length * this.stockLength;

        return {
            usedStockSheets: sheets.length,
            stockDimensions: `${this.stockWidth}x${this.stockLength}`,
            totalUsedArea: Math.round(totalUsedArea),
            totalWastedArea: Math.round(totalWastedArea),
            wastePercentage: totalStockArea > 0 ? Math.round((totalWastedArea / totalStockArea) * 100) : 0,
            efficiency: totalStockArea > 0 ? Math.round((totalUsedArea / totalStockArea) * 100) : 0,
            totalCuts,
            totalPanels,
            totalFabricNeeded,
        };
    }

    private generateCutList(sheets: Sheet[]): CutEntry[] {
        const cuts: CutEntry[] = [];

        sheets.forEach((sheet) => {
            sheet.panels.forEach((panel) => {
                cuts.push({
                    cutNumber: cuts.length + 1,
                    sheetNumber: sheet.id,
                    x: panel.x,
                    y: panel.y,
                    width: panel.width,
                    length: panel.length,
                    rotated: panel.rotated,
                    label: panel.label,
                });
            });
        });

        return cuts;
    }
}
