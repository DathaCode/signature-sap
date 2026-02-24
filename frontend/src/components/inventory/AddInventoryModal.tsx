import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../../services/api'
import { getMaterials, getFabricTypes, getFabricColors } from '../../data/fabrics'
import type { InventoryCategory } from '../../types'

interface AddInventoryModalProps {
    isOpen: boolean
    onClose: () => void
}

interface AddInventoryForm {
    category: InventoryCategory
    // Fabric-specific
    fabricBrand: string
    fabricType: string
    fabricColour: string
    // Non-fabric
    itemName: string
    colorVariant: string
    // Common
    quantity: number
    minStockAlert: number
}

// Predefined options per category for non-fabric items
const CATEGORY_ITEMS: Partial<Record<InventoryCategory, string[]>> = {
    BOTTOM_BAR:      ['D30', 'Oval'],
    BOTTOM_BAR_CLIP: ['Left Clip', 'Right Clip'],
    CHAIN:           ['Chain 500mm', 'Chain 900mm', 'Chain 1200mm', 'Chain 1500mm', 'Chain 2000mm'],
    ACMEDA: [
        'Acmeda winder-29mm', 'Acmeda Idler', 'Acmeda Clutch',
        'Acmeda Single Bracket set', 'Acmeda Extended Bracket set',
        'Acmeda Dual Bracket set Left', 'Acmeda Dual Bracket set Right',
    ],
    TBS: [
        'TBS winder-32mm',
        'TBS Single Bracket set', 'TBS Dual Bracket set Left', 'TBS Dual Bracket set Right',
    ],
    MOTOR: [
        'Automate 1.1NM Li-Ion Quiet Motor', 'Automate 0.7NM Li-Ion Quiet Motor',
        'Automate 2NM Li-Ion Quiet Motor', 'Automate 3NM Li-Ion Motor',
        'Automate E6 6NM Motor',
        'Alpha 1NM Battery Motor', 'Alpha 2NM Battery Motor',
        'Alpha 3NM Battery Motor', 'Alpha AC 5NM Motor',
    ],
    ACCESSORY: ['Stop bolt', 'Safety lock'],
}

// Categories where colour applies
const COLOUR_ITEMS = new Set([
    'D30', 'Oval',
    'Acmeda Single Bracket set', 'Acmeda Extended Bracket set',
    'Acmeda Dual Bracket set Left', 'Acmeda Dual Bracket set Right',
    'TBS Single Bracket set', 'TBS Dual Bracket set Left', 'TBS Dual Bracket set Right',
])

const BRACKET_COLOURS = ['White', 'Black']
const BAR_COLOURS     = ['White', 'Black', 'Dune', 'Bone', 'Anodised']

function getColourOptions(itemName: string): string[] | null {
    if (itemName.includes('Bracket set')) return BRACKET_COLOURS
    if (itemName === 'D30' || itemName === 'Oval') return BAR_COLOURS
    return null
}

export default function AddInventoryModal({ isOpen, onClose }: AddInventoryModalProps) {
    const queryClient = useQueryClient()

    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<AddInventoryForm>({
        defaultValues: {
            category:     'FABRIC',
            fabricBrand:  '',
            fabricType:   '',
            fabricColour: '',
            itemName:     '',
            colorVariant: '',
            quantity:     0,
        }
    })

    const category     = watch('category')
    const fabricBrand  = watch('fabricBrand')
    const fabricType   = watch('fabricType')
    const itemNameVal  = watch('itemName')

    const isFabric     = category === 'FABRIC'
    const unitType     = isFabric ? 'MM' : 'UNITS'
    const predefined   = isFabric ? null : CATEGORY_ITEMS[category]
    const colourOpts   = !isFabric && itemNameVal ? getColourOptions(itemNameVal) : null

    // Reset dependent fields when category changes
    useEffect(() => {
        setValue('fabricBrand',  '')
        setValue('fabricType',   '')
        setValue('fabricColour', '')
        setValue('itemName',     '')
        setValue('colorVariant', '')
    }, [category, setValue])

    // Reset fabric type & colour when brand changes
    useEffect(() => {
        setValue('fabricType',   '')
        setValue('fabricColour', '')
    }, [fabricBrand, setValue])

    // Reset fabric colour when type changes
    useEffect(() => {
        setValue('fabricColour', '')
    }, [fabricType, setValue])

    // Reset colorVariant when itemName changes
    useEffect(() => {
        setValue('colorVariant', '')
    }, [itemNameVal, setValue])

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
        const finalItemName     = isFabric
            ? `${data.fabricBrand} - ${data.fabricType}`
            : data.itemName
        const finalColorVariant = isFabric
            ? (data.fabricColour || null)
            : (data.colorVariant || null)

        addMutation.mutate({
            category:      data.category,
            itemName:      finalItemName,
            colorVariant:  finalColorVariant,
            quantity:      data.quantity,
            minStockAlert: data.minStockAlert || null,
            unitType,
        } as any)
    }

    if (!isOpen) return null

    const materials      = getMaterials()
    const fabricTypes    = fabricBrand ? getFabricTypes(fabricBrand) : []
    const fabricColours  = (fabricBrand && fabricType) ? getFabricColors(fabricBrand, fabricType) : []

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />

                <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>

                    <h2 className="text-xl font-bold text-brand-navy mb-4">Add Inventory Item</h2>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Category */}
                        <div>
                            <label className="label">Category</label>
                            <select {...register('category')} className="input">
                                <option value="FABRIC">Fabric</option>
                                <option value="BOTTOM_BAR">Bottom Bars</option>
                                <option value="BOTTOM_BAR_CLIP">Bottom Bar Clips</option>
                                <option value="CHAIN">Chains</option>
                                <option value="ACMEDA">Acmeda (winder-29mm)</option>
                                <option value="TBS">TBS (winder-32mm)</option>
                                <option value="MOTOR">Motors (Automate / Alpha)</option>
                                <option value="ACCESSORY">Accessories</option>
                            </select>
                        </div>

                        {/* ── FABRIC: hierarchical brand → type → colour ── */}
                        {isFabric && (
                            <>
                                <div>
                                    <label className="label">Material Brand *</label>
                                    <select
                                        {...register('fabricBrand', { required: 'Material brand is required' })}
                                        className="input"
                                    >
                                        <option value="">Select brand...</option>
                                        {materials.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    {errors.fabricBrand && <p className="text-red-500 text-sm mt-1">{errors.fabricBrand.message}</p>}
                                </div>

                                <div>
                                    <label className="label">Fabric Type *</label>
                                    <select
                                        {...register('fabricType', { required: 'Fabric type is required' })}
                                        className="input"
                                        disabled={!fabricBrand}
                                    >
                                        <option value="">Select type...</option>
                                        {fabricTypes.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    {errors.fabricType && <p className="text-red-500 text-sm mt-1">{errors.fabricType.message}</p>}
                                </div>

                                <div>
                                    <label className="label">Colour *</label>
                                    <select
                                        {...register('fabricColour', { required: 'Colour is required' })}
                                        className="input"
                                        disabled={!fabricType}
                                    >
                                        <option value="">Select colour...</option>
                                        {fabricColours.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                    {errors.fabricColour && <p className="text-red-500 text-sm mt-1">{errors.fabricColour.message}</p>}
                                </div>
                            </>
                        )}

                        {/* ── NON-FABRIC: predefined or free-text item name ── */}
                        {!isFabric && (
                            <>
                                <div>
                                    <label className="label">Item *</label>
                                    {predefined ? (
                                        <select
                                            {...register('itemName', { required: 'Item is required' })}
                                            className="input"
                                        >
                                            <option value="">Select item...</option>
                                            {predefined.map(item => (
                                                <option key={item} value={item}>{item}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            {...register('itemName', { required: 'Item name is required' })}
                                            className="input"
                                            placeholder="Item name"
                                        />
                                    )}
                                    {errors.itemName && <p className="text-red-500 text-sm mt-1">{errors.itemName.message}</p>}
                                </div>

                                {/* Colour — dropdown for bracket/bar items, free-text otherwise */}
                                {colourOpts ? (
                                    <div>
                                        <label className="label">Colour</label>
                                        <select {...register('colorVariant')} className="input">
                                            <option value="">Select colour...</option>
                                            {colourOpts.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : !COLOUR_ITEMS.has(itemNameVal) && itemNameVal && (
                                    // Only show free-text colour for items that aren't brackets/bars
                                    <div>
                                        <label className="label">Colour / Variant</label>
                                        <input
                                            {...register('colorVariant')}
                                            className="input"
                                            placeholder="Optional"
                                        />
                                    </div>
                                )}
                            </>
                        )}

                        {/* Quantity + Min Alert */}
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
