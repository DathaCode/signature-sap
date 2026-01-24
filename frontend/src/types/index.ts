export interface WorksheetItem {
    blindNumber: string
    location: string
    originalWidthMm: number
    originalDropMm: number
    widthMm: number
    dropMm: number
    controlSide: 'LEFT' | 'RIGHT'
    controlColor: string
    chainOrMotor: string
    rollType: string
    fabricType: string
    fabricColor: string
    bottomRailType: string
    bottomRailColor: string
    highlightFlag: boolean
}

export interface Order {
    id: string
    customerName: string
    fileName: string
    itemCount: number
    duplicateCount: number
    items: WorksheetItem[]
    createdAt: string
}

export interface UploadResponse {
    status: 'success' | 'error'
    message: string
    data: Order
}

export interface InsufficientItem {
    itemType: string
    name: string
    required: number
    available: number
}

export interface Worksheet {
    orderId: string
    customerName: string
    orderDate: string
    type: 'fabric_cut' | 'tube_cut'
    columns: string[]
    items: any[]
}

export interface WorksheetData {
    fabricCut: Worksheet
    tubeCut: Worksheet
}

export type InventoryCategory = 'FABRIC' | 'BOTTOM_BAR' | 'MOTOR' | 'CHAIN'
export type UnitType = 'MM' | 'UNITS'
export type TransactionType = 'ADDITION' | 'DEDUCTION' | 'ADJUSTMENT'

export interface InventoryItem {
    id: string
    category: InventoryCategory
    itemName: string
    colorVariant: string | null
    quantity: number
    unitType: UnitType
    minStockAlert: number | null
    isLowStock: boolean
    createdAt: string
    updatedAt: string
}

export interface InventoryTransaction {
    id: string
    transactionType: TransactionType
    quantityChange: number
    newBalance: number
    notes: string | null
    createdAt: string
    order?: {
        id: string
        customerName: string
        orderDate: string
    }
    inventoryItem?: {
        id: string
        itemName: string
        colorVariant: string | null
        category: InventoryCategory
    }
}

export interface InventoryStats {
    totalItems: number
    lowStockItems: number
    totalValue?: number
}
