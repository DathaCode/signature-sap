import { FabricGroupData } from '../../types/order';

/**
 * Determine chain size (mm) from total drop (Calc D = original drop + 150)
 */
function getChainSize(calcDrop: number): number {
    if (calcDrop <= 850) return 500;
    if (calcDrop <= 1100) return 750;
    if (calcDrop <= 1600) return 1000;
    if (calcDrop <= 2200) return 1200;
    return 1500;
}

interface Props {
    fabricCutData: Record<string, FabricGroupData>;
}

export default function FabricCutWorksheet({ fabricCutData }: Props) {
    let globalPanelNo = 0; // sequential panel/blind number across all groups

    return (
        <div className="space-y-6">
            {Object.entries(fabricCutData).map(([fabricKey, groupData]) => {
                return (
                    <div key={fabricKey} className="border rounded-lg overflow-hidden">
                        <div className="bg-blue-50 px-4 py-2 border-b">
                            <h3 className="font-semibold text-sm text-blue-800">{fabricKey}</h3>
                            <div className="flex gap-4 text-xs text-blue-600 mt-1">
                                <span>Sheets: {groupData.optimization.statistics.usedStockSheets}</span>
                                <span>Efficiency: {groupData.optimization.statistics.efficiency}%</span>
                                <span>Fabric Needed: {(groupData.optimization.statistics.totalFabricNeeded / 1000).toFixed(1)}m</span>
                                <span>Waste: {groupData.optimization.statistics.wastePercentage}%</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-gray-50 border-b">
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Panel No</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Location</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">Fab Cut W</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">Calc D</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Ctrl</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Ctrl Col</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Chain/Motor</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Roll</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Fabric</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">Colour</th>
                                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">BR Colour</th>
                                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">Chain Size</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {groupData.optimization.sheets.map(sheet =>
                                        sheet.panels.map((panel, idx) => {
                                            globalPanelNo++;
                                            const item = groupData.items.find(
                                                (it: any) => it.id === panel.orderItemId
                                            );
                                            const fabricCutW = item ? item.width - 35 : '-';
                                            const calcD = item ? item.drop + 150 : 0;
                                            const chainSize = calcD > 0 ? getChainSize(calcD) : '-';
                                            return (
                                                <tr key={`${sheet.id}-${idx}`} className="border-b hover:bg-gray-50">
                                                    <td className="px-2 py-1.5 font-semibold">{globalPanelNo}</td>
                                                    <td className="px-2 py-1.5 font-medium">{item?.location || panel.label}</td>
                                                    <td className="px-2 py-1.5 text-right font-semibold text-blue-700">
                                                        {fabricCutW}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-right">
                                                        {calcD > 0 ? calcD : '-'}
                                                    </td>
                                                    <td className="px-2 py-1.5">{item?.controlSide || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.bracketColour || '-'}</td>
                                                    <td className="px-2 py-1.5 truncate max-w-[80px]">
                                                        {(item?.chainOrMotor || '-').replace(/_/g, ' ')}
                                                    </td>
                                                    <td className="px-2 py-1.5">{item?.roll || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.fabricType || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.fabricColour || '-'}</td>
                                                    <td className="px-2 py-1.5">{item?.bottomRailColour || '-'}</td>
                                                    <td className="px-2 py-1.5 text-right">{chainSize}mm</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
