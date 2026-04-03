import { Link, useLocation } from 'react-router-dom';
import { FileText, ShoppingBag, LogOut, ShieldCheck, Home, ChevronRight, ClipboardList, Warehouse, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LayoutProps {
    children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();
    const { user, logout } = useAuth();

    const isActive = (path: string) => location.pathname.startsWith(path);
    const isAdmin = user?.role === 'ADMIN';
    const isWarehouse = user?.role === 'WAREHOUSE';

    const navLink = (path: string, icon: React.ReactNode, label: string) => (
        <Link
            to={path}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(path)
                ? 'bg-brand-gold text-white shadow-sm'
                : 'text-brand-navy hover:bg-brand-gold/10 hover:text-brand-gold-dark'
                }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
        </Link>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
                    <div className="flex items-center justify-between">
                        {/* Logo */}
                        <div className="flex items-center space-x-3">
                            <img
                                src="/app-icon.webp"
                                alt="Signature Shades"
                                className="h-11 w-auto"
                            />
                            <div className="hidden sm:block">
                                <h1 className="text-brand-navy text-lg font-bold leading-tight">Signature Shades</h1>
                                <p className="text-brand-gold text-xs font-medium">Order Management</p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex items-center space-x-1">
                            {/* Warehouse-only nav */}
                            {isWarehouse ? (
                                <>
                                    {navLink('/warehouse/orders', <ClipboardList className="h-4 w-4" />, 'Orders')}
                                    {navLink('/warehouse/inventory', <Package className="h-4 w-4" />, 'Inventory')}
                                </>
                            ) : (
                                <>
                                    {navLink('/dashboard', <Home className="h-4 w-4" />, 'Dashboard')}
                                    {navLink('/new-order', <ShoppingBag className="h-4 w-4" />, 'New Order')}
                                    {navLink('/quotes', <FileText className="h-4 w-4" />, 'My Quotes')}
                                    {isAdmin && navLink('/admin/orders', <ClipboardList className="h-4 w-4" />, 'Orders')}
                                </>
                            )}

                            <button
                                onClick={logout}
                                className="flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors text-gray-500 hover:bg-red-50 hover:text-red-600"
                            >
                                <LogOut className="h-4 w-4" />
                                <span className="hidden sm:inline">Logout</span>
                            </button>

                            {isAdmin && (
                                <div className="ml-1 px-3 py-1 bg-brand-gold text-white text-xs font-bold rounded-full flex items-center gap-1">
                                    <ShieldCheck className="h-3 w-3" />
                                    ADMIN
                                </div>
                            )}
                            {isWarehouse && (
                                <div className="ml-1 px-3 py-1 bg-brand-navy text-white text-xs font-bold rounded-full flex items-center gap-1">
                                    <Warehouse className="h-3 w-3" />
                                    WAREHOUSE
                                </div>
                            )}
                        </nav>
                    </div>

                    {/* Breadcrumb */}
                    {location.pathname !== '/' && (
                        <div className="mt-3 flex items-center space-x-2 text-xs text-gray-700">
                            <Link to="/" className="hover:text-brand-gold transition-colors">
                                Home
                            </Link>
                            {location.pathname.split('/').filter(Boolean).map((segment, index, array) => (
                                <div key={index} className="flex items-center space-x-2">
                                    <ChevronRight className="h-3 w-3" />
                                    <span className={index === array.length - 1 ? 'text-brand-gold font-medium' : ''}>
                                        {segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            {/* Background watermark */}
            <div
                className="fixed inset-0 pointer-events-none z-0"
                style={{
                    backgroundImage: 'url(/bg-watermark.png)',
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'center center',
                    backgroundSize: 'contain',
                    opacity: 0.03,
                }}
            />

            {/* Main Content */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {children}
            </main>

            {/* Footer */}
            <footer className="relative z-10 bg-white border-t border-gray-200 mt-auto">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <p className="text-center text-gray-600 text-sm">
                        &copy; 2026 Signature Shades | Blinds | Curtains | Shutters
                    </p>
                </div>
            </footer>
        </div>
    );
}
