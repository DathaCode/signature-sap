import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { FileSpreadsheet, Download, ArrowLeft, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { orderApi } from '../services/api'
import type { WorksheetData } from '../types'

export default function WorksheetPreview() {
    const { orderId } = useParams<{ orderId: string }>()
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState<'fabric' | 'tube'>('fabric')
    const [worksheets, setWorksheets] = useState<WorksheetData | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [downloading, setDownloading] = useState<string | null>(null)

    useEffect(() => {
        if (!orderId) return

        const fetchWorksheets = async () => {
            try {
                const data = await orderApi.getWorksheets(orderId)
                setWorksheets(data)
            } catch (error: any) {
                toast.error('Failed to load worksheets')
                console.error(error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchWorksheets()
    }, [orderId])

    const handleDownload = async (type: 'fabric_cut' | 'tube_cut', format: 'csv' | 'pdf') => {
        if (!orderId) return

        const downloadKey = `${type}-${format}`
        setDownloading(downloadKey)

        try {
            const blob = await orderApi.downloadWorksheet(orderId, type, format)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${type}_${orderId}.${format}`
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)
            toast.success(`Downloaded ${type.replace('_', ' ')} as ${format.toUpperCase()}`)
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Download failed')
        } finally {
            setDownloading(null)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center space-y-4">
                    <div className="animate-spin h-12 w-12 border-4 border-brand-gold border-t-transparent rounded-full mx-auto" />
                    <p className="text-gray-600">Loading worksheets...</p>
                </div>
            </div>
        )
    }

    if (!worksheets) {
        return (
            <div className="text-center py-12">
                <p className="text-gray-600">Worksheets not found</p>
                <button onClick={() => navigate('/orders/upload')} className="btn-primary mt-4">
                    Back to Upload
                </button>
            </div>
        )
    }

    const currentWorksheet = activeTab === 'fabric' ? worksheets.fabricCut : worksheets.tubeCut

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <button
                        onClick={() => navigate('/orders/upload')}
                        className="flex items-center space-x-2 text-brand-gold hover:text-brand-gold-dark transition-colors mb-3"
                    >
                        <ArrowLeft className="h-5 w-5" />
                        <span>Back to Upload</span>
                    </button>
                    <h1 className="text-3xl font-bold text-brand-navy">Worksheets</h1>
                    <p className="text-gray-600 mt-2">
                        {worksheets.fabricCut.customerName} - {new Date(worksheets.fabricCut.orderDate).toLocaleDateString()}
                    </p>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="card">
                <div className="border-b border-gray-200">
                    <div className="flex space-x-1 p-4">
                        <button
                            onClick={() => setActiveTab('fabric')}
                            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'fabric'
                                    ? 'bg-brand-gold text-white shadow-brand'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <FileSpreadsheet className="h-5 w-5" />
                            <span>Fabric Cut Worksheet</span>
                            <span className="badge bg-white bg-opacity-20 text-inherit">
                                {worksheets.fabricCut.items.length} items
                            </span>
                        </button>

                        <button
                            onClick={() => setActiveTab('tube')}
                            className={`flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors ${activeTab === 'tube'
                                    ? 'bg-brand-gold text-white shadow-brand'
                                    : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <FileText className="h-5 w-5" />
                            <span>Tube Cut Worksheet</span>
                            <span className="badge bg-white bg-opacity-20 text-inherit">
                                {worksheets.tubeCut.items.length} items
                            </span>
                        </button>
                    </div>
                </div>

                {/* Download Buttons */}
                <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Download className="h-4 w-4" />
                        <span>Download this worksheet:</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => handleDownload(currentWorksheet.type, 'csv')}
                            disabled={downloading === `${currentWorksheet.type}-csv`}
                            className="btn-outline text-sm px-4 py-2"
                        >
                            {downloading === `${currentWorksheet.type}-csv` ? (
                                <span className="flex items-center space-x-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-brand-gold border-t-transparent rounded-full" />
                                    <span>Downloading...</span>
                                </span>
                            ) : (
                                'Download CSV'
                            )}
                        </button>
                        <button
                            onClick={() => handleDownload(currentWorksheet.type, 'pdf')}
                            disabled={downloading === `${currentWorksheet.type}-pdf`}
                            className="btn-primary text-sm px-4 py-2"
                        >
                            {downloading === `${currentWorksheet.type}-pdf` ? (
                                <span className="flex items-center space-x-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                    <span>Downloading...</span>
                                </span>
                            ) : (
                                'Download PDF'
                            )}
                        </button>
                    </div>
                </div>

                {/* Worksheet Table */}
                <div className="table-container">
                    {activeTab === 'fabric' ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    {worksheets.fabricCut.columns.map((col, index) => (
                                        <th key={index}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {worksheets.fabricCut.items.map((item, index) => (
                                    <tr key={index} className={item.highlightFlag ? 'highlighted' : ''}>
                                        <td className="font-medium">{item.blindNumber}</td>
                                        <td>{item.location}</td>
                                        <td className="font-semibold">{item.widthMm}mm</td>
                                        <td className="font-semibold">{item.dropMm}mm</td>
                                        <td>{item.controlSide}</td>
                                        <td>{item.controlColor}</td>
                                        <td className="text-xs">{item.chainOrMotor}</td>
                                        <td>{item.rollType}</td>
                                        <td>{item.fabricType}</td>
                                        <td className="font-medium">{item.fabricColor}</td>
                                        <td>{item.bottomRailType}</td>
                                        <td>{item.bottomRailColor}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <table className="table">
                            <thead>
                                <tr>
                                    {worksheets.tubeCut.columns.map((col, index) => (
                                        <th key={index}>{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {worksheets.tubeCut.items.map((item, index) => (
                                    <tr key={index} className={item.highlightFlag ? 'highlighted' : ''}>
                                        <td className="font-medium">{item.blindNumber}</td>
                                        <td>{item.location}</td>
                                        <td className="font-semibold">{item.widthMm}mm</td>
                                        <td>{item.bottomRailType}</td>
                                        <td>{item.bottomRailColor}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Table Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
                    <p className="text-sm text-gray-600">
                        Total Items: <span className="font-semibold text-brand-navy">{currentWorksheet.items.length}</span>
                    </p>
                    {currentWorksheet.items.filter((item: any) => item.highlightFlag).length > 0 && (
                        <p className="text-sm text-yellow-700 flex items-center space-x-2">
                            <span className="h-3 w-3 bg-yellow-300 rounded-full" />
                            <span>
                                {currentWorksheet.items.filter((item: any) => item.highlightFlag).length} highlighted items
                                (duplicate fabrics)
                            </span>
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}
