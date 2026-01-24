import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import OrderUpload from './pages/OrderUpload'
import WorksheetPreview from './pages/WorksheetPreview'
import InventoryDashboard from './pages/InventoryDashboard'

function App() {
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Navigate to="/orders/upload" replace />} />
                <Route path="/orders/upload" element={<OrderUpload />} />
                <Route path="/orders/:orderId/worksheets" element={<WorksheetPreview />} />
                <Route path="/inventory" element={<InventoryDashboard />} />
            </Routes>
        </Layout>
    )
}

export default App
