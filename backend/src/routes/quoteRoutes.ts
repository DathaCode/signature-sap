import { Router } from 'express';
import {
    createQuote,
    getMyQuotes,
    getQuoteById,
    convertQuoteToOrder,
    deleteQuote,
} from '../controllers/quote.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All quote routes require authentication
// Quotes are customer-facing - no admin-only routes

/**
 * POST /api/quotes/create
 * Save order details as a quote (instead of submitting as order)
 */
router.post('/create', authenticateToken, createQuote);

/**
 * GET /api/quotes/my-quotes
 * Get all quotes for the logged-in user
 */
router.get('/my-quotes', authenticateToken, getMyQuotes);

/**
 * GET /api/quotes/:id
 * Get single quote by ID
 */
router.get('/:id', authenticateToken, getQuoteById);

/**
 * POST /api/quotes/:id/convert-to-order
 * Convert a quote to an order
 */
router.post('/:id/convert-to-order', authenticateToken, convertQuoteToOrder);

/**
 * DELETE /api/quotes/:id
 * Delete a quote
 */
router.delete('/:id', authenticateToken, deleteQuote);

export default router;
