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
    if (calcDrop <= 850) return 500;
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
     * Generate Fabric Cut PDF with CutLogic-2D-style Cutting Layout
     *
     * Layout pages: coloured panels with dimensions, panel numbers, rotation
     *               indicators (* suffix), cutting marks (red lines), waste
     *               areas (diagonal stripes) — one page per sheet.
     * Detail page:  12-column worksheet table.
     * Stats page:   summary table per fabric group.
     */
    static generateFabricCutPDF(
        orderInfo: OrderInfo,
        fabricCutData: Record<string, { optimization: OptimizationResult; items: any[] }>
    ): any {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });

        // Pastel colours cycled per panel (matches CutLogic 2D palette)
        const PANEL_COLORS = [
            '#BAE1FF', '#FFB3BA', '#BAFFC9', '#FFFFBA',
            '#FFD4BA', '#E0BBE4', '#FFDFD3', '#C7CEEA',
        ];

        // ====================================================================
        // LAYOUT PAGES — one per sheet, CutLogic 2D style
        // ====================================================================
        let isFirstPage = true;

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            const stats = groupData.optimization.statistics;
            let localPanelNo = 0;

            for (const sheet of groupData.optimization.sheets) {
                if (!isFirstPage) doc.addPage();
                isFirstPage = false;

                // — Header bar —
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#1B2B3A')
                    .text('Fabric Cut Optimization Layout', 30, 25, { align: 'center' });
                doc.fontSize(9).font('Helvetica').fillColor('#555')
                    .text(
                        `Order: ${orderInfo.orderNumber}  |  Customer: ${orderInfo.customerName}  |  ` +
                        `Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`,
                        30, 42, { align: 'center' }
                    );

                // — Fabric & sheet title —
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
                    .text(`Fabric: ${fabricKey}`, 30, 60);

                const actualLen = sheet.length || (sheet as any).actualUsedLength ||
                    Math.max(...sheet.panels.map((p: any) => p.y + p.length), 1);

                doc.fontSize(9).font('Helvetica').fillColor('#333')
                    .text(
                        `Layout ${sheet.id}  -  ${sheet.width.toLocaleString()} mm × ${Math.round(actualLen).toLocaleString()} mm  |  ` +
                        `${sheet.panels.length} panels  |  ${(sheet.efficiency ?? 0).toFixed(1)}% yield`,
                        30, 74
                    );

                // — Scaling to fit on page —
                const MARGIN_LEFT = 50;
                const MARGIN_TOP = 92;
                const AVAIL_W = 740;   // landscape A4 usable width
                const AVAIL_H = 420;   // usable height
                const scaleX = AVAIL_W / sheet.width;
                const scaleY = AVAIL_H / actualLen;
                const sc = Math.min(scaleX, scaleY); // uniform scale

                const drawW = sheet.width * sc;
                const drawH = actualLen * sc;

                // — Sheet border —
                doc.lineWidth(2).strokeColor('#333')
                    .rect(MARGIN_LEFT, MARGIN_TOP, drawW, drawH).stroke();

                // — Waste stripes (diagonal hatch for empty area at the bottom) —
                const panelMaxY = Math.max(
                    ...sheet.panels.map((p: any) => p.y + (p.rotated ? p.width : p.length)),
                    0
                );
                if (panelMaxY < actualLen) {
                    const wasteTop = MARGIN_TOP + panelMaxY * sc;
                    const wasteH = (actualLen - panelMaxY) * sc;
                    doc.save();
                    doc.rect(MARGIN_LEFT, wasteTop, drawW, wasteH).clip();
                    doc.lineWidth(0.5).strokeColor('#999');
                    for (let d = -Math.ceil(wasteH); d < drawW + Math.ceil(wasteH); d += 8) {
                        doc.moveTo(MARGIN_LEFT + d, wasteTop)
                            .lineTo(MARGIN_LEFT + d + wasteH, wasteTop + wasteH)
                            .stroke();
                    }
                    doc.restore();
                }

                // — Draw panels —
                sheet.panels.forEach((panel: any, idx: number) => {
                    localPanelNo++;
                    const pw = (panel.rotated ? panel.length : panel.width) * sc;
                    const ph = (panel.rotated ? panel.width : panel.length) * sc;
                    const px = MARGIN_LEFT + panel.x * sc;
                    const py = MARGIN_TOP + panel.y * sc;

                    const color = PANEL_COLORS[idx % PANEL_COLORS.length];

                    // Filled rectangle
                    doc.lineWidth(1).fillColor(color).strokeColor('#000')
                        .rect(px, py, pw, ph).fillAndStroke();

                    // Panel number (centred, large)
                    const numStr = `${localPanelNo}${panel.rotated ? '*' : ''}`;
                    doc.fontSize(pw > 40 && ph > 30 ? 14 : 9)
                        .font('Helvetica-Bold').fillColor('#000');
                    const tw = doc.widthOfString(numStr);
                    const th = doc.currentLineHeight();
                    doc.text(numStr, px + (pw - tw) / 2, py + (ph - th) / 2, { lineBreak: false });

                        // — Dimension labels for outer-edge panels —
                    doc.fontSize(7).font('Helvetica-Bold').fillColor('#CC0000');

                    // Top edge: width dimension
                    if (panel.y === 0) {
                        const dimW = panel.rotated ? panel.length : panel.width;
                        const wLabel = `${dimW.toLocaleString()} mm`;
                        const wLabelW = doc.widthOfString(wLabel);
                        doc.text(wLabel, px + (pw - wLabelW) / 2, py - 10, { lineBreak: false });
                    }

                    // Left edge: height dimension
                    if (panel.x === 0) {
                        const dimH = panel.rotated ? panel.width : panel.length;
                        const hLabel = `${dimH.toLocaleString()} mm`;
                        doc.save();
                        doc.fontSize(7).font('Helvetica-Bold').fillColor('#CC0000');
                        doc.translate(px - 3, py + ph / 2);
                        doc.rotate(-90);
                        const hLabelW = doc.widthOfString(hLabel);
                        doc.text(hLabel, -hLabelW / 2, 0, { lineBreak: false });
                        doc.restore();
                    }
                });

                // — Guillotine cut lines (red dashed) —
                const cutSequence = (sheet as any).cutSequence;
                if (cutSequence && Array.isArray(cutSequence)) {
                    cutSequence.forEach((cut: any) => {
                        doc.save();
                        doc.lineWidth(1.5).strokeColor('#CC0000').dash(5, { space: 3 });

                        if (cut.type === 'horizontal') {
                            const cy = MARGIN_TOP + cut.y1 * sc;
                            doc.moveTo(MARGIN_LEFT, cy)
                                .lineTo(MARGIN_LEFT + drawW, cy)
                                .stroke();
                            // Dimension label
                            doc.fillColor('#CC0000').fontSize(7).font('Helvetica-Bold');
                            doc.text(cut.label, MARGIN_LEFT + drawW - 50, cy - 10, { lineBreak: false });
                        } else {
                            const cx = MARGIN_LEFT + cut.x1 * sc;
                            doc.moveTo(cx, MARGIN_TOP)
                                .lineTo(cx, MARGIN_TOP + drawH)
                                .stroke();
                            doc.fillColor('#CC0000').fontSize(7).font('Helvetica-Bold');
                            doc.text(cut.label, cx + 3, MARGIN_TOP + 3, { lineBreak: false });
                        }

                        doc.restore();
                    });
                }

                // — Stats block (right side) —
                const sX = MARGIN_LEFT + drawW + 12;
                const sY = MARGIN_TOP;
                doc.fontSize(9).font('Helvetica-Bold').fillColor('#000')
                    .text(`Sheet ${sheet.id}`, sX, sY);
                doc.fontSize(8).font('Helvetica').fillColor('#333');
                doc.text(`Panels: ${sheet.panels.length}`, sX, sY + 16);
                doc.text(`Efficiency: ${(sheet.efficiency ?? 0).toFixed(1)}%`, sX, sY + 28);
                doc.text(`Used: ${(sheet.usedArea / 1_000_000).toFixed(2)} m²`, sX, sY + 40);
                doc.text(`Waste: ${((sheet.wastedArea ?? (sheet as any).wasteArea ?? 0) / 1_000_000).toFixed(2)} m²`, sX, sY + 52);

                // — Legend —
                const legendY = MARGIN_TOP + drawH + 10;
                doc.fontSize(7).font('Helvetica').fillColor('#666')
                    .text('* = Rotated 90°   |   Diagonal stripes = Waste area   |   Red lines = Cutting marks with dimensions', MARGIN_LEFT, legendY);

                // — Footer —
                doc.fontSize(7).fillColor('#aaa')
                    .text('Generated by Signature Shades SAP', MARGIN_LEFT, 550, { align: 'left' });
            }

            // Per-fabric summary line (on last sheet page of that fabric)
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
            doc.text(
                `Summary — ${stats.usedStockSheets} sheet(s)  |  ${stats.efficiency.toFixed(1)}% efficiency  |  ` +
                `${(stats.totalFabricNeeded / 1000).toFixed(2)} m fabric  |  ${stats.wastePercentage.toFixed(1)}% waste`,
                30, 535
            );
        }

        // ====================================================================
        // DETAIL TABLE PAGE(S)
        // ====================================================================
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1B2B3A')
            .text('Fabric Cut Worksheet — Detail Table', { align: 'center' });
        doc.fontSize(9).font('Helvetica').fillColor('#555')
            .text(
                `Order: ${orderInfo.orderNumber}  |  Customer: ${orderInfo.customerName}  |  Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`,
                { align: 'center' }
            );
        doc.moveDown();

        const colWidths = [38, 68, 52, 48, 38, 48, 72, 32, 68, 52, 52, 48];
        const headers = ['Panel', 'Location', 'Fab Cut W', 'Calc D', 'Ctrl', 'Ctrl Col', 'Chain/Motor', 'Roll', 'Fabric', 'Colour', 'BR Colour', 'Chain'];

        let tablePanelNo = 0;

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            if (doc.y > 490) doc.addPage();

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1B2B3A')
                .text(`Fabric: ${fabricKey}`, { underline: true });
            doc.moveDown(0.3);

            // Column headers
            let hdrX = 30;
            const hdrY = doc.y;
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#333');
            headers.forEach((h, i) => {
                doc.text(h, hdrX, hdrY, { width: colWidths[i], align: 'left' });
                hdrX += colWidths[i];
            });
            doc.moveDown(0.5);
            doc.strokeColor('#999').lineWidth(0.5)
                .moveTo(30, doc.y).lineTo(30 + colWidths.reduce((a, b) => a + b, 0), doc.y).stroke();
            doc.moveDown(0.2);

            doc.fontSize(7).font('Helvetica').fillColor('#000');
            for (const sheet of groupData.optimization.sheets) {
                for (const panel of sheet.panels) {
                    tablePanelNo++;
                    if (doc.y > 530) doc.addPage();

                    const item = groupData.items.find((it: any) => it.id === panel.orderItemId);
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

            const stats = groupData.optimization.statistics;
            doc.moveDown(0.3);
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#333')
                .text(`Sheets: ${stats.usedStockSheets}  |  Efficiency: ${stats.efficiency}%  |  Fabric Needed: ${(stats.totalFabricNeeded / 1000).toFixed(2)}m`);
            doc.moveDown();
        }

        // ====================================================================
        // STATISTICS SUMMARY PAGE
        // ====================================================================
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1B2B3A')
            .text('Optimization Statistics', { align: 'center' });
        doc.moveDown(2);

        // Table
        const sColW = [40, 240, 60, 70, 90, 70];
        const sHeaders = ['#', 'Fabric', 'Sheets', 'Efficiency', 'Fabric Needed', 'Waste'];

        let sx = 60;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#333');
        sHeaders.forEach((h, i) => {
            doc.text(h, sx, doc.y, { width: sColW[i], align: i === 1 ? 'left' : 'center', continued: i < sHeaders.length - 1 });
            sx += sColW[i];
        });
        doc.text(''); // end continued
        doc.moveDown(0.5);
        doc.strokeColor('#ccc').lineWidth(0.5)
            .moveTo(60, doc.y).lineTo(60 + sColW.reduce((a, b) => a + b, 0), doc.y).stroke();
        doc.moveDown(0.3);

        let rowIdx = 0;
        let sumFabric = 0;
        let sumEfficiency = 0;
        const fabricEntries = Object.entries(fabricCutData);

        for (const [fabricKey, groupData] of fabricEntries) {
            rowIdx++;
            const s = groupData.optimization.statistics;
            sumFabric += s.totalFabricNeeded;
            sumEfficiency += s.efficiency;

            const row = [
                String(rowIdx),
                fabricKey,
                String(s.usedStockSheets),
                `${s.efficiency.toFixed(1)}%`,
                `${(s.totalFabricNeeded / 1000).toFixed(2)} m`,
                `${s.wastePercentage.toFixed(1)}%`,
            ];

            sx = 60;
            doc.fontSize(8).font('Helvetica').fillColor('#000');
            row.forEach((val, i) => {
                doc.text(val, sx, doc.y, { width: sColW[i], align: i === 1 ? 'left' : 'center', continued: i < row.length - 1 });
                sx += sColW[i];
            });
            doc.text('');
            doc.moveDown(0.2);
        }

        // Totals row
        doc.moveDown(0.4);
        doc.strokeColor('#ccc').lineWidth(0.5)
            .moveTo(60, doc.y).lineTo(60 + sColW.reduce((a, b) => a + b, 0), doc.y).stroke();
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
        doc.text(
            `TOTAL: ${(sumFabric / 1000).toFixed(2)} m fabric needed  |  Avg Efficiency: ${(sumEfficiency / fabricEntries.length).toFixed(1)}%`,
            60
        );

        doc.fontSize(7).fillColor('#aaa')
            .text('Generated by Signature Shades SAP', 30, 550, { align: 'left' });

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
