// @ts-ignore - pdfkit types may not be available in all environments
import PDFDocument from 'pdfkit';
import { OptimizationResult } from './cutlistOptimizer.service';
import { TubeCutResult } from './tubeCutOptimizer.service';

interface OrderInfo {
    orderNumber: string;
    customerName: string;
    orderDate: Date;
}

export class WorksheetExportService {
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

                    rows.push([
                        sheet.id,
                        `"(${panel.x}, ${panel.y})"`,
                        `"${item?.location || panel.label}"`,
                        item?.width || '',
                        item?.drop || '',
                        item ? item.width - 35 : '',
                        item ? item.drop + 150 : '',
                        `"${item?.controlSide || '-'}"`,
                        `"${item?.bracketColour || '-'}"`,
                        `"${(item?.chainOrMotor || '-').replace(/_/g, ' ')}"`,
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
     * Generate Fabric Cut PDF
     */
    static generateFabricCutPDF(
        orderInfo: OrderInfo,
        fabricCutData: Record<string, { optimization: OptimizationResult; items: any[] }>
    ): any {
        const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 30 });

        // Header
        doc.fontSize(16).font('Helvetica-Bold').text('Fabric Cut Worksheet', { align: 'center' });
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

                    const rowY = doc.y;
                    let rx = 30;
                    const values = [
                        String(sheet.id),
                        `(${panel.x},${panel.y})`,
                        item?.location || panel.label,
                        String(item?.width || ''),
                        String(item?.drop || ''),
                        item ? String(item.width - 35) : '',
                        item ? String(item.drop + 150) : '',
                        item?.controlSide || '-',
                        item?.bracketColour || '-',
                        (item?.chainOrMotor || '-').replace(/_/g, ' '),
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
