# Signature Shades - Order Management System

A comprehensive web-based order management platform for Signature Shades, featuring customer self-service ordering, quote management, admin workflow automation, real-time 7-component pricing, cutlist optimization, and production worksheet generation.

## Key Features

### Customer Portal
- **Interactive Order Builder**: 16-field blind configuration with hierarchical fabric selection (Material > Fabric Type > Colour)
- **Real-time Pricing**: 7-component price calculation with automatic discounts (G1=20%, G2=25%, G3=30%)
- **Quote Workflow**: Save orders as quotes, view/manage quotes, convert to orders when ready
- **Draft Auto-Save**: In-progress orders saved to localStorage, restored on next visit (expires after 24h)
- **Order Tracking**: View order history with status updates (Pending > Confirmed > Production > Completed)
- **Order Management**: Cancel pending orders directly from the portal

### Admin Portal
- **Order Approval Workflow**: Review and approve customer orders
- **Production Management**: Send confirmed orders to production with automatic cutlist optimization
- **Worksheet Generation**: 13-column fabric cut CSV/PDF + 5-column tube cut CSV/PDF
- **PDF Visualization**: Visual cutting layout with color-coded panels, rotation indicators, efficiency stats
- **Inventory Management**: 89+ seeded items, automatic deduction on worksheet acceptance, transaction logging
- **User Administration**: Create/manage customer accounts (activate/deactivate)
- **Dynamic Pricing Control**: Edit fabric pricing matrix (G1-G3) + component pricing (motors, brackets, chains, clips)

### Pricing Engine (7 Components)
1. **Fabric price** - From pricing matrix with group discounts
2. **Motor/Chain price** - From inventory (11 motor/winder options)
3. **Bracket price** - Brand + type specific (Acmeda/TBS, 4 types, 5 colours)
4. **Chain price** - Length auto-selected by drop height (500/750/1000/1200/1500mm)
5. **Clips price** - 2 clips per blind (left + right, D30/Oval, 4 colours)
6. **Idler & Clutch** - Conditional on bracket type
7. **Stop bolt & Safety lock** - If winder/chain motor selected

### Production Optimization
- **Cutlist Optimizer**: Guillotine 2D bin packing algorithm (First Fit Decreasing)
- **Tube Cut Calculator**: Linear calculation with 10% wastage on 5800mm stock
- **Motor-Specific Deductions**: Width deductions vary by motor type (28/29/30/35mm)
- **Inventory Deduction**: Automatic stock deduction with transaction logging

---

## Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 15+
- Docker (optional, for containerized deployment)

### Development Setup

1. **Clone & Install**
   ```bash
   git clone https://github.com/DathaCode/signature-sap.git
   cd signature-sap
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install

   # Create .env file
   cp .env.example .env
   # Edit .env with your database credentials

   # Run migrations
   npx prisma migrate dev

   # Seed data
   npm run seed              # Inventory items (89+ items)
   npm run create:admin      # Admin user (admin@signatureshades.com / Admin@123)
   npm run seed:pricing      # Pricing matrix (650 entries)

   # Start server
   npm run dev               # http://localhost:5000
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install

   # Create .env file
   echo "VITE_API_URL=http://localhost:5000/api" > .env

   # Start dev server
   npm run dev               # http://localhost:3000
   ```

4. **Access the Application**
   - **Customer Portal**: http://localhost:3000/register (create account)
   - **Admin Portal**: http://localhost:3000/login
     - Email: `admin@signatureshades.com`
     - Password: `Admin@123` (CHANGE IMMEDIATELY!)

---

## Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Run database migrations (first time only)
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run create:admin
docker-compose exec backend npm run seed
docker-compose exec backend npm run seed:pricing

# View logs
docker-compose logs -f backend
```

Services:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: Port 5432

---

## Tech Stack

### Frontend
- **React 18** + **Vite** - Fast, modern build tooling
- **TypeScript** - Type safety across the application
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing with protected routes
- **React Hook Form** - Efficient form handling with validation
- **TanStack Query** - Server state management
- **Axios** - API communication with JWT interceptors
- **Lucide React** - Icon library
- **date-fns** - Date formatting utilities
- **react-hot-toast** - Toast notifications

### Backend
- **Node.js** + **Express** - RESTful API server
- **TypeScript** - Shared types with frontend
- **Prisma ORM** - Type-safe database access with migrations
- **PostgreSQL** - Production-grade relational database
- **bcryptjs** - Password hashing (10 salt rounds)
- **jsonwebtoken** - JWT authentication (7-day expiry)
- **Zod** - Runtime request validation
- **Winston** - Structured logging
- **pdfkit** - PDF generation for cutting layouts
- **Jest** + **ts-jest** - Backend testing (72 tests, 89% coverage)

---

## Project Structure

```
signature-sap/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Request handlers (webOrder, quote, pricing, etc.)
│   │   ├── middleware/        # Auth (JWT + role-based), error handling
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic
│   │   │   ├── pricing.service.ts              # Fabric pricing matrix
│   │   │   ├── comprehensivePricing.service.ts # 7-component pricing
│   │   │   ├── cutlistOptimizer.service.ts     # 2D bin packing
│   │   │   ├── tubeCutOptimizer.service.ts     # Tube cut calculation
│   │   │   ├── worksheetExport.service.ts      # CSV + PDF generation
│   │   │   └── inventory.service.ts            # Stock management
│   │   ├── data/              # Static data (fabrics, hardware options)
│   │   └── server.ts          # Express app entry
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   ├── migrations/        # Version-controlled migrations
│   │   └── seed.ts            # Inventory seeding (89+ items)
│   └── scripts/
│       ├── create-admin.ts    # Admin user setup
│       └── seed-pricing.ts    # Pricing matrix population
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── customer/      # Dashboard, MyOrders
│   │   │   ├── orders/        # NewOrder, OrderDetails
│   │   │   ├── quotes/        # MyQuotes, QuoteDetails
│   │   │   └── admin/         # OrderManagement, UserManagement, PricingManagement
│   │   ├── components/
│   │   │   ├── ui/            # Reusable UI (Button, Card, Badge, Input, Select, etc.)
│   │   │   ├── orders/        # BlindItemForm, OrderSummary
│   │   │   └── admin/         # FabricCutWorksheet, TubeCutWorksheet
│   │   ├── services/          # API client (quoteApi, webOrderApi, pricingApi, etc.)
│   │   ├── types/             # TypeScript interfaces
│   │   ├── data/              # Fabric/hardware static data
│   │   └── App.tsx            # Route configuration
│   └── public/
├── docker-compose.yml         # Multi-container orchestration
├── CLAUDE.md                  # Development guide & architecture docs
├── UPGRADE.md                 # System upgrade specification (Parts 1-9)
└── PROGRESS.md                # Development progress tracking
```

---

## Security

- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT Tokens**: 7-day expiry, stored in localStorage
- **Role-Based Access**: Customer vs Admin route protection (requireAdmin middleware)
- **Input Validation**: Zod schemas on all API endpoints
- **CORS**: Configured for specific origins

**Production Checklist**:
1. Change default admin password
2. Generate strong JWT secret: `openssl rand -base64 32`
3. Enable HTTPS with SSL certificate
4. Set up rate limiting
5. Configure monitoring and backups

---

## API Documentation

### Authentication
- `POST /api/auth/register` - Register customer
- `POST /api/auth/login` - Login (returns JWT token)
- `GET /api/auth/me` - Get current user

### Orders (Customer)
- `POST /api/web-orders/create` - Create new order (with 7-component pricing)
- `GET /api/web-orders/my-orders` - Get user's orders
- `GET /api/web-orders/:id` - Get order details
- `DELETE /api/web-orders/:id` - Cancel order (PENDING only)

### Quotes (Customer)
- `POST /api/quotes/create` - Save as quote
- `GET /api/quotes/my-quotes` - Get user's quotes
- `GET /api/quotes/:id` - Get quote details
- `POST /api/quotes/:id/convert-to-order` - Convert quote to order
- `DELETE /api/quotes/:id` - Delete quote

### Orders (Admin)
- `GET /api/web-orders/admin/all` - Get all orders (with filters)
- `POST /api/web-orders/:id/approve` - Approve order (PENDING > CONFIRMED)
- `POST /api/web-orders/:id/send-to-production` - Send to production (runs optimization)
- `GET /api/web-orders/:id/worksheets/preview` - Preview worksheet data
- `POST /api/web-orders/:id/worksheets/accept` - Accept worksheets (deducts inventory)
- `POST /api/web-orders/:id/recalculate` - Recalculate optimization
- `GET /api/web-orders/:id/worksheets/download/:type` - Download CSV/PDF

### Pricing
- `POST /api/pricing/calculate` - Calculate fabric price (matrix lookup)
- `POST /api/pricing/calculate-blind` - Calculate full 7-component blind price
- `GET /api/pricing/matrix/:group` - Get pricing matrix (admin)
- `POST /api/pricing/update` - Update pricing cell (admin)
- `GET /api/pricing/components/all` - Get all component prices (admin)
- `PATCH /api/pricing/component/:id` - Update component price (admin)

### Inventory (Admin)
- `GET /api/inventory` - Get all inventory items
- `POST /api/inventory` - Add inventory item
- `PUT /api/inventory/:id` - Update inventory item
- `DELETE /api/inventory/:id` - Delete inventory item
- `POST /api/inventory/:id/adjust` - Adjust quantity

### Users (Admin)
- `GET /api/admin/users` - Get all users
- `PATCH /api/admin/users/:id` - Update user (activate/deactivate)

---

## Testing

```bash
# Backend tests (72 tests, 89% coverage)
cd backend
npm test

# Run with coverage report
npm test -- --coverage
```

**Test Suites:**
- Cutlist Optimizer (10 tests) - Bin packing, rotation, efficiency
- Tube Cut Optimizer (8 tests) - Wastage, grouping, stock length
- Pricing (8 tests) - Tier rounding, discounts, error handling
- Comprehensive Pricing (21 tests) - All 7 components, edge cases
- Worksheet Deductions (15 tests) - All 11 motors, tube cuts
- Fabrics Data (10 tests) - Material/type/colour lookups

---

## License

Proprietary - All rights reserved by Signature Shades

---

## Roadmap

- [ ] Email notifications (order confirmation, status updates)
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Advanced reporting dashboard
- [ ] Order timeline visualization
- [ ] Multi-currency support
- [ ] Mobile app (React Native)
- [ ] CI/CD pipeline
- [ ] Error monitoring (Sentry)

---

**Built for Signature Shades**
