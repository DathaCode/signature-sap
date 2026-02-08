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

export default router;
