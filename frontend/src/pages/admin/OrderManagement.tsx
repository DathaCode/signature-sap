import { useEffect, useState } from 'react';
import { adminOrderApi } from '../../services/api';
import { Order } from '../../types/order';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, Check, Factory, Filter, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';

export default function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (statusFilter !== 'ALL') params.status = statusFilter;

            const data = await adminOrderApi.getAllOrders(params);
            setOrders(data.orders);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            toast.error('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, [statusFilter]);

    const handleApprove = async (id: string) => {
        if (!confirm('Approve this order?')) return;
        try {
            await adminOrderApi.approveOrder(id);
            toast.success('Order approved');
            fetchOrders();
        } catch (error) {
            console.error(error);
            toast.error('Failed to approve order');
        }
    };

    const handleSendToProduction = async (id: string) => {
        if (!confirm('Send to production?')) return;
        try {
            await adminOrderApi.sendToProduction(id);
            toast.success('Sent to production');
            fetchOrders();
        } catch (error) {
            console.error(error);
            toast.error('Failed to update status');
        }
    };

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return 'success';
            case 'PRODUCTION': return 'default';
            case 'COMPLETED': return 'secondary';
            case 'CANCELLED': return 'destructive';
            default: return 'outline';
        }
    };

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Order Management</h1>
                    <p className="text-muted-foreground">Review and manage customer orders.</p>
                </div>
                <div className="flex gap-4">
                    <select
                        className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
                    <Button variant="outline" onClick={fetchOrders}>
                        <Filter className="mr-2 h-4 w-4" />
                        Refresh
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Orders</CardTitle>
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
                                    {orders.map((order) => (
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
                                                <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
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
                                                        <Button size="sm" onClick={() => handleSendToProduction(order.id)}>
                                                            <Factory className="mr-2 h-4 w-4" />
                                                            Production
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
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
        </div>
    );
}
