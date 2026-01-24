import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../../services/api'
import type { InventoryCategory } from '../../types'

interface AddInventoryModalProps {
    isOpen: boolean
    onClose: () => void
}

interface AddInventoryForm {
    category: InventoryCategory
    itemName: string
    colorVariant: string
    quantity: number
    minStockAlert: number
}

export default function AddInventoryModal({ isOpen, onClose }: AddInventoryModalProps) {
    const queryClient = useQueryClient()
    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<AddInventoryForm>({
        defaultValues: {
            category: 'FABRIC',
            quantity: 0,
        }
    })

    const category = watch('category')
    const unitType = category === 'FABRIC' ? 'MM' : 'UNITS'

    const addMutation = useMutation({
        mutationFn: inventoryApi.addInventory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] })
            toast.success('Inventory item added successfully')
            reset()
            onClose()
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Failed to add item')
        }
    })

    const onSubmit = (data: AddInventoryForm) => {
        addMutation.mutate({
            ...data,
            colorVariant: data.colorVariant || null,
            minStockAlert: data.minStockAlert || null,
            unitType,
        })
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>

                <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>

                    <h2 className="text-xl font-bold text-brand-navy mb-4">Add New Inventory Item</h2>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        <div>
                            <label className="label">Category</label>
                            <select {...register('category')} className="input">
                                <option value="FABRIC">Fabric</option>
                                <option value="BOTTOM_BAR">Bottom Bar</option>
                                <option value="MOTOR">Motor</option>
                                <option value="CHAIN">Chain</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Item Name *</label>
                            <input
                                {...register('itemName', { required: 'Item name is required' })}
                                className="input"
                                placeholder="e.g. Vista Silver"
                            />
                            {errors.itemName && <p className="text-red-500 text-sm mt-1">{errors.itemName.message}</p>}
                        </div>

                        <div>
                            <label className="label">Color / Variant</label>
                            <input
                                {...register('colorVariant')}
                                className="input"
                                placeholder="e.g. White"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Initial Quantity ({unitType}) *</label>
                                <input
                                    type="number"
                                    {...register('quantity', { required: true, min: 0 })}
                                    className="input"
                                />
                            </div>

                            <div>
                                <label className="label">Min Stock Alert</label>
                                <input
                                    type="number"
                                    {...register('minStockAlert', { min: 0 })}
                                    className="input"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={addMutation.isPending}
                            >
                                {addMutation.isPending ? 'Adding...' : 'Add Item'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
