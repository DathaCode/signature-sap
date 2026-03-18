import { useEffect, useState, useCallback } from 'react';
import { adminOrderApi } from '../../services/api';
import { Order, WorksheetPreviewResponse } from '../../types/order';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, Check, Factory, Filter, Eye, FileText, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { gooeyToast } from 'goey-toast';
import { confirmToast } from '../../utils/confirmToast';
import WorksheetPreview from '../../components/admin/WorksheetPreview';

export default function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [customerSearch, setCustomerSearch] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
    const [worksheetPreview, setWorksheetPreview] = useState<{
        orderId: string;
        orderNumber: string;
        data: WorksheetPreviewResponse;
    } | null>(null);
    const [sendingToProduction, setSendingToProduction] = useState<string | null>(null);

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

    const handleSendToProduction = async (id: string, orderNumber: string) => {
        if (!await confirmToast({ title: 'Send to Production', message: 'This will run fabric cut optimization. Continue?', confirmText: 'Send', variant: 'warning' })) return;
        setSendingToProduction(id);
        try {
            const result = await adminOrderApi.sendToProduction(id);
            gooeyToast.success('Optimization complete');
            setWorksheetPreview({ orderId: id, orderNumber, data: result });
            fetchOrders();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to send to production');
        } finally {
            setSendingToProduction(null);
        }
    };

    const handleViewWorksheets = async (id: string, orderNumber: string) => {
        try {
            const result = await adminOrderApi.getWorksheetPreview(id);
            setWorksheetPreview({ orderId: id, orderNumber, data: result });
        } catch (error) {
            console.error(error);
            gooeyToast.error('No worksheet data available');
        }
    };

    const handleStatusChange = async (id: string, orderNumber: string, newStatus: string) => {
        const label = newStatus === 'COMPLETED' ? 'complete' : 'cancel';
        if (!await confirmToast({
            title: newStatus === 'COMPLETED' ? 'Complete Order' : 'Cancel Order',
            message: `Mark order ${orderNumber} as ${label}?`,
            confirmText: newStatus === 'COMPLETED' ? 'Complete' : 'Cancel Order',
            variant: newStatus === 'CANCELLED' ? 'danger' : 'info',
        })) return;
        setUpdatingStatus(id);
        try {
            await adminOrderApi.updateStatus(id, newStatus);
            gooeyToast.success(`Order marked as ${newStatus.toLowerCase()}`);
            fetchOrders();
        } catch (error) {
            console.error(error);
            gooeyToast.error('Failed to update order status');
        } finally {
            setUpdatingStatus(null);
        }
    };

    const handleClearFilters = () => {
        setStatusFilter('ALL');
        setCustomerSearch('');
        setDateFrom('');
        setDateTo('');
    };

    const hasActiveFilters = statusFilter !== 'ALL' || customerSearch.trim() || dateFrom || dateTo;

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return 'success';
            case 'PRODUCTION': return 'default';
            case 'COMPLETED': return 'secondary';
            case 'CANCELLED': return 'destructive';
            default: return 'outline';
        }
    };

    const getStatusActions = (order: Order) => {
        const options: { value: string; label: string }[] = [];
        if (order.status === 'PRODUCTION' || order.status === 'CONFIRMED') {
            options.push({ value: 'COMPLETED', label: 'Completed' });
        }
        if (order.status !== 'CANCELLED' && order.status !== 'COMPLETED') {
            options.push({ value: 'CANCELLED', label: 'Cancelled' });
        }
        return options;
    };

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
                    <p className="text-muted-foreground">Review and manage customer orders.</p>
                </div>
                <Button variant="outline" onClick={fetchOrders}>
                    <Filter className="mr-2 h-4 w-4" />
                    Refresh
                </Button>
            </div>

            {/* Filter Bar */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex flex-wrap items-end gap-4">
                        {/* Customer Search */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Customer</label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={customerSearch}
                                    onChange={(e) => setCustomerSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchOrders()}
                                    className="h-10 w-52 rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                />
                            </div>
                        </div>

                        {/* Status Filter */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-muted-foreground">Status</label>
                            <select
                                className="h-10 w-40 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                            >
                                <option value="ALL">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="CONFIRMED">Confirmed</option>
                                <option value="PRODUCTION">Production</option>
                                <option value="COMPLETED">Completed</option>
                                <option value="CANCELLED">Cancelled</option>
                            </select>
                        </div>

                        {/* Date From */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-muted-foreground">From</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>

                        {/* Date To */}
                        <div className="flex flex-col gap-1.5">
                            <label className="text-sm font-medium text-muted-foreground">To</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            />
                        </div>

                        {/* Search Button */}
                        <Button onClick={fetchOrders} size="sm" className="h-10">
                            <Search className="mr-2 h-4 w-4" />
                            Search
                        </Button>

                        {/* Clear Filters */}
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-10 text-muted-foreground">
                                <X className="mr-2 h-4 w-4" />
                                Clear
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>

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
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Items</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Total</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {orders.map((order) => {
                                        const statusActions = getStatusActions(order);
                                        return (
                                            <tr key={order.id} className="border-b transition-colors hover:bg-muted/50">
                                                <td className="p-4 align-middle font-medium">{order.orderNumber}</td>
                                                <td className="p-4 align-middle">{format(new Date(order.createdAt), 'MMM d, yyyy')}</td>
                                                <td className="p-4 align-middle">
                                                    <div className="flex flex-col">
                                                        <span className="font-medium">{order.customerName}</span>
                                                        <span className="text-xs text-muted-foreground">{order.customerEmail}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 align-middle">{order.items.length} items</td>
                                                <td className="p-4 align-middle">${Number(order.total).toFixed(2)}</td>
                                                <td className="p-4 align-middle">
                                                    {statusActions.length > 0 ? (
                                                        <select
                                                            value={order.status}
                                                            onChange={(e) => handleStatusChange(order.id, order.orderNumber, e.target.value)}
                                                            disabled={updatingStatus === order.id}
                                                            className={`h-8 rounded-md border px-2 py-1 text-xs font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                                                order.status === 'CONFIRMED' ? 'border-green-300 bg-green-50 text-green-700' :
                                                                order.status === 'PRODUCTION' ? 'border-blue-300 bg-blue-50 text-blue-700' :
                                                                order.status === 'PENDING' ? 'border-gray-300 bg-gray-50 text-gray-700' :
                                                                'border-gray-300 bg-gray-50 text-gray-700'
                                                            }`}
                                                        >
                                                            <option value={order.status} disabled>{order.status}</option>
                                                            {statusActions.map(opt => (
                                                                <option key={opt.value} value={opt.value}>
                                                                    {opt.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                                    )}
                                                </td>
                                                <td className="p-4 align-middle text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Link to={`/admin/orders/${order.id}`}>
                                                            <Button variant="ghost" size="icon" title="View Details">
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </Link>

                                                        {order.status === 'PENDING' && (
                                                            <Button size="sm" onClick={() => handleApprove(order.id)} className="bg-green-600 hover:bg-green-700">
                                                                <Check className="mr-2 h-4 w-4" />
                                                                Approve
                                                            </Button>
                                                        )}

                                                        {order.status === 'CONFIRMED' && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleSendToProduction(order.id, order.orderNumber)}
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

                                                        {order.status === 'PRODUCTION' && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleViewWorksheets(order.id, order.orderNumber)}
                                                            >
                                                                <FileText className="mr-2 h-4 w-4" />
                                                                Worksheets
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {orders.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="p-8 text-center text-muted-foreground">
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
