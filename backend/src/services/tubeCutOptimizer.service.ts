export interface TubeBlindInput {
    location: string;
    originalWidth: number;
    bottomRailType: string;
    bottomRailColour: string;
    orderItemId?: number;
}

export interface TubeGroup {
    bottomRailType: string;
    bottomRailColour: string;
    blinds: { location: string; originalWidth: number; orderItemId?: number }[];
    totalWidth: number;
    baseQuantity: number;
    wastage: number;
    finalQuantity: number;
    piecesToDeduct: number;
    stockLength: number;
}

export interface TubeCutResult {
    groups: TubeGroup[];
    totalPiecesNeeded: number;
}

const BOTTOM_BAR_STOCK_LENGTH = 5800; // mm per piece
const WASTAGE_PERCENT = 0.10; // 10%

export class TubeCutOptimizer {
    optimize(blinds: TubeBlindInput[]): TubeCutResult {
        // Group by bottomRailType + bottomRailColour
        const groupMap = new Map<string, TubeBlindInput[]>();

        for (const blind of blinds) {
            const key = `${blind.bottomRailType}|${blind.bottomRailColour}`;
            if (!groupMap.has(key)) {
                groupMap.set(key, []);
            }
            groupMap.get(key)!.push(blind);
        }

        const groups: TubeGroup[] = [];
        let totalPiecesNeeded = 0;

        for (const [, groupBlinds] of groupMap) {
            const first = groupBlinds[0];
            const totalWidth = groupBlinds.reduce((sum, b) => sum + b.originalWidth, 0);
            const baseQuantity = totalWidth / BOTTOM_BAR_STOCK_LENGTH;
            const wastage = baseQuantity * WASTAGE_PERCENT;
            const finalQuantity = baseQuantity + wastage;
            const piecesToDeduct = Math.ceil(finalQuantity);

            groups.push({
                bottomRailType: first.bottomRailType,
                bottomRailColour: first.bottomRailColour,
                blinds: groupBlinds.map(b => ({
                    location: b.location,
                    originalWidth: b.originalWidth,
                    orderItemId: b.orderItemId,
                })),
                totalWidth,
                baseQuantity: Math.round(baseQuantity * 1000) / 1000,
                wastage: Math.round(wastage * 1000) / 1000,
                finalQuantity: Math.round(finalQuantity * 1000) / 1000,
                piecesToDeduct,
                stockLength: BOTTOM_BAR_STOCK_LENGTH,
            });

            totalPiecesNeeded += piecesToDeduct;
        }

        return { groups, totalPiecesNeeded };
    }
}
