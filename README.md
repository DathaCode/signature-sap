# Signature Shades - Order Management System

A comprehensive web-based order management platform for Signature Shades, featuring customer self-service ordering, quote management, admin workflow automation, warehouse operations, real-time 7-component pricing, cutlist optimization, production worksheet generation, and label printing.

## Key Features

### Customer Portal
- **Interactive Order Builder**: 16-field blind configuration with hierarchical fabric selection (Material > Fabric Type > Colour)
- **Real-time Pricing**: 7-component price calculation with automatic group discounts (G1=20%, G2=25%, G3=30%)
- **Quote Workflow**: Save orders as quotes, view/manage quotes, convert to orders when ready
- **Draft Auto-Save**: In-progress orders saved to localStorage, restored on next visit (expires after 24h)
- **Order Tracking**: View order history with status updates (Pending > Confirmed > Production > Completed)
- **Order Management**: Cancel pending orders directly from the portal
- **Password Reset**: Self-service forgot password flow with token-based reset

### Admin Portal
- **Order Approval Workflow**: Review and approve customer orders with admin notes
- **Order Editing**: Edit order details, update admin fields, toggle fabric ordered status
- **Production Management**: Send confirmed orders to production with automatic cutlist optimization
- **Worksheet Generation**: 13-column fabric cut CSV/PDF + 5-column tube cut CSV/PDF with motor-specific deductions
- **PDF Visualization**: Visual cutting layout with color-coded panels, rotation indicators, efficiency stats
- **Label Printing**: Per-blind PDF labels (100mm x 62mm) with order details, fabric info, and motor/chain specifications
- **Inventory Management**: 89+ seeded items across 8 categories, automatic deduction on worksheet acceptance, transaction logging, low-stock alerts, CSV bulk import
- **User Administration**: Create/manage customer accounts (activate/deactivate), admin approval for new registrations
- **Per-Customer Discounts**: Configurable G1-G4 discount rates per customer (Acmeda/TBS/Motorised groups)
- **Dynamic Pricing Control**: Edit fabric pricing matrix (G1-G3) + component pricing (motors, brackets, chains, clips)
- **Trash & Restore**: Soft-delete orders with trash view, restore, and permanent purge

### Warehouse Portal
- **Production Orders**: View orders in production status
- **Inventory Viewing**: Read-only access to inventory items and stock levels
- **Label Download**: Download per-blind PDF labels for production
- **Order Status Updates**: Update order status through production workflow

### Pricing Engine (7 Components)
1. **Fabric price** - From pricing matrix with group discounts
2. **Motor/Chain price** - From inventory (11 motor/winder options)
3. **Bracket price** - Brand + type specific (Acmeda/TBS, 4 bracket types, 5 colours)
4. **Chain price** - Length auto-selected by drop height (500/900/1200/1500/2000mm)
5. **Clips price** - 2 clips per blind (left + right, D30/Oval, 4 colours)
6. **Idler & Clutch** - Conditional on Dual bracket type
7. **Stop bolt & Safety lock** - If winder/chain motor selected

### Production Optimization
- **Fabric Cut Optimizer**: MaxRects + Genetic algorithm for 2D bin packing
- **Cutlist Optimizer**: Guillotine 2D bin packing (First Fit Decreasing) with rotation support
- **Tube Cut Calculator**: Linear calculation with 10% wastage on 5800mm stock
- **Motor-Specific Width Deductions**: Winders 28mm, Automate 29mm, Alpha Battery 30mm, Alpha AC 35mm
- **Inventory Deduction**: Automatic stock deduction with full transaction logging

---

## Quick Start

### Prerequisites
- Docker & Docker Compose (recommended)
- Node.js 20+ and npm (for non-Docker setup)
- PostgreSQL 15+

### Docker Setup (Recommended)

1. **Clone & Start**
   ```bash
   git clone https://github.com/DathaCode/signature-sap.git
   cd signature-sap
   docker-compose up -d --build
   ```

2. **Initialize Database (first time only)**
   ```bash
   # Apply migrations
   docker exec signatureshades-api-local npx prisma migrate deploy

   # Seed inventory (89+ items)
   docker exec signatureshades-api-local npm run seed

   # Seed pricing matrix (650 entries)
   docker exec signatureshades-api-local npm run seed:pricing

   # Create admin user
   docker exec -e ADMIN_PASSWORD="YourStr0ng!Pass" signatureshades-api-local npm run create:admin

   # Create warehouse user (optional)
   docker exec signatureshades-api-local npm run create:warehouse
   ```

3. **Access the Application**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:5000
   - **Admin Login**: `orders@signatureshades.com.au` / (password set above)
   - **Warehouse Login**: `productionsignatureshades@gmail.com` / `Warehouse@123`
   - **Customer**: Register at http://localhost:3000/register (requires admin approval)

### Manual Setup (Without Docker)

1. **Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env    # Edit with your database credentials
   npx prisma migrate dev
   npm run seed
   npm run seed:pricing
   ADMIN_PASSWORD="YourStr0ng!Pass" npm run create:admin
   npm run dev              # http://localhost:5000
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm install
   echo "VITE_API_URL=http://localhost:5000/api" > .env
   npm run dev              # http://localhost:3000
   ```

---

## Tech Stack

### Frontend
- **React 18** + **Vite 6** - Fast, modern build tooling
- **TypeScript 5.7** - Type safety across the application
- **Tailwind CSS 3.4** - Utility-first styling
- **React Router 7** - Client-side routing with protected routes
- **React Hook Form** - Efficient form handling with Zod validation
- **TanStack Query 5** - Server state management with caching
- **Axios** - API communication with JWT interceptors
- **Zustand** - Lightweight client state management
- **Framer Motion** - Animations and transitions
- **Lucide React** - Icon library
- **Goey Toast** - Toast notifications
- **date-fns** - Date formatting utilities
- **React Dropzone** - File upload drag & drop

### Backend
- **Node.js 20** + **Express 4** - RESTful API server
- **TypeScript** - Shared types with frontend
- **Prisma ORM 5** - Type-safe database access with migrations
- **PostgreSQL 15** - Production-grade relational database
- **bcryptjs** - Password hashing (10 salt rounds)
- **jsonwebtoken** - JWT authentication (7-day expiry)
- **Zod** - Runtime request validation
- **Winston** - Structured logging
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting on auth endpoints
- **pdfkit** - PDF generation for cutting layouts and labels
- **Multer** - File upload handling
- **PapaParse** - CSV parsing for bulk import

---

## Project Structure

```
signature-sap/
├── backend/
│   ├── src/
│   │   ├── controllers/          # Request handlers
│   │   │   ├── auth.controller.ts           # Login, register, password reset
│   │   │   ├── webOrder.controller.ts       # Orders, worksheets, labels (22 functions)
│   │   │   ├── quote.controller.ts          # Quote CRUD + convert to order
│   │   │   ├── pricing.controller.ts        # Matrix lookup + 7-component pricing
│   │   │   ├── inventory.controller.ts      # Stock management + bulk import
│   │   │   ├── user.controller.ts           # User CRUD + per-customer discounts
│   │   │   └── adminWorksheet.controller.ts # Worksheet operations
│   │   ├── middleware/
│   │   │   ├── auth.ts                      # JWT + role-based (ADMIN, WAREHOUSE, CUSTOMER)
│   │   │   └── errorHandler.ts              # Global error handling
│   │   ├── routes/                # API route definitions
│   │   │   ├── authRoutes.ts                # Auth (rate-limited)
│   │   │   ├── webOrderRoutes.ts            # Orders + worksheets + labels
│   │   │   ├── quoteRoutes.ts               # Quotes
│   │   │   ├── pricingRoutes.ts             # Pricing matrix + components
│   │   │   ├── inventoryRoutes.ts           # Inventory + transactions
│   │   │   ├── userRoutes.ts                # User management
│   │   │   └── adminWorksheetRoutes.ts      # Admin worksheet operations
│   │   ├── services/              # Business logic
│   │   │   ├── comprehensivePricing.service.ts  # 7-component blind pricing
│   │   │   ├── pricing.service.ts               # Fabric pricing matrix lookup
│   │   │   ├── cutlistOptimizer.service.ts      # Guillotine 2D bin packing
│   │   │   ├── fabricCutOptimizer.service.ts    # MaxRects + genetic algorithm
│   │   │   ├── tubeCutOptimizer.service.ts      # Linear tube cut (5800mm stock)
│   │   │   ├── worksheetExport.service.ts       # CSV + PDF generation
│   │   │   ├── worksheet.service.ts             # Worksheet data management
│   │   │   ├── inventory.service.ts             # Stock queries + alerts
│   │   │   └── inventoryDeduction.service.ts    # Atomic inventory deduction
│   │   ├── data/                  # Static data (fabrics, hardware options)
│   │   ├── config/                # Logger configuration
│   │   └── server.ts              # Express app entry
│   ├── prisma/
│   │   ├── schema.prisma          # Database schema (8 models, 9 enums)
│   │   ├── migrations/            # 15 version-controlled migrations
│   │   └── seed.ts                # Inventory seeding (89+ items)
│   └── scripts/
│       ├── create-admin.ts        # Admin user setup
│       ├── create-warehouse-user.ts  # Warehouse user setup
│       └── seed-pricing.ts        # Pricing matrix population (650 entries)
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/              # Login, Register, ForgotPassword, ResetPassword
│   │   │   ├── customer/          # Dashboard, MyOrders
│   │   │   ├── orders/            # NewOrder, OrderDetails
│   │   │   ├── quotes/            # MyQuotes, QuoteDetails
│   │   │   └── admin/             # OrderManagement, AdminOrderDetails, UserManagement,
│   │   │                          # PricingManagement, TrashOrders
│   │   ├── components/
│   │   │   ├── ui/                # Reusable UI (Button, Card, Badge, Input, Select, etc.)
│   │   │   ├── auth/              # LoginForm, RegisterForm
│   │   │   ├── layout/            # ProtectedRoute, Layout
│   │   │   ├── orders/            # BlindItemForm (16 fields), OrderSummary
│   │   │   ├── admin/             # FabricCutWorksheet, TubeCutWorksheet, WorksheetPreview
│   │   │   └── inventory/         # AddInventoryModal, AdjustQuantityModal, ItemHistoryModal
│   │   ├── services/              # API clients (auth, orders, quotes, pricing, inventory)
│   │   ├── types/                 # TypeScript interfaces
│   │   ├── data/                  # Fabric hierarchy + hardware options (static)
│   │   ├── context/               # AuthContext (JWT + user role)
│   │   └── App.tsx                # Route configuration
│   └── public/
├── docker-compose.yml             # Development environment
├── docker-compose.prod.yml        # Production environment (with Nginx)
├── nginx/                         # Nginx reverse proxy config
├── CLAUDE.md                      # Development guide & architecture docs
├── UPGRADE.md                     # System upgrade specification
└── PROGRESS.md                    # Development progress tracking
```

---

## User Roles & Access

| Feature | Customer | Admin | Warehouse |
|---------|----------|-------|-----------|
| Create orders / quotes | Yes | - | - |
| View own orders | Yes | - | - |
| View all orders | - | Yes | Production only |
| Approve orders | - | Yes | - |
| Edit order details | - | Yes | - |
| Send to production | - | Yes | - |
| Preview/accept worksheets | - | Yes | Preview only |
| Download worksheets | - | Yes | Yes |
| Download labels | - | Yes | Yes |
| Update order status | - | Yes | Yes |
| Manage inventory | - | Full CRUD | Read-only |
| Manage users | - | Yes | - |
| Manage pricing | - | Yes | - |
| Trash/restore orders | - | Yes | - |
| Register (requires approval) | Yes | - | - |

---

## Security

- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT Tokens**: 7-day expiry, stored in localStorage
- **Role-Based Access**: Customer / Admin / Warehouse route protection via middleware
- **Rate Limiting**: Auth endpoints rate-limited (login: 10/15min, register: 5/hour, password reset: 3/hour)
- **Security Headers**: Helmet middleware for HTTP security headers
- **Input Validation**: Zod schemas on all API endpoints
- **CORS**: Configured for specific origins
- **Brute Force Protection**: Account lockout after failed login attempts
- **Admin Approval**: New customer registrations require admin approval
- **Soft Deletes**: Orders are trashed before permanent deletion

**Production Checklist**:
1. Set strong admin password via `ADMIN_PASSWORD` env var
2. Generate strong JWT secret: `openssl rand -base64 32`
3. Enable HTTPS with SSL certificate (Nginx + Let's Encrypt)
4. Set environment variables via `.env` (never commit secrets)
5. Use `docker-compose.prod.yml` for production deployments
6. Configure database backups

---

## API Endpoints

### Authentication
```
POST /api/auth/register          - Register customer (rate-limited: 5/hour)
POST /api/auth/login             - Login, returns JWT (rate-limited: 10/15min)
POST /api/auth/logout            - Logout (protected)
GET  /api/auth/me                - Get current user (protected)
POST /api/auth/refresh           - Refresh JWT token (protected)
POST /api/auth/forgot-password   - Request password reset (rate-limited: 3/hour)
POST /api/auth/reset-password    - Reset password with token (rate-limited: 3/hour)
```

### Orders — Customer
```
POST   /api/web-orders/create    - Create new order (with 7-component pricing)
GET    /api/web-orders/my-orders - Get user's orders
GET    /api/web-orders/:id       - Get order details
DELETE /api/web-orders/:id       - Cancel order (PENDING only)
```

### Orders — Admin
```
GET    /api/web-orders/admin/all                      - Get all orders (with filters)
GET    /api/web-orders/admin/trash                    - Get trashed orders
PATCH  /api/web-orders/:id/details                    - Edit order details
PATCH  /api/web-orders/:id/fabric-ordered             - Toggle fabric ordered flag
PATCH  /api/web-orders/:id/admin-fields               - Update admin notes/fields
POST   /api/web-orders/:id/approve                    - Approve order (PENDING → CONFIRMED)
POST   /api/web-orders/:id/send-to-production         - Send to production (runs optimization)
PATCH  /api/web-orders/:id/status                     - Update order status
DELETE /api/web-orders/:id/trash                      - Soft-delete order
POST   /api/web-orders/:id/restore                    - Restore trashed order
DELETE /api/web-orders/:id/purge                      - Permanently delete order
```

### Worksheets & Labels
```
GET  /api/web-orders/:id/worksheets/preview           - Preview worksheet data
GET  /api/web-orders/:id/worksheets/preview-confirmed - Preview for confirmed orders
POST /api/web-orders/:id/worksheets/accept            - Accept worksheets (deducts inventory)
POST /api/web-orders/:id/recalculate                  - Recalculate optimization
GET  /api/web-orders/:id/worksheets/download/:type    - Download CSV/PDF
GET  /api/web-orders/:id/labels/download              - Download per-blind PDF labels
```

### Quotes — Customer
```
POST   /api/quotes/create                - Save as quote
GET    /api/quotes/my-quotes             - Get user's quotes
GET    /api/quotes/:id                   - Get quote details
PATCH  /api/quotes/:id                   - Update quote
POST   /api/quotes/:id/convert-to-order  - Convert quote to order
DELETE /api/quotes/:id                   - Delete quote
```

### Pricing
```
POST  /api/pricing/calculate         - Calculate fabric price (matrix lookup)
POST  /api/pricing/calculate-blind   - Calculate full 7-component blind price
GET   /api/pricing/:fabricGroup      - Get pricing matrix for group (admin)
PUT   /api/pricing/:fabricGroup/:width/:drop - Update pricing cell (admin)
GET   /api/pricing/components/all    - Get all component prices (admin)
PATCH /api/pricing/component/:id     - Update component price (admin)
```

### Inventory — Admin
```
GET    /api/inventory                    - Get all inventory items
POST   /api/inventory                    - Add inventory item
GET    /api/inventory/alerts/low-stock   - Get low-stock alerts
GET    /api/inventory/transactions       - Get all transactions (with filters)
POST   /api/inventory/bulk-import        - Bulk import via CSV
GET    /api/inventory/:itemId            - Get single item
PUT    /api/inventory/:itemId            - Update item
DELETE /api/inventory/:itemId            - Delete item
POST   /api/inventory/:itemId/adjust     - Adjust quantity
GET    /api/inventory/:itemId/transactions - Get item transaction history
```

### Users — Admin
```
POST   /api/users/               - Create customer
GET    /api/users/               - Get all users
GET    /api/users/:id            - Get user by ID
PATCH  /api/users/:id            - Update user (activate/deactivate/approve)
DELETE /api/users/:id            - Delete user
PATCH  /api/users/:id/discounts  - Set per-customer G1-G4 discount rates
```

---

## Database Schema

### Models
- **User** - Customers, admins, warehouse staff with role-based access, per-customer discounts, approval workflow
- **Order** - Orders with status tracking, soft deletes, fabric ordering flag, admin notes
- **OrderItem** - 16-field blind configuration with pricing breakdown (7 components) and optimization placement data
- **WorksheetItem** - For Excel upload workflows
- **WorksheetData** - Fabric cut and tube cut optimization results with acceptance tracking
- **InventoryItem** - Stock items across 8 categories with pricing and low-stock alerts
- **InventoryTransaction** - Immutable audit trail for all stock changes
- **PricingMatrix** - Fabric pricing by group/width/drop (650 entries)
- **Quote** - Saved quotes with 30-day expiry, convertible to orders

### Enums
- **UserRole**: `CUSTOMER`, `ADMIN`, `WAREHOUSE`
- **OrderStatus**: `PENDING` → `CONFIRMED` → `PRODUCTION` → `COMPLETED` | `CANCELLED`
- **InventoryCategory**: `FABRIC`, `BOTTOM_BAR`, `BOTTOM_BAR_CLIP`, `CHAIN`, `ACMEDA`, `TBS`, `MOTOR`, `ACCESSORY`
- **ProductType**: `BLINDS`, `CURTAINS`, `SHUTTERS`
- **TransactionType**: `ADDITION`, `DEDUCTION`, `ADJUSTMENT`
- **UnitType**: `MM`, `UNITS`

### Order Status Workflow
```
PENDING → CONFIRMED → PRODUCTION → COMPLETED
   └──────────────> CANCELLED (from any stage)
```

---

## Available Scripts

### Backend
```bash
npm run dev              # Development with hot-reload (tsx watch)
npm run build            # Build TypeScript for production
npm start                # Start production server
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Create new migration
npm run prisma:push      # Push schema without migration
npm run prisma:studio    # Open Prisma Studio GUI
npm run seed             # Seed inventory items (89+ items)
npm run seed:pricing     # Seed pricing matrix (650 entries)
npm run create:admin     # Create admin user
npm run create:warehouse # Create warehouse user
npm run lint             # Run ESLint
npm test                 # Run Jest tests
```

### Frontend
```bash
npm run dev              # Development with hot-reload (Vite)
npm run build            # Production build (TypeScript + Vite)
npm run preview          # Preview production build
npm run lint             # Run ESLint
```

### Docker
```bash
# Development
docker-compose up -d                    # Start all services
docker-compose up -d --build            # Rebuild and start
docker-compose down                     # Stop all services
docker-compose logs -f backend          # Stream backend logs
docker-compose logs -f frontend         # Stream frontend logs

# Production (AWS)
docker-compose -f docker-compose.prod.yml up -d --build
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml logs -f backend

# Database access
docker exec -it signatureshades-db-local psql -U signatureshades_dev -d signatureshades_dev
```

---

## Deployment

### Development (Local Docker)
```
docker-compose.yml
├── PostgreSQL 15 (internal network only)
├── Backend (port 5000, hot-reload via volume mount)
└── Frontend (port 3000, hot-reload via volume mount)
```

### Production (AWS EC2)
```
docker-compose.prod.yml
├── PostgreSQL 15 (localhost:5432 only, not internet-facing)
├── Backend (production build, internal network)
├── Frontend (production build, internal network)
└── Nginx (ports 80/443, SSL via Let's Encrypt, reverse proxy)
```

**Production deployment:**
```bash
# Always use the prod compose file
docker-compose -f docker-compose.prod.yml up -d --build

# Apply migrations
docker exec signatureshades-api-prod npx prisma migrate deploy

# Environment variables are set via .env file on the server
```

---

## Testing

```bash
cd backend
npm test                    # Run all tests
npm test -- --coverage      # Run with coverage report
```

**Test Suites (8 files):**
| Suite | Tests | Description |
|-------|-------|-------------|
| Comprehensive Pricing | 21 | All 7 components, edge cases, discount calculations |
| Worksheet Deductions | 15 | All 11 motors, motor-specific width deductions |
| Cutlist Optimizer | 10 | Bin packing, rotation, efficiency metrics |
| Fabrics Data | 10 | Material/type/colour lookups, group assignments |
| Pricing | 8 | Tier rounding, group discounts, error handling |
| Tube Cut Optimizer | 8 | Wastage calculation, grouping, stock length |
| Fabric Cut Optimizer | - | MaxRects algorithm, genetic optimization |

---

## 16-Field Blind Configuration

Each blind item captures:

| # | Field | Options |
|---|-------|---------|
| 1 | Location | Free text |
| 2 | Width | 350-2950mm |
| 3 | Drop | mm |
| 4 | Fixing | Face / Recess |
| 5 | Bracket Type | Single, Single Extension, Dual Left, Dual Right |
| 6 | Bracket Colour | White, Black, Dune, Bone, Anodised |
| 7 | Control Side | Left / Right |
| 8 | Chain or Motor | 11 options (2 winders + 6 Automate + 3 Alpha) |
| 9 | Chain Type | Stainless Steel / Plastic Pure White (winders only) |
| 10 | Roll Direction | Front / Back |
| 11 | Material | Gracetech, Textstyle, Uniline, Vertex, Alpha |
| 12 | Fabric Type | Hierarchical by material |
| 13 | Fabric Colour | Hierarchical by fabric type |
| 14 | Bottom Rail Type | D30 / Oval |
| 15 | Bottom Rail Colour | White, Black, Dune, Bone, Anodised |
| 16 | Price | Auto-calculated from 7 components |

---

## License

Proprietary - All rights reserved by Signature Shades

---

## Roadmap

- [ ] Sheer Curtain input form (as product type alongside Blinds)
- [ ] Email notifications (order confirmation, status updates)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Advanced reporting dashboard
- [ ] Order timeline visualization
- [ ] CI/CD pipeline
- [ ] Error monitoring (Sentry)

---

**Built for Signature Shades**
