# Migration Prompts for Google Antigravity IDE - Claude Sonnet 4.5

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Current SAP Warehouse Management System codebase open in IDE
- ✅ Migration Strategy document (MIGRATION_STRATEGY.md)
- ✅ HTML Order System file (blinds-order-system-final.html)
- ✅ Database backup completed
- ✅ New Git branch created: `feature/order-system-integration`

---

## 🎯 STEP 1: Backend Foundation & Database Migration

### Context Files to Provide
Upload these files to the IDE before prompting:
1. `MIGRATION_STRATEGY.md` (the migration strategy document)
2. `blinds-order-system-final.html` (the new order system)
3. `backend/prisma/schema.prisma` (current database schema)
4. `backend/src/server.ts` (current backend entry point)
5. `backend/package.json` (current dependencies)

### Prompt for Step 1

```
I need to implement Phase 1 of the order system migration as outlined in the MIGRATION_STRATEGY.md document. This is a React + TypeScript + Express + Prisma PostgreSQL application.

CONTEXT:
- Current system: Excel-based order input with no authentication
- New requirement: Web-based order system with user authentication and role-based access
- I've uploaded the HTML order system prototype that needs to be converted to React
- The migration strategy document has the complete plan

TASK FOR STEP 1: Backend Foundation & Database Migration

Please implement the following in order:

1. DATABASE SCHEMA UPDATES:
   - Update backend/prisma/schema.prisma to add:
     * User model (id, name, email, password, phone, company, address, role, isActive, timestamps)
     * Enhanced Order model with new fields (orderNumber, userId, productType, status, customer info, timestamps)
     * OrderItem model (all blind/curtain fields as specified in migration doc)
     * PricingMatrix model (fabricGroup, width, drop, price)
     * Quote model (for quick quote feature)
   - Add necessary enums: UserRole (CUSTOMER, ADMIN), OrderStatus (PENDING, CONFIRMED, PRODUCTION, COMPLETED, CANCELLED), ProductType (BLINDS, CURTAINS, SHUTTERS)
   - Add proper indexes and relations
   - Ensure backward compatibility with existing Order/Inventory models

2. INSTALL REQUIRED DEPENDENCIES:
   - Add to backend/package.json:
     * bcryptjs & @types/bcryptjs (password hashing)
     * jsonwebtoken & @types/jsonwebtoken (JWT auth)
     * express-validator (input validation)
   - Create installation commands

3. AUTHENTICATION SYSTEM:
   - Create backend/src/middleware/auth.ts:
     * authenticateToken middleware (verify JWT)
     * requireRole middleware (check user role)
     * Error handling for expired/invalid tokens
   
   - Create backend/src/controllers/auth.controller.ts:
     * register() - Create new customer account with password hashing
     * login() - Validate credentials, return JWT token
     * logout() - Invalidate token
     * getCurrentUser() - Get authenticated user details
     * refreshToken() - Refresh expired token
   
   - Create backend/src/routes/authRoutes.ts:
     * POST /api/auth/register
     * POST /api/auth/login
     * POST /api/auth/logout
     * GET /api/auth/me
     * POST /api/auth/refresh

4. ORDER MANAGEMENT API:
   - Create backend/src/controllers/order.controller.ts (NEW, separate from existing):
     * createOrder() - Create order from customer (status: PENDING)
     * getMyOrders() - Get current user's orders
     * getOrderById() - Get single order with items
     * updateOrderStatus() - Admin only: update status
     * getAllOrders() - Admin only: get all orders with filters
     * approveOrder() - Admin only: change PENDING → CONFIRMED
     * sendToProduction() - Admin only: change CONFIRMED → PRODUCTION, generate worksheets
     * cancelOrder() - Cancel order
   
   - Create backend/src/routes/orderRoutes.ts (NEW):
     * POST /api/orders/create
     * GET /api/orders/my-orders
     * GET /api/orders/:id
     * PATCH /api/orders/:id/status (admin)
     * DELETE /api/orders/:id
     * GET /api/admin/orders (admin)
     * POST /api/admin/orders/:id/approve (admin)
     * POST /api/admin/orders/:id/send-to-production (admin)

5. PRICING MANAGEMENT API:
   - Create backend/src/services/pricing.service.ts:
     * calculatePrice(item) - Calculate price based on width/drop/fabric group
     * getFabricGroup(fabricType) - Determine fabric group (1-5)
     * getDiscountByGroup(group) - Return discount % (G1:20%, G2:25%, G3:30%)
     * getNearestPrice(group, width, drop) - Get price from matrix
     * roundToTier(value, tiers) - Round to nearest pricing tier
   
   - Create backend/src/controllers/pricing.controller.ts:
     * getPricingMatrix(fabricGroup) - Get pricing for group
     * updatePricingMatrix(fabricGroup, data) - Update pricing (admin)
     * calculateItemPrice(item) - Calculate single item price
   
   - Create backend/src/routes/pricingRoutes.ts:
     * GET /api/pricing/:fabricGroup
     * PUT /api/pricing/:fabricGroup (admin)
     * POST /api/pricing/calculate

6. USER MANAGEMENT API (ADMIN):
   - Create backend/src/controllers/user.controller.ts:
     * createCustomer() - Admin creates customer account
     * getAllUsers() - Admin gets all users
     * getUserById() - Get user details
     * updateUser() - Update user info
     * deactivateUser() - Soft delete user
   
   - Create backend/src/routes/userRoutes.ts:
     * POST /api/admin/users (admin)
     * GET /api/admin/users (admin)
     * GET /api/admin/users/:id (admin)
     * PATCH /api/admin/users/:id (admin)
     * DELETE /api/admin/users/:id (admin)

7. PRICING DATA SEEDING:
   - Create backend/prisma/seeds/pricing-data.ts:
     * Extract ALL pricing matrix data from blinds-order-system-final.html (lines ~1020-1082)
     * Create seed function to populate PricingMatrix table
     * Support for all 5 fabric groups
   
   - Create backend/prisma/seed-pricing.ts:
     * Import and execute pricing data seeding
     * Add to package.json: "seed:pricing" script

8. UPDATE SERVER CONFIGURATION:
   - Update backend/src/server.ts:
     * Import and mount new routes: authRoutes, orderRoutes, pricingRoutes, userRoutes
     * Add JWT_SECRET to environment validation
     * Keep existing routes (inventory, worksheet generation)
   
   - Update backend/.env.example:
     * Add JWT_SECRET=your-secret-key-here
     * Add JWT_EXPIRES_IN=7d
     * Add BCRYPT_ROUNDS=10

9. CREATE MIGRATION:
   - Generate Prisma migration: `npx prisma migrate dev --name add_order_system`
   - Create migration validation script to ensure no data loss

10. CREATE INITIAL ADMIN USER SCRIPT:
    - Create backend/scripts/create-admin.ts:
      * Create default admin user (admin@signatureshades.com / Admin@123)
      * Check if admin exists first (idempotent)
    - Add npm script: "create:admin"

IMPORTANT REQUIREMENTS:
- Keep ALL existing functionality intact (Excel upload, inventory management, worksheet generation)
- Use TypeScript with proper types for all new code
- Follow existing code structure and naming conventions
- Add proper error handling with try-catch blocks
- Use Prisma transactions for multi-step operations
- Add input validation using express-validator
- Include JSDoc comments for all functions
- Follow REST API best practices

OUTPUT STRUCTURE:
Please provide:
1. Updated prisma/schema.prisma file
2. All new controller files
3. All new service files
4. All new route files
5. All new middleware files
6. Updated server.ts
7. Pricing seed data file
8. Migration commands to run
9. Testing curl commands for each endpoint

After completing this, I'll proceed to Step 2 (Frontend React Components).
```

---

## 🎯 STEP 2: Frontend React Components & UI

### Context Files to Provide
Upload these files to the IDE before prompting:
1. Output files from Step 1 (all backend files created)
2. `frontend/src/App.tsx` (current app structure)
3. `frontend/src/services/api.ts` (current API client)
4. `frontend/package.json` (current dependencies)
5. `frontend/tailwind.config.js` (current styling config)
6. `MIGRATION_STRATEGY.md` (reference)
7. `blinds-order-system-final.html` (for UI/UX reference)

### Prompt for Step 2

```
I need to implement Phase 2 of the order system migration - Frontend React Components. The backend from Step 1 is complete and working.

CONTEXT:
- Backend APIs are ready: Auth, Orders, Pricing, Users (all endpoints tested)
- Current frontend: React 18 + TypeScript + Vite + Tailwind CSS
- Need to convert HTML order system (blinds-order-system-final.html) to React components
- Must maintain existing warehouse management UI (inventory, Excel upload)

TASK FOR STEP 2: Frontend React Components & Authentication

Please implement the following in order:

1. INSTALL REQUIRED DEPENDENCIES:
   - Add to frontend/package.json:
     * react-router-dom (routing)
     * @tanstack/react-query (API state management & caching)
     * react-hook-form (form handling)
     * zod (form validation)
     * @hookform/resolvers (React Hook Form + Zod integration)
     * jwt-decode (decode JWT tokens)
   - Create installation commands

2. AUTHENTICATION CONTEXT:
   - Create frontend/src/contexts/AuthContext.tsx:
     * AuthProvider component with global auth state
     * State: user (User | null), isAuthenticated (boolean), isAdmin (boolean)
     * Functions: login(email, password), logout(), register(userData), refreshToken()
     * Store JWT in localStorage
     * Auto-load user on app mount
     * Auto-refresh token before expiry
   
   - Create frontend/src/types/auth.ts:
     * User interface (id, name, email, role, company, etc.)
     * LoginCredentials interface
     * RegisterData interface
     * AuthContextType interface

3. UPDATE API CLIENT:
   - Update frontend/src/services/api.ts:
     * Add JWT token interceptor (add token to all requests)
     * Add response interceptor (handle 401 errors → redirect to login)
     * Add refresh token logic
   
   - Create frontend/src/services/authApi.ts:
     * login(credentials)
     * register(data)
     * logout()
     * getCurrentUser()
     * refreshToken()
   
   - Create frontend/src/services/orderApi.ts:
     * createOrder(orderData)
     * getMyOrders(filters?)
     * getOrderById(id)
     * cancelOrder(id)
     * getAllOrders(filters?) - admin
     * approveOrder(id) - admin
     * sendToProduction(id) - admin
     * updateOrderStatus(id, status) - admin
   
   - Create frontend/src/services/pricingApi.ts:
     * getPricingMatrix(fabricGroup)
     * updatePricingMatrix(fabricGroup, data) - admin
     * calculatePrice(itemData)
   
   - Create frontend/src/services/userApi.ts:
     * createCustomer(userData) - admin
     * getAllUsers() - admin
     * getUserById(id) - admin
     * updateUser(id, data) - admin
     * deactivateUser(id) - admin

4. AUTHENTICATION COMPONENTS:
   - Create frontend/src/components/auth/LoginForm.tsx:
     * Email + Password form
     * Form validation with Zod
     * Error handling
     * Redirect to dashboard on success
     * "Register" link
   
   - Create frontend/src/components/auth/RegisterForm.tsx:
     * Full name, company (optional), email, phone, address, password
     * Password confirmation field
     * Form validation
     * Redirect to login on success
     * "Login" link
   
   - Create frontend/src/components/auth/ProtectedRoute.tsx:
     * HOC to protect routes
     * Check authentication
     * Check role (customer/admin)
     * Redirect to login if unauthorized

5. ROUTING STRUCTURE:
   - Update frontend/src/App.tsx:
     * Wrap with AuthProvider
     * Wrap with QueryClientProvider (React Query)
     * Add React Router with routes:
       - / → Public landing (redirect to /login or /dashboard based on auth)
       - /login → LoginForm
       - /register → RegisterForm
       - /dashboard → Customer Dashboard (protected)
       - /orders/new → New Order Form (protected)
       - /orders/my-orders → My Orders (protected)
       - /orders/quotes → Quick Quote (protected)
       - /admin → Admin Dashboard (protected, admin only)
       - /admin/orders → Order Management (protected, admin only)
       - /admin/users → User Management (protected, admin only)
       - /admin/pricing → Pricing Management (protected, admin only)
       - /admin/inventory → Existing Inventory (keep as is)
       - /admin/upload → Excel Upload (keep as is, admin only)

6. ORDER FORM COMPONENTS (Convert from HTML):
   - Create frontend/src/types/order.ts:
     * BlindItem interface (all 16 fields)
     * CurtainItem interface
     * ShutterItem interface
     * Order interface
     * OrderStatus enum
     * ProductType enum
   
   - Create frontend/src/components/orders/BlindItemForm.tsx:
     * Single blind item form with all fields:
       - Location, Width (mm), Drop (mm)
       - Fixing, Bracket Type, Bracket Colour
       - Control Side, Chain or Motor
       - Roll, Material (dropdown), Fabric Type (dynamic dropdown), Fabric Colour (dynamic dropdown)
       - Bottom Rail Type, Bottom Rail Colour
       - Discount % (read-only badge, auto-calculated)
       - Price (read-only, auto-calculated)
     * Real-time price calculation on width/drop change
     * Copy item button
     * Remove item button
     * Extract fabric data from HTML file (lines 1700-2500):
       - Material options: Gracetech, Textstyle, Uniline, Vertex
       - Fabric types per material (hierarchical)
       - Fabric colours per type (hierarchical)
   
   - Create frontend/src/components/orders/CurtainItemForm.tsx:
     * Curtain-specific fields based on HTML
   
   - Create frontend/src/components/orders/ShutterItemForm.tsx:
     * Shutter-specific fields based on HTML

7. NEW ORDER PAGE:
   - Create frontend/src/pages/customer/NewOrder.tsx:
     * Product type selector (Blinds/Curtains/Shutters)
     * Order date (default: today)
     * Date required by (date picker)
     * Dynamic item forms (add/remove items)
     * "Add Another Item" button
     * Additional notes textarea
     * Order summary card:
       - Total items count
       - Subtotal
       - Total discount
       - Grand total
     * "Submit Order" button → Creates order with PENDING status
     * Success message → Redirect to My Orders
     * Follow exact UI structure from HTML file

8. MY ORDERS PAGE:
   - Create frontend/src/pages/customer/MyOrders.tsx:
     * Filter tabs: All, Pending, Confirmed, Production, Completed
     * Order cards showing:
       - Order number
       - Order date
       - Date required
       - Product type badge
       - Status badge (color-coded)
       - Total amount
       - Item count
     * Click to expand order details
     * View items list
     * Cancel button (only for PENDING orders)
     * Pagination (20 per page)

9. QUICK QUOTE PAGE:
   - Create frontend/src/pages/customer/QuickQuote.tsx:
     * Similar to New Order but without date fields
     * Real-time price calculation
     * "Save Quote" button
     * "Convert to Order" button
     * Quote expiry indicator (30 days)
     * List of saved quotes

10. ADMIN ORDER MANAGEMENT:
    - Create frontend/src/pages/admin/OrderManagement.tsx:
      * Product type filter tabs (All/Blinds/Curtains/Shutters)
      * Status filter tabs (All/Pending/Confirmed/Production/Completed)
      * Order table with:
        - Order number
        - Customer name + company
        - Product type
        - Date required
        - Total amount
        - Status
        - Actions (View/Approve/Send to Production/Cancel)
      * Click row to view full order details
      * Approve button → Change PENDING to CONFIRMED
      * "Send to Production" button → Change CONFIRMED to PRODUCTION + generate worksheets (reuse existing logic)
      * Search by order number or customer name
      * Date range filter

11. ADMIN USER MANAGEMENT:
    - Create frontend/src/pages/admin/UserManagement.tsx:
      * "Create New Customer" form section:
        - Name, email, phone, company (optional), address, password
        - "Create Account" button
      * Users table:
        - Name, Email, Company, Phone, Role, Status (Active/Inactive)
        - Actions: Edit, Deactivate/Activate
      * Search users by name/email
      * Filter by status

12. ADMIN PRICING MANAGEMENT:
    - Create frontend/src/pages/admin/PricingManagement.tsx:
      * Fabric group selector (Group 1-5)
      * Editable pricing table:
        - Rows: Width tiers (600-3000mm)
        - Columns: Drop tiers (1200-3000mm)
        - Editable price cells
      * "Save Changes" button
      * "Reset to Defaults" button
      * "Export to CSV" button
      * Auto-save indicator

13. UPDATE NAVIGATION:
    - Create frontend/src/components/layout/Navbar.tsx:
      * Logo
      * Navigation links (based on user role):
        - Customer: Dashboard, New Order, My Orders, Quick Quote
        - Admin: Dashboard, Orders, Users, Pricing, Inventory, Upload
      * User menu dropdown:
        - User name + email
        - Logout button
   
    - Update frontend/src/components/Layout.tsx:
      * Use new Navbar
      * Keep existing layout structure

14. UPDATE HOME PAGE:
    - Update frontend/src/pages/Home.tsx:
      * If authenticated → Redirect to /dashboard
      * If not authenticated → Show landing page with Login/Register buttons

15. STYLING & UX:
    - Use existing Tailwind configuration
    - Match color scheme from HTML file:
      * Primary gradient: #667eea to #764ba2
      * Header gradient: #1e3c72 to #2a5298
    - Add loading spinners for API calls
    - Add toast notifications for success/error messages
    - Add form validation error messages
    - Mobile-responsive design

IMPORTANT REQUIREMENTS:
- Keep ALL existing pages (InventoryDashboard, OrderUpload) working
- Use React Hook Form for all forms (better performance)
- Use React Query for API state management (caching, optimistic updates)
- Follow existing component structure
- Use TypeScript with proper interfaces
- Add proper error boundaries
- Add loading states for all async operations
- Add empty states (no orders, no users, etc.)
- Add confirmation dialogs for destructive actions (delete, cancel)

OUTPUT STRUCTURE:
Please provide:
1. All new page components
2. All new form components
3. All new API service files
4. Updated App.tsx with routing
5. Updated Layout.tsx
6. AuthContext.tsx
7. All TypeScript interfaces
8. Updated package.json with new dependencies
9. Brief testing instructions for each new page

After completing this, I'll proceed to Step 3 (Pricing Integration & Testing).
```

---

## 🎯 STEP 3: Pricing Integration, Data Migration & Testing

### Context Files to Provide
Upload these files to the IDE before prompting:
1. All backend files from Step 1
2. All frontend files from Step 2
3. `backend/prisma/schema.prisma` (updated schema)
4. `blinds-order-system-final.html` (for fabric/pricing data reference)
5. `MIGRATION_STRATEGY.md` (reference)

### Prompt for Step 3

```
I need to implement Phase 3-5 of the order system migration: Pricing Integration, Data Migration, and Comprehensive Testing.

CONTEXT:
- Backend APIs are complete and tested (Step 1 ✅)
- Frontend React components are complete and working (Step 2 ✅)
- Need to integrate pricing engine with real data
- Need to migrate existing data (if any)
- Need to create comprehensive test suite

TASK FOR STEP 3: Pricing Engine, Data Migration & Testing

Please implement the following in order:

1. EXTRACT & SEED PRICING DATA:
   - Extract complete pricing matrix from blinds-order-system-final.html:
     * Locate pricing data (around lines 1020-1082)
     * Extract all 5 fabric groups (G1, G2, G3, G4, G5)
     * Width tiers: 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000 (mm)
     * Drop tiers: 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000 (mm)
     * Create structured JSON pricing data
   
   - Create backend/prisma/seeds/pricing-data.json:
     * Store all pricing in structured format
   
   - Update backend/prisma/seed.ts:
     * Import pricing data
     * Seed PricingMatrix table
     * Add idempotency (check if already seeded)
     * Add verbose logging
   
   - Create npm script to run: `npm run seed:pricing`

2. EXTRACT & MAP FABRIC/MATERIAL DATA:
   - Extract fabric data hierarchy from HTML (lines ~1700-2500):
     * Material brands: Gracetech, Textstyle, Uniline, Vertex
     * Fabric types per brand (e.g., Gracetech → Vintage, Sunscreen, Blockout, etc.)
     * Fabric colours per type
     * Fabric group assignment (G1-G5)
   
   - Create frontend/src/data/fabrics.ts:
     * Export fabric hierarchy as TypeScript constants
     * Structure: Material → Fabric Type → Colours → Group
     * Example:
       ```typescript
       export const FABRICS = {
         Gracetech: {
           Vintage: { 
             colours: ['Pearl', 'Linen', ...],
             group: 3
           },
           Sunscreen: {
             colours: ['Charcoal', 'Grey', ...],
             group: 2
           }
         }
       }
       ```
   
   - Create helper functions:
     * getFabricTypes(material): Return fabric types for material
     * getFabricColours(material, fabricType): Return colours
     * getFabricGroup(material, fabricType): Return group (1-5)

3. IMPLEMENT PRICING CALCULATION LOGIC:
   - Update backend/src/services/pricing.service.ts:
     * Add fabric-to-group mapping logic
     * Implement tier rounding:
       - Width: Round to nearest tier (600, 800, ..., 3000)
       - Drop: Round to nearest tier (1200, 1400, ..., 3000)
       - If between tiers, round UP for fairness
     * Add interpolation for missing tiers (if needed)
     * Add validation: Min width 600mm, Max width 3000mm, Min drop 1200mm, Max drop 3000mm
   
   - Create backend/src/services/discount.service.ts:
     * getDiscountByGroup(group): Return discount %
       - G1 → 20%
       - G2 → 25%
       - G3 → 30%
       - G4 → 0%
       - G5 → 0%
     * calculateDiscountedPrice(basePrice, group): Return final price
   
   - Update frontend/src/components/orders/BlindItemForm.tsx:
     * Integrate fabric hierarchy data
     * Material dropdown → populates Fabric Type dropdown
     * Fabric Type dropdown → populates Fabric Colour dropdown
     * Auto-set fabric group when fabric type selected
     * Auto-calculate discount % when group determined
     * Call pricing API on width/drop/fabric change
     * Debounce price calculation (300ms)
     * Show loading spinner during calculation
     * Show error if calculation fails

4. DATA MIGRATION SCRIPTS:
   - Create backend/scripts/migrate-existing-data.ts:
     * Create default admin user if not exists:
       - Email: admin@signatureshades.com
       - Password: Admin@2026
       - Name: System Administrator
       - Role: ADMIN
     * Check for existing orders in old format
     * If found, migrate to new format:
       - Create system user for old orders
       - Set status to COMPLETED
       - Add note: "Migrated from Excel system"
     * Preserve all inventory data
     * Create transaction log
   
   - Create npm script: `npm run migrate:data`

5. BACKWARD COMPATIBILITY - KEEP EXCEL UPLOAD:
   - Update frontend/src/pages/admin/OrderUpload.tsx:
     * Add notice: "Legacy Excel Upload - For existing workflows"
     * Keep all existing functionality
     * After upload, show option to "Convert to New Order Format"
   
   - Create backend/src/services/excelToOrder.service.ts:
     * convertExcelToOrder(excelData): Transform Excel data to new Order format
     * Map Excel fields to new structure
     * Auto-assign to admin user
     * Set status to CONFIRMED (skip approval)
     * Add note: "Created from Excel upload"

6. COMPREHENSIVE TESTING SUITE:
   - Create backend/tests/auth.test.ts:
     * Test user registration (success, duplicate email, validation errors)
     * Test login (success, wrong password, non-existent user)
     * Test JWT token generation
     * Test token refresh
     * Test protected routes (with/without token, expired token)
   
   - Create backend/tests/orders.test.ts:
     * Test order creation (customer)
     * Test order approval (admin)
     * Test order status transitions
     * Test get my orders (filtering, pagination)
     * Test get all orders (admin, filtering)
     * Test send to production (worksheet generation)
   
   - Create backend/tests/pricing.test.ts:
     * Test price calculation for all fabric groups
     * Test tier rounding logic
     * Test discount application
     * Test pricing matrix CRUD
   
   - Create backend/tests/inventory.test.ts:
     * Test inventory deduction when order sent to production
     * Test low stock alerts
     * Test inventory insufficient scenario
   
   - Create frontend/tests/Login.test.tsx:
     * Test login form validation
     * Test login success flow
     * Test login error handling
   
   - Create frontend/tests/OrderForm.test.tsx:
     * Test form validation
     * Test price calculation
     * Test add/remove items
     * Test order submission

7. INTEGRATION TESTING SCENARIOS:
   - Create backend/tests/integration/order-workflow.test.ts:
     * Full workflow test:
       1. Customer registers
       2. Customer logs in
       3. Customer creates order with 3 blinds
       4. Verify order status = PENDING
       5. Admin logs in
       6. Admin approves order
       7. Verify status = CONFIRMED
       8. Admin sends to production
       9. Verify worksheets generated
       10. Verify inventory deducted
       11. Verify status = PRODUCTION
   
   - Create test data sets:
     * Sample customer users (5 users)
     * Sample orders (10 orders, various statuses)
     * Sample pricing adjustments

8. PERFORMANCE TESTING:
   - Create backend/tests/performance/pricing.perf.ts:
     * Test price calculation speed (should be < 100ms)
     * Test bulk price calculations (100 items)
   
   - Create backend/tests/performance/orders.perf.ts:
     * Test order creation with 50 items
     * Test get all orders with 1000+ orders
     * Test pagination performance

9. ERROR HANDLING & VALIDATION:
   - Add comprehensive validation to all API endpoints:
     * Order creation: All required fields, valid dates, valid measurements
     * Pricing update: Valid ranges, positive numbers
     * User creation: Email format, password strength, required fields
   
   - Create custom error responses:
     * 400: Bad Request (validation errors)
     * 401: Unauthorized (not logged in)
     * 403: Forbidden (insufficient permissions)
     * 404: Not Found
     * 409: Conflict (duplicate email, etc.)
     * 500: Internal Server Error
   
   - Add error logging:
     * Use Winston logger
     * Log all errors with stack traces
     * Log API requests/responses in development

10. ENVIRONMENT CONFIGURATION:
    - Update backend/.env.example:
      ```env
      # Database
      DATABASE_URL="postgresql://user:password@localhost:5432/signatureshades"
      
      # JWT
      JWT_SECRET="your-super-secret-jwt-key-change-in-production"
      JWT_EXPIRES_IN="7d"
      BCRYPT_ROUNDS=10
      
      # Server
      PORT=5000
      NODE_ENV=development
      
      # CORS
      ALLOWED_ORIGINS="http://localhost:3000"
      ```
    
    - Create .env.production.example
    
    - Add environment validation in server.ts

11. DOCKER UPDATES:
    - Update docker-compose.yml:
      * Add JWT_SECRET environment variable
      * Ensure database migrations run on startup
      * Add health checks
    
    - Update Dockerfile if needed

12. DOCUMENTATION:
    - Create backend/API.md:
      * Document all new endpoints
      * Request/response examples
      * Authentication requirements
      * Error responses
    
    - Create TESTING.md:
      * How to run tests
      * Test coverage requirements
      * Manual testing checklist
    
    - Update README.md:
      * New features section
      * Updated setup instructions
      * Environment variables list
      * API documentation link

13. DEPLOYMENT PREPARATION:
    - Create deployment checklist:
      * [ ] Database backup completed
      * [ ] Migrations tested on staging
      * [ ] Environment variables configured
      * [ ] JWT secret generated (strong)
      * [ ] Pricing data seeded
      * [ ] Admin user created
      * [ ] All tests passing
      * [ ] Performance benchmarks met
      * [ ] Error monitoring configured
    
    - Create rollback plan:
      * Database rollback script
      * Git revert instructions
      * Downtime estimation

14. MANUAL TESTING CHECKLIST:
    Create detailed manual test cases:
    
    **Customer Flow:**
    - [ ] Register new account
    - [ ] Login with new account
    - [ ] Create order with 1 blind
    - [ ] Create order with 5 blinds (different fabrics)
    - [ ] Verify pricing calculations
    - [ ] View my orders
    - [ ] Create quick quote
    - [ ] Convert quote to order
    - [ ] Cancel pending order
    - [ ] Logout
    
    **Admin Flow:**
    - [ ] Login as admin
    - [ ] View all orders (filter by status)
    - [ ] View all orders (filter by product type)
    - [ ] View pending orders
    - [ ] Approve pending order
    - [ ] Send confirmed order to production
    - [ ] Verify worksheets generated
    - [ ] Verify inventory deducted
    - [ ] Create new customer account
    - [ ] View all users
    - [ ] Edit user details
    - [ ] Deactivate user
    - [ ] View pricing matrix
    - [ ] Edit pricing for Group 1
    - [ ] Save pricing changes
    - [ ] Export pricing to CSV
    - [ ] Upload Excel order (legacy)
    - [ ] Verify Excel order converted properly
    - [ ] View inventory
    - [ ] Logout
    
    **Edge Cases:**
    - [ ] Login with wrong password
    - [ ] Create order with very large dimensions (>3000mm)
    - [ ] Create order with very small dimensions (<600mm)
    - [ ] Try to approve order as customer (should fail)
    - [ ] Try to access admin routes as customer (should fail)
    - [ ] Create order with insufficient inventory
    - [ ] Test token expiration
    - [ ] Test concurrent order creation
    - [ ] Test mobile responsiveness

IMPORTANT REQUIREMENTS:
- All tests must pass (100% of critical paths)
- API response time < 500ms for all endpoints
- Frontend load time < 3 seconds
- Support 100+ concurrent users
- Zero data loss during migration
- Complete error handling on all endpoints
- All forms have proper validation
- All async operations have loading states
- All destructive actions have confirmation dialogs

OUTPUT STRUCTURE:
Please provide:
1. Pricing seed data file (pricing-data.json)
2. Fabric hierarchy data (fabrics.ts)
3. Updated pricing.service.ts with complete logic
4. All test files (unit + integration)
5. Migration script (migrate-existing-data.ts)
6. Updated documentation (API.md, TESTING.md, README.md)
7. Environment configuration files
8. Deployment checklist
9. Manual testing checklist
10. Commands to run for final deployment:
    - Database migration commands
    - Seed commands
    - Test commands
    - Build commands
    - Docker commands

FINAL VERIFICATION:
After completion, please verify:
✅ All tests passing
✅ Pricing calculations accurate for all groups
✅ Order workflow complete (customer create → admin approve → production → worksheets)
✅ Inventory deduction working
✅ Excel upload still works (backward compatibility)
✅ All existing features still functional
✅ No console errors in browser
✅ No TypeScript errors
✅ Mobile responsive
✅ Documentation complete

Once verified, the system is ready for production deployment! 🚀
```

---

## 📦 Files to Attach to Each Step

### For Step 1 (Backend):
```
📎 Attachments:
1. MIGRATION_STRATEGY.md
2. blinds-order-system-final.html
3. backend/prisma/schema.prisma
4. backend/src/server.ts
5. backend/package.json
```

### For Step 2 (Frontend):
```
📎 Attachments:
1. All files output from Step 1
2. MIGRATION_STRATEGY.md
3. blinds-order-system-final.html
4. frontend/src/App.tsx
5. frontend/src/services/api.ts
6. frontend/package.json
7. frontend/tailwind.config.js
```

### For Step 3 (Integration & Testing):
```
📎 Attachments:
1. All files from Step 1 & Step 2
2. MIGRATION_STRATEGY.md
3. blinds-order-system-final.html (for data extraction)
4. backend/prisma/schema.prisma (updated)
```

---

## 🎯 Expected Outcomes

### After Step 1:
✅ Database schema updated with new tables
✅ Authentication system working (login, register, JWT)
✅ All order APIs functional
✅ Pricing APIs functional
✅ User management APIs functional
✅ Pricing data seeded
✅ Admin user created
✅ All endpoints tested with curl/Postman

### After Step 2:
✅ Customer portal complete (login, register, create orders, view orders, quotes)
✅ Admin portal complete (approve orders, manage users, edit pricing)
✅ All forms working with validation
✅ Price calculation working in real-time
✅ Routing working
✅ Authentication flow complete
✅ Existing pages still functional

### After Step 3:
✅ Pricing engine fully integrated
✅ Fabric data hierarchy complete
✅ All tests passing
✅ Data migration complete
✅ Excel upload backward compatible
✅ Documentation complete
✅ System ready for production

---

## 💡 Tips for Best Results

1. **Run steps sequentially** - Complete Step 1 before Step 2, etc.
2. **Test after each step** - Verify everything works before moving on
3. **Keep backups** - Always backup database before migrations
4. **Use version control** - Commit after each step completion
5. **Review outputs** - Check generated code matches requirements
6. **Ask for clarification** - If output is unclear, ask Claude to explain specific parts

---

## 🚀 Post-Migration Deployment Commands

After all 3 steps are complete, run these commands:

```bash
# 1. Database Migration
cd backend
npx prisma migrate deploy

# 2. Seed Pricing Data
npm run seed:pricing

# 3. Create Admin User
npm run create:admin

# 4. Run Tests
npm test

# 5. Build Frontend
cd ../frontend
npm run build

# 6. Start Production (Docker)
cd ..
docker-compose -f docker-compose.prod.yml up -d

# 7. Verify Services
docker-compose -f docker-compose.prod.yml ps
curl http://localhost:5000/api/health
curl http://localhost:3000

# 8. Check Logs
docker-compose -f docker-compose.prod.yml logs -f
```

---

## 📞 Support & Troubleshooting

If you encounter issues during migration:

1. **Check logs**: `docker-compose logs -f backend`
2. **Check database**: Ensure migrations ran successfully
3. **Check environment**: Verify all .env variables are set
4. **Check ports**: Ensure 3000, 5000, 5432 are not in use
5. **Restart services**: `docker-compose restart`

Good luck with your migration! 🎉
