import { PrismaClient } from '@prisma/client';

import { AppError } from '../middleware/errorHandler';
import { logger } from '../config/logger';
import PricingService from './pricing.service';

const prisma = new PrismaClient();

export interface BlindPricingData {
    // Dimensions
    width: number;
    drop: number;

    // Fabric
    material: string;
    fabricType: string;
    fabricColour: string;

    // Components
    chainOrMotor: string;
    chainType?: string; // Only for winders
    bracketType: string;
    bracketColour: string;
    bottomRailType: string;
    bottomRailColour: string;

    // Optional
    controlSide?: string;
}

export interface PriceBreakdown {
    fabricBasePrice: number;  // Before discount
    fabricPrice: number;      // After discount
    motorChainPrice: number;
    bracketPrice: number;
    chainPrice: number;
    clipsPrice: number;
    idlerClutchPrice: number;
    stopBoltSafetyLockPrice: number;
    totalPrice: number;

    // Metadata
    fabricGroup: number;
    discountPercent: number;
    componentsUsed: string[];
}

/**
 * Comprehensive Pricing Service
 * Calculates total blind price including all components
 */
export class ComprehensivePricingService {

    /**
     * Calculate complete blind price with all components
     */
    async calculateBlindPrice(data: BlindPricingData): Promise<PriceBreakdown> {
        try {
            const DEFAULT_COMPONENT_PRICE = 1.00;

            const breakdown: PriceBreakdown = {
                fabricBasePrice: 0,
                fabricPrice: 0,
                motorChainPrice: 0,
                bracketPrice: 0,
                chainPrice: 0,
                clipsPrice: 0,
                idlerClutchPrice: 0,
                stopBoltSafetyLockPrice: 0,
                totalPrice: 0,
                fabricGroup: 0,
                discountPercent: 0,
                componentsUsed: [],
            };

            // 1. FABRIC PRICE (from pricing matrix with group discount)
            const fabricResult = await PricingService.calculatePrice({
                material: data.material,
                fabricType: data.fabricType,
                width: data.width,
                drop: data.drop,
            });

            breakdown.fabricBasePrice = fabricResult.basePrice;
            breakdown.fabricPrice = fabricResult.finalPrice;
            breakdown.fabricGroup = fabricResult.fabricGroup;
            breakdown.discountPercent = fabricResult.discountPercent;
            breakdown.componentsUsed.push(`Fabric: ${data.material} - ${data.fabricType} - ${data.fabricColour}`);

            // 2. MOTOR/CHAIN — lookup from inventory (admin-configurable price)
            const motorItem = await prisma.inventoryItem.findFirst({
                where: { itemName: data.chainOrMotor },
                select: { price: true },
            });
            breakdown.motorChainPrice = motorItem && parseFloat(motorItem.price.toString()) > 0
                ? parseFloat(motorItem.price.toString())
                : DEFAULT_COMPONENT_PRICE;
            breakdown.componentsUsed.push(data.chainOrMotor);

            // 3. BRACKET — only charge for Extended/Dual; Single = $0
            //    Look up from inventory for admin-configurable pricing
            const isChargeableBracket = ['Single Extension', 'Dual Left', 'Dual Right'].includes(data.bracketType);
            const bracketName = this.getBracketName(data.chainOrMotor, data.bracketType, data.bracketColour);
            breakdown.componentsUsed.push(bracketName);
            if (isChargeableBracket) {
                const bracketItem = await prisma.inventoryItem.findFirst({
                    where: { itemName: bracketName },
                    select: { price: true },
                });
                breakdown.bracketPrice = bracketItem && parseFloat(bracketItem.price.toString()) > 0
                    ? parseFloat(bracketItem.price.toString())
                    : DEFAULT_COMPONENT_PRICE;
            }

            // 4. CHAIN (informational only — not charged)
            if (this.isWinder(data.chainOrMotor)) {
                if (!data.chainType) {
                    throw new AppError(400, 'Chain type is required for winder motors');
                }
                const chainLength = this.getChainLength(data.drop);
                const chainName = `${data.chainType} Chain - ${chainLength}mm`;
                breakdown.chainPrice = DEFAULT_COMPONENT_PRICE;
                breakdown.componentsUsed.push(chainName);
            }

            // 5. CLIPS (informational only — not charged)
            const clipLeftName = `Bottom bar Clips Left - ${data.bottomRailType} - ${data.bottomRailColour}`;
            const clipRightName = `Bottom bar Clips Right - ${data.bottomRailType} - ${data.bottomRailColour}`;
            breakdown.clipsPrice = DEFAULT_COMPONENT_PRICE + DEFAULT_COMPONENT_PRICE;
            breakdown.componentsUsed.push(clipLeftName, clipRightName);

            // 6. IDLER & CLUTCH (informational only — not charged)
            if (this.needsIdlerClutch(data.chainOrMotor, data.bracketType)) {
                breakdown.idlerClutchPrice = DEFAULT_COMPONENT_PRICE + DEFAULT_COMPONENT_PRICE;
                breakdown.componentsUsed.push('Acmeda Idler', 'Acmeda Clutch');
            }

            // 7. STOP BOLT & SAFETY LOCK (informational only — not charged)
            if (this.isWinder(data.chainOrMotor)) {
                breakdown.stopBoltSafetyLockPrice = DEFAULT_COMPONENT_PRICE + DEFAULT_COMPONENT_PRICE;
                breakdown.componentsUsed.push('Stop bolt', 'Safety lock');
            }

            // Total: ONLY fabric + motor + bracket (chain/clips/accessories not billed)
            breakdown.totalPrice = parseFloat((
                breakdown.fabricPrice +
                breakdown.motorChainPrice +
                breakdown.bracketPrice
            ).toFixed(2));

            logger.info(`Comprehensive price calculated: $${breakdown.totalPrice} (${breakdown.componentsUsed.length} components)`);
            return breakdown;

        } catch (error) {
            logger.error(`Comprehensive pricing error: ${error}`);
            throw error;
        }
    }

    /**
     * Get component price from inventory (returns 0 if not found)
     */


    /**
     * Get bracket name based on motor type and selections
     */
    private getBracketName(chainOrMotor: string, bracketType: string, bracketColour: string): string {
        // Determine brand based on motor type
        let brand = 'Acmeda'; // Default for motors

        if (chainOrMotor === 'TBS winder-32mm') {
            brand = 'TBS';
        }

        // Validate TBS + Extended bracket combination
        if (brand === 'TBS' && bracketType === 'Single Extension') {
            throw new AppError(400, 'Extended bracket set is not available with TBS winder-32mm');
        }

        // Build bracket name
        let bracketName = `${brand} `;

        if (bracketType === 'Single') {
            bracketName += `Single Bracket set - ${bracketColour}`;
        } else if (bracketType === 'Single Extension') {
            bracketName += `Extended Bracket set - ${bracketColour}`;
        } else if (bracketType === 'Dual Left') {
            bracketName += `Duel Bracket set Left - ${bracketColour}`;
        } else if (bracketType === 'Dual Right') {
            bracketName += `Duel Bracket set Right - ${bracketColour}`;
        } else {
            throw new AppError(400, `Invalid bracket type: ${bracketType}`);
        }

        return bracketName;
    }

    /**
     * Determine chain length based on drop height
     */
    private getChainLength(drop: number): number {
        if (drop <= 850) return 500;
        if (drop <= 1100) return 750;
        if (drop <= 1600) return 1000;
        if (drop <= 2200) return 1200;
        return 1500; // drop > 2200mm (up to 4000mm)
    }

    /**
     * Check if motor is a winder (requires chain)
     */
    private isWinder(chainOrMotor: string): boolean {
        return chainOrMotor.includes('winder');
    }

    /**
     * Check if Idler & Clutch are needed
     */
    private needsIdlerClutch(chainOrMotor: string, bracketType: string): boolean {
        // All motors need Idler & Clutch (Automate and Alpha)
        if (!this.isWinder(chainOrMotor)) {
            return true;
        }

        // Acmeda winder always needs Idler & Clutch
        if (chainOrMotor === 'Acmeda winder-29mm') {
            return true;
        }

        // TBS winder with Dual brackets needs separate Idler & Clutch
        if (chainOrMotor === 'TBS winder-32mm') {
            if (bracketType === 'Dual Left' || bracketType === 'Dual Right') {
                return true;
            }
            // TBS Single bracket includes Idler & Clutch
            return false;
        }

        return false;
    }

    /**
     * Get all available component prices for admin management
     */
    async getAllComponentPrices(category?: string) {
        const where: any = {};

        if (category) {
            where.category = category;
        }

        const items = await prisma.inventoryItem.findMany({
            where,
            orderBy: [
                { category: 'asc' },
                { itemName: 'asc' },
            ],
            select: {
                id: true,
                category: true,
                itemName: true,
                colorVariant: true,
                price: true,
                unitType: true,
            },
        });

        return items.map(item => ({
            id: item.id,
            category: item.category,
            name: item.itemName,
            variant: item.colorVariant,
            price: parseFloat(item.price.toString()),
            unit: item.unitType,
        }));
    }

    /**
     * Update component price (admin only)
     */
    async updateComponentPrice(itemId: string, price: number, updatedBy: string) {
        const item = await prisma.inventoryItem.findUnique({
            where: { id: itemId },
        });

        if (!item) {
            throw new AppError(404, 'Component not found');
        }

        const updated = await prisma.inventoryItem.update({
            where: { id: itemId },
            data: { price },
        });

        logger.info(`Component price updated: ${item.itemName} = $${price} by ${updatedBy}`);

        return {
            id: updated.id,
            name: updated.itemName,
            price: parseFloat(updated.price.toString()),
        };
    }
}

export default new ComprehensivePricingService();
