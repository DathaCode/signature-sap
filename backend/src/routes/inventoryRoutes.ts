import { Router } from 'express';
import multer from 'multer';
import { InventoryController } from '../controllers/inventory.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Configure multer for CSV uploads
const csvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (_, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    },
});

// ============================================================================
// INVENTORY ROUTES (ALL REQUIRE ADMIN ACCESS)
// ============================================================================

/**
 * GET /api/inventory/alerts/low-stock
 * Get items below minimum stock threshold
 * NOTE: This must be before /:itemId to avoid route conflicts
 */
router.get('/alerts/low-stock', authenticateToken, requireAdmin, InventoryController.getLowStockItems);

/**
 * GET /api/inventory/transactions?startDate=...&endDate=...&itemId=...&type=...
 * Get all inventory transactions with filters
 */
router.get('/transactions', authenticateToken, requireAdmin, InventoryController.getAllTransactions);

/**
 * POST /api/inventory/bulk-import
 * Bulk import inventory items from CSV
 */
router.post('/bulk-import', authenticateToken, requireAdmin, csvUpload.single('file'), InventoryController.bulkImportCSV);

/**
 * GET /api/inventory?category=FABRIC&search=silver
 * Get all inventory items (with optional category filter and search)
 */
router.get('/', authenticateToken, requireAdmin, InventoryController.getInventoryItems);

/**
 * POST /api/inventory
 * Add new inventory item
 */
router.post('/', authenticateToken, requireAdmin, InventoryController.addInventoryItem);

/**
 * GET /api/inventory/:itemId
 * Get single inventory item with transaction history
 */
router.get('/:itemId', authenticateToken, requireAdmin, InventoryController.getInventoryItem);

/**
 * PUT /api/inventory/:itemId
 * Update inventory item details
 */
router.put('/:itemId', authenticateToken, requireAdmin, InventoryController.updateInventoryItem);

/**
 * DELETE /api/inventory/:itemId
 * Soft delete inventory item
 */
router.delete('/:itemId', authenticateToken, requireAdmin, InventoryController.deleteInventoryItem);

/**
 * POST /api/inventory/:itemId/adjust
 * Adjust inventory quantity
 */
router.post('/:itemId/adjust', authenticateToken, requireAdmin, InventoryController.adjustQuantity);

/**
 * GET /api/inventory/:itemId/transactions
 * Get transaction history for an item
 */
router.get('/:itemId/transactions', authenticateToken, requireAdmin, InventoryController.getTransactions);

export default router;
