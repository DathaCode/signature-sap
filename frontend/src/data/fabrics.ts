import FABRICS_DATA from './fabrics.json';

// Type definitions
export interface FabricColors {
    group: string; // G1, G2, G3, G4, G5
    colors: string[];
}

export interface FabricTypeColors {
    [fabricType: string]: FabricColors;
}

export interface FabricsData {
    [material: string]: FabricTypeColors;
}

// Type-safe fabric data
export const FABRICS = FABRICS_DATA as FabricsData;

/**
 * Get all material brands
 */
export function getMaterials(): string[] {
    return Object.keys(FABRICS);
}

/**
 * Get all fabric types for a given material
 */
export function getFabricTypes(material: string): string[] {
    if (!FABRICS[material]) {
        return [];
    }
    return Object.keys(FABRICS[material]);
}

/**
 * Get all colors for a given material and fabric type
 */
export function getFabricColors(material: string, fabricType: string): string[] {
    if (!FABRICS[material] || !FABRICS[material][fabricType]) {
        return [];
    }
    return FABRICS[material][fabricType].colors;
}

/**
 * Get fabric group (G1-G5) for a given material and fabric type
 * Returns numeric group (1-5) or null if not found
 */
export function getFabricGroup(material: string, fabricType: string): number | null {
    if (!FABRICS[material] || !FABRICS[material][fabricType]) {
        return null;
    }

    const groupString = FABRICS[material][fabricType].group; // e.g., "G1"
    const groupNumber = parseInt(groupString.substring(1)); // Remove "G" and parse number

    return groupNumber >= 1 && groupNumber <= 5 ? groupNumber : null;
}
