import { Router } from 'express';
import {
    getPricingMatrix,
    calculateItemPrice,
    updatePricingMatrix,
    calculateBlindPrice,
    getAllComponentPrices,
    updateComponentPrice,
} from '../controllers/pricing.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public route (or customer route) - Calculate fabric price only
router.post('/calculate', authenticateToken, calculateItemPrice);

// NEW: Calculate comprehensive blind price with all components
router.post('/calculate-blind', authenticateToken, calculateBlindPrice);

// Customer-accessible route - View pricing matrix
router.get('/:fabricGroup', authenticateToken, getPricingMatrix);

// Admin-only route - Update fabric pricing matrix
router.put('/:fabricGroup/:width/:drop', authenticateToken, requireAdmin, updatePricingMatrix);

// NEW: Get all component prices (admin only)
router.get('/components/all', authenticateToken, requireAdmin, getAllComponentPrices);

// NEW: Update component price (admin only)
router.patch('/component/:id', authenticateToken, requireAdmin, updateComponentPrice);

export default router;
