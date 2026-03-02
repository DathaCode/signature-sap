# Fabric Cut Optimization - Implementation Summary

## Step 1: Backend Implementation ✅ COMPLETED

### What Was Implemented

#### 1. Dependencies Installed ✅
- `maxrects-packer` (v2.7.3) - MaxRects 2D bin packing algorithm
- `pdfkit` - PDF generation for cutting layouts
- `canvas` - Canvas support for PDF graphics

**Note:** Originally specified `@2d-packer/bin-packer` doesn't exist on npm. Used `maxrects-packer` instead, which is a well-maintained TypeScript implementation of the MaxRects algorithm.

**Sources:**
- [maxrects-packer on npm](https://www.npmjs.com/package/maxrects-packer)
- [GitHub - soimy/maxrects-packer](https://github.com/soimy/maxrects-packer)

#### 2. New Service: `fabricCutOptimizer.service.ts` ✅

**Location:** `backend/src/services/fabricCutOptimizer.service.ts`

**Key Features:**
- **Grouping by Fabric:** Automatically groups blinds by `Material - FabricType - Colour`
- **Motor-Specific Width Deductions:**
  - Winders (TBS/Acmeda): 28mm
  - Automate motors: 29mm
  - Alpha Battery: 30mm
  - Alpha AC: 35mm
- **MaxRects Algorithm:**
  - First Fit Decreasing (FFD) sorting
  - Rotation enabled (90°)
  - Kerf thickness: 2mm
  - Stock size: 3000mm × 10000mm (max roll length)
- **Efficiency Tracking:**
  - Per-sheet efficiency calculation
  - Overall efficiency across all fabric groups
  - Waste percentage reporting
- **Inventory Checking:**
  - Validates sufficient fabric available
  - Returns shortage details if insufficient

**Expected Performance:** 75-85% efficiency (vs current 40-50%)

#### 3. Database Schema Updates ✅

**Location:** `backend/prisma/schema.prisma`

**Added Fields to Order Model:**
```prisma
model Order {
  // ... existing fields ...

  // Fabric Cut Optimization (MaxRects algorithm results)
  fabricCutOptimization Json?           @map("fabric_cut_optimization")
  worksheetGeneratedAt  DateTime?       @map("worksheet_generated_at") @db.Timestamp(6)

  // ... rest of fields ...
}
```

#### 4. Controller Endpoints ✅

**Location:** `backend/src/controllers/adminWorksheet.controller.ts`

**New Methods Added:**
1. `generateWorksheet` - POST `/api/admin/worksheets/:orderId/generate`
   - Runs MaxRects optimization
   - Stores results in database
   - Returns optimization data + inventory check
   - Logs optimization time

2. `recalculateOptimization` - POST `/api/admin/worksheets/:orderId/recalculate`
   - Re-runs optimization from scratch
   - Updates stored results
   - Returns fresh optimization data

3. `getOptimizationResults` - GET `/api/admin/worksheets/:orderId/optimization`
   - Retrieves stored optimization results
   - Returns generation timestamp

#### 5. Routes Configuration ✅

**New File:** `backend/src/routes/adminWorksheetRoutes.ts`

**Mounted at:** `/api/admin/worksheets` in `server.ts`

**Available Endpoints:**
- `GET /api/admin/worksheets/:orderId` - Get worksheet data
- `GET /api/admin/worksheets/:orderId/download?type=fabric_cut&format=csv` - Download worksheet
- `POST /api/admin/worksheets/:orderId/generate` - **NEW** Generate optimized worksheet
- `POST /api/admin/worksheets/:orderId/recalculate` - **NEW** Recalculate optimization
- `GET /api/admin/worksheets/:orderId/optimization` - **NEW** Get stored results

---

## Next Steps

### 1. Run Database Migration

**IMPORTANT:** Run this command when Docker is started:

```bash
# Start Docker containers
docker-compose up -d

# Run migration
docker exec signatureshades-api-local npx prisma migrate dev --name add_fabric_optimization

# Generate Prisma client
docker exec signatureshades-api-local npx prisma generate

# Restart backend to apply changes
docker-compose restart backend
```

### 2. Test the Optimization

#### Sample Test Data (7 Blinds from Spec)

Create a test order with these dimensions (Width × Height):

```
650  × 2250
2250 × 2100
2250 × 2100
2999 × 2100
650  × 2860
1200 × 2500
950  × 2250
```

**Testing Steps:**

1. **Create Order** - Use web form to create order with sample blinds
2. **Generate Worksheet** - Call `POST /api/admin/worksheets/:orderId/generate`
3. **Check Results:**
   - Optimization time: Should be 5-10 seconds for 50 blinds
   - Efficiency: Should be 75-85% (vs current 40-50%)
   - Sheets used: 1-2 sheets for 7 blinds
   - Inventory check: Verify sufficient fabric warning works

#### API Testing with Postman/cURL

```bash
# Generate worksheet
curl -X POST http://localhost:5000/api/admin/worksheets/{orderId}/generate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Get optimization results
curl -X GET http://localhost:5000/api/admin/worksheets/{orderId}/optimization \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Recalculate
curl -X POST http://localhost:5000/api/admin/worksheets/{orderId}/recalculate \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 3. Frontend Implementation (Step 2)

**Next Phase:** Create frontend preview UI with:
- SVG rendering of cutting layouts
- Colored panels with rotation indicators
- Cutting marks toggle (red lines + dimensions)
- Recalculate button with efficiency messages
- Insufficient inventory warnings
- Download PDF with visual layouts

**Files to Create:**
- `frontend/src/components/admin/FabricCutPreview.tsx`
- `frontend/src/components/admin/OptimizationStats.tsx`
- Update `frontend/src/components/admin/WorksheetPreview.tsx`

---

## Technical Details

### MaxRects Packer Configuration

```typescript
const packer = new MaxRectsPacker(
  3000,      // maxWidth
  10000,     // maxHeight
  2,         // padding (kerf thickness)
  {
    smart: true,           // Enable intelligent packing
    pot: false,            // Don't round to power-of-2
    square: false,         // Don't force square bins
    allowRotation: true,   // Enable 90° rotation
    tag: false,            // Don't tag bins
    border: 0,             // No border padding
  }
);
```

### Optimization Result Structure

```typescript
interface OptimizationResult {
  fabricKey: string;              // "Textstyle - Focus - White"
  sheets: Sheet[];                // Array of cutting sheets
  totalFabricNeeded: number;      // mm
  rollsNeeded: number;            // Count of 10m rolls
  efficiency: number;             // Overall %
  wastePercentage: number;        // 100 - efficiency
  statistics: {
    totalSheets: number;
    totalPanels: number;
    totalUsedArea: number;
    totalWasteArea: number;
    avgEfficiency: number;
  };
}
```

### Sheet Structure

```typescript
interface Sheet {
  id: number;
  width: number;                  // 3000mm
  length: number;                 // Actual used length
  actualUsedLength: number;       // Highest Y + panel height
  panels: PlacedPanel[];          // Placed panels with positions
  efficiency: number;             // %
  wasteArea: number;              // mm²
  usedArea: number;               // mm²
}
```

### Placed Panel Structure

```typescript
interface PlacedPanel {
  id: string;
  x: number;                      // Position X
  y: number;                      // Position Y
  width: number;                  // Panel width (after rotation)
  length: number;                 // Panel length (after rotation)
  rotated: boolean;               // 90° rotated flag
  label: string;                  // "Location (WxL)"
  blindNumber: number;            // Item number
  location: string;               // Room/location name
  orderItemId: number;            // DB reference
}
```

---

## Acceptance Criteria Status

✅ Optimization achieves 75-85% efficiency (algorithm implemented, needs testing)
✅ Database stores optimization results (fabricCutOptimization JSON field)
✅ Backend API endpoints created (generate, recalculate, get results)
✅ Motor-specific width deductions applied correctly
✅ Inventory sufficiency checking implemented
⏳ Preview shows colored panels (Step 2 - Frontend)
⏳ Cutting marks toggle works (Step 2 - Frontend)
⏳ PDF includes colored layout (Step 3 - PDF Generation)
⏳ Works for 50 blinds in 5-10 seconds (needs testing)

---

## Files Modified/Created

### Created
- `backend/src/services/fabricCutOptimizer.service.ts` - MaxRects optimizer
- `backend/src/routes/adminWorksheetRoutes.ts` - Admin worksheet routes

### Modified
- `backend/package.json` - Added dependencies
- `backend/prisma/schema.prisma` - Added Order fields
- `backend/src/controllers/adminWorksheet.controller.ts` - Added 3 new methods
- `backend/src/server.ts` - Mounted new routes

### Migration Required
- Run `npx prisma migrate dev --name add_fabric_optimization`

---

## Known Issues & Notes

1. **Package Substitution:** Used `maxrects-packer` instead of non-existent `@2d-packer/bin-packer`
2. **Migration Pending:** Schema changes require migration when Docker is running
3. **Testing Required:** Need to verify 75-85% efficiency target with real data
4. **Frontend Not Yet Implemented:** Visual preview and PDF generation are Step 2 & 3
5. **Inventory Key Format:** Uses `"Material - FabricType"` for itemName, `"Colour"` for colorVariant

---

## Performance Expectations

### Current System (Guillotine Algorithm)
- Efficiency: 40-50%
- Waste: 50-60%
- Sheets used: More than optimal

### New System (MaxRects Algorithm)
- **Expected Efficiency: 75-85%** ✨
- Waste: 15-25%
- Sheets used: Near-optimal (similar to CutLogic 2D)
- Processing time: 5-10 seconds for 50 blinds

---

## References

- **MaxRects Algorithm:** [MaxRects-Packer GitHub](https://github.com/soimy/maxrects-packer)
- **CutLogic 2D Manual:** `cutlogic-2d-manual (1).pdf`
- **Current Optimizer:** `backend/src/services/cutlistOptimizer.service.ts`
- **Sample Dimensions:** User specification (7 blinds test case)
