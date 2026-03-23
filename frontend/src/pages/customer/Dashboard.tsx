import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { webOrderApi, quoteApi } from "../../services/api";
import { Loader2, Trash2, Users, Package, DollarSign } from "lucide-react";
import { Order } from "../../types/order";

// Simple SVG bar chart for monthly order counts
function MonthlyOrderChart({ orders }: { orders: Order[] }) {
    // Build last 6 months data
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString('default', { month: 'short' });
        const count = orders.filter(o => {
            const od = new Date(o.createdAt);
            return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
        }).length;
        months.push({ label, count });
    }

    const maxCount = Math.max(...months.map(m => m.count), 1);
    const barW = 36;
    const gap = 14;
    const chartH = 100;
    const svgW = months.length * (barW + gap);

    return (
        <div>
            <h3 className="font-semibold leading-none tracking-tight mb-3">Monthly Orders</h3>
            <svg width={svgW} height={chartH + 28} className="overflow-visible">
                {months.map((m, i) => {
                    const barH = Math.max(4, Math.round((m.count / maxCount) * chartH));
                    const x = i * (barW + gap);
                    const y = chartH - barH;
                    return (
                        <g key={m.label}>
                            <rect
                                x={x}
                                y={y}
                                width={barW}
                                height={barH}
                                rx={4}
                                fill={i === 5 ? '#3b82f6' : '#93c5fd'}
                            />
                            {m.count > 0 && (
                                <text
                                    x={x + barW / 2}
                                    y={y - 4}
                                    textAnchor="middle"
                                    fontSize={11}
                                    fill="#374151"
                                    fontWeight="600"
                                >
                                    {m.count}
                                </text>
                            )}
                            <text
                                x={x + barW / 2}
                                y={chartH + 18}
                                textAnchor="middle"
                                fontSize={11}
                                fill="#6b7280"
                            >
                                {m.label}
                            </text>
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}

export default function CustomerDashboard() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({ pending: 0, activeQuotes: 0, totalOrders: 0, completedOrders: 0 });
    const [allOrders, setAllOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const { orders } = await webOrderApi.getMyOrders();
                const pendingCount = orders.filter(o => o.status === 'PENDING').length;
                const completedCount = orders.filter(o => o.status === 'COMPLETED').length;
                setAllOrders(orders);

                let activeQuotesCount = 0;
                try {
                    const { quotes } = await quoteApi.getMyQuotes();
                    activeQuotesCount = quotes.filter((q: any) => !q.convertedToOrder).length;
                } catch (e) {
                    console.error("Failed to fetch quotes for stats", e);
                }

                setStats({
                    pending: pendingCount,
                    activeQuotes: activeQuotesCount,
                    totalOrders: orders.length,
                    completedOrders: completedCount,
                });
            } catch (error) {
                console.error("Failed to fetch dashboard stats", error);
            } finally {
                setLoading(false);
            }
        };

        if (user) fetchStats();
    }, [user]);

    const isAdmin = user?.role === 'ADMIN';

    return (
        <div className="space-y-6 p-8 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name}</h1>
                    <p className="text-muted-foreground">Here's what's happening with your account.</p>
                </div>
                <Button variant="outline" onClick={logout}>Sign out</Button>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="font-semibold leading-none tracking-tight">Pending Orders</h3>
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin mt-2" />
                    ) : (
                        <p className="text-3xl font-bold mt-2">{stats.pending}</p>
                    )}
                    <p className="text-sm text-muted-foreground mt-1">Orders waiting for approval.</p>
                </div>

                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="font-semibold leading-none tracking-tight">Active Quotes</h3>
                    <p className="text-3xl font-bold mt-2">{stats.activeQuotes}</p>
                    <p className="text-sm text-muted-foreground mt-1">Saved quotes expiring soon.</p>
                </div>

                {!isAdmin && (
                    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                        <h3 className="font-semibold leading-none tracking-tight">Account Status</h3>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="flex h-3 w-3 rounded-full bg-green-500" />
                            <span className="font-medium">Active</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{user?.company || user?.email}</p>
                    </div>
                )}
            </div>

            {/* Admin Tools */}
            {isAdmin && (
                <div>
                    <h2 className="text-lg font-semibold mb-3">Admin Tools</h2>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Link to="/admin/users" className="rounded-lg border bg-white shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-blue-300 transition-all">
                            <div className="h-11 w-11 rounded-lg bg-blue-100 flex items-center justify-center">
                                <Users className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">Manage Users</p>
                                <p className="text-sm text-gray-500">Accounts &amp; approvals</p>
                            </div>
                        </Link>
                        <Link to="/admin/inventory" className="rounded-lg border bg-white shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-green-300 transition-all">
                            <div className="h-11 w-11 rounded-lg bg-green-100 flex items-center justify-center">
                                <Package className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">Inventory</p>
                                <p className="text-sm text-gray-500">Stock &amp; materials</p>
                            </div>
                        </Link>
                        <Link to="/admin/pricing" className="rounded-lg border bg-white shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-purple-300 transition-all">
                            <div className="h-11 w-11 rounded-lg bg-purple-100 flex items-center justify-center">
                                <DollarSign className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <p className="font-semibold text-gray-800">Pricing</p>
                                <p className="text-sm text-gray-500">Fabric price matrix</p>
                            </div>
                        </Link>
                    </div>
                </div>
            )}

            {/* Monthly Orders Bar Chart */}
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                {loading ? (
                    <div className="flex items-center gap-2 text-gray-500">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading chart...
                    </div>
                ) : (
                    <MonthlyOrderChart orders={allOrders} />
                )}
            </div>

            <div className="flex gap-4 flex-wrap">
                <Link to="/new-order">
                    <Button size="lg">+ New Order</Button>
                </Link>
                <Link to="/orders">
                    <Button variant="outline" size="lg">View All Orders</Button>
                </Link>
                {isAdmin && (
                    <Link to="/admin/trash">
                        <Button variant="outline" size="lg" className="text-red-600 border-red-200 hover:bg-red-50">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Trash
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    );
}
