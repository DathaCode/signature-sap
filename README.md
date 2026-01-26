# Signature Shades Warehouse Management System

A comprehensive warehouse management system for Signature Shades, built with React, Node.js, PostgreSQL, and Docker.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)
![Docker](https://img.shields.io/badge/docker-ready-brightgreen)

---

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development Workflow](#development-workflow)
- [Production Deployment](#production-deployment)
- [API Documentation](#api-documentation)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## ✨ Features

### Order Management
- **Excel Upload**: Upload order files in XLSM format
- **Automatic Calculations**: Width - 28mm, Drop + 150mm
- **Duplicate Detection**: Highlights duplicate fabric combinations
- **Inventory Validation**: Real-time availability checking
- **Worksheet Generation**: Fabric Cut (12 columns) & Tube Cut (5 columns)
- **Export Options**: CSV and PDF with custom formatting

### Inventory Management
- **CRUD Operations**: Create, read, update, delete inventory items
- **Category Management**: Fabrics, Bottom Bars, Motors, Chains
- **Quantity Adjustments**: Add or remove stock with audit trail
- **Low Stock Alerts**: Automatic threshold-based alerts
- **Transaction History**: Complete audit trail for all changes
- **Search & Filter**: Real-time search and category filters

### Business Logic
- Precision calculations for blinds manufacturing
- Atomic inventory deductions (prevents overselling)
- Complete audit trail for compliance
- Duplicate fabric highlighting for production efficiency

---

## 🛠 Tech Stack

### Backend
- **Runtime**: Node.js 20 (Alpine)
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL 15
- **ORM**: Prisma
- **File Processing**: XLSX, Papa Parse
- **PDF Generation**: jsPDF with AutoTable
- **Logging**: Winston

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **Forms**: React Hook Form
- **Icons**: Lucide React
- **File Upload**: React Dropzone

### DevOps
- **Containerization**: Docker & Docker Compose
- **Reverse Proxy**: Nginx
- **CI/CD**: GitHub Actions
- **Development**: Hot-reload with volume mounts

---

## 📦 Prerequisites

### Required Software
- **Docker Desktop for Windows 11** (with WSL2 backend)
- **Git** for version control
- **Code Editor** (VS Code recommended)

### System Requirements
- **RAM**: Minimum 4GB allocated to Docker
- **Ports**: 3000 (frontend), 5000 (backend), 5432 (PostgreSQL) must be available
- **Disk Space**: ~2GB for Docker images and data

---

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/DathaCode/signature-sap.git
cd signature-sap
```

### 2. Copy Environment File
```bash
# Copy the example environment file
cp .env.local.example .env
```

### 3. Start All Services
```bash
# Start PostgreSQL, backend, and frontend
docker-compose up -d
```

### 4. Wait for Services (30 seconds)
```bash
# Check if services are healthy
docker-compose ps
```

### 5. Run Database Migrations
```bash
# First time setup only
docker exec signatureshades-api-local npx prisma migrate dev --name init
```

### 6. Seed Database
```bash
# Load initial inventory data (26 items)
docker exec signatureshades-api-local npm run seed
```

### 7. Access the Application
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:5000/api
- **API Health Check**: http://localhost:5000/api/health
- **Database**: localhost:5432 (credentials in .env)

---

## 💻 Development Workflow

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Hot-Reload Testing
**Backend** (TypeScript hot-reload):
1. Edit any file in `backend/src/`
2. Backend container auto-restarts
3. Changes reflected immediately

**Frontend** (Vite HMR):
1. Edit any file in `frontend/src/`
2. Browser auto-refreshes
3. State preserved when possible

### Database Management
```bash
# Access PostgreSQL
docker exec -it signatureshades-db-local psql -U signatureshades_dev -d signatureshades_dev

# Run Prisma Studio (Database GUI)
docker exec -it signatureshades-api-local npx prisma studio
# Access at: http://localhost:5555

# Reset database (development only!)
docker exec -it signatureshades-api-local npx prisma migrate reset
```

### Stop Services
```bash
# Stop all containers
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### Restart a Single Service
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Execute Backend Commands
```bash
# Access backend shell
docker exec -it signatureshades-api-local sh

# Run a specific script
docker exec -it signatureshades-api-local npm run <script-name>
```

---

## 🌐 Production Deployment

### Prerequisites
- Oracle Cloud VM or any Linux server
- Docker and Docker Compose installed on server
- Domain name pointed to server IP (optional but recommended)

### 1. Prepare Environment
```bash
# On server
cd ~/
git clone https://github.com/DathaCode/signature-sap.git signatureshades
cd signatureshades

# Create production environment file
cp .env.production.example .env.production

# Edit with secure credentials
nano .env.production
```

### 2. Update Environment Variables
```env
# Generate strong password
POSTGRES_PASSWORD=<STRONG_RANDOM_PASSWORD>

# Update URLs
CORS_ORIGIN=https://yourdomain.com
VITE_API_URL=https://yourdomain.com/api

# Generate JWT secret
JWT_SECRET=<RANDOM_SECRET_STRING>
```

### 3. Make Scripts Executable
```bash
chmod +x deploy.sh
chmod +x backup.sh
```

### 4. Deploy
```bash
./deploy.sh
```

### 5. Setup Automated Backups
```bash
# Add to crontab (daily at 2 AM)
crontab -e

# Add line:
0 2 * * * cd ~/signatureshades && ./backup.sh >> logs/backup.log 2>&1
```

### 6. Configure GitHub Actions (Optional)
If using CI/CD, add these secrets to your GitHub repository:

- `ORACLE_VM_IP`: Your server IP address
- `ORACLE_VM_USER`: SSH username (e.g., ubuntu)
- `ORACLE_SSH_KEY`: Private SSH key for authentication

---

## 📚 API Documentation

### Base URL
**Local Development**: `http://localhost:5000/api`
**Production**: `https://yourdomain.com/api`

### Endpoints

#### Orders
```
POST   /api/orders/upload              Upload Excel order file
POST   /api/orders/:orderId/confirm    Confirm order and deduct inventory
GET    /api/orders/:orderId/worksheets Get fabric cut & tube cut worksheets
GET    /api/orders/:orderId/download   Download worksheet (CSV or PDF)
GET    /api/orders/:orderId            Get order details
GET    /api/orders                     List all orders
```

#### Inventory
```
GET    /api/inventory                         List inventory items
GET    /api/inventory/:itemId                 Get single item with history
POST   /api/inventory                         Create new item
PUT    /api/inventory/:itemId                 Update item details
DELETE /api/inventory/:itemId                 Delete item (soft delete)
POST   /api/inventory/:itemId/adjust          Adjust quantity
GET    /api/inventory/:itemId/transactions    Get transaction history
GET    /api/inventory/transactions            Get all transactions
GET    /api/inventory/alerts/low-stock        Get low stock items
POST   /api/inventory/bulk-import             Bulk import from CSV
```

### Example: Upload Order
```bash
curl -X POST http://localhost:5000/api/orders/upload \
  -F "file=@order.xlsm" \
  -F "customerName=ABC Company"
```

### Example: Get Inventory
```bash
curl http://localhost:5000/api/inventory?category=FABRIC&search=vista
```

---

## 🧪 Testing

See [TESTING.md](./TESTING.md) for comprehensive testing documentation.

### Quick Test Commands
```bash
# Run all backend tests
docker exec signatureshades-api-local npm test

# Run specific test file
docker exec signatureshades-api-local npm test -- inventory.test.ts

# Run frontend tests
docker exec signatureshades-web-local npm test
```

### E2E Testing
1. Open http://localhost:3000
2. Follow test scenarios in [TESTING.md](./TESTING.md)
3. Verify all features work correctly

---

## 🐛 Troubleshooting

### Services Won't Start
```bash
# Check if ports are already in use
netstat -an | findstr "3000 5000 5432"

# Restart Docker Desktop
# Then try again
docker-compose down -v
docker-compose up -d
```

### Prisma Client Not Found
```bash
# Regenerate Prisma Client
docker exec signatureshades-api-local npx prisma generate
docker-compose restart backend
```

### Frontend Can't Connect to Backend
```bash
# Check backend is running
docker-compose ps

# Check backend logs
docker-compose logs backend

# Verify VITE_API_URL in .env
cat .env | grep VITE_API_URL
```

### Hot-Reload Not Working
```bash
# Ensure WSL2 is enabled in Docker Desktop
# Settings → General → Use WSL 2 based engine

# Restart containers
docker-compose restart
```

### Database Connection Issues
```bash
# Check PostgreSQL is healthy
docker exec signatureshades-db-local pg_isready -U signatureshades_dev

# View database logs
docker-compose logs postgres
```

### Port Conflicts
```bash
# Change ports in docker-compose.yml if needed
# Frontend: "3001:3000" instead of "3000:3000"
# Backend: "5001:5000" instead of "5000:5000"

# Then restart
docker-compose down
docker-compose up -d
```

---

## 📁 Project Structure

```
signature-sap/
├── backend/
│   ├── src/
│   │   ├── config/           # Logger, database config
│   │   ├── controllers/      # Request handlers
│   │   ├── services/         # Business logic
│   │   ├── routes/           # API routes
│   │   ├── middleware/       # Error handling, validation
│   │   └── server.ts         # Express app entry point
│   ├── prisma/
│   │   ├── schema.prisma     # Database schema
│   │   └── seed.ts           # Seed data
│   ├── Dockerfile            # Multi-stage Docker build
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   ├── pages/            # Page components
│   │   ├── services/         # API client
│   │   ├── types/            # TypeScript types
│   │   ├── App.tsx           # Root component
│   │   └── main.tsx          # Entry point
│   ├── Dockerfile            # Multi-stage Docker build
│   ├── nginx.conf            # Production Nginx config
│   └── package.json
├── nginx/
│   └── nginx.conf            # Reverse proxy config
├── .github/
│   └── workflows/
│       └── deploy.yml        # CI/CD pipeline
├── docker-compose.yml        # Local development
├── docker-compose.prod.yml   # Production deployment
├── deploy.sh                 # Deployment automation
├── backup.sh                 # Backup automation
├── .env.local.example        # Development env template
├── .env.production.example   # Production env template
├── TESTING.md                # Testing documentation
└── README.md                 # This file
```

---

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test locally with `docker-compose up`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style
- **Backend**: Follow TypeScript best practices, use Prettier
- **Frontend**: Follow React best practices, use ESLint
- **Commits**: Use conventional commits format

---

## 📄 License

ISC License - See LICENSE file for details

---

## 👤 Author

**Vidath Dulanjana**
- GitHub: [@DathaCode](https://github.com/DathaCode)

---

## 🙏 Acknowledgments

- Built for Signature Shades warehouse operations
- Docker setup optimized for Windows 11 development
- Oracle Cloud deployment ready

---

## 📞 Support

For issues, questions, or suggestions:
1. Check [TESTING.md](./TESTING.md) for troubleshooting
2. Review existing GitHub Issues
3. Create a new Issue with detailed description
4. Contact: vidathdulanjana@gmail.com

---

**Happy Deploying! 🚀**
