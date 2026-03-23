import { useState } from 'react';
import { BlindItem, FabricGroupData, WorksheetPreviewResponse } from '../../types/order';
import { adminOrderApi } from '../../services/api';
import { Button } from '../ui/Button';
import FabricCutWorksheet from './FabricCutWorksheet';
import TubeCutWorksheet from './TubeCutWorksheet';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import { X, Download, Check, AlertTriangle, Printer } from 'lucide-react';

interface Props {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerReference?: string;
    notes?: string;
    createdAt: string;
    data: WorksheetPreviewResponse;
    onClose: () => void;
    onAccepted: () => void;
}

/** Collect all blind items from fabricCutData, sorted by blind number */
function getAllBlindsForLabels(fabricCutData: Record<string, FabricGroupData>): Array<{ blindNumber: number; item: BlindItem }> {
    const seen = new Set<number>();
    const result: Array<{ blindNumber: number; item: BlindItem }> = [];
    for (const groupData of Object.values(fabricCutData)) {
        for (const sheet of groupData.optimization.sheets) {
            for (const panel of sheet.panels) {
                const itemId = (panel as any).orderItemId;
                if (panel.blindNumber && itemId && !seen.has(itemId)) {
                    const item = groupData.items.find((it: any) => it.id === itemId);
                    if (item) {
                        seen.add(itemId);
                        result.push({ blindNumber: panel.blindNumber, item });
                    }
                }
            }
        }
    }
    return result.sort((a, b) => a.blindNumber - b.blindNumber);
}

export default function WorksheetPreview({ orderId, orderNumber, customerName, customerReference, notes: _notes, createdAt, data, onClose, onAccepted }: Props) {
    const [activeTab, setActiveTab] = useState<'fabric' | 'tube'>('fabric');
    const [accepting, setAccepting] = useState(false);
    const [previewData] = useState(data);
    const [downloading, setDownloading] = useState<string | null>(null);

    const cxRef = customerReference ? `${customerName}-${customerReference}` : customerName;

    const handlePrintLabels = () => {
        const allBlinds = getAllBlindsForLabels(previewData.worksheetData.fabricCutData);
        const total = allBlinds.length;
        if (total === 0) { gooeyToast.error('No blind items found'); return; }

        const logoUrl = `${window.location.origin}/logo.png`;
        const ordDate = createdAt ? new Date(createdAt).toLocaleDateString('en-AU') : '';

        const labelsHtml = allBlinds.map(({ blindNumber, item }) => `
            <div class="label">
                <div class="label-header">
                    <img src="${logoUrl}" class="label-logo" alt="Signature Shades" onerror="this.style.display='none'" />
                    <span class="blind-count">${blindNumber} of ${total}</span>
                </div>
                <div class="order-info">
                    <div><b>Order ref:</b> ${orderNumber}</div>
                    <div><b>Cx Ref:</b> ${cxRef}</div>
                    ${ordDate ? `<div><b>Date:</b> ${ordDate}</div>` : ''}
                </div>
                <div class="divider"></div>
                <div class="blind-details">
                    <div><b>Location:</b> ${item.location || '-'}</div>
                    <div><b>W &times; H:</b> ${item.width} &times; ${item.drop}</div>
                    <div><b>Roll:</b> ${item.roll || '-'}</div>
                    <div><b>Fabric:</b> ${item.fabricType || '-'} / ${item.fabricColour || '-'}</div>
                    <div><b>BR Colour:</b> ${item.bottomRailColour || '-'}</div>
                    <div><b>Bracket:</b> ${item.bracketType || '-'}</div>
                </div>
            </div>
        `).join('');

        const printWindow = window.open('', '_blank', 'width=500,height=700');
        if (!printWindow) { gooeyToast.error('Popup blocked — allow popups to print labels'); return; }

        printWindow.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Labels - ${orderNumber}</title>
<style>
  @page { size: 62mm 100mm; margin: 2mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 7.5pt; background: #fff; }
  .label { width: 58mm; height: 96mm; padding: 1.5mm; display: flex; flex-direction: column; gap: 1mm; page-break-after: always; overflow: hidden; }
  .label:last-child { page-break-after: avoid; }
  .label-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1mm; border-bottom: 0.5pt solid #333; }
  .label-logo { height: 10mm; max-width: 32mm; object-fit: contain; }
  .blind-count { font-size: 9pt; font-weight: bold; white-space: nowrap; }
  .order-info { font-size: 7pt; line-height: 1.4; }
  .divider { border-top: 0.4pt solid #bbb; margin: 0.5mm 0; }
  .blind-details div { font-size: 7.5pt; line-height: 1.45; }
  b { font-weight: bold; }
</style>
</head><body>${labelsHtml}</body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const isAccepted = !!previewData.worksheetData.acceptedAt;
    const hasInsufficientStock = !previewData.inventoryCheck.available;

    const handleAccept = async () => {
        if (!await confirmToast({ title: 'Accept Worksheets', message: 'Accept worksheets and deduct inventory? This cannot be undone.', confirmText: 'Accept', variant: 'warning' })) return;
        setAccepting(true);
        try {
            await adminOrderApi.acceptWorksheets(orderId);
            gooeyToast.success('Worksheets accepted. Inventory deducted.');
            onAccepted();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to accept worksheets');
        } finally {
            setAccepting(false);
        }
    };

    const handleDownload = async (type: 'fabric-cut-csv' | 'fabric-cut-pdf' | 'tube-cut-csv' | 'tube-cut-pdf') => {
        setDownloading(type);
        try {
            const blob = await adminOrderApi.downloadWorksheet(orderId, type);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${orderNumber}-${type}`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            gooeyToast.error('Download failed');
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold">Worksheet Preview - {orderNumber}</h2>
                        <p className="text-sm text-gray-500">
                            {isAccepted
                                ? `Accepted on ${new Date(previewData.worksheetData.acceptedAt!).toLocaleDateString()}`
                                : 'Review and accept worksheets 📌'
                            }
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Inventory Warnings */}
                {hasInsufficientStock && !isAccepted && (
                    <div className="mx-6 mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-center gap-2 text-amber-800 font-medium mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            Insufficient Inventory
                        </div>
                        <div className="space-y-1">
                            {previewData.inventoryCheck.items
                                .filter(item => !item.sufficient)
                                .map((item, idx) => (
                                    <div key={idx} className="text-sm text-amber-700">
                                        {item.itemName}: Need {item.required}, Available {item.available}
                                        <span className="text-red-600 font-medium ml-2">
                                            (Short by {item.required - item.available})
                                        </span>
                                    </div>
                                ))
                            }
                        </div>
                    </div>
                )}

                {/* Tabs + Print Labels */}
                <div className="flex items-center justify-between border-b px-6">
                    <div className="flex">
                        <button
                            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'fabric'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setActiveTab('fabric')}
                        >
                            Fabric Cut Worksheet
                        </button>
                        <button
                            className={`px-4 py-3 text-sm font-medium border-b-2 ${activeTab === 'tube'
                                    ? 'border-green-500 text-green-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                            onClick={() => setActiveTab('tube')}
                        >
                            Tube Cut Worksheet
                        </button>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handlePrintLabels}
                        className="flex items-center gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50"
                    >
                        <Printer className="h-3.5 w-3.5" />
                        Print Labels
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {activeTab === 'fabric' ? (
                        <FabricCutWorksheet fabricCutData={previewData.worksheetData.fabricCutData} />
                    ) : (
                        <TubeCutWorksheet tubeCutData={previewData.worksheetData.tubeCutData} />
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                    <div className="flex gap-2">
                        {/* Download buttons */}
                        {activeTab === 'fabric' ? (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload('fabric-cut-csv')}
                                    disabled={!!downloading}
                                >
                                    <Download className="mr-1 h-3 w-3" />
                                    {downloading === 'fabric-cut-csv' ? 'Downloading...' : 'CSV'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload('fabric-cut-pdf')}
                                    disabled={!!downloading}
                                >
                                    <Download className="mr-1 h-3 w-3" />
                                    {downloading === 'fabric-cut-pdf' ? 'Downloading...' : 'PDF'}
                                </Button>
                            </>
                        ) : (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload('tube-cut-csv')}
                                    disabled={!!downloading}
                                >
                                    <Download className="mr-1 h-3 w-3" />
                                    {downloading === 'tube-cut-csv' ? 'Downloading...' : 'CSV'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload('tube-cut-pdf')}
                                    disabled={!!downloading}
                                >
                                    <Download className="mr-1 h-3 w-3" />
                                    {downloading === 'tube-cut-pdf' ? 'Downloading...' : 'PDF'}
                                </Button>
                            </>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {!isAccepted && (
                            <Button
                                onClick={handleAccept}
                                disabled={accepting || hasInsufficientStock}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <Check className="mr-2 h-4 w-4" />
                                {accepting ? 'Accepting...' : 'Accept Worksheets'}
                            </Button>
                        )}
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
