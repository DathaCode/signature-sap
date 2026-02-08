import { Request, Response, NextFunction } from 'express';
import { PrismaClient, OrderStatus } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import { z } from 'zod';
import pricingService from '../services/pricing.service';

const prisma = new PrismaClient();

// Validation schemas
const OrderItemSchema = z.object({
    location: z.string().min(1, 'Location is required'),
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
    fixing: z.string().optional(),
    bracketType: z.string().optional(),
    bracketColour: z.string().optional(),
    controlSide: z.enum(['Left', 'Right']).optional(),
    chainOrMotor: z.string().optional(),
    roll: z.enum(['Front', 'Back']).optional(),
    material: z.string().optional(),
    fabricType: z.string().optional(),
    fabricColour: z.string().optional(),
    bottomRailType: z.string().optional(),
    bottomRailColour: z.string().optional(),
});

const CreateOrderSchema = z.object({
    productType: z.enum(['BLINDS', 'CURTAINS', 'SHUTTERS']),
    orderDate: z.string().optional(),
    dateRequired: z.string().optional(),
    items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
    notes: z.string().optional(),
});

/**
 * Generate unique order number: SS-YYMMDD-XXXX
 */
async function generateOrderNumber(): Promise<string> {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // Count orders today
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const count = await prisma.order.count({
        where: {
            createdAt: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    });

    const sequence = (count + 1).toString().padStart(4, '0');
    return `SS-${dateStr}-${sequence}`;
}

/**
 * Create new order (customer)
 */
export const createOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const validatedData = CreateOrderSchema.parse(req.body);

        // Get user details
        const user = await prisma.user.findUnique({
            where: { id: authReq.user.id },
        });

        if (!user) {
            throw new AppError(404, 'User not found');
        }

        // Generate order number
        const orderNumber = await generateOrderNumber();

        // Calculate pricing for each item
        let subtotal = 0;
        const processedItems = [];

        for (let i = 0; i < validatedData.items.length; i++) {
            const item = validatedData.items[i];

            let price = 0;
            let fabricGroup: number | null = null;
            let discountPercent = 0;

            // Calculate price if material and fabric type provided
            if (item.material && item.fabricType) {
                const priceResult = await pricingService.calculatePrice({
                    material: item.material,
                    fabricType: item.fabricType,
                    width: item.width,
                    drop: item.drop,
                });

                price = priceResult.finalPrice;
                fabricGroup = priceResult.fabricGroup;
                discountPercent = priceResult.discountPercent;
            }

            processedItems.push({
                itemNumber: i + 1,
                ...item,
                calculatedWidth: item.width - 28,
                calculatedDrop: item.drop + 150,
                fabricGroup,
                discountPercent,
                price,
            });

            subtotal += price;
        }

        // Create order with items
        const order = await prisma.order.create({
            data: {
                orderNumber,
                userId: user.id,
                productType: validatedData.productType,
                orderDate: validatedData.orderDate ? new Date(validatedData.orderDate) : new Date(),
                dateRequired: validatedData.dateRequired ? new Date(validatedData.dateRequired) : null,
                customerName: user.name,
                customerEmail: user.email,
                customerPhone: user.phone,
                customerCompany: user.company || null,
                status: OrderStatus.PENDING,
                subtotal,
                total: subtotal,
                notes: validatedData.notes || null,
                fileSource: 'WEB_FORM',
                items: {
                    create: processedItems,
                },
            },
            include: {
                items: true,
            },
        });

        logger.info(`Order created: ${orderNumber} by ${user.email}`);

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: { order },
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
 * Get user's orders (customer)
 */
export const getMyOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const { status, productType } = req.query;

        const orders = await prisma.order.findMany({
            where: {
                userId: authReq.user.id,
                ...(status && { status: status as OrderStatus }),
                ...(productType && { productType: productType as any }),
            },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: { orders, count: orders.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get single order by ID (customer or admin)
 */
export const getOrderById = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        company: true,
                    },
                },
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        // Check authorization
        if (authReq.user.role !== 'ADMIN' && order.userId !== authReq.user.id) {
            throw new AppError(403, 'Access denied');
        }

        res.json({
            success: true,
            data: { order },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Cancel order (customer - only PENDING orders)
 */
export const cancelOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        if (!authReq.user) {
            throw new AppError(401, 'Authentication required');
        }

        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        // Check authorization
        if (order.userId !== authReq.user.id) {
            throw new AppError(403, 'Access denied');
        }

        // Only allow cancelling PENDING orders
        if (order.status !== OrderStatus.PENDING) {
            throw new AppError(400, 'Only pending orders can be cancelled');
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id },
            data: { status: OrderStatus.CANCELLED },
        });

        logger.info(`Order cancelled: ${order.orderNumber} by ${authReq.user.email}`);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            data: { order: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get all orders (admin)
 */
export const getAllOrders = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { status, productType, userId } = req.query;

        const orders = await prisma.order.findMany({
            where: {
                ...(status && { status: status as OrderStatus }),
                ...(productType && { productType: productType as any }),
                ...(userId && { userId: userId as string }),
            },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phone: true,
                        company: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({
            success: true,
            data: { orders, count: orders.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Approve order (admin - PENDING → CONFIRMED)
 */
export const approveOrder = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const { adminNotes } = req.body;

        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        if (order.status !== OrderStatus.PENDING) {
            throw new AppError(400, 'Only pending orders can be approved');
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id },
            data: {
                status: OrderStatus.CONFIRMED,
                confirmedAt: new Date(),
                confirmedBy: authReq.user?.email || 'unknown',
                adminNotes: adminNotes || null,
            },
            include: {
                items: true,
            },
        });

        logger.info(`Order approved: ${order.orderNumber} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Order approved successfully',
            data: { order: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Send order to production (admin - CONFIRMED → PRODUCTION)
 * This will integrate with existing worksheet generation
 */
export const sendToProduction = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;

        const order = await prisma.order.findUnique({
            where: { id: req.params.id },
            include: {
                items: true,
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        if (order.status !== OrderStatus.CONFIRMED) {
            throw new AppError(400, 'Only confirmed orders can be sent to production');
        }

        // TODO: Integrate with existing worksheet generation logic
        // This will be done in Phase 4 when we connect web orders to the existing worksheet system

        const updated = await prisma.order.update({
            where: { id: req.params.id },
            data: {
                status: OrderStatus.PRODUCTION,
            },
        });

        logger.info(`Order sent to production: ${order.orderNumber} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Order sent to production successfully',
            data: { order: updated },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update order status (admin)
 */
export const updateOrderStatus = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const { status } = req.body;

        if (!Object.values(OrderStatus).includes(status)) {
            throw new AppError(400, `Invalid status. Must be one of: ${Object.values(OrderStatus).join(', ')}`);
        }

        const updated = await prisma.order.update({
            where: { id: req.params.id },
            data: { status },
        });

        logger.info(`Order status updated: ${updated.orderNumber} → ${status} by ${authReq.user?.email}`);

        res.json({
            success: true,
            message: 'Order status updated successfully',
            data: { order: updated },
        });
    } catch (error) {
        next(error);
    }
};
