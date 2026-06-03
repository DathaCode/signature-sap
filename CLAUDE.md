# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Signature Shades Order Management System** - A full-stack warehouse management and order processing system for a custom blinds and sheer curtains manufacturing company. The system handles web-based order/quote creation, cutlist optimization, inventory management, worksheet generation for production, label printing, and a dynamic fabric catalog managed by admins.

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
npm run seed                 # Seed all inventory data
npm run seed:pricing         # Seed blind pricing matrix (650 entries)
npm run create:admin         # Create admin user interactively
npm run create:warehouse     # Create warehouse user

# One-off seed scripts (run inside container with ts-node)
# backend/scripts/seed-blind-fabrics.ts      — populates BlindFabric table
# backend/scripts/seed-sheer-pricing.ts      — populates sheer curtain pricing matrix
# backend/scripts/seed-sheer-inventory.ts    — seeds sheer curtain inventory items
# backend/scripts/seed-sheer-motor-pricing.ts — seeds sheer motor price entries
# backend/scripts/update-pricing-2026.ts     — re-seeds blind pricing matrix

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
   - CSV generation with motor-specific width deductions
   - PDF generation (pdfkit) with cutting layout visualization
   - **Fabric worksheet:** 13 columns including "Fabric Cut Width (mm)"
   - **Tube worksheet:** 5 columns with group calculations
   - **PDF includes:** Page 1 = Visual cutting layout diagram, Page 2+ = Detailed table

6. **Comprehensive Pricing Service** (`services/comprehensivePricing.service.ts`)
   - Calculates complete blind price with 7 component types:
     * Fabric price (from matrix with group discount)
     * Motor/Chain price (from inventory)
     * Bracket price (brand + type specific)
     * Chain price (length based on drop height)
     * Clips price (2 clips required)
     * Idler/Clutch price (conditional on bracket type)
     * Stop bolt/Safety lock (if winder/chain motor)
   - Motor-specific logic for chain selection and bracket compatibility
   - Returns detailed price breakdown for transparency

7. **Metrics** (`config/metrics.ts`)
   - Single shared `prom-client` Registry exported as `register`
   - `collectDefaultMetrics` — Node.js process heap, GC, event-loop lag, handles
   - **Counters:** `ordersCreatedTotal [productType]`, `ordersStatusChangedTotal [fromStatus, toStatus]`, `authAttemptsTotal [outcome]`, `worksheetAcceptedTotal`, `inventoryDeductionsTotal [category]`, `quotesCreatedTotal`, `quotesConvertedTotal`, `apiErrorsTotal [route, statusCode]`
   - **Histograms:** `httpRequestDurationSeconds [method, route, statusCode]`, `worksheetGenerationSeconds [orderType]`, `dbQueryDurationSeconds [operation]`
   - **Gauges:** `inventoryQuantityGauge [itemName, category, colorVariant]`, `activeOrdersGauge [status]`
   - `startMetricsRefresh()` — called once by `server.ts`; refreshes gauges from DB every 60 s
   - **Endpoint:** `GET /metrics` (unauthenticated, Prometheus text format; security boundary = Docker network)
   - **Route normalisation:** `normaliseRoute()` collapses UUIDs and numeric path segments to `:id`

8. **Sheer Curtain Pricing Service** (`services/sheerCurtainPricing.service.ts`)
   - Calculates full sheer curtain price (fabric cost + motor/wand/runner/hook components)
   - References DB-backed pricing for motor and accessories
   - Supports wand-operated and motorised curtain configurations

8. **Blind Fabric Service** (`services/blindFabric.service.ts`)
   - Admin-managed fabric catalog stored in the `BlindFabric` DB table
   - Replaces hardcoded fabric data; order form fetches fabrics dynamically
   - CRUD: add / update / delete individual fabrics and whole supplier groups
   - `getAllFabricsFormatted()` — returns nested `{ supplier → { fabricType → { group, colors } } }` shape used by the order form
   - `getAllFabricsAdmin()` — returns flat supplier list for the admin Blind Fabrics tab

### Frontend Architecture

**React Context + TanStack Query Pattern:**
```
src/
├── App.tsx                  # Route configuration
├── main.tsx                 # React root + providers
├── context/
│   └── AuthContext.tsx      # JWT auth state + user role
├── hooks/
│   ├── useFabrics.ts        # TanStack Query hook — fetches BlindFabric catalog from /api/blind-fabrics
│   └── useDebounce.ts       # Generic debounce hook
├── pages/                   # Route components
│   ├── auth/                # Login, Register, ForgotPassword, ResetPassword
│   ├── customer/            # Dashboard, MyOrders
│   ├── orders/              # NewOrder, OrderDetails
│   ├── quotes/              # MyQuotes, QuoteDetails
│   ├── admin/               # OrderManagement, AdminOrderDetails, UserManagement,
│   │                        # PricingManagement (incl. BlindFabricsTab), TrashOrders
│   └── warehouse/           # Warehouse-role views
├── components/
│   ├── ui/                  # Reusable UI components (Button, Input, Card, etc.)
│   ├── auth/                # LoginForm, RegisterForm
│   ├── layout/              # ProtectedRoute
│   ├── orders/              # BlindItemForm (dynamic fabrics), CurtainItemForm
│   ├── inventory/           # AddInventoryModal, AdjustQuantityModal, ItemHistoryModal
│   └── admin/               # FabricCutWorksheet, TubeCutWorksheet, WorksheetPreview,
│                            # CurtainWorksheet, BlindFabricsTab
├── services/
│   └── api.ts               # Axios instance + all endpoint groups (orderApi, pricingApi,
│                            # inventoryApi, blindFabricApi, etc.)
├── data/
│   ├── fabrics.ts           # Static fallback fabric data (deprecated — use BlindFabric DB)
│   ├── sheerFabrics.ts      # Sheer curtain fabric options
│   ├── hardware.ts          # Blind hardware options
│   └── sheerHardware.ts     # Sheer curtain hardware options
├── types/
│   └── order.ts             # TypeScript interfaces mirroring Prisma schema
└── utils/
    └── pricing.ts           # Frontend pricing calculation (mirrors backend)
```

**State Management:**
- **Global auth state:** AuthContext (JWT token + user)
- **Server state:** TanStack Query (caching, optimistic updates)
- **Form state:** React Hook Form + local useState
- **Fabric catalog:** `useFabrics` hook — fetches live from DB, cached by TanStack Query

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

**Fabric Catalog (admin-managed):**
```
BlindFabric — standalone, no FK to orders
  supplier (String)     e.g. "Textstyle"
  fabricType (String)   e.g. "Focus"
  fabricGroup (String)  e.g. "G1", "G2", "G3"
  colors (String[])     PostgreSQL text array

  Unique constraint: (supplier, fabricType)
```

### Critical Field Conventions

**Width Calculations (Motor-Specific Deductions):**
- `OrderItem.width` - Original customer dimension
- `OrderItem.calculatedWidth` - Width - 28mm (for tube cutting, stored in DB)
- `OrderItem.fabricCutWidth` - Width - Motor Deduction (computed based on motor type):
  * Winders (TBS, Acmeda): Width - 28mm
  * Automate motors: Width - 29mm
  * Alpha Battery motors: Width - 30mm
  * Alpha AC motors: Width - 35mm
  * Default (unknown): Width - 28mm

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
  role: "CUSTOMER" | "ADMIN" | "WAREHOUSE"
}
```

**Role-based access:**
- Customer routes: `/api/web-orders/*`, `/api/quotes/*`
- Admin routes: `/api/users/*`, `/api/pricing/*`, `/api/inventory/*`, `/api/web-orders/:id/send-to-production`, `/api/blind-fabrics` (write)
- Warehouse routes: `GET /api/web-orders/admin/all` (PRODUCTION-only filter), `GET /api/inventory`, `GET /api/web-orders/:id/labels/download`

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

**Blind Fabric Catalog:**
```
GET    /api/blind-fabrics              — All fabrics (formatted for order form), any auth
GET    /api/blind-fabrics/admin        — Admin flat view (by supplier), admin only
POST   /api/blind-fabrics              — Add fabric entry, admin only
PUT    /api/blind-fabrics/:id          — Update fabric entry, admin only
DELETE /api/blind-fabrics/:id          — Delete single fabric, admin only
DELETE /api/blind-fabrics/supplier/:s  — Delete all fabrics for a supplier, admin only
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

**Motor-Specific Width Deductions:**
```typescript
// Motor deduction mapping (worksheet.service.ts, worksheetExport.service.ts)
const MOTOR_DEDUCTIONS = {
  'TBS winder-32mm': 28,
  'Acmeda winder-29mm': 28,
  'Automate 1.1NM Li-Ion Quiet Motor': 29,
  'Automate 0.7NM Li-Ion Quiet Motor': 29,
  'Automate 2NM Li-Ion Quiet Motor': 29,
  'Automate 3NM Li-Ion Motor': 29,
  'Automate E6 6NM Motor': 29,
  'Alpha 1NM Battery Motor': 30,
  'Alpha 2NM Battery Motor': 30,
  'Alpha 3NM Battery Motor': 30,
  'Alpha AC 5NM Motor': 35,
};

// For fabric cutting worksheet display
fabricCutWidth = width - getMotorDeduction(motorType)  // Motor-specific

// For tube cutting (always 28mm regardless of motor)
tubeCutWidth = width - 28

// For fabric cutting optimization (legacy, still uses 28mm)
calculatedWidth = width - 28  // Stored in OrderItem.calculatedWidth
calculatedDrop = drop + 150   // Stored in OrderItem.calculatedDrop
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
// Fabric cutting worksheet display - use motor-specific deduction
const motorType = orderItem.chainOrMotor;
const fabricCutWidth = orderItem.width - getMotorDeduction(motorType);

// Tube cutting - always 28mm regardless of motor
const tubeCutWidth = orderItem.width - 28;

// Fabric cutting optimization (legacy) - use calculatedWidth
const width = orderItem.calculatedWidth; // width - 28
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

**Production Infrastructure (AWS ap-southeast-4 Melbourne):**
- EC2 `t3.micro` — runs backend, frontend, nginx containers
- RDS `db.t4g.micro` PostgreSQL 15 — managed database (private, EC2 access only)
  - Endpoint: `signatureshades-db-production.cr6yg6a2cnx1.ap-southeast-4.rds.amazonaws.com`
  - Region: `ap-southeast-4` (Melbourne) — Terraform region is also `ap-southeast-4`
- S3 `signatureshades-backups-production` (ap-southeast-2) — daily DB backups
- S3 `signatureshades-bend-drawings` — application file storage
- Route 53 — DNS for `orders.signatureshades.com.au`
- Terraform state: `terraform/` directory (local state)

**Production Docker Compose Structure:**
- `backend` service: Port 5000 (internal) — connects to RDS via `DATABASE_URL`
- `frontend` service: Port 80 (internal) — static Vite build served by nginx
- `nginx` service: Ports 80/443 — reverse proxy + TLS termination (Let's Encrypt)
- No database container — RDS handles PostgreSQL

**Production `.env` on EC2 (`/home/ubuntu/signature-sap/.env`):**
```bash
DATABASE_URL=postgresql://signatureshades_prod:PASSWORD@signatureshades-db-production.cr6yg6a2cnx1.ap-southeast-4.rds.amazonaws.com:5432/signatureshades_prod
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://orders.signatureshades.com.au
JWT_SECRET=<strong-random-64-char>
JWT_EXPIRES_IN=8h
AWS_REGION=ap-southeast-4
AWS_S3_BUCKET=signatureshades-bend-drawings
VITE_API_URL=https://orders.signatureshades.com.au/api
```

**SSH access:**
```bash
ssh -i ~/.ssh/signatureshades-ec2 ubuntu@16.26.30.228
cd /home/ubuntu/signature-sap
```

**Health checks:**
- API: `curl https://orders.signatureshades.com.au/api/health`
- Containers: `docker compose -f docker-compose.prod.yml ps`
- RDS: verified via DBeaver SSH tunnel (host: 16.26.30.228, key: signatureshades-ec2)

**Automated backups:**
- Cron: `0 17 * * *` (3am AEST) → `/home/ubuntu/scripts/db-backup.sh`
- Uploads to: `s3://signatureshades-backups-production/daily/YYYY/MM/`
- TLS auto-renew: certbot systemd timer with pre/post hooks to stop/start nginx

**Terraform — apply changes:**
```bash
cd terraform
terraform plan
terraform apply                                    # all resources
terraform apply -target="aws_db_instance.postgres" # RDS only
```

**Local development considerations:**
- Change JWT_SECRET to strong random value (`openssl rand -base64 64` — output is one string, remove newlines)
- Use production Dockerfile targets (not `development`)
- Enable Prisma connection pooling for high concurrency
- Consider read replicas for reporting queries

---

## Known Issues & Future Work

**G3 Pricing Anomaly:**
- `PRICING_DATA[3][2000][3000] = 113.4` seems unusually low
- Surrounding values are 150-180 AUD
- Matches `SAMPLE.html` — keep as-is unless business confirms otherwise

**Email Notifications:**
- Order confirmation and status-change emails are not yet implemented
- **Status:** Not started — needs SMTP/SES integration

**Sheer Curtain Worksheet Export:**
- Fabric cut CSV/PDF export for sheer curtain orders is not yet wired to the worksheet download endpoints
- **Status:** `CurtainWorksheet.tsx` renders in UI, download pipeline TBD

**API Documentation:**
- No Swagger/OpenAPI spec yet
- **Status:** Not started

---

## Reference Documents

- **`user_process_flow_UPDATED.md`** - Complete Phase 2 specification (cutlist + tube optimization)
- **`UPGRADE.md`** - Comprehensive upgrade requirements (motor deductions, 80+ inventory items, enhanced UI)
- **`PROGRESS.md`** - Current development status and completion tracking
- **Memory files** - `.claude/projects/.../memory/MEMORY.md` - Project-specific fixes and patterns

---

## Recent Updates

### ✅ Prometheus Metrics Instrumentation (2026-05-29)

**Files added/modified:**
- `backend/src/config/metrics.ts` — prom-client Registry, all metric instruments, gauge refresh loop
- `backend/src/middleware/httpMetrics.ts` — per-request duration middleware (records `httpRequestDurationSeconds`)
- `backend/src/server.ts` — `GET /metrics` endpoint, `httpMetrics` middleware, `startMetricsRefresh()` call
- `backend/src/middleware/errorHandler.ts` — increments `apiErrorsTotal` on every error response
- `backend/src/controllers/auth.controller.ts` — `authAttemptsTotal` on login success/failure
- `backend/src/controllers/webOrder.controller.ts` — `ordersCreatedTotal`, `ordersStatusChangedTotal`, `worksheetGenerationSeconds`, `worksheetAcceptedTotal`, `inventoryDeductionsTotal`
- `backend/src/controllers/quote.controller.ts` — `quotesCreatedTotal`, `quotesConvertedTotal`
- `backend/package.json` — added `prom-client ^15.1.3`

**Install after pulling:**
```bash
# Inside container or after rebuild:
docker-compose up -d --build
# or
docker exec signatureshades-api-local npm install
```

### ✅ Blind Fabric Dynamic Catalog (2026-05-28)
**Commit:** 08c1fe4

**Implemented:**
- `BlindFabric` Prisma model — admin-managed fabric table (supplier, fabricType, fabricGroup, colors[])
- `blindFabric.service.ts` + `blindFabric.controller.ts` + `blindFabricRoutes.ts` (`/api/blind-fabrics`)
- `BlindFabricsTab.tsx` — admin UI in PricingManagement for CRUD on fabric catalog
- `useFabrics.ts` React hook — order form fetches fabrics live from DB (replaces hardcoded `fabrics.ts`)
- `seed-blind-fabrics.ts` script — initial population of BlindFabric table
- Updated `BlindItemForm.tsx` to use dynamic fabrics via `useFabrics`

### ✅ Sheer Curtains Product Type (2026-05-07 – 2026-05-14)
**Commits:** 4640e8e, e53b0b5

**Implemented:**
- `sheerCurtainPricing.service.ts` — full curtain pricing (fabric + motor/wand/runner/hook components)
- `CurtainItemForm.tsx` — order form for sheer curtain line items
- `CurtainWorksheet.tsx` — admin worksheet view for curtain orders
- Sheer curtain pricing seeded via `seed-sheer-pricing.ts`, `seed-sheer-inventory.ts`, `seed-sheer-motor-pricing.ts`
- Extended `PricingManagement.tsx` with sheer curtain pricing section
- Extended `webOrder.controller.ts` + `quote.controller.ts` to handle mixed blind/curtain orders

### ✅ Production Migration to AWS RDS Melbourne (2026-05-19)
**Commits:** 0a8a410, 1a18fdc

**Implemented:**
- Migrated from local PostgreSQL container to AWS RDS `db.t4g.micro` in `ap-southeast-4` (Melbourne)
- Terraform manages RDS instance (`aws_db_instance.postgres`) and security group
- Production `DATABASE_URL` now points to RDS endpoint
- Nginx configuration + deployment shell scripts added (commit 6096e28)

### ✅ Warehouse Role + Labels (2026-03-24)
**Commit:** see MEMORY.md — warehouse-role.md

- `WAREHOUSE` role added to `UserRole` enum and `requireAdminOrWarehouse` middleware
- PDF labels endpoint: `GET /api/web-orders/:id/labels/download` (100mm × 80mm per blind)
- Warehouse user: `productionsignatureshades@gmail.com` — create with `npm run create:warehouse`

### ✅ Comprehensive Pricing (2026-02-10)
**Commits:** c6b8e7d, 9aef6d1, 22de2b7, 60bc929

- `comprehensivePricing.service.ts` — 7-component blind pricing (fabric, motor, bracket, chain, clips, idler, stop bolt)
- "Check Price" button in BlindItemForm with full price breakdown
- Pricing breakdown fields added to OrderItem schema (`fabricPrice`, `motorPrice`, `bracketPrice`, `chainPrice`, `clipsPrice`, `componentPrice`)

### ✅ Enhanced Worksheet Generation (2026-02-10)
**Commit:** cbfd097

- Motor-specific width deductions (28/29/30/35mm) in `worksheet.service.ts`
- PDF cutting layout visualization (Page 1 = diagram, Page 2+ = 13-column table)

---

## Production Deploy Rule

**NEVER automatically run SSH commands or execute anything on production.**
When a task requires production changes, provide the commands for the user to run — do not execute them.

## Destructive Command Rule

**NEVER run destructive or irreversible commands without explicit user confirmation.**
This includes: deleting files/directories (`rm`, `Remove-Item`, `rmdir`), dropping database tables, force-pushing, hard-resetting git, killing processes, or any command that cannot be easily undone.
Always explain what the command will do and wait for the user to approve before executing. When in doubt, provide the command for the user to run themselves.

```bash
# Production commands to PROVIDE (never run yourself):
ssh -i ~/.ssh/signatureshades-ec2 ubuntu@16.26.30.228
docker cp ./backend/scripts/<file>.ts signatureshades-api-prod:/app/scripts/<file>.ts
docker exec signatureshades-api-prod npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/<file>.ts
docker compose -f docker-compose.prod.yml build --no-cache frontend
docker compose -f docker-compose.prod.yml up -d frontend
docker restart signatureshades-nginx
```

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

5. **Documentation (REQUIRED for every feature or change):**
   - Update `CLAUDE.md` — architecture overview, DB schema, API endpoints, Recent Updates
   - Update `README.md` — feature list, project structure, API endpoints, database schema
   - Update any relevant skill files under `.claude/claude-code-skills/` whose triggers cover the changed stack
   - If adding a new service/route/page, add it to the relevant `SKILL.md` Project Context section
   - This step is mandatory — do not skip it even for small changes

**When debugging:**

1. Check Docker logs: `docker-compose logs -f backend`
2. Check browser console for frontend errors
3. Check Prisma Studio for database state: `npm run prisma:studio`
4. Check network tab for API call failures (401, 403, 500)
5. Verify JWT token in localStorage (DevTools → Application)
