import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Loader2, ArrowLeft, RotateCcw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'react-hot-toast';
import { confirmToast } from '../../utils/confirmToast';
import api from '../../services/api';
import { Order } from '../../types/order';

interface TrashedOrder extends Order {
    deletedAt: string;
}

export default function TrashOrders() {
    const [orders, setOrders] = useState<TrashedOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState<string | null>(null);

    const fetchTrash = async () => {
        setLoading(true);
        try {
            const response = await api.get('/web-orders/admin/trash');
            setOrders(response.data.data.orders);
        } catch (error) {
            console.error('Failed to fetch trash:', error);
            toast.error('Failed to load trash');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchTrash(); }, []);

    const handleRestore = async (id: string) => {
        if (!await confirmToast({ title: 'Restore Order', message: 'Restore this order? It will be set back to PENDING.', confirmText: 'Restore', variant: 'info' })) return;
        setActionId(id);
        try {
            await api.post(`/web-orders/${id}/restore`);
            toast.success('Order restored');
            fetchTrash();
        } catch (error) {
            toast.error('Failed to restore order');
        } finally {
            setActionId(null);
        }
    };

    const handlePurge = async (id: string, orderNumber: string) => {
        if (!await confirmToast({ title: 'Permanent Delete', message: `Permanently delete ${orderNumber}? This CANNOT be undone.`, confirmText: 'Delete Forever', variant: 'danger' })) return;
        setActionId(id);
        try {
            await api.delete(`/web-orders/${id}/purge`);
            toast.success('Order permanently deleted');
            fetchTrash();
        } catch (error) {
            toast.error('Failed to delete order');
        } finally {
            setActionId(null);
        }
    };

    const daysLeft = (deletedAt: string) => {
        const purgeDate = new Date(new Date(deletedAt).getTime() + 10 * 24 * 60 * 60 * 1000);
        const now = new Date();
        const diff = Math.ceil((purgeDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return Math.max(0, diff);
    };

    return (
        <div className="space-y-6 p-8 max-w-[1400px] mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/dashboard">
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Trash</h1>
                        <p className="text-muted-foreground">Orders are permanently deleted after 10 days.</p>
                    </div>
                </div>
                <Button variant="outline" onClick={fetchTrash}>
                    Refresh
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Trashed Orders ({orders.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground">
                            <Trash2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                            <p>Trash is empty.</p>
                        </div>
                    ) : (
                        <div className="relative w-full overflow-auto">
                            <table className="w-full caption-bottom text-sm text-left">
                                <thead>
                                    <tr className="border-b">
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Order #</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Customer</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Placed</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Trashed</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Auto-delete in</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Total</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map((order) => {
                                        const days = daysLeft(order.deletedAt);
                                        return (
                                            <tr key={order.id} className="border-b hover:bg-muted/50">
                                                <td className="p-4 font-medium font-mono">{order.orderNumber}</td>
                                                <td className="p-4">
                                                    <div>
                                                        <p className="font-medium">{order.customerName}</p>
                                                        <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                                                    </div>
                                                </td>
                                                <td className="p-4">{format(new Date(order.createdAt), 'MMM d, yyyy')}</td>
                                                <td className="p-4">{formatDistanceToNow(new Date(order.deletedAt), { addSuffix: true })}</td>
                                                <td className="p-4">
                                                    <Badge variant={days <= 2 ? 'destructive' : days <= 5 ? 'outline' : 'secondary'}>
                                                        {days} day{days !== 1 ? 's' : ''}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">${Number(order.total).toFixed(2)}</td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleRestore(order.id)}
                                                            disabled={actionId === order.id}
                                                            className="text-green-600 border-green-200 hover:bg-green-50"
                                                        >
                                                            <RotateCcw className="mr-1 h-3 w-3" />
                                                            Restore
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handlePurge(order.id, order.orderNumber)}
                                                            disabled={actionId === order.id}
                                                            className="text-red-600 border-red-200 hover:bg-red-50"
                                                        >
                                                            <Trash2 className="mr-1 h-3 w-3" />
                                                            Delete Forever
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
