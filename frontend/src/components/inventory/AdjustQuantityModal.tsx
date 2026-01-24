import { useState } from 'react'
import { X, Plus, Minus } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../../services/api'
import type { InventoryItem } from '../../types'

interface AdjustQuantityModalProps {
    isOpen: boolean
    onClose: () => void
    item: InventoryItem
}

export default function AdjustQuantityModal({ isOpen, onClose, item }: AdjustQuantityModalProps) {
    const queryClient = useQueryClient()
    const [adjustmentType, setAdjustmentType] = useState<'add' | 'remove'>('add')
    const [amount, setAmount] = useState<number>(0)
    const [notes, setNotes] = useState('')

    const adjustMutation = useMutation({
        mutationFn: (data: { id: string; change: number; notes: string }) =>
            inventoryApi.adjustQuantity(data.id, data.change, data.notes),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] })
            queryClient.invalidateQueries({ queryKey: ['item', item.id] })
            toast.success('Quantity adjusted successfully')
            onClose()
            setAmount(0)
            setNotes('')
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to adjust quantity')
        }
    })

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (amount <= 0) {
            toast.error('Amount must be greater than 0')
            return
        }

        const change = adjustmentType === 'add' ? amount : -amount
        adjustMutation.mutate({ id: item.id, change, notes })
    }

    if (!isOpen) return null

    const newBalance = adjustmentType === 'add'
        ? item.quantity + amount
        : item.quantity - amount

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>

                <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>

                    <h2 className="text-xl font-bold text-brand-navy mb-1">Adjust Quantity</h2>
                    <p className="text-gray-600 text-sm mb-4">
                        {item.itemName} {item.colorVariant && `(${item.colorVariant})`}
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="flex p-1 bg-gray-100 rounded-lg">
                            <button
                                type="button"
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'add'
                                        ? 'bg-white text-green-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                onClick={() => setAdjustmentType('add')}
                            >
                                <div className="flex items-center justify-center space-x-1">
                                    <Plus className="h-4 w-4" />
                                    <span>Add Stock</span>
                                </div>
                            </button>
                            <button
                                type="button"
                                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${adjustmentType === 'remove'
                                        ? 'bg-white text-red-700 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                onClick={() => setAdjustmentType('remove')}
                            >
                                <div className="flex items-center justify-center space-x-1">
                                    <Minus className="h-4 w-4" />
                                    <span>Remove Stock</span>
                                </div>
                            </button>
                        </div>

                        <div>
                            <label className="label">Amount ({item.unitType})</label>
                            <input
                                type="number"
                                min="0"
                                step={item.unitType === 'MM' ? '100' : '1'}
                                value={amount || ''}
                                onChange={(e) => setAmount(parseFloat(e.target.value))}
                                className="input text-lg font-semibold"
                                placeholder="0"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="label">New Balance Preview</label>
                            <div className={`p-3 rounded-lg border flex justify-between items-center ${newBalance < 0 ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                                }`}>
                                <span className="text-gray-600">Current: {item.quantity}</span>
                                <span className="font-bold text-brand-navy text-lg">
                                    → {newBalance} {item.unitType}
                                </span>
                            </div>
                        </div>

                        <div>
                            <label className="label">Reason / Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="input h-20 resize-none"
                                placeholder="e.g. Received new shipment, Damaged stock..."
                            />
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={adjustMutation.isPending || amount <= 0}
                            >
                                {adjustMutation.isPending ? 'Saving...' : 'Confirm Adjustment'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
