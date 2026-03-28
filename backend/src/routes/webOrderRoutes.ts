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
    trashOrder,
    getTrashOrders,
    restoreOrder,
    purgeOrder,
    editOrderDetails,
    downloadLabels,
    previewWorksheets,
    toggleFabricOrdered,
} from '../controllers/webOrder.controller';
import { authenticateToken, requireAdmin, requireAdminOrWarehouse } from '../middleware/auth';

const router = Router();

// Admin-specific fixed routes (must come BEFORE /:id parameterised routes)
router.get('/admin/all', authenticateToken, requireAdminOrWarehouse, getAllOrders);
router.get('/admin/trash', authenticateToken, requireAdmin, getTrashOrders);

// Customer routes (authentication required)
router.post('/create', authenticateToken, createOrder);
router.get('/my-orders', authenticateToken, getMyOrders);
router.get('/:id', authenticateToken, getOrderById);
router.delete('/:id', authenticateToken, cancelOrder);

// Admin order actions
router.patch('/:id/details', authenticateToken, requireAdmin, editOrderDetails);
router.patch('/:id/fabric-ordered', authenticateToken, requireAdmin, toggleFabricOrdered);
router.post('/:id/approve', authenticateToken, requireAdmin, approveOrder);
router.post('/:id/send-to-production', authenticateToken, requireAdmin, sendToProduction);
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus);
router.delete('/:id/trash', authenticateToken, requireAdmin, trashOrder);
router.post('/:id/restore', authenticateToken, requireAdmin, restoreOrder);
router.delete('/:id/purge', authenticateToken, requireAdmin, purgeOrder);

// Worksheet routes (admin + warehouse)
router.get('/:id/worksheets/preview', authenticateToken, requireAdminOrWarehouse, getWorksheetPreview);
router.get('/:id/worksheets/preview-confirmed', authenticateToken, requireAdmin, previewWorksheets);
router.post('/:id/worksheets/accept', authenticateToken, requireAdmin, acceptWorksheets);
router.post('/:id/recalculate', authenticateToken, requireAdmin, recalculateWorksheets);
router.get('/:id/worksheets/download/:type', authenticateToken, requireAdminOrWarehouse, downloadWorksheet);

// Label download (admin + warehouse)
router.get('/:id/labels/download', authenticateToken, requireAdminOrWarehouse, downloadLabels);

export default router;
