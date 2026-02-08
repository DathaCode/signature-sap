import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { webOrderApi } from '../../services/api';
import { Order } from '../../types/order';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

export default function MyOrders() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const data = await webOrderApi.getMyOrders();
                setOrders(data.orders);
            } catch (error) {
                console.error('Failed to fetch orders:', error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchOrders();
        }
    }, [user]);

    const getStatusVariant = (status: string) => {
        switch (status) {
            case 'CONFIRMED': return 'success';
            case 'PRODUCTION': return 'default'; // blue
            case 'COMPLETED': return 'secondary'; // gray
            case 'CANCELLED': return 'destructive';
            default: return 'outline'; // PENDING
        }
    };

    if (loading) {
        return (
            <div className="flex h-[50vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6 p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">My Orders</h1>
                    <p className="text-muted-foreground">Manage and track your recent orders.</p>
                </div>
                <Link to="/orders/new">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Order
                    </Button>
                </Link>
            </div>

            {orders.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-blue-50 p-4 mb-4">
                            <Plus className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold">No orders yet</h3>
                        <p className="text-muted-foreground mt-1 mb-4">Get started by creating your first order.</p>
                        <Link to="/orders/new">
                            <Button variant="outline">Create Order</Button>
                        </Link>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {orders.map((order) => (
                        <Card key={order.id} className="overflow-hidden hover:border-gray-400 transition-colors">
                            <CardHeader className="bg-gray-50/50 py-4 flex flex-row items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-lg">{order.orderNumber}</span>
                                        <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Placed on {format(new Date(order.createdAt), 'MMM d, yyyy')}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-lg">${Number(order.total).toFixed(2)}</p>
                                    <p className="text-sm text-muted-foreground">{order.items.length} items</p>
                                </div>
                            </CardHeader>
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm">
                                        <span className="text-muted-foreground">Project/Notes: </span>
                                        <span className="font-medium">{order.notes || 'N/A'}</span>
                                    </div>
                                    <Link to={`/orders/${order.id}`}>
                                        <Button variant="ghost" size="sm">
                                            View Details
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
