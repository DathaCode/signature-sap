// @ts-ignore - pdfkit types may not be available in all environments
import PDFDocument from 'pdfkit';
import { OptimizationResult } from './cutlistOptimizer.service';
import { TubeCutResult } from './tubeCutOptimizer.service';

interface OrderInfo {
    orderNumber: string;
    customerName: string;
    orderDate: Date;
}

/**
 * Motor-specific width deduction mapping
 */
const MOTOR_DEDUCTIONS: Record<string, number> = {
    'TBS winder-32mm': 28,
    'Acmeda winder-29mm': 28,
    'Automate 1.1NM Li-Ion Quiet Motor': 29,
    'Automate 0.7NM Li-Ion Quiet Motor': 29,
    'Automate 2NM Li-Ion Quiet Motor': 29,
    'Automate 3NM Li-Ion Motor': 29,
    'Automate E6 6NM Motor': 29,
    'Alpha 1NM Battery Motor': 30,
    'Alpha 2NM Battery Motor': 30,
    'Alpha 3NM Battery Motor': 30,
    'Alpha AC 5NM Motor': 35,
};

/**
 * Drop addition constant (fabric roll allowance)
 */
const DROP_ADDITION = 150;

/**
 * Chain length (mm) based on blind drop.
 * Inventory chains: 500 / 900 / 1200 / 1500 / 2000 mm
 */
function getChainSize(calcDrop: number): number {
    if (calcDrop <= 850)  return 500;
    if (calcDrop <= 1200) return 900;
    if (calcDrop <= 1600) return 1200;
    if (calcDrop <= 2200) return 1500;
    return 2000;
}

export class WorksheetExportService {
    /**
     * Get motor-specific width deduction
     */
    private static getMotorDeduction(motorType: string): number {
        return MOTOR_DEDUCTIONS[motorType] || 28; // Default to 28mm if not found
    }

    /**
     * Calculate fabric cut width based on motor type
     */
    private static calculateFabricCutWidth(blindWidth: number, motorType: string): number {
        return blindWidth - this.getMotorDeduction(motorType);
    }

    /**
     * Calculate drop with roll allowance
     */
    private static calculateDrop(originalDrop: number): number {
        return originalDrop + DROP_ADDITION;
    }

    /**
     * Generate Fabric Cut CSV
     * Updated columns: Panel No, Location, Fab Cut W, Calc D, Ctrl, Ctrl Col,
     * Chain/Motor, Roll, Fabric, Colour, BR Colour, Chain Size
     */
    static generateFabricCutCSV(
        orderInfo: OrderInfo,
        fabricCutData: Record<string, { optimization: OptimizationResult; items: any[] }>
    ): string {
        const headers = [
            'Panel No', 'Location', 'Fabric Cut Width (mm)', 'Calculated Drop (mm)',
            'Control Side', 'Control Colour', 'Chain/Motor', 'Roll',
            'Fabric Type', 'Fabric Colour', 'Bottom Rail Colour', 'Chain Size (mm)'
        ];

        const rows: string[] = [];

        // Add order info as comment rows
        rows.push(`# Order: ${orderInfo.orderNumber}`);
        rows.push(`# Customer: ${orderInfo.customerName}`);
        rows.push(`# Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`);
        rows.push('');
        rows.push(headers.join(','));

        let panelNo = 0;

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            rows.push(`# Fabric Group: ${fabricKey}`);

            for (const sheet of groupData.optimization.sheets) {
                for (const panel of sheet.panels) {
                    panelNo++;
                    const item = groupData.items.find(
                        (it: any) => it.id === panel.orderItemId
                    );

                    const motorType = item?.chainOrMotor || '';
                    const fabricCutWidth = item ? this.calculateFabricCutWidth(item.width, motorType) : '';
                    const calculatedDrop = item ? this.calculateDrop(item.drop) : 0;
                    const chainSize = calculatedDrop > 0 ? getChainSize(calculatedDrop) : '';

                    rows.push([
                        panelNo,
                        `"${item?.location || panel.label}"`,
                        fabricCutWidth,
                        calculatedDrop || '',
                        `"${item?.controlSide || '-'}"`,
                        `"${item?.bracketColour || '-'}"`,
                        `"${(motorType || '-').replace(/_/g, ' ')}"`,
                        `"${item?.roll || '-'}"`,
                        `"${item?.fabricType || '-'}"`,
                        `"${item?.fabricColour || '-'}"`,
                        `"${item?.bottomRailColour || '-'}"`,
                        chainSize,
                    ].join(','));
                }
            }

            // Statistics
            const stats = groupData.optimization.statistics;
            rows.push('');
            rows.push(`# Statistics: ${stats.usedStockSheets} sheets, ${stats.efficiency}% efficiency, ${stats.totalFabricNeeded}mm fabric needed`);
            rows.push('');
        }

        return rows.join('\n');
    }

    /**
     * Generate Tube Cut CSV
     * Removed Pieces column
     */
    static generateTubeCutCSV(
        orderInfo: OrderInfo,
        tubeCutData: TubeCutResult
    ): string {
        const headers = [
            'Location', 'Original Width (mm)', 'Tube Cut Width (mm)',
            'Bottom Rail Type', 'Bottom Rail Colour'
        ];

        const rows: string[] = [];
        rows.push(`# Order: ${orderInfo.orderNumber}`);
        rows.push(`# Customer: ${orderInfo.customerName}`);
        rows.push(`# Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`);
        rows.push('');
        rows.push(headers.join(','));

        for (const group of tubeCutData.groups) {
            for (const blind of group.blinds) {
                rows.push([
                    `"${blind.location}"`,
                    blind.originalWidth,
                    blind.originalWidth - 28,
                    `"${group.bottomRailType}"`,
                    `"${group.bottomRailColour}"`,
                ].join(','));
            }
            rows.push(`# Group Total: ${group.totalWidth}mm, Base: ${group.baseQuantity}, +10% wastage = ${group.finalQuantity}, Pieces: ${group.piecesToDeduct}`);
            rows.push('');
        }

        rows.push(`# Total Pieces Needed: ${tubeCutData.totalPiecesNeeded}`);

        return rows.join('\n');
    }

    /**
     * Generate Fabric Cut PDF with Cutting Layout Visualization
     * - Page 1: Visual layout (bigger scale, panel numbers, fixed label overlap)
     * - Page 2+: Detailed table (new columns: Panel No, BR Colour, Chain Size)
     */
    static generateFabricCutPDF(
        orderInfo: OrderInfo,
        fabricCutData: Record<string, { optimization: OptimizationResult; items: any[] }>
    ): any {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });

        // ============================================================================
        // PAGE 1: CUTTING LAYOUT VISUALIZATION
        // ============================================================================
        doc.fontSize(18).font('Helvetica-Bold').text('Fabric Cut Optimization Layout', { align: 'center' });
        doc.fontSize(10).font('Helvetica')
            .text(`Order: ${orderInfo.orderNumber}  |  Customer: ${orderInfo.customerName}  |  Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`, { align: 'center' });
        doc.moveDown(0.5);

        const fabricColors = ['#E6F3FF', '#FFE6E6', '#E6FFE6', '#FFFFE6', '#FFE6FF', '#E6FFF3'];
        let fabricIndex = 0;
        let globalPanelNo = 0;

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            const color = fabricColors[fabricIndex % fabricColors.length];
            fabricIndex++;

            // Fabric group title
            doc.fontSize(12).font('Helvetica-Bold')
                .fillColor('#000000')
                .text(`Fabric: ${fabricKey}`, { underline: true });
            doc.moveDown(0.5);

            // Draw each sheet
            for (const sheet of groupData.optimization.sheets) {
                // Check if we need a new page
                if (doc.y > 350) {
                    doc.addPage();
                    doc.fontSize(12).font('Helvetica-Bold').text(`Fabric: ${fabricKey} (continued)`, { underline: true });
                    doc.moveDown(0.5);
                }

                const startY = doc.y;

                // Scale: Stock sheet is 3000mm wide × 10000mm long
                // Increased scale: 0.05 instead of 0.02 for better visibility
                const scale = 0.05;
                const sheetWidth = 3000 * scale;    // 150mm on paper
                const sheetLength = 10000 * scale;  // 500mm → capped for page
                const maxSheetHeight = Math.min(sheetLength, 250); // cap at 250pt to fit on page
                const displayScale = maxSheetHeight / (10000); // actual scale for drawing
                const marginLeft = 50;

                // Sheet label — positioned above, with enough gap
                doc.fontSize(10).font('Helvetica-Bold')
                    .fillColor('#000000')
                    .text(`Sheet ${sheet.id}`, marginLeft, startY);
                const sheetStartY = startY + 16;

                // Draw sheet border
                doc.rect(marginLeft, sheetStartY, sheetWidth, maxSheetHeight)
                    .stroke('#333333');

                // Draw each panel
                for (const panel of sheet.panels) {
                    globalPanelNo++;
                    const panelX = marginLeft + (panel.x * displayScale);
                    const panelY = sheetStartY + (panel.y * displayScale);
                    const panelW = panel.width * displayScale;
                    const panelH = panel.length * displayScale;

                    // Draw panel rectangle with fill
                    doc.rect(panelX, panelY, panelW, panelH)
                        .fillAndStroke(color, '#666666');

                    // Panel number label (always shown)
                    doc.fontSize(8).font('Helvetica-Bold')
                        .fillColor('#000000')
                        .text(
                            `#${globalPanelNo}`,
                            panelX + 2,
                            panelY + 2,
                            { width: Math.max(panelW - 4, 20) }
                        );

                    // Dimensions label
                    if (panelW > 20 && panelH > 18) {
                        doc.fontSize(6).font('Helvetica')
                            .fillColor('#333333')
                            .text(
                                `${panel.width}×${panel.length}`,
                                panelX + 2,
                                panelY + 12,
                                { width: Math.max(panelW - 4, 20) }
                            );
                    }

                    // Location label
                    if (panelH > 28 && panelW > 20) {
                        doc.fontSize(5).font('Helvetica')
                            .fillColor('#555555')
                            .text(
                                panel.label || '',
                                panelX + 2,
                                panelY + 20,
                                { width: Math.max(panelW - 4, 20) }
                            );
                    }
                }

                // Sheet statistics (to the right of the sheet)
                const statsX = marginLeft + sheetWidth + 15;
                doc.fontSize(9).font('Helvetica')
                    .fillColor('#000000')
                    .text(`Panels: ${sheet.panels.length}`, statsX, sheetStartY + 5)
                    .text(`Efficiency: ${sheet.efficiency.toFixed(1)}%`, statsX, sheetStartY + 18)
                    .text(`Used: ${(sheet.usedArea / 1000000).toFixed(2)}m²`, statsX, sheetStartY + 31)
                    .text(`Waste: ${(sheet.wastedArea / 1000000).toFixed(2)}m²`, statsX, sheetStartY + 44);

                // Move down for next sheet
                doc.y = sheetStartY + maxSheetHeight + 20;
            }

            // Overall fabric group statistics
            const stats = groupData.optimization.statistics;
            doc.fontSize(9).font('Helvetica-Bold')
                .fillColor('#000000')
                .text(
                    `Total: ${stats.usedStockSheets} sheets  |  Efficiency: ${stats.efficiency.toFixed(1)}%  |  ` +
                    `Fabric needed: ${(stats.totalFabricNeeded / 1000).toFixed(2)}m  |  Waste: ${stats.wastePercentage.toFixed(1)}%`
                );
            doc.moveDown(1);
        }

        // ============================================================================
        // NEW PAGE: DETAILED WORKSHEET TABLE
        // Columns: Panel No, Location, Fab Cut W, Calc D, Ctrl, Ctrl Col,
        //          Chain/Motor, Roll, Fabric, Colour, BR Colour, Chain Size
        // ============================================================================
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').text('Fabric Cut Worksheet - Details', { align: 'center' });
        doc.fontSize(10).font('Helvetica')
            .text(`Order: ${orderInfo.orderNumber}  |  Customer: ${orderInfo.customerName}  |  Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`, { align: 'center' });
        doc.moveDown();

        const colWidths = [40, 70, 55, 50, 40, 50, 75, 35, 70, 55, 55, 50];
        const headers = ['Panel', 'Location', 'Fab Cut W', 'Calc D', 'Ctrl', 'Ctrl Col', 'Chain/Motor', 'Roll', 'Fabric', 'Colour', 'BR Colour', 'Chain'];

        // Reset panel number for table
        let tablePanelNo = 0;

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            doc.fontSize(11).font('Helvetica-Bold').text(`Fabric: ${fabricKey}`, { underline: true });
            doc.moveDown(0.3);

            // Table header
            let x = 30;
            const y = doc.y;
            doc.fontSize(7).font('Helvetica-Bold');
            headers.forEach((h, i) => {
                doc.text(h, x, y, { width: colWidths[i], align: 'left' });
                x += colWidths[i];
            });
            doc.moveDown(0.5);

            // Draw line
            doc.moveTo(30, doc.y).lineTo(810, doc.y).stroke();
            doc.moveDown(0.2);

            doc.fontSize(7).font('Helvetica');
            for (const sheet of groupData.optimization.sheets) {
                for (const panel of sheet.panels) {
                    tablePanelNo++;
                    const item = groupData.items.find((it: any) => it.id === panel.orderItemId);

                    if (doc.y > 530) {
                        doc.addPage();
                    }

                    const motorType = item?.chainOrMotor || '';
                    const fabricCutWidth = item ? this.calculateFabricCutWidth(item.width, motorType) : '';
                    const calculatedDrop = item ? this.calculateDrop(item.drop) : 0;
                    const chainSize = calculatedDrop > 0 ? getChainSize(calculatedDrop) : '';

                    const rowY = doc.y;
                    let rx = 30;
                    const values = [
                        String(tablePanelNo),
                        item?.location || panel.label,
                        String(fabricCutWidth),
                        String(calculatedDrop || ''),
                        item?.controlSide || '-',
                        item?.bracketColour || '-',
                        (motorType || '-').replace(/_/g, ' '),
                        item?.roll || '-',
                        item?.fabricType || '-',
                        item?.fabricColour || '-',
                        item?.bottomRailColour || '-',
                        chainSize ? `${chainSize}mm` : '-',
                    ];

                    values.forEach((val, i) => {
                        doc.text(val, rx, rowY, { width: colWidths[i], align: 'left' });
                        rx += colWidths[i];
                    });
                    doc.moveDown(0.3);
                }
            }

            // Statistics
            const stats = groupData.optimization.statistics;
            doc.moveDown(0.3);
            doc.fontSize(8).font('Helvetica-Bold')
                .text(`Sheets: ${stats.usedStockSheets}  |  Efficiency: ${stats.efficiency}%  |  Fabric Needed: ${stats.totalFabricNeeded}mm`);
            doc.moveDown();
        }

        doc.end();
        return doc;
    }

    /**
     * Generate Tube Cut PDF
     * Removed Pieces column
     */
    static generateTubeCutPDF(
        orderInfo: OrderInfo,
        tubeCutData: TubeCutResult
    ): any {
        const doc = new PDFDocument({ size: 'A4', layout: 'portrait', margin: 40 });

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text('Tube Cut Worksheet', { align: 'center' });
        doc.fontSize(10).font('Helvetica')
            .text(`Order: ${orderInfo.orderNumber}  |  Customer: ${orderInfo.customerName}  |  Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`, { align: 'center' });
        doc.moveDown();

        const colWidths = [130, 90, 90, 90, 90];
        const headers = ['Location', 'Orig Width', 'Tube Cut W', 'Rail Type', 'Rail Colour'];

        for (const group of tubeCutData.groups) {
            doc.fontSize(11).font('Helvetica-Bold')
                .text(`${group.bottomRailType} - ${group.bottomRailColour}`, { underline: true });
            doc.moveDown(0.3);

            // Table header
            let x = 40;
            const y = doc.y;
            doc.fontSize(8).font('Helvetica-Bold');
            headers.forEach((h, i) => {
                doc.text(h, x, y, { width: colWidths[i], align: 'left' });
                x += colWidths[i];
            });
            doc.moveDown(0.5);
            doc.moveTo(40, doc.y).lineTo(530, doc.y).stroke();
            doc.moveDown(0.2);

            doc.fontSize(8).font('Helvetica');
            for (const blind of group.blinds) {
                if (doc.y > 750) {
                    doc.addPage();
                }

                const rowY = doc.y;
                let rx = 40;
                const values = [
                    blind.location,
                    `${blind.originalWidth}mm`,
                    `${blind.originalWidth - 28}mm`,
                    group.bottomRailType,
                    group.bottomRailColour,
                ];

                values.forEach((val, i) => {
                    doc.text(val, rx, rowY, { width: colWidths[i], align: 'left' });
                    rx += colWidths[i];
                });
                doc.moveDown(0.3);
            }

            // Group summary
            doc.moveDown(0.2);
            doc.fontSize(8).font('Helvetica-Bold')
                .text(`Total Width: ${group.totalWidth}mm  |  Base Qty: ${group.baseQuantity}  |  +10% = ${group.finalQuantity}  |  Pieces to Deduct: ${group.piecesToDeduct}`);
            doc.moveDown();
        }

        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Bold')
            .text(`Total Bottom Bar Pieces Needed: ${tubeCutData.totalPiecesNeeded}`, { align: 'center' });

        doc.end();
        return doc;
    }
}
