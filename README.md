# 🏢 Signature Shades Warehouse Management System

Production-grade web application for streamlining blinds manufacturing operations at **Signature Shades**, Sri Lanka's premier custom blinds manufacturer.

![Signature Shades Logo](./logo/App%20Icon.png)

## 🎯 Overview

This warehouse management system automates the entire workflow from customer order processing to inventory management, eliminating manual data entry and reducing errors in the manufacturing process.

### Key Features

- 📊 **Excel Order Processing** - Upload `.xlsm` files and auto-generate cutting worksheets
- 🏭 **Dual Worksheet Generation** - Fabric Cut & Tube Cut worksheets with accurate calculations
- 📦 **Inventory Management** - Track fabrics, bottom bars, motors, and chains in real-time
- 🔍 **Duplicate Detection** - Automatic highlighting of duplicate fabric/color combinations
- 📥 **Multi-Format Export** - Download worksheets as CSV or PDF (with company branding)
- 📝 **Complete Audit Trail** - Track every inventory transaction with timestamps
- ⚠️ **Low Stock Alerts** - Automatic notifications when materials run low
- 🎨 **Brand Integration** - Consistent Signature Shades branding throughout

## 🛠️ Technology Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Lightning-fast build tool
- **Tailwind CSS** - Utility-first styling with brand colors
- **React Query** - Server state management
- **React Router** - Client-side routing
- **Lucide React** - Beautiful icons

### Backend
- **Node.js** with Express & TypeScript
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Production database
- **xlsx** - Excel file parsing
- **jsPDF** - PDF generation with logo
- **Zod** - Runtime validation

### DevOps
- **Docker** & Docker Compose
- **GitHub Actions** - CI/CD pipeline
- **Oracle Cloud Free Tier** - Production hosting
- **Nginx** - Reverse proxy
- **Let's Encrypt** - SSL certificates

## 📁 Project Structure

```
signature-sap/
├── backend/                  # Node.js/Express API
│   ├── prisma/              # Database schema & migrations
│   │   ├── schema.prisma    # Prisma schema definition
│   │   └── seed.ts          # Initial inventory data
│   ├── src/
│   │   ├── config/          # Configuration files
│   │   ├── routes/          # API route definitions
│   │   ├── controllers/     # Request handlers
│   │   ├── services/        # Business logic
│   │   ├── middleware/      # Express middleware
│   │   └── server.ts        # Entry point
│   └── package.json
│
├── frontend/                 # React/TypeScript UI
│   ├── public/              # Static assets
│   ├── src/
│   │   ├── components/      # Reusable components
│   │   ├── pages/           # Page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client
│   │   └── types/           # TypeScript types
│   └── package.json
│
└── logo/                     # Company branding assets
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **PostgreSQL** 14+ ([Download](https://www.postgresql.org/download/))
- **Git** ([Download](https://git-scm.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/DathaCode/signature-sap.git
   cd signature-sap
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

4. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   cd ..
   ```

5. **Configure environment variables**
   ```bash
   cd backend
   cp .env.example .env
   # Edit .env with your database credentials
   ```

6. **Set up the database**
   ```bash
   npm run prisma:push    # Create tables
   npm run seed           # Add initial inventory
   ```

7. **Start development servers** (from root directory)
   ```bash
   npm run dev
   ```

   This starts:
   - Backend API: `http://localhost:3000`
   - Frontend UI: `http://localhost:5173`

## 📊 Database Schema

### Core Tables

- **Orders** - Customer order metadata
- **WorksheetItems** - Individual blind specifications (12 columns)
- **InventoryItems** - Material catalog (4 categories)
- **InventoryTransactions** - Complete audit trail

### Inventory Categories

| Category | Unit Type | Examples |
|----------|-----------|----------|
| Fabrics | mm | Vista Silver, Versatile Grey |
| Bottom Bars | units | Anodised, Black, White |
| Motors | units | Automate 1.1NM Li-Ion |
| Chains | units | Stainless Steel, Plastic |

## 🔧 Development Scripts

```bash
# Root directory
npm run dev              # Start both backend & frontend
npm run build            # Build production bundles
npm run prisma:studio    # Open Prisma Studio (DB GUI)
npm run seed             # Seed database with initial data

# Backend only
cd backend
npm run dev              # Start Express server (port 3000)
npm run build            # Compile TypeScript
npm run prisma:migrate   # Run database migrations

# Frontend only
cd frontend
npm run dev              # Start Vite dev server (port 5173)
npm run build            # Build for production
npm run preview          # Preview production build
```

## 📐 Business Logic

### Dimension Calculations
```
Actual Width  = Original Width - 28mm   (for mounting brackets)
Actual Drop   = Original Drop + 150mm   (for rolling mechanism)
```

### Inventory Deduction (per blind)
- Fabric: Width measurement in mm
- Bottom Bar: 1 unit (matching color)
- Chain/Motor: 1 unit (matching type)

### Duplicate Detection
Blinds with identical **Fabric + Color** combinations are highlighted in yellow for batch cutting efficiency.

## 🎨 Brand Colors

```css
Primary Gold:   #C9A961
Navy Blue:      #1B2B3A
White:          #FFFFFF
```

## 📝 License

ISC License - Copyright (c) 2026 Signature Shades

## 👨‍💻 Author

**Vidath Dulanga**
- GitHub: [@DathaCode](https://github.com/DathaCode)

---

**Signature Shades** | Blinds | Curtains | Shutters
