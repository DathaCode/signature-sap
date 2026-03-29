import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { generateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
// Strong password policy for production
const passwordSchema = z.string()
    .min(10, 'Password must be at least 10 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const registerSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Invalid email address'),
    password: passwordSchema,
    phone: z.string().min(10, 'Phone must be at least 10 digits'),
    address: z.string().min(5, 'Address is required'),
    company: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
});

/**
 * Register new customer
 */
export const register = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Validate request body
        const validatedData = registerSchema.parse(req.body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (existingUser) {
            throw new AppError(400, 'Email already registered');
        }

        // Hash password
        const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
        const hashedPassword = await bcrypt.hash(validatedData.password, bcryptRounds);

        // Create user — isApproved: false until admin approves
        const user = await prisma.user.create({
            data: {
                name: validatedData.name,
                email: validatedData.email,
                password: hashedPassword,
                phone: validatedData.phone,
                address: validatedData.address,
                company: validatedData.company || null,
                role: 'CUSTOMER',
                isActive: true,
                isApproved: false,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                company: true,
                address: true,
                createdAt: true,
            },
        });

        logger.info(`New user registered (pending approval): ${user.email}`);

        // Do NOT issue a token — account requires admin approval first
        res.status(201).json({
            success: true,
            pendingApproval: true,
            message: 'Registration successful. Your account is pending admin approval.',
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
 * Login existing user
 */
export const login = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        // Validate request body
        const validatedData = loginSchema.parse(req.body);

        // Find user
        const user = await prisma.user.findUnique({
            where: { email: validatedData.email },
        });

        if (!user) {
            throw new AppError(401, 'Invalid email or password');
        }

        // Check if account is locked
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
            throw new AppError(423, `Account is locked. Try again in ${minutesLeft} minute(s).`);
        }

        // Check if account is active
        if (!user.isActive) {
            throw new AppError(403, 'Account has been deactivated. Please contact admin.');
        }

        // Check if account has been approved by admin
        if (!user.isApproved) {
            throw new AppError(403, 'Your account is awaiting admin approval. Please check back later.');
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(validatedData.password, user.password);

        if (!isPasswordValid) {
            // Increment failed attempts, lock after 5 failures
            const attempts = (user.failedLoginAttempts || 0) + 1;
            const lockData: any = { failedLoginAttempts: attempts };
            if (attempts >= 5) {
                lockData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lockout
                logger.warn(`Account locked after ${attempts} failed attempts: ${user.email}`);
            }
            await prisma.user.update({ where: { id: user.id }, data: lockData });
            throw new AppError(401, 'Invalid email or password');
        }

        // Reset failed attempts on successful login
        if (user.failedLoginAttempts > 0) {
            await prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: 0, lockedUntil: null },
            });
        }

        // Generate JWT token
        const token = generateToken({
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        });

        logger.info(`User logged in: ${user.email}`);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    phone: user.phone,
                    company: user.company,
                    address: user.address,
                },
                token,
            },
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
 * Get current authenticated user
 */
export const getCurrentUser = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            throw new AppError(401, 'Not authenticated');
        }

        // Fetch fresh user data
        const user = await prisma.user.findUnique({
            where: { id: authReq.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                phone: true,
                company: true,
                address: true,
                isActive: true,
                createdAt: true,
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
 * Logout (client-side token removal)
 */
export const logout = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        if (authReq.user) {
            logger.info(`User logged out: ${authReq.user.email}`);
        }

        res.json({
            success: true,
            message: 'Logged out successfully',
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Forgot Password – generates a reset token and logs the reset URL
 */
export const forgotPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { email } = z.object({ email: z.string().email() }).parse(req.body);

        const user = await prisma.user.findUnique({ where: { email } });

        // Generic response to prevent email enumeration
        if (!user) {
            res.json({ success: true, message: 'If that email is registered, a reset link has been generated.' });
            return;
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        await prisma.user.update({
            where: { id: user.id },
            data: {
                passwordResetToken: hashedToken,
                passwordResetExpires: expires,
            },
        });

        // Do NOT log the token/URL — sensitive data
        logger.info(`[PASSWORD RESET] Token generated for ${email}, expires in 1h`);
        // TODO: Send reset email via SES/SMTP with the token URL

        res.json({ success: true, message: 'If that email is registered, a reset link has been generated. Check with your administrator or system logs.' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};

/**
 * Reset Password – validates token and sets new password
 */
export const resetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { token, password } = z.object({
            token: z.string().min(1),
            password: passwordSchema,
        }).parse(req.body);

        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await prisma.user.findFirst({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: { gt: new Date() },
            },
        });

        if (!user) {
            throw new AppError(400, 'Invalid or expired reset token');
        }

        const bcryptRounds = parseInt(process.env.BCRYPT_ROUNDS || '10');
        const hashedPassword = await bcrypt.hash(password, bcryptRounds);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                passwordResetToken: null,
                passwordResetExpires: null,
            },
        });

        logger.info(`Password reset successful for ${user.email}`);
        res.json({ success: true, message: 'Password updated successfully. You can now sign in.' });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};

/**
 * Refresh token (optional - can implement token refresh logic if needed)
 */
export const refreshToken = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        if (!authReq.user) {
            throw new AppError(401, 'Not authenticated');
        }

        // Generate new token
        const newToken = generateToken({
            id: authReq.user.id,
            email: authReq.user.email,
            role: authReq.user.role,
            name: authReq.user.name,
        });

        res.json({
            success: true,
            data: { token: newToken },
        });
    } catch (error) {
        next(error);
    }
};
