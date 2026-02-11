# Railway Production Deployment Guide
### Signature Shades Order Management System

> **Branch:** `railway-prod`  
> **Last Updated:** February 11, 2026

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [Database Setup](#database-setup)
6. [Environment Variables](#environment-variables)
7. [Post-Deployment Steps](#post-deployment-steps)
8. [Troubleshooting](#troubleshooting)
9. [Maintenance](#maintenance)

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] Railway account ([railway.app](https://railway.app))
- [ ] Railway CLI installed: `npm install -g @railway/cli`
- [ ] Git installed and configured
- [ ] This repository cloned and on `railway-prod` branch
- [ ] Node.js 20+ installed locally

---

## 🚀 Initial Setup

### Step 1: Install Railway CLI

```powershell
npm install -g @railway/cli
```

### Step 2: Login to Railway

```powershell
railway login
```

This will open your browser for authentication.

### Step 3: Initialize Railway Project

Navigate to your project root:

```powershell
cd "f:\SIGNATUR SHADES\signature-sap"
railway init
```

Choose:
- **"Empty Project"** (we'll add services manually)
- Give it a name: `signature-shades-prod`

### Step 4: Link to Your Project

```powershell
railway link
```

Select the project you just created.

---

## 🔧 Backend Deployment

### Step 1: Create Backend Service

```powershell
railway service create backend
```

### Step 2: Link to Backend Directory

```powershell
cd backend
railway link
```

Choose the service: **backend**

### Step 3: Add PostgreSQL Database

From Railway Dashboard or CLI:

```powershell
railway add --database postgres
```

Railway will automatically:
- Create a PostgreSQL instance
- Generate `DATABASE_URL` environment variable
- Link it to your backend service

### Step 4: Set Environment Variables

```powershell
# JWT Secret (generate a strong one)
railway variables set JWT_SECRET="$(openssl rand -base64 32)"

# JWT Expiry
railway variables set JWT_EXPIRES_IN="7d"

# Node Environment
railway variables set NODE_ENV="production"

# Port (Railway sets this automatically, but confirm)
railway variables set PORT="5000"
```

**Important:** Do NOT set `DATABASE_URL` - Railway injects this automatically.

### Step 5: Set CORS Origin (after frontend deployment)

After deploying frontend, update this:

```powershell
railway variables set CORS_ORIGIN="https://your-frontend-url.up.railway.app"
```

### Step 6: Deploy Backend

```powershell
# From backend directory
railway up
```

Railway will:
1. Install dependencies (`npm install`)
2. Generate Prisma Client (`npx prisma generate`)
3. Build TypeScript (`npm run build`)
4. Run migrations (`npx prisma migrate deploy`)
5. Start server (`npm start`)

### Step 7: Get Backend URL

```powershell
railway domain
```

Or check Railway Dashboard. Your backend URL will be:
```
https://backend-production-xxxx.up.railway.app
```

---

## 🎨 Frontend Deployment

### Step 1: Create Frontend Service

```powershell
cd ../frontend
railway service create frontend
```

### Step 2: Link to Frontend Service

```powershell
railway link
```

Choose the service: **frontend**

### Step 3: Set Environment Variables

```powershell
# Backend API URL (use the URL from previous step)
railway variables set VITE_API_URL="https://backend-production-xxxx.up.railway.app/api"

# Environment
railway variables set VITE_ENV="production"
```

### Step 4: Deploy Frontend

```powershell
railway up
```

Railway will:
1. Install dependencies (`npm install`)
2. Build for production (`npm run build`)
3. Start preview server (`npm run preview`)

### Step 5: Generate Public Domain

```powershell
railway domain
```

Your frontend will be accessible at:
```
https://frontend-production-xxxx.up.railway.app
```

---

## 🗄️ Database Setup

### Automatic Migration

The backend `railway.json` includes `npx prisma migrate deploy` in the start command, so migrations run automatically on each deployment.

### Manual Migration (if needed)

```powershell
cd backend
railway run npx prisma migrate deploy
```

### Seed Initial Data

```powershell
cd backend
railway run npm run seed
```

This will:
- Create **76 inventory items** (motors, brackets, chains, clips, accessories)
- Set up pricing matrix
- Create initial admin user (if configured)

### Database Console

Access PostgreSQL directly:

```powershell
railway run psql $DATABASE_URL
```

Or use Railway Dashboard → Database → Connect → Data tab.

---

## 🔐 Environment Variables

### Backend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Auto-injected by Railway |
| `JWT_SECRET` | Secret for JWT tokens | Generated via `openssl rand -base64 32` |
| `JWT_EXPIRES_IN` | Token expiration | `7d` |
| `CORS_ORIGIN` | Frontend URL for CORS | `https://frontend-production-xxxx.up.railway.app` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port | `5000` (auto-set by Railway) |

### Frontend Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API endpoint | `https://backend-production-xxxx.up.railway.app/api` |
| `VITE_ENV` | Environment | `production` |

### Setting Variables via Dashboard

1. Go to Railway Dashboard
2. Select your project
3. Click on service (backend or frontend)
4. Go to **Variables** tab
5. Click **+ New Variable**
6. Add key-value pairs

---

## 🔄 Post-Deployment Steps

### 1. Update Backend CORS

After frontend is deployed, update backend CORS:

```powershell
cd backend
railway variables set CORS_ORIGIN="https://your-actual-frontend-url.up.railway.app"
```

Then redeploy:

```powershell
railway up
```

### 2. Create Admin User

```powershell
cd backend
railway run npm run create:admin
```

Default credentials:
- Email: `admin@signatureshades.com`
- Password: `Admin@123`

**⚠️ Change password immediately after first login!**

### 3. Test the Application

1. Visit frontend URL
2. Login with admin credentials
3. Change admin password
4. Create a test order
5. Verify quote creation works
6. Check inventory management (admin only)

### 4. Set Up Custom Domains (Optional)

In Railway Dashboard:
1. Go to service settings
2. Click **Generate Domain**
3. Or add your own custom domain

---

## 🐛 Troubleshooting

### Build Failures

**Problem:** Backend fails during `npx prisma generate`

**Solution:**
```powershell
# Check build logs
railway logs --build

# Verify DATABASE_URL is set
railway variables

# Manually run Prisma generate
railway run npx prisma generate
```

### Migration Errors

**Problem:** `prisma migrate deploy` fails

**Solution:**
```powershell
# Check if database is accessible
railway run psql $DATABASE_URL

# Reset database (⚠️ deletes all data)
railway run npx prisma migrate reset

# Re-run migrations
railway run npx prisma migrate deploy
```

### CORS Errors

**Problem:** Frontend can't connect to backend

**Solution:**
1. Verify `CORS_ORIGIN` matches **exact** frontend URL (including https://)
2. Update backend environment variable
3. Redeploy backend

```powershell
cd backend
railway variables set CORS_ORIGIN="https://correct-frontend-url.up.railway.app"
railway up
```

### Frontend 404 Errors

**Problem:** Routes don't work on refresh

**Solution:** Add to `vite.config.ts`:
```typescript
export default defineConfig({
  // ... other config
  preview: {
    port: 5000,
    strictPort: true
  }
})
```

### Environment Variables Not Loading

**Problem:** App can't find env variables

**Solution:**
```powershell
# List all variables
railway variables

# Verify they're set correctly
railway run env

# Re-set missing variables
railway variables set KEY="value"
```

### Logs

View real-time logs:

```powershell
# Backend logs
cd backend
railway logs

# Frontend logs
cd frontend
railway logs

# Database logs
railway logs --service postgres
```

---

## 🔧 Maintenance

### Redeploying After Changes

1. **Commit changes to railway-prod branch:**
   ```powershell
   git add .
   git commit -m "Update: description"
   git push origin railway-prod
   ```

2. **Redeploy backend:**
   ```powershell
   cd backend
   railway up
   ```

3. **Redeploy frontend:**
   ```powershell
   cd frontend
   railway up
   ```

### Rolling Back

```powershell
# View deployment history
railway deployments

# Rollback to specific deployment
railway rollback <deployment-id>
```

### Scaling

In Railway Dashboard:
1. Go to service settings
2. Click **Resources**
3. Adjust:
   - Memory limit
   - CPU limit
   - Replicas (for high availability)

### Monitoring

- **Railway Dashboard:** Real-time metrics (CPU, memory, network)
- **Logs:** `railway logs` for debugging
- **Database:** Monitor query performance in Railway DB tab

### Backup Database

```powershell
# Export database dump
railway run pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore from backup
railway run psql $DATABASE_URL < backup_20260211.sql
```

---

## 📊 Service Architecture

```
┌─────────────────────────────────────────────┐
│         Railway Project                     │
│                                             │
│  ┌──────────────┐      ┌──────────────┐    │
│  │   Frontend   │      │   Backend    │    │
│  │   (Vite)     │◄────►│  (Express)   │    │
│  │   Port 5000  │      │  Port 5000   │    │
│  └──────────────┘      └───────┬──────┘    │
│                                 │           │
│                        ┌────────▼────────┐  │
│                        │   PostgreSQL    │  │
│                        │   Database      │  │
│                        └─────────────────┘  │
└─────────────────────────────────────────────┘
```

---

## 🔗 Useful Commands

```powershell
# Check current project/service
railway status

# View environment variables
railway variables

# Open Railway dashboard
railway open

# View logs (live)
railway logs --follow

# Connect to database
railway connect postgres

# Run command in Railway environment
railway run <command>

# Switch between services
railway service

# Deploy from current directory
railway up

# Show deployment history
railway deployments
```

---

## 📞 Support

- **Railway Docs:** [docs.railway.app](https://docs.railway.app)
- **Railway Discord:** [discord.gg/railway](https://discord.gg/railway)
- **Prisma Docs:** [prisma.io/docs](https://www.prisma.io/docs)

---

## ✅ Deployment Checklist

Use this checklist for each deployment:

- [ ] Branch: `railway-prod`
- [ ] Railway CLI installed
- [ ] Logged into Railway (`railway login`)
- [ ] Project initialized (`railway init`)
- [ ] Backend service created
- [ ] PostgreSQL database added
- [ ] Backend environment variables set (JWT_SECRET, etc.)
- [ ] Backend deployed (`railway up`)
- [ ] Backend URL noted
- [ ] Frontend service created
- [ ] Frontend environment variables set (VITE_API_URL)
- [ ] Frontend deployed (`railway up`)
- [ ] Frontend URL noted
- [ ] Backend CORS updated with frontend URL
- [ ] Backend redeployed
- [ ] Database migrations run
- [ ] Initial data seeded
- [ ] Admin user created
- [ ] Application tested
- [ ] Admin password changed

---

**🎉 Congratulations!** Your Signature Shades Order Management System is now live on Railway!
