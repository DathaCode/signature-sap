// @ts-ignore - pdfkit types may not be available in all environments
import PDFDocument from 'pdfkit';
import path from 'path';
import { OptimizationResult } from './cutlistOptimizer.service';
import { TubeCutResult } from './tubeCutOptimizer.service';

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

interface OrderInfo {
    orderNumber: string;
    customerName: string;
    orderDate: Date;
    customerReference?: string;
    notes?: string;
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
            'Blind #', 'Location', 'Fabric Cut Width (mm)', 'Calculated Drop (mm)',
            'Control Side', 'Control Colour', 'Chain/Motor', 'Roll',
            'Fabric Type', 'Fabric Colour', 'Bottom Rail Colour', 'Chain Size (mm)', 'Rotated'
        ];

        const rows: string[] = [];

        // Add order info as comment rows
        rows.push(`# Order: ${orderInfo.orderNumber}`);
        rows.push(`# Customer: ${orderInfo.customerName}`);
        rows.push(`# Date: ${orderInfo.orderDate.toISOString().split('T')[0]}`);
        rows.push('');
        rows.push(headers.join(','));

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            rows.push(`# Fabric Group: ${fabricKey}`);

            for (const sheet of groupData.optimization.sheets) {
                // Sort panels by blind number for sequential CSV rows
                const sortedPanels = [...sheet.panels].sort(
                    (a: any, b: any) => (a.blindNumber ?? 0) - (b.blindNumber ?? 0)
                );
                for (const panel of sortedPanels) {
                    const item = groupData.items.find(
                        (it: any) => it.id === panel.orderItemId
                    );

                    const motorType = item?.chainOrMotor || '';
                    const fabricCutWidth = item ? this.calculateFabricCutWidth(item.width, motorType) : '';
                    const calculatedDrop = item ? this.calculateDrop(item.drop) : 0;
                    const chainSize = calculatedDrop > 0 ? getChainSize(calculatedDrop) : '';

                    rows.push([
                        panel.blindNumber ?? '',
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
                        panel.rotated ? '*' : '',
                    ].join(','));
                }
            }

            // Statistics — DB-stored stats may have different field names than TS type
            const csvStats = groupData.optimization.statistics as any;
            rows.push('');
            rows.push(`# Statistics: ${csvStats.usedStockSheets ?? csvStats.totalSheets ?? 1} sheets, ${csvStats.efficiency ?? csvStats.avgEfficiency ?? 0}% efficiency, ${csvStats.totalFabricNeeded ?? 0}mm fabric needed`);
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

            // Cutting order
            if (group.cuttingOrder && group.cuttingOrder.length > 0) {
                rows.push('# Cutting Order:');
                for (const piece of group.cuttingOrder) {
                    const cuts = piece.cuts.map(c => `${c.location}(${c.width}mm)`).join(' | ');
                    rows.push(`#   Piece ${piece.pieceNumber}: ${cuts} — Used: ${piece.totalUsed}mm, Waste: ${piece.waste}mm`);
                }
            }
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
            // Cast to any — DB-stored statistics may have extra/different fields
            const stats = groupData.optimization.statistics as any;

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
                    // Landscape transform: swap axes for display
                    const pw = (panel.rotated ? panel.width : panel.length) * sc;  // GA y-span → horizontal
                    const ph = (panel.rotated ? panel.length : panel.width) * sc;  // GA x-span → vertical
                    const px = MARGIN_LEFT + panel.y * sc;  // GA Y → page X
                    const py = MARGIN_TOP + panel.x * sc;   // GA X → page Y

                    const color = PANEL_COLORS[idx % PANEL_COLORS.length];

                    // Filled rectangle
                    doc.lineWidth(1).fillColor(color).strokeColor('#000')
                        .rect(px, py, pw, ph).fillAndStroke();

                    // Panel number = blind number from order (centred)
                    const blindNo = panel.blindNumber ?? (idx + 1);
                    const numStr = `${blindNo}${panel.rotated ? '*' : ''}`;
                    doc.fontSize(pw > 40 && ph > 30 ? 14 : 9)
                        .font('Helvetica-Bold').fillColor('#000');
                    const tw = doc.widthOfString(numStr);
                    const th = doc.currentLineHeight();
                    doc.text(numStr, px + (pw - tw) / 2, py + (ph - th) / 2 - 5, { lineBreak: false });

                    // Dimensions inside panel (below number)
                    if (pw > 45 && ph > 35) {
                        const dimStr = `${panel.width}×${panel.length}`;
                        doc.fontSize(Math.min(7, pw * 0.08, ph * 0.1))
                            .font('Helvetica').fillColor('#333');
                        const dimW = doc.widthOfString(dimStr);
                        doc.text(dimStr, px + (pw - dimW) / 2, py + (ph - th) / 2 + 7, { lineBreak: false });
                    }

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
                    `Panels: ${sheet.panels.length}  |  Efficiency: ${((sheet as any).efficiency ?? 0).toFixed(1)}%  |  ` +
                    `Used: ${(((sheet as any).usedArea ?? 0) / 1_000_000).toFixed(2)} m²  |  ` +
                    `Waste: ${(((sheet as any).wastedArea ?? (sheet as any).wasteArea ?? 0) / 1_000_000).toFixed(2)} m²`,
                    MARGIN_LEFT, statsY
                );

                // — GA metadata —
                const opt = groupData.optimization as any;
                let gaLine = statsY + 14;

                if (opt.isGuillotineValid !== undefined) {
                    const validLabel = opt.isGuillotineValid ? 'Guillotine Valid' : 'Non-guillotine';
                    const strategyLabel = opt.strategy ? `  |  ${opt.strategy}` : '';
                    doc.fontSize(8).font('Helvetica-Bold')
                        .fillColor(opt.isGuillotineValid ? '#047857' : '#DC2626')
                        .text(validLabel + strategyLabel, MARGIN_LEFT, gaLine, { lineBreak: false });
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
                `Summary — ${stats.usedStockSheets ?? stats.totalSheets ?? 1} sheet(s)  |  ` +
                `${(stats.efficiency ?? stats.avgEfficiency ?? 0).toFixed(1)}% efficiency  |  ` +
                `${((stats.totalFabricNeeded ?? 0) / 1000).toFixed(2)} m fabric  |  ` +
                `${(stats.wastePercentage ?? 0).toFixed(1)}% waste`,
                30, 525
            );
        }

        // ====================================================================
        // DETAIL TABLE PAGE(S) — landscape A4 with wider columns
        // ====================================================================
        doc.addPage();

        // ── Header info box (Logo + Order details + Bay) ──────────────────────
        const HDR_X = 30;
        const HDR_Y = 20;
        const HDR_W = 781;
        const HDR_H = 80;
        const LOGO_BOX_W = 155;
        const MID_BOX_W = 380;
        const RIGHT_BOX_W = HDR_W - LOGO_BOX_W - MID_BOX_W;

        // Outer border
        doc.lineWidth(1).strokeColor('#333').rect(HDR_X, HDR_Y, HDR_W, HDR_H).stroke();
        // Vertical dividers
        doc.lineWidth(0.5).strokeColor('#777')
            .moveTo(HDR_X + LOGO_BOX_W, HDR_Y).lineTo(HDR_X + LOGO_BOX_W, HDR_Y + HDR_H).stroke();
        doc.lineWidth(0.5).strokeColor('#777')
            .moveTo(HDR_X + LOGO_BOX_W + MID_BOX_W, HDR_Y).lineTo(HDR_X + LOGO_BOX_W + MID_BOX_W, HDR_Y + HDR_H).stroke();

        // Logo (left box)
        try {
            doc.image(LOGO_PATH, HDR_X + 4, HDR_Y + 6, { fit: [LOGO_BOX_W - 8, 60] });
        } catch {
            doc.fontSize(10).font('Helvetica-Bold').fillColor('#1B2B3A')
                .text('SIGNATURE SHADES', HDR_X + 4, HDR_Y + 28, { width: LOGO_BOX_W - 8, lineBreak: false });
        }
        doc.fontSize(6.5).font('Helvetica').fillColor('#666')
            .text('Blinds | Curtains | Shutters', HDR_X + 4, HDR_Y + 65, { lineBreak: false });

        // Middle box — order details
        const MID_X = HDR_X + LOGO_BOX_W + 6;
        const cxRef = orderInfo.customerReference
            ? `${orderInfo.customerName}-${orderInfo.customerReference}`
            : orderInfo.customerName;
        const ordRecvd = orderInfo.orderDate.toLocaleDateString('en-AU');
        const datePrinted = new Date().toLocaleDateString('en-AU');
        const midRows: [string, string][] = [
            ['Order #:', orderInfo.orderNumber],
            ['Cx Ref:', cxRef],
            ['Ord Rec\'d:', ordRecvd],
            ['Date Printed:', datePrinted],
            ['Remarks:', orderInfo.notes || ''],
        ];
        midRows.forEach(([label, val], idx) => {
            const ry = HDR_Y + 8 + idx * 13.5;
            doc.fontSize(7).font('Helvetica-Bold').fillColor('#444').text(label, MID_X, ry, { lineBreak: false });
            doc.fontSize(7).font('Helvetica').fillColor('#000').text(val, MID_X + 72, ry, { lineBreak: false });
        });

        // Right box — Customer Name + BAY
        const RGT_X = HDR_X + LOGO_BOX_W + MID_BOX_W + 6;
        const RGT_W = RIGHT_BOX_W - 8;
        const BAY_SPLIT_Y = HDR_Y + Math.round(HDR_H * 0.52);
        doc.lineWidth(0.5).strokeColor('#777')
            .moveTo(HDR_X + LOGO_BOX_W + MID_BOX_W, BAY_SPLIT_Y)
            .lineTo(HDR_X + HDR_W, BAY_SPLIT_Y).stroke();
        // Customer Name
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#444').text('Customer Name', RGT_X, HDR_Y + 5, { lineBreak: false });
        doc.fontSize(8).font('Helvetica').fillColor('#000').text(orderInfo.customerName, RGT_X, HDR_Y + 16, { width: RGT_W, lineBreak: false });
        // BAY label + empty box
        doc.fontSize(6.5).font('Helvetica-Bold').fillColor('#444').text('BAY', RGT_X, BAY_SPLIT_Y + 4, { lineBreak: false });
        doc.lineWidth(0.5).strokeColor('#aaa').rect(RGT_X + 22, BAY_SPLIT_Y + 2, RGT_W - 24, 22).stroke();

        // Title below header
        doc.fontSize(14).font('Helvetica-Bold').fillColor('#1B2B3A')
            .text('Fabric Cut Worksheet — Detail Table', 30, HDR_Y + HDR_H + 8, { align: 'center' });
        doc.y = HDR_Y + HDR_H + 28;

        // Column widths sized for landscape A4 (841pt wide). Total ~752pt from x=30.
        // Rot column removed; Bracket Type added (70pt); Chain/Motor reduced to 86pt.
        const colWidths = [38, 75, 58, 55, 40, 55, 86, 35, 70, 60, 60, 50, 70];
        const headers = ['Blind#', 'Location', 'Fab Cut W', 'Calc D', 'Ctrl', 'Ctrl Col', 'Chain/Motor', 'Roll', 'Fabric', 'Colour', 'BR Colour', 'Chain', 'Bracket Type'];
        const TABLE_LEFT = 30;
        const ROW_HEIGHT = 15; // Fixed row height in pt (prevents overlap)
        const TABLE_WIDTH = colWidths.reduce((a, b) => a + b, 0);

        for (const [fabricKey, groupData] of Object.entries(fabricCutData)) {
            if (doc.y > 460) doc.addPage();

            doc.fontSize(11).font('Helvetica-Bold').fillColor('#1B2B3A')
                .text(`Fabric: ${fabricKey}`, TABLE_LEFT, doc.y, { underline: true });
            doc.y += 18;

            // Column headers (with cell borders + light blue bg)
            const hdrY = doc.y;
            const HDR_ROW_H = 15;
            doc.fillColor('#DBEAFE').rect(TABLE_LEFT, hdrY - 2, TABLE_WIDTH, HDR_ROW_H).fill();
            doc.lineWidth(0.5).strokeColor('#888').rect(TABLE_LEFT, hdrY - 2, TABLE_WIDTH, HDR_ROW_H).stroke();
            let hdrX = TABLE_LEFT;
            doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#1E3A5F');
            headers.forEach((h, i) => {
                doc.lineWidth(0.3).strokeColor('#aaa')
                    .moveTo(hdrX, hdrY - 2).lineTo(hdrX, hdrY - 2 + HDR_ROW_H).stroke();
                doc.text(h, hdrX + 2, hdrY + 1, { lineBreak: false, width: colWidths[i] - 4, ellipsis: true });
                hdrX += colWidths[i];
            });
            doc.y = hdrY + HDR_ROW_H;

            doc.fontSize(8).font('Helvetica').fillColor('#000');
            for (const sheet of groupData.optimization.sheets) {
                // Sort panels by blind number for sequential table display
                const sortedPanels = [...sheet.panels].sort(
                    (a: any, b: any) => (a.blindNumber ?? 0) - (b.blindNumber ?? 0)
                );
                for (const panel of sortedPanels) {
                    if (doc.y > 520) doc.addPage();

                    const item = groupData.items.find((it: any) => it.id === panel.orderItemId);
                    const motorType = item?.chainOrMotor || '';
                    const fabricCutWidth = item ? this.calculateFabricCutWidth(item.width, motorType) : '';
                    const calculatedDrop = item ? this.calculateDrop(item.drop) : 0;
                    const chainSize = calculatedDrop > 0 ? getChainSize(calculatedDrop) : '';

                    const rowY = doc.y;
                    const bracketType = item?.bracketType || 'Single';
                    const isBracketHighlighted = /dual/i.test(bracketType) || /extension/i.test(bracketType);
                    const isMotorHighlighted = /motor/i.test(motorType);
                    // CHAIN/MOTOR col = index 6, BRACKET TYPE col = last (index 12)
                    const CHAIN_MOTOR_COL = 6;
                    const BRACKET_TYPE_COL = 12;
                    const values = [
                        String(panel.blindNumber ?? ''),
                        item?.location || panel.location || panel.label,
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
                        bracketType,
                    ];
                    // Row background (alternating)
                    const altBg = (sortedPanels.indexOf(panel) % 2 === 1);
                    if (altBg) {
                        doc.fillColor('#F8FAFC').rect(TABLE_LEFT, rowY - 1, TABLE_WIDTH, ROW_HEIGHT).fill();
                    }
                    // Draw cells with borders and highlights
                    let rx = TABLE_LEFT;
                    doc.fontSize(7.5).font('Helvetica').fillColor('#000');
                    values.forEach((val, i) => {
                        const shouldHighlight =
                            (i === BRACKET_TYPE_COL && isBracketHighlighted) ||
                            (i === CHAIN_MOTOR_COL && isMotorHighlighted);
                        if (shouldHighlight) {
                            doc.fillColor('#FEF08A').rect(rx, rowY - 1, colWidths[i], ROW_HEIGHT).fill();
                        }
                        doc.lineWidth(0.3).strokeColor('#ccc')
                            .rect(rx, rowY - 1, colWidths[i], ROW_HEIGHT).stroke();
                        // Constrain text to cell width to prevent overflow
                        doc.fillColor('#000').text(String(val), rx + 2, rowY + 1, {
                            lineBreak: false,
                            width: colWidths[i] - 4,
                            ellipsis: true,
                        });
                        rx += colWidths[i];
                    });
                    // Fixed row advancement (prevents text-wrap overlap)
                    doc.y = rowY + ROW_HEIGHT;
                }
            }

            const dtStats = groupData.optimization.statistics as any;
            doc.y += 6;
            doc.fontSize(9).font('Helvetica-Bold').fillColor('#333')
                .text(
                    `Sheets: ${dtStats.usedStockSheets ?? dtStats.totalSheets ?? 1}  |  ` +
                    `Efficiency: ${dtStats.efficiency ?? dtStats.avgEfficiency ?? 0}%  |  ` +
                    `Fabric Needed: ${((dtStats.totalFabricNeeded ?? 0) / 1000).toFixed(2)}m`,
                    TABLE_LEFT, doc.y, { lineBreak: false }
                );
            doc.y += 20;
        }

        // ====================================================================
        // STATISTICS SUMMARY PAGE
        // Uses lineBreak: false + explicit Y management (no continued)
        // ====================================================================
        doc.addPage();
        doc.fontSize(16).font('Helvetica-Bold').fillColor('#1B2B3A')
            .text('Optimization Statistics', 30, 25, { align: 'center', lineBreak: false });
        doc.y = 55;

        // Table
        const sColW = [30, 200, 50, 60, 80, 60, 70];
        const sHeaders = ['#', 'Fabric', 'Sheets', 'Efficiency', 'Fabric Needed', 'Waste', 'Guillotine'];
        const S_TABLE_LEFT = 50;
        const S_ROW_HEIGHT = 14;
        const S_TABLE_WIDTH = sColW.reduce((a, b) => a + b, 0);

        // Header row
        const statHdrY = doc.y;
        let sx = S_TABLE_LEFT;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#333');
        sHeaders.forEach((h, i) => {
            doc.text(h, sx, statHdrY, { lineBreak: false });
            sx += sColW[i];
        });
        doc.y = statHdrY + S_ROW_HEIGHT + 2;
        doc.strokeColor('#ccc').lineWidth(0.5)
            .moveTo(S_TABLE_LEFT, doc.y).lineTo(S_TABLE_LEFT + S_TABLE_WIDTH, doc.y).stroke();
        doc.y += 5;

        let rowIdx = 0;
        let sumFabric = 0;
        let sumEfficiency = 0;
        const fabricEntries = Object.entries(fabricCutData);

        for (const [fabricKey, groupData] of fabricEntries) {
            rowIdx++;
            const s = groupData.optimization.statistics as any;
            const optAny = groupData.optimization as any;
            const eff = s.efficiency ?? s.avgEfficiency ?? 0;
            const waste = s.wastePercentage ?? 0;
            const fabricNeeded = s.totalFabricNeeded ?? 0;
            sumFabric += fabricNeeded;
            sumEfficiency += eff;

            const row = [
                String(rowIdx),
                fabricKey,
                String(s.usedStockSheets ?? s.totalSheets ?? 1),
                `${Number(eff).toFixed(1)}%`,
                `${(fabricNeeded / 1000).toFixed(2)} m`,
                `${Number(waste).toFixed(1)}%`,
                optAny.isGuillotineValid !== undefined
                    ? (optAny.isGuillotineValid ? 'Valid' : 'No')
                    : '-',
            ];

            const sRowY = doc.y;
            sx = S_TABLE_LEFT;
            doc.fontSize(8).font('Helvetica').fillColor('#000');
            row.forEach((val, i) => {
                doc.text(val, sx, sRowY, { lineBreak: false });
                sx += sColW[i];
            });
            doc.y = sRowY + S_ROW_HEIGHT;
        }

        // Totals row
        doc.y += 4;
        doc.strokeColor('#ccc').lineWidth(0.5)
            .moveTo(S_TABLE_LEFT, doc.y).lineTo(S_TABLE_LEFT + S_TABLE_WIDTH, doc.y).stroke();
        doc.y += 6;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000');
        doc.text(
            `TOTAL: ${(sumFabric / 1000).toFixed(2)} m fabric needed  |  Avg Efficiency: ${(sumEfficiency / (fabricEntries.length || 1)).toFixed(1)}%`,
            S_TABLE_LEFT, doc.y, { lineBreak: false }
        );
        doc.y += 18;

        // GA strategy info per fabric group
        doc.fontSize(8).font('Helvetica').fillColor('#555');
        for (const [fabricKey, groupData] of fabricEntries) {
            const optAny = groupData.optimization as any;
            if (optAny.strategy || optAny.generationStats) {
                const gs = optAny.generationStats;
                const parts = [`${fabricKey}:`];
                if (optAny.strategy) parts.push(optAny.strategy);
                if (gs) parts.push(`seeds=${gs.seedsTested}, best gen ${gs.bestGeneration}/${gs.totalGenerations}, ${gs.convergenceTime}ms`);
                doc.text(parts.join('  '), S_TABLE_LEFT, doc.y, { lineBreak: false });
                doc.y += 12;
            }
        }

        doc.fontSize(7).fillColor('#aaa')
            .text('Generated by Signature Shades SAP', 30, 550, { align: 'left' });

        // NOTE: do NOT call doc.end() here — caller must pipe() then end()
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

            // Cutting order section
            if (group.cuttingOrder && group.cuttingOrder.length > 0) {
                doc.moveDown(0.4);
                doc.fontSize(9).font('Helvetica-Bold').text('Cutting Order:');
                doc.moveDown(0.2);

                for (const piece of group.cuttingOrder) {
                    if (doc.y > 750) doc.addPage();
                    const cuts = piece.cuts.map(c => `${c.location} (${c.width}mm)`).join('  →  ');
                    doc.fontSize(8).font('Helvetica')
                        .text(`Piece ${piece.pieceNumber}:  ${cuts}`, 50, doc.y, { width: 480 });
                    doc.fontSize(7.5).font('Helvetica').fillColor('#666')
                        .text(`Used: ${piece.totalUsed}mm  |  Waste: ${piece.waste}mm  |  Stock: 5800mm`, 50, doc.y, { width: 480 });
                    doc.fillColor('#000').moveDown(0.3);
                }
            }
            doc.moveDown();
        }

        doc.moveDown();
        doc.fontSize(10).font('Helvetica-Bold')
            .text(`Total Bottom Bar Pieces Needed: ${tubeCutData.totalPiecesNeeded}`, { align: 'center' });

        // NOTE: do NOT call doc.end() here — caller must pipe() then end()
        return doc;
    }
}
