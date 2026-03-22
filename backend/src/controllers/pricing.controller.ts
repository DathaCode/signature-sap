import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import pricingService from '../services/pricing.service';
import comprehensivePricingService from '../services/comprehensivePricing.service';
import { AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const prisma = new PrismaClient();

/**
 * Determine supplier key from chainOrMotor string.
 * - 'tbs'       → TBS winder
 * - 'acmeda'    → Acmeda winder
 * - 'motorised' → all Automate / Alpha motors
 */
function getSupplierKey(chainOrMotor?: string): 'acmeda' | 'tbs' | 'motorised' {
    if (!chainOrMotor) return 'acmeda';
    const lower = chainOrMotor.toLowerCase();
    if (lower.includes('tbs')) return 'tbs';
    if (lower.includes('acmeda')) return 'acmeda';
    return 'motorised';
}

/**
 * Get customer discount for a fabric group + supplier from user's stored discounts
 */
async function getCustomerDiscount(
    userId: string | undefined,
    fabricGroup: number,
    chainOrMotor?: string
): Promise<number | null> {
    if (!userId) return null;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { discounts: true },
    });
    const discounts = user?.discounts as Record<string, { acmeda: number; tbs: number; motorised: number }> | null;
    if (!discounts) return null;
    const groupKey = `G${fabricGroup}`;
    const supplierKey = getSupplierKey(chainOrMotor);
    const val = discounts[groupKey]?.[supplierKey];
    return typeof val === 'number' ? val : null;
}



// Validation schemas
const calculatePriceSchema = z.object({
    material: z.string().min(1, 'Material is required'),
    fabricType: z.string().min(1, 'Fabric type is required'),
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
    chainOrMotor: z.string().optional(),
});

const updatePriceSchema = z.object({
    price: z.number().positive('Price must be a positive number'),
});

const calculateBlindPriceSchema = z.object({
    width: z.number().int().positive('Width must be a positive number'),
    drop: z.number().int().positive('Drop must be a positive number'),
    material: z.string().min(1, 'Material is required'),
    fabricType: z.string().min(1, 'Fabric type is required'),
    fabricColour: z.string().min(1, 'Fabric colour is required'),
    chainOrMotor: z.string().min(1, 'Chain or motor is required'),
    chainType: z.string().optional(),
    bracketType: z.string().min(1, 'Bracket type is required'),
    bracketColour: z.string().min(1, 'Bracket colour is required'),
    bottomRailType: z.string().min(1, 'Bottom rail type is required'),
    bottomRailColour: z.string().min(1, 'Bottom rail colour is required'),
    controlSide: z.string().optional(),
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
        const fabricGroup = parseInt(req.params.fabricGroup as string);

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
        const authReq = req as AuthRequest;
        const validatedData = calculatePriceSchema.parse(req.body);

        const priceResult = await pricingService.calculatePrice({
            material: validatedData.material,
            fabricType: validatedData.fabricType,
            width: validatedData.width,
            drop: validatedData.drop,
        });

        // Override discount with customer-specific discount if configured
        const customDiscount = await getCustomerDiscount(
            authReq.user?.id,
            priceResult.fabricGroup,
            validatedData.chainOrMotor
        );

        if (customDiscount !== null) {
            const discountAmount = parseFloat((priceResult.basePrice * customDiscount / 100).toFixed(2));
            priceResult.discountPercent = customDiscount;
            priceResult.discountAmount = discountAmount;
            priceResult.finalPrice = parseFloat((priceResult.basePrice - discountAmount).toFixed(2));
        }

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
        const fabricGroup = parseInt(req.params.fabricGroup as string);
        const width = parseInt(req.params.width as string);
        const drop = parseInt(req.params.drop as string);

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

/**
 * Calculate comprehensive blind price with all components
 */
export const calculateBlindPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const validatedData = calculateBlindPriceSchema.parse(req.body);

        const priceBreakdown = await comprehensivePricingService.calculateBlindPrice({
            width: validatedData.width,
            drop: validatedData.drop,
            material: validatedData.material,
            fabricType: validatedData.fabricType,
            fabricColour: validatedData.fabricColour,
            chainOrMotor: validatedData.chainOrMotor,
            chainType: validatedData.chainType,
            bracketType: validatedData.bracketType,
            bracketColour: validatedData.bracketColour,
            bottomRailType: validatedData.bottomRailType,
            bottomRailColour: validatedData.bottomRailColour,
            controlSide: validatedData.controlSide,
        });

        // Apply customer-specific discount override if configured
        const customDiscount = await getCustomerDiscount(
            authReq.user?.id,
            priceBreakdown.fabricGroup,
            validatedData.chainOrMotor
        );

        if (customDiscount !== null) {
            const newFabricPrice = parseFloat((priceBreakdown.fabricBasePrice * (1 - customDiscount / 100)).toFixed(2));
            priceBreakdown.discountPercent = customDiscount;
            priceBreakdown.fabricPrice = newFabricPrice;
            priceBreakdown.totalPrice = parseFloat((newFabricPrice + priceBreakdown.motorChainPrice + priceBreakdown.bracketPrice).toFixed(2));
        }

        res.json({
            success: true,
            data: priceBreakdown,
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
 * Get all component prices (for admin management)
 */
export const getAllComponentPrices = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const category = req.query.category as string | undefined;
        const components = await comprehensivePricingService.getAllComponentPrices(category);

        res.json({
            success: true,
            data: { components, total: components.length },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Update component price (admin only)
 */
export const updateComponentPrice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthRequest;
        const itemId = req.params.id as string;
        const validatedData = updatePriceSchema.parse(req.body);

        const updated = await comprehensivePricingService.updateComponentPrice(
            itemId,
            validatedData.price,
            authReq.user?.email || 'unknown'
        );

        res.json({
            success: true,
            message: 'Component price updated successfully',
            data: updated,
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            next(new AppError(400, error.errors[0].message));
        } else {
            next(error);
        }
    }
};
