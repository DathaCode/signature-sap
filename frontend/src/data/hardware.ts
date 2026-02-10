/**
 * Hardware dropdown data for BlindItemForm
 * Matches UPGRADE.md specifications and backend seed data
 */

// Motors & Winders (from backend seed)
export const MOTORS = [
    'Acmeda winder-29mm',
    'TBS winder-32mm',
    'Automate 1.1NM Li-Ion Quiet Motor',
    'Automate 0.7NM Li-Ion Quiet Motor',
    'Automate 2NM Li-Ion Motor',
    'Automate 3NM Li-Ion Motor',
    'Alpha 1NM Battery Motor',
    'Alpha 2NM Battery Motor',
    'Alpha AC 3NM Motor',
    'Alpha AC 5NM Motor',
];

// Winders that require chain type selection
export const WINDER_MOTORS = [
    'Acmeda winder-29mm',
    'TBS winder-32mm',
];

// Fixing types
export const FIXING_TYPES = ['Face', 'Recess'];

// Bracket types
export const BRACKET_TYPES = ['Single', 'Single Extension', 'Dual Left', 'Dual Right'];

// Bracket colors
export const BRACKET_COLOURS = ['White', 'Black', 'Bone', 'Dune'];

// Chain types (conditional - only for winders)
export const CHAIN_TYPES = ['Stainless Steel', 'Plastic Pure White'];

// Bottom rail types
export const BOTTOM_RAIL_TYPES = ['D30', 'Oval'];

// Bottom rail colors
export const BOTTOM_RAIL_COLOURS = ['Anodised', 'Black', 'Bone', 'Dune'];

// Control sides (existing)
export const CONTROL_SIDES = ['Left', 'Right'];

// Roll directions (existing)
export const ROLL_DIRECTIONS = ['Front', 'Back'];

/**
 * Check if a motor is a winder (requires chain selection)
 */
export function isWinderMotor(motor: string): boolean {
    return WINDER_MOTORS.includes(motor);
}

/**
 * Check if TBS winder + Extended bracket combination (invalid)
 */
export function isTBSExtendedInvalid(motor: string, bracketType: string): boolean {
    return motor === 'TBS winder-32mm' && bracketType === 'Single Extension';
}

/**
 * Convert data arrays to Select component format
 */
export function toSelectOptions(items: string[]) {
    return items.map(item => ({ label: item, value: item }));
}
