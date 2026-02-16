import { Request, Response, NextFunction } from 'express';
import { InventoryService } from '../services/inventory.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';

export class InventoryController {
    /**
     * GET /api/inventory?category=FABRIC
     * Get all inventory items with optional category filter
     */
    static async getInventoryItems(req: Request, res: Response, next: NextFunction) {
        try {
            const { category, search } = req.query as { category?: string; search?: string };

            const items = await InventoryService.getInventoryItems(
                category,
                search
            );

            res.status(200).json({
                status: 'success',
                data: items,
            });
        } catch (error) {
            next(error);
        }
    }

    // ... (skipping unchanged methods for brevity in tool call, but I will target specific method if possible)

    // Actually, I need to target specific chunks or the whole file. 
    // I will target the getInventoryItems method first.

    /**
     * GET /api/inventory/:itemId
     * Get single inventory item details
     */
    static async getInventoryItem(req: Request, res: Response, next: NextFunction) {
        try {
            const { itemId } = req.params as { itemId: string };

            const item = await InventoryService.getInventoryItem(itemId);

            res.status(200).json({
                status: 'success',
                data: item,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/inventory
     * Add new inventory item
     */
    static async addInventoryItem(req: Request, res: Response, next: NextFunction) {
        try {
            const { category, itemName, colorVariant, quantity, unitType, minStockAlert } = req.body;

            if (!category || !itemName || quantity === undefined || !unitType) {
                throw new AppError(400, 'Category, itemName, quantity, and unitType are required');
            }

            const item = await InventoryService.addInventoryItem({
                category,
                itemName,
                colorVariant,
                quantity,
                unitType,
                minStockAlert,
            });

            logger.info(`Added inventory item: ${itemName}`);

            res.status(201).json({
                status: 'success',
                message: 'Inventory item added successfully',
                data: item,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * PUT /api/inventory/:itemId
     * Update inventory item details
     */
    static async updateInventoryItem(req: Request, res: Response, next: NextFunction) {
        try {
            const { itemId } = req.params as { itemId: string };
            const updates = req.body;

            const item = await InventoryService.updateInventoryItem(itemId, updates);

            res.status(200).json({
                status: 'success',
                message: 'Inventory item updated successfully',
                data: item,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/inventory/:itemId/adjust
     * Adjust inventory quantity
     */
    static async adjustQuantity(req: Request, res: Response, next: NextFunction) {
        try {
            const { itemId } = req.params as { itemId: string };
            const { quantityChange, notes } = req.body;

            if (quantityChange === undefined) {
                throw new AppError(400, 'quantityChange is required');
            }

            const result = await InventoryService.adjustQuantity(itemId, quantityChange, notes);

            res.status(200).json({
                status: 'success',
                message: 'Inventory quantity adjusted successfully',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/inventory/:itemId/transactions
     * Get transaction history
     */
    static async getTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const { itemId } = req.params as { itemId: string };

            const transactions = await InventoryService.getTransactionHistory(itemId);

            res.status(200).json({
                status: 'success',
                data: transactions,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/inventory/alerts/low-stock
     * Get low stock items
     */
    static async getLowStockItems(_req: Request, res: Response, next: NextFunction) {
        try {
            const items = await InventoryService.getLowStockItems();

            res.status(200).json({
                status: 'success',
                data: items,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * DELETE /api/inventory/:itemId
     * Soft delete inventory item
     */
    static async deleteInventoryItem(req: Request, res: Response, next: NextFunction) {
        try {
            const { itemId } = req.params as { itemId: string };

            await InventoryService.deleteInventoryItem(itemId);

            res.status(200).json({
                status: 'success',
                message: 'Inventory item deleted successfully',
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * GET /api/inventory/transactions?startDate=...&endDate=...&itemId=...&type=...
     * Get all inventory transactions with filters
     */
    static async getAllTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const { startDate, endDate, itemId, type } = req.query as {
                startDate?: string;
                endDate?: string;
                itemId?: string;
                type?: string;
            };

            const transactions = await InventoryService.getAllTransactions({
                startDate,
                endDate,
                itemId,
                transactionType: type,
            });

            res.status(200).json({
                status: 'success',
                data: transactions,
            });
        } catch (error) {
            next(error);
        }
    }

    /**
     * POST /api/inventory/bulk-import
     * Bulk import inventory items from CSV
     */
    static async bulkImportCSV(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.file) {
                throw new AppError(400, 'No CSV file uploaded');
            }

            const result = await InventoryService.bulkImportFromCSV(req.file.buffer);

            logger.info(`Bulk imported ${result.imported} items`);

            res.status(200).json({
                status: 'success',
                message: 'Bulk import completed',
                data: result,
            });
        } catch (error) {
            next(error);
        }
    }
}
