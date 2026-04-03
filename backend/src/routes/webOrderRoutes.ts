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
    updateAdminFields,
    resolveOrderId,
} from '../controllers/webOrder.controller';
import { authenticateToken, requireAdmin, requireAdminOrWarehouse } from '../middleware/auth';

const router = Router();

// Admin-specific fixed routes (must come BEFORE /:id parameterised routes)
router.get('/admin/all', authenticateToken, requireAdminOrWarehouse, getAllOrders);
router.get('/admin/trash', authenticateToken, requireAdmin, getTrashOrders);

// Customer routes (authentication required)
router.post('/create', authenticateToken, createOrder);
router.get('/my-orders', authenticateToken, getMyOrders);
router.get('/:id', authenticateToken, resolveOrderId, getOrderById);
router.delete('/:id', authenticateToken, resolveOrderId, cancelOrder);

// Admin order actions
router.patch('/:id/details', authenticateToken, requireAdmin, resolveOrderId, editOrderDetails);
router.patch('/:id/fabric-ordered', authenticateToken, requireAdmin, resolveOrderId, toggleFabricOrdered);
router.patch('/:id/admin-fields', authenticateToken, requireAdmin, resolveOrderId, updateAdminFields);
router.post('/:id/approve', authenticateToken, requireAdmin, resolveOrderId, approveOrder);
router.post('/:id/send-to-production', authenticateToken, requireAdmin, resolveOrderId, sendToProduction);
router.patch('/:id/status', authenticateToken, requireAdminOrWarehouse, resolveOrderId, updateOrderStatus);
router.delete('/:id/trash', authenticateToken, requireAdmin, resolveOrderId, trashOrder);
router.post('/:id/restore', authenticateToken, requireAdmin, resolveOrderId, restoreOrder);
router.delete('/:id/purge', authenticateToken, requireAdmin, resolveOrderId, purgeOrder);

// Worksheet routes (admin + warehouse)
router.get('/:id/worksheets/preview', authenticateToken, requireAdminOrWarehouse, resolveOrderId, getWorksheetPreview);
router.get('/:id/worksheets/preview-confirmed', authenticateToken, requireAdmin, resolveOrderId, previewWorksheets);
router.post('/:id/worksheets/accept', authenticateToken, requireAdmin, resolveOrderId, acceptWorksheets);
router.post('/:id/recalculate', authenticateToken, requireAdmin, resolveOrderId, recalculateWorksheets);
router.get('/:id/worksheets/download/:type', authenticateToken, requireAdminOrWarehouse, resolveOrderId, downloadWorksheet);

// Label download (admin + warehouse)
router.get('/:id/labels/download', authenticateToken, requireAdminOrWarehouse, resolveOrderId, downloadLabels);

export default router;
