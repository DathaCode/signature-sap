import { useState } from 'react';
import { WorksheetPreviewResponse } from '../../types/order';
import { adminOrderApi } from '../../services/api';
import { Button } from '../ui/Button';
import FabricCutWorksheet from './FabricCutWorksheet';
import TubeCutWorksheet from './TubeCutWorksheet';
import CurtainWorksheet from './CurtainWorksheet';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import { X, Download, Check, AlertTriangle } from 'lucide-react';

interface Props {
    orderId: string;
    orderNumber: string;
    productType?: string;
    customerName?: string;
    customerReference?: string;
    notes?: string;
    createdAt?: string;
    data: WorksheetPreviewResponse;
    onClose: () => void;
    onAccepted: () => void;
    /** When true (CONFIRMED state preview) hides Accept/Download buttons */
    isPreview?: boolean;
}

export default function WorksheetPreview({ orderId, orderNumber, productType, customerReference, data, onClose, onAccepted, isPreview = false }: Props) {
    const isCurtain = productType === 'CURTAINS' || (data.worksheetData.fabricCutData as any)?.type === 'CURTAINS';
    const [activeTab, setActiveTab] = useState<'fabric' | 'tube'>('fabric');
    const [accepting, setAccepting] = useState(false);
    const [previewData] = useState(data);
    const [downloading, setDownloading] = useState<string | null>(null);
    const [printingLabels, setPrintingLabels] = useState(false);

    const handlePrintLabels = async () => {
        setPrintingLabels(true);
        try {
            const blob = await adminOrderApi.downloadLabels(orderId);
            const url = URL.createObjectURL(blob);
            const win = window.open(url, '_blank');
            if (!win) {
                // Fallback: trigger download if popup blocked
                const a = document.createElement('a');
                a.href = url;
                a.download = `labels-${orderNumber}.pdf`;
                a.click();
                gooeyToast.info('Labels downloaded — open and print from your PDF viewer');
            }
            setTimeout(() => URL.revokeObjectURL(url), 10000);
        } catch {
            gooeyToast.error('Failed to generate labels');
        } finally {
            setPrintingLabels(false);
        }
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

    const handleDownload = async (type: 'fabric-cut-csv' | 'fabric-cut-pdf' | 'tube-cut-csv' | 'tube-cut-pdf' | 'curtain-csv' | 'curtain-pdf') => {
        setDownloading(type);
        try {
            const blob = await adminOrderApi.downloadWorksheet(orderId, type);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Ensure correct file extension
            const ext = type.endsWith('-csv') ? 'csv' : 'pdf';
            const baseName = type.replace(/-csv$/, '').replace(/-pdf$/, '');
            a.download = `${orderNumber}-${baseName}.${ext}`;
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
                        <h2 className="text-xl font-bold">
                            Worksheet Preview - {orderNumber}
                            {customerReference && (
                                <span className="ml-3 text-base font-medium text-indigo-600">({customerReference})</span>
                            )}
                        </h2>
                        <p className="text-sm text-gray-500">
                            {isPreview
                                ? 'Preview only — send to production to accept worksheets'
                                : isAccepted
                                ? `Accepted on ${new Date(previewData.worksheetData.acceptedAt!).toLocaleDateString()}`
                                : 'Review and accept worksheets'
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

                {/* Tabs — curtain orders only have one tab */}
                {!isCurtain && (
                    <div className="flex border-b px-6">
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
                )}
                {isCurtain && (
                    <div className="border-b px-6 py-3">
                        <span className="px-4 py-2 text-sm font-medium border-b-2 border-teal-500 text-teal-600">
                            Curtain Worksheet
                        </span>
                    </div>
                )}

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {isCurtain ? (
                        <CurtainWorksheet curtainData={previewData.worksheetData.fabricCutData as any} />
                    ) : activeTab === 'fabric' ? (
                        <FabricCutWorksheet
                            fabricCutData={previewData.worksheetData.fabricCutData}
                            onPrintLabels={handlePrintLabels}
                            printingLabels={printingLabels}
                        />
                    ) : (
                        <TubeCutWorksheet tubeCutData={previewData.worksheetData.tubeCutData} />
                    )}
                </div>

                {/* Footer Actions */}
                <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
                    <div className="flex gap-2">
                        {/* Download buttons for curtain orders */}
                        {isCurtain && !isPreview && (
                            <>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload('curtain-csv')}
                                    disabled={!!downloading}
                                >
                                    <Download className="mr-1 h-3 w-3" />
                                    {downloading === 'curtain-csv' ? 'Downloading...' : 'CSV'}
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDownload('curtain-pdf')}
                                    disabled={!!downloading}
                                >
                                    <Download className="mr-1 h-3 w-3" />
                                    {downloading === 'curtain-pdf' ? 'Downloading...' : 'PDF'}
                                </Button>
                            </>
                        )}
                        {/* Download buttons — not shown for curtain orders or preview mode */}
                        {!isCurtain && !isPreview && activeTab === 'fabric' && (
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
                        )}
                        {!isCurtain && !isPreview && activeTab === 'tube' && (
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
                        {!isPreview && !isAccepted && (
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
