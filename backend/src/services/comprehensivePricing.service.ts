import { PrismaClient } from '@prisma/client';
import { getFabricGroup } from '../data/fabrics';
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
    fabricPrice: number;
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
            // All non-fabric component prices are flat $1.00 each
            const COMPONENT_PRICE = 1.00;

            const breakdown: PriceBreakdown = {
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

            breakdown.fabricPrice = fabricResult.finalPrice;
            breakdown.fabricGroup = fabricResult.fabricGroup;
            breakdown.discountPercent = fabricResult.discountPercent;
            breakdown.componentsUsed.push(`Fabric: ${data.material} - ${data.fabricType} - ${data.fabricColour}`);

            // 2. MOTOR/CHAIN — $1
            breakdown.motorChainPrice = COMPONENT_PRICE;
            breakdown.componentsUsed.push(data.chainOrMotor);

            // 3. BRACKET — $1
            const bracketName = this.getBracketName(data.chainOrMotor, data.bracketType, data.bracketColour);
            breakdown.bracketPrice = COMPONENT_PRICE;
            breakdown.componentsUsed.push(bracketName);

            // 4. CHAIN (if winder selected) — $1
            if (this.isWinder(data.chainOrMotor)) {
                if (!data.chainType) {
                    throw new AppError(400, 'Chain type is required for winder motors');
                }
                const chainLength = this.getChainLength(data.drop);
                const chainName = `${data.chainType} Chain - ${chainLength}mm`;
                breakdown.chainPrice = COMPONENT_PRICE;
                breakdown.componentsUsed.push(chainName);
            }

            // 5. CLIPS (left + right = $1 each = $2 total)
            const clipLeftName = `Bottom bar Clips Left - ${data.bottomRailType} - ${data.bottomRailColour}`;
            const clipRightName = `Bottom bar Clips Right - ${data.bottomRailType} - ${data.bottomRailColour}`;
            breakdown.clipsPrice = COMPONENT_PRICE + COMPONENT_PRICE;
            breakdown.componentsUsed.push(clipLeftName, clipRightName);

            // 6. IDLER & CLUTCH (if applicable) — $1 each = $2
            if (this.needsIdlerClutch(data.chainOrMotor, data.bracketType)) {
                breakdown.idlerClutchPrice = COMPONENT_PRICE + COMPONENT_PRICE;
                breakdown.componentsUsed.push('Acmeda Idler', 'Acmeda Clutch');
            }

            // 7. STOP BOLT & SAFETY LOCK (if chain) — $1 each = $2
            if (this.isWinder(data.chainOrMotor)) {
                breakdown.stopBoltSafetyLockPrice = COMPONENT_PRICE + COMPONENT_PRICE;
                breakdown.componentsUsed.push('Stop bolt', 'Safety lock');
            }

            // Calculate total
            breakdown.totalPrice = parseFloat((
                breakdown.fabricPrice +
                breakdown.motorChainPrice +
                breakdown.bracketPrice +
                breakdown.chainPrice +
                breakdown.clipsPrice +
                breakdown.idlerClutchPrice +
                breakdown.stopBoltSafetyLockPrice
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
    private async getComponentPrice(componentName: string): Promise<number> {
        try {
            const item = await prisma.inventoryItem.findFirst({
                where: {
                    OR: [
                        // Try exact match first
                        { itemName: componentName },
                        // Try with category-based search
                        {
                            itemName: {
                                contains: componentName,
                                mode: 'insensitive',
                            },
                        },
                    ],
                },
            });

            if (!item) {
                logger.warn(`Component not found in inventory: ${componentName}, using $0.00`);
                return 0;
            }

            return parseFloat(item.price.toString());
        } catch (error) {
            logger.error(`Error fetching component price for "${componentName}": ${error}`);
            return 0;
        }
    }

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
