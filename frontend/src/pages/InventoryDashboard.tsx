import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Search, Filter, Plus, AlertTriangle,
    Package, LayoutGrid, Scissors, Disc, Settings,
    History, Edit2
} from 'lucide-react'
import { inventoryApi } from '../services/api'
import AddInventoryModal from '../components/inventory/AddInventoryModal'
import AdjustQuantityModal from '../components/inventory/AdjustQuantityModal'
import ItemHistoryModal from '../components/inventory/ItemHistoryModal'
import type { InventoryItem, InventoryCategory } from '../types'

export default function InventoryDashboard() {
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState<InventoryCategory | 'ALL'>('ALL')
    const [showLowStock, setShowLowStock] = useState(false)

    // Modals state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null)
    const [adjustModalOpen, setAdjustModalOpen] = useState(false)
    const [historyModalOpen, setHistoryModalOpen] = useState(false)

    const { data: items = [], isLoading } = useQuery({
        queryKey: ['inventory', activeTab, search],
        queryFn: () => inventoryApi.getInventory({
            category: activeTab === 'ALL' ? undefined : activeTab,
            search: search || undefined
        })
    })

    // Filter items logic
    const filteredItems = items.filter(item => {
        if (showLowStock && !item.isLowStock) return false
        return true
    })

    // Stats calculation
    const stats = {
        totalItems: items.length,
        lowStock: items.filter(i => i.isLowStock).length,
        totalValue: 0 // Placeholder
    }

    const handleAdjustQuantity = (item: InventoryItem) => {
        setSelectedItem(item)
        setAdjustModalOpen(true)
    }

    const handleViewHistory = (item: InventoryItem) => {
        setSelectedItem(item)
        setHistoryModalOpen(true)
    }

    const tabs = [
        { id: 'ALL', label: 'All Items', icon: LayoutGrid },
        { id: 'FABRIC', label: 'Fabrics', icon: Scissors },
        { id: 'BOTTOM_BAR', label: 'Bottom Bars', icon: Disc },
        { id: 'MOTOR', label: 'Motors', icon: Settings },
        { id: 'CHAIN', label: 'Chains', icon: Settings }, // Reusing Settings icon for now
    ]

    return (
        <div className="space-y-6">
            {/* Header and Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card p-6 bg-gradient-to-br from-brand-navy to-brand-navy-light text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-300 text-sm">Total Inventory Items</p>
                            <h3 className="text-3xl font-bold mt-1">{stats.totalItems}</h3>
                        </div>
                        <Package className="h-8 w-8 opacity-50" />
                    </div>
                </div>

                <div className="card p-6 border-l-4 border-l-yellow-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-gray-600 text-sm">Low Stock Alerts</p>
                            <h3 className="text-3xl font-bold mt-1 text-gray-900">{stats.lowStock}</h3>
                        </div>
                        <AlertTriangle className="h-8 w-8 text-yellow-500 opacity-50" />
                    </div>
                </div>

                <div className="card p-6 flex flex-col justify-center items-center text-center cursor-pointer hover:bg-gray-50 transition-colors border-2 border-dashed border-gray-200"
                    onClick={() => setIsAddModalOpen(true)}>
                    <div className="bg-brand-gold bg-opacity-10 p-3 rounded-full mb-2">
                        <Plus className="h-6 w-6 text-brand-gold" />
                    </div>
                    <span className="font-medium text-brand-navy">Add New Item</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="card">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-200 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {/* Tabs */}
                        <div className="flex space-x-1 overflow-x-auto pb-2 sm:pb-0">
                            {tabs.map((tab) => {
                                const Icon = tab.icon
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id as any)}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                                            ? 'bg-brand-gold text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        <Icon className="h-4 w-4" />
                                        <span>{tab.label}</span>
                                    </button>
                                )
                            })}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-3">
                            <button
                                onClick={() => setShowLowStock(!showLowStock)}
                                className={`flex items-center space-x-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${showLowStock
                                    ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                                    }`}
                            >
                                <Filter className="h-4 w-4" />
                                <span>Low Stock Only</span>
                            </button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by item name, color, or variant..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input pl-10"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Item Details</th>
                                <th>Category</th>
                                <th>Quantity</th>
                                <th>Alert Threshold</th>
                                <th>Status</th>
                                <th className="text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12">
                                        <div className="animate-spin h-8 w-8 border-2 border-brand-gold border-t-transparent rounded-full mx-auto mb-2" />
                                        <p className="text-gray-500">Loading inventory...</p>
                                    </td>
                                </tr>
                            ) : filteredItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-12 text-gray-500">
                                        No items found matching your criteria
                                    </td>
                                </tr>
                            ) : (
                                filteredItems.map((item) => (
                                    <tr key={item.id} className="group">
                                        <td>
                                            <div>
                                                <p className="font-semibold text-gray-900">{item.itemName}</p>
                                                {item.colorVariant && (
                                                    <p className="text-sm text-gray-500">{item.colorVariant}</p>
                                                )}
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge bg-gray-100 text-gray-700 border border-gray-200">
                                                {item.category.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="flex items-center space-x-2">
                                                <span className={`font-mono font-medium ${item.isLowStock ? 'text-red-600' : 'text-gray-900'
                                                    }`}>
                                                    {item.quantity.toLocaleString()}
                                                </span>
                                                <span className="text-xs text-gray-500 uppercase">{item.unitType}</span>
                                            </div>
                                        </td>
                                        <td className="text-gray-500">
                                            {item.minStockAlert ? (
                                                `Below ${item.minStockAlert}`
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td>
                                            {item.isLowStock ? (
                                                <span className="badge badge-error">
                                                    Low Stock
                                                </span>
                                            ) : item.quantity === 0 ? (
                                                <span className="badge bg-gray-100 text-gray-500">
                                                    Out of Stock
                                                </span>
                                            ) : (
                                                <span className="badge badge-success">
                                                    In Stock
                                                </span>
                                            )}
                                        </td>
                                        <td className="text-right">
                                            <div className="flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleAdjustQuantity(item)}
                                                    className="p-2 text-gray-500 hover:text-brand-navy hover:bg-gray-100 rounded-lg"
                                                    title="Adjust Quantity"
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleViewHistory(item)}
                                                    className="p-2 text-gray-500 hover:text-brand-navy hover:bg-gray-100 rounded-lg"
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

                {/* Footer / Pagination Placeholder */}
                <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-sm text-gray-600">
                    <p>Showing {filteredItems.length} items</p>
                    <div className="flex space-x-2">
                        <button className="px-3 py-1 border rounded hover:bg-white disabled:opacity-50" disabled>Previous</button>
                        <button className="px-3 py-1 border rounded hover:bg-white disabled:opacity-50" disabled>Next</button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AddInventoryModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
            />

            {selectedItem && (
                <>
                    <AdjustQuantityModal
                        isOpen={adjustModalOpen}
                        onClose={() => {
                            setAdjustModalOpen(false)
                            setSelectedItem(null)
                        }}
                        item={selectedItem}
                    />
                    <ItemHistoryModal
                        isOpen={historyModalOpen}
                        onClose={() => {
                            setHistoryModalOpen(false)
                            setSelectedItem(null)
                        }}
                        item={selectedItem}
                    />
                </>
            )}
        </div>
    )
}
