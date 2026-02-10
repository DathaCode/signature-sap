/**
 * Width Deduction Utilities
 * 
 * Motor-specific fabric cut width deductions per UPGRADE.md spec:
 * - Winders (Acmeda/TBS): width - 28mm
 * - Automate motors: width - 29mm
 * - Alpha Battery motors: width - 30mm
 * - Alpha AC motors: width - 35mm
 * - Tube cut: always width - 28mm
 */

// Motor categories with their respective deductions
const MOTOR_DEDUCTIONS: Record<string, number> = {
    // Winders - 28mm
    'Acmeda winder-29mm': 28,
    'TBS winder-32mm': 28,

    // Automate motors - 29mm
    'Automate 1.1NM Li-Ion Quiet Motor': 29,
    'Automate 0.7NM Li-Ion Quiet Motor': 29,
    'Automate 2NM Li-Ion Motor': 29,
    'Automate 3NM Li-Ion Motor': 29,

    // Alpha Battery motors - 30mm
    'Alpha 1NM Battery Motor': 30,
    'Alpha 2NM Battery Motor': 30,

    // Alpha AC motors - 35mm
    'Alpha AC 3NM Motor': 35,
    'Alpha AC 5NM Motor': 35,
};

// Default deduction if motor not found
const DEFAULT_FABRIC_DEDUCTION = 28;
const TUBE_DEDUCTION = 28;

/**
 * Get fabric cut width deduction for a motor type
 */
export function getFabricCutDeduction(motorType: string): number {
    return MOTOR_DEDUCTIONS[motorType] || DEFAULT_FABRIC_DEDUCTION;
}

/**
 * Calculate fabric cut width
 */
export function calculateFabricCutWidth(width: number, motorType: string): number {
    const deduction = getFabricCutDeduction(motorType);
    return width - deduction;
}

/**
 * Calculate tube cut width (always width - 28mm)
 */
export function calculateTubeCutWidth(width: number): number {
    return width - TUBE_DEDUCTION;
}

/**
 * Calculate drop with standard addition (drop + 150mm)
 */
export function calculateDrop(drop: number): number {
    return drop + 150;
}

/**
 * Get all width deductions for an item
 */
export function getWidthDeductions(width: number, motorType: string) {
    return {
        fabricCutWidth: calculateFabricCutWidth(width, motorType),
        tubeCutWidth: calculateTubeCutWidth(width),
        fabricDeduction: getFabricCutDeduction(motorType),
        tubeDeduction: TUBE_DEDUCTION,
    };
}
