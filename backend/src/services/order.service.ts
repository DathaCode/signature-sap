import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { ExcelRow, WorksheetItemInput } from '../types/schemas';

const prisma = new PrismaClient();

export class OrderService {
    /**
     * Apply business logic: Width - 28mm, Drop + 150mm
     */
    static calculateDimensions(items: ExcelRow[]): WorksheetItemInput[] {
        return items.map(item => ({
            ...item,
            widthMm: item.originalWidthMm - 28,
            dropMm: item.originalDropMm + 150,
            highlightFlag: false, // Will be set by duplicate detection
        }));
    }

    /**
     * Detect duplicate fabric + color combinations and set highlight flags
     */
    static detectDuplicateFabrics(items: WorksheetItemInput[]): WorksheetItemInput[] {
        // Group items by fabric + color combination
        const fabricCombinations = new Map<string, number[]>();

        items.forEach((item, index) => {
            const key = `${item.fabricType}|${item.fabricColor}`.toLowerCase();

            if (!fabricCombinations.has(key)) {
                fabricCombinations.set(key, []);
            }
            fabricCombinations.get(key)!.push(index);
        });

        // Mark duplicates
        fabricCombinations.forEach((indices) => {
            if (indices.length > 1) {
                // This fabric+color appears multiple times - highlight all instances
                indices.forEach(index => {
                    items[index].highlightFlag = true;
                });
                logger.info(`Detected ${indices.length} duplicate blinds with fabric combination`);
            }
        });

        const duplicateCount = items.filter(item => item.highlightFlag).length;
        logger.info(`Total items with duplicate fabric detection: ${duplicateCount}`);

        return items;
    }

    /**
     * Check inventory availability for all items in the order
     */
    static async checkInventoryAvailability(items: WorksheetItemInput[]): Promise<{
        available: boolean;
        insufficientItems: Array<{ itemType: string; name: string; required: number; available: number }>;
    }> {
        const insufficientItems: Array<{
            itemType: string;
            name: string;
            required: number;
            available: number
        }> = [];

        // Aggregate requirements
        const fabricRequirements = new Map<string, number>();
        const bottomBarRequirements = new Map<string, number>();
        const chainMotorRequirements = new Map<string, number>();

        items.forEach(item => {
            // Fabrics - aggregate by fabric type (color handled separately if needed)
            const fabricKey = item.fabricType.toLowerCase();
            fabricRequirements.set(
                fabricKey,
                (fabricRequirements.get(fabricKey) || 0) + item.widthMm
            );

            // Bottom bars - aggregate by color
            const barKey = item.bottomRailColor.toLowerCase();
            bottomBarRequirements.set(
                barKey,
                (bottomBarRequirements.get(barKey) || 0) + 1
            );

            // Chain/Motor - aggregate by type
            const chainKey = item.chainOrMotor;
            chainMotorRequirements.set(
                chainKey,
                (chainMotorRequirements.get(chainKey) || 0) + 1
            );
        });

        // Check fabric availability
        for (const [fabricType, requiredMm] of fabricRequirements) {
            const inventoryItem = await prisma.inventoryItem.findFirst({
                where: {
                    category: 'FABRIC',
                    itemName: {
                        contains: fabricType,
                        mode: 'insensitive',
                    },
                },
            });

            if (!inventoryItem || inventoryItem.quantity.toNumber() < requiredMm) {
                insufficientItems.push({
                    itemType: 'Fabric',
                    name: fabricType,
                    required: requiredMm,
                    available: inventoryItem?.quantity.toNumber() || 0,
                });
            }
        }

        // Check bottom bar availability
        for (const [color, requiredUnits] of bottomBarRequirements) {
            const inventoryItem = await prisma.inventoryItem.findFirst({
                where: {
                    category: 'BOTTOM_BAR',
                    colorVariant: {
                        contains: color,
                        mode: 'insensitive',
                    },
                },
            });

            if (!inventoryItem || inventoryItem.quantity.toNumber() < requiredUnits) {
                insufficientItems.push({
                    itemType: 'Bottom Bar',
                    name: color,
                    required: requiredUnits,
                    available: inventoryItem?.quantity.toNumber() || 0,
                });
            }
        }

        // Check chain/motor availability
        for (const [chainType, requiredUnits] of chainMotorRequirements) {
            // Determine if it's a motor or chain based on enum value
            const isMotor = chainType.includes('AUTOMATE') || chainType.includes('ALPHA');
            const category = isMotor ? 'MOTOR' : 'CHAIN';

            const inventoryItem = await prisma.inventoryItem.findFirst({
                where: {
                    category,
                    itemName: {
                        contains: chainType.replace(/_/g, ' '),
                        mode: 'insensitive',
                    },
                },
            });

            if (!inventoryItem || inventoryItem.quantity.toNumber() < requiredUnits) {
                insufficientItems.push({
                    itemType: isMotor ? 'Motor' : 'Chain',
                    name: chainType.replace(/_/g, ' '),
                    required: requiredUnits,
                    available: inventoryItem?.quantity.toNumber() || 0,
                });
            }
        }

        return {
            available: insufficientItems.length === 0,
            insufficientItems,
        };
    }

    /**
     * Create order with worksheet items
     */
    static async createOrder(
        customerName: string,
        fileName: string,
        items: WorksheetItemInput[]
    ) {
        try {
            const order = await prisma.order.create({
                data: {
                    customerName,
                    uploadedFileName: fileName,
                    orderDate: new Date(),
                    status: 'pending',
                    worksheetItems: {
                        create: items.map(item => ({
                            blindNumber: item.blindNumber,
                            location: item.location,
                            originalWidthMm: item.originalWidthMm,
                            originalDropMm: item.originalDropMm,
                            widthMm: item.widthMm,
                            dropMm: item.dropMm,
                            controlSide: item.controlSide,
                            controlColor: item.controlColor,
                            chainOrMotor: item.chainOrMotor,
                            rollType: item.rollType,
                            fabricType: item.fabricType,
                            fabricColor: item.fabricColor,
                            bottomRailType: item.bottomRailType,
                            bottomRailColor: item.bottomRailColor,
                            highlightFlag: item.highlightFlag,
                            worksheetType: 'BOTH',
                        })),
                    },
                },
                include: {
                    worksheetItems: true,
                },
            });

            logger.info(`Created order ${order.id} with ${items.length} items`);
            return order;
        } catch (error) {
            logger.error('Failed to create order:', error);
            throw new AppError(500, 'Failed to create order in database');
        }
    }

    /**
     * Confirm order and deduct inventory
     */
    static async confirmOrder(orderId: string) {
        try {
            // Get order with items
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: { worksheetItems: true },
            });

            if (!order) {
                throw new AppError(404, 'Order not found');
            }

            if (order.status === 'confirmed') {
                throw new AppError(400, 'Order is already confirmed');
            }

            // Check inventory availability one more time
            const availabilityCheck = await this.checkInventoryAvailability(
                order.worksheetItems as any[]
            );

            if (!availabilityCheck.available) {
                throw new AppError(
                    400,
                    `Insufficient inventory for order confirmation: ${JSON.stringify(availabilityCheck.insufficientItems)}`
                );
            }

            // Perform inventory deductions in a transaction
            await prisma.$transaction(async (tx) => {
                for (const item of order.worksheetItems) {
                    // Deduct fabric (in mm)
                    await this.deductFabric(tx, item, orderId);

                    // Deduct bottom bar (1 unit)
                    await this.deductBottomBar(tx, item, orderId);

                    // Deduct chain/motor (1 unit)
                    await this.deductChainOrMotor(tx, item, orderId);
                }

                // Update order status
                await tx.order.update({
                    where: { id: orderId },
                    data: { status: 'confirmed' },
                });
            });

            logger.info(`Order ${orderId} confirmed and inventory deducted`);
            return { success: true, orderId };

        } catch (error) {
            if (error instanceof AppError) {
                throw error;
            }
            logger.error('Order confirmation failed:', error);
            throw new AppError(500, 'Failed to confirm order');
        }
    }

    /**
     * Deduct fabric from inventory
     */
    private static async deductFabric(tx: any, item: any, orderId: string) {
        const fabric = await tx.inventoryItem.findFirst({
            where: {
                category: 'FABRIC',
                itemName: { contains: item.fabricType, mode: 'insensitive' },
            },
        });

        if (!fabric) {
            throw new AppError(404, `Fabric "${item.fabricType}" not found in inventory`);
        }

        const newBalance = fabric.quantity.toNumber() - item.widthMm;

        await tx.inventoryItem.update({
            where: { id: fabric.id },
            data: { quantity: newBalance },
        });

        await tx.inventoryTransaction.create({
            data: {
                inventoryItemId: fabric.id,
                orderId,
                transactionType: 'DEDUCTION',
                quantityChange: -item.widthMm,
                newBalance,
                notes: `Deducted for blind ${item.blindNumber} (${item.location})`,
            },
        });
    }

    /**
     * Deduct bottom bar from inventory
     */
    private static async deductBottomBar(tx: any, item: any, orderId: string) {
        const bar = await tx.inventoryItem.findFirst({
            where: {
                category: 'BOTTOM_BAR',
                colorVariant: { contains: item.bottomRailColor, mode: 'insensitive' },
            },
        });

        if (!bar) {
            throw new AppError(404, `Bottom bar "${item.bottomRailColor}" not found in inventory`);
        }

        const newBalance = bar.quantity.toNumber() - 1;

        await tx.inventoryItem.update({
            where: { id: bar.id },
            data: { quantity: newBalance },
        });

        await tx.inventoryTransaction.create({
            data: {
                inventoryItemId: bar.id,
                orderId,
                transactionType: 'DEDUCTION',
                quantityChange: -1,
                newBalance,
                notes: `Deducted for blind ${item.blindNumber} (${item.location})`,
            },
        });
    }

    /**
     * Deduct chain or motor from inventory
     */
    private static async deductChainOrMotor(tx: any, item: any, orderId: string) {
        const isMotor = item.chainOrMotor.includes('AUTOMATE') || item.chainOrMotor.includes('ALPHA');
        const category = isMotor ? 'MOTOR' : 'CHAIN';

        const chainMotor = await tx.inventoryItem.findFirst({
            where: {
                category,
                itemName: {
                    contains: item.chainOrMotor.replace(/_/g, ' '),
                    mode: 'insensitive',
                },
            },
        });

        if (!chainMotor) {
            throw new AppError(404, `${category} "${item.chainOrMotor}" not found in inventory`);
        }

        const newBalance = chainMotor.quantity.toNumber() - 1;

        await tx.inventoryItem.update({
            where: { id: chainMotor.id },
            data: { quantity: newBalance },
        });

        await tx.inventoryTransaction.create({
            data: {
                inventoryItemId: chainMotor.id,
                orderId,
                transactionType: 'DEDUCTION',
                quantityChange: -1,
                newBalance,
                notes: `Deducted for blind ${item.blindNumber} (${item.location})`,
            },
        });
    }

    /**
     * Get order details by ID
     */
    static async getOrderDetails(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                worksheetItems: {
                    orderBy: { blindNumber: 'asc' },
                },
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        return {
            id: order.id,
            customerName: order.customerName,
            orderDate: order.orderDate,
            uploadedFileName: order.uploadedFileName,
            status: order.status,
            itemCount: order.worksheetItems.length,
            duplicateCount: order.worksheetItems.filter(item => item.highlightFlag).length,
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            items: order.worksheetItems,
        };
    }

    /**
     * Get all orders
     */
    static async getAllOrders() {
        const orders = await prisma.order.findMany({
            orderBy: { orderDate: 'desc' },
            include: {
                worksheetItems: {
                    select: {
                        id: true,
                        highlightFlag: true,
                    },
                },
            },
        });

        return orders.map(order => ({
            id: order.id,
            customerName: order.customerName,
            orderDate: order.orderDate,
            uploadedFileName: order.uploadedFileName,
            status: order.status,
            itemCount: order.worksheetItems.length,
            duplicateCount: order.worksheetItems.filter(item => item.highlightFlag).length,
            createdAt: order.createdAt,
        }));
    }
}
