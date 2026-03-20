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

// Calculate comprehensive blind price with all components
router.post('/calculate-blind', authenticateToken, calculateBlindPrice);

// Get all component prices (admin only) — must come BEFORE /:fabricGroup
router.get('/components/all', authenticateToken, requireAdmin, getAllComponentPrices);

// Update component price (admin only)
router.patch('/component/:id', authenticateToken, requireAdmin, updateComponentPrice);

// View pricing matrix — supports groups 1-5
router.get('/:fabricGroup', authenticateToken, getPricingMatrix);

// Admin-only route - Update fabric pricing matrix cell
router.put('/:fabricGroup/:width/:drop', authenticateToken, requireAdmin, updatePricingMatrix);

export default router;
