import { Router } from 'express';
import {
    getFabricsFormatted,
    getFabricsAdmin,
    addFabricHandler,
    updateFabricHandler,
    deleteFabricHandler,
    deleteSupplierHandler,
} from '../controllers/blindFabric.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All authenticated users — used by the order form
router.get('/', authenticateToken, getFabricsFormatted);

// Admin routes
router.get('/admin', authenticateToken, requireAdmin, getFabricsAdmin);
router.post('/', authenticateToken, requireAdmin, addFabricHandler);
router.put('/:id', authenticateToken, requireAdmin, updateFabricHandler);
router.delete('/supplier/:supplier', authenticateToken, requireAdmin, deleteSupplierHandler);
router.delete('/:id', authenticateToken, requireAdmin, deleteFabricHandler);

export default router;
