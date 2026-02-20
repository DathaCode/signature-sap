import { useEffect, useState } from 'react';
import { adminUserApi } from '../../services/api';
import { User } from '../../types/auth';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import {
    Loader2, UserX, UserCheck, ChevronDown, ChevronUp,
    ShoppingBag, FileText, Phone, MapPin, Building2, Calendar
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Input } from '../../components/ui/Input';

interface UserWithCounts extends User {
    _count?: { orders: number; quotes: number };
}

interface UserDetail extends UserWithCounts {
    phone?: string;
    address?: string;
    updatedAt?: string;
    orders?: Array<{
        id: string;
        orderNumber: string;
        customerReference?: string;
        status: string;
        total: number;
        createdAt: string;
    }>;
    quotes?: Array<{
        id: string;
        quoteNumber: string;
        customerReference?: string;
        total: number;
        convertedToOrder?: string;
        createdAt: string;
        expiresAt: string;
    }>;
}

const STATUS_COLOURS: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    PRODUCTION: 'bg-purple-100 text-purple-800',
    COMPLETED: 'bg-green-100 text-green-800',
    CANCELLED: 'bg-red-100 text-red-800',
};

export default function UserManagement() {
    const [users, setUsers] = useState<UserWithCounts[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedUser, setExpandedUser] = useState<string | null>(null);
    const [userDetails, setUserDetails] = useState<Record<string, UserDetail>>({});
    const [loadingDetail, setLoadingDetail] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (searchTerm) params.search = searchTerm;

            const data = await adminUserApi.getAllUsers(params);
            setUsers(data.users as UserWithCounts[]);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            toast.error('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            fetchUsers();
        }, 500);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const toggleStatus = async (user: UserWithCounts) => {
        if (!confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} ${user.name}?`)) return;
        try {
            await adminUserApi.updateUser(user.id, { isActive: !user.isActive });
            toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
            setUsers(users.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
            // Update cached detail if exists
            if (userDetails[user.id]) {
                setUserDetails(prev => ({
                    ...prev,
                    [user.id]: { ...prev[user.id], isActive: !user.isActive }
                }));
            }
        } catch (error) {
            console.error(error);
            toast.error('Failed to update user');
        }
    };

    const toggleExpand = async (userId: string) => {
        if (expandedUser === userId) {
            setExpandedUser(null);
            return;
        }

        setExpandedUser(userId);

        // Load detail if not cached
        if (!userDetails[userId]) {
            setLoadingDetail(userId);
            try {
                const detail = await adminUserApi.getUserById(userId);
                setUserDetails(prev => ({ ...prev, [userId]: detail }));
            } catch (error) {
                console.error('Failed to load user detail:', error);
                toast.error('Failed to load user details');
            } finally {
                setLoadingDetail(null);
            }
        }
    };

    const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-AU', {
        day: '2-digit', month: 'short', year: 'numeric'
    });

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage customer and admin accounts, view their orders and quotes.</p>
                </div>
                <div className="flex gap-4 w-1/3">
                    <Input
                        placeholder="Search by name, email or company..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Users ({users.length})</CardTitle>
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
                                    <tr className="border-b">
                                        <th className="h-12 px-4 font-medium text-muted-foreground w-8"></th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Name</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Email</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Company</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground text-center">Orders</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground text-center">Quotes</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Role</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {users.map((user) => (
                                        <>
                                            {/* Main row */}
                                            <tr
                                                key={`row-${user.id}`}
                                                className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                                                onClick={() => toggleExpand(user.id)}
                                            >
                                                <td className="px-4 py-3 text-gray-400">
                                                    {expandedUser === user.id
                                                        ? <ChevronUp className="h-4 w-4" />
                                                        : <ChevronDown className="h-4 w-4" />
                                                    }
                                                </td>
                                                <td className="p-4 font-medium">{user.name}</td>
                                                <td className="p-4">{user.email}</td>
                                                <td className="p-4">{user.company || <span className="text-gray-400">—</span>}</td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                                                        <ShoppingBag className="h-3 w-3 text-blue-500" />
                                                        {user._count?.orders ?? 0}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="inline-flex items-center gap-1 text-xs font-medium">
                                                        <FileText className="h-3 w-3 text-purple-500" />
                                                        {user._count?.quotes ?? 0}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                                                        {user.role}
                                                    </Badge>
                                                </td>
                                                <td className="p-4">
                                                    <Badge variant={user.isActive ? 'success' : 'destructive'}>
                                                        {user.isActive ? 'Active' : 'Inactive'}
                                                    </Badge>
                                                </td>
                                                <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => toggleStatus(user)}
                                                        className={user.isActive
                                                            ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                                            : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        }
                                                    >
                                                        {user.isActive ? (
                                                            <><UserX className="mr-2 h-4 w-4" />Deactivate</>
                                                        ) : (
                                                            <><UserCheck className="mr-2 h-4 w-4" />Activate</>
                                                        )}
                                                    </Button>
                                                </td>
                                            </tr>

                                            {/* Expanded detail row */}
                                            {expandedUser === user.id && (
                                                <tr key={`detail-${user.id}`} className="bg-slate-50 border-b">
                                                    <td colSpan={9} className="px-8 py-5">
                                                        {loadingDetail === user.id ? (
                                                            <div className="flex items-center gap-2 text-gray-500 py-4">
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                                Loading profile...
                                                            </div>
                                                        ) : userDetails[user.id] ? (
                                                            <div className="space-y-5">
                                                                {/* Profile Info */}
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                    <div className="flex items-start gap-2">
                                                                        <Phone className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                                                        <div>
                                                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Phone</p>
                                                                            <p className="font-medium">{userDetails[user.id].phone || '—'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <Building2 className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                                                        <div>
                                                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Company</p>
                                                                            <p className="font-medium">{userDetails[user.id].company || '—'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <MapPin className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                                                        <div>
                                                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Address</p>
                                                                            <p className="font-medium">{userDetails[user.id].address || '—'}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-start gap-2">
                                                                        <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
                                                                        <div>
                                                                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Member Since</p>
                                                                            <p className="font-medium">{formatDate(userDetails[user.id].createdAt || '')}</p>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                                                    {/* Orders */}
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                                                            <ShoppingBag className="h-4 w-4 text-blue-500" />
                                                                            Recent Orders ({userDetails[user.id].orders?.length ?? 0})
                                                                        </h4>
                                                                        {userDetails[user.id].orders?.length === 0 ? (
                                                                            <p className="text-xs text-gray-500 italic">No orders yet.</p>
                                                                        ) : (
                                                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                                                {userDetails[user.id].orders?.map(order => (
                                                                                    <div key={order.id} className="flex items-center justify-between text-xs bg-white border rounded px-3 py-2">
                                                                                        <div>
                                                                                            <span className="font-mono font-medium">{order.orderNumber}</span>
                                                                                            {order.customerReference && (
                                                                                                <span className="text-gray-400 ml-1.5">({order.customerReference})</span>
                                                                                            )}
                                                                                            <span className="text-gray-400 ml-2">{formatDate(order.createdAt)}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLOURS[order.status] || 'bg-gray-100 text-gray-700'}`}>
                                                                                                {order.status}
                                                                                            </span>
                                                                                            <span className="font-semibold">${Number(order.total).toFixed(2)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Quotes */}
                                                                    <div>
                                                                        <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
                                                                            <FileText className="h-4 w-4 text-purple-500" />
                                                                            Recent Quotes ({userDetails[user.id].quotes?.length ?? 0})
                                                                        </h4>
                                                                        {userDetails[user.id].quotes?.length === 0 ? (
                                                                            <p className="text-xs text-gray-500 italic">No quotes yet.</p>
                                                                        ) : (
                                                                            <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                                                                {userDetails[user.id].quotes?.map(quote => (
                                                                                    <div key={quote.id} className="flex items-center justify-between text-xs bg-white border rounded px-3 py-2">
                                                                                        <div>
                                                                                            <span className="font-mono font-medium">{quote.quoteNumber}</span>
                                                                                            {quote.customerReference && (
                                                                                                <span className="text-gray-400 ml-1.5">({quote.customerReference})</span>
                                                                                            )}
                                                                                            <span className="text-gray-400 ml-2">{formatDate(quote.createdAt)}</span>
                                                                                        </div>
                                                                                        <div className="flex items-center gap-2">
                                                                                            {quote.convertedToOrder ? (
                                                                                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Converted</span>
                                                                                            ) : (
                                                                                                <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">Active</span>
                                                                                            )}
                                                                                            <span className="font-semibold">${Number(quote.total).toFixed(2)}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                                No users found.
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
