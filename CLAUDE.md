# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Signature Shades Order Management System** - A full-stack warehouse management and order processing system for a custom blinds manufacturing company. The system handles web-based order creation, Excel upload workflows, cutlist optimization, inventory management, and worksheet generation for production.

**Tech Stack:**
- **Frontend:** React 18 + TypeScript + Vite + TailwindCSS + TanStack Query
- **Backend:** Node.js + Express + TypeScript + Prisma ORM
- **Database:** PostgreSQL 15
- **Deployment:** Docker Compose with hot-reload for development

---

## Development Commands

### Docker Environment (Recommended)

```bash
# Start all services (PostgreSQL, Backend, Frontend)
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Stop services
docker-compose down

# Rebuild after dependency changes
docker-compose up -d --build

# Access database
docker exec -it signatureshades-db-local psql -U signatureshades_dev -d signatureshades_dev
```

### Backend (Port 5000)

```bash
cd backend

# Development (with hot-reload)
npm run dev

# Build TypeScript
npm run build

# Production
npm start

# Database commands
npm run prisma:generate      # Generate Prisma client
npm run prisma:migrate       # Create new migration
npm run prisma:push          # Push schema without migration
npm run prisma:studio        # Open Prisma Studio GUI

# Seed data
npm run seed                 # Seed all data
npm run seed:pricing         # Seed pricing matrix only
npm run create:admin         # Create admin user interactively

# Linting & Testing
npm run lint
npm test
```

### Frontend (Port 3000)

```bash
cd frontend

# Development (with hot-reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Linting
npm run lint
```

---

## Architecture Overview

### Backend Architecture

**Layered Architecture Pattern:**
```
src/
├── server.ts                # Express app entry point
├── config/
│   └── logger.ts            # Winston logger configuration
├── middleware/
│   ├── auth.ts              # JWT authentication + role-based authorization
│   └── errorHandler.ts      # Global error handling
├── routes/                  # Express route definitions
├── controllers/             # Request handling & validation
├── services/                # Business logic layer
└── utils/                   # Helper functions
```

**Key Services:**

1. **Pricing Service** (`services/pricing.service.ts`)
   - Implements fabric group mapping (G1-G5) based on material + fabric type
   - Queries `PricingMatrix` table with dimension rounding logic
   - Applies group-based discounts (20%, 25%, 30%)
   - **Rounding behavior:** Rounds UP to next tier (matches spec)

2. **Cutlist Optimizer** (`services/cutlistOptimizer.service.ts`)
   - **Algorithm:** Guillotine 2D Bin Packing (First Fit Decreasing)
   - **Input:** Calculated dimensions (Width-28mm, Drop+150mm)
   - **Roll specs:** 3000mm width, dynamic length from inventory
   - **Output:** Sheet layouts with panel positions, rotation flags, efficiency stats

3. **Tube Cut Optimizer** (`services/tubeCutOptimizer.service.ts`)
   - **Algorithm:** Simple linear calculation with 10% wastage
   - **Stock length:** 5800mm per piece
   - **Uses original width** (not calculated width)

4. **Inventory Service** (`services/inventory.service.ts`)
   - Category-based inventory: FABRIC (MM), BOTTOM_BAR (UNITS), MOTOR, CHAIN
   - `checkAvailability()` - Validates stock before production
   - `deductForOrder()` - Atomic inventory deductions with transaction logging

5. **Worksheet Export** (`services/worksheetExport.service.ts`)
   - CSV generation (papaparse)
   - PDF generation (pdfkit) with visualization
   - **Fabric worksheet:** 14 columns including sheet positions
   - **Tube worksheet:** 5 columns with group calculations

### Frontend Architecture

**React Context + TanStack Query Pattern:**
```
src/
├── App.tsx                  # Route configuration
├── main.tsx                 # React root + providers
├── context/
│   └── AuthContext.tsx      # JWT auth state + user role
├── pages/                   # Route components
│   ├── auth/                # Login, Register
│   ├── customer/            # Dashboard, MyOrders
│   ├── orders/              # NewOrder, OrderDetails
│   └── admin/               # OrderManagement, UserManagement, PricingManagement
├── components/
│   ├── ui/                  # Reusable UI components (Button, Input, Card, etc.)
│   ├── auth/                # LoginForm, RegisterForm
│   ├── layout/              # ProtectedRoute
│   ├── orders/              # BlindItemForm
│   └── admin/               # FabricCutWorksheet, TubeCutWorksheet, WorksheetPreview
├── lib/
│   └── api.ts               # Axios instance with JWT interceptor
└── utils/
    └── pricing.ts           # Frontend pricing calculation (mirrors backend)
```

**State Management:**
- **Global auth state:** AuthContext (JWT token + user)
- **Server state:** TanStack Query (caching, optimistic updates)
- **Form state:** React Hook Form + local useState

---

## Database Schema

### Core Models

**Order Flow:**
```
Order (1) ──> (N) OrderItem
  │
  └──> WorksheetData (1:1, optional)
  └──> InventoryTransaction (1:N, optional)
```

**Inventory Tracking:**
```
InventoryItem (1) ──> (N) InventoryTransaction
```

### Critical Field Conventions

**Width Calculations (3 different values!):**
- `OrderItem.width` - Original customer dimension
- `OrderItem.calculatedWidth` - Width - 28mm (for tube cutting, stored in DB)
- `OrderItem.fabricCutWidth` - Width - 35mm (for fabric cutting, computed on-demand)

**Fabric Inventory Keys:**
- `category = "FABRIC"`
- `itemName = "Material - FabricType"` (e.g., "Textstyle - Focus")
- `colorVariant = "Colour"` (e.g., "White")

**Bottom Bar Inventory Keys:**
- `category = "BOTTOM_BAR"`
- `itemName = "RailType"` (e.g., "D30")
- `colorVariant = "Colour"` (e.g., "Anodised")

**Order Status Workflow:**
```
PENDING → CONFIRMED → PRODUCTION → COMPLETED
   └─────────> CANCELLED (any stage)
```

---

## API Conventions

### Authentication

**All protected routes require:**
```
Authorization: Bearer <JWT_TOKEN>
```

**JWT Payload:**
```typescript
{
  userId: string,
  email: string,
  role: "CUSTOMER" | "ADMIN"
}
```

**Role-based access:**
- Customer routes: `/api/web-orders/*`, `/api/orders/my-orders`
- Admin routes: `/api/users/*`, `/api/pricing/*`, `/api/inventory/*`, `/api/web-orders/:id/send-to-production`

### Key Endpoints

**Order Creation (Customer):**
```
POST /api/web-orders/create
Body: {
  items: OrderItem[],
  subtotal: number,
  total: number,
  notes?: string
}
```

**Send to Production (Admin):**
```
POST /api/web-orders/:id/send-to-production
Response: {
  worksheetData: {
    fabricCut: { sheets: [...], statistics: {...} },
    tubeCut: { groups: [...] }
  }
}
```

**Accept Worksheets (Admin):**
```
POST /api/web-orders/:id/worksheets/accept
Side effects: Deducts inventory, marks WorksheetData as accepted
```

**Worksheet Downloads:**
```
GET /api/web-orders/:id/worksheets/download/fabric-cut-csv
GET /api/web-orders/:id/worksheets/download/fabric-cut-pdf
GET /api/web-orders/:id/worksheets/download/tube-cut-csv
GET /api/web-orders/:id/worksheets/download/tube-cut-pdf
```

---

## Critical Business Logic

### Pricing Calculation

**Formula (backend/frontend must match):**
```typescript
1. Map (material, fabricType) → fabricGroup (1-5)
2. Round dimensions to nearest tier value
3. Lookup PRICING_DATA[group][width][drop]
4. Apply discount: G1=20%, G2=25%, G3=30%, G4/G5=0%
5. Return discounted price
```

**Known discrepancy:**
- Frontend `getPrice()` rounds to NEAREST tier, prefers higher on tie
- Backend `roundToTier()` always rounds UP
- Both claim to follow spec ("round up if between")

### Warehouse Calculations

**Applied BEFORE optimization:**
```typescript
// For fabric cutting optimization
calculatedWidth = width - 28  // Stored in OrderItem.calculatedWidth
calculatedDrop = drop + 150   // Stored in OrderItem.calculatedDrop

// For fabric cutting worksheet display
fabricCutWidth = width - 35   // Computed, not stored

// For tube cutting (uses original dimensions)
tubeCutWidth = width - 28     // Same as calculatedWidth
```

### Cutlist Optimization Process

**Input preparation:**
1. Filter items by (material, fabricType, fabricColour)
2. Apply Width-28, Drop+150
3. Group identical sizes
4. Sort by area descending

**Packing algorithm:**
1. Try to fit panel in existing sheets (normal + rotated orientations)
2. If fits → place at (x,y), split remaining space (Guillotine)
3. If doesn't fit → create new sheet from fabric roll
4. Validate total fabric needed ≤ inventory quantity

**Output:**
- Sheet layouts with panel positions
- Efficiency statistics
- Total fabric needed (mm) for inventory deduction

### Inventory Deduction Rules

**When "Accept Worksheets" clicked:**

1. **Fabric deduction:**
   - Per fabric group (material + type + colour)
   - Deduct `totalFabricNeededMm` from inventory
   - Unit: MM

2. **Bottom bar deduction:**
   - Per bottom bar group (type + colour)
   - Calculate: totalWidth ÷ 5800mm + 10% wastage
   - Round up to whole pieces
   - Unit: UNITS

3. **Transaction logging:**
   - Create `InventoryTransaction` for each deduction
   - Store order reference for traceability
   - Update `newBalance` field

---

## Common Pitfalls

### 1. Logger Import (Named Export)
```typescript
// ❌ WRONG
import logger from './config/logger';

// ✅ CORRECT
import { logger } from './config/logger';
```

### 2. Prisma Field Naming (British Spelling)
```typescript
// Database uses British spelling
fabricColour, bottomRailColour  // ✅ CORRECT
fabricColor, bottomRailColor    // ❌ WRONG
```

### 3. Width Deduction Context
```typescript
// Fabric cutting optimization - use calculatedWidth
const width = orderItem.calculatedWidth; // width - 28

// Fabric cutting worksheet display - use fabricCutWidth
const displayWidth = orderItem.width - 35;

// Tube cutting - use calculatedWidth
const tubeWidth = orderItem.calculatedWidth; // width - 28
```

### 4. Docker Volume Mounts
- Backend has anonymous volume for `/app/node_modules`
- Installing packages: **Must rebuild container** or install inside container
- Example: `docker exec signatureshades-api-local npm install pdfkit`

### 5. Inventory Key Construction
```typescript
// ❌ WRONG - Missing middle part
const key = `${material} - ${fabricColour}`;

// ✅ CORRECT
const key = `${material} - ${fabricType} - ${fabricColour}`;

// Helper function in webOrder.controller.ts
function parseFabricKey(key: string): { material, type, colour } {
  const parts = key.split(' - ');
  return {
    material: parts[0],
    type: parts[1],
    colour: parts[2] // Last part is colour
  };
}
```

---

## Testing Strategy

### Backend Testing
```bash
cd backend
npm test
```

**Critical test cases:**
1. Pricing calculation matches frontend
2. Cutlist optimization efficiency (50-70% for 6-10 blinds)
3. Tube cut wastage calculation (10%)
4. Inventory deduction accuracy
5. Width deduction by motor type (28/29/30/35mm)

### Frontend Testing
- Manual testing via browser (no Jest setup yet)
- Test all user flows: Login → Create Order → Submit → Admin Approve → Production → Worksheets

### Integration Testing
**End-to-end flow:**
1. Customer creates order with 5 different fabric blinds
2. Admin approves order (status: CONFIRMED)
3. Admin sends to production (status: PRODUCTION)
4. System runs optimization (5-10 seconds)
5. Admin previews worksheets (tabbed view)
6. Admin accepts worksheets
7. Inventory deducted correctly
8. Download all 4 files (2 CSV + 2 PDF)
9. Verify worksheet data matches order items

---

## Configuration Files

### Environment Variables

**Backend (.env):**
```bash
DATABASE_URL=postgresql://user:pass@host:5432/db
PORT=5000
CORS_ORIGIN=http://localhost:3000
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
NODE_ENV=development
```

**Frontend (.env):**
```bash
VITE_API_URL=http://localhost:5000/api
```

### Prisma Migrations
```bash
# Create migration after schema changes
cd backend
npx prisma migrate dev --name description_of_change

# Reset database (DEV ONLY!)
npx prisma migrate reset

# View current migrations
npx prisma migrate status
```

---

## Deployment Notes

**Docker Compose Structure:**
- `postgres` service: Port 5432, persistent volume
- `backend` service: Port 5000, hot-reload via volume mount
- `frontend` service: Port 3000, hot-reload via volume mount
- Network: `signatureshades-network` (bridge)

**Health checks:**
- PostgreSQL: `pg_isready -U signatureshades_dev`
- Backend depends on healthy postgres
- Frontend depends on backend

**Production considerations:**
- Change JWT_SECRET to strong random value
- Use production Dockerfile targets (not `development`)
- Enable Prisma connection pooling for high concurrency
- Consider read replicas for reporting queries

---

## Known Issues

**G3 Pricing Anomaly:**
- `PRICING_DATA[3][2000][3000] = 113.4` seems unusually low
- Surrounding values are 150-180 AUD
- Verify with business before correcting

**Motor Width Deduction (Phase 2):**
- Spec document (UPGRADE.md) describes motor-specific deductions:
  - Chains (TBS, Acmeda): 28mm
  - Automate motors: 29mm
  - Alpha Battery motors: 30mm
  - Alpha AC motor: 35mm
- **Current implementation:** All use 28mm (not yet implemented)

**Quote System:**
- Schema includes `Quote` model
- Frontend has quote vs order workflow in UPGRADE.md spec
- **Status:** Not yet implemented in controllers/routes

---

## Reference Documents

- **`user_process_flow_UPDATED.md`** - Complete Phase 2 specification (cutlist + tube optimization)
- **`UPGRADE.md`** - Comprehensive upgrade requirements (motor deductions, 80+ inventory items, enhanced UI)
- **Memory files** - `.claude/projects/.../memory/MEMORY.md` - Project-specific fixes and patterns

---

## Development Workflow

**When adding new features:**

1. **Database first:**
   - Update `backend/prisma/schema.prisma`
   - Run `npx prisma migrate dev --name feature_name`
   - Run `npx prisma generate`

2. **Backend API:**
   - Create/update service in `services/`
   - Create/update controller in `controllers/`
   - Add route in `routes/`
   - Update `server.ts` if new router

3. **Frontend:**
   - Add API call in `lib/api.ts`
   - Create/update component in `components/`
   - Create/update page in `pages/`
   - Add route in `App.tsx` if needed

4. **Testing:**
   - Test backend endpoint via Postman/curl
   - Test frontend via browser
   - Check Docker logs for errors

**When debugging:**

1. Check Docker logs: `docker-compose logs -f backend`
2. Check browser console for frontend errors
3. Check Prisma Studio for database state: `npm run prisma:studio`
4. Check network tab for API call failures (401, 403, 500)
5. Verify JWT token in localStorage (DevTools → Application)
