export interface TubeBlindInput {
    location: string;
    originalWidth: number;
    bottomRailType: string;
    bottomRailColour: string;
    orderItemId?: number;
}

export interface CutPiece {
    pieceNumber: number;
    cuts: { location: string; width: number }[];
    totalUsed: number;
    waste: number;
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
    cuttingOrder: CutPiece[];
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

            // Build cutting order: greedy first-fit bin packing using tube cut widths (originalWidth - 28)
            const cuttingOrder = buildCuttingOrder(groupBlinds, BOTTOM_BAR_STOCK_LENGTH);

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
                cuttingOrder,
            });

            totalPiecesNeeded += piecesToDeduct;
        }

        return { groups, totalPiecesNeeded };
    }
}

/**
 * Greedy first-fit bin packing for tube cutting.
 * Sorts blinds by width descending, then fills each stock piece.
 * Uses tube cut width = originalWidth - 28mm.
 */
function buildCuttingOrder(blinds: TubeBlindInput[], stockLength: number): CutPiece[] {
    const sorted = [...blinds].sort((a, b) => b.originalWidth - a.originalWidth);
    const pieces: CutPiece[] = [];

    for (const blind of sorted) {
        const cutW = blind.originalWidth - 28;
        // Find first piece with enough remaining space
        const piece = pieces.find(p => p.totalUsed + cutW <= stockLength);
        if (piece) {
            piece.cuts.push({ location: blind.location, width: cutW });
            piece.totalUsed += cutW;
            piece.waste = stockLength - piece.totalUsed;
        } else {
            pieces.push({
                pieceNumber: pieces.length + 1,
                cuts: [{ location: blind.location, width: cutW }],
                totalUsed: cutW,
                waste: stockLength - cutW,
            });
        }
    }

    return pieces;
}
