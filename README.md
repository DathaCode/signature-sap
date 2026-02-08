# Signature Shades - Order Management System

A comprehensive web-based order management platform for Signature Shades, featuring customer self-service ordering, admin workflow automation, and real-time pricing calculations.

## 🌟 Key Features

### Customer Portal
- **Self-Service Registration**: Customers create their own accounts
- **Interactive Order Builder**: 16-field blind configuration with hierarchical fabric selection
- **Real-time Pricing**: Instant price calculation with automatic discounts (20-30% based on fabric group)
- **Order Tracking**: View order history with status updates (Pending → Confirmed → Production → Completed)
- **Order Management**: Cancel pending orders directly from the portal

### Admin Portal
- **Order Approval Workflow**: Review and approve customer orders
- **Production Management**: Send confirmed orders to production queue
- **User Administration**: Manage customer accounts (activate/deactivate)
- **Dynamic Pricing Control**: Edit pricing matrix for 5 fabric groups via interactive grid
- **Excel Upload (Legacy)**: Backward-compatible with existing Excel-based order system

### Technical Highlights
- **JWT Authentication**: Secure token-based authentication with role-based access control
- **Dynamic Pricing Engine**: 5 fabric groups with 650+ price points (13 widths × 10 drops)
- **Real-time Calculations**: Debounced API calls for instant feedback
- **Type-Safe**: Full TypeScript implementation (frontend + backend)
- **Production-Ready**: Docker containerization, database migrations, automated seeding

---

## 🚀 Quick Start

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
   npm run seed              # Inventory items
   npm run create:admin      # Admin user (admin@signatureshades.com / Admin@123)
   npm run seed:pricing      # Pricing matrix (650 entries)
   
   # Start server
   npm run dev               # http://localhost:3000
   ```

3. **Frontend Setup**
   ```bash
   cd ../frontend
   npm install
   
   # Create .env file
   echo "VITE_API_URL=http://localhost:3000/api" > .env
   
   # Start dev server
   npm run dev               # http://localhost:5173
   ```

4. **Access the Application**
   - **Customer Portal**: http://localhost:5173/register (create account)
   - **Admin Portal**: http://localhost:5173/login
     - Email: `admin@signatureshades.com`
     - Password: `Admin@123` (CHANGE IMMEDIATELY!)

---

## 📦 Docker Deployment

```bash
# Build and start all services
docker-compose up -d

# Run database migrations (first time only)
docker-compose exec backend npx prisma migrate deploy
docker-compose exec backend npm run create:admin
docker-compose exec backend npm run seed:pricing

# View logs
docker-compose logs -f backend
```

Services:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000
- **PostgreSQL**: Port 5432

---

## 🏗️ Tech Stack

### Frontend
- **React 18** + **Vite** - Fast, modern build tooling
- **TypeScript** - Type safety across the application
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing with protected routes
- **React Hook Form** - Efficient form handling
- **Axios** - API communication with interceptors
- **date-fns** - Date formatting utilities

### Backend
- **Node.js** + **Express** - RESTful API server
- **TypeScript** - Shared types with frontend
- **Prisma ORM** - Type-safe database access
- **PostgreSQL** - Production-grade relational database
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication
- **Zod** - Runtime validation
- **Winston** - Structured logging

---

## 📂 Project Structure

```
signature-sap/
├── backend/
│   ├── src/
│   │   ├── controllers/       # Request handlers
│   │   ├── middleware/        # Auth, error handling
│   │   ├── routes/            # API routes
│   │   ├── services/          # Business logic (pricing, etc.)
│   │   └── server.ts          # Express app entry
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   ├── migrations/        # Version-controlled migrations
│   │   └── seed.ts            # Inventory seeding
│   └── scripts/
│       ├── create-admin.ts    # Admin user setup
│       └── seed-pricing.ts    # Pricing matrix population
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/          # Login, Register
│   │   │   ├── customer/      # Dashboard, MyOrders
│   │   │   ├── orders/        # NewOrder, OrderDetails
│   │   │   └── admin/         # OrderManagement, UserManagement, PricingManagement
│   │   ├── components/        # Reusable UI components
│   │   ├── services/          # API client
│   │   ├── types/             # TypeScript interfaces
│   │   └── App.tsx            # Route configuration
│   └── public/
└── docker-compose.yml         # Multi-container orchestration
```

---

## 🔐 Security

- **Password Hashing**: bcrypt with 10 salt rounds
- **JWT Tokens**: 7-day expiry, stored in localStorage
- **Role-Based Access**: Customer vs Admin route protection
- **Input Validation**: Zod schemas on all API endpoints
- **CORS**: Configured for specific origins

⚠️ **Production Checklist**:
1. Change default admin password
2. Generate strong JWT secret: `openssl rand -base64 32`
3. Enable HTTPS with SSL certificate
4. Set up rate limiting
5. Configure monitoring and backups

---

## 📚 API Documentation

### Authentication
- `POST /api/auth/register` - Register customer
- `POST /api/auth/login` - Login (returns JWT token)
- `GET /api/auth/me` - Get current user

### Orders (Customer)
- `POST /api/web-orders/create` - Create new order
- `GET /api/web-orders/my-orders` - Get user's orders
- `GET /api/web-orders/:id` - Get order details
- `DELETE /api/web-orders/:id` - Cancel order (PENDING only)

### Orders (Admin)
- `GET /api/web-orders/admin/all` - Get all orders (with filters)
- `POST /api/web-orders/:id/approve` - Approve order (PENDING → CONFIRMED)
- `POST /api/web-orders/:id/send-to-production` - Send to production

### Pricing
- `POST /api/pricing/calculate` - Calculate price for item
- `GET /api/pricing/matrix/:group` - Get pricing matrix
- `POST /api/pricing/update` - Update price (admin)

See [walkthrough.md](./walkthrough.md) for complete API reference.

---

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test

# E2E testing workflow (manual)
# See walkthrough.md for step-by-step testing guide
```

---

## 🤝 Contributing

This is a private project for Signature Shades. For issues or feature requests, contact the development team.

---

## 📄 License

Proprietary - All rights reserved by Signature Shades

---

## 🎯 Roadmap

- [ ] Email notifications (order confirmation, status updates)
- [ ] Quick Quote feature (instant pricing without order creation)
- [ ] Order timeline visualization
- [ ] Multi-currency support
- [ ] Advanced reporting dashboard
- [ ] Mobile app (React Native)

---

**Built with ❤️ for Signature Shades**
