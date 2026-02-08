import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import WorksheetPreview from './pages/WorksheetPreview'
import InventoryDashboard from './pages/InventoryDashboard'
import LoginPage from './pages/auth/Login'
import RegisterPage from './pages/auth/Register'
import CustomerDashboard from './pages/customer/Dashboard'
import NewOrderPage from './pages/orders/NewOrder'
import MyOrders from './pages/customer/MyOrders'
import OrderDetails from './pages/orders/OrderDetails'
import OrderManagement from './pages/admin/OrderManagement'
import UserManagement from './pages/admin/UserManagement'
import PricingManagement from './pages/admin/PricingManagement'
import { ProtectedRoute } from './components/layout/ProtectedRoute'

function App() {
    return (
        <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* Admin Routes (Protected) */}
            <Route
                path="/admin/*"
                element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                        <Layout>
                            <Routes>
                                <Route path="orders" element={<OrderManagement />} />
                                <Route path="orders/:orderId" element={<OrderDetails />} />
                                <Route path="orders/:orderId/worksheets" element={<WorksheetPreview />} />
                                <Route path="users" element={<UserManagement />} />
                                <Route path="pricing" element={<PricingManagement />} />
                                <Route path="inventory" element={<InventoryDashboard />} />
                                <Route path="*" element={<Navigate to="/admin/inventory" replace />} />
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                }
            />

            {/* Customer Routes (Protected) */}
            <Route
                path="/*"
                element={
                    <ProtectedRoute allowedRoles={['CUSTOMER', 'ADMIN']}>
                        <Layout>
                            <Routes>
                                <Route path="dashboard" element={<CustomerDashboard />} />
                                <Route path="orders/new" element={<NewOrderPage />} />
                                <Route path="orders" element={<MyOrders />} />
                                <Route path="orders/:orderId" element={<OrderDetails />} />
                                <Route path="*" element={<Navigate to="/dashboard" replace />} />
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                }
            />
        </Routes>
    )
}

export default App
