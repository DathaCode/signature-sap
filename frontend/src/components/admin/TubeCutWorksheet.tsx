import { TubeCutData } from '../../types/order';

interface Props {
    tubeCutData: TubeCutData;
}

export default function TubeCutWorksheet({ tubeCutData }: Props) {
    return (
        <div className="space-y-6">
            {tubeCutData.groups.map((group, gIdx) => {
                // Build location → pieceNumber[] lookup from cutting order
                const locationPieceMap = new Map<string, number[]>();
                for (const piece of group.cuttingOrder ?? []) {
                    for (const cut of piece.cuts) {
                        const list = locationPieceMap.get(cut.location) ?? [];
                        list.push(piece.pieceNumber);
                        locationPieceMap.set(cut.location, list);
                    }
                }
                // Assign piece numbers to each blind in table order (handles duplicate locations)
                const locationUsedCount = new Map<string, number>();
                const pieceAssignments = group.blinds.map(blind => {
                    const usedCount = locationUsedCount.get(blind.location) ?? 0;
                    locationUsedCount.set(blind.location, usedCount + 1);
                    const pieces = locationPieceMap.get(blind.location) ?? [];
                    return pieces[usedCount] ?? null;
                });

                return (
                    <div key={gIdx} className="border rounded-lg overflow-hidden">
                        <div className="bg-green-50 px-4 py-2 border-b">
                            <h3 className="font-semibold text-sm text-green-800">
                                {group.bottomRailType} - {group.bottomRailColour}
                            </h3>
                            <div className="flex gap-4 text-xs text-green-600 mt-1">
                                <span>Total Width: {group.totalWidth}mm</span>
                                <span>Stock Length: {group.stockLength}mm</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">Location</th>
                                        <th className="px-4 py-2 text-right font-medium text-gray-600">Tube Cut Width (mm)</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">Bottom Rail Type</th>
                                        <th className="px-4 py-2 text-left font-medium text-gray-600">Bottom Rail Colour</th>
                                        <th className="px-4 py-2 text-center font-medium text-gray-600">Cutting Order</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {group.blinds.map((blind, bIdx) => (
                                        <tr key={bIdx} className="border-b hover:bg-gray-50">
                                            <td className="px-4 py-2 font-medium">{blind.location}</td>
                                            <td className="px-4 py-2 text-right font-semibold text-green-700">
                                                {blind.tubeCutWidth ?? (blind.originalWidth - 28)}
                                            </td>
                                            <td className="px-4 py-2">{group.bottomRailType}</td>
                                            <td className="px-4 py-2">{group.bottomRailColour}</td>
                                            <td className="px-4 py-2 text-center">
                                                {pieceAssignments[bIdx] != null && (
                                                    <span className="inline-block bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-xs">
                                                        Piece {pieceAssignments[bIdx]}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-green-50 font-medium text-sm">
                                        <td className="px-4 py-2">Group Total</td>
                                        <td colSpan={4} className="px-4 py-2 text-right">
                                            Total: {group.totalWidth}mm — Base: {group.baseQuantity} + 10% wastage ({group.wastage}) = {group.finalQuantity} → <span className="font-bold">{group.piecesToDeduct} pieces</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Cutting Order */}
                        {group.cuttingOrder && group.cuttingOrder.length > 0 && (
                            <div className="border-t bg-gray-50 px-4 py-3">
                                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">
                                    Cutting Order — {group.piecesToDeduct} × {group.stockLength}mm stock pieces
                                </h4>
                                <div className="space-y-2">
                                    {group.cuttingOrder.map((piece) => (
                                        <div key={piece.pieceNumber} className="flex items-start gap-3 text-xs">
                                            <span className="shrink-0 font-bold text-green-700 w-14">
                                                Piece {piece.pieceNumber}
                                            </span>
                                            <div className="flex flex-wrap gap-1 flex-1">
                                                {piece.cuts.map((cut, ci) => (
                                                    <span key={ci} className="bg-green-100 text-green-800 px-2 py-0.5 rounded font-medium">
                                                        {cut.location} — {cut.width}mm
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="shrink-0 text-gray-400 whitespace-nowrap">
                                                Used {piece.totalUsed}mm · Waste {piece.waste}mm
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}

            <div className="bg-green-100 rounded-lg px-4 py-3 text-center">
                <span className="text-lg font-bold text-green-800">
                    Total Bottom Bar Pieces Needed: {tubeCutData.totalPiecesNeeded}
                </span>
            </div>
        </div>
    );
}
