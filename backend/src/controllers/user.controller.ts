import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

const createUserSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: z.string()
        .min(10, 'Password must be at least 10 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    phone: z.string().min(10, 'Phone must be at least 10 characters'),
    address: z.string().min(5, 'Address is required'),
    company: z.string().optional(),
});

const updateUserSchema = z.object({
    name: z.string().min(2).optional(),
    phone: z.string().min(10).optional(),
    address: z.string().min(5).optional(),
    company: z.string().optional(),
    isActive: z.boolean().optional(),
    isApproved: z.boolean().optional(),
});

const groupDiscountSchema = z.object({
    acmeda: z.number().min(0).max(100),
    tbs: z.number().min(0).max(100),
    motorised: z.number().min(0).max(100),
});

const discountsSchema = z.object({
    G1: groupDiscountSchema,
    G2: groupDiscountSchema,
    G3: groupDiscountSchema,
    G4: groupDiscountSchema,
});

/**
 * Create new customer account (admin only)
 */
export const createCustomer = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = createUserSchema.parse(req.body);

        // Check if email already exists
        const existing = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (existing) {
            throw new AppError(400, 'Email already registered');
        }

        // Hash password
        const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
        const hashedPassword = await bcrypt.hash(validatedData.password, bcryptRounds);

        const user = await prisma.user.create({
            data: {
                ...validatedData,
                password: hashedPassword,
                role: 'CUSTOMER',
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                address: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });

        logger.info(`Customer created: ${user.email} by ${authReq.user?.email}`);

        res.status(201).json({
            success: true,
            message: 'Customer created successfully',
            data: { user },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};

/**
 * Get all users (admin only)
 */
export const getAllUsers = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { role, isActive, search } = req.query;

        const users = await prisma.user.findMany({
            where: {
                ...(role && { role: role as any }),
                ...(isActive !== undefined && { isActive: isActive === 'true' }),
                ...(search && {
                    OR: [
                        { name: { contains: search as string, mode: 'insensitive' } },
                        { email: { contains: search as string, mode: 'insensitive' } },
                        { company: { contains: search as string, mode: 'insensitive' } },
                    ],
                }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                address: true,
                role: true,
                isActive: true,
                isApproved: true,
                createdAt: true,
                _count: {
                    select: { orders: true, quotes: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: { users, count: users.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user by ID (admin only)
 */
export const getUserById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.params.id as string },
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                address: true,
                role: true,
                isActive: true,
                isApproved: true,
                discounts: true,
                createdAt: true,
                updatedAt: true,
                orders: {
                    select: {
                        id: true,
                        orderNumber: true,
                        customerReference: true,
                        status: true,
                        total: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
                quotes: {
                    select: {
                        id: true,
                        quoteNumber: true,
                        customerReference: true,
                        total: true,
                        convertedToOrder: true,
                        createdAt: true,
                        expiresAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                },
            },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        res.json({
            success: true,
            data: { user },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update user (admin only)
 */
export const updateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = updateUserSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.params.id as string },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id as string },
            data: validatedData,
            select: {
                id: true,
                name: true,
                email: true,
                phone: true,
                company: true,
                address: true,
                role: true,
                isActive: true,
                isApproved: true,
                updatedAt: true,
            },
        });

        logger.info(`User updated: ${updated.email} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'User updated successfully',
            data: { user: updated },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};

/**
 * Set per-customer fabric discounts (admin only)
 */
export const setUserDiscounts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = discountsSchema.parse(req.body);

        const user = await prisma.user.findUnique({
            where: { id: req.params.id as string },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id as string },
            data: { discounts: validatedData },
            select: { id: true, name: true, discounts: true },
        });

        logger.info(`Discounts updated for user: ${user.email} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Discounts updated successfully',
            data: { discounts: updated.discounts },
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};

/**
 * Delete user permanently (admin only)
 * Blocked if user has any orders or quotes
 */
export const deleteUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        const user = await prisma.user.findUnique({
            where: { id: req.params.id as string },
            include: {
                _count: { select: { orders: true, quotes: true } },
            },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        if (user.role === 'ADMIN') {
            throw new AppError(400, 'Cannot delete admin users');
        }

        if (user._count.orders > 0 || user._count.quotes > 0) {
            throw new AppError(400, `Cannot delete user with existing orders or quotes. Deactivate the account instead.`);
        }

        await prisma.user.delete({ where: { id: req.params.id as string } });

        logger.info(`User deleted: ${user.email} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'User deleted successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Deactivate user (admin only - soft delete)
 */
export const deactivateUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        const user = await prisma.user.findUnique({
            where: { id: req.params.id as string },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        if (user.role === 'ADMIN') {
            throw new AppError(400, 'Cannot deactivate admin users');
        }

        const updated = await prisma.user.update({
            where: { id: req.params.id as string },
            data: { isActive: false },
        });

        logger.info(`User deactivated: ${updated.email} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'User deactivated successfully',
            data: { user: updated },
        });
    } catch (error) {
        next(error);
    }
};
