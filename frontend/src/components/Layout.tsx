import { Link, useLocation } from 'react-router-dom';
import { Package, FileText, ShoppingBag, LogOut, ShieldCheck, Home, ChevronRight, Users, DollarSign, ClipboardList } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const { user, logout } = useAuth();

    const isActive = (path: string) => location.pathname.startsWith(path);
    const isAdmin = user?.role === 'ADMIN';

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-brand-navy shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center space-x-4">
                            <img
                                src="/logo.png"
                                alt="Signature Shades"
                                className="h-12 w-auto"
                            />
                            <div className="hidden sm:block">
                                <h1 className="text-white text-xl font-bold">Signature Shades</h1>
                                <p className="text-brand-gold text-sm">
                                    {isAdmin ? 'Warehouse Management' : 'Customer Portal'}
                                </p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex items-center space-x-1">
                            <Link
                                to="/dashboard"
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/dashboard')
                                        ? 'bg-brand-gold text-white'
                                        : 'text-white hover:bg-brand-navy-light'
                                    }`}
                            >
                                <Home className="h-5 w-5" />
                                <span className="hidden sm:inline">Dashboard</span>
                            </Link>

                            <Link
                                to="/new-order"
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/new-order')
                                        ? 'bg-brand-gold text-white'
                                        : 'text-white hover:bg-brand-navy-light'
                                    }`}
                            >
                                <ShoppingBag className="h-5 w-5" />
                                <span className="hidden sm:inline">New Order</span>
                            </Link>

                            <Link
                                to="/quotes"
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/quotes')
                                        ? 'bg-brand-gold text-white'
                                        : 'text-white hover:bg-brand-navy-light'
                                    }`}
                            >
                                <FileText className="h-5 w-5" />
                                <span className="hidden sm:inline">My Quotes</span>
                            </Link>

                            {isAdmin && (
                                <>
                                    <Link
                                        to="/admin/orders"
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/admin/orders')
                                                ? 'bg-brand-gold text-white'
                                                : 'text-white hover:bg-brand-navy-light'
                                            }`}
                                    >
                                        <ClipboardList className="h-5 w-5" />
                                        <span className="hidden sm:inline">Orders</span>
                                    </Link>
                                    <Link
                                        to="/admin/inventory"
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/admin/inventory')
                                                ? 'bg-brand-gold text-white'
                                                : 'text-white hover:bg-brand-navy-light'
                                            }`}
                                    >
                                        <Package className="h-5 w-5" />
                                        <span className="hidden sm:inline">Inventory</span>
                                    </Link>
                                    <Link
                                        to="/admin/users"
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/admin/users')
                                                ? 'bg-brand-gold text-white'
                                                : 'text-white hover:bg-brand-navy-light'
                                            }`}
                                    >
                                        <Users className="h-5 w-5" />
                                        <span className="hidden sm:inline">Users</span>
                                    </Link>
                                    <Link
                                        to="/admin/pricing"
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/admin/pricing')
                                                ? 'bg-brand-gold text-white'
                                                : 'text-white hover:bg-brand-navy-light'
                                            }`}
                                    >
                                        <DollarSign className="h-5 w-5" />
                                        <span className="hidden sm:inline">Pricing</span>
                                    </Link>
                                </>
                            )}

                            <button
                                onClick={logout}
                                className="flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors text-white hover:bg-red-600"
                            >
                                <LogOut className="h-5 w-5" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>

                            {isAdmin && (
                                <div className="ml-2 px-3 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" />
                                    ADMIN
                                </div>
                            )}
                        </nav>
                    </div>

                    {/* Breadcrumb */}
                    {location.pathname !== '/' && (
                        <div className="mt-4 flex items-center space-x-2 text-sm text-gray-300">
                            <Link to="/" className="hover:text-brand-gold transition-colors">
                                Home
                            </Link>
                            {location.pathname.split('/').filter(Boolean).map((segment, index, array) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <ChevronRight className="h-4 w-4" />
                                    <span className={index === array.length - 1 ? 'text-brand-gold font-medium' : ''}>
                                        {segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <p className="text-center text-gray-600 text-sm">
                        © 2026 Signature Shades | Blinds | Curtains | Shutters
                    </p>
                </div>
            </footer>
        </div>
    );
}
