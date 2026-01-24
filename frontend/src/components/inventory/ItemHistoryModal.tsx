import { useQuery } from '@tanstack/react-query'
import { X, Calendar, ArrowUpRight, ArrowDownLeft, RefreshCw } from 'lucide-react'
import { inventoryApi } from '../../services/api'
import type { InventoryItem } from '../../types'

interface ItemHistoryModalProps {
    isOpen: boolean
    onClose: () => void
    item: InventoryItem
}

export default function ItemHistoryModal({ isOpen, onClose, item }: ItemHistoryModalProps) {
    const { data: transactions, isLoading } = useQuery({
        queryKey: ['transactions', item.id],
        queryFn: () => inventoryApi.getTransactions({ itemId: item.id }),
        enabled: isOpen,
    })

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <div className="fixed inset-0 bg-black opacity-50" onClick={onClose}></div>

                <div className="relative bg-white rounded-xl shadow-xl max-w-3xl w-full p-6 flex flex-col max-h-[85vh]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-brand-navy">Transaction History</h2>
                            <p className="text-gray-600">
                                {item.itemName} {item.colorVariant && `(${item.colorVariant})`}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="overflow-y-auto flex-1 -mx-6 px-6">
                        {isLoading ? (
                            <div className="py-8 text-center">
                                <div className="animate-spin h-8 w-8 border-2 border-brand-gold border-t-transparent rounded-full mx-auto mb-2" />
                                <p className="text-gray-500">Loading history...</p>
                            </div>
                        ) : transactions && transactions.length > 0 ? (
                            <table className="table">
                                <thead className="bg-gray-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="!text-gray-600 !font-bold">Date</th>
                                        <th className="!text-gray-600 !font-bold">Type</th>
                                        <th className="!text-gray-600 !font-bold text-right">Change</th>
                                        <th className="!text-gray-600 !font-bold text-right">Balance</th>
                                        <th className="!text-gray-600 !font-bold">Notes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {transactions.map((tx) => (
                                        <tr key={tx.id}>
                                            <td className="whitespace-nowrap text-sm text-gray-500">
                                                <div className="flex items-center space-x-2">
                                                    <Calendar className="h-4 w-4 text-gray-400" />
                                                    <span>{new Date(tx.createdAt).toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={`inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${tx.transactionType === 'ADDITION' ? 'bg-green-100 text-green-800' :
                                                        tx.transactionType === 'DEDUCTION' ? 'bg-red-100 text-red-800' :
                                                            'bg-blue-100 text-blue-800'
                                                    }`}>
                                                    {tx.transactionType === 'ADDITION' && <ArrowUpRight className="h-3 w-3" />}
                                                    {tx.transactionType === 'DEDUCTION' && <ArrowDownLeft className="h-3 w-3" />}
                                                    {tx.transactionType === 'ADJUSTMENT' && <RefreshCw className="h-3 w-3" />}
                                                    <span>{tx.transactionType}</span>
                                                </span>
                                            </td>
                                            <td className={`text-right font-mono font-medium ${tx.quantityChange > 0 ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {tx.quantityChange > 0 ? '+' : ''}{tx.quantityChange}
                                            </td>
                                            <td className="text-right font-mono text-gray-900">
                                                {tx.newBalance}
                                            </td>
                                            <td className="max-w-xs truncate text-sm text-gray-500">
                                                {tx.order ? (
                                                    <span className="text-brand-gold">Order #{tx.order.customerName}</span>
                                                ) : tx.notes}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="py-12 text-center text-gray-500 bg-gray-50 rounded-lg">
                                No transactions found for this item
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
