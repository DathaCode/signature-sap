import { PrismaClient } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

/**
 * Motor-specific width deduction mapping
 * Fabric cut width = Blind width - Motor deduction
 */
const MOTOR_DEDUCTIONS: Record<string, number> = {
    // Winders (28mm deduction)
    'TBS winder-32mm': 28,
    'Acmeda winder-29mm': 28,

    // Automate motors (29mm deduction)
    'Automate 1.1NM Li-Ion Quiet Motor': 29,
    'Automate 0.7NM Li-Ion Quiet Motor': 29,
    'Automate 2NM Li-Ion Quiet Motor': 29,
    'Automate 3NM Li-Ion Motor': 29,
    'Automate E6 6NM Motor': 29,

    // Alpha Battery motors (30mm deduction)
    'Alpha 1NM Battery Motor': 30,
    'Alpha 2NM Battery Motor': 30,
    'Alpha 3NM Battery Motor': 30,

    // Alpha AC motors (35mm deduction)
    'Alpha AC 5NM Motor': 35,
};

/**
 * Default deduction for tube cuts (always 28mm regardless of motor)
 */
const TUBE_CUT_DEDUCTION = 28;

export class WorksheetService {
    /**
     * Get width deduction based on motor type
     * For fabric cuts - motor-specific deduction
     * For tube cuts - always 28mm
     */
    private static getWidthDeduction(motorType: string, isTubeCut: boolean = false): number {
        if (isTubeCut) {
            return TUBE_CUT_DEDUCTION;
        }

        // Return motor-specific deduction or default to 28mm if motor not found
        return MOTOR_DEDUCTIONS[motorType] || 28;
    }
    /**
     * Get fabric cut worksheet data (all 13 columns including Fabric Cut Width)
     */
    static async getFabricCutWorksheet(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        return {
            orderId: order.id,
            customerName: order.customerName,
            orderDate: order.orderDate,
            type: 'fabric_cut',
            columns: [
                'Blind Number',
                'Location',
                'Width (mm)',
                'Drop (mm)',
                'Control Side',
                'Control Colour',
                'Chain/Motor',
                'Roll',
                'Fabric',
                'Colour',
                'Bottom Rail Type',
                'Bottom Rail Colour',
                'Fabric Cut Width (mm)', // NEW: 13th column
            ],
            items: order.items.map(item => {
                const blindWidth = item.calculatedWidth || item.width;
                const motorType = item.chainOrMotor || '';
                const motorDeduction = this.getWidthDeduction(motorType, false);
                const fabricCutWidth = blindWidth - motorDeduction;

                return {
                    blindNumber: item.itemNumber.toString(),
                    location: item.location,
                    widthMm: blindWidth,
                    dropMm: item.calculatedDrop || item.drop,
                    controlSide: item.controlSide || '-',
                    controlColor: '-', // Not currently captured in OrderItem? Adding placeholder
                    chainOrMotor: (item.chainOrMotor || '-').replace(/_/g, ' '),
                    rollType: item.roll || '-',
                    fabricType: item.fabricType || '-',
                    fabricColor: item.fabricColour || '-',
                    bottomRailType: item.bottomRailType || '-',
                    bottomRailColor: item.bottomRailColour || '-',
                    fabricCutWidthMm: fabricCutWidth, // NEW: Calculated with motor-specific deduction
                    highlightFlag: item.isDuplicate,
                };
            }),
        };
    }

    /**
     * Get tube cut worksheet data (5 columns: Blind Number, Location, Width, Bottom Rail Type, Bottom Rail Colour)
     * Tube cut width = Blind width - 28mm (always, regardless of motor type)
     */
    static async getTubeCutWorksheet(orderId: string) {
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    orderBy: { itemNumber: 'asc' },
                },
            },
        });

        if (!order) {
            throw new AppError(404, 'Order not found');
        }

        return {
            orderId: order.id,
            customerName: order.customerName,
            orderDate: order.orderDate,
            type: 'tube_cut',
            columns: [
                'Blind Number',
                'Location',
                'Width (mm)', // This is tube cut width (blind width - 28mm)
                'Bottom Rail Type',
                'Bottom Rail Colour',
            ],
            items: order.items.map(item => {
                const blindWidth = item.calculatedWidth || item.width;
                const motorType = item.chainOrMotor || '';
                const tubeCutWidth = blindWidth - this.getWidthDeduction(motorType, true); // Always 28mm for tube

                return {
                    blindNumber: item.itemNumber.toString(),
                    location: item.location,
                    widthMm: tubeCutWidth, // Tube cut width with 28mm deduction
                    bottomRailType: item.bottomRailType || '-',
                    bottomRailColor: item.bottomRailColour || '-',
                    highlightFlag: item.isDuplicate,
                };
            }),
        };
    }

    /**
     * Get both worksheets
     */
    static async getWorksheets(orderId: string) {
        const [fabricCut, tubeCut] = await Promise.all([
            this.getFabricCutWorksheet(orderId),
            this.getTubeCutWorksheet(orderId),
        ]);

        return {
            fabricCut,
            tubeCut,
        };
    }
}
