import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export type UserRole = 'CUSTOMER' | 'ADMIN' | 'WAREHOUSE';

// Extend Express Request to include user
export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: UserRole;
        name: string;
    };
}

// JWT Payload interface
interface JwtPayload {
    id: string;
    email: string;
    role: UserRole;
    name: string;
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticateToken = async (
    req: Request,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            throw new AppError(401, 'Access token required');
        }

        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new AppError(500, 'JWT_SECRET not configured');
        }

        // Verify token — pin algorithm to prevent confusion attacks
        const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;

        // Verify user still exists and is active in database
        const dbUser = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true, name: true, isActive: true, isApproved: true },
        });

        if (!dbUser) {
            throw new AppError(401, 'User no longer exists');
        }

        if (!dbUser.isActive) {
            throw new AppError(403, 'Account has been deactivated');
        }

        if (!dbUser.isApproved) {
            throw new AppError(403, 'Account is not approved');
        }

        // Attach fresh user data to request (not stale JWT data)
        (req as AuthRequest).user = {
            id: dbUser.id,
            email: dbUser.email,
            role: dbUser.role as UserRole,
            name: dbUser.name,
        };

        next();
    } catch (error) {
        if (error instanceof jwt.JsonWebTokenError) {
            next(new AppError(401, 'Invalid or expired token'));
        } else {
            next(error);
        }
    }
};

/**
 * Require specific role
 */
export const requireRole = (allowedRoles: UserRole[]) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
        const user = (req as AuthRequest).user;

        if (!user) {
            throw new AppError(401, 'Authentication required');
        }

        if (!allowedRoles.includes(user.role)) {
            throw new AppError(403, `Access denied. Required role: ${allowedRoles.join(' or ')}`);
        }

        next();
    };
};

/**
 * Require admin role
 */
export const requireAdmin = requireRole(['ADMIN']);

/**
 * Require admin or warehouse role
 */
export const requireAdminOrWarehouse = requireRole(['ADMIN', 'WAREHOUSE']);

/**
 * Generate JWT token
 */
export const generateToken = (user: {
    id: string;
    email: string;
    role: UserRole;
    name: string;
}): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new AppError(500, 'JWT_SECRET not configured');
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || '1h';

    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            role: user.role,
            name: user.name,
        },
        secret,
        { expiresIn: expiresIn as string, algorithm: 'HS256' } as jwt.SignOptions
    );
};
