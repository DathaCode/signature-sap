import { Request, Response, NextFunction } from 'express';
import { WorksheetService } from '../services/worksheet.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { fabricCutOptimizer } from '../services/fabricCutOptimizer.service';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AdminWorksheetController {
    /**
     * GET /api/admin/worksheets/:orderId
     * Get both fabric cut and tube cut worksheets
     */
    static async getWorksheets(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };

            const worksheets = await WorksheetService.getWorksheets(orderId);

            res.status(200).json({
                status: 'success',
                data: worksheets,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/admin/worksheets/:orderId/download?type=fabric_cut&format=csv
     * Download worksheet as CSV or PDF
     */
    static async downloadWorksheet(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };
            const { type, format } = req.query as { type: string; format: string };

            if (!type || !format) {
                throw new AppError(400, 'Type and format query parameters are required');
            }

            if (type !== 'fabric_cut' && type !== 'tube_cut') {
                throw new AppError(400, 'Type must be fabric_cut or tube_cut');
            }

            if (format !== 'csv' && format !== 'pdf') {
                throw new AppError(400, 'Format must be csv or pdf');
            }

            logger.info(`Downloading ${type} worksheet as ${format} for order ${orderId}`);

            // Get worksheet data
            const worksheet = type === 'fabric_cut'
                ? await WorksheetService.getFabricCutWorksheet(orderId)
                : await WorksheetService.getTubeCutWorksheet(orderId);

            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `${type === 'fabric_cut' ? 'FabricCut' : 'TubeCut'}_${worksheet.customerName.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.${format}`;

            if (format === 'csv') {
                const csv = await AdminWorksheetController.generateCSV(worksheet);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.send(csv);
            } else {
                const pdfBuffer = await AdminWorksheetController.generatePDF(worksheet);
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                // Send raw buffer
                res.end(pdfBuffer);
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * Generate CSV from worksheet data
     */
    private static async generateCSV(worksheet: any): Promise<string> {
        const Papa = require('papaparse');

        // Prepare data for CSV
        // Flatten items to array of values matching columns
        const data = worksheet.items.map((item: any) => {
            let orderedValues: any[] = [];

            if (worksheet.type === 'fabric_cut') {
                orderedValues = [
                    item.blindNumber,
                    item.location,
                    item.widthMm,
                    item.dropMm,
                    item.controlSide,
                    item.controlColor,
                    item.chainOrMotor,
                    item.rollType,
                    item.fabricType,
                    item.fabricColor,
                    item.bottomRailType,
                    item.bottomRailColor
                ];
            } else {
                orderedValues = [
                    item.blindNumber,
                    item.location,
                    item.widthMm,
                    item.bottomRailType,
                    item.bottomRailColor
                ];
            }

            // Add Highlight column
            if (item.highlightFlag) {
                orderedValues.push('YES');
            } else {
                orderedValues.push('');
            }

            return orderedValues;
        });

        // Add "HIGHLIGHT" to columns header
        const columns = [...worksheet.columns, 'DUPLICATE?'];

        return Papa.unparse({
            fields: columns,
            data: data
        });
    }

    /**
     * Generate PDF from worksheet data
     */
    private static async generatePDF(worksheet: any): Promise<Buffer> {
        const { jsPDF } = require('jspdf');
        require('jspdf-autotable');

        const doc = new jsPDF({ orientation: 'landscape' });

        // --- Header ---
        doc.setFontSize(22);
        doc.setTextColor(27, 43, 58); // Brand Navy #1B2B3A
        doc.text('Signature Shades - Warehouse Worksheet', 14, 20);

        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Worksheet: ${worksheet.type === 'fabric_cut' ? 'Fabric Cut' : 'Tube Cut'}`, 14, 30);
        doc.text(`Customer: ${worksheet.customerName}`, 14, 36);
        doc.text(`Date: ${new Date(worksheet.orderDate).toLocaleDateString()}`, 14, 42);

        // --- Table ---
        const tableColumns = worksheet.columns;
        const tableRows = worksheet.items.map((item: any) => {
            if (worksheet.type === 'fabric_cut') {
                return [
                    item.blindNumber,
                    item.location,
                    `${item.widthMm}mm`,
                    `${item.dropMm}mm`,
                    item.controlSide,
                    item.controlColor,
                    item.chainOrMotor,
                    item.rollType,
                    item.fabricType,
                    item.fabricColor,
                    item.bottomRailType,
                    item.bottomRailColor
                ];
            } else {
                return [
                    item.blindNumber,
                    item.location,
                    `${item.widthMm}mm`,
                    item.bottomRailType,
                    item.bottomRailColor
                ];
            }
        });

        // Add highlight styling
        (doc as any).autoTable({
            head: [tableColumns],
            body: tableRows,
            startY: 50,
            theme: 'grid',
            headStyles: {
                fillColor: [27, 43, 58], // Brand Navy
                textColor: 255,
                fontStyle: 'bold',
            },
            styles: {
                fontSize: 10,
                cellPadding: 3,
                valign: 'middle',
            },
            didParseCell: (data: any) => {
                // Highlight yellow if item has highlightFlag
                if (data.section === 'body') {
                    const item = worksheet.items[data.row.index];
                    if (item.highlightFlag) {
                        data.cell.styles.fillColor = [255, 241, 118]; // Light yellow
                    }
                }
            },
            columnStyles: {
                0: { cellWidth: 20 }, // Blind No
            }
        });

        // --- Footer ---
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
            doc.text('Generated by Signature SAP', 14, doc.internal.pageSize.height - 10);
        }

        return Buffer.from(doc.output('arraybuffer'));
    }

    /**
     * POST /api/admin/worksheets/:orderId/generate
     * Generate optimized worksheet with Genetic Algorithm
     */
    static async generateWorksheet(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };

            logger.info(`🔄 Generating worksheet for order: ${orderId}`);

            // Get order with items
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });

            if (!order) {
                throw new AppError(404, 'Order not found');
            }

            if (order.items.length === 0) {
                throw new AppError(400, 'Order has no items to optimize');
            }

            // Run fabric cut optimization
            logger.info(`🎯 Running fabric cut optimization for ${order.items.length} items...`);
            const startTime = Date.now();

            const optimizationResults = await fabricCutOptimizer.optimizeOrder(order.items);

            const optimizationTime = Date.now() - startTime;
            logger.info(`✅ Optimization complete in ${optimizationTime}ms`);

            // Check inventory sufficiency
            const inventoryCheck = await fabricCutOptimizer.checkInventorySufficiency(optimizationResults);

            // Convert Map to JSON-serializable object
            const resultsObject = Object.fromEntries(optimizationResults);

            // Store optimization results in order
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    fabricCutOptimization: resultsObject as any,
                    worksheetGeneratedAt: new Date(),
                },
            });

            res.status(200).json({
                status: 'success',
                message: 'Worksheet generated successfully',
                data: {
                    optimizationResults: resultsObject,
                    inventoryCheck,
                    optimizationTime: `${optimizationTime}ms`,
                },
            });

        } catch (error) {
            logger.error('❌ Worksheet generation error:', error);
            next(error);
        }
    }

    /**
     * POST /api/admin/worksheets/:orderId/recalculate
     * Recalculate optimization with fresh results
     */
    static async recalculateOptimization(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };

            logger.info(`🔄 Recalculating optimization for order: ${orderId}`);

            // Get order with items
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { items: true },
            });

            if (!order) {
                throw new AppError(404, 'Order not found');
            }

            if (order.items.length === 0) {
                throw new AppError(400, 'Order has no items to optimize');
            }

            // Re-run optimization from scratch
            const startTime = Date.now();
            const optimizationResults = await fabricCutOptimizer.optimizeOrder(order.items);
            const optimizationTime = Date.now() - startTime;

            // Check inventory sufficiency
            const inventoryCheck = await fabricCutOptimizer.checkInventorySufficiency(optimizationResults);

            // Convert Map to JSON-serializable object
            const resultsObject = Object.fromEntries(optimizationResults);

            // Update stored optimization results
            await prisma.order.update({
                where: { id: orderId },
                data: {
                    fabricCutOptimization: resultsObject as any,
                    worksheetGeneratedAt: new Date(),
                },
            });

            logger.info(`✅ Recalculation complete in ${optimizationTime}ms`);

            res.status(200).json({
                status: 'success',
                message: 'Optimization recalculated successfully',
                data: {
                    optimizationResults: resultsObject,
                    inventoryCheck,
                    optimizationTime: `${optimizationTime}ms`,
                },
            });

        } catch (error) {
            logger.error('❌ Recalculation error:', error);
            next(error);
        }
    }

    /**
     * GET /api/admin/worksheets/:orderId/optimization
     * Get stored optimization results
     */
    static async getOptimizationResults(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };

            const order = await prisma.order.findUnique({
                where: { id: orderId },
                select: {
                    fabricCutOptimization: true,
                    worksheetGeneratedAt: true,
                },
            });

            if (!order) {
                throw new AppError(404, 'Order not found');
            }

            if (!order.fabricCutOptimization) {
                throw new AppError(404, 'No optimization results found. Generate worksheet first.');
            }

            res.status(200).json({
                status: 'success',
                data: {
                    optimizationResults: order.fabricCutOptimization,
                    generatedAt: order.worksheetGeneratedAt,
                },
            });

        } catch (error) {
            next(error);
        }
    }
}
