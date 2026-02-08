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

    // Calculated
    calculatedWidth?: number;
    calculatedDrop?: number;
    price?: number;
    fabricGroup?: number;
    discountPercent?: number;
    notes?: string;
}

export interface CreateOrderRequest {
    productType: ProductType;
    items: BlindItem[];
    dateRequired?: string;
    notes?: string;
}

export interface OrderSummary {
    subtotal: number;
    discount: number;
    total: number;
    itemCount: number;
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

    items: BlindItem[];

    createdAt: string;
    updatedAt: string;
}
