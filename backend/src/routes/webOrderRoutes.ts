import { Router } from 'express';
import {
    createOrder,
    getMyOrders,
    getOrderById,
    cancelOrder,
    getAllOrders,
    approveOrder,
    sendToProduction,
    updateOrderStatus,
    getWorksheetPreview,
    acceptWorksheets,
    recalculateWorksheets,
    downloadWorksheet,
} from '../controllers/webOrder.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Customer routes (authentication required)
router.post('/create', authenticateToken, createOrder);
router.get('/my-orders', authenticateToken, getMyOrders);
router.get('/:id', authenticateToken, getOrderById);
router.delete('/:id', authenticateToken, cancelOrder);

// Admin routes (admin role required)
router.get('/admin/all', authenticateToken, requireAdmin, getAllOrders);
router.post('/:id/approve', authenticateToken, requireAdmin, approveOrder);
router.post('/:id/send-to-production', authenticateToken, requireAdmin, sendToProduction);
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus);

// Worksheet routes (admin)
router.get('/:id/worksheets/preview', authenticateToken, requireAdmin, getWorksheetPreview);
router.post('/:id/worksheets/accept', authenticateToken, requireAdmin, acceptWorksheets);
router.post('/:id/recalculate', authenticateToken, requireAdmin, recalculateWorksheets);
router.get('/:id/worksheets/download/:type', authenticateToken, requireAdmin, downloadWorksheet);

export default router;
