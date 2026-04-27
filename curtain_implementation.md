# SHEER CURTAIN MODULE - COMPLETE IMPLEMENTATION

## PROJECT CONTEXT

**Application:** Signature Shades Order Management System  
**Location:** `F:\SIGNATUR SHADES\signature-sap`  
**Stack:** React + TypeScript (frontend), Node.js + Express + Prisma (backend), PostgreSQL  
**Existing:** Block Out Blinds fully implemented with 16-field form, 7-component pricing, fabric cut optimization

---

## OBJECTIVE

Implement complete Sheer Curtain ordering module alongside existing Blind system with 15-field configuration form, real-time component-based pricing, hook/bracket/fabric calculations, admin pricing management, production worksheets, and inventory integration.

---

## INPUT FIELDS (15 Fields)

| # | Field | Type | Options/Rules | Validation |
|---|-------|------|---------------|------------|
| 1 | Location | Text | Free text | Required, max 100 chars |
| 2 | Width | Number | No limit (mm) | Required, min 100mm |
| 3 | Drop | Number | Max 3000mm preferred | Required, min 100mm |
| 4 | Curtain Type | Dropdown | "S Fold" (fixed) | Required |
| 5 | Hem | Dropdown | "70mm" (fixed) | Required |
| 6 | Fabric | Dropdown | All fabrics (group hidden) | Required, groups for backend pricing only |
| 7 | Colour | Text | Custom entry | Required, free text input |
| 8 | Installation | Dropdown | "Wall" / "Ceiling" | Required |
| 9 | Bracket Type | Dropdown | "Standard" / "Extended" | Required |
| 10 | Track Colour | Text | Custom entry | Required, free text input |
| 11 | Opening Type | Dropdown | "Single Open" / "Centre Open" / "Free Fold" | Required |
| 12 | Wand Size | Dropdown | "1250mm" (single option) | Required, fixed value |
| 13 | Fullness | Dropdown | "120" / "140" / "144" | Required, affects fabric calc |

need to add below fields in the form

~Track Type section
Do you require tracks? - Yes / No  (below fields enabled if YES)
Track Type - Standard / Motorised
Bracket Type - Single / Extended
Motor Type (Direct - AC,  Battery - DC) - Alpha AC/Alpha DC/ Versa AC / Versa DC
Track Control Side - Right / Left
Remotes - single channel, 5 Channel, 15 Channel 
Charger/Hub - Alpha Charger/ PULSE 2 Hub / Alpha Neo
Track Color - Black / White

~Bend Section
Do you require bent tracks - No / Yes (below fields enabled if YES)
Bend Type - Angle - Attach a drawings with angles and width / Radius - Provide a physical template
Qty
Attach File here (file upload field-anytype)


---


## CALCULATION FORMULAS

### 1. Drop Deduction
```typescript
deductedDrop = drop - 30; // Always subtract 30mm
```

### 2. Hook Count Calculation

**Hook Spacing:** 54mm (constant)

```typescript
// Calculate raw hook count
const rawHooks = width / 54;
const roundedHooks = Math.round(rawHooks);

// Ensure even number (hooks must be in pairs)
const finalHooks = roundedHooks % 2 === 0 ? roundedHooks : roundedHooks + 1;

// Apply based on opening type
if (openingType === 'Single Open') {
  totalHooks = finalHooks;
  leftHooks = undefined;
  rightHooks = undefined;
}
else if (openingType === 'Centre Open' || openingType === 'Free Fold') {
  // Split width in half, calculate for each side
  const halfWidth = width / 2;
  const rawPerSide = halfWidth / 54;
  const roundedPerSide = Math.round(rawPerSide);
  const finalPerSide = roundedPerSide % 2 === 0 ? roundedPerSide : roundedPerSide + 1;
  
  leftHooks = finalPerSide;
  rightHooks = finalPerSide;
  totalHooks = leftHooks + rightHooks;
}
```

### 3. Fabric Length Calculation

**Uses selected Fullness value (120, 140, or 144)**

```typescript
let fabricLength: number;

if (openingType === 'Single Open') {
  fabricLength = (totalHooks * fullness) + 140;
}
else if (openingType === 'Centre Open' || openingType === 'Free Fold') {
  fabricLength = ((leftHooks + rightHooks) * fullness) + 280;
}

const fabricMeters = fabricLength / 1000;
```

**Example:**
```
Width: 3000mm
Opening: Single Open
Hooks: 56 (calculated)
Fullness: 144

Fabric = (56 × 144) + 140 = 8,064 + 140 = 8,204mm = 8.20m
```

### 4. Bracket Count Calculation

```typescript
function getBracketCount(width: number): number {
  if (width <= 2750) return 4;
  if (width <= 3750) return 5;
  if (width <= 4750) return 6;
  if (width <= 5750) return 7;
  if (width <= 6750) return 8;
  if (width <= 7750) return 9;
  if (width <= 8750) return 10;
  if (width <= 9750) return 11;
  if (width <= 10750) return 12;
  return 13;
}
```

### 5. Wand Count Calculation

```typescript
const wandCount = (openingType === 'Centre Open' || openingType === 'Free Fold') ? 2 : 1;
```

### 6. Drop Surcharge Calculation

```typescript
let dropSurcharge = 0;
if (drop > 3000) {
  const extraMeters = Math.ceil((drop - 3000) / 1000);
  dropSurcharge = extraMeters * 60; // $60 per meter over 3000mm
}
```

---

## PRICING STRUCTURE

### Fabric Groups & Base Pricing

**Group 1:**
- Fabrics: Cannes, Aston, Natural Collection, Zanzibar, Verne, Montreux, Coco
- Base Price: **$100 + GST per meter width**

**Group 2:**
- Fabrics: Altitude, Arena, Ditto, Georgia, Skye, Seattle, Bronte
- Base Price: **$100 + GST per meter width**

**Budget Group:**
- Fabrics: Bali, Melton
- Base Price: **$95 + GST per meter width**

**Note:** Groups are for backend pricing only - not visible to user in form

### Component-Based Pricing Calculation

```typescript
interface SheerCurtainPricing {
  fabricCost: number;
  hookCost: number;
  bracketCost: number;
  wandCost: number;
  dropSurcharge: number;
  subtotal: number;
  gst: number;
  total: number;
}

function calculateSheerPrice(item: CurtainItem): SheerCurtainPricing {
  // 1. Fabric cost (based on width in meters and fabric group)
  const widthMeters = item.width / 1000;
  const fabricPricePerMeter = getFabricPrice(item.fabric, item.fabricGroup);
  const fabricCost = widthMeters * fabricPricePerMeter;
  
  // 2. Hook cost
  const hookUnitPrice = getInventoryPrice('SHEER_HOOK');
  const hookCost = item.totalHooks * hookUnitPrice;
  
  // 3. Bracket cost (Standard or Extended)
  const bracketType = item.bracketType;
  const bracketUnitPrice = getInventoryPrice(`SHEER_BRACKET_${bracketType.toUpperCase()}`);
  const bracketCost = item.bracketCount * bracketUnitPrice;
  
  // 4. Wand cost (1250mm fixed size)
  const wandUnitPrice = getInventoryPrice('SHEER_WAND_1250');
  const wandCost = item.wandCount * wandUnitPrice;
  
  // 5. Drop surcharge (if drop > 3000mm)
  let dropSurcharge = 0;
  if (item.drop > 3000) {
    const extraMeters = Math.ceil((item.drop - 3000) / 1000);
    dropSurcharge = extraMeters * 60;
  }
  
  // Subtotal
  const subtotal = fabricCost + hookCost + bracketCost + wandCost + dropSurcharge;
  
  // GST (10%)
  const gst = subtotal * 0.10;
  
  // Total
  const total = subtotal + gst;
  
  return {
    fabricCost,
    hookCost,
    bracketCost,
    wandCost,
    dropSurcharge,
    subtotal,
    gst,
    total
  };
}
```

---

## DATABASE SCHEMA CHANGES

### 1. Update Prisma Schema

**File:** `backend/prisma/schema.prisma`

**Add to ProductType enum:**
```prisma
enum ProductType {
  BLINDS
  CURTAINS      // ← ADD THIS
  SHUTTERS
}
```

**Update Order model:**
```prisma
model Order {
  // ... existing fields
  
  productType    ProductType  @default(BLINDS)
  
  // ... rest of model
}
```

**Update OrderItem model:**
```prisma
model OrderItem {
  // ... existing blind fields
  
  // Sheer Curtain specific fields
  curtainType    String?        // "S Fold"
  hem            Int?           // 70mm
  installation   String?        // "Wall" / "Ceiling"
  bracketType    String?        // "Standard" / "Extended"
  trackColour    String?        // Free text
  openingType    String?        // "Single Open" / "Centre Open" / "Free Fold"
  wandSize       Int?           // 1250 (fixed)
  fullness       Int?           // 120 / 140 / 144
  
  // Calculated fields
  deductedDrop   Int?           // drop - 30
  hookCount      Int?           // Calculated from width
  leftHooks      Int?           // For Centre Open / Free Fold
  rightHooks     Int?           // For Centre Open / Free Fold
  bracketCount   Int?           // Calculated from width
  wandCount      Int?           // 1 or 2 based on opening type
  fabricLength   Int?           // Calculated in mm
  dropSurcharge  Float?         // If drop > 3000mm
  
  // Pricing breakdown
  fabricCost     Float?
  hookCost       Float?
  bracketCost    Float?
  wandCost       Float?
  
  // ... existing fields
}
```

**New model for Sheer Fabric Pricing:**
```prisma
model SheerFabricPricing {
  id             Int      @id @default(autoincrement())
  fabricGroup    String   // "Group 1" / "Group 2" / "Budget"
  fabricName     String   // "Cannes", "Bali", etc
  pricePerMeter  Float    // Base price per meter
  userId         Int?     // NULL = default, set = customer override
  user           User?    @relation(fields: [userId], references: [id])
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  @@unique([fabricGroup, fabricName, userId])
  @@index([fabricGroup])
  @@index([userId])
}
```

**Update InventoryCategory enum:**
```prisma
enum InventoryCategory {
  FABRIC
  BOTTOM_BAR
  BOTTOM_BAR_CLIP
  CHAIN
  ACMEDA
  TBS
  MOTOR
  ACCESSORY
  SHEER_FABRIC    // ← ADD
  SHEER_HOOK      // ← ADD
  SHEER_BRACKET   // ← ADD
  SHEER_WAND      // ← ADD
}
```

### 2. Run Migration

```bash
npx prisma migrate dev --name add_sheer_curtain_support
```

---

## BACKEND IMPLEMENTATION

### 1. Pricing Service

**Create:** `backend/src/services/sheerCurtainPricing.service.ts`

```typescript
import { prisma } from '../config/database';

interface CurtainItemInput {
  width: number;
  drop: number;
  openingType: string;
  fullness: number;
  bracketType: string;
  fabric: string;
  fabricGroup: string;
  userId?: number;
}

interface CurtainCalculation {
  deductedDrop: number;
  hookCount: number;
  leftHooks?: number;
  rightHooks?: number;
  fabricLength: number;
  fabricMeters: number;
  bracketCount: number;
  wandCount: number;
  dropSurcharge: number;
  fabricCost: number;
  hookCost: number;
  bracketCost: number;
  wandCost: number;
  subtotal: number;
  gst: number;
  total: number;
}

export class SheerCurtainPricingService {
  /**
   * Calculate all metrics and pricing for a curtain item
   */
  async calculateCurtainMetrics(item: CurtainItemInput): Promise<CurtainCalculation> {
    // 1. Drop deduction
    const deductedDrop = item.drop - 30;
    
    // 2. Hook count
    const { hookCount, leftHooks, rightHooks } = this.calculateHooks(
      item.width,
      item.openingType
    );
    
    // 3. Fabric length
    const { fabricLength, fabricMeters } = this.calculateFabricLength(
      hookCount,
      leftHooks,
      rightHooks,
      item.openingType,
      item.fullness
    );
    
    // 4. Bracket count
    const bracketCount = this.getBracketCount(item.width);
    
    // 5. Wand count
    const wandCount = (item.openingType === 'Centre Open' || item.openingType === 'Free Fold') ? 2 : 1;
    
    // 6. Drop surcharge
    const dropSurcharge = this.calculateDropSurcharge(item.drop);
    
    // 7. Component pricing
    const pricing = await this.calculatePricing(
      item,
      fabricMeters,
      hookCount,
      bracketCount,
      wandCount,
      dropSurcharge
    );
    
    return {
      deductedDrop,
      hookCount,
      leftHooks,
      rightHooks,
      fabricLength,
      fabricMeters,
      bracketCount,
      wandCount,
      dropSurcharge,
      ...pricing
    };
  }
  
  private calculateHooks(width: number, openingType: string) {
    const rawHooks = width / 54;
    const roundedHooks = Math.round(rawHooks);
    const finalHooks = roundedHooks % 2 === 0 ? roundedHooks : roundedHooks + 1;
    
    if (openingType === 'Single Open') {
      return {
        hookCount: finalHooks,
        leftHooks: undefined,
        rightHooks: undefined
      };
    } else { // Centre Open or Free Fold
      const halfWidth = width / 2;
      const rawPerSide = halfWidth / 54;
      const roundedPerSide = Math.round(rawPerSide);
      const finalPerSide = roundedPerSide % 2 === 0 ? roundedPerSide : roundedPerSide + 1;
      
      return {
        hookCount: finalPerSide * 2,
        leftHooks: finalPerSide,
        rightHooks: finalPerSide
      };
    }
  }
  
  private calculateFabricLength(
    hookCount: number,
    leftHooks: number | undefined,
    rightHooks: number | undefined,
    openingType: string,
    fullness: number
  ) {
    let fabricLength: number;
    
    if (openingType === 'Single Open') {
      fabricLength = (hookCount * fullness) + 140;
    } else {
      fabricLength = ((leftHooks! + rightHooks!) * fullness) + 280;
    }
    
    return {
      fabricLength,
      fabricMeters: fabricLength / 1000
    };
  }
  
  private getBracketCount(width: number): number {
    if (width <= 2750) return 4;
    if (width <= 3750) return 5;
    if (width <= 4750) return 6;
    if (width <= 5750) return 7;
    if (width <= 6750) return 8;
    if (width <= 7750) return 9;
    if (width <= 8750) return 10;
    if (width <= 9750) return 11;
    if (width <= 10750) return 12;
    return 13;
  }
  
  private calculateDropSurcharge(drop: number): number {
    if (drop <= 3000) return 0;
    const extraMeters = Math.ceil((drop - 3000) / 1000);
    return extraMeters * 60;
  }
  
  private async calculatePricing(
    item: CurtainItemInput,
    fabricMeters: number,
    hookCount: number,
    bracketCount: number,
    wandCount: number,
    dropSurcharge: number
  ) {
    // Get fabric price (with customer override if exists)
    const fabricPricePerMeter = await this.getFabricPrice(
      item.fabric,
      item.fabricGroup,
      item.userId
    );
    
    // Get component prices from inventory
    const hookPrice = await this.getInventoryPrice('SHEER_HOOK');
    const bracketPrice = await this.getInventoryPrice(
      item.bracketType === 'Standard' ? 'SHEER_BRACKET_STANDARD' : 'SHEER_BRACKET_EXTENDED'
    );
    const wandPrice = await this.getInventoryPrice('SHEER_WAND_1250');
    
    // Calculate costs
    const widthMeters = item.width / 1000;
    const fabricCost = widthMeters * fabricPricePerMeter;
    const hookCost = hookCount * hookPrice;
    const bracketCost = bracketCount * bracketPrice;
    const wandCost = wandCount * wandPrice;
    
    // Subtotal
    const subtotal = fabricCost + hookCost + bracketCost + wandCost + dropSurcharge;
    
    // GST (10%)
    const gst = subtotal * 0.10;
    
    // Total
    const total = subtotal + gst;
    
    return {
      fabricCost,
      hookCost,
      bracketCost,
      wandCost,
      subtotal,
      gst,
      total
    };
  }
  
  private async getFabricPrice(
    fabricName: string,
    fabricGroup: string,
    userId?: number
  ): Promise<number> {
    // Check for customer-specific pricing override
    if (userId) {
      const override = await prisma.sheerFabricPricing.findUnique({
        where: {
          fabricGroup_fabricName_userId: {
            fabricGroup,
            fabricName,
            userId
          }
        }
      });
      
      if (override) {
        return override.pricePerMeter;
      }
    }
    
    // Get default pricing
    const defaultPrice = await prisma.sheerFabricPricing.findUnique({
      where: {
        fabricGroup_fabricName_userId: {
          fabricGroup,
          fabricName,
          userId: null
        }
      }
    });
    
    if (!defaultPrice) {
      throw new Error(`No pricing found for fabric: ${fabricName} in ${fabricGroup}`);
    }
    
    return defaultPrice.pricePerMeter;
  }
  
  private async getInventoryPrice(itemCode: string): Promise<number> {
    const item = await prisma.inventoryItem.findFirst({
      where: { code: itemCode }
    });
    
    if (!item) {
      throw new Error(`Inventory item not found: ${itemCode}`);
    }
    
    return item.unitPrice;
  }
}

export const sheerCurtainPricingService = new SheerCurtainPricingService();
```

### 2. Pricing Controller Updates

**Update:** `backend/src/controllers/pricing.controller.ts`

```typescript
import { sheerCurtainPricingService } from '../services/sheerCurtainPricing.service';

/**
 * POST /api/pricing/calculate-curtain
 * Calculate real-time pricing for curtain item
 */
export async function calculateCurtainPrice(req: Request, res: Response) {
  try {
    const itemData = req.body;
    
    const calculation = await sheerCurtainPricingService.calculateCurtainMetrics(itemData);
    
    res.json({
      success: true,
      calculation
    });
  } catch (error: any) {
    console.error('Curtain pricing error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/pricing/sheer-fabric/:group
 * Get all fabric pricing for a group (admin)
 */
export async function getSheerFabricPricing(req: Request, res: Response) {
  try {
    const { group } = req.params;
    const { userId } = req.query;
    
    const pricing = await prisma.sheerFabricPricing.findMany({
      where: {
        fabricGroup: group,
        userId: userId ? parseInt(userId as string) : null
      }
    });
    
    res.json({ pricing });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * PUT /api/pricing/sheer-fabric/:group/:fabricName
 * Update fabric pricing (admin)
 */
export async function updateSheerFabricPricing(req: Request, res: Response) {
  try {
    const { group, fabricName } = req.params;
    const { pricePerMeter, userId } = req.body;
    
    const updated = await prisma.sheerFabricPricing.upsert({
      where: {
        fabricGroup_fabricName_userId: {
          fabricGroup: group,
          fabricName,
          userId: userId || null
        }
      },
      update: {
        pricePerMeter
      },
      create: {
        fabricGroup: group,
        fabricName,
        pricePerMeter,
        userId: userId || null
      }
    });
    
    res.json({ success: true, pricing: updated });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
```

### 3. Routes Update

**Update:** `backend/src/routes/pricingRoutes.ts`

```typescript
import express from 'express';
import * as pricingController from '../controllers/pricing.controller';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// ... existing routes

// Sheer Curtain pricing
router.post('/calculate-curtain', pricingController.calculateCurtainPrice);
router.get('/sheer-fabric/:group', authenticate, authorize(['ADMIN']), pricingController.getSheerFabricPricing);
router.put('/sheer-fabric/:group/:fabricName', authenticate, authorize(['ADMIN']), pricingController.updateSheerFabricPricing);

export default router;
```

---

## FRONTEND IMPLEMENTATION

### 1. Fabric Data File

**Create:** `frontend/src/data/sheerFabrics.ts`

```typescript
export interface SheerFabricGroup {
  name: string;
  fabrics: Array<{
    name: string;
    basePricePerMeter: number;
  }>;
}

export const sheerFabricGroups: SheerFabricGroup[] = [
  {
    name: 'Group 1',
    fabrics: [
      { name: 'Cannes', basePricePerMeter: 100 },
      { name: 'Aston', basePricePerMeter: 100 },
      { name: 'Natural Collection', basePricePerMeter: 100 },
      { name: 'Zanzibar', basePricePerMeter: 100 },
      { name: 'Verne', basePricePerMeter: 100 },
      { name: 'Montreux', basePricePerMeter: 100 },
      { name: 'Coco', basePricePerMeter: 100 },
    ]
  },
  {
    name: 'Group 2',
    fabrics: [
      { name: 'Altitude', basePricePerMeter: 100 },
      { name: 'Arena', basePricePerMeter: 100 },
      { name: 'Ditto', basePricePerMeter: 100 },
      { name: 'Georgia', basePricePerMeter: 100 },
      { name: 'Skye', basePricePerMeter: 100 },
      { name: 'Seattle', basePricePerMeter: 100 },
      { name: 'Bronte', basePricePerMeter: 100 },
    ]
  },
  {
    name: 'Budget',
    fabrics: [
      { name: 'Bali', basePricePerMeter: 95 },
      { name: 'Melton', basePricePerMeter: 95 },
    ]
  }
];

// Helper: Get flat list of all fabrics (for dropdown, without group labels)
export const getAllSheerFabrics = () => {
  return sheerFabricGroups.flatMap(group => 
    group.fabrics.map(fabric => ({
      ...fabric,
      group: group.name  // Internal tracking only, not shown to user
    }))
  );
};

// Helper: Get fabric group for pricing lookup
export const getFabricGroup = (fabricName: string): string | null => {
  for (const group of sheerFabricGroups) {
    if (group.fabrics.some(f => f.name === fabricName)) {
      return group.name;
    }
  }
  return null;
};
```

### 2. Curtain Item Form Component

**Create:** `frontend/src/components/orders/CurtainItemForm.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { getAllSheerFabrics, getFabricGroup } from '../../data/sheerFabrics';
import { apiClient } from '../../services/api';

interface CurtainItemFormProps {
  onSubmit: (item: CurtainItem) => void;
  onCancel: () => void;
  initialData?: Partial<CurtainItem>;
}

interface CurtainItem {
  location: string;
  width: number;
  drop: number;
  curtainType: 'S Fold';
  hem: 70;
  fabric: string;
  colour: string;
  installation: 'Wall' | 'Ceiling';
  bracketType: 'Standard' | 'Extended';
  trackColour: string;
  openingType: 'Single Open' | 'Centre Open' | 'Free Fold';
  wandSize: 1250;
  fullness: 120 | 140 | 144;
  
  // Calculated fields
  deductedDrop: number;
  hookCount: number;
  leftHooks?: number;
  rightHooks?: number;
  bracketCount: number;
  wandCount: number;
  fabricLength: number;
  fabricMeters: number;
  dropSurcharge: number;
  
  // Pricing
  fabricCost: number;
  hookCost: number;
  bracketCost: number;
  wandCost: number;
  subtotal: number;
  gst: number;
  total: number;
}

export const CurtainItemForm: React.FC<CurtainItemFormProps> = ({
  onSubmit,
  onCancel,
  initialData
}) => {
  const [formData, setFormData] = useState<Partial<CurtainItem>>(
    initialData || {
      curtainType: 'S Fold',
      hem: 70,
      wandSize: 1250,
      fullness: 120,
      installation: 'Wall',
      bracketType: 'Standard',
      openingType: 'Single Open',
    }
  );
  
  const [isCalculating, setIsCalculating] = useState(false);
  const fabricOptions = getAllSheerFabrics();
  
  // Real-time calculations on field changes
  useEffect(() => {
    if (formData.width && formData.drop && formData.openingType && formData.fullness && formData.fabric && formData.bracketType) {
      calculatePricing();
    }
  }, [formData.width, formData.drop, formData.openingType, formData.fullness, formData.fabric, formData.bracketType]);
  
  const calculatePricing = async () => {
    try {
      setIsCalculating(true);
      
      const fabricGroup = getFabricGroup(formData.fabric!);
      
      const response = await apiClient.post('/pricing/calculate-curtain', {
        width: formData.width,
        drop: formData.drop,
        openingType: formData.openingType,
        fullness: formData.fullness,
        bracketType: formData.bracketType,
        fabric: formData.fabric,
        fabricGroup,
      });
      
      setFormData(prev => ({
        ...prev,
        ...response.data.calculation
      }));
    } catch (error) {
      console.error('Pricing calculation error:', error);
    } finally {
      setIsCalculating(false);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as CurtainItem);
  };
  
  return (
    <form onSubmit={handleSubmit} className="curtain-item-form space-y-4">
      {/* Row 1: Location */}
      <div>
        <label className="block text-sm font-medium mb-1">Location</label>
        <input
          type="text"
          value={formData.location || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
          className="w-full border rounded px-3 py-2"
          placeholder="e.g., Living Room - Window 1"
          required
        />
      </div>
      
      {/* Row 2: Width & Drop */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Width (mm)</label>
          <input
            type="number"
            value={formData.width || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, width: parseInt(e.target.value) }))}
            className="w-full border rounded px-3 py-2"
            min="100"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Drop (mm)</label>
          <input
            type="number"
            value={formData.drop || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, drop: parseInt(e.target.value) }))}
            className="w-full border rounded px-3 py-2"
            min="100"
            required
          />
          {formData.drop && formData.drop > 3000 && (
            <p className="text-xs text-orange-600 mt-1">
              Drop exceeds 3000mm - surcharge will apply
            </p>
          )}
        </div>
      </div>
      
      {/* Row 3: Curtain Type & Hem */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Curtain Type</label>
          <select
            value={formData.curtainType}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            disabled
          >
            <option>S Fold</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hem (mm)</label>
          <select
            value={formData.hem}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            disabled
          >
            <option>70</option>
          </select>
        </div>
      </div>
      
      {/* Row 4: Fabric & Colour */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Fabric</label>
          <select
            value={formData.fabric || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, fabric: e.target.value }))}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="">Select fabric...</option>
            {fabricOptions.map(fabric => (
              <option key={fabric.name} value={fabric.name}>
                {fabric.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Colour</label>
          <input
            type="text"
            value={formData.colour || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, colour: e.target.value }))}
            className="w-full border rounded px-3 py-2"
            placeholder="Enter fabric colour"
            required
          />
        </div>
      </div>
      
      {/* Row 5: Installation & Bracket Type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Installation</label>
          <select
            value={formData.installation}
            onChange={(e) => setFormData(prev => ({ ...prev, installation: e.target.value as 'Wall' | 'Ceiling' }))}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="Wall">Wall</option>
            <option value="Ceiling">Ceiling</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bracket Type</label>
          <select
            value={formData.bracketType}
            onChange={(e) => setFormData(prev => ({ ...prev, bracketType: e.target.value as 'Standard' | 'Extended' }))}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="Standard">Standard</option>
            <option value="Extended">Extended</option>
          </select>
        </div>
      </div>
      
      {/* Row 6: Track Colour */}
      <div>
        <label className="block text-sm font-medium mb-1">Track Colour</label>
        <input
          type="text"
          value={formData.trackColour || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, trackColour: e.target.value }))}
          className="w-full border rounded px-3 py-2"
          placeholder="Enter track colour"
          required
        />
      </div>
      
      {/* Row 7: Opening Type, Wand Size, Fullness */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Opening Type</label>
          <select
            value={formData.openingType}
            onChange={(e) => setFormData(prev => ({ ...prev, openingType: e.target.value as any }))}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value="Single Open">Single Open</option>
            <option value="Centre Open">Centre Open</option>
            <option value="Free Fold">Free Fold</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Wand Size (mm)</label>
          <select
            value={formData.wandSize}
            className="w-full border rounded px-3 py-2 bg-gray-50"
            disabled
          >
            <option>1250</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Fullness</label>
          <select
            value={formData.fullness}
            onChange={(e) => setFormData(prev => ({ ...prev, fullness: parseInt(e.target.value) as any }))}
            className="w-full border rounded px-3 py-2"
            required
          >
            <option value={120}>120</option>
            <option value={140}>140</option>
            <option value={144}>144</option>
          </select>
        </div>
      </div>
      
      {/* Calculated Fields Display */}
      {formData.hookCount && (
        <div className="bg-blue-50 border border-blue-200 rounded p-4">
          <h4 className="font-semibold mb-2">Calculated Values</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Hook Count: <strong>{formData.hookCount}</strong></div>
            {(formData.openingType === 'Centre Open' || formData.openingType === 'Free Fold') && (
              <div>Hooks per Side: <strong>{formData.leftHooks} L / {formData.rightHooks} R</strong></div>
            )}
            <div>Bracket Count: <strong>{formData.bracketCount}</strong></div>
            <div>Wand Count: <strong>{formData.wandCount}</strong></div>
            <div>Fabric Length: <strong>{formData.fabricMeters?.toFixed(2)}m</strong></div>
            {formData.dropSurcharge > 0 && (
              <div className="col-span-2 text-orange-600">
                Drop Surcharge: <strong>${formData.dropSurcharge.toFixed(2)}</strong>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Pricing Breakdown */}
      {formData.total && (
        <div className="bg-green-50 border border-green-200 rounded p-4">
          <h4 className="font-semibold mb-2">Pricing Breakdown</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Fabric:</span>
              <span>${formData.fabricCost?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Hooks ({formData.hookCount}):</span>
              <span>${formData.hookCost?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Brackets ({formData.bracketCount}):</span>
              <span>${formData.bracketCost?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Wand ({formData.wandCount}):</span>
              <span>${formData.wandCost?.toFixed(2)}</span>
            </div>
            {formData.dropSurcharge > 0 && (
              <div className="flex justify-between text-orange-600">
                <span>Drop Surcharge:</span>
                <span>${formData.dropSurcharge?.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-1 flex justify-between">
              <span>Subtotal:</span>
              <span className="font-semibold">${formData.subtotal?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST (10%):</span>
              <span>${formData.gst?.toFixed(2)}</span>
            </div>
            <div className="border-t pt-1 flex justify-between text-lg">
              <span className="font-bold">Total:</span>
              <span className="font-bold text-green-700">${formData.total?.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Form Actions */}
      <div className="flex gap-3 justify-end pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!formData.total || isCalculating}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCalculating ? 'Calculating...' : 'Add Curtain'}
        </button>
      </div>
    </form>
  );
};
```

### 3. Product Selection Update

**Update:** `frontend/src/pages/orders/NewOrder.tsx`

```typescript
const productCategories = [
  { 
    id: 'blinds', 
    name: 'Block Out Blinds', 
    icon: '🪟',
    path: '/orders/new/blinds'
  },
  { 
    id: 'curtains', 
    name: 'Sheer Curtains', 
    icon: '🪟',
    path: '/orders/new/curtains'  // ← NEW
  },
  { 
    id: 'shutters', 
    name: 'Plantation Shutters', 
    icon: '🪟',
    path: '/orders/new/shutters'
  },
  { 
    id: 'outdoor', 
    name: 'Outdoor Blinds', 
    icon: '🌤️',
    path: '/orders/new/outdoor'
  },
  { 
    id: 'parts', 
    name: 'Roller Parts', 
    icon: '⚙️',
    path: '/orders/new/parts'
  },
];
```

---

## ADMIN PRICING MANAGEMENT

### Update Pricing Management Page

**File:** `frontend/src/pages/admin/PricingManagement.tsx`

**Add 2 new tabs:**

```typescript
const tabs = [
  { id: 'blind-fabric', name: 'Blind Fabric Matrix' },  // Existing
  { id: 'blind-parts', name: 'Blind Parts' },           // Existing
  { id: 'sheer-fabric', name: 'Sheer Fabric' },         // ← NEW
  { id: 'sheer-parts', name: 'Sheer Parts' },           // ← NEW
];
```

**Sheer Fabric Tab Component:**

```typescript
const SheerFabricPricingTab = () => {
  const [selectedGroup, setSelectedGroup] = useState('Group 1');
  const [fabrics, setFabrics] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null); // For customer overrides
  
  useEffect(() => {
    loadFabricPricing();
  }, [selectedGroup, selectedCustomer]);
  
  const loadFabricPricing = async () => {
    const response = await apiClient.get(`/pricing/sheer-fabric/${selectedGroup}`, {
      params: { userId: selectedCustomer }
    });
    setFabrics(response.data.pricing);
  };
  
  const updatePrice = async (fabricName: string, newPrice: number) => {
    await apiClient.put(`/pricing/sheer-fabric/${selectedGroup}/${fabricName}`, {
      pricePerMeter: newPrice,
      userId: selectedCustomer
    });
    loadFabricPricing();
  };
  
  return (
    <div>
      <div className="flex gap-4 mb-4">
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="Group 1">Group 1</option>
          <option value="Group 2">Group 2</option>
          <option value="Budget">Budget Group</option>
        </select>
        
        {/* Customer selector for overrides */}
        <select
          value={selectedCustomer || ''}
          onChange={(e) => setSelectedCustomer(e.target.value || null)}
          className="border rounded px-3 py-2"
        >
          <option value="">Default Pricing</option>
          {/* Load customers from API */}
        </select>
      </div>
      
      <table className="w-full border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Fabric Name</th>
            <th className="border p-2">Price per Meter ($ + GST)</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {fabrics.map(fabric => (
            <tr key={fabric.fabricName}>
              <td className="border p-2">{fabric.fabricName}</td>
              <td className="border p-2">
                <input
                  type="number"
                  value={fabric.pricePerMeter}
                  onChange={(e) => updatePrice(fabric.fabricName, parseFloat(e.target.value))}
                  className="border rounded px-2 py-1 w-24"
                  step="0.01"
                />
              </td>
              <td className="border p-2">
                <button
                  onClick={() => updatePrice(fabric.fabricName, fabric.pricePerMeter)}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
                >
                  Save
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

**Sheer Parts Tab Component:**

```typescript
const SheerPartsPricingTab = () => {
  const [parts, setParts] = useState([]);
  
  useEffect(() => {
    loadParts();
  }, []);
  
  const loadParts = async () => {
    const response = await apiClient.get('/inventory', {
      params: { category: 'SHEER_HOOK,SHEER_BRACKET,SHEER_WAND' }
    });
    setParts(response.data.items);
  };
  
  const updatePartPrice = async (itemId: number, newPrice: number) => {
    await apiClient.put(`/inventory/${itemId}`, {
      unitPrice: newPrice
    });
    loadParts();
  };
  
  return (
    <table className="w-full border">
      <thead>
        <tr className="bg-gray-100">
          <th className="border p-2">Part Name</th>
          <th className="border p-2">Category</th>
          <th className="border p-2">Unit Price ($)</th>
          <th className="border p-2">Stock</th>
          <th className="border p-2">Actions</th>
        </tr>
      </thead>
      <tbody>
        {parts.map(part => (
          <tr key={part.id}>
            <td className="border p-2">{part.name}</td>
            <td className="border p-2">{part.category}</td>
            <td className="border p-2">
              <input
                type="number"
                value={part.unitPrice}
                onChange={(e) => updatePartPrice(part.id, parseFloat(e.target.value))}
                className="border rounded px-2 py-1 w-24"
                step="0.01"
              />
            </td>
            <td className="border p-2">{part.quantity} {part.unit}</td>
            <td className="border p-2">
              <button
                onClick={() => updatePartPrice(part.id, part.unitPrice)}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm"
              >
                Save
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

---

## INVENTORY SEEDING

### 1. Sheer Inventory Items

**Create:** `backend/scripts/seed-sheer-inventory.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sheerInventoryItems = [
  // Hooks
  {
    name: 'S-Fold Hook',
    code: 'SHEER_HOOK',
    category: 'SHEER_HOOK',
    unitPrice: 0.50,
    quantity: 10000,
    unit: 'UNITS',
    lowStockThreshold: 500,
    description: 'S-Fold curtain hook'
  },
  
  // Brackets
  {
    name: 'Standard Bracket',
    code: 'SHEER_BRACKET_STANDARD',
    category: 'SHEER_BRACKET',
    unitPrice: 8.00,
    quantity: 500,
    unit: 'UNITS',
    lowStockThreshold: 50,
    description: 'Standard mounting bracket'
  },
  {
    name: 'Extended Bracket',
    code: 'SHEER_BRACKET_EXTENDED',
    category: 'SHEER_BRACKET',
    unitPrice: 12.00,
    quantity: 300,
    unit: 'UNITS',
    lowStockThreshold: 30,
    description: 'Extended mounting bracket'
  },
  
  // Wand
  {
    name: 'Wand 1250mm',
    code: 'SHEER_WAND_1250',
    category: 'SHEER_WAND',
    unitPrice: 10.00,
    quantity: 200,
    unit: 'UNITS',
    lowStockThreshold: 20,
    description: 'Control wand 1250mm length'
  },
];

async function seedSheerInventory() {
  console.log('🌱 Seeding sheer curtain inventory...');
  
  for (const item of sheerInventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { code: item.code },
      update: item,
      create: item,
    });
    console.log(`✓ ${item.name}`);
  }
  
  console.log('✅ Sheer inventory seeded successfully');
}

seedSheerInventory()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 2. Sheer Fabric Pricing

**Create:** `backend/scripts/seed-sheer-pricing.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sheerFabricPricing = [
  // Group 1 - $100/meter
  { fabricGroup: 'Group 1', fabricName: 'Cannes', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 1', fabricName: 'Aston', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 1', fabricName: 'Natural Collection', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 1', fabricName: 'Zanzibar', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 1', fabricName: 'Verne', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 1', fabricName: 'Montreux', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 1', fabricName: 'Coco', pricePerMeter: 100, userId: null },
  
  // Group 2 - $100/meter
  { fabricGroup: 'Group 2', fabricName: 'Altitude', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 2', fabricName: 'Arena', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 2', fabricName: 'Ditto', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 2', fabricName: 'Georgia', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 2', fabricName: 'Skye', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 2', fabricName: 'Seattle', pricePerMeter: 100, userId: null },
  { fabricGroup: 'Group 2', fabricName: 'Bronte', pricePerMeter: 100, userId: null },
  
  // Budget - $95/meter
  { fabricGroup: 'Budget', fabricName: 'Bali', pricePerMeter: 95, userId: null },
  { fabricGroup: 'Budget', fabricName: 'Melton', pricePerMeter: 95, userId: null },
];

async function seedSheerPricing() {
  console.log('🌱 Seeding sheer fabric pricing...');
  
  for (const pricing of sheerFabricPricing) {
    await prisma.sheerFabricPricing.upsert({
      where: {
        fabricGroup_fabricName_userId: {
          fabricGroup: pricing.fabricGroup,
          fabricName: pricing.fabricName,
          userId: null,
        },
      },
      update: pricing,
      create: pricing,
    });
    console.log(`✓ ${pricing.fabricGroup} - ${pricing.fabricName}`);
  }
  
  console.log('✅ Sheer pricing seeded successfully');
}

seedSheerPricing()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### 3. Update package.json

**Add to scripts:**

```json
{
  "scripts": {
    "seed:sheer-inventory": "tsx scripts/seed-sheer-inventory.ts",
    "seed:sheer-pricing": "tsx scripts/seed-sheer-pricing.ts"
  }
}
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Database & Backend ✅
- [ ] Update Prisma schema (ProductType, OrderItem fields, SheerFabricPricing model, InventoryCategory)
- [ ] Run migration: `npx prisma migrate dev --name add_sheer_curtain_support`
- [ ] Create `sheerCurtainPricing.service.ts`
- [ ] Update `pricing.controller.ts` with curtain endpoints
- [ ] Add curtain routes to `pricingRoutes.ts`
- [ ] Create `seed-sheer-inventory.ts`
- [ ] Create `seed-sheer-pricing.ts`
- [ ] Run: `npm run seed:sheer-inventory`
- [ ] Run: `npm run seed:sheer-pricing`

### Phase 2: Frontend - Order Form ✅
- [ ] Create `sheerFabrics.ts` data file
- [ ] Create `CurtainItemForm.tsx` component
- [ ] Update `NewOrder.tsx` product categories
- [ ] Add curtain route in App router
- [ ] Test form with all 5 fields
- [ ] Test real-time calculations
- [ ] Test real-time pricing updates
- [ ] Test order submission

### Phase 3: Admin Pricing Management ✅
- [ ] Add "Sheer Fabric" tab to PricingManagement
- [ ] Add "Sheer Parts" tab to PricingManagement
- [ ] Create SheerFabricPricingTab component
- [ ] Create SheerPartsPricingTab component
- [ ] Implement edit/save functionality
- [ ] Add customer override support
- [ ] Test pricing updates

### Phase 4: Testing ✅
- [ ] Unit tests for hook calculation
- [ ] Unit tests for fabric length calculation
- [ ] Unit tests for bracket count
- [ ] Unit tests for pricing calculation
- [ ] Integration tests for API endpoints
- [ ] E2E test for complete order flow
- [ ] Manual testing with various widths/drops

### Phase 5: Production Deployment ✅
- [ ] Code review
- [ ] Merge to main branch
- [ ] Deploy to production
- [ ] Verify migrations applied
- [ ] Verify seeds ran successfully
- [ ] Smoke test in production

---

## KEY CONSTANTS REFERENCE

| Constant | Value | Usage |
|----------|-------|-------|
| Hook Spacing | 54mm | Width / 54 = raw hook count |
| Drop Deduction | 30mm | Always subtract from drop |
| Single Open Offset | 140mm | Added to fabric length |
| Centre/Free Fold Offset | 280mm | Added to fabric length |
| Fullness Options | 120, 140, 144 | Multiplier in fabric calc |
| Wand Size | 1250mm | Fixed value |
| Max Drop (no surcharge) | 3000mm | Above = $60/m charge |
| GST Rate | 10% | Applied to subtotal |

---

## SUCCESS CRITERIA

1. ✅ Customer can create sheer curtain orders with 15-field form
2. ✅ Real-time calculation of hooks, brackets, fabric length, wands
3. ✅ Real-time pricing breakdown (fabric + components + GST)
4. ✅ Drop surcharge correctly applied for drops > 3000mm
5. ✅ Admin can manage sheer fabric pricing (3 groups, per-customer overrides)
6. ✅ Admin can manage sheer parts pricing
7. ✅ All calculations match Excel template formulas
8. ✅ Full integration with existing order management system
9. ✅ Fabric groups hidden from user (used for backend pricing only)
10. ✅ Free text entry for colours and track colours

---

**IMPLEMENT THIS COMPREHENSIVE SHEER CURTAIN MODULE FOLLOWING THE SAME PATTERNS AND QUALITY AS THE EXISTING BLIND SYSTEM. ALL CLARIFICATIONS CONFIRMED AND INCORPORATED.**