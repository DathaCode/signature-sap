import { useEffect, useState } from 'react';
import { adminUserApi } from '../../services/api';
import { User } from '../../types/auth'; // Ensure this matches User type
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Loader2, UserX, UserCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Input } from '../../components/ui/Input';

export default function UserManagement() {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (searchTerm) params.search = searchTerm;

            const data = await adminUserApi.getAllUsers(params);
            setUsers(data.users);
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

    const toggleStatus = async (user: User) => {
        if (!confirm(`Are you sure you want to ${user.isActive ? 'deactivate' : 'activate'} this user?`)) return;
        try {
            await adminUserApi.updateUser(user.id, { isActive: !user.isActive });
            toast.success(`User ${user.isActive ? 'deactivated' : 'activated'}`);
            setUsers(users.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
        } catch (error) {
            console.error(error);
            toast.error('Failed to update user');
        }
    };

    return (
        <div className="space-y-6 p-8 max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
                    <p className="text-muted-foreground">Manage customer and admin accounts.</p>
                </div>
                <div className="flex gap-4 w-1/3">
                    <Input
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                    />
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Users</CardTitle>
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
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Name</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Email</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Company</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Role</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground">Status</th>
                                        <th className="h-12 px-4 align-middle font-medium text-muted-foreground text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="[&_tr:last-child]:border-0">
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b transition-colors hover:bg-muted/50">
                                            <td className="p-4 align-middle font-medium">{user.name}</td>
                                            <td className="p-4 align-middle">{user.email}</td>
                                            <td className="p-4 align-middle">{user.company || '-'}</td>
                                            <td className="p-4 align-middle">
                                                <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'}>
                                                    {user.role}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle">
                                                <Badge variant={user.isActive ? 'success' : 'destructive'}>
                                                    {user.isActive ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="p-4 align-middle text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => toggleStatus(user)}
                                                    className={user.isActive ? "text-red-600 hover:text-red-700 hover:bg-red-50" : "text-green-600 hover:text-green-700 hover:bg-green-50"}
                                                >
                                                    {user.isActive ? (
                                                        <>
                                                            <UserX className="mr-2 h-4 w-4" />
                                                            Deactivate
                                                        </>
                                                    ) : (
                                                        <>
                                                            <UserCheck className="mr-2 h-4 w-4" />
                                                            Activate
                                                        </>
                                                    )}
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-8 text-center text-muted-foreground">
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
