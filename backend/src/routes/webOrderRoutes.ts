import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
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

// Configure multer for bend drawing uploads
const bendDrawingDir = path.join(process.cwd(), 'uploads', 'bend-drawings');
if (!fs.existsSync(bendDrawingDir)) {
    fs.mkdirSync(bendDrawingDir, { recursive: true });
}

const bendDrawingUpload = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, bendDrawingDir),
        filename: (_, file, cb) => {
            const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
            const ext = path.extname(file.originalname);
            cb(null, `bend-${uniqueSuffix}${ext}`);
        },
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Admin-specific fixed routes (must come BEFORE /:id parameterised routes)
router.get('/admin/all', authenticateToken, requireAdminOrWarehouse, getAllOrders);
router.get('/admin/trash', authenticateToken, requireAdmin, getTrashOrders);

// File upload for bend drawings
router.post('/upload/bend-drawing', authenticateToken, bendDrawingUpload.single('file'), (req, res) => {
    if (!req.file) {
        res.status(400).json({ success: false, error: 'No file uploaded' });
        return;
    }
    const filePath = `/uploads/bend-drawings/${req.file.filename}`;
    res.json({ success: true, filePath });
});

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
