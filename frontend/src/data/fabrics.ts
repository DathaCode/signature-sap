import { FABRIC_DATA } from '../utils/pricing';

// Helper type to match the structure in pricing.ts
type FabricDataStructure = Record<string, Record<string, { group: string; colors: string[] }>>;
// Cast to the type to allow safe access
const data = FABRIC_DATA as unknown as FabricDataStructure;

export const getMaterials = (): string[] => Object.keys(data);

export const getFabricTypes = (material: string): string[] => {
    return data[material] ? Object.keys(data[material]) : [];
};

export const getFabricColors = (material: string, type: string): string[] => {
    return (data[material] && data[material][type])
        ? data[material][type].colors
        : [];
};

export const getFabricGroup = (material: string, type: string): number | null => {
    if (!data[material] || !data[material][type]) {
        return null;
    }

    const groupString = data[material][type].group;
    const groupMapping: { [key: string]: number } = { 'G1': 1, 'G2': 2, 'G3': 3 };

    return groupMapping[groupString] || null;
};
