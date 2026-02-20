import axios from 'axios'
import type { WorksheetData } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor to attach token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token')
        if (token) {
            config.headers.Authorization = `Bearer ${token}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Response interceptor to handle 401 (optional: add refresh logic here)
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response?.status === 401) {
            // Clear token if expired/invalid
            localStorage.removeItem('token')
            // window.location.href = '/login' // Optional: Force redirect
        }
        return Promise.reject(error)
    }
)

// Order Management requests
export const orderApi = {
    /**
     * Get worksheets for an order
     */
    getWorksheets: async (orderId: string): Promise<WorksheetData> => {
        const response = await api.get(`/orders/${orderId}/worksheets`)
        return response.data.data
    },

    /**
     * Download worksheet
     */
    downloadWorksheet: async (
        orderId: string,
        type: 'fabric_cut' | 'tube_cut',
        format: 'csv' | 'pdf'
    ): Promise<Blob> => {
        const response = await api.get(`/orders/${orderId}/download`, {
            params: { type, format },
            responseType: 'blob',
        })
        return response.data
    },
}


export const inventoryApi = {
    /**
     * Get all inventory items with optional filters
     */
    getInventory: async (params?: { category?: string; search?: string }): Promise<import('../types').InventoryItem[]> => {
        const response = await api.get('/inventory', { params })
        return response.data.data
    },

    /**
     * Get single inventory item with details
     */
    getInventoryItem: async (id: string): Promise<import('../types').InventoryItem & { recentTransactions: import('../types').InventoryTransaction[] }> => {
        const response = await api.get(`/inventory/${id}`)
        return response.data.data
    },

    /**
     * Add new inventory item
     */
    addInventory: async (data: Omit<import('../types').InventoryItem, 'id' | 'isLowStock' | 'createdAt' | 'updatedAt'>): Promise<import('../types').InventoryItem> => {
        const response = await api.post('/inventory', data)
        return response.data.data
    },

    /**
     * Update inventory item
     */
    updateInventory: async (id: string, data: Partial<import('../types').InventoryItem>): Promise<import('../types').InventoryItem> => {
        const response = await api.put(`/inventory/${id}`, data)
        return response.data.data
    },

    /**
     * Adjust inventory quantity
     */
    adjustQuantity: async (id: string, quantityChange: number, notes?: string): Promise<{ newBalance: number }> => {
        const response = await api.post(`/inventory/${id}/adjust`, { quantityChange, notes })
        return response.data.data
    },

    /**
     * Get transaction history with filters
     */
    getTransactions: async (params?: { itemId?: string; startDate?: string; endDate?: string }): Promise<import('../types').InventoryTransaction[]> => {
        const response = await api.get('/inventory/transactions', { params })
        return response.data.data
    },

    /**
     * Delete inventory item (soft delete)
     */
    deleteInventory: async (id: string): Promise<void> => {
        await api.delete(`/inventory/${id}`)
    },

    /**
     * Bulk import CSV
     */
    bulkImport: async (file: File): Promise<{ imported: number; skipped: number; errors: string[] }> => {
        const formData = new FormData()
        formData.append('file', file)
        const response = await api.post('/inventory/bulk-import', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data.data
    }
}

export const authApi = {
    login: async (credentials: import('../types/auth').LoginCredentials): Promise<import('../types/auth').AuthResponse> => {
        const response = await api.post('/auth/login', credentials)
        return response.data
    },

    register: async (credentials: import('../types/auth').RegisterCredentials): Promise<import('../types/auth').AuthResponse> => {
        const response = await api.post('/auth/register', credentials)
        return response.data
    },

    logout: async (): Promise<void> => {
        await api.post('/auth/logout')
    },

    getCurrentUser: async (): Promise<{ user: import('../types/auth').User }> => {
        const response = await api.get('/auth/me')
        return response.data.data
    }
}

export const pricingApi = {
    /**
     * Calculate fabric price only (from matrix)
     */
    calculatePrice: async (data: {
        material: string;
        fabricType: string;
        width: number;
        drop: number
    }): Promise<{ price: number; fabricGroup: number; discountPercent: number }> => {
        const response = await api.post('/pricing/calculate', data)
        return response.data.data
    },

    /**
     * Calculate comprehensive blind price with all components
     */
    calculateBlindPrice: async (data: {
        width: number;
        drop: number;
        material: string;
        fabricType: string;
        fabricColour: string;
        chainOrMotor: string;
        chainType?: string;
        bracketType: string;
        bracketColour: string;
        bottomRailType: string;
        bottomRailColour: string;
        controlSide?: string;
    }): Promise<{
        fabricPrice: number;
        motorChainPrice: number;
        bracketPrice: number;
        chainPrice: number;
        clipsPrice: number;
        idlerClutchPrice: number;
        stopBoltSafetyLockPrice: number;
        totalPrice: number;
        fabricGroup: number;
        discountPercent: number;
        componentsUsed: string[];
    }> => {
        const response = await api.post('/pricing/calculate-blind', data)
        return response.data.data
    },

    /**
     * Get all component prices (admin)
     */
    getAllComponentPrices: async (category?: string): Promise<{
        components: Array<{
            id: string;
            category: string;
            name: string;
            variant: string | null;
            price: number;
            unit: string;
        }>;
        total: number;
    }> => {
        const response = await api.get('/pricing/components/all', { params: { category } })
        return response.data.data
    },

    /**
     * Update component price (admin)
     */
    updateComponentPrice: async (id: string, price: number): Promise<void> => {
        await api.patch(`/pricing/component/${id}`, { price })
    }
}

export const webOrderApi = {
    /**
     * Create a new web order
     */
    createOrder: async (data: import('../types/order').CreateOrderRequest): Promise<import('../types/order').Order> => {
        const response = await api.post('/web-orders/create', data)
        return response.data.data
    },

    /**
     * Get orders for the current user
     */
    getMyOrders: async (params?: { status?: string; page?: number; limit?: number }): Promise<{ orders: import('../types/order').Order[]; total: number }> => {
        const response = await api.get('/web-orders/my-orders', { params })
        return response.data.data
    },

    /**
     * Get a single order by ID
     */
    getOrder: async (id: string): Promise<import('../types/order').Order> => {
        const response = await api.get(`/web-orders/${id}`)
        return response.data.data
    },

    /**
     * Cancel an order
     */
    cancelOrder: async (id: string): Promise<void> => {
        await api.delete(`/web-orders/${id}`)
    }
}

export const adminOrderApi = {
    /**
     * Get all orders (admin)
     */
    getAllOrders: async (params?: { status?: string; productType?: string; userId?: string }): Promise<{ orders: import('../types/order').Order[]; count: number }> => {
        const response = await api.get('/web-orders/admin/all', { params })
        return response.data.data
    },

    /**
     * Approve order
     */
    approveOrder: async (id: string, adminNotes?: string): Promise<import('../types/order').Order> => {
        const response = await api.post(`/web-orders/${id}/approve`, { adminNotes })
        return response.data.data
    },

    /**
     * Send to production (runs optimization)
     */
    sendToProduction: async (id: string): Promise<import('../types/order').WorksheetPreviewResponse> => {
        const response = await api.post(`/web-orders/${id}/send-to-production`)
        return response.data.data
    },

    /**
     * Get worksheet preview
     */
    getWorksheetPreview: async (id: string): Promise<import('../types/order').WorksheetPreviewResponse> => {
        const response = await api.get(`/web-orders/${id}/worksheets/preview`)
        return response.data.data
    },

    /**
     * Accept worksheets and deduct inventory
     */
    acceptWorksheets: async (id: string): Promise<any> => {
        const response = await api.post(`/web-orders/${id}/worksheets/accept`)
        return response.data.data
    },

    /**
     * Recalculate optimization
     */
    recalculate: async (id: string): Promise<import('../types/order').WorksheetPreviewResponse> => {
        const response = await api.post(`/web-orders/${id}/recalculate`)
        return response.data.data
    },

    /**
     * Download worksheet file
     */
    downloadWorksheet: async (id: string, type: 'fabric-cut-csv' | 'fabric-cut-pdf' | 'tube-cut-csv' | 'tube-cut-pdf'): Promise<Blob> => {
        const response = await api.get(`/web-orders/${id}/worksheets/download/${type}`, {
            responseType: 'blob',
        })
        return response.data
    },

    /**
     * Update order status
     */
    updateStatus: async (id: string, status: string): Promise<import('../types/order').Order> => {
        const response = await api.patch(`/web-orders/${id}/status`, { status })
        return response.data.data
    }
}

export const adminUserApi = {
    /**
     * Get all users (admin)
     */
    getAllUsers: async (params?: { role?: string; search?: string; isActive?: string }): Promise<{ users: import('../types/auth').User[]; count: number }> => {
        const response = await api.get('/users', { params })
        return response.data.data
    },

    /**
     * Get single user with orders and quotes (admin)
     */
    getUserById: async (id: string): Promise<any> => {
        const response = await api.get(`/users/${id}`)
        return response.data.data.user
    },

    /**
     * Create a new customer account (admin)
     */
    createUser: async (data: { name: string; email: string; password: string; phone: string; address: string; company?: string }): Promise<import('../types/auth').User> => {
        const response = await api.post('/users', data)
        return response.data.data.user
    },

    /**
     * Update user (e.g. deactivate/activate, change details)
     */
    updateUser: async (id: string, data: Partial<import('../types/auth').User>): Promise<import('../types/auth').User> => {
        const response = await api.patch(`/users/${id}`, data)
        return response.data.data.user
    }
}

export const quoteApi = {
    /**
     * Create a new quote
     */
    createQuote: async (data: { productType: string; items: import('../types/order').BlindItem[]; notes?: string }): Promise<any> => {
        const response = await api.post('/quotes/create', data)
        return response.data
    },

    /**
     * Get all quotes for the current user
     */
    getMyQuotes: async (): Promise<{ quotes: any[] }> => {
        const response = await api.get('/quotes/my-quotes')
        return response.data
    },

    /**
     * Get a single quote by ID
     */
    getQuote: async (id: string): Promise<any> => {
        const response = await api.get(`/quotes/${id}`)
        return response.data
    },

    /**
     * Convert a quote to an order
     */
    convertToOrder: async (id: string): Promise<any> => {
        const response = await api.post(`/quotes/${id}/convert-to-order`)
        return response.data
    },

    /**
     * Delete a quote
     */
    deleteQuote: async (id: string): Promise<void> => {
        await api.delete(`/quotes/${id}`)
    },
}

export const adminPricingApi = {
    /**
     * Get pricing matrix
     */
    getPricing: async (fabricGroup: number): Promise<any[]> => {
        const response = await api.get(`/pricing/matrix/${fabricGroup}`)
        return response.data.data
    },

    /**
     * Update pricing cell
     */
    updatePrice: async (fabricGroup: number, width: number, drop: number, price: number): Promise<void> => {
        await api.post('/pricing/update', { fabricGroup, width, drop, price })
    }
}

export default api
