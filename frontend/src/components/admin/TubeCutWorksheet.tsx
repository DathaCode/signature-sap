import { TubeCutData } from '../../types/order';

interface Props {
    tubeCutData: TubeCutData;
}

export default function TubeCutWorksheet({ tubeCutData }: Props) {
    return (
        <div className="space-y-6">
            {tubeCutData.groups.map((group, gIdx) => (
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
                                    <th className="px-4 py-2 text-right font-medium text-gray-600">Original Width (mm)</th>
                                    <th className="px-4 py-2 text-right font-medium text-gray-600">Tube Cut Width (mm)</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-600">Bottom Rail Type</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-600">Bottom Rail Colour</th>
                                </tr>
                            </thead>
                            <tbody>
                                {group.blinds.map((blind, bIdx) => (
                                    <tr key={bIdx} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-2 font-medium">{blind.location}</td>
                                        <td className="px-4 py-2 text-right">{blind.originalWidth}</td>
                                        <td className="px-4 py-2 text-right font-semibold text-green-700">
                                            {blind.originalWidth - 28}
                                        </td>
                                        <td className="px-4 py-2">{group.bottomRailType}</td>
                                        <td className="px-4 py-2">{group.bottomRailColour}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-green-50 font-medium text-sm">
                                    <td className="px-4 py-2">Group Total</td>
                                    <td className="px-4 py-2 text-right">{group.totalWidth}mm</td>
                                    <td colSpan={3} className="px-4 py-2 text-right">
                                        Base: {group.baseQuantity} + 10% wastage ({group.wastage}) = {group.finalQuantity} → <span className="font-bold">{group.piecesToDeduct} pieces</span>
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
            ))}

            <div className="bg-green-100 rounded-lg px-4 py-3 text-center">
                <span className="text-lg font-bold text-green-800">
                    Total Bottom Bar Pieces Needed: {tubeCutData.totalPiecesNeeded}
                </span>
            </div>
        </div>
    );
}
