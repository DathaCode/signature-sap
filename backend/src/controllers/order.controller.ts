import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { WorksheetService } from '../services/worksheet.service';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

/**
 * Generate unique order number: SS-YYMMDD-XXXX
 */
async function generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const count = await prisma.order.count({
        where: {
            createdAt: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `SS-${dateStr}-${sequence}`;
}

export class OrderController {
    /**
     * POST /api/orders/upload
     * Upload Excel order file and create order with items
     */
    static async uploadOrder(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.file) {
                throw new AppError(400, 'No file uploaded');
            }

            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const rows: any[] = XLSX.utils.sheet_to_json(sheet);

            if (rows.length === 0) {
                throw new AppError(400, 'Excel file contains no data');
            }

            const orderNumber = await generateOrderNumber();

            // Extract customer name from first row or filename
            const customerName = rows[0]?.['Customer Name'] ||
                rows[0]?.['customer_name'] ||
                req.file.originalname.replace(/\.[^/.]+$/, '');

            const order = await prisma.order.create({
                data: {
                    orderNumber,
                    customerName,
                    status: OrderStatus.PENDING,
                    fileSource: 'EXCEL_UPLOAD',
                    uploadedFileName: req.file.originalname,
                    subtotal: 0,
                    total: 0,
                    items: {
                        create: rows.map((row, index) => ({
                            itemNumber: index + 1,
                            itemType: 'blind',
                            location: row['Location'] || row['location'] || `Item ${index + 1}`,
                            width: parseInt(row['Width'] || row['width'] || '0'),
                            drop: parseInt(row['Drop'] || row['drop'] || '0'),
                            fixing: row['Fixing'] || row['fixing'] || null,
                            bracketType: row['Bracket Type'] || row['bracket_type'] || null,
                            bracketColour: row['Bracket Colour'] || row['bracket_colour'] || null,
                            controlSide: row['Control Side'] || row['control_side'] || null,
                            chainOrMotor: row['Chain/Motor'] || row['chain_or_motor'] || null,
                            roll: row['Roll'] || row['roll'] || null,
                            material: row['Material'] || row['material'] || null,
                            fabricType: row['Fabric Type'] || row['fabric_type'] || null,
                            fabricColour: row['Fabric Colour'] || row['fabric_colour'] || null,
                            bottomRailType: row['Bottom Rail Type'] || row['bottom_rail_type'] || null,
                            bottomRailColour: row['Bottom Rail Colour'] || row['bottom_rail_colour'] || null,
                            calculatedWidth: parseInt(row['Width'] || row['width'] || '0') - 28,
                            calculatedDrop: parseInt(row['Drop'] || row['drop'] || '0') + 150,
                        })),
                    },
                },
                include: {
                    items: { orderBy: { itemNumber: 'asc' } },
                },
            });

            logger.info(`Order uploaded from Excel: ${orderNumber} (${req.file.originalname})`);

            res.status(201).json({
                status: 'success',
                message: 'Order uploaded successfully',
                data: order,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/orders/:orderId/confirm
     * Confirm order and move to CONFIRMED status
     */
    static async confirmOrder(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };

            const order = await prisma.order.findUnique({
                where: { id: orderId },
            });

            if (!order) {
                throw new AppError(404, 'Order not found');
            }

            if (order.status !== OrderStatus.PENDING) {
                throw new AppError(400, 'Only pending orders can be confirmed');
            }

            const updated = await prisma.order.update({
                where: { id: orderId },
                data: {
                    status: OrderStatus.CONFIRMED,
                    confirmedAt: new Date(),
                },
                include: {
                    items: { orderBy: { itemNumber: 'asc' } },
                },
            });

            logger.info(`Order confirmed: ${order.orderNumber}`);

            res.status(200).json({
                status: 'success',
                message: 'Order confirmed successfully',
                data: updated,
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
     * GET /api/orders/:orderId/download?type=fabric_cut&format=csv
     * Download worksheet as CSV
     */
    static async downloadWorksheet(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };
            const { type = 'fabric_cut', format = 'csv' } = req.query as {
                type?: string;
                format?: string;
            };

            let worksheetData;
            if (type === 'tube_cut') {
                worksheetData = await WorksheetService.getTubeCutWorksheet(orderId);
            } else {
                worksheetData = await WorksheetService.getFabricCutWorksheet(orderId);
            }

            if (format === 'csv') {
                const header = worksheetData.columns.join(',');
                const rows = worksheetData.items.map((item: any) =>
                    Object.values(item).join(',')
                );
                const csv = [header, ...rows].join('\n');

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader(
                    'Content-Disposition',
                    `attachment; filename="${type}_${orderId}.csv"`
                );
                res.send(csv);
            } else {
                res.status(200).json({
                    status: 'success',
                    data: worksheetData,
                });
            }
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/orders/:orderId
     * Get single order with items
     */
    static async getOrder(req: Request, res: Response, next: NextFunction) {
        try {
            const { orderId } = req.params as { orderId: string };

            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: { orderBy: { itemNumber: 'asc' } },
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            phone: true,
                            company: true,
                        },
                    },
                },
            });

            if (!order) {
                throw new AppError(404, 'Order not found');
            }

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
     * Get all orders with optional filters
     */
    static async getOrders(req: Request, res: Response, next: NextFunction) {
        try {
            const { status, productType } = req.query as {
                status?: string;
                productType?: string;
            };

            const orders = await prisma.order.findMany({
                where: {
                    ...(status && { status: status as OrderStatus }),
                    ...(productType && { productType: productType as any }),
                },
                include: {
                    items: { orderBy: { itemNumber: 'asc' } },
                },
                orderBy: { createdAt: 'desc' },
            });

            res.status(200).json({
                status: 'success',
                data: orders,
                count: orders.length,
            });
        } catch (error) {
            next(error);
        }
    }
}
