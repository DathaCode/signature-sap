import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Search, Filter, Plus, AlertTriangle,
    Package, Layers, Link2, Settings,
    History, Edit2, ShieldCheck
} from 'lucide-react'
import { inventoryApi } from '../services/api'
import AddInventoryModal from '../components/inventory/AddInventoryModal'
import AdjustQuantityModal from '../components/inventory/AdjustQuantityModal'
import ItemHistoryModal from '../components/inventory/ItemHistoryModal'
import type { InventoryItem, InventoryCategory } from '../types'

type TabId = InventoryCategory | 'ALL'

interface TabDef {
    id: TabId
    label: string
    icon: React.ElementType
    description: string
    badgeColor: string
}

const TABS: TabDef[] = [
    { id: 'ALL',            label: 'All Items',      icon: Package,    description: '',                              badgeColor: 'bg-gray-100 text-gray-700'   },
    { id: 'FABRIC',         label: 'Fabrics',        icon: Layers,     description: 'Fabric rolls by material/type', badgeColor: 'bg-blue-100 text-blue-700'   },
    { id: 'BOTTOM_BAR',     label: 'Bottom Bars',    icon: Link2,      description: 'D30 & Oval rails',             badgeColor: 'bg-amber-100 text-amber-700' },
    { id: 'BOTTOM_BAR_CLIP',label: 'BB Clips',       icon: Link2,      description: 'Left / Right clips',           badgeColor: 'bg-orange-100 text-orange-700'},
    { id: 'CHAIN',          label: 'Chains',         icon: Link2,      description: '500–2000 mm lengths',          badgeColor: 'bg-teal-100 text-teal-700'   },
    { id: 'ACMEDA',         label: 'Acmeda',         icon: Settings,   description: 'Winder, idler, clutch, brackets', badgeColor: 'bg-purple-100 text-purple-700'},
    { id: 'TBS',            label: 'TBS',            icon: Settings,   description: 'Winder + brackets',            badgeColor: 'bg-indigo-100 text-indigo-700'},
    { id: 'MOTOR',          label: 'Motors',         icon: Settings,   description: 'Automate & Alpha motors + brackets', badgeColor: 'bg-green-100 text-green-700'},
    { id: 'ACCESSORY',      label: 'Accessories',    icon: ShieldCheck,description: 'Stop bolt, safety lock',       badgeColor: 'bg-red-100 text-red-700'     },
]

const CATEGORY_LABELS: Record<string, string> = {
    FABRIC:          'Fabric',
    BOTTOM_BAR:      'Bottom Bar',
    BOTTOM_BAR_CLIP: 'BB Clip',
    CHAIN:           'Chain',
    ACMEDA:          'Acmeda',
    TBS:             'TBS',
    MOTOR:           'Motor',
    ACCESSORY:       'Accessory',
}

const BADGE_COLORS: Record<string, string> = {
    FABRIC:          'bg-blue-100 text-blue-700',
    BOTTOM_BAR:      'bg-amber-100 text-amber-700',
    BOTTOM_BAR_CLIP: 'bg-orange-100 text-orange-700',
    CHAIN:           'bg-teal-100 text-teal-700',
    ACMEDA:          'bg-purple-100 text-purple-700',
    TBS:             'bg-indigo-100 text-indigo-700',
    MOTOR:           'bg-green-100 text-green-700',
    ACCESSORY:       'bg-red-100 text-red-700',
}

export default function InventoryDashboard() {
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<TabId>('ALL')
    const [showLowStock, setShowLowStock] = useState(false)

    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [adjustModalOpen, setAdjustModalOpen] = useState(false)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['inventory', activeTab, search],
        queryFn: () => inventoryApi.getInventory({
            category: activeTab === 'ALL' ? undefined : activeTab,
            search: search || undefined,
        }),
    })

    const filteredItems = items.filter(item => {
        if (showLowStock && !item.isLowStock) return false
        return true
    })

    const lowStockCount = items.filter(i => i.isLowStock).length

    const handleAdjust = (item: InventoryItem) => {
        setSelectedItem(item)
        setAdjustModalOpen(true)
    }

    const handleHistory = (item: InventoryItem) => {
        setSelectedItem(item)
        setHistoryModalOpen(true)
    }

    const activeTabDef = TABS.find(t => t.id === activeTab)!

    return (
        <div className="space-y-6">
            {/* ── Header Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="card p-5 bg-gradient-to-br from-brand-navy to-brand-navy-light text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-300 text-sm">Total Inventory Items</p>
                            <h3 className="text-3xl font-bold mt-1">{items.length}</h3>
                        </div>
                        <Package className="h-8 w-8 opacity-40" />
                    </div>
                </div>

                <div className={`card p-5 border-l-4 ${lowStockCount > 0 ? 'border-l-yellow-500' : 'border-l-green-500'}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">Low Stock Alerts</p>
                            <h3 className={`text-3xl font-bold mt-1 ${lowStockCount > 0 ? 'text-yellow-600' : 'text-gray-900'}`}>
                                {lowStockCount}
                            </h3>
                        </div>
                        <AlertTriangle className={`h-8 w-8 opacity-40 ${lowStockCount > 0 ? 'text-yellow-500' : 'text-green-500'}`} />
                    </div>
                </div>

                <div
                    className="card p-5 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors border-2 border-dashed border-gray-200"
                    onClick={() => setIsAddModalOpen(true)}
                >
                    <div className="bg-brand-gold bg-opacity-10 p-3 rounded-full mb-2">
                        <Plus className="h-6 w-6 text-brand-gold" />
                    </div>
                    <span className="font-medium text-brand-navy">Add New Item</span>
                </div>
            </div>

            {/* ── Main Card ── */}
            <div className="card overflow-hidden">
                {/* Category Tabs */}
                <div className="border-b border-gray-200 bg-gray-50 px-4 pt-4">
                    <div className="flex gap-1 overflow-x-auto pb-3 scrollbar-hide">
                        {TABS.map(tab => {
                            const Icon = tab.icon
                            const isActive = activeTab === tab.id
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                                        isActive
                                            ? 'bg-brand-navy text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-white hover:shadow-sm'
                                    }`}
                                >
                                    <Icon className="h-4 w-4 shrink-0" />
                                    <span>{tab.label}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Active tab description */}
                    {activeTabDef.description && (
                        <p className="text-sm text-gray-500 hidden sm:block">{activeTabDef.description}</p>
                    )}
                    <div className="flex-1" />

                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search items..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="input pl-9 py-2 text-sm"
                        />
                    </div>

                    {/* Low stock filter */}
                    <button
                        onClick={() => setShowLowStock(!showLowStock)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                            showLowStock
                                ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <Filter className="h-4 w-4" />
                        <span>Low Stock</span>
                        {showLowStock && lowStockCount > 0 && (
                            <span className="bg-yellow-500 text-white text-xs rounded-full px-1.5">{lowStockCount}</span>
                        )}
                    </button>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Item</th>
                                {activeTab === 'ALL' && (
                                    <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Category</th>
                                )}
                                <th className="text-left py-3 px-4 font-medium text-gray-600 text-sm">Color / Variant</th>
                                <th className="text-right py-3 px-4 font-medium text-gray-600 text-sm">Stock</th>
                                <th className="text-right py-3 px-4 font-medium text-gray-600 text-sm">Min Alert</th>
                                <th className="text-center py-3 px-4 font-medium text-gray-600 text-sm">Status</th>
                                <th className="py-3 px-4" />
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12">
                                        <div className="animate-spin h-8 w-8 border-2 border-brand-gold border-t-transparent rounded-full mx-auto mb-2" />
                                        <p className="text-gray-500 text-sm">Loading inventory...</p>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                                        {showLowStock ? 'No low-stock items in this category' : 'No items found'}
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50 group transition-colors">
                                        {/* Item name */}
                                        <td className="py-3 px-4">
                                            <p className="font-medium text-gray-900 text-sm">{item.itemName}</p>
                                        </td>

                                        {/* Category badge (ALL tab only) */}
                                        {activeTab === 'ALL' && (
                                            <td className="py-3 px-4">
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${BADGE_COLORS[item.category] || 'bg-gray-100 text-gray-600'}`}>
                                                    {CATEGORY_LABELS[item.category] || item.category}
                                                </span>
                                            </td>
                                        )}

                                        {/* Color variant */}
                                        <td className="py-3 px-4">
                                            {item.colorVariant ? (
                                                <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                                                    <span className="w-3 h-3 rounded-full border border-gray-300 inline-block"
                                                        style={{ backgroundColor: getColorHex(item.colorVariant) }} />
                                                    {item.colorVariant}
                                                </span>
                                            ) : (
                                                <span className="text-gray-300 text-sm">—</span>
                                            )}
                                        </td>

                                        {/* Stock quantity */}
                                        <td className="py-3 px-4 text-right">
                                            <span className={`font-mono font-semibold text-sm ${item.isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                                                {Number(item.quantity).toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-400 ml-1 uppercase">{item.unitType === 'MM' ? 'm' : 'pcs'}</span>
                                        </td>

                                        {/* Min stock alert */}
                                        <td className="py-3 px-4 text-right text-sm text-gray-500">
                                            {item.minStockAlert != null
                                                ? `≥ ${Number(item.minStockAlert).toLocaleString()}`
                                                : <span className="text-gray-300">—</span>}
                                        </td>

                                        {/* Status badge */}
                                        <td className="py-3 px-4 text-center">
                                            {item.quantity === 0 ? (
                                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                                    Out of Stock
                                                </span>
                                            ) : item.isLowStock ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-700">
                                                    <AlertTriangle className="h-3 w-3" /> Low Stock
                                                </span>
                                            ) : (
                                                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                                    In Stock
                                                </span>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="py-3 px-4">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleAdjust(item)}
                                                    className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="Adjust Quantity"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleHistory(item)}
                                                    className="p-1.5 text-gray-400 hover:text-brand-navy hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="View History"
                                                >
                                                    <History className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-sm text-gray-500 flex justify-between items-center">
                    <span>
                        {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
                        {showLowStock && ' (low stock only)'}
                    </span>
                    {lowStockCount > 0 && (
                        <span className="flex items-center gap-1 text-yellow-600 font-medium">
                            <AlertTriangle className="h-4 w-4" />
                            {lowStockCount} item{lowStockCount !== 1 ? 's' : ''} need restocking
                        </span>
                    )}
                </div>
            </div>

            {/* Modals */}
            <AddInventoryModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />

            {selectedItem && (
                <>
                    <AdjustQuantityModal
                        isOpen={adjustModalOpen}
                        onClose={() => { setAdjustModalOpen(false); setSelectedItem(null) }}
                        item={selectedItem}
                    />
                    <ItemHistoryModal
                        isOpen={historyModalOpen}
                        onClose={() => { setHistoryModalOpen(false); setSelectedItem(null) }}
                        item={selectedItem}
                    />
                </>
            )}
        </div>
    )
}

/**
 * Map common colour names to approximate hex values for the colour swatch.
 */
function getColorHex(colour: string): string {
    const map: Record<string, string> = {
        white:      '#ffffff',
        black:      '#1a1a1a',
        dune:       '#c2a97b',
        bone:       '#e8dcc8',
        anodised:   '#b0b8c0',
        sandstone:  '#d4b48a',
        silver:     '#c0c0c0',
        grey:       '#808080',
    }
    return map[colour.toLowerCase()] || '#e5e7eb'
}
