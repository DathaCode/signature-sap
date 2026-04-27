interface CurtainRow {
    itemNumber: number;
    location: string;
    width: number;
    deductedDrop: number;
    openingType: string;
    fabric: string;
    fabricColour: string;
    singleHooks: number | null;
    leftHooks: number | null;
    rightHooks: number | null;
    fabricMeters: number;
    bracketType: string;
    bracketCount: number;
    wandCount: number;
    trackColour: string;
}

interface CurtainTotals {
    totalHooks: number;
    totalWands: number;
    totalBracketsStandard: number;
    totalBracketsExtended: number;
    totalBracketsCeiling?: number;
    totalFabricMeters: number;
}

interface CurtainWorksheetData {
    type: 'CURTAINS';
    rows: CurtainRow[];
    totals: CurtainTotals;
}

interface Props {
    curtainData: CurtainWorksheetData;
}

export default function CurtainWorksheet({ curtainData }: Props) {
    const { rows, totals } = curtainData;

    const trackColours = [...new Set(rows.map(r => r.trackColour).filter(Boolean))];

    // Group fabric totals
    const fabricTotals = new Map<string, number>();
    for (const row of rows) {
        const key = `${row.fabric} - ${row.fabricColour}`;
        fabricTotals.set(key, (fabricTotals.get(key) ?? 0) + row.fabricMeters);
    }

    return (
        <div className="space-y-6">
            {/* Main worksheet table */}
            <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-xs font-semibold text-gray-600 uppercase tracking-wide">
                        <tr>
                            <th className="px-3 py-2 text-center w-10">No</th>
                            <th className="px-3 py-2 text-left">Location</th>
                            <th className="px-3 py-2 text-center">Width (mm)</th>
                            <th className="px-3 py-2 text-center">Deducted Drop (mm)</th>
                            <th className="px-3 py-2 text-center">Opening Type</th>
                            <th className="px-3 py-2 text-left">Fabric Material</th>
                            <th className="px-3 py-2 text-left">Colour</th>
                            <th className="px-3 py-2 text-center">Single Hooks</th>
                            <th className="px-3 py-2 text-center">Left Side Hooks</th>
                            <th className="px-3 py-2 text-center">Right Side Hooks</th>
                            <th className="px-3 py-2 text-center">Fabric (m)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {rows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <td className="px-3 py-2 text-center font-medium text-gray-700">{row.itemNumber}</td>
                                <td className="px-3 py-2 text-gray-800">{row.location}</td>
                                <td className="px-3 py-2 text-center">{row.width}</td>
                                <td className="px-3 py-2 text-center">{row.deductedDrop}</td>
                                <td className="px-3 py-2 text-center">
                                    <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800">
                                        {row.openingType}
                                    </span>
                                </td>
                                <td className="px-3 py-2 text-gray-800">{row.fabric}</td>
                                <td className="px-3 py-2 text-gray-600">{row.fabricColour}</td>
                                <td className="px-3 py-2 text-center">
                                    {row.singleHooks !== null ? (
                                        <span className="font-semibold text-blue-700">{row.singleHooks}</span>
                                    ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    {row.leftHooks !== null ? (
                                        <span className="font-semibold text-purple-700">{row.leftHooks}</span>
                                    ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center">
                                    {row.rightHooks !== null ? (
                                        <span className="font-semibold text-purple-700">{row.rightHooks}</span>
                                    ) : '—'}
                                </td>
                                <td className="px-3 py-2 text-center font-semibold text-green-700">
                                    {row.fabricMeters.toFixed(3)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Totals summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-800 mb-2 text-sm">Hooks</h4>
                    <div className="text-2xl font-bold text-blue-700">{totals.totalHooks}</div>
                    <div className="text-xs text-blue-600 mt-1">Total S-Fold Hooks</div>
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-semibold text-purple-800 mb-2 text-sm">Brackets</h4>
                    <div className="text-2xl font-bold text-purple-700">
                        {totals.totalBracketsStandard + totals.totalBracketsExtended + (totals.totalBracketsCeiling ?? 0)}
                    </div>
                    <div className="mt-1 space-y-0.5 text-xs">
                        {totals.totalBracketsStandard > 0 && (
                            <div className="flex justify-between text-purple-600">
                                <span>Standard</span>
                                <span className="font-medium">{totals.totalBracketsStandard}</span>
                            </div>
                        )}
                        {totals.totalBracketsExtended > 0 && (
                            <div className="flex justify-between text-purple-600">
                                <span>Extended</span>
                                <span className="font-medium">{totals.totalBracketsExtended}</span>
                            </div>
                        )}
                        {(totals.totalBracketsCeiling ?? 0) > 0 && (
                            <div className="flex justify-between text-purple-600">
                                <span>Ceiling</span>
                                <span className="font-medium">{totals.totalBracketsCeiling}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-800 mb-2 text-sm">Wands</h4>
                    <div className="text-2xl font-bold text-amber-700">{totals.totalWands}</div>
                    <div className="text-xs text-amber-600 mt-1">Total 1250mm Wands</div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-semibold text-green-800 mb-2 text-sm">Total Fabric</h4>
                    <div className="text-2xl font-bold text-green-700">{totals.totalFabricMeters.toFixed(3)}m</div>
                    {fabricTotals.size > 1 && (
                        <div className="mt-2 space-y-0.5">
                            {[...fabricTotals.entries()].map(([name, m]) => (
                                <div key={name} className="text-xs text-green-700 flex justify-between">
                                    <span className="truncate">{name}</span>
                                    <span className="font-medium ml-2">{m.toFixed(3)}m</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {trackColours.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <h4 className="font-semibold text-gray-700 mb-2 text-sm">Track Colour(s)</h4>
                        <div className="space-y-1">
                            {trackColours.map(c => (
                                <div key={c} className="flex items-center gap-2">
                                    <div className={`w-4 h-4 rounded border ${c === 'Black' ? 'bg-gray-900' : 'bg-white border-gray-400'}`} />
                                    <span className="text-sm font-medium text-gray-700">{c}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
