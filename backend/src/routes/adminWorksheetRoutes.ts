import { Router } from 'express';
import { AdminWorksheetController } from '../controllers/adminWorksheet.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

/**
 * Admin Worksheet Routes
 * All routes require authentication and admin role
 */

// Get worksheets for an order
router.get('/:orderId', authenticateToken, requireAdmin, AdminWorksheetController.getWorksheets);

// Download worksheet (CSV or PDF)
router.get('/:orderId/download', authenticateToken, requireAdmin, AdminWorksheetController.downloadWorksheet);

// Generate optimized worksheet (MaxRects algorithm)
router.post('/:orderId/generate', authenticateToken, requireAdmin, AdminWorksheetController.generateWorksheet);

// Recalculate optimization
router.post('/:orderId/recalculate', authenticateToken, requireAdmin, AdminWorksheetController.recalculateOptimization);

// Get stored optimization results
router.get('/:orderId/optimization', authenticateToken, requireAdmin, AdminWorksheetController.getOptimizationResults);

export default router;
