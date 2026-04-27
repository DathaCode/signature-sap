import { Router } from 'express';
import {
    getPricingMatrix,
    calculateItemPrice,
    updatePricingMatrix,
    calculateBlindPrice,
    getAllComponentPrices,
    updateComponentPrice,
    calculateCurtainPrice,
    getSheerFabricPricing,
    updateSheerFabricPricing,
    getAllSheerFabrics,
    addSheerFabric,
    deleteSheerFabric,
    getSheerGroupSettings,
    updateSheerGroupSettings,
} from '../controllers/pricing.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public route (or customer route) - Calculate fabric price only
router.post('/calculate', authenticateToken, calculateItemPrice);

// Calculate comprehensive blind price with all components
router.post('/calculate-blind', authenticateToken, calculateBlindPrice);

// Calculate sheer curtain price with all components
router.post('/calculate-curtain', authenticateToken, calculateCurtainPrice);

// Get all component prices (admin only) — must come BEFORE /:fabricGroup
router.get('/components/all', authenticateToken, requireAdmin, getAllComponentPrices);

// Update component price (admin only)
router.patch('/component/:id', authenticateToken, requireAdmin, updateComponentPrice);

// Sheer fabric — list all (any authenticated user, used by curtain order form)
router.get('/sheer-fabrics/all', authenticateToken, getAllSheerFabrics);

// Sheer fabric pricing (admin only) — must come BEFORE /:fabricGroup
router.get('/sheer-fabric/:group', authenticateToken, requireAdmin, getSheerFabricPricing);
router.post('/sheer-fabric/:group', authenticateToken, requireAdmin, addSheerFabric);
router.put('/sheer-fabric/:group/:fabricName', authenticateToken, requireAdmin, updateSheerFabricPricing);
router.delete('/sheer-fabric/:group/:fabricName', authenticateToken, requireAdmin, deleteSheerFabric);

// Sheer group settings (drop surcharge per group)
router.get('/sheer-group-settings', authenticateToken, requireAdmin, getSheerGroupSettings);
router.put('/sheer-group-settings/:group', authenticateToken, requireAdmin, updateSheerGroupSettings);

// View pricing matrix — supports groups 1-5
router.get('/:fabricGroup', authenticateToken, getPricingMatrix);

// Admin-only route - Update fabric pricing matrix cell
router.put('/:fabricGroup/:width/:drop', authenticateToken, requireAdmin, updatePricingMatrix);

export default router;
