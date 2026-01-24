import { PrismaClient, Prisma, InventoryCategory, UnitType } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

export class InventoryService {
    /**
     * Get all inventory items with optional category filter and search
     */
    static async getInventoryItems(category?: string, search?: string) {
        const where: any = {};

        if (category) {
            where.category = category as InventoryCategory;
        }

        if (search) {
            where.OR = [
                { itemName: { contains: search, mode: 'insensitive' } },
                { colorVariant: { contains: search, mode: 'insensitive' } },
            ];
        }

        const items = await prisma.inventoryItem.findMany({
            where,
            orderBy: [
                { category: 'asc' },
                { itemName: 'asc' },
                { colorVariant: 'asc' },
            ],
        });

        return items.map((item: any) => ({
            id: item.id,
            category: item.category,
            itemName: item.itemName,
            colorVariant: item.colorVariant,
            quantity: item.quantity.toNumber(),
            unitType: item.unitType,
            minStockAlert: item.minStockAlert?.toNumber(),
            isLowStock: item.minStockAlert
                ? item.quantity.toNumber() < item.minStockAlert.toNumber()
                : false,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
        }));
    }

    /**
     * Get single inventory item with transaction history
     */
    static async getInventoryItem(itemId: string) {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        order: {
                            select: {
                                id: true,
                                customerName: true,
                                orderDate: true,
                            },
                        },
                    },
                },
            },
        });

        if (!item) {
            throw new AppError(404, 'Inventory item not found');
        }

        return {
            id: item.id,
            category: item.category,
            itemName: item.itemName,
            colorVariant: item.colorVariant,
            quantity: item.quantity.toNumber(),
            unitType: item.unitType,
            minStockAlert: item.minStockAlert?.toNumber(),
            isLowStock: item.minStockAlert
                ? item.quantity.toNumber() < item.minStockAlert.toNumber()
                : false,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
            recentTransactions: item.transactions.map((tx: any) => ({
                id: tx.id,
                transactionType: tx.transactionType,
                quantityChange: tx.quantityChange.toNumber(),
                newBalance: tx.newBalance.toNumber(),
                notes: tx.notes,
                createdAt: tx.createdAt,
                order: tx.order,
            })),
        };
    }

    /**
     * Add new inventory item
     */
    static async addInventoryItem(data: {
        category: InventoryCategory;
        itemName: string;
        colorVariant?: string;
        quantity: number;
        unitType: UnitType;
        minStockAlert?: number;
    }) {
        // Check for duplicate
        const existing = await prisma.inventoryItem.findFirst({
            where: {
                category: data.category,
                itemName: data.itemName,
                colorVariant: data.colorVariant || null,
            },
        });

        if (existing) {
            throw new AppError(400, 'Inventory item already exists with this name and color variant');
        }

        const item = await prisma.inventoryItem.create({
            data: {
                category: data.category,
                itemName: data.itemName,
                colorVariant: data.colorVariant,
                quantity: data.quantity,
                unitType: data.unitType,
                minStockAlert: data.minStockAlert,
            },
        });

        // Create transaction record
        await prisma.inventoryTransaction.create({
            data: {
                inventoryItemId: item.id,
                transactionType: 'ADDITION',
                quantityChange: data.quantity,
                newBalance: data.quantity,
                notes: 'Initial stock',
            },
        });

        logger.info(`Inventory item created: ${item.id}`);
        return item;
    }

    /**
     * Update inventory item details (not quantity)
     */
    static async updateInventoryItem(itemId: string, updates: {
        itemName?: string;
        colorVariant?: string;
        minStockAlert?: number;
    }) {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            throw new AppError(404, 'Inventory item not found');
        }

        const updated = await prisma.inventoryItem.update({
            where: { id: itemId },
            data: updates,
        });

        logger.info(`Inventory item updated: ${itemId}`);
        return updated;
    }

    /**
     * Adjust inventory quantity
     */
    static async adjustQuantity(itemId: string, quantityChange: number, notes?: string) {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            throw new AppError(404, 'Inventory item not found');
        }

        const currentQuantity = item.quantity.toNumber();
        const newBalance = currentQuantity + quantityChange;

        if (newBalance < 0) {
            throw new AppError(400, 'Cannot adjust quantity below zero');
        }

        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // Update quantity
            await tx.inventoryItem.update({
                where: { id: itemId },
                data: { quantity: newBalance },
            });

            // Create transaction record
            await tx.inventoryTransaction.create({
                data: {
                    inventoryItemId: itemId,
                    transactionType: 'ADJUSTMENT',
                    quantityChange,
                    newBalance,
                    notes: notes || 'Manual adjustment',
                },
            });
        });

        logger.info(`Inventory quantity adjusted for ${itemId}: ${quantityChange}`);
        return { newBalance };
    }

    /**
     * Get transaction history for an item
     */
    static async getTransactionHistory(itemId: string) {
        const transactions = await prisma.inventoryTransaction.findMany({
            where: { inventoryItemId: itemId },
            orderBy: { createdAt: 'desc' },
            include: {
                order: {
                    select: {
                        id: true,
                        customerName: true,
                        orderDate: true,
                    },
                },
            },
        });

        return transactions.map((tx: any) => ({
            id: tx.id,
            transactionType: tx.transactionType,
            quantityChange: tx.quantityChange.toNumber(),
            newBalance: tx.newBalance.toNumber(),
            notes: tx.notes,
            createdAt: tx.createdAt,
            order: tx.order,
        }));
    }

    /**
     * Get items below minimum stock threshold
     */
    static async getLowStockItems() {
        const items = await prisma.inventoryItem.findMany({
            where: {
                minStockAlert: { not: null },
            },
        });

        const lowStockItems = items.filter((item: any) => {
            if (!item.minStockAlert) return false;
            return item.quantity.toNumber() < item.minStockAlert.toNumber();
        });

        return lowStockItems.map((item: any) => ({
            id: item.id,
            category: item.category,
            itemName: item.itemName,
            colorVariant: item.colorVariant,
            currentQuantity: item.quantity.toNumber(),
            minStockAlert: item.minStockAlert?.toNumber(),
            unitType: item.unitType,
            deficit: item.minStockAlert
                ? item.minStockAlert.toNumber() - item.quantity.toNumber()
                : 0,
        }));
    }

    /**
     * Soft delete inventory item
     */
    static async deleteInventoryItem(itemId: string) {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId },
            include: {
                transactions: {
                    where: {
                        order: {
                            status: 'pending',
                        },
                    },
                    take: 1,
                },
            },
        });

        if (!item) {
            throw new AppError(404, 'Inventory item not found');
        }

        if (item.transactions.length > 0) {
            throw new AppError(
                400,
                'Cannot delete item with active orders. Complete or cancel pending orders first.'
            );
        }

        await prisma.inventoryItem.delete({
            where: { id: itemId },
        });

        logger.info(`Deleted inventory item: ${itemId}`);
    }

    /**
     * Get all inventory transactions with filters
     */
    static async getAllTransactions(filters: {
        startDate?: string;
        endDate?: string;
        itemId?: string;
        transactionType?: string;
    }) {
        const where: any = {};

        if (filters.itemId) {
            where.inventoryItemId = filters.itemId;
        }

        if (filters.transactionType) {
            where.transactionType = filters.transactionType;
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = new Date(filters.startDate);
            }
            if (filters.endDate) {
                where.createdAt.lte = new Date(filters.endDate);
            }
        }

        const transactions = await prisma.inventoryTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                inventoryItem: {
                    select: {
                        id: true,
                        itemName: true,
                        colorVariant: true,
                        category: true,
                    },
                },
                order: {
                    select: {
                        id: true,
                        customerName: true,
                        orderDate: true,
                    },
                },
            },
        });

        return transactions.map(tx => ({
            id: tx.id,
            transactionType: tx.transactionType,
            quantityChange: tx.quantityChange.toNumber(),
            newBalance: tx.newBalance.toNumber(),
            notes: tx.notes,
            createdAt: tx.createdAt,
            inventoryItem: tx.inventoryItem,
            order: tx.order,
        }));
    }

    /**
     * Bulk import inventory items from CSV
     */
    static async bulkImportFromCSV(fileBuffer: Buffer) {
        const Papa = require('papaparse');

        const csvText = fileBuffer.toString('utf-8');
        const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
        });

        if (parsed.errors.length > 0) {
            throw new AppError(400, `CSV parsing error: ${parsed.errors[0].message}`);
        }

        const results = {
            imported: 0,
            skipped: 0,
            errors: [] as string[],
        };

        for (const row of parsed.data) {
            try {
                const { category, itemName, colorVariant, quantity, unitType, minStockAlert } = row;

                if (!category || !itemName || !quantity || !unitType) {
                    results.errors.push(`Skipped row: missing required fields`);
                    results.skipped++;
                    continue;
                }

                const existing = await prisma.inventoryItem.findFirst({
                    where: {
                        category: category as InventoryCategory,
                        itemName,
                        colorVariant: colorVariant || null,
                    },
                });

                if (existing) {
                    results.errors.push(`Skipped "${itemName}": already exists`);
                    results.skipped++;
                    continue;
                }

                await this.addInventoryItem({
                    category: category as InventoryCategory,
                    itemName,
                    colorVariant: colorVariant || undefined,
                    quantity: parseFloat(quantity),
                    unitType: unitType as UnitType,
                    minStockAlert: minStockAlert ? parseFloat(minStockAlert) : undefined,
                });

                results.imported++;
            } catch (error) {
                results.errors.push(`Error importing row: ${(error as Error).message}`);
                results.skipped++;
            }
        }

        logger.info(`Bulk import completed: ${results.imported} imported, ${results.skipped} skipped`);
        return results;
    }
}
