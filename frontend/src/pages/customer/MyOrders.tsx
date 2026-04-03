import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { webOrderApi } from '../../services/api';
import { Order } from '../../types/order';
import { Card, CardContent, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Loader2, Plus, Search, Calendar, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, startOfDay, endOfDay, parseISO } from 'date-fns';

export default function MyOrders() {
    const { user } = useAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchRef, setSearchRef] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

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

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            // Reference filter
            if (searchRef.trim()) {
                const q = searchRef.trim().toLowerCase();
                const matchRef = order.customerReference?.toLowerCase().includes(q);
                const matchOrder = order.orderNumber?.toLowerCase().includes(q);
                if (!matchRef && !matchOrder) return false;
            }

            // Date range filter
            if (dateFrom || dateTo) {
                const orderDate = parseISO(order.createdAt);
                if (dateFrom && orderDate < startOfDay(parseISO(dateFrom))) return false;
                if (dateTo && orderDate > endOfDay(parseISO(dateTo))) return false;
            }

            return true;
        });
    }, [orders, searchRef, dateFrom, dateTo]);

    const hasFilters = searchRef || dateFrom || dateTo;

    const clearFilters = () => {
        setSearchRef('');
        setDateFrom('');
        setDateTo('');
    };

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
                <Link to="/new-order">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        New Order
                    </Button>
                </Link>
            </div>

            {/* Filters */}
            {orders.length > 0 && (
                <Card>
                    <CardContent className="py-4">
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                            {/* Reference search */}
                            <div className="flex-1 min-w-[200px]">
                                <label className="text-xs font-medium text-gray-500 mb-1 block">Search</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <Input
                                        className="pl-9 h-9 text-sm"
                                        placeholder="Order # or reference..."
                                        value={searchRef}
                                        onChange={(e) => setSearchRef(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Date from */}
                            <div className="min-w-[160px]">
                                <label className="text-xs font-medium text-gray-500 mb-1 block">From</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-3 h-9 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        max={dateTo || undefined}
                                    />
                                </div>
                            </div>

                            {/* Date to */}
                            <div className="min-w-[160px]">
                                <label className="text-xs font-medium text-gray-500 mb-1 block">To</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                                    <input
                                        type="date"
                                        className="w-full pl-9 pr-3 h-9 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-brand-gold focus:border-brand-gold outline-none"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        min={dateFrom || undefined}
                                    />
                                </div>
                            </div>

                            {/* Clear */}
                            {hasFilters && (
                                <button
                                    onClick={clearFilters}
                                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition-colors h-9 px-2"
                                >
                                    <X className="h-3.5 w-3.5" />
                                    Clear
                                </button>
                            )}
                        </div>

                        {hasFilters && (
                            <p className="text-xs text-gray-400 mt-2">
                                Showing {filteredOrders.length} of {orders.length} orders
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {orders.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="rounded-full bg-blue-50 p-4 mb-4">
                            <Plus className="h-8 w-8 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-semibold">No orders yet</h3>
                        <p className="text-muted-foreground mt-1 mb-4">Get started by creating your first order.</p>
                    </CardContent>
                </Card>
            ) : filteredOrders.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Search className="h-8 w-8 text-gray-300 mb-3" />
                        <h3 className="text-lg font-semibold text-gray-500">No matching orders</h3>
                        <p className="text-sm text-gray-400 mt-1">Try adjusting your search or date range.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredOrders.map((order) => (
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
                                        <span className="text-muted-foreground">Reference: </span>
                                        <span className="font-medium">{order.customerReference || 'N/A'}</span>
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
