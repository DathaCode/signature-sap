import axios from 'axios'
import type { UploadResponse, WorksheetData } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

export const orderApi = {
    /**
     * Upload Excel order file
     */
    uploadOrder: async (file: File, customerName: string): Promise<UploadResponse> => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('customerName', customerName)

        const response = await api.post<UploadResponse>('/orders/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
        return response.data
    },

    /**
     * Confirm order and deduct inventory
     */
    confirmOrder: async (orderId: string): Promise<{ status: string; message: string }> => {
        const response = await api.post(`/orders/${orderId}/confirm`)
        return response.data
    },

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

export default api
