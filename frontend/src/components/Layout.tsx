import { Link, useLocation } from 'react-router-dom'
import { Package, Upload, ChevronRight } from 'lucide-react'

interface LayoutProps {
    children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation()

    const isActive = (path: string) => location.pathname.startsWith(path)

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
                                <p className="text-brand-gold text-sm">Warehouse Management</p>
                            </div>
                        </div>

                        {/* Navigation */}
                        <nav className="flex items-center space-x-1">

                            <Link
                                to="/inventory"
                                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${isActive('/inventory')
                                    ? 'bg-brand-gold text-white'
                                    : 'text-white hover:bg-brand-navy-light'
                                    }`}
                            >
                                <Package className="h-5 w-5" />
                                <span className="hidden sm:inline">Inventory</span>
                            </Link>
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
                                        {segment.charAt(0).toUpperCase() + segment.slice(1)}
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
    )
}
