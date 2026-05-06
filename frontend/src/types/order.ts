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

    // Remote / Charger (shared with curtains)
    remotes?: string;
    chargerHub?: string;

    // Pelmet section (Blinds)
    requiresPelmet?: boolean;
    pelmetType?: string;
    pelmetColor?: string;
    pelmetSize?: string;
    pelmetCustomSize?: number;
}

export interface CurtainItem {
    id?: number;
    // Common
    location: string;
    width: number;
    drop: number;

    // Curtain configuration
    curtainType?: string;
    hem?: number;
    fabric?: string;
    fabricColour?: string;
    installation?: string;
    bracketType?: string;
    trackColour?: string;
    openingType?: string;
    wandSize?: number;
    fullness?: number;

    // Track Type section
    requiresTracks?: boolean;
    trackType?: string;
    motorType?: string;
    trackControlSide?: string;
    remotes?: string;
    chargerHub?: string;
    trackColor?: string;

    // Bend section
    requiresBentTracks?: boolean;
    bendType?: string;
    bendQty?: number;
    bendFilePath?: string;

    // Drop deduction
    requiresDropDeduction?: boolean;
    dropDeductionValue?: number;

    // Calculated fields
    deductedDrop?: number;
    hookCount?: number;
    leftHooks?: number;
    rightHooks?: number;
    bracketCount?: number;
    wandCount?: number;
    fabricLength?: number;
    fabricMeters?: number;
    dropSurcharge?: number;

    // Pricing
    fabricGroup?: string;
    fabricCost?: number;
    hookCost?: number;
    bracketCost?: number;
    wandCost?: number;
    subtotal?: number;
    gst?: number;
    total?: number;
    price?: number;
}

export interface CreateOrderRequest {
    productType: ProductType;
    items: BlindItem[] | CurtainItem[];
    dateRequired?: string;
    notes?: string;
    customerReference?: string;
    // Customer details for the specific order (delivery / contact)
    siteAddress?: string;
    contactNumber?: string;
}

export interface OrderSummary {
    subtotal: number;
    discount: number;
    total: number;
    itemCount: number;
}

// Worksheet / Optimization Types
export interface CutLine {
    type: 'horizontal' | 'vertical';
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    position: number;
    label: string;
}

export interface PlacedPanel {
    id: string;
    x: number;
    y: number;
    width: number;
    length: number;
    rotated: boolean;
    label: string;
    blindNumber?: number;
    location?: string;
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
    cutSequence?: CutLine[];
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

export interface GenerationStats {
    totalGenerations: number;
    bestGeneration: number;
    convergenceTime: number;
    populationSize: number;
    seedsTested: number;
}

export interface GeneticValidation {
    overlaps: number;
    outOfBounds: number;
    isGuillotineValid: boolean;
    guillotineStages: number;
}

export interface FabricGroupData {
    optimization: {
        sheets: Sheet[];
        statistics: OptimizationStatistics;
        // Genetic algorithm metadata
        generationStats?: GenerationStats;
        validation?: GeneticValidation;
        isGuillotineValid?: boolean;
        strategy?: string;
    };
    items: BlindItem[];
}

export interface CutPiece {
    pieceNumber: number;
    cuts: { location: string; width: number }[];
    totalUsed: number;
    waste: number;
}

export interface TubeGroup {
    bottomRailType: string;
    bottomRailColour: string;
    blinds: { location: string; originalWidth: number; tubeCutWidth?: number; chainOrMotor?: string }[];
    totalWidth: number;
    baseQuantity: number;
    wastage: number;
    finalQuantity: number;
    piecesToDeduct: number;
    stockLength: number;
    cuttingOrder?: CutPiece[];
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
    fabricOrdered?: boolean;
    label?: string;

    items: (BlindItem | CurtainItem)[];

    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
}
