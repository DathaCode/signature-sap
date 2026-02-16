// Mock Prisma before imports
const mockFindFirst = jest.fn();
const mockFindUnique = jest.fn();

jest.mock('@prisma/client', () => {
    const mockPrismaClient = {
        inventoryItem: {
            findFirst: mockFindFirst,
            findUnique: mockFindUnique,
        },
        pricingMatrix: {
            findUnique: jest.fn(),
            findFirst: jest.fn(),
        },
    };
    return { PrismaClient: jest.fn(() => mockPrismaClient) };
});

jest.mock('../../config/logger', () => ({
    logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../middleware/errorHandler', () => ({
    AppError: class AppError extends Error {
        statusCode: number;
        constructor(statusCode: number, message: string) {
            super(message);
            this.statusCode = statusCode;
        }
    },
}));

// Mock the pricing service dependency
jest.mock('../pricing.service', () => ({
    __esModule: true,
    default: {
        calculatePrice: jest.fn().mockResolvedValue({
            basePrice: 100,
            discountPercent: 0,
            discountAmount: 0,
            finalPrice: 100,
            fabricGroup: 2,
            roundedWidth: 1000,
            roundedDrop: 1200,
        }),
    },
}));

import { ComprehensivePricingService } from '../comprehensivePricing.service';

describe('ComprehensivePricingService', () => {
    let service: ComprehensivePricingService;

    beforeEach(() => {
        service = new ComprehensivePricingService();
        jest.clearAllMocks();

        // Default: return a component with price $10 for any lookup
        mockFindFirst.mockResolvedValue({ price: '10.00' });
    });

    describe('Chain length selection', () => {
        // Access private method via prototype for testing
        const getChainLength = (ComprehensivePricingService.prototype as any).getChainLength;

        it('should return 500mm for drop <= 850mm', () => {
            expect(getChainLength(500)).toBe(500);
            expect(getChainLength(850)).toBe(500);
        });

        it('should return 750mm for drop 851-1100mm', () => {
            expect(getChainLength(851)).toBe(750);
            expect(getChainLength(1100)).toBe(750);
        });

        it('should return 1000mm for drop 1101-1600mm', () => {
            expect(getChainLength(1101)).toBe(1000);
            expect(getChainLength(1600)).toBe(1000);
        });

        it('should return 1200mm for drop 1601-2200mm', () => {
            expect(getChainLength(1601)).toBe(1200);
            expect(getChainLength(2200)).toBe(1200);
        });

        it('should return 1500mm for drop > 2200mm', () => {
            expect(getChainLength(2201)).toBe(1500);
            expect(getChainLength(4000)).toBe(1500);
        });
    });

    describe('isWinder', () => {
        const isWinder = (ComprehensivePricingService.prototype as any).isWinder;

        it('should return true for winder motors', () => {
            expect(isWinder('TBS winder-32mm')).toBe(true);
            expect(isWinder('Acmeda winder-29mm')).toBe(true);
        });

        it('should return false for non-winder motors', () => {
            expect(isWinder('Automate 1.1NM Li-Ion Quiet Motor')).toBe(false);
            expect(isWinder('Alpha 1NM Battery Motor')).toBe(false);
            expect(isWinder('Alpha AC 5NM Motor')).toBe(false);
        });
    });

    describe('needsIdlerClutch', () => {
        // needsIdlerClutch calls this.isWinder() so we need to bind it to a service instance
        let needsIdlerClutch: (chainOrMotor: string, bracketType: string) => boolean;

        beforeEach(() => {
            needsIdlerClutch = (service as any).needsIdlerClutch.bind(service);
        });

        it('should return true for all Automate/Alpha motors', () => {
            expect(needsIdlerClutch('Automate 1.1NM Li-Ion Quiet Motor', 'Single')).toBe(true);
            expect(needsIdlerClutch('Alpha 1NM Battery Motor', 'Single')).toBe(true);
        });

        it('should return true for Acmeda winder', () => {
            expect(needsIdlerClutch('Acmeda winder-29mm', 'Single')).toBe(true);
        });

        it('should return false for TBS winder with Single bracket', () => {
            expect(needsIdlerClutch('TBS winder-32mm', 'Single')).toBe(false);
        });

        it('should return true for TBS winder with Dual bracket', () => {
            expect(needsIdlerClutch('TBS winder-32mm', 'Dual Left')).toBe(true);
            expect(needsIdlerClutch('TBS winder-32mm', 'Dual Right')).toBe(true);
        });
    });

    describe('getBracketName', () => {
        const getBracketName = (ComprehensivePricingService.prototype as any).getBracketName;

        it('should use TBS brand for TBS winder', () => {
            const name = getBracketName('TBS winder-32mm', 'Single', 'White');
            expect(name).toBe('TBS Single Bracket set - White');
        });

        it('should use Acmeda brand for other motors', () => {
            const name = getBracketName('Automate 1.1NM Li-Ion Quiet Motor', 'Single', 'White');
            expect(name).toBe('Acmeda Single Bracket set - White');
        });

        it('should handle Extended bracket type', () => {
            const name = getBracketName('Acmeda winder-29mm', 'Single Extension', 'Black');
            expect(name).toBe('Acmeda Extended Bracket set - Black');
        });

        it('should handle Dual bracket types', () => {
            const nameLeft = getBracketName('Acmeda winder-29mm', 'Dual Left', 'White');
            expect(nameLeft).toBe('Acmeda Duel Bracket set Left - White');

            const nameRight = getBracketName('Acmeda winder-29mm', 'Dual Right', 'White');
            expect(nameRight).toBe('Acmeda Duel Bracket set Right - White');
        });

        it('should throw for TBS + Extended bracket', () => {
            expect(() => {
                getBracketName('TBS winder-32mm', 'Single Extension', 'White');
            }).toThrow('Extended bracket set is not available with TBS');
        });

        it('should throw for invalid bracket type', () => {
            expect(() => {
                getBracketName('Acmeda winder-29mm', 'InvalidType', 'White');
            }).toThrow('Invalid bracket type');
        });
    });

    describe('calculateBlindPrice', () => {
        it('should calculate total with all 7 components for a winder', async () => {
            // All component lookups return $10
            mockFindFirst.mockResolvedValue({ price: '10.00' });

            const result = await service.calculateBlindPrice({
                width: 1000,
                drop: 1200,
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                fabricColour: 'White',
                chainOrMotor: 'Acmeda winder-29mm',
                chainType: 'Stainless Steel',
                bracketType: 'Single',
                bracketColour: 'White',
                bottomRailType: 'D30',
                bottomRailColour: 'Anodised',
            });

            // Fabric: $75 (mocked PricingService returns finalPrice=75)
            // Motor: $10
            // Bracket: $10
            // Chain: $10 (winder needs chain)
            // Clips: $10 + $10 = $20 (left + right)
            // Idler+Clutch: $10 + $10 = $20 (Acmeda winder needs it)
            // Stop bolt + Safety lock: $10 + $10 = $20 (winder)
            // Total: 100 + 10 + 10 + 10 + 20 + 20 + 20 = 190
            expect(result.totalPrice).toBe(190);
            expect(result.fabricPrice).toBe(100);
            expect(result.motorChainPrice).toBe(10);
            expect(result.bracketPrice).toBe(10);
            expect(result.chainPrice).toBe(10);
            expect(result.clipsPrice).toBe(20);
            expect(result.idlerClutchPrice).toBe(20);
            expect(result.stopBoltSafetyLockPrice).toBe(20);
            expect(result.fabricGroup).toBe(2);
            expect(result.discountPercent).toBe(0);
        });

        it('should not include chain/stopBolt for non-winder motor', async () => {
            mockFindFirst.mockResolvedValue({ price: '10.00' });

            const result = await service.calculateBlindPrice({
                width: 1000,
                drop: 1200,
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                fabricColour: 'White',
                chainOrMotor: 'Automate 1.1NM Li-Ion Quiet Motor',
                bracketType: 'Single',
                bracketColour: 'White',
                bottomRailType: 'D30',
                bottomRailColour: 'Anodised',
            });

            // No chain, no stop bolt/safety lock for motors
            expect(result.chainPrice).toBe(0);
            expect(result.stopBoltSafetyLockPrice).toBe(0);
            // But motors DO need idler/clutch
            expect(result.idlerClutchPrice).toBe(20);
        });

        it('should throw when winder has no chain type', async () => {
            mockFindFirst.mockResolvedValue({ price: '10.00' });

            await expect(
                service.calculateBlindPrice({
                    width: 1000,
                    drop: 1200,
                    material: 'Alpha',
                    fabricType: 'Avoca Block Out',
                    fabricColour: 'White',
                    chainOrMotor: 'TBS winder-32mm',
                    // chainType intentionally omitted
                    bracketType: 'Single',
                    bracketColour: 'White',
                    bottomRailType: 'D30',
                    bottomRailColour: 'Anodised',
                })
            ).rejects.toThrow('Chain type is required');
        });

        it('should return 0 for missing component in inventory', async () => {
            // Simulate some components not found
            mockFindFirst.mockResolvedValue(null);

            const result = await service.calculateBlindPrice({
                width: 1000,
                drop: 1200,
                material: 'Alpha',
                fabricType: 'Avoca Block Out',
                fabricColour: 'White',
                chainOrMotor: 'Automate 1.1NM Li-Ion Quiet Motor',
                bracketType: 'Single',
                bracketColour: 'White',
                bottomRailType: 'D30',
                bottomRailColour: 'Anodised',
            });

            // Components not found => $0 each
            expect(result.motorChainPrice).toBe(0);
            expect(result.bracketPrice).toBe(0);
            expect(result.clipsPrice).toBe(0);
        });
    });
});
