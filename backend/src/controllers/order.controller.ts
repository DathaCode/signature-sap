import { Request, Response, NextFunction } from 'express';
import { ExcelParserService } from '../services/excelParser.service';
import { OrderService } from '../services/order.service';
import { WorksheetService } from '../services/worksheet.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { ParsedOrderSchema, OrderConfirmationSchema } from '../types/schemas';

export class OrderController {
    /**
     * POST /api/orders/upload
     * Upload and parse Excel order file
     */
    static async uploadOrder(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.file) {
                throw new AppError(400, 'No file uploaded');
            }

            const { customerName } = req.body;
            if (!customerName) {
                throw new AppError(400, 'Customer name is required');
            }

            logger.info(`Processing order upload for customer: ${customerName}`);

            // Parse Excel file
            const parsedItems = ExcelParserService.parseOrderFile(
                req.file.buffer,
                req.file.originalname
            );

            // Apply business logic
            let processedItems = OrderService.calculateDimensions(parsedItems);
            processedItems = OrderService.detectDuplicateFabrics(processedItems);

            // Check inventory availability
            const availabilityCheck = await OrderService.checkInventoryAvailability(processedItems);

            if (!availabilityCheck.available) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Insufficient inventory',
                    insufficientItems: availabilityCheck.insufficientItems,
                });
            }

            // Create order in database
            const order = await OrderService.createOrder(
                customerName,
                req.file.originalname,
                processedItems
            );

            logger.info(`Order created successfully: ${order.id}`);

            res.status(201).json({
                status: 'success',
                message: 'Order uploaded and parsed successfully',
                data: {
                    orderId: order.id,
                    customerName: order.customerName,
                    fileName: order.uploadedFileName,
                    itemCount: order.worksheetItems.length,
                    duplicateCount: order.worksheetItems.filter(item => item.highlightFlag).length,
                    items: order.worksheetItems.map(item => ({
                        blindNumber: item.blindNumber,
                        location: item.location,
                        originalWidth: item.originalWidthMm,
                        originalDrop: item.originalDropMm,
                        calculatedWidth: item.widthMm,
                        calculatedDrop: item.dropMm,
                        fabricType: item.fabricType,
                        fabricColor: item.fabricColor,
                        highlightFlag: item.highlightFlag,
                    })),
                },
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/orders/:orderId/confirm
     * Confirm order and deduct inventory
     */
    static async confirmOrder(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params;

            logger.info(`Confirming order: ${orderId}`);

            const result = await OrderService.confirmOrder(orderId);

            res.status(200).json({
                status: 'success',
                message: 'Order confirmed and inventory deducted',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/orders/:orderId/worksheets
     * Get both fabric cut and tube cut worksheets
     */
    static async getWorksheets(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params;

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
     * GET /api/orders/:orderId/download?type=fabric_cut&format=csv
     * Download worksheet as CSV or PDF
     */
    static async downloadWorksheet(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params;
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
                const csv = await OrderController.generateCSV(worksheet);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.send(csv);
            } else {
                const pdfBuffer = await OrderController.generatePDF(worksheet);
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

            // Unescape or format if needed

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
        require('jspdf-autotable'); // Mutation on jsPDF prototype

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
                // Adjust other widths if needed
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
     * GET /api/orders/:orderId
     * Get order details
     */
    static async getOrder(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params;

            const order = await OrderService.getOrderDetails(orderId);

            res.status(200).json({
                status: 'success',
                data: order,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/orders
     * Get all orders
     */
    static async getOrders(req: Request, res: Response, next: NextFunction) {
        try {
            const orders = await OrderService.getAllOrders();

            res.status(200).json({
                status: 'success',
                data: orders,
            });
        } catch (error) {
            next(error);
        }
    }
}
