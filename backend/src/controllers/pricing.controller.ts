import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import pricingService from '../services/pricing.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const prisma = new PrismaClient();

// Validation schemas
const calculatePriceSchema = z.object({
    material: z.string().min(1, 'Material is required'),
    fabricType: z.string().min(1, 'Fabric type is required'),
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
});

const updatePriceSchema = z.object({
    price: z.number().positive('Price must be a positive number'),
});

/**
 * Get pricing matrix for a specific fabric group
 */
export const getPricingMatrix = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const fabricGroup = parseInt(req.params.fabricGroup);

        if (isNaN(fabricGroup) || fabricGroup < 1 || fabricGroup > 5) {
            throw new AppError(400, 'Invalid fabric group. Must be 1-5');
        }

        const pricing = await pricingService.getPricingMatrixByGroup(fabricGroup);

        res.json({
            success: true,
            data: { pricing, fabricGroup },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Calculate price for a single item (used in real-time price calculation)
 */
export const calculateItemPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const validatedData = calculatePriceSchema.parse(req.body);

        const priceResult = await pricingService.calculatePrice({
            material: validatedData.material,
            fabricType: validatedData.fabricType,
            width: validatedData.width,
            drop: validatedData.drop,
        });

        res.json({
            success: true,
            data: priceResult,
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
 * Update pricing in the matrix (admin only)
 */
export const updatePricingMatrix = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const fabricGroup = parseInt(req.params.fabricGroup);
        const width = parseInt(req.params.width);
        const drop = parseInt(req.params.drop);

        if (isNaN(fabricGroup) || fabricGroup < 1 || fabricGroup > 5) {
            throw new AppError(400, 'Invalid fabric group. Must be 1-5');
        }

        if (isNaN(width) || width <= 0) {
            throw new AppError(400, 'Invalid width');
        }

        if (isNaN(drop) || drop <= 0) {
            throw new AppError(400, 'Invalid drop');
        }

        const validatedData = updatePriceSchema.parse(req.body);

        const updatedPrice = await pricingService.updatePrice(
            fabricGroup,
            width,
            drop,
            validatedData.price,
            authReq.user?.email || 'unknown'
        );

        res.json({
            success: true,
            message: 'Pricing updated successfully',
            data: updatedPrice,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};
