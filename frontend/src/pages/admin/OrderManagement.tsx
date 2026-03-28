import { useEffect, useState, useCallback } from 'react';
import { adminOrderApi } from '../../services/api';
import { Order, WorksheetPreviewResponse } from '../../types/order';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Loader2, Check, Factory, RefreshCw, Eye, FileText, Search, X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import WorksheetPreview from '../../components/admin/WorksheetPreview';

const ADMIN_TABS = ['PENDING', 'CONFIRMED', 'PRODUCTION', 'COMPLETED', 'CANCELLED'] as const;
const WAREHOUSE_TABS = ['PRODUCTION', 'COMPLETED', 'CANCELLED'] as const;

export default function OrderManagement() {
    const { user } = useAuth();
    const isWarehouse = user?.role === 'WAREHOUSE';
    const basePath = isWarehouse ? '/warehouse' : '/admin';
    const tabs = isWarehouse ? WAREHOUSE_TABS : ADMIN_TABS;

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>(tabs[0]);
    const [customerSearch, setCustomerSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [worksheetPreview, setWorksheetPreview] = useState<{
        orderId: string;
        orderNumber: string;
        customerName: string;
        customerReference?: string;
        notes?: string;
        createdAt: string;
        data: WorksheetPreviewResponse;
    } | null>(null);
    const [sendingToProduction, setSendingToProduction] = useState<string | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;
            if (customerSearch.trim()) params.customerName = customerSearch.trim();
            if (dateFrom) params.dateFrom = dateFrom;
            if (dateTo) params.dateTo = dateTo;

            const data = await adminOrderApi.getAllOrders(params);
            setOrders(data.orders);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            gooeyToast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, customerSearch, dateFrom, dateTo]);

    useEffect(() => {
        fetchOrders();
    }, [statusFilter, dateFrom, dateTo]);

    const handleApprove = async (id: string) => {
        if (!await confirmToast({ title: 'Approve Order', message: 'Approve this order and notify the customer?', confirmText: 'Approve', variant: 'info' })) return;
        try {
            await adminOrderApi.approveOrder(id);
            gooeyToast.success('Order approved');
            fetchOrders();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to approve order');
        }
    };

    const handleSendToProduction = async (order: Order) => {
        if (!await confirmToast({ title: 'Send to Production', message: 'This will run fabric cut optimization. Continue?', confirmText: 'Send', variant: 'warning' })) return;
        setSendingToProduction(order.id);
        try {
            const result = await adminOrderApi.sendToProduction(order.id);
            gooeyToast.success('Optimization complete');
            setWorksheetPreview({ orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, customerReference: order.customerReference, notes: order.notes, createdAt: order.createdAt, data: result });
            fetchOrders();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to send to production');
        } finally {
            setSendingToProduction(null);
        }
    };

    const handleViewWorksheets = async (order: Order) => {
        try {
            const result = await adminOrderApi.getWorksheetPreview(order.id);
            setWorksheetPreview({ orderId: order.id, orderNumber: order.orderNumber, customerName: order.customerName, customerReference: order.customerReference, notes: order.notes, createdAt: order.createdAt, data: result });
        } catch (error) {
            console.error(error);
            gooeyToast.error('No worksheet data available');
        }
    };

    const handleStatusChange = async (order: Order, newStatus: string) => {
        const labels: Record<string, string> = {
            'COMPLETED': 'Mark as Completed',
            'CANCELLED': 'Cancel Order',
        };
        const label = labels[newStatus] || `Change to ${newStatus}`;
        if (!await confirmToast({ title: label, message: `Change order ${order.orderNumber} status to ${newStatus}?`, confirmText: 'Confirm', variant: newStatus === 'CANCELLED' ? 'danger' : 'info' })) return;
        setUpdatingStatus(order.id);
        try {
            await adminOrderApi.updateStatus(order.id, newStatus);
            gooeyToast.success(`Order ${newStatus.toLowerCase()}`);
            fetchOrders();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to update status');
        } finally {
            setUpdatingStatus(null);
        }
    };

    const handleToggleFabricOrdered = async (order: Order) => {
        try {
            const newVal = !order.fabricOrdered;
            await adminOrderApi.toggleFabricOrdered(order.id, newVal);
            setOrders(prev => prev.map(o => o.id === order.id ? { ...o, fabricOrdered: newVal } : o));
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to update');
        }
    };

    const getTabStyle = (tab: string) => {
        const isActive = statusFilter === tab;
        const base = 'px-4 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap';
        if (!isActive) return `${base} border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300`;
        switch (tab) {
            case 'PENDING': return `${base} border-yellow-500 text-yellow-700 bg-yellow-50`;
            case 'CONFIRMED': return `${base} border-green-500 text-green-700 bg-green-50`;
            case 'PRODUCTION': return `${base} border-blue-500 text-blue-700 bg-blue-50`;
            case 'COMPLETED': return `${base} border-gray-500 text-gray-700 bg-gray-50`;
            case 'CANCELLED': return `${base} border-red-500 text-red-700 bg-red-50`;
            default: return `${base} border-primary text-primary`;
        }
    };

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
                    <p className="text-muted-foreground">Review and manage customer orders.</p>
                </div>
                <Button variant="outline" onClick={fetchOrders}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Status Tabs */}
            <div className="border-b">
                <div className="flex gap-0 overflow-x-auto">
                    {tabs.map(tab => (
                        <button
                            key={tab}
                            onClick={() => setStatusFilter(tab)}
                            className={getTabStyle(tab)}
                        >
                            {tab.charAt(0) + tab.slice(1).toLowerCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-end gap-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by customer..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                        className="h-9 w-52 rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </div>
                <div className="flex items-center gap-2">
                    <label className="text-sm text-muted-foreground">To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" />
                </div>
                <Button onClick={fetchOrders} size="sm" className="h-9">
                    <Search className="mr-2 h-4 w-4" />
                    Search
                </Button>
                {(customerSearch.trim() || dateFrom || dateTo) && (
                    <Button variant="ghost" size="sm" onClick={() => { setCustomerSearch(''); setDateFrom(''); setDateTo(''); }} className="h-9 text-muted-foreground">
                        <X className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                )}
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Orders</span>
                        <span className="text-sm font-normal text-muted-foreground">{orders.length} result{orders.length !== 1 ? 's' : ''}</span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                                <thead className="[&_tr]:border-b">
                                    <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Order #</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Date</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Customer</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Reference</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Items</th>
                                        {!isWarehouse && <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Total</th>}
                                        {!isWarehouse && <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Fabric</th>}
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {orders.map((order) => (
                                        <tr key={order.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-medium">
                                                <Link to={`${basePath}/orders/${order.id}`} className="text-blue-700 hover:underline">
                                                    {order.orderNumber}
                                                </Link>
                                            </td>
                                            <td className="p-4 align-middle">{format(new Date(order.createdAt), 'MMM d, yyyy')}</td>
                                            <td className="p-4 align-middle">
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{order.customerName}</span>
                                                    {!isWarehouse && <span className="text-xs text-muted-foreground">{order.customerEmail}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 align-middle">
                                                {order.customerReference ? (
                                                    <Link to={`${basePath}/orders/${order.id}`} className="text-sm font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded hover:bg-indigo-100">
                                                        {order.customerReference}
                                                    </Link>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </td>
                                            <td className="p-4 align-middle">{order.items.length} items</td>
                                            {!isWarehouse && <td className="p-4 align-middle">${Number(order.total).toFixed(2)}</td>}
                                            {!isWarehouse && (
                                                <td className="p-4 align-middle">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!order.fabricOrdered}
                                                        onChange={() => handleToggleFabricOrdered(order)}
                                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        title={order.fabricOrdered ? 'Fabric ordered' : 'Mark fabric as ordered'}
                                                    />
                                                </td>
                                            )}
                                            <td className="p-4 align-middle text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Link to={`${basePath}/orders/${order.id}`}>
                                                        <Button variant="ghost" size="icon" title="View Details">
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </Link>

                                                    {!isWarehouse && order.status === 'PENDING' && (
                                                        <Button size="sm" onClick={() => handleApprove(order.id)} className="bg-green-600 hover:bg-green-700">
                                                            <Check className="mr-2 h-4 w-4" />
                                                            Approve
                                                        </Button>
                                                    )}

                                                    {!isWarehouse && order.status === 'CONFIRMED' && (
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSendToProduction(order)}
                                                            disabled={sendingToProduction === order.id}
                                                        >
                                                            {sendingToProduction === order.id ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Factory className="mr-2 h-4 w-4" />
                                                            )}
                                                            {sendingToProduction === order.id ? 'Optimizing...' : 'Production'}
                                                        </Button>
                                                    )}

                                                    {(order.status === 'PRODUCTION' || order.status === 'COMPLETED') && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleViewWorksheets(order)}
                                                        >
                                                            <FileText className="mr-2 h-4 w-4" />
                                                            Worksheets
                                                        </Button>
                                                    )}

                                                    {!isWarehouse && order.status === 'PRODUCTION' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleStatusChange(order, 'COMPLETED')}
                                                            disabled={updatingStatus === order.id}
                                                        >
                                                            <CheckCircle className="mr-2 h-4 w-4" />
                                                            Complete
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {orders.length === 0 && (
                                        <tr>
                                            <td colSpan={isWarehouse ? 6 : 8} className="p-8 text-center text-muted-foreground italic">
                                                No orders found matching the criteria.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Worksheet Preview Modal */}
            {worksheetPreview && (
                <WorksheetPreview
                    orderId={worksheetPreview.orderId}
                    orderNumber={worksheetPreview.orderNumber}
                    customerName={worksheetPreview.customerName}
                    customerReference={worksheetPreview.customerReference}
                    notes={worksheetPreview.notes}
                    createdAt={worksheetPreview.createdAt}
                    data={worksheetPreview.data}
                    onClose={() => setWorksheetPreview(null)}
                    onAccepted={() => {
                        setWorksheetPreview(null);
                        fetchOrders();
                    }}
                />
            )}
        </div>
    );
}
