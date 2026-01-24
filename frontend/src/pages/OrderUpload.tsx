import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { orderApi } from '../services/api'
import type { Order, InsufficientItem } from '../types'

export default function OrderUpload() {
    const navigate = useNavigate()
    const [customerName, setCustomerName] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [uploadedOrder, setUploadedOrder] = useState<Order | null>(null)
    const [inventoryIssues, setInventoryIssues] = useState<InsufficientItem[]>([])
    const [isConfirming, setIsConfirming] = useState(false)

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        const file = acceptedFiles[0]
        if (!file) return

        if (!customerName.trim()) {
            toast.error('Please enter customer name first')
            return
        }

        setIsUploading(true)
        setInventoryIssues([])

        try {
            const response = await orderApi.uploadOrder(file, customerName)

            if (response.status === 'success') {
                setUploadedOrder(response.data)
                toast.success('Order uploaded and parsed successfully!')
            }
        } catch (error: any) {
            const errorData = error.response?.data

            if (errorData?.insufficientItems) {
                setInventoryIssues(errorData.insufficientItems)
                toast.error('Insufficient inventory for this order')
            } else {
                toast.error(errorData?.message || 'Failed to upload order')
            }
        } finally {
            setIsUploading(false)
        }
    }, [customerName])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/vnd.ms-excel.sheet.macroEnabled.12': ['.xlsm'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
        },
        maxFiles: 1,
        maxSize: 10 * 1024 * 1024, // 10MB
    })

    const handleConfirmOrder = async () => {
        if (!uploadedOrder) return

        setIsConfirming(true)
        try {
            await orderApi.confirmOrder(uploadedOrder.id)
            toast.success('Order confirmed! Inventory deducted successfully.')
            navigate(`/orders/${uploadedOrder.id}/worksheets`)
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to confirm order')
        } finally {
            setIsConfirming(false)
        }
    }

    const handleReset = () => {
        setUploadedOrder(null)
        setInventoryIssues([])
        setCustomerName('')
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-brand-navy">Upload Order</h1>
                    <p className="text-gray-600 mt-2">
                        Upload Excel order sheet to generate cutting worksheets
                    </p>
                </div>
            </div>

            {!uploadedOrder ? (
                <>
                    {/* Customer Name Input */}
                    <div className="card p-6">
                        <label className="label">Customer Name *</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="Enter customer name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            disabled={isUploading}
                        />
                    </div>

                    {/* File Upload Area */}
                    <div
                        {...getRootProps()}
                        className={`card p-12 border-2 border-dashed transition-all cursor-pointer ${isDragActive
                            ? 'border-brand-gold bg-brand-gold bg-opacity-5'
                            : 'border-gray-300 hover:border-brand-gold'
                            } ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        <input {...getInputProps()} disabled={isUploading} />

                        <div className="flex flex-col items-center justify-center space-y-4">
                            <div className="p-6 bg-brand-gold bg-opacity-10 rounded-full">
                                {isUploading ? (
                                    <div className="animate-spin h-12 w-12 border-4 border-brand-gold border-t-transparent rounded-full" />
                                ) : (
                                    <FileSpreadsheet className="h-12 w-12 text-brand-gold" />
                                )}
                            </div>

                            <div className="text-center">
                                {isUploading ? (
                                    <>
                                        <p className="text-lg font-semibold text-brand-navy">Processing Order...</p>
                                        <p className="text-sm text-gray-500 mt-1">Please wait while we parse your file</p>
                                    </>
                                ) : (
                                    <>
                                        <p className="text-lg font-semibold text-brand-navy">
                                            {isDragActive ? 'Drop the file here' : 'Drag & drop Excel file here'}
                                        </p>
                                        <p className="text-sm text-gray-500 mt-1">
                                            or click to browse (.xlsm, .xlsx files only, max 10MB)
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <>
                    {/* Order Summary */}
                    <div className="card">
                        <div className="p-6 bg-gradient-to-r from-brand-gold to-brand-gold-dark">
                            <div className="flex items-center justify-between text-white">
                                <div>
                                    <h2 className="text-2xl font-bold">{uploadedOrder.customerName}</h2>
                                    <p className="text-sm opacity-90 mt-1">{uploadedOrder.fileName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-bold">{uploadedOrder.itemCount}</p>
                                    <p className="text-sm opacity-90">Items</p>
                                </div>
                            </div>
                        </div>

                        {uploadedOrder.duplicateCount > 0 && (
                            <div className="p-4 bg-yellow-50 border-t border-yellow-200 flex items-center space-x-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600" />
                                <p className="text-sm text-yellow-800">
                                    <span className="font-semibold">{uploadedOrder.duplicateCount} items</span> have duplicate fabric/color combinations
                                    (highlighted in yellow)
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Inventory Issues */}
                    {inventoryIssues.length > 0 && (
                        <div className="card border-red-300">
                            <div className="p-4 bg-red-50 border-b border-red-200">
                                <div className="flex items-center space-x-3">
                                    <XCircle className="h-6 w-6 text-red-600" />
                                    <h3 className="font-semibold text-red-900">Insufficient Inventory</h3>
                                </div>
                            </div>
                            <div className="p-6">
                                <div className="space-y-2">
                                    {inventoryIssues.map((issue, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-200">
                                            <div>
                                                <p className="font-medium text-gray-900">{issue.itemType}: {issue.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    Available: <span className="font-semibold text-red-600">{issue.available}</span> |
                                                    Required: <span className="font-semibold">{issue.required}</span>
                                                </p>
                                            </div>
                                            <span className="badge badge-error">
                                                Short by {issue.required - issue.available}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Preview Table */}
                    <div className="card">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-brand-navy">Order Preview</h3>
                            <p className="text-sm text-gray-600 mt-1">Review parsed data before confirming</p>
                        </div>

                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Blind No</th>
                                        <th>Location</th>
                                        <th>Width (mm)</th>
                                        <th>Drop (mm)</th>
                                        <th>Control Side</th>
                                        <th>Fabric</th>
                                        <th>Color</th>
                                        <th>Bottom Rail</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {uploadedOrder.items.map((item, index) => (
                                        <tr key={index} className={item.highlightFlag ? 'highlighted' : ''}>
                                            <td className="font-medium">{item.blindNumber}</td>
                                            <td>{item.location}</td>
                                            <td>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{item.widthMm}mm</span>
                                                    <span className="text-xs text-gray-500">({item.originalWidthMm} - 28)</span>
                                                </div>
                                            </td>
                                            <td>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{item.dropMm}mm</span>
                                                    <span className="text-xs text-gray-500">({item.originalDropMm} + 150)</span>
                                                </div>
                                            </td>
                                            <td>{item.controlSide}</td>
                                            <td>{item.fabricType}</td>
                                            <td>{item.fabricColor}</td>
                                            <td>{item.bottomRailType} - {item.bottomRailColor}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                        <button
                            onClick={handleReset}
                            className="btn-outline"
                            disabled={isConfirming}
                        >
                            Upload New Order
                        </button>

                        <button
                            onClick={handleConfirmOrder}
                            disabled={inventoryIssues.length > 0 || isConfirming}
                            className="btn-primary flex items-center space-x-2"
                        >
                            {isConfirming ? (
                                <>
                                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                    <span>Confirming...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-5 w-5" />
                                    <span>Confirm Order & Generate Worksheets</span>
                                </>
                            )}
                        </button>
                    </div>
                </>
            )}
        </div>
    )
}
