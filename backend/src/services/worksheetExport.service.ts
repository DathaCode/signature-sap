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
const DROP_ADDITION = 200;

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
        // LAYOUT PAGES — LANDSCAPE orientation (fabric length horizontal,
        // roll width 3000mm vertical) matching CutLogic 2D display.
        // Data is in portrait format (width=3000, length=fabricLen); we
        // rotate 90° at render: GA Y → page X, GA X → page Y.
        // NO cutting marks in PDF — cutting marks only in frontend preview
        // with toggle button.
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

                // — Fabric & sheet title (landscape: fabricLen × rollWidth) —
                doc.fontSize(11).font('Helvetica-Bold').fillColor('#000')
                    .text(`Fabric: ${fabricKey}`, 30, 60);

                const fabricLen = sheet.length || (sheet as any).actualUsedLength ||
                    Math.max(...sheet.panels.map((p: any) => p.y + p.length), 1);
                const rollWidth = sheet.width; // 3000mm

                doc.fontSize(9).font('Helvetica').fillColor('#333')
                    .text(
                        `Layout ${sheet.id}  -  ${Math.round(fabricLen).toLocaleString()} mm × ${rollWidth.toLocaleString()} mm  |  ` +
                        `${sheet.panels.length} panels  |  ${(sheet.efficiency ?? 0).toFixed(1)}% yield  |  1×`,
                        30, 74
                    );

                // — Scaling to fit on page (landscape A4) —
                const MARGIN_LEFT = 30;
                const MARGIN_TOP = 92;
                const AVAIL_W = 780;   // landscape A4 usable width
                const AVAIL_H = 380;   // usable height (leave room for stats below)
                // Landscape: fabricLen → horizontal, rollWidth (3000) → vertical
                const scaleX = AVAIL_W / fabricLen;
                const scaleY = AVAIL_H / rollWidth;
                const sc = Math.min(scaleX, scaleY); // uniform scale

                const drawW = fabricLen * sc;   // horizontal extent on page
                const drawH = rollWidth * sc;   // vertical extent on page

                // — Waste background (diagonal hatch for entire sheet area) —
                doc.save();
                doc.rect(MARGIN_LEFT, MARGIN_TOP, drawW, drawH).clip();
                doc.lineWidth(0.5).strokeColor('#999');
                const diagLen = drawW + drawH;
                for (let d = -Math.ceil(drawH); d < diagLen; d += 8) {
                    doc.moveTo(MARGIN_LEFT + d, MARGIN_TOP)
                        .lineTo(MARGIN_LEFT + d + drawH, MARGIN_TOP + drawH)
                        .stroke();
                }
                doc.restore();

                // — Sheet border —
                doc.lineWidth(2).strokeColor('#333')
                    .rect(MARGIN_LEFT, MARGIN_TOP, drawW, drawH).stroke();

                // — Draw panels (landscape: GA Y → page X, GA X → page Y) —
                sheet.panels.forEach((panel: any, idx: number) => {
                    localPanelNo++;
                    // Landscape transform: swap axes for display
                    const pw = (panel.rotated ? panel.width : panel.length) * sc;  // GA y-span → horizontal
                    const ph = (panel.rotated ? panel.length : panel.width) * sc;  // GA x-span → vertical
                    const px = MARGIN_LEFT + panel.y * sc;  // GA Y → page X
                    const py = MARGIN_TOP + panel.x * sc;   // GA X → page Y

                    const color = PANEL_COLORS[idx % PANEL_COLORS.length];

                    // Filled rectangle
                    doc.lineWidth(1).fillColor(color).strokeColor('#000')
                        .rect(px, py, pw, ph).fillAndStroke();

                    // Panel number (centred)
                    const numStr = `${localPanelNo}${panel.rotated ? '*' : ''}`;
                    doc.fontSize(pw > 40 && ph > 30 ? 14 : 9)
                        .font('Helvetica-Bold').fillColor('#000');
                    const tw = doc.widthOfString(numStr);
                    const th = doc.currentLineHeight();
                    doc.text(numStr, px + (pw - tw) / 2, py + (ph - th) / 2, { lineBreak: false });

                    // — Dimension labels (top and left edges in landscape) —
                    doc.fontSize(7).font('Helvetica-Bold').fillColor('#CC0000');

                    // Top edge: panels at GA Y=0 → display X start (leftmost)
                    if (panel.y === 0) {
                        const dimH = panel.rotated ? panel.length : panel.width;
                        const hLabel = `${dimH.toLocaleString()} mm`;
                        doc.save();
                        doc.fontSize(7).font('Helvetica-Bold').fillColor('#CC0000');
                        doc.translate(px - 3, py + ph / 2);
                        doc.rotate(-90);
                        const hLabelW = doc.widthOfString(hLabel);
                        doc.text(hLabel, -hLabelW / 2, 0, { lineBreak: false });
                        doc.restore();
                    }

                    // Left edge: panels at GA X=0 → display Y start (topmost)
                    if (panel.x === 0) {
                        const dimW = panel.rotated ? panel.width : panel.length;
                        const wLabel = `${dimW.toLocaleString()} mm`;
                        const wLabelW = doc.widthOfString(wLabel);
                        doc.text(wLabel, px + (pw - wLabelW) / 2, py - 10, { lineBreak: false });
                    }
                });

                // — Stats block below layout —
                const statsY = MARGIN_TOP + drawH + 14;
                doc.fontSize(8).font('Helvetica').fillColor('#333');
                doc.text(
                    `Panels: ${sheet.panels.length}  |  Efficiency: ${(sheet.efficiency ?? 0).toFixed(1)}%  |  ` +
                    `Used: ${(sheet.usedArea / 1_000_000).toFixed(2)} m²  |  ` +
                    `Waste: ${((sheet.wastedArea ?? (sheet as any).wasteArea ?? 0) / 1_000_000).toFixed(2)} m²`,
                    MARGIN_LEFT, statsY
                );

                // — GA metadata —
                const opt = groupData.optimization as any;
                let gaLine = statsY + 14;

                if (opt.isGuillotineValid !== undefined) {
                    doc.fontSize(8).font('Helvetica-Bold')
                        .fillColor(opt.isGuillotineValid ? '#047857' : '#DC2626')
                        .text(opt.isGuillotineValid ? 'Guillotine Valid' : 'Non-guillotine', MARGIN_LEFT, gaLine, { continued: true });
                    doc.fillColor('#333').font('Helvetica');
                    if (opt.strategy) doc.text(`  |  ${opt.strategy}`, { continued: false });
                    else doc.text('', { continued: false });
                    gaLine += 14;
                }

                if (opt.generationStats) {
                    const gs = opt.generationStats;
                    doc.fontSize(7).font('Helvetica').fillColor('#555')
                        .text(`Seeds: ${gs.seedsTested}  |  Best gen: ${gs.bestGeneration}/${gs.totalGenerations}  |  ${gs.convergenceTime}ms`, MARGIN_LEFT, gaLine);
                }

                // — Legend —
                doc.fontSize(7).font('Helvetica').fillColor('#666')
                    .text('* = Rotated 90°   |   Diagonal stripes = Waste area', MARGIN_LEFT, 540);

                // — Footer —
                doc.fontSize(7).fillColor('#aaa')
                    .text('Generated by Signature Shades SAP', MARGIN_LEFT, 550, { align: 'left' });
            }

            // Per-fabric summary line (on last sheet page of that fabric)
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#000');
            doc.text(
                `Summary — ${stats.usedStockSheets} sheet(s)  |  ${stats.efficiency.toFixed(1)}% efficiency  |  ` +
                `${(stats.totalFabricNeeded / 1000).toFixed(2)} m fabric  |  ${stats.wastePercentage.toFixed(1)}% waste`,
                30, 525
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
        const sColW = [30, 200, 50, 60, 80, 60, 70];
        const sHeaders = ['#', 'Fabric', 'Sheets', 'Efficiency', 'Fabric Needed', 'Waste', 'Guillotine'];

        let sx = 50;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#333');
        sHeaders.forEach((h, i) => {
            doc.text(h, sx, doc.y, { width: sColW[i], align: i === 1 ? 'left' : 'center', continued: i < sHeaders.length - 1 });
            sx += sColW[i];
        });
        doc.text(''); // end continued
        doc.moveDown(0.5);
        doc.strokeColor('#ccc').lineWidth(0.5)
            .moveTo(50, doc.y).lineTo(50 + sColW.reduce((a, b) => a + b, 0), doc.y).stroke();
        doc.moveDown(0.3);

        let rowIdx = 0;
        let sumFabric = 0;
        let sumEfficiency = 0;
        const fabricEntries = Object.entries(fabricCutData);

        for (const [fabricKey, groupData] of fabricEntries) {
            rowIdx++;
            const s = groupData.optimization.statistics;
            const optAny = groupData.optimization as any;
            sumFabric += s.totalFabricNeeded;
            sumEfficiency += s.efficiency;

            const row = [
                String(rowIdx),
                fabricKey,
                String(s.usedStockSheets),
                `${s.efficiency.toFixed(1)}%`,
                `${(s.totalFabricNeeded / 1000).toFixed(2)} m`,
                `${s.wastePercentage.toFixed(1)}%`,
                optAny.isGuillotineValid !== undefined
                    ? (optAny.isGuillotineValid ? 'Valid' : 'No')
                    : '-',
            ];

            sx = 50;
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
            .moveTo(50, doc.y).lineTo(50 + sColW.reduce((a, b) => a + b, 0), doc.y).stroke();
        doc.moveDown(0.3);
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
        doc.text(
            `TOTAL: ${(sumFabric / 1000).toFixed(2)} m fabric needed  |  Avg Efficiency: ${(sumEfficiency / fabricEntries.length).toFixed(1)}%`,
            50
        );

        // GA strategy info per fabric group
        doc.moveDown(1);
        doc.fontSize(8).font('Helvetica').fillColor('#555');
        for (const [fabricKey, groupData] of fabricEntries) {
            const optAny = groupData.optimization as any;
            if (optAny.strategy || optAny.generationStats) {
                const gs = optAny.generationStats;
                const parts = [`${fabricKey}:`];
                if (optAny.strategy) parts.push(optAny.strategy);
                if (gs) parts.push(`seeds=${gs.seedsTested}, best gen ${gs.bestGeneration}/${gs.totalGenerations}, ${gs.convergenceTime}ms`);
                doc.text(parts.join('  '), 50);
                doc.moveDown(0.1);
            }
        }

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
