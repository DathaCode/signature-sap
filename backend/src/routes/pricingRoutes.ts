import { Router } from 'express';
import {
    getPricingMatrix,
    calculateItemPrice,
    updatePricingMatrix,
} from '../controllers/pricing.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public route (or customer route) - Calculate price
router.post('/calculate', authenticateToken, calculateItemPrice);

// Customer-accessible route - View pricing matrix
router.get('/:fabricGroup', authenticateToken, getPricingMatrix);

// Admin-only route - Update pricing
router.put('/:fabricGroup/:width/:drop', authenticateToken, requireAdmin, updatePricingMatrix);

export default router;
