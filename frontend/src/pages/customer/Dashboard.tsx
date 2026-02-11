import { useAuth } from "../../context/AuthContext";
import { Button } from "../../components/ui/Button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { webOrderApi, quoteApi } from "../../services/api";
import { Loader2 } from "lucide-react";

export default function CustomerDashboard() {
    const { user, logout } = useAuth();
    const [stats, setStats] = useState({ pending: 0, activeQuotes: 0, totalOrders: 0, completedOrders: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // Fetch orders
                const { orders } = await webOrderApi.getMyOrders();
                const pendingCount = orders.filter(o => o.status === 'PENDING').length;
                const completedCount = orders.filter(o => o.status === 'COMPLETED').length;

                // Fetch quotes and count only non-converted ones
                let activeQuotesCount = 0;
                try {
                    const { quotes } = await quoteApi.getMyQuotes();
                    activeQuotesCount = quotes.filter(q => !q.convertedToOrder).length;
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

                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
                    <h3 className="font-semibold leading-none tracking-tight">Account Status</h3>
                    <div className="mt-2 flex items-center gap-2">
                        <span className="flex h-3 w-3 rounded-full bg-green-500" />
                        <span className="font-medium">Active</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{user?.company || user?.email}</p>
                </div>
            </div>

            <div className="flex gap-4">
                <Link to="/orders/new">
                    <Button size="lg">Place New Order</Button>
                </Link>
                <Link to="/orders">
                    <Button variant="outline" size="lg">View All Orders</Button>
                </Link>
            </div>
        </div>
    );
}
