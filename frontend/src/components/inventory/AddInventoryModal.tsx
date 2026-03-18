import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { X } from 'lucide-react'
import { gooeyToast } from 'goey-toast'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../../services/api'
import { getMaterials, getFabricTypes, getFabricColors } from '../../data/fabrics'
import type { InventoryCategory } from '../../types'

interface AddInventoryModalProps {
    isOpen: boolean
    onClose: () => void
}

interface FormData {
    category: InventoryCategory
    // Fabric
    fabricBrand: string
    fabricType: string
    fabricColour: string
    // Generic
    itemName: string
    colorVariant: string
    // Common
    quantity: number
    minStockAlert: number
}

// ── Predefined items per category ──────────────────────────────────────────

const BOTTOM_BAR_ITEMS = ['D30', 'Oval']
const BAR_COLOURS      = ['White', 'Black', 'Dune', 'Bone', 'Anodised']

const CLIP_ITEMS = ['D30 Left Clip', 'D30 Right Clip', 'Oval Left Clip', 'Oval Right Clip']
const CLIP_COLOURS = BAR_COLOURS

const CHAIN_ITEMS = ['Chain 500mm', 'Chain 900mm', 'Chain 1200mm', 'Chain 1500mm', 'Chain 2000mm']
const CHAIN_TYPES = ['Stainless Steel', 'Plastic Pure White']

const ACMEDA_ITEMS = [
    'Acmeda winder-29mm', 'Acmeda Idler', 'Acmeda Clutch',
    'Acmeda Single Bracket set', 'Acmeda Extended Bracket set',
    'Acmeda Dual Bracket set Left', 'Acmeda Dual Bracket set Right',
]
const ACMEDA_BRACKET_COLOURS = ['White', 'Black', 'Dune', 'Bone', 'Anodised']

const TBS_ITEMS = [
    'TBS winder-32mm',
    'TBS Single Bracket set', 'TBS Dual Bracket set Left', 'TBS Dual Bracket set Right',
]
const TBS_BRACKET_COLOURS = ['White', 'Black', 'Dune', 'Bone', 'Anodised']

const MOTOR_ITEMS = [
    'Automate 1.1NM Li-Ion Quiet Motor', 'Automate 0.7NM Li-Ion Quiet Motor',
    'Automate 2NM Li-Ion Quiet Motor', 'Automate 3NM Li-Ion Motor',
    'Automate E6 6NM Motor',
    'Alpha 1NM Battery Motor', 'Alpha 2NM Battery Motor',
    'Alpha 3NM Battery Motor', 'Alpha AC 5NM Motor',
    'Single Bracket set', 'Extended Bracket set',
    'Dual Left Bracket set', 'Dual Right Bracket set',
]
const MOTOR_BRACKET_COLOURS = ['White', 'Black']

const ACCESSORY_ITEMS = ['Stop bolt', 'Safety lock']

// ── Resolve colour options for a given category + itemName ─────────────────
function getColourOptions(category: InventoryCategory, itemName: string): string[] | null {
    switch (category) {
        case 'BOTTOM_BAR':
            return BAR_COLOURS
        case 'BOTTOM_BAR_CLIP':
            return CLIP_COLOURS
        case 'CHAIN':
            return CHAIN_TYPES  // chain "colour" = material type
        case 'ACMEDA':
            if (itemName.includes('Bracket set')) return ACMEDA_BRACKET_COLOURS
            return null  // winder/idler/clutch have no colour
        case 'TBS':
            if (itemName.includes('Bracket set')) return TBS_BRACKET_COLOURS
            return null
        case 'MOTOR':
            if (itemName.includes('Bracket set')) return MOTOR_BRACKET_COLOURS
            return null  // motors themselves have no colour
        default:
            return null
    }
}

function getItemsForCategory(category: InventoryCategory): string[] | null {
    switch (category) {
        case 'BOTTOM_BAR':      return BOTTOM_BAR_ITEMS
        case 'BOTTOM_BAR_CLIP': return CLIP_ITEMS
        case 'CHAIN':           return CHAIN_ITEMS
        case 'ACMEDA':          return ACMEDA_ITEMS
        case 'TBS':             return TBS_ITEMS
        case 'MOTOR':           return MOTOR_ITEMS
        case 'ACCESSORY':       return ACCESSORY_ITEMS
        default:                return null
    }
}

// ── Component ──────────────────────────────────────────────────────────────

export default function AddInventoryModal({ isOpen, onClose }: AddInventoryModalProps) {
    const queryClient = useQueryClient()
    const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormData>({
        defaultValues: {
            category: 'FABRIC', fabricBrand: '', fabricType: '', fabricColour: '',
            itemName: '', colorVariant: '', quantity: 0,
        }
    })

    const category    = watch('category')
    const fabricBrand = watch('fabricBrand')
    const fabricType  = watch('fabricType')
    const itemName    = watch('itemName')

    const isFabric    = category === 'FABRIC'
    const unitType    = isFabric ? 'MM' : 'UNITS'
    const predefined  = isFabric ? null : getItemsForCategory(category)
    const colourOpts  = !isFabric && itemName ? getColourOptions(category, itemName) : null

    // Reset fields on category change
    useEffect(() => {
        setValue('fabricBrand', ''); setValue('fabricType', ''); setValue('fabricColour', '')
        setValue('itemName', ''); setValue('colorVariant', '')
    }, [category, setValue])

    useEffect(() => { setValue('fabricType', ''); setValue('fabricColour', '') }, [fabricBrand, setValue])
    useEffect(() => { setValue('fabricColour', '') }, [fabricType, setValue])
    useEffect(() => { setValue('colorVariant', '') }, [itemName, setValue])

    const addMutation = useMutation({
        mutationFn: inventoryApi.addInventory,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory'] })
            gooeyToast.success('Stock updated successfully')
            reset(); onClose()
        },
        onError: (error: any) => {
            gooeyToast.error(error.response?.data?.message || 'Failed to add item')
        }
    })

    const onSubmit = (data: FormData) => {
        const finalItemName     = isFabric ? `${data.fabricBrand} - ${data.fabricType}` : data.itemName
        const finalColorVariant = isFabric ? (data.fabricColour || null) : (data.colorVariant || null)

        addMutation.mutate({
            category: data.category, itemName: finalItemName, colorVariant: finalColorVariant,
            quantity: data.quantity, minStockAlert: data.minStockAlert || null, unitType,
        } as any)
    }

    if (!isOpen) return null

    const materials     = getMaterials()
    const fabricTypes   = fabricBrand ? getFabricTypes(fabricBrand) : []
    const fabricColours = (fabricBrand && fabricType) ? getFabricColors(fabricBrand, fabricType) : []

    // Label for the colour dropdown (chains use "Material Type" instead of "Colour")
    const colourLabel = category === 'CHAIN' ? 'Chain Type *' : 'Colour *'

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black opacity-50" onClick={onClose} />

                <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-fade-in">
                    <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                        <X className="h-6 w-6" />
                    </button>

                    <h2 className="text-xl font-bold text-brand-navy mb-1">Add / Restock Item</h2>
                    <p className="text-xs text-gray-400 mb-4">
                        If the item already exists, stock will be added to its current quantity.
                    </p>

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                        {/* Category */}
                        <div>
                            <label className="label">Category</label>
                            <select {...register('category')} className="input">
                                <option value="FABRIC">Fabric</option>
                                <option value="BOTTOM_BAR">Bottom Bar</option>
                                <option value="BOTTOM_BAR_CLIP">Bottom Bar Clip</option>
                                <option value="CHAIN">Chain</option>
                                <option value="ACMEDA">Acmeda</option>
                                <option value="TBS">TBS</option>
                                <option value="MOTOR">Motor</option>
                                <option value="ACCESSORY">Accessory</option>
                            </select>
                        </div>

                        {/* ── FABRIC: brand → type → colour ── */}
                        {isFabric && (
                            <>
                                <div>
                                    <label className="label">Material Brand *</label>
                                    <select {...register('fabricBrand', { required: 'Required' })} className="input">
                                        <option value="">Select brand...</option>
                                        {materials.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    {errors.fabricBrand && <p className="text-red-500 text-xs mt-1">{errors.fabricBrand.message}</p>}
                                </div>
                                <div>
                                    <label className="label">Fabric Type *</label>
                                    <select {...register('fabricType', { required: 'Required' })} className="input" disabled={!fabricBrand}>
                                        <option value="">Select type...</option>
                                        {fabricTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    {errors.fabricType && <p className="text-red-500 text-xs mt-1">{errors.fabricType.message}</p>}
                                </div>
                                <div>
                                    <label className="label">Colour *</label>
                                    <select {...register('fabricColour', { required: 'Required' })} className="input" disabled={!fabricType}>
                                        <option value="">Select colour...</option>
                                        {fabricColours.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    {errors.fabricColour && <p className="text-red-500 text-xs mt-1">{errors.fabricColour.message}</p>}
                                </div>
                            </>
                        )}

                        {/* ── NON-FABRIC: item select → colour select ── */}
                        {!isFabric && (
                            <>
                                <div>
                                    <label className="label">Item *</label>
                                    {predefined ? (
                                        <select {...register('itemName', { required: 'Required' })} className="input">
                                            <option value="">Select item...</option>
                                            {predefined.map(i => <option key={i} value={i}>{i}</option>)}
                                        </select>
                                    ) : (
                                        <input {...register('itemName', { required: 'Required' })} className="input" placeholder="Item name" />
                                    )}
                                    {errors.itemName && <p className="text-red-500 text-xs mt-1">{errors.itemName.message}</p>}
                                </div>

                                {/* Colour / variant dropdown */}
                                {colourOpts && colourOpts.length > 0 && (
                                    <div>
                                        <label className="label">{colourLabel}</label>
                                        <select {...register('colorVariant', { required: 'Required' })} className="input">
                                            <option value="">Select...</option>
                                            {colourOpts.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                        {errors.colorVariant && <p className="text-red-500 text-xs mt-1">{errors.colorVariant.message}</p>}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Quantity + Min Alert */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="label">Quantity ({isFabric ? 'mm' : 'pcs'}) *</label>
                                <input type="number" {...register('quantity', { required: true, min: 0, valueAsNumber: true })} className="input" />
                            </div>
                            <div>
                                <label className="label">Min Stock Alert</label>
                                <input type="number" {...register('minStockAlert', { min: 0, valueAsNumber: true })} className="input" />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-3 mt-6">
                            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
                            <button type="submit" className="btn-primary" disabled={addMutation.isPending}>
                                {addMutation.isPending ? 'Adding...' : 'Add Stock'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
