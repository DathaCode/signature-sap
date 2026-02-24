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
    'Automate 2NM Li-Ion Quiet Motor',
    'Automate 3NM Li-Ion Motor',
    'Automate E6 6NM Motor',
    'Alpha 1NM Battery Motor',
    'Alpha 2NM Battery Motor',
    'Alpha 3NM Battery Motor',
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
export const BOTTOM_RAIL_COLOURS = ['White', 'Black', 'Dune', 'Bone', 'Anodised'];

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
 * TBS winder-32mm does not have an Extended Bracket set.
 */
export function isTBSExtendedInvalid(motor: string, bracketType: string): boolean {
    return motor === 'TBS winder-32mm' && (bracketType === 'Single Extension' || bracketType === 'Extended');
}

/**
 * Convert data arrays to Select component format
 */
export function toSelectOptions(items: string[]) {
    return items.map(item => ({ label: item, value: item }));
}
