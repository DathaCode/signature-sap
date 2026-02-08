import { Router } from 'express';
import {
    register,
    login,
    logout,
    getCurrentUser,
    refreshToken,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (require authentication)
router.post('/logout', authenticateToken, logout);
router.get('/me', authenticateToken, getCurrentUser);
router.post('/refresh', authenticateToken, refreshToken);

export default router;
