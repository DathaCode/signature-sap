import { useState } from 'react';
import { WorksheetPreviewResponse } from '../../types/order';
import { adminOrderApi } from '../../services/api';
import { Button } from '../ui/Button';
import FabricCutWorksheet from './FabricCutWorksheet';
import TubeCutWorksheet from './TubeCutWorksheet';
import { toast } from 'react-hot-toast';
import { X, Download, Check, RefreshCw, AlertTriangle } from 'lucide-react';

interface Props {
    orderId: string;
    orderNumber: string;
    data: WorksheetPreviewResponse;
    onClose: () => void;
    onAccepted: () => void;
}

export default function WorksheetPreview({ orderId, orderNumber, data, onClose, onAccepted }: Props) {
    const [activeTab, setActiveTab] = useState<'fabric' | 'tube'>('fabric');
    const [accepting, setAccepting] = useState(false);
    const [recalculating, setRecalculating] = useState(false);
    const [previewData, setPreviewData] = useState(data);
    const [downloading, setDownloading] = useState<string | null>(null);

    const isAccepted = !!previewData.worksheetData.acceptedAt;
    const hasInsufficientStock = !previewData.inventoryCheck.available;

    const handleAccept = async () => {
        if (!confirm('Accept worksheets and deduct inventory? This cannot be undone.')) return;
        setAccepting(true);
        try {
            await adminOrderApi.acceptWorksheets(orderId);
            toast.success('Worksheets accepted. Inventory deducted.');
            onAccepted();
        } catch (error) {
            console.error(error);
            toast.error('Failed to accept worksheets');
        } finally {
            setAccepting(false);
        }
    };

    const handleRecalculate = async () => {
        setRecalculating(true);
        try {
            const result = await adminOrderApi.recalculate(orderId);
            setPreviewData(result);
            toast.success('Optimization recalculated');
        } catch (error) {
            console.error(error);
            toast.error('Failed to recalculate');
        } finally {
            setRecalculating(false);
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
            toast.error('Download failed');
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
                                : 'Review and accept worksheets to deduct inventory'
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

                {/* Tabs */}
                <div className="flex border-b px-6">
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 ${
                            activeTab === 'fabric'
                                ? 'border-blue-500 text-blue-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('fabric')}
                    >
                        Fabric Cut Worksheet
                    </button>
                    <button
                        className={`px-4 py-3 text-sm font-medium border-b-2 ${
                            activeTab === 'tube'
                                ? 'border-green-500 text-green-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                        onClick={() => setActiveTab('tube')}
                    >
                        Tube Cut Worksheet
                    </button>
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
                            <>
                                <Button
                                    variant="outline"
                                    onClick={handleRecalculate}
                                    disabled={recalculating}
                                >
                                    <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? 'animate-spin' : ''}`} />
                                    {recalculating ? 'Recalculating...' : 'Recalculate'}
                                </Button>
                                <Button
                                    onClick={handleAccept}
                                    disabled={accepting || hasInsufficientStock}
                                    className="bg-green-600 hover:bg-green-700"
                                >
                                    <Check className="mr-2 h-4 w-4" />
                                    {accepting ? 'Accepting...' : 'Accept Worksheets'}
                                </Button>
                            </>
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
