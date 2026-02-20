export type ProductType = 'BLINDS' | 'CURTAINS' | 'SHUTTERS';
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PRODUCTION' | 'COMPLETED' | 'CANCELLED';

export interface BlindItem {
    id?: number;
    // Common
    location: string;
    width: number;
    drop: number;

    // Blind Specific (16 fields)
    fixing?: string;
    bracketType?: string;
    bracketColour?: string;
    controlSide?: 'Left' | 'Right';
    chainOrMotor?: string;
    roll?: 'Front' | 'Back';
    material?: string;
    fabricType?: string;
    fabricColour?: string;
    bottomRailType?: string;
    bottomRailColour?: string;
    chainType?: string;

    // Calculated
    calculatedWidth?: number;
    calculatedDrop?: number;
    fabricCutWidth?: number;
    price?: number;
    fabricGroup?: number;
    discountPercent?: number;
    notes?: string;

    // Pricing breakdown
    fabricPrice?: number;
    motorPrice?: number;
    bracketPrice?: number;
    chainPrice?: number;
    clipsPrice?: number;
    componentPrice?: number;
}

export interface CreateOrderRequest {
    productType: ProductType;
    items: BlindItem[];
    dateRequired?: string;
    notes?: string;
    customerReference?: string;
}

export interface OrderSummary {
    subtotal: number;
    discount: number;
    total: number;
    itemCount: number;
}

// Worksheet / Optimization Types
export interface PlacedPanel {
    id: string;
    x: number;
    y: number;
    width: number;
    length: number;
    rotated: boolean;
    label: string;
    originalWidth?: number;
    originalDrop?: number;
    orderItemId?: number;
}

export interface Sheet {
    id: number;
    width: number;
    length: number;
    panels: PlacedPanel[];
    usedArea: number;
    wastedArea: number;
    efficiency: number;
}

export interface OptimizationStatistics {
    usedStockSheets: number;
    totalUsedArea: number;
    totalWastedArea: number;
    wastePercentage: number;
    efficiency: number;
    totalCuts: number;
    totalPanels: number;
    totalFabricNeeded: number;
}

export interface FabricGroupData {
    optimization: {
        sheets: Sheet[];
        statistics: OptimizationStatistics;
    };
    items: BlindItem[];
}

export interface TubeGroup {
    bottomRailType: string;
    bottomRailColour: string;
    blinds: { location: string; originalWidth: number }[];
    totalWidth: number;
    baseQuantity: number;
    wastage: number;
    finalQuantity: number;
    piecesToDeduct: number;
    stockLength: number;
}

export interface TubeCutData {
    groups: TubeGroup[];
    totalPiecesNeeded: number;
}

export interface WorksheetDataResponse {
    id: string;
    orderId: string;
    fabricCutData: Record<string, FabricGroupData>;
    tubeCutData: TubeCutData;
    totalFabricMm: number;
    totalTubePieces: number;
    acceptedAt?: string;
    acceptedBy?: string;
}

export interface InventoryCheckItem {
    category: string;
    itemName: string;
    colorVariant?: string;
    required: number;
    available: number;
    sufficient: boolean;
}

export interface InventoryCheck {
    available: boolean;
    items: InventoryCheckItem[];
}

export interface WorksheetPreviewResponse {
    worksheetData: WorksheetDataResponse;
    inventoryCheck: InventoryCheck;
}

// Full Order Interface (Response)
export interface Order {
    id: string;
    orderNumber: string;
    userId: string;
    productType: ProductType;
    orderDate: string;
    dateRequired?: string;
    customerName: string;
    customerEmail?: string;
    status: OrderStatus;

    subtotal: number;
    discount: number;
    total: number;

    notes?: string;
    adminNotes?: string;
    customerReference?: string;

    items: BlindItem[];

    createdAt: string;
    updatedAt: string;
}
