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
     */
    static generateFabricCutCSV(
        orderInfo: OrderInfo,
        fabricCutData: Record<string, { optimization: OptimizationResult; items: any[] }>
    ): string {
        const headers = [
            'Sheet #', 'Position', 'Location', 'Original Width (mm)', 'Original Drop (mm)',
            'Fabric Cut Width (mm)', 'Calculated Drop (mm)', 'Control Side', 'Control Colour',
            'Chain/Motor', 'Roll', 'Fabric Type', 'Fabric Colour', 'Rotated'
        ];

        const rows: string[] = [headers.join(',')];

        // Add order info as comment rows
        rows.unshift(`# Order: ${orderInfo.orderNumber}`);
        rows.splice(1, 0, `# Customer: ${orderInfo.customerName}`);
        rows.splice(2, 0, `# Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`);
        rows.splice(3, 0, '');

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            rows.push(`# Fabric Group: ${fabricKey}`);

            for (const sheet of groupData.optimization.sheets) {
                for (const panel of sheet.panels) {
                    // Find matching order item
                    const item = groupData.items.find(
                        (it: any) => it.id === panel.orderItemId
                    );

                    const motorType = item?.chainOrMotor || '';
                    const fabricCutWidth = item ? this.calculateFabricCutWidth(item.width, motorType) : '';
                    const calculatedDrop = item ? this.calculateDrop(item.drop) : '';

                    rows.push([
                        sheet.id,
                        `"(${panel.x}, ${panel.y})"`,
                        `"${item?.location || panel.label}"`,
                        item?.width || '',
                        item?.drop || '',
                        fabricCutWidth,
                        calculatedDrop,
                        `"${item?.controlSide || '-'}"`,
                        `"${item?.bracketColour || '-'}"`,
                        `"${(motorType || '-').replace(/_/g, ' ')}"`,
                        `"${item?.roll || '-'}"`,
                        `"${item?.fabricType || '-'}"`,
                        `"${item?.fabricColour || '-'}"`,
                        panel.rotated ? 'Yes' : 'No',
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
     */
    static generateTubeCutCSV(
        orderInfo: OrderInfo,
        tubeCutData: TubeCutResult
    ): string {
        const headers = [
            'Location', 'Original Width (mm)', 'Tube Cut Width (mm)',
            'Bottom Rail Type', 'Bottom Rail Colour', 'Group Qty Needed', 'Stock Pieces'
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
                    group.piecesToDeduct,
                    group.piecesToDeduct,
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

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            const color = fabricColors[fabricIndex % fabricColors.length];
            fabricIndex++;

            // Fabric group title
            doc.fontSize(12).font('Helvetica-Bold')
                .fillColor('#000000')
                .text(`Fabric: ${fabricKey}`, { underline: true });
            doc.moveDown(0.3);

            // Draw each sheet
            for (const sheet of groupData.optimization.sheets) {
                // Check if we need a new page
                if (doc.y > 480) {
                    doc.addPage();
                    doc.fontSize(12).font('Helvetica-Bold').text(`Fabric: ${fabricKey} (continued)`, { underline: true });
                    doc.moveDown(0.3);
                }

                const startY = doc.y;

                // Scale factor: Stock sheet is 3000mm × 10000mm
                // We'll fit it in approximately 200mm × 667mm on paper (scaled to fit landscape A4)
                const scale = 0.02; // 1mm in real life = 0.02mm on paper
                const sheetWidth = 3000 * scale; // 60mm on paper
                const sheetLength = 10000 * scale; // 200mm on paper
                const marginLeft = 50;

                // Draw sheet border
                doc.rect(marginLeft, startY, sheetWidth, sheetLength)
                    .stroke('#333333');

                // Sheet label
                doc.fontSize(9).font('Helvetica-Bold')
                    .fillColor('#000000')
                    .text(`Sheet ${sheet.id}`, marginLeft, startY - 15);

                // Draw each panel
                for (const panel of sheet.panels) {
                    const panelX = marginLeft + (panel.x * scale);
                    const panelY = startY + (panel.y * scale);
                    const panelW = panel.width * scale;
                    const panelH = panel.length * scale;

                    // Draw panel rectangle with fill
                    doc.rect(panelX, panelY, panelW, panelH)
                        .fillAndStroke(color, '#666666');

                    // Add panel dimensions label (if panel is large enough)
                    if (panelW > 15 && panelH > 8) {
                        doc.fontSize(6).font('Helvetica')
                            .fillColor('#000000')
                            .text(
                                `${panel.width}×${panel.length}`,
                                panelX + 1,
                                panelY + 1,
                                { width: panelW - 2, align: 'center' }
                            );

                        // Add label (location) if space allows
                        if (panelH > 15) {
                            doc.fontSize(5).text(
                                panel.label || `#${panel.id}`,
                                panelX + 1,
                                panelY + 8,
                                { width: panelW - 2, align: 'center' }
                            );
                        }

                        // Show rotation indicator
                        if (panel.rotated) {
                            doc.fontSize(5).fillColor('#FF0000').text(
                                '⟳',
                                panelX + panelW - 8,
                                panelY + 1
                            );
                        }
                    }
                }

                // Sheet statistics (to the right of the sheet)
                const statsX = marginLeft + sheetWidth + 10;
                doc.fontSize(8).font('Helvetica')
                    .fillColor('#000000')
                    .text(`Panels: ${sheet.panels.length}`, statsX, startY + 10)
                    .text(`Efficiency: ${sheet.efficiency.toFixed(1)}%`, statsX, startY + 22)
                    .text(`Used: ${(sheet.usedArea / 1000000).toFixed(2)}m²`, statsX, startY + 34)
                    .text(`Waste: ${(sheet.wastedArea / 1000000).toFixed(2)}m²`, statsX, startY + 46);

                // Move down for next sheet
                doc.moveDown(sheetLength / 10 + 1);
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
        // ============================================================================
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').text('Fabric Cut Worksheet - Details', { align: 'center' });
        doc.fontSize(10).font('Helvetica')
            .text(`Order: ${orderInfo.orderNumber}  |  Customer: ${orderInfo.customerName}  |  Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`, { align: 'center' });
        doc.moveDown();

        const colWidths = [35, 55, 70, 45, 45, 45, 45, 40, 50, 60, 35, 60, 55, 35];
        const headers = ['Sheet', 'Position', 'Location', 'Orig W', 'Orig D', 'Fab Cut W', 'Calc D', 'Ctrl', 'Ctrl Col', 'Chain/Motor', 'Roll', 'Fabric', 'Colour', 'Rot'];

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
                    const item = groupData.items.find((it: any) => it.id === panel.orderItemId);

                    if (doc.y > 530) {
                        doc.addPage();
                    }

                    const motorType = item?.chainOrMotor || '';
                    const fabricCutWidth = item ? this.calculateFabricCutWidth(item.width, motorType) : '';
                    const calculatedDrop = item ? this.calculateDrop(item.drop) : '';

                    const rowY = doc.y;
                    let rx = 30;
                    const values = [
                        String(sheet.id),
                        `(${panel.x},${panel.y})`,
                        item?.location || panel.label,
                        String(item?.width || ''),
                        String(item?.drop || ''),
                        String(fabricCutWidth),
                        String(calculatedDrop),
                        item?.controlSide || '-',
                        item?.bracketColour || '-',
                        (motorType || '-').replace(/_/g, ' '),
                        item?.roll || '-',
                        item?.fabricType || '-',
                        item?.fabricColour || '-',
                        panel.rotated ? 'Yes' : 'No',
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

        const colWidths = [120, 80, 80, 80, 80, 75];
        const headers = ['Location', 'Orig Width', 'Tube Cut W', 'Rail Type', 'Rail Colour', 'Pieces'];

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
            doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
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
                    String(group.piecesToDeduct),
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
