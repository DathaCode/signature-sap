import { useQuery } from '@tanstack/react-query';
import { fabricsApi, FabricDataFormatted } from '../services/api';
import { FABRIC_DATA } from '../utils/pricing';

const STATIC_FALLBACK = FABRIC_DATA as unknown as FabricDataFormatted;

export function useFabrics() {
    return useQuery<FabricDataFormatted>({
        queryKey: ['blind-fabrics'],
        queryFn: fabricsApi.getAll,
        staleTime: 5 * 60 * 1000,
        placeholderData: STATIC_FALLBACK,
    });
}

export function getMaterialsFromData(data: FabricDataFormatted): string[] {
    return Object.keys(data);
}

export function getFabricTypesFromData(data: FabricDataFormatted, material: string): string[] {
    return data[material] ? Object.keys(data[material]) : [];
}

export function getFabricColorsFromData(data: FabricDataFormatted, material: string, fabricType: string): string[] {
    return data[material]?.[fabricType]?.colors ?? [];
}

export function getFabricGroupFromData(data: FabricDataFormatted, material: string, fabricType: string): number | null {
    const groupStr = data[material]?.[fabricType]?.group;
    if (!groupStr) return null;
    const map: Record<string, number> = { G1: 1, G2: 2, G3: 3, Budget: 4 };
    return map[groupStr] ?? null;
}
