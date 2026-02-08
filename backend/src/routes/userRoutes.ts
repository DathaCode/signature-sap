import { Router } from 'express';
import {
    createCustomer,
    getAllUsers,
    getUserById,
    updateUser,
    deactivateUser,
} from '../controllers/user.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// All user management routes require admin authentication
router.post('/', authenticateToken, requireAdmin, createCustomer);
router.get('/', authenticateToken, requireAdmin, getAllUsers);
router.get('/:id', authenticateToken, requireAdmin, getUserById);
router.patch('/:id', authenticateToken, requireAdmin, updateUser);
router.delete('/:id', authenticateToken, requireAdmin, deactivateUser);

export default router;
