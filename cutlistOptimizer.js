/**
 * Cutlist Optimizer - 2D Bin Packing Algorithm for Fabric Roll Cutting
 * Optimizes fabric cutting patterns to minimize waste
 * 
 * Stock Sheet Dimensions:
 * - Width: 3000mm (fixed)
 * - Length: 10000mm (default roll length)
 */

class CutlistOptimizer {
  constructor(config = {}) {
    this.stockWidth = config.stockWidth || 3000; // mm
    this.stockLength = config.stockLength || 10000; // mm
    this.kerfThickness = config.kerfThickness || 0; // blade thickness
    this.optimizationPriority = config.optimizationPriority || 'least_wasted_area';
  }

  /**
   * Main optimization function
   * @param {Array} panels - Array of panel objects {width, length, qty, label}
   * @returns {Object} Optimization result with cutting patterns
   */
  optimize(panels) {
    // Prepare panels for optimization
    const expandedPanels = this.expandPanels(panels);
    
    // Sort panels for optimal packing (largest first - First Fit Decreasing)
    const sortedPanels = this.sortPanels(expandedPanels);
    
    // Pack panels into stock sheets
    const sheets = this.packPanels(sortedPanels);
    
    // Calculate statistics
    const statistics = this.calculateStatistics(sheets, panels);
    
    return {
      sheets,
      statistics,
      cuts: this.generateCutList(sheets)
    };
  }

  /**
   * Expand panels based on quantity
   */
  expandPanels(panels) {
    const expanded = [];
    panels.forEach((panel, index) => {
      for (let i = 0; i < panel.qty; i++) {
        expanded.push({
          id: `${index}-${i}`,
          width: panel.width,
          length: panel.length,
          originalIndex: index,
          label: panel.label || `${panel.width}×${panel.length}`,
          rotation: false
        });
      }
    });
    return expanded;
  }

  /**
   * Sort panels for optimal packing (First Fit Decreasing)
   */
  sortPanels(panels) {
    return panels.sort((a, b) => {
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
   * Pack panels into stock sheets using Guillotine algorithm
   */
  packPanels(panels) {
    const sheets = [];
    let currentSheetIndex = 0;

    panels.forEach(panel => {
      let placed = false;

      // Try to place in existing sheets
      for (let i = 0; i < sheets.length; i++) {
        if (this.tryPlacePanel(sheets[i], panel)) {
          placed = true;
          break;
        }
      }

      // If not placed, create new sheet
      if (!placed) {
        const newSheet = this.createNewSheet(currentSheetIndex++);
        if (this.tryPlacePanel(newSheet, panel)) {
          sheets.push(newSheet);
        } else {
          console.error('Panel too large for stock sheet:', panel);
        }
      }
    });

    return sheets;
  }

  /**
   * Create a new sheet with initial free rectangle
   */
  createNewSheet(index) {
    return {
      id: index + 1,
      width: this.stockWidth,
      length: this.stockLength,
      panels: [],
      freeRectangles: [{
        x: 0,
        y: 0,
        width: this.stockWidth,
        length: this.stockLength
      }],
      usedArea: 0,
      wastedArea: this.stockWidth * this.stockLength
    };
  }

  /**
   * Try to place a panel in a sheet using Guillotine algorithm
   */
  tryPlacePanel(sheet, panel) {
    // Try all free rectangles
    for (let i = 0; i < sheet.freeRectangles.length; i++) {
      const rect = sheet.freeRectangles[i];

      // Try normal orientation
      if (this.canFit(panel.width, panel.length, rect)) {
        this.placePanel(sheet, panel, rect, i, false);
        return true;
      }

      // Try rotated orientation (if different from normal)
      if (panel.width !== panel.length && 
          this.canFit(panel.length, panel.width, rect)) {
        this.placePanel(sheet, panel, rect, i, true);
        return true;
      }
    }

    return false;
  }

  /**
   * Check if panel can fit in rectangle
   */
  canFit(width, length, rect) {
    return width + this.kerfThickness <= rect.width && 
           length + this.kerfThickness <= rect.length;
  }

  /**
   * Place panel and split remaining space
   */
  placePanel(sheet, panel, rect, rectIndex, rotated) {
    const placedPanel = {
      ...panel,
      x: rect.x,
      y: rect.y,
      width: rotated ? panel.length : panel.width,
      length: rotated ? panel.width : panel.length,
      rotated
    };

    sheet.panels.push(placedPanel);
    sheet.usedArea += placedPanel.width * placedPanel.length;
    sheet.wastedArea = (sheet.width * sheet.length) - sheet.usedArea;

    // Remove used rectangle
    sheet.freeRectangles.splice(rectIndex, 1);

    // Split remaining space (Guillotine split)
    this.splitRectangle(sheet, rect, placedPanel);
  }

  /**
   * Split rectangle after placing panel (Guillotine algorithm)
   */
  splitRectangle(sheet, rect, panel) {
    const kerfWidth = panel.width + this.kerfThickness;
    const kerfLength = panel.length + this.kerfThickness;

    // Right rectangle
    if (rect.width > kerfWidth) {
      sheet.freeRectangles.push({
        x: rect.x + kerfWidth,
        y: rect.y,
        width: rect.width - kerfWidth,
        length: rect.length
      });
    }

    // Top rectangle
    if (rect.length > kerfLength) {
      sheet.freeRectangles.push({
        x: rect.x,
        y: rect.y + kerfLength,
        width: kerfWidth,
        length: rect.length - kerfLength
      });
    }

    // Merge overlapping rectangles
    this.mergeFreeRectangles(sheet);
  }

  /**
   * Merge overlapping free rectangles to improve packing efficiency
   */
  mergeFreeRectangles(sheet) {
    // Remove rectangles that are completely inside others
    sheet.freeRectangles = sheet.freeRectangles.filter((rect, i) => {
      return !sheet.freeRectangles.some((other, j) => {
        if (i === j) return false;
        return this.isRectangleInside(rect, other);
      });
    });
  }

  /**
   * Check if rect1 is completely inside rect2
   */
  isRectangleInside(rect1, rect2) {
    return rect1.x >= rect2.x &&
           rect1.y >= rect2.y &&
           rect1.x + rect1.width <= rect2.x + rect2.width &&
           rect1.y + rect1.length <= rect2.y + rect2.length;
  }

  /**
   * Calculate optimization statistics
   */
  calculateStatistics(sheets, originalPanels) {
    const totalStockArea = sheets.length * this.stockWidth * this.stockLength;
    const totalUsedArea = sheets.reduce((sum, sheet) => sum + sheet.usedArea, 0);
    const totalWastedArea = totalStockArea - totalUsedArea;
    const totalCuts = sheets.reduce((sum, sheet) => sum + sheet.panels.length, 0);
    
    // Calculate cut length
    let totalCutLength = 0;
    sheets.forEach(sheet => {
      sheet.panels.forEach(panel => {
        totalCutLength += (panel.width * 2) + (panel.length * 2);
      });
    });

    return {
      usedStockSheets: sheets.length,
      stockDimensions: `${this.stockWidth}×${this.stockLength}`,
      totalUsedArea: Math.round(totalUsedArea),
      totalWastedArea: Math.round(totalWastedArea),
      wastePercentage: Math.round((totalWastedArea / totalStockArea) * 100),
      efficiency: Math.round((totalUsedArea / totalStockArea) * 100),
      totalCuts: totalCuts,
      totalCutLength: Math.round(totalCutLength),
      totalPanels: originalPanels.reduce((sum, p) => sum + p.qty, 0),
      wastedPanels: sheets.reduce((sum, sheet) => 
        sum + (sheet.panels.length === 0 ? 1 : 0), 0)
    };
  }

  /**
   * Generate detailed cut list
   */
  generateCutList(sheets) {
    const cuts = [];
    
    sheets.forEach((sheet, sheetIndex) => {
      sheet.panels.forEach((panel, panelIndex) => {
        cuts.push({
          cutNumber: cuts.length + 1,
          sheetNumber: sheet.id,
          panel: `${sheet.width}×${sheet.length}`,
          cut: `${panel.rotated ? 'y=' : 'x='}${panel.width}`,
          result: `${panel.width}×${panel.length}${panel.rotated ? ' \\surplus' : ''}`,
          x: panel.x,
          y: panel.y,
          width: panel.width,
          length: panel.length,
          rotated: panel.rotated,
          label: panel.label
        });
      });
    });

    return cuts;
  }

  /**
   * Get fabric quantity needed (in mm)
   */
  getFabricQuantity() {
    return {
      rollsNeeded: 0, // Will be calculated after optimization
      totalLength: 0  // Total length in mm
    };
  }
}

// Export for use in React Native
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CutlistOptimizer;
}
