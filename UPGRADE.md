# COMPREHENSIVE SYSTEM UPGRADE PROMPT FOR ANTIGRAVITY IDE (Claude Sonnet 4.5)

## 🎯 PROJECT CONTEXT

**System:** Signature Shades Order Management System  
**Current State:** Phase 1 Complete (Authentication, Basic Order Flow, Pricing Engine)  
**Tech Stack:** React + TypeScript + Express + Prisma + PostgreSQL (Docker)  
**Location:** F:\SIGNATUR SHADES\signature-sap

---

## 📋 UPGRADE OBJECTIVE

Implement comprehensive system improvements including:
1. ✅ Admin-only inventory access with proper permissions
2. ✅ Complete Admin UI (User Management + Pricing Management)
3. ✅ Enhanced blind order form with 14 new dropdown options
4. ✅ Motor-specific width deductions (3 different formulas)
5. ✅ 80+ new inventory items with automatic deduction logic
6. ✅ Quote vs Order workflow with copy functionality
7. ✅ Chain type selection based on motor selection
8. ✅ Real-time pricing across all components
9. ✅ Enhanced worksheet generation (13-column CSV + visualized PDF)

---

## 🔐 PART 1: ADMIN PERMISSIONS & UI

### 1.1 Access Control Updates

**Current Issue:** All users can access inventory.  
**Required:** Only admin users should see inventory and admin features.

**Backend Changes:**

```typescript
// backend/src/middleware/auth.ts
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user; // Set by authenticateToken middleware
    
    if (!user || user.role !== 'ADMIN') {
      return res.status(403).json({ 
        error: 'Access denied. Admin privileges required.' 
      });
    }
    
    next();
  } catch (error) {
    res.status(403).json({ error: 'Forbidden' });
  }
};
```

**Apply to routes:**

```typescript
// backend/src/routes/inventoryRoutes.ts
router.get('/inventory', requireAuth, requireAdmin, getAllInventory);
router.post('/inventory', requireAuth, requireAdmin, createInventoryItem);
router.patch('/inventory/:id', requireAuth, requireAdmin, updateInventoryItem);
router.delete('/inventory/:id', requireAuth, requireAdmin, deleteInventoryItem);

// All inventory routes require admin access
```

**Frontend Changes:**

```typescript
// frontend/src/components/Layout.tsx
// Hide inventory link for non-admin users

const Layout = () => {
  const { user, isAdmin } = useAuth();
  
  return (
    <nav>
      {/* Customer links */}
      <Link to="/orders/new">New Order</Link>
      <Link to="/orders/my-orders">My Orders</Link>
      <Link to="/quotes">My Quotes</Link>
      
      {/* Admin-only links */}
      {isAdmin && (
        <>
          <Link to="/admin/orders">Order Management</Link>
          <Link to="/admin/users">User Management</Link>
          <Link to="/admin/pricing">Pricing Management</Link>
          <Link to="/admin/inventory">Inventory</Link>
        </>
      )}
    </nav>
  );
};
```

---

### 1.2 User Management UI (NEW)

**Create:** `frontend/src/pages/admin/UserManagement.tsx`

**Features:**
- Create new customer accounts (Admin only, no self-registration)
- List all customers with search/filter
- Edit customer details
- Deactivate/activate users
- View order history per customer

**UI Structure:**

```typescript
<div className="user-management">
  {/* Create User Form */}
  <section className="create-user-card">
    <h2>Create New Customer Account</h2>
    <form onSubmit={handleCreateUser}>
      <input name="fullName" placeholder="Full Name" required />
      <input name="email" type="email" placeholder="Email" required />
      <input name="phone" placeholder="Phone Number" required />
      <input name="company" placeholder="Company Name (Optional)" />
      <textarea name="address" placeholder="Address" required />
      <input name="password" type="password" placeholder="Password" required />
      <button type="submit">Create Customer</button>
    </form>
  </section>

  {/* Users List */}
  <section className="users-list">
    <h2>All Customer Accounts</h2>
    <input type="search" placeholder="Search by name or email..." />
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Company</th>
          <th>Phone</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            <td>{user.name}</td>
            <td>{user.email}</td>
            <td>{user.company || '-'}</td>
            <td>{user.phone}</td>
            <td>
              <span className={user.isActive ? 'active' : 'inactive'}>
                {user.isActive ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td>
              <button onClick={() => editUser(user)}>Edit</button>
              <button onClick={() => toggleUserStatus(user)}>
                {user.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
</div>
```

**API Endpoints (already exist from Phase 1, verify they work):**
- `POST /api/admin/users` - Create customer
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Deactivate user

---

### 1.3 Pricing Management UI (NEW)

**Create:** `frontend/src/pages/admin/PricingManagement.tsx`

**Features:**
- Edit fabric pricing matrix (G1, G2, G3 only - remove G4, G5)
- Edit component pricing (brackets, chains, motors, clips, etc.)
- Real-time price updates
- Export pricing table to CSV

**UI Structure:**

```typescript
<div className="pricing-management">
  <h1>Pricing Management</h1>
  
  {/* Tab 1: Fabric Pricing */}
  <section className="fabric-pricing">
    <h2>Fabric Pricing Matrix</h2>
    <select value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
      <option value="G1">Group 1 (20% Discount)</option>
      <option value="G2">Group 2 (25% Discount)</option>
      <option value="G3">Group 3 (30% Discount)</option>
    </select>
    
    {/* Editable pricing table */}
    <table className="pricing-table">
      <thead>
        <tr>
          <th>Width\Drop</th>
          <th>1200mm</th>
          <th>1400mm</th>
          <th>1600mm</th>
          {/* ... more drop columns */}
        </tr>
      </thead>
      <tbody>
        {widths.map(width => (
          <tr key={width}>
            <td>{width}mm</td>
            {drops.map(drop => (
              <td key={drop}>
                <input
                  type="number"
                  value={pricing[selectedGroup][width][drop]}
                  onChange={e => updatePrice(selectedGroup, width, drop, e.target.value)}
                  step="0.01"
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    
    <button onClick={saveFabricPricing}>Save Fabric Pricing</button>
  </section>

  {/* Tab 2: Component Pricing */}
  <section className="component-pricing">
    <h2>Component Pricing</h2>
    <table>
      <thead>
        <tr>
          <th>Component</th>
          <th>Unit Price ($)</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {/* Motors */}
        <tr>
          <td>TBS winder-32mm</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        <tr>
          <td>Acmeda winder-29mm</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        {/* ... all 11 motors/chains */}
        
        {/* Brackets (14 items) */}
        <tr>
          <td>Acmeda Single Bracket set - White</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        {/* ... all bracket variations */}
        
        {/* Chains (10 items) */}
        <tr>
          <td>Stainless Steel Chain - 500mm</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        {/* ... all chain variations */}
        
        {/* Clips (16 items) */}
        <tr>
          <td>Bottom bar Clips Left - D30 - Anodised</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        {/* ... all clip variations */}
        
        {/* Other components */}
        <tr>
          <td>Acmeda Idler</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        <tr>
          <td>Acmeda Clutch</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        <tr>
          <td>Stop bolt</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
        <tr>
          <td>Safety lock</td>
          <td><input type="number" defaultValue="1.00" step="0.01" /></td>
          <td><button>Save</button></td>
        </tr>
      </tbody>
    </table>
    
    <button onClick={saveComponentPricing}>Save All Component Pricing</button>
  </section>
</div>
```

**Backend Implementation:**

```typescript
// Add "price" field to InventoryItem model
model InventoryItem {
  id                Int      @id @default(autoincrement())
  name              String   @unique
  category          String   // "Fabrics", "Motors", "Brackets", "Chains", "Clips", "Components"
  quantity          Int
  unit              String   // "MM", "UNITS"
  lowStockThreshold Int
  isLowStock        Boolean  @default(false)
  
  // NEW: Pricing field
  price             Decimal  @db.Decimal(10, 2) @default(1.00)
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

// API endpoint to update pricing
PATCH /api/admin/pricing/component/:id
Body: { price: 15.50 }
```

---

## 📝 PART 2: ENHANCED BLIND ORDER FORM

### 2.1 Complete Dropdown Options

**Update:** `frontend/src/components/orders/BlindItemForm.tsx`

**Add/Update these dropdowns:**

```typescript
// 1. Fixing Type (NEW)
<select name="fixing" required>
  <option value="">Select Fixing Type...</option>
  <option value="Face">Face</option>
  <option value="Recess">Recess</option>
</select>

// 2. Bracket Type (UPDATED)
<select name="bracketType" required onChange={handleBracketTypeChange}>
  <option value="">Select Bracket Type...</option>
  <option value="Single">Single</option>
  <option value="Single Extension">Single Extension</option>
  <option value="Dual Left">Dual Left</option>
  <option value="Dual Right">Dual Right</option>
</select>

// 3. Bracket Colour (UPDATED)
<select name="bracketColour" required>
  <option value="">Select Bracket Colour...</option>
  <option value="White">White</option>
  <option value="Black">Black</option>
  <option value="Sandstone">Sandstone</option>
  <option value="Barley">Barley</option>
  <option value="Silver Grey">Silver Grey</option>
</select>

// 4. Bottom Rail Type (UPDATED)
<select name="bottomRailType" required>
  <option value="">Select Bottom Rail Type...</option>
  <option value="D30">D30</option>
  <option value="Oval">Oval</option>
</select>

// 5. Bottom Rail Colour (UPDATED)
<select name="bottomRailColour" required>
  <option value="">Select Bottom Rail Colour...</option>
  <option value="Anodised">Anodised</option>
  <option value="Black">Black</option>
  <option value="Bone">Bone</option>
  <option value="Dune">Dune</option>
</select>

// 6. Chain or Motor (UPDATED - 11 options)
<select name="chainOrMotor" required onChange={handleMotorChange}>
  <option value="">Select Chain or Motor...</option>
  <option value="TBS winder-32mm">TBS winder-32mm</option>
  <option value="Acmeda winder-29mm">Acmeda winder-29mm</option>
  <option value="Automate 1.1NM Li-Ion Quiet Motor">Automate 1.1NM Li-Ion Quiet Motor</option>
  <option value="Automate 0.7NM Li-Ion Quiet Motor">Automate 0.7NM Li-Ion Quiet Motor</option>
  <option value="Automate 2NM Li-Ion Quiet Motor">Automate 2NM Li-Ion Quiet Motor</option>
  <option value="Automate 3NM Li-Ion Motor">Automate 3NM Li-Ion Motor</option>
  <option value="Automate E6 6NM Motor">Automate E6 6NM Motor</option>
  <option value="Alpha 1NM Battery Motor">Alpha 1NM Battery Motor</option>
  <option value="Alpha 2NM Battery Motor">Alpha 2NM Battery Motor</option>
  <option value="Alpha 3NM Battery Motor">Alpha 3NM Battery Motor</option>
  <option value="Alpha AC 5NM Motor">Alpha AC 5NM Motor</option>
</select>

// 7. Chain Type (CONDITIONAL - NEW)
{/* Only show if TBS winder-32mm OR Acmeda winder-29mm selected */}
{(chainOrMotor === 'TBS winder-32mm' || chainOrMotor === 'Acmeda winder-29mm') && (
  <div className="form-group">
    <label>Chain Type *</label>
    <select name="chainType" required>
      <option value="">Select Chain Type...</option>
      <option value="Stainless Steel">Stainless Steel Chain</option>
      <option value="Plastic Pure White">Plastic Pure White Chain</option>
    </select>
  </div>
)}
```

---

### 2.2 Form Validation Rules

**Exceptional Use Case 1: Block TBS + Extended Bracket**

```typescript
const handleBracketTypeChange = (e) => {
  const bracketType = e.target.value;
  const chainOrMotor = formData.chainOrMotor;
  
  // Block "Single Extension" if TBS winder selected
  if (chainOrMotor === 'TBS winder-32mm' && bracketType === 'Single Extension') {
    alert('Error: Extended bracket set is not available with TBS winder-32mm. Please select a different bracket type.');
    e.target.value = ''; // Reset selection
    return;
  }
  
  setFormData({ ...formData, bracketType });
};

const handleMotorChange = (e) => {
  const chainOrMotor = e.target.value;
  const bracketType = formData.bracketType;
  
  // Disable "Single Extension" option if TBS selected
  if (chainOrMotor === 'TBS winder-32mm') {
    const extendedOption = document.querySelector('option[value="Single Extension"]');
    if (extendedOption) {
      extendedOption.disabled = true;
      extendedOption.textContent = 'Single Extension (Not available with TBS)';
    }
    
    // Reset if already selected
    if (bracketType === 'Single Extension') {
      setFormData({ ...formData, chainOrMotor, bracketType: '' });
      alert('Extended bracket is not compatible with TBS winder. Bracket type reset.');
    }
  } else {
    // Re-enable option for other motors
    const extendedOption = document.querySelector('option[value="Single Extension"]');
    if (extendedOption) {
      extendedOption.disabled = false;
      extendedOption.textContent = 'Single Extension';
    }
  }
  
  setFormData({ ...formData, chainOrMotor });
};
```

---

### 2.3 Quote vs Order Workflow

**Update:** `frontend/src/pages/customer/NewOrder.tsx`

**Workflow Implementation:**

```typescript
const NewOrder = () => {
  const [blinds, setBlinds] = useState([]);
  const [currentBlind, setCurrentBlind] = useState(initialBlindState);
  const [showSummary, setShowSummary] = useState(false);

  // Step 1-3: Add blinds one by one
  const handleUpdateAndCopy = () => {
    // Save current blind
    setBlinds([...blinds, currentBlind]);
    
    // Copy all fields EXCEPT Location, Width, Drop
    setCurrentBlind({
      ...currentBlind,
      location: '',
      width: '',
      drop: '',
      // All other fields stay the same (copied)
    });
    
    toast.success('Blind added! Fields copied except Location, Width, Drop.');
  };

  const handleUpdateAndContinueAdding = () => {
    // Save current blind
    setBlinds([...blinds, currentBlind]);
    
    // Reset ALL fields
    setCurrentBlind(initialBlindState);
    
    toast.success('Blind added! Ready for next blind.');
  };

  const handleFinishAdding = () => {
    // Save current blind if filled
    if (currentBlind.location && currentBlind.width && currentBlind.drop) {
      setBlinds([...blinds, currentBlind]);
    }
    
    // Show summary page
    setShowSummary(true);
  };

  // Step 4: Summary page
  const OrderSummary = () => {
    const subtotal = blinds.reduce((sum, blind) => sum + blind.price, 0);
    const discount = calculateTotalDiscount(blinds);
    const total = subtotal - discount;

    return (
      <div className="order-summary">
        <h2>Order Summary</h2>
        
        {/* Blinds list */}
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Location</th>
              <th>Size</th>
              <th>Fabric</th>
              <th>Motor/Chain</th>
              <th>Price</th>
            </tr>
          </thead>
          <tbody>
            {blinds.map((blind, index) => (
              <tr key={index}>
                <td>{index + 1}</td>
                <td>{blind.location}</td>
                <td>{blind.width} × {blind.drop} mm</td>
                <td>{blind.material} - {blind.fabricType} - {blind.fabricColour}</td>
                <td>{blind.chainOrMotor}</td>
                <td>${blind.price.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pricing summary */}
        <div className="pricing-summary">
          <div className="price-row">
            <span>Subtotal:</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div className="price-row">
            <span>Discount:</span>
            <span>-${discount.toFixed(2)}</span>
          </div>
          <div className="price-row total">
            <span>Total:</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="action-buttons">
          <button onClick={handleSaveAsQuote} className="btn-secondary">
            Save as Quote
          </button>
          <button onClick={handleSubmitAsOrder} className="btn-primary">
            Submit as Order
          </button>
        </div>
      </div>
    );
  };

  // Step 5a: Save as Quote
  const handleSaveAsQuote = async () => {
    try {
      await api.post('/quotes/create', {
        items: blinds,
        subtotal,
        total,
        status: 'QUOTE'
      });
      
      toast.success('Quote saved! You can view it in "My Quotes" page.');
      navigate('/quotes');
    } catch (error) {
      toast.error('Failed to save quote');
    }
  };

  // Step 5b: Submit as Order
  const handleSubmitAsOrder = async () => {
    try {
      await api.post('/web-orders/create', {
        items: blinds,
        subtotal,
        total,
        status: 'PENDING'
      });
      
      toast.success('Order submitted! Admin will review and approve.');
      navigate('/orders/my-orders');
    } catch (error) {
      toast.error('Failed to submit order');
    }
  };

  return (
    <div>
      {!showSummary ? (
        <BlindForm
          blind={currentBlind}
          onChange={setCurrentBlind}
          onUpdateAndCopy={handleUpdateAndCopy}
          onUpdateAndContinue={handleUpdateAndContinueAdding}
          onFinish={handleFinishAdding}
        />
      ) : (
        <OrderSummary />
      )}
    </div>
  );
};
```

**Add "Check Price" button:**

```typescript
const [showPrice, setShowPrice] = useState(false);

<button 
  type="button" 
  onClick={async () => {
    const price = await calculateBlindPrice(currentBlind);
    setCurrentBlind({ ...currentBlind, price });
    setShowPrice(true);
  }}
  className="btn-info"
>
  Check Price
</button>

{showPrice && (
  <div className="price-display">
    <strong>Price for this blind: ${currentBlind.price.toFixed(2)}</strong>
  </div>
)}
```

---

## 🔧 PART 3: WIDTH DEDUCTION LOGIC (MOTOR-SPECIFIC)

### 3.1 Deduction Rules

**Update:** `backend/src/services/worksheet.service.ts`

```typescript
function calculateDimensions(item: OrderItem) {
  const motor = item.chainOrMotor;
  
  // Determine width deduction based on motor
  let widthDeduction = 28; // Default for chains
  
  if (motor.includes('Automate')) {
    // Automate motors: positions 3-7
    widthDeduction = 29;
  } else if (motor.includes('Alpha') && !motor.includes('AC')) {
    // Alpha Battery motors: positions 8-10
    widthDeduction = 30;
  } else if (motor.includes('Alpha AC')) {
    // Alpha AC motor: position 11
    widthDeduction = 35;
  }
  // TBS and Acmeda chains use default 28mm
  
  return {
    fabricCutWidth: item.width - widthDeduction,  // For fabric worksheet
    tubeCutWidth: item.width - 28,                // For tube worksheet (always 28)
    calculatedDrop: item.drop + 150               // Always +150mm
  };
}
```

**Motor Detection Helper:**

```typescript
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
  'Alpha AC 5NM Motor': 35
};

function getWidthDeduction(motorType: string): number {
  return MOTOR_DEDUCTIONS[motorType] || 28;
}
```

---

## 📦 PART 4: INVENTORY ITEMS & AUTOMATIC DEDUCTION LOGIC

### 4.1 Complete Inventory Item List (80+ Items)

**Create seed script:** `backend/prisma/seeds/inventory-items.ts`

```typescript
const INVENTORY_ITEMS = [
  // === MOTORS & CHAINS (11 items) ===
  { name: 'TBS winder-32mm', category: 'Motors', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'Acmeda winder-29mm', category: 'Motors', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'Automate 1.1NM Li-Ion Quiet Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Automate 0.7NM Li-Ion Quiet Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Automate 2NM Li-Ion Quiet Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Automate 3NM Li-Ion Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Automate E6 6NM Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Alpha 1NM Battery Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Alpha 2NM Battery Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Alpha 3NM Battery Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },
  { name: 'Alpha AC 5NM Motor', category: 'Motors', unit: 'UNITS', quantity: 50, price: 1.00 },

  // === CHAINS (10 items: 5 lengths × 2 types) ===
  { name: 'Stainless Steel Chain - 500mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Stainless Steel Chain - 750mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Stainless Steel Chain - 1000mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Stainless Steel Chain - 1200mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Stainless Steel Chain - 1500mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Plastic Pure White Chain - 500mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Plastic Pure White Chain - 750mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Plastic Pure White Chain - 1000mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Plastic Pure White Chain - 1200mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },
  { name: 'Plastic Pure White Chain - 1500mm', category: 'Chains', unit: 'UNITS', quantity: 200, price: 1.00 },

  // === ACMEDA BRACKETS (8 items) ===
  { name: 'Acmeda Single Bracket set - White', category: 'Brackets', unit: 'UNITS', quantity: 150, price: 1.00 },
  { name: 'Acmeda Single Bracket set - Black', category: 'Brackets', unit: 'UNITS', quantity: 150, price: 1.00 },
  { name: 'Acmeda Extended Bracket set - White', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'Acmeda Extended Bracket set - Black', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'Acmeda Duel Bracket set Left - White', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'Acmeda Duel Bracket set Left - Black', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'Acmeda Duel Bracket set Right - White', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'Acmeda Duel Bracket set Right - Black', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },

  // === TBS BRACKETS (6 items) ===
  { name: 'TBS Single Bracket set - White', category: 'Brackets', unit: 'UNITS', quantity: 150, price: 1.00 },
  { name: 'TBS Single Bracket set - Black', category: 'Brackets', unit: 'UNITS', quantity: 150, price: 1.00 },
  { name: 'TBS Duel Bracket set Left - White', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'TBS Duel Bracket set Left - Black', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'TBS Duel Bracket set Right - White', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },
  { name: 'TBS Duel Bracket set Right - Black', category: 'Brackets', unit: 'UNITS', quantity: 100, price: 1.00 },

  // === BOTTOM BAR CLIPS LEFT (8 items: 2 types × 4 colours) ===
  { name: 'Bottom bar Clips Left - D30 - Anodised', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Left - D30 - Black', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Left - D30 - Bone', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Left - D30 - Dune', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Left - Oval - Anodised', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Left - Oval - Black', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Left - Oval - Bone', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Left - Oval - Dune', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },

  // === BOTTOM BAR CLIPS RIGHT (8 items) ===
  { name: 'Bottom bar Clips Right - D30 - Anodised', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Right - D30 - Black', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Right - D30 - Bone', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Right - D30 - Dune', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Right - Oval - Anodised', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Right - Oval - Black', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Right - Oval - Bone', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },
  { name: 'Bottom bar Clips Right - Oval - Dune', category: 'Clips', unit: 'UNITS', quantity: 500, price: 1.00 },

  // === OTHER COMPONENTS (4 items) ===
  { name: 'Acmeda Idler', category: 'Components', unit: 'UNITS', quantity: 300, price: 1.00 },
  { name: 'Acmeda Clutch', category: 'Components', unit: 'UNITS', quantity: 300, price: 1.00 },
  { name: 'Stop bolt', category: 'Components', unit: 'UNITS', quantity: 1000, price: 1.00 },
  { name: 'Safety lock', category: 'Components', unit: 'UNITS', quantity: 1000, price: 1.00 },

  // === FABRICS (from JSON file - add all with MM unit) ===
  // Alpha fabrics (G2)
  { name: 'Alpha - Avoca Block Out - Alabaster', category: 'Fabrics', unit: 'MM', quantity: 50000, price: 0 },
  // ... (continue for all fabrics from fabrics_filtered_with_groups.json)
  
  // === BOTTOM BARS (tubes) ===
  { name: 'D30 - Anodised', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 },
  { name: 'D30 - Black', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 },
  { name: 'D30 - Bone', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 },
  { name: 'D30 - Dune', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 },
  { name: 'Oval - Anodised', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 },
  { name: 'Oval - Black', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 },
  { name: 'Oval - Bone', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 },
  { name: 'Oval - Dune', category: 'Bottom Bars', unit: 'UNITS', quantity: 200, price: 0 }
];

async function seedInventory() {
  for (const item of INVENTORY_ITEMS) {
    await prisma.inventoryItem.upsert({
      where: { name: item.name },
      update: item,
      create: {
        ...item,
        lowStockThreshold: item.unit === 'MM' ? 10000 : 10
      }
    });
  }
  console.log(`✅ Seeded ${INVENTORY_ITEMS.length} inventory items`);
}
```

---

### 4.2 Chain Length Selection Logic

```typescript
function getChainLength(drop: number): number {
  if (drop <= 850) return 500;
  if (drop <= 1100) return 750;
  if (drop <= 1600) return 1000;
  if (drop <= 2200) return 1200;
  return 1500; // drop > 2200mm (up to 4000mm)
}

function getChainItemName(chainType: string, drop: number): string {
  const length = getChainLength(drop);
  return `${chainType} Chain - ${length}mm`;
}
```

---

### 4.3 Automatic Inventory Deduction Logic

**Create:** `backend/src/services/inventoryDeduction.service.ts`

```typescript
export class InventoryDeductionService {
  
  async deductForBlind(blindItem: OrderItem): Promise<DeductionResult> {
    const deductions = [];
    const motor = blindItem.chainOrMotor;
    
    // 1. DEDUCT MOTOR/CHAIN
    deductions.push({
      itemName: motor,
      quantity: 1,
      category: 'Motors'
    });
    
    // 2. DEDUCT BASED ON MOTOR TYPE
    if (motor === 'Acmeda winder-29mm') {
      // Acmeda winder logic
      deductions.push({ itemName: 'Acmeda Idler', quantity: 1 });
      deductions.push({ itemName: 'Acmeda Clutch', quantity: 1 });
      deductions.push(...this.getBracketDeduction('Acmeda', blindItem));
      deductions.push(...this.getChainDeduction(blindItem));
      deductions.push(...this.getClipsDeduction(blindItem));
      deductions.push({ itemName: 'Stop bolt', quantity: 1 });
      deductions.push({ itemName: 'Safety lock', quantity: 1 });
      
    } else if (motor === 'TBS winder-32mm') {
      // TBS winder logic
      const bracketType = blindItem.bracketType;
      
      if (bracketType === 'Dual Left' || bracketType === 'Dual Right') {
        // EXCEPTION: Dual brackets need separate Idler & Clutch
        deductions.push({ itemName: 'Acmeda Idler', quantity: 1 });
        deductions.push({ itemName: 'Acmeda Clutch', quantity: 1 });
      }
      // TBS bracket set already includes Idler & Clutch for Single
      
      deductions.push(...this.getBracketDeduction('TBS', blindItem));
      deductions.push(...this.getChainDeduction(blindItem));
      deductions.push(...this.getClipsDeduction(blindItem));
      deductions.push({ itemName: 'Stop bolt', quantity: 1 });
      deductions.push({ itemName: 'Safety lock', quantity: 1 });
      
    } else {
      // All other motors (Automate & Alpha)
      deductions.push({ itemName: 'Acmeda Idler', quantity: 1 });
      deductions.push(...this.getBracketDeduction('Acmeda', blindItem));
      deductions.push(...this.getClipsDeduction(blindItem));
      // No chain, stop bolt, or safety lock for motors
    }
    
    // 3. DEDUCT FABRIC (handled by cutlist optimizer)
    // 4. DEDUCT BOTTOM BAR (handled by tube cut optimizer)
    
    return { deductions };
  }
  
  private getBracketDeduction(brand: string, item: OrderItem) {
    const { bracketType, bracketColour, controlSide } = item;
    
    let bracketName = `${brand} `;
    
    if (bracketType === 'Single') {
      bracketName += `Single Bracket set - ${bracketColour}`;
    } else if (bracketType === 'Single Extension') {
      bracketName += `Extended Bracket set - ${bracketColour}`;
    } else if (bracketType === 'Dual Left') {
      bracketName += `Duel Bracket set Left - ${bracketColour}`;
    } else if (bracketType === 'Dual Right') {
      bracketName += `Duel Bracket set Right - ${bracketColour}`;
    }
    
    return [{ itemName: bracketName, quantity: 1 }];
  }
  
  private getChainDeduction(item: OrderItem) {
    const chainType = item.chainType; // "Stainless Steel" or "Plastic Pure White"
    const length = getChainLength(item.drop);
    
    return [{
      itemName: `${chainType} Chain - ${length}mm`,
      quantity: 1
    }];
  }
  
  private getClipsDeduction(item: OrderItem) {
    const { bottomRailType, bottomRailColour } = item;
    
    return [
      {
        itemName: `Bottom bar Clips Left - ${bottomRailType} - ${bottomRailColour}`,
        quantity: 1
      },
      {
        itemName: `Bottom bar Clips Right - ${bottomRailType} - ${bottomRailColour}`,
        quantity: 1
      }
    ];
  }
}
```

---

## 💰 PART 5: COMPREHENSIVE PRICING CALCULATION

### 5.1 Total Price Formula

```typescript
async function calculateBlindPrice(blindData: BlindFormData): Promise<number> {
  let totalPrice = 0;
  
  // 1. FABRIC PRICE (from G1/G2/G3 matrix)
  const fabricGroup = getFabricGroup(blindData.material, blindData.fabricType);
  const baseFabricPrice = await getPriceFromMatrix(
    fabricGroup,
    blindData.width,
    blindData.drop
  );
  const fabricDiscount = getDiscountPercent(fabricGroup); // 20%, 25%, or 30%
  const fabricPrice = baseFabricPrice * (1 - fabricDiscount / 100);
  totalPrice += fabricPrice;
  
  // 2. MOTOR/CHAIN PRICE
  const motorPrice = await getComponentPrice(blindData.chainOrMotor);
  totalPrice += motorPrice;
  
  // 3. BRACKET PRICE
  const bracketName = getBracketName(blindData.bracketType, blindData.bracketColour);
  const bracketPrice = await getComponentPrice(bracketName);
  totalPrice += bracketPrice;
  
  // 4. CHAIN PRICE (if winder selected)
  if (blindData.chainOrMotor.includes('winder')) {
    const chainLength = getChainLength(blindData.drop);
    const chainName = `${blindData.chainType} Chain - ${chainLength}mm`;
    const chainPrice = await getComponentPrice(chainName);
    totalPrice += chainPrice;
  }
  
  // 5. CLIPS PRICE (2 clips)
  const clipLeftName = `Bottom bar Clips Left - ${blindData.bottomRailType} - ${blindData.bottomRailColour}`;
  const clipRightName = `Bottom bar Clips Right - ${blindData.bottomRailType} - ${blindData.bottomRailColour}`;
  const clipLeftPrice = await getComponentPrice(clipLeftName);
  const clipRightPrice = await getComponentPrice(clipRightName);
  totalPrice += clipLeftPrice + clipRightPrice;
  
  // 6. IDLER & CLUTCH (if applicable)
  if (needsIdlerClutch(blindData.chainOrMotor, blindData.bracketType)) {
    const idlerPrice = await getComponentPrice('Acmeda Idler');
    const clutchPrice = await getComponentPrice('Acmeda Clutch');
    totalPrice += idlerPrice + clutchPrice;
  }
  
  // 7. STOP BOLT & SAFETY LOCK (if chain)
  if (blindData.chainOrMotor.includes('winder')) {
    const stopBoltPrice = await getComponentPrice('Stop bolt');
    const safetyLockPrice = await getComponentPrice('Safety lock');
    totalPrice += stopBoltPrice + safetyLockPrice;
  }
  
  return totalPrice;
}

async function getComponentPrice(componentName: string): Promise<number> {
  const item = await prisma.inventoryItem.findFirst({
    where: { name: componentName }
  });
  return item?.price || 1.00; // Default $1 if not found
}
```

---

## 📊 PART 6: ENHANCED WORKSHEET GENERATION

### 6.1 Worksheet Columns (13 columns total)

**Fabric Cut Worksheet CSV:**
```
Blind NO. | Location | Width (mm) | Drop (mm) | Control Side | Bracket Colour | Bracket Colour | Chain Or Motor | Roll Type | Fabric Type | Fabric Colour | Bottom Rail Type | Bottom Rail Colour
```

**Note:** Column 6 & 7 both say "Bracket Colour" - assuming this is:
- Column 6: Bracket Type
- Column 7: Bracket Colour

**Corrected columns:**
```
1. Blind NO.
2. Location
3. Width (mm) - calculated with motor deduction
4. Drop (mm) - calculated (Drop + 150)
5. Control Side
6. Bracket Type
7. Bracket Colour
8. Chain Or Motor
9. Roll Type
10. Fabric Type
11. Fabric Colour
12. Bottom Rail Type
13. Bottom Rail Colour
```

**Tube Cut Worksheet CSV:**
```
1. Blind NO.
2. Location
3. Width (mm) - always Width - 28mm
4. Bottom Rail Type
5. Bottom Rail Colour
```

---

### 6.2 PDF with Visualization

**Update:** `backend/src/services/worksheetExport.service.ts`

```typescript
async exportFabricCutPDF(worksheetData, orderId): Promise<Buffer> {
  const doc = new PDFDocument({ layout: 'landscape', size: 'A4' });
  
  // Page 1: Cutlist Optimization Visualization
  doc.fontSize(16).text('Fabric Cutlist Optimization', { align: 'center' });
  doc.moveDown();
  
  // Draw cutting layout (similar to attached image)
  worksheetData.fabricCut.statistics.forEach((group, index) => {
    group.sheets.forEach((sheet, sheetIndex) => {
      // Draw sheet rectangle (3000mm × 10000mm scaled down)
      const scale = 0.05; // Scale factor for PDF
      const sheetWidth = 3000 * scale; // 150px
      const sheetHeight = 10000 * scale; // 500px
      
      doc.rect(50, 100 + (sheetIndex * 550), sheetWidth, sheetHeight).stroke();
      
      // Draw each panel
      sheet.panels.forEach(panel => {
        const x = 50 + (panel.x * scale);
        const y = 100 + (sheetIndex * 550) + (panel.y * scale);
        const w = panel.width * scale;
        const h = panel.length * scale;
        
        // Different colors for different fabrics
        const colors = ['#E6F3FF', '#FFE6E6', '#E6FFE6', '#FFFFE6'];
        doc.fillColor(colors[index % 4])
           .rect(x, y, w, h)
           .fill();
        
        // Add dimensions label
        doc.fillColor('#000000')
           .fontSize(8)
           .text(`${panel.width}×${panel.length}`, x + 2, y + 2);
      });
      
      // Sheet statistics
      doc.fontSize(10).text(
        `Sheet ${sheetIndex + 1}: ${sheet.panels.length} panels, ` +
        `${sheet.efficiency}% efficiency, ${sheet.wastedArea}mm² waste`,
        50, 100 + (sheetIndex * 550) + sheetHeight + 10
      );
    });
  });
  
  // Page 2: Detailed worksheet table
  doc.addPage();
  // ... (add table with 13 columns as per spec)
  
  doc.end();
}
```

---

## 🗄️ PART 7: DATABASE SCHEMA UPDATES

### 7.1 Add New Fields to OrderItem

```prisma
model OrderItem {
  // ... existing fields ...
  
  // NEW FIELDS for enhanced form
  fixing              String?  // "Face" or "Recess"
  chainType           String?  // "Stainless Steel" or "Plastic Pure White" (conditional)
  
  // Pricing breakdown (for transparency)
  fabricPrice         Decimal?  @db.Decimal(10, 2)
  motorPrice          Decimal?  @db.Decimal(10, 2)
  bracketPrice        Decimal?  @db.Decimal(10, 2)
  chainPrice          Decimal?  @db.Decimal(10, 2)
  clipsPrice          Decimal?  @db.Decimal(10, 2)
  componentPrice      Decimal?  @db.Decimal(10, 2)
  
  // ... rest of fields ...
}
```

### 7.2 Add Quote Model

```prisma
model Quote {
  id              String      @id @default(uuid())
  quoteNumber     String      @unique // QT-YYMMDD-XXXX
  userId          Int
  user            User        @relation(fields: [userId], references: [id])
  
  items           Json        // Store quote items as JSON
  subtotal        Decimal     @db.Decimal(10, 2)
  total           Decimal     @db.Decimal(10, 2)
  notes           String?
  
  // Conversion tracking
  convertedToOrderId String?  @unique
  convertedAt        DateTime?
  
  expiresAt       DateTime    // 30 days from creation
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@index([userId])
  @@index([quoteNumber])
}
```

### 7.3 Migration Commands

```bash
npx prisma migrate dev --name add_enhanced_order_features
npx prisma generate
npm run seed:inventory
```

---

## 🧪 PART 8: TESTING REQUIREMENTS

### 8.1 Test Scenarios

Create comprehensive tests for all 7 sample scenarios documented earlier:

```typescript
describe('Inventory Deduction Logic', () => {
  
  test('Sample 1: Acmeda Winder with Single Bracket', async () => {
    const blind = {
      chainOrMotor: 'Acmeda winder-29mm',
      bracketType: 'Single',
      bracketColour: 'White',
      bottomRailType: 'D30',
      bottomRailColour: 'Anodised',
      drop: 2100,
      chainType: 'Stainless Steel'
    };
    
    const deductions = await deductionService.deductForBlind(blind);
    
    expect(deductions).toContainEqual({ itemName: 'Acmeda Idler', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Acmeda Clutch', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Acmeda Single Bracket set - White', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Stainless Steel Chain - 1200mm', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Bottom bar Clips Left - D30 - Anodised', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Bottom bar Clips Right - D30 - Anodised', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Stop bolt', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Safety lock', quantity: 1 });
  });
  
  test('Sample 4: TBS Winder Dual Right (Exception Case)', async () => {
    const blind = {
      chainOrMotor: 'TBS winder-32mm',
      bracketType: 'Dual Right',
      drop: 2100
    };
    
    const deductions = await deductionService.deductForBlind(blind);
    
    // Should include separate Idler & Clutch for dual
    expect(deductions).toContainEqual({ itemName: 'Acmeda Idler', quantity: 1 });
    expect(deductions).toContainEqual({ itemName: 'Acmeda Clutch', quantity: 1 });
  });
  
  test('Sample 5: Automate Motor - Width Deduction 29mm', () => {
    const width = 2000;
    const motor = 'Automate 1.1NM Li-Ion Quiet Motor';
    
    const deduction = getWidthDeduction(motor);
    const calculatedWidth = width - deduction;
    
    expect(deduction).toBe(29);
    expect(calculatedWidth).toBe(1971);
  });
  
  test('Sample 6: Alpha Battery Motor - Width Deduction 30mm', () => {
    const width = 2400;
    const motor = 'Alpha 2NM Battery Motor';
    
    const deduction = getWidthDeduction(motor);
    
    expect(deduction).toBe(30);
    expect(2400 - deduction).toBe(2370);
  });
  
  test('Sample 7: Alpha AC Motor - Width Deduction 35mm', () => {
    const width = 3000;
    const motor = 'Alpha AC 5NM Motor';
    
    const deduction = getWidthDeduction(motor);
    
    expect(deduction).toBe(35);
    expect(3000 - deduction).toBe(2965);
  });
  
  test('Block TBS + Extended Bracket', () => {
    expect(() => {
      validateBracketSelection('TBS winder-32mm', 'Single Extension');
    }).toThrow('Extended bracket set is not available with TBS winder-32mm');
  });
  
  test('Chain Length Selection', () => {
    expect(getChainLength(800)).toBe(500);   // ≤850mm
    expect(getChainLength(1000)).toBe(750);  // 850-1100mm
    expect(getChainLength(1400)).toBe(1000); // 1100-1600mm
    expect(getChainLength(1900)).toBe(1200); // 1600-2200mm
    expect(getChainLength(2500)).toBe(1500); // >2200mm
  });
});
```

---

## 📦 PART 9: DELIVERABLES CHECKLIST

After implementing all parts, verify:

### Backend:
- [ ] Admin-only middleware applied to inventory routes
- [ ] User management API endpoints working
- [ ] Pricing management API endpoints created
- [ ] Width deduction logic per motor type implemented
- [ ] 80+ inventory items seeded
- [ ] Inventory deduction service complete
- [ ] Chain length selection logic working
- [ ] Quote model added to schema
- [ ] Enhanced worksheet generation (13 columns)
- [ ] PDF with visualization working

### Frontend:
- [ ] Admin-only nav links (inventory, user mgmt, pricing)
- [ ] User Management UI complete
- [ ] Pricing Management UI complete (fabric + components)
- [ ] Blind form with all 14 dropdown options
- [ ] Conditional chain type dropdown
- [ ] TBS + Extended bracket validation
- [ ] "Check Price" button working
- [ ] "Update & Copy" button working
- [ ] "Update & Continue Adding" button working
- [ ] Order summary page
- [ ] Save as Quote functionality
- [ ] Submit as Order functionality
- [ ] My Quotes page

### Testing:
- [ ] All 7 sample scenarios tested
- [ ] Edge cases validated
- [ ] Price calculation accuracy verified
- [ ] Inventory deduction accuracy verified
- [ ] PDF visualization generated correctly

---

## 🚀 IMPLEMENTATION ORDER

**Recommended sequence:**

1. ✅ **Day 1-2:** Part 1 (Admin permissions + User Management UI)
2. ✅ **Day 3-4:** Part 2 (Enhanced blind form with dropdowns)
3. ✅ **Day 5-6:** Part 3 (Width deduction logic)
4. ✅ **Day 7-9:** Part 4 (Inventory items + deduction service)
5. ✅ **Day 10-11:** Part 5 (Comprehensive pricing)
6. ✅ **Day 12-13:** Part 6 (Worksheet CSV + PDF)
7. ✅ **Day 14-15:** Part 1.3 (Pricing Management UI)
8. ✅ **Day 16-17:** Part 2.3 (Quote vs Order workflow)
9. ✅ **Day 18-20:** Part 8 (Comprehensive testing)

**Total: 20 days (~4 weeks)**

---

## 📚 REFERENCE FILES

**Attach to prompt or reference:**
- `fabrics_filtered_with_groups.json` - Complete fabric list with groups
- `1770661181469_image.png` - Blind form UI reference (Check Price button)
- `1770663696133_image.png` - Cutlist visualization example

---

## ✅ SUCCESS CRITERIA

**System is complete when:**
1. Only admins can access inventory, user management, pricing
2. Admins can create customer accounts (no self-registration)
3. Admins can edit all component pricing in real-time
4. Blind form has all 14 dropdown options
5. Width deductions vary by motor type (28/29/30/35mm)
6. Chain type dropdown appears conditionally
7. TBS + Extended bracket combo is blocked
8. "Update & Copy" preserves all fields except Location/Width/Drop
9. Order summary shows all blinds with individual prices
10. Users can save as quote OR submit as order
11. Quotes stored separately from orders
12. All 80+ inventory items seeded
13. Inventory deductions work for all 7 sample scenarios
14. Worksheets generate with 13 columns (fabric) and 5 columns (tube)
15. PDF includes visualization graph
16. All prices calculated correctly (fabric + components)
17. All tests pass

---

**END OF PROMPT**

**Total Lines:** ~1500+ lines of comprehensive specifications
**Estimated Implementation Time:** 4 weeks (160 hours)
**Complexity Level:** High (Advanced full-stack with business logic)
