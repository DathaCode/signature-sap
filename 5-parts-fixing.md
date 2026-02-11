# CLAUDE CODE BUG FIX PROMPTS - 5 PARTS

---

## 🔧 PART 1: FIX MISSING "UPDATE & COPY" BUTTONS

### CONTEXT
The blind order form is missing the "Update & Copy" and "Update & Continue Adding" buttons. Users cannot add multiple blinds properly.

### EXPECTED USER FLOW
```
User fills Blind #1 → Clicks "Update & Copy" → Blind saved, form copies all fields EXCEPT Location/Width/Drop
OR
User fills Blind #1 → Clicks "Update & Continue Adding" → Blind saved, ALL fields cleared
User repeats for Blind #2, #3, etc.
When done → Clicks "Finish & Review Order" → Goes to summary page
```

### FILES TO MODIFY

**1. File:** `frontend/src/pages/customer/NewOrder.tsx`

Replace the entire file with this implementation:

```typescript
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import BlindItemForm from '../../components/orders/BlindItemForm';
import OrderSummary from '../../components/orders/OrderSummary';

const initialBlindState = {
  location: '',
  width: null,
  drop: null,
  material: '',
  fabricType: '',
  fabricColour: '',
  controlSide: 'Left',
  roll: 'Front',
  fixing: '',
  bracketType: '',
  bracketColour: '',
  chainOrMotor: '',
  bottomRailType: '',
  bottomRailColour: '',
  chainType: null,
  price: 0,
  fabricGroup: 1,
  discountPercent: 0
};

export default function NewOrder() {
  const navigate = useNavigate();
  const [blinds, setBlinds] = useState([]);
  const [currentBlind, setCurrentBlind] = useState(initialBlindState);
  const [showSummary, setShowSummary] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);

  // Validation helper
  const validateBlind = (blind) => {
    const required = ['location', 'width', 'drop', 'material', 'fabricType', 'fabricColour', 
                     'controlSide', 'roll', 'fixing', 'bracketType', 'bracketColour', 
                     'chainOrMotor', 'bottomRailType', 'bottomRailColour'];
    
    for (const field of required) {
      if (!blind[field] || blind[field] === '') {
        return false;
      }
    }
    
    // If chain selected, validate chainType
    if ((blind.chainOrMotor === 'TBS winder-32mm' || blind.chainOrMotor === 'Acmeda winder-29mm') 
        && !blind.chainType) {
      return false;
    }
    
    return true;
  };

  const isBlindPartiallyFilled = (blind) => {
    return blind.location || blind.width || blind.drop || blind.material;
  };

  // Handler: Update & Copy
  const handleUpdateAndCopy = () => {
    if (!validateBlind(currentBlind)) {
      toast.error('Please fill all required fields');
      return;
    }

    if (editingIndex !== null) {
      const updated = [...blinds];
      updated[editingIndex] = currentBlind;
      setBlinds(updated);
      setEditingIndex(null);
    } else {
      setBlinds([...blinds, currentBlind]);
    }

    // Copy all fields EXCEPT Location, Width, Drop
    setCurrentBlind({
      ...currentBlind,
      location: '',
      width: null,
      drop: null,
    });

    toast.success(`Blind #${blinds.length + 1} saved! Fields copied (except Location, Width, Drop).`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler: Update & Continue Adding
  const handleUpdateAndContinueAdding = () => {
    if (!validateBlind(currentBlind)) {
      toast.error('Please fill all required fields');
      return;
    }

    if (editingIndex !== null) {
      const updated = [...blinds];
      updated[editingIndex] = currentBlind;
      setBlinds(updated);
      setEditingIndex(null);
    } else {
      setBlinds([...blinds, currentBlind]);
    }

    // Clear ALL fields
    setCurrentBlind(initialBlindState);

    toast.success(`Blind #${blinds.length + 1} saved! Ready for next blind.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handler: Finish & Review
  const handleFinishAndReview = () => {
    if (isBlindPartiallyFilled(currentBlind)) {
      if (!validateBlind(currentBlind)) {
        toast.error('Please complete all fields or clear them to proceed');
        return;
      }
      setBlinds([...blinds, currentBlind]);
    }

    if (blinds.length === 0 && !isBlindPartiallyFilled(currentBlind)) {
      toast.error('Please add at least one blind to proceed');
      return;
    }

    setShowSummary(true);
  };

  // Edit blind
  const handleEditBlind = (index) => {
    setCurrentBlind(blinds[index]);
    setEditingIndex(index);
    setShowSummary(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`Editing Blind #${index + 1}`);
  };

  // Delete blind
  const handleDeleteBlind = (index) => {
    if (window.confirm(`Are you sure you want to delete Blind #${index + 1}?`)) {
      const updated = blinds.filter((_, i) => i !== index);
      setBlinds(updated);
      toast.success(`Blind #${index + 1} deleted`);
    }
  };

  return (
    <div className="new-order-page">
      {!showSummary ? (
        <>
          {/* Form Header */}
          <div className="form-header mb-6">
            <h1 className="text-3xl font-bold text-gray-800">Create New Order</h1>
            <p className="text-gray-600 mt-2">
              {editingIndex !== null 
                ? `Editing Blind #${editingIndex + 1}`
                : blinds.length === 0 
                  ? 'Add your first blind'
                  : `Adding Blind #${blinds.length + 1}`
              }
            </p>
          </div>

          {/* Blind Form */}
          <BlindItemForm
            blindData={currentBlind}
            onChange={setCurrentBlind}
            blindNumber={editingIndex !== null ? editingIndex + 1 : blinds.length + 1}
          />

          {/* ACTION BUTTONS - CRITICAL: These were missing! */}
          <div className="form-actions bg-gray-50 border-2 border-dashed border-gray-300 rounded-xl p-8 my-8">
            <div className="flex gap-4 mb-6 flex-wrap">
              <button
                type="button"
                onClick={handleUpdateAndCopy}
                className="flex-1 min-w-[250px] bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:from-blue-600 hover:to-blue-700 transition-all hover:shadow-lg"
                title="Save this blind and copy settings (except Location, Width, Drop)"
              >
                <span className="text-2xl">📋</span>
                Update & Copy
              </button>

              <button
                type="button"
                onClick={handleUpdateAndContinueAdding}
                className="flex-1 min-w-[250px] bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-4 rounded-lg font-semibold text-lg flex items-center justify-center gap-3 hover:from-green-600 hover:to-green-700 transition-all hover:shadow-lg"
                title="Save this blind and start fresh"
              >
                <span className="text-2xl">➕</span>
                Update & Continue Adding
              </button>
            </div>

            {blinds.length > 0 && (
              <div className="pt-6 border-t border-gray-300 text-center">
                <button
                  type="button"
                  onClick={handleFinishAndReview}
                  className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-purple-600 hover:to-purple-700 transition-all hover:shadow-lg"
                >
                  <span className="text-2xl mr-2">✓</span>
                  Finish & Review Order ({blinds.length} blind{blinds.length !== 1 ? 's' : ''})
                </button>
              </div>
            )}
          </div>

          {/* Blinds Added So Far */}
          {blinds.length > 0 && (
            <div className="blinds-list-preview bg-white rounded-xl shadow-lg p-6 my-8">
              <h3 className="text-xl font-bold mb-4">Blinds Added ({blinds.length})</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Location</th>
                      <th className="px-4 py-3 text-left">Size</th>
                      <th className="px-4 py-3 text-left">Fabric</th>
                      <th className="px-4 py-3 text-left">Motor/Chain</th>
                      <th className="px-4 py-3 text-right">Price</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blinds.map((blind, index) => (
                      <tr 
                        key={index} 
                        className={`border-b hover:bg-gray-50 ${editingIndex === index ? 'bg-yellow-50 border-l-4 border-yellow-500' : ''}`}
                      >
                        <td className="px-4 py-3">{index + 1}</td>
                        <td className="px-4 py-3">{blind.location}</td>
                        <td className="px-4 py-3">{blind.width} × {blind.drop} mm</td>
                        <td className="px-4 py-3 text-sm">{blind.material} - {blind.fabricType}</td>
                        <td className="px-4 py-3 text-sm">{blind.chainOrMotor}</td>
                        <td className="px-4 py-3 text-right font-semibold">${blind.price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleEditBlind(index)}
                            className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:bg-blue-600 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteBlind(index)}
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-sm"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <OrderSummary
          blinds={blinds}
          onEdit={(index) => handleEditBlind(index)}
          onBackToForm={() => setShowSummary(false)}
        />
      )}
    </div>
  );
}
```

### VERIFICATION STEPS
After implementation, test:
1. ✅ Navigate to New Order page
2. ✅ Fill out Blind #1 completely
3. ✅ Click "Update & Copy" button (should be visible)
4. ✅ Verify: Location, Width, Drop cleared; all other fields copied
5. ✅ Fill Blind #2
6. ✅ Click "Update & Continue Adding" button
7. ✅ Verify: ALL fields cleared
8. ✅ Add Blind #3
9. ✅ Verify: "Finish & Review Order" button shows count
10. ✅ Click it, verify summary page appears

**CRITICAL:** Buttons MUST be visible and functional before moving to Part 2.

---

## 🐛 PART 2: FIX 500 ERROR ON ORDER CREATION + INVENTORY NAVIGATION

### CONTEXT
Two related issues:
1. Creating orders fails with 500 Internal Server Error
2. Clicking "Inventory" link redirects to homepage instead of opening inventory page

### ISSUE #1: ORDER CREATION 500 ERROR

**File:** `backend/src/controllers/order.controller.ts`

Find the `createWebOrder` function and replace it with this error-handling version:

```typescript
export const createWebOrder = async (req: Request, res: Response) => {
  try {
    console.log('=== CREATE WEB ORDER REQUEST ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('User:', req.user ? `${req.user.id} - ${req.user.email}` : 'NOT AUTHENTICATED');

    const { productType, items, dateRequired, notes } = req.body;
    const userId = req.user?.id;

    // Check authentication
    if (!userId) {
      console.error('❌ User not authenticated');
      return res.status(401).json({ 
        status: 'error', 
        message: 'Authentication required' 
      });
    }

    // Validate required fields
    if (!productType) {
      console.error('❌ Product type missing');
      return res.status(400).json({ 
        status: 'error', 
        message: 'Product type is required' 
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.error('❌ No items provided');
      return res.status(400).json({ 
        status: 'error', 
        message: 'At least one item is required' 
      });
    }

    // Validate each item
    for (const [index, item] of items.entries()) {
      const requiredFields = ['location', 'width', 'drop', 'material', 'fabricType', 'fabricColour'];
      for (const field of requiredFields) {
        if (!item[field]) {
          console.error(`❌ Item ${index + 1} missing field: ${field}`);
          return res.status(400).json({
            status: 'error',
            message: `Item ${index + 1}: ${field} is required`
          });
        }
      }
    }

    // Generate order number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `SS-${today}-${random}`;

    console.log('📝 Generated order number:', orderNumber);

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    const total = subtotal;

    console.log('💰 Order totals:', { subtotal, total });

    // Get user details
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId,
        productType,
        orderDate: new Date(),
        dateRequired: dateRequired ? new Date(dateRequired) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        customerName: user.name,
        customerEmail: user.email,
        customerPhone: user.phone || '',
        customerCompany: user.company || '',
        status: 'PENDING',
        subtotal,
        discount: 0,
        total,
        notes: notes || '',
        items: {
          create: items.map((item, index) => ({
            itemNumber: index + 1,
            itemType: 'blind',
            location: item.location,
            width: parseInt(item.width),
            drop: parseInt(item.drop),
            material: item.material || '',
            fabricType: item.fabricType || '',
            fabricColour: item.fabricColour || '',
            controlSide: item.controlSide || 'Left',
            roll: item.roll || 'Front',
            chainOrMotor: item.chainOrMotor || '',
            fixing: item.fixing || '',
            bracketType: item.bracketType || '',
            bracketColour: item.bracketColour || '',
            bottomRailType: item.bottomRailType || '',
            bottomRailColour: item.bottomRailColour || '',
            chainType: item.chainType || null,
            discountPercent: parseFloat(item.discountPercent || 0),
            price: parseFloat(item.price || 0),
            fabricGroup: parseInt(item.fabricGroup || 1)
          }))
        }
      },
      include: {
        items: true
      }
    });

    console.log('✅ Order created successfully:', order.orderNumber);

    res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      order
    });

  } catch (error) {
    console.error('❌ CREATE ORDER ERROR:');
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Check for specific Prisma errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        status: 'error',
        message: 'Order number already exists. Please try again.'
      });
    }

    if (error.code === 'P2003') {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid user reference. Please log in again.'
      });
    }
    
    res.status(500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'development' 
        ? `Failed to create order: ${error.message}` 
        : 'An unexpected error occurred'
    });
  }
};
```

### ISSUE #2: INVENTORY NAVIGATION

**File:** `frontend/src/App.tsx`

Make sure this route exists:

```typescript
import InventoryDashboard from './pages/admin/InventoryDashboard';

// In your routes section
{isAdmin && (
  <Route path="/admin/inventory" element={<InventoryDashboard />} />
)}
```

**File:** `frontend/src/pages/admin/InventoryDashboard.tsx`

If this file doesn't exist, create it:

```typescript
import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { toast } from 'react-toastify';

export default function InventoryDashboard() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      console.log('Loading inventory...');
      const response = await api.get('/inventory');
      console.log('Inventory response:', response.data);
      setInventory(response.data.items || response.data || []);
    } catch (error) {
      console.error('Load inventory error:', error);
      toast.error('Failed to load inventory: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div className="inventory-dashboard p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Inventory Management</h1>
        <p className="text-gray-600 mt-2">Manage stock levels, pricing, and inventory items</p>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <input
          type="search"
          placeholder="Search inventory..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Categories</option>
          <option value="Fabrics">Fabrics</option>
          <option value="Motors">Motors</option>
          <option value="Brackets">Brackets</option>
          <option value="Chains">Chains</option>
          <option value="Clips">Clips</option>
          <option value="Components">Components</option>
          <option value="Bottom Bars">Bottom Bars</option>
        </select>
      </div>

      {/* Inventory Count */}
      <div className="mb-4 text-gray-600">
        Showing {filteredInventory.length} of {inventory.length} items
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Unit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredInventory.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                  No inventory items found
                </td>
              </tr>
            ) : (
              filteredInventory.map(item => (
                <tr key={item.id} className={item.isLowStock ? 'bg-red-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${item.category === 'Fabrics' ? 'blue' : item.category === 'Motors' ? 'green' : 'gray'}-100 text-${item.category === 'Fabrics' ? 'blue' : item.category === 'Motors' ? 'green' : 'gray'}-800`}>
                      {item.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {item.quantity?.toLocaleString() || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {item.unit}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    ${parseFloat(item.price || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {item.isLowStock && (
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        ⚠️ Low Stock
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">Edit</button>
                    <button className="text-gray-600 hover:text-gray-900">View</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### VERIFICATION STEPS
1. ✅ Check backend logs when creating order (should see detailed console logs)
2. ✅ Create test order, verify it succeeds (no 500 error)
3. ✅ Login as admin, click "Inventory" link
4. ✅ Verify inventory page loads (not redirecting to homepage)
5. ✅ Verify inventory items display in table
6. ✅ Test search and filter functionality

---

## 🔄 PART 3: FIX QUOTE TO ORDER CONVERSION

### CONTEXT
Converting quotes to orders fails with 500 error.

**File:** `backend/src/controllers/quote.controller.ts`

Find `convertQuoteToOrder` function and replace with:

```typescript
export const convertQuoteToOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    console.log('=== CONVERT QUOTE TO ORDER ===');
    console.log('Quote ID:', id);
    console.log('User ID:', userId);

    if (!userId) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Get quote
    const quote = await prisma.quote.findUnique({
      where: { id }
    });

    console.log('Quote found:', quote ? 'YES' : 'NO');

    if (!quote) {
      return res.status(404).json({
        status: 'error',
        message: 'Quote not found'
      });
    }

    // Check ownership
    if (quote.userId !== userId) {
      console.error('❌ Quote ownership mismatch');
      return res.status(403).json({
        status: 'error',
        message: 'You can only convert your own quotes'
      });
    }

    // Check if already converted
    if (quote.convertedToOrderId) {
      console.warn('⚠️ Quote already converted');
      return res.status(400).json({
        status: 'error',
        message: 'Quote already converted to order',
        orderId: quote.convertedToOrderId
      });
    }

    // Parse quote items (handle both JSON string and object)
    let quoteItems;
    try {
      quoteItems = typeof quote.items === 'string' 
        ? JSON.parse(quote.items) 
        : quote.items;
    } catch (parseError) {
      console.error('❌ Failed to parse quote items:', parseError);
      return res.status(500).json({
        status: 'error',
        message: 'Invalid quote data format'
      });
    }

    console.log('Quote items parsed:', quoteItems.length, 'items');

    if (!Array.isArray(quoteItems) || quoteItems.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Quote has no items'
      });
    }

    // Generate order number
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    const orderNumber = `SS-${today}-${random}`;

    console.log('📝 Generated order number:', orderNumber);

    // Get user details
    const user = await prisma.user.findUnique({ where: { id: userId } });

    // Create order from quote using transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create order
      const order = await tx.order.create({
        data: {
          orderNumber,
          userId,
          productType: 'BLINDS',
          orderDate: new Date(),
          dateRequired: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          customerName: user.name,
          customerEmail: user.email,
          customerPhone: user.phone || '',
          customerCompany: user.company || '',
          status: 'PENDING',
          subtotal: parseFloat(quote.subtotal.toString()),
          discount: 0,
          total: parseFloat(quote.total.toString()),
          notes: quote.notes ? `Converted from quote: ${quote.notes}` : 'Converted from quote',
          items: {
            create: quoteItems.map((item, index) => ({
              itemNumber: index + 1,
              itemType: 'blind',
              location: item.location || '',
              width: parseInt(item.width) || 0,
              drop: parseInt(item.drop) || 0,
              material: item.material || '',
              fabricType: item.fabricType || '',
              fabricColour: item.fabricColour || '',
              controlSide: item.controlSide || 'Left',
              roll: item.roll || 'Front',
              chainOrMotor: item.chainOrMotor || '',
              fixing: item.fixing || '',
              bracketType: item.bracketType || '',
              bracketColour: item.bracketColour || '',
              bottomRailType: item.bottomRailType || '',
              bottomRailColour: item.bottomRailColour || '',
              chainType: item.chainType || null,
              discountPercent: parseFloat(item.discountPercent || 0),
              price: parseFloat(item.price || 0),
              fabricGroup: parseInt(item.fabricGroup || 1)
            }))
          }
        },
        include: {
          items: true
        }
      });

      // Update quote
      await tx.quote.update({
        where: { id },
        data: {
          convertedToOrderId: order.id,
          convertedAt: new Date()
        }
      });

      return order;
    });

    console.log('✅ Quote converted successfully:', result.orderNumber);

    res.json({
      status: 'success',
      message: 'Quote converted to order successfully',
      order: result
    });

  } catch (error) {
    console.error('❌ CONVERT QUOTE ERROR:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    
    res.status(500).json({
      status: 'error',
      message: process.env.NODE_ENV === 'development' 
        ? `Failed to convert quote: ${error.message}` 
        : 'An unexpected error occurred'
    });
  }
};
```

### VERIFICATION STEPS
1. ✅ Create a quote with 2 blinds
2. ✅ Go to "My Quotes" page
3. ✅ Click "Convert to Order" button
4. ✅ Verify success message appears
5. ✅ Check "My Orders" - converted order should be there with status PENDING
6. ✅ Check backend logs for conversion process
7. ✅ Verify quote is marked as converted (can't convert again)

---

## 📄 PART 4: FIX "VIEW QUOTE" BUTTON + QUOTE DETAIL PAGE

### CONTEXT
"View Quote" button doesn't work. Need to create quote detail page.

**File:** `frontend/src/pages/customer/QuoteDetail.tsx`

Create this new file:

```typescript
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { toast } from 'react-toastify';

export default function QuoteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(false);

  useEffect(() => {
    loadQuote();
  }, [id]);

  const loadQuote = async () => {
    try {
      console.log('Loading quote:', id);
      const response = await api.get(`/quotes/${id}`);
      console.log('Quote response:', response.data);
      setQuote(response.data.quote || response.data);
    } catch (error) {
      console.error('Load quote error:', error);
      toast.error('Failed to load quote: ' + (error.response?.data?.message || error.message));
      navigate('/quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleConvertToOrder = async () => {
    if (!window.confirm('Convert this quote to an order? This will submit it for admin approval.')) {
      return;
    }

    try {
      setConverting(true);
      console.log('Converting quote to order:', id);
      const response = await api.post(`/quotes/${id}/convert-to-order`);
      console.log('Convert response:', response.data);
      toast.success('Quote converted to order successfully!');
      navigate('/orders/my-orders');
    } catch (error) {
      console.error('Convert error:', error);
      toast.error(error.response?.data?.message || 'Failed to convert quote');
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-xl text-gray-600">Loading quote...</div>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">Quote not found</p>
        <button onClick={() => navigate('/quotes')} className="mt-4 text-blue-600 hover:underline">
          Back to Quotes
        </button>
      </div>
    );
  }

  // Parse items
  const quoteItems = typeof quote.items === 'string' 
    ? JSON.parse(quote.items) 
    : quote.items;

  return (
    <div className="quote-detail p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Quote Details</h1>
        <p className="text-gray-600 mt-2">Quote #{quote.quoteNumber}</p>
      </div>

      {/* Quote Info Card */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm text-gray-500">Quote Number:</span>
            <p className="font-semibold">{quote.quoteNumber}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Created:</span>
            <p className="font-semibold">{new Date(quote.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Expires:</span>
            <p className="font-semibold">{new Date(quote.expiresAt).toLocaleDateString()}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Status:</span>
            <p>
              {quote.convertedToOrderId ? (
                <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-semibold">
                  Converted to Order
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-semibold">
                  Active Quote
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-bold mb-4">Quoted Items ({quoteItems.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Size</th>
                <th className="px-4 py-3 text-left">Fabric</th>
                <th className="px-4 py-3 text-left">Motor/Chain</th>
                <th className="px-4 py-3 text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {quoteItems.map((item, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3">{index + 1}</td>
                  <td className="px-4 py-3">{item.location}</td>
                  <td className="px-4 py-3">{item.width} × {item.drop} mm</td>
                  <td className="px-4 py-3 text-sm">
                    {item.material} - {item.fabricType} - {item.fabricColour}
                  </td>
                  <td className="px-4 py-3 text-sm">{item.chainOrMotor}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    ${parseFloat(item.price).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pricing Summary */}
      <div className="bg-gray-50 rounded-lg p-6 mb-6">
        <div className="max-w-md ml-auto">
          <div className="flex justify-between py-2">
            <span className="text-gray-600">Subtotal:</span>
            <span className="font-semibold">${parseFloat(quote.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 border-t border-gray-300 text-lg font-bold">
            <span>Total:</span>
            <span>${parseFloat(quote.total).toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 justify-between">
        <button
          onClick={() => navigate('/quotes')}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          ← Back to Quotes
        </button>

        <div className="flex gap-4">
          {!quote.convertedToOrderId && (
            <button
              onClick={handleConvertToOrder}
              disabled={converting}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 disabled:opacity-50"
            >
              {converting ? 'Converting...' : '🔄 Convert to Order'}
            </button>
          )}

          {quote.convertedToOrderId && (
            <button
              onClick={() => navigate(`/orders/${quote.convertedToOrderId}`)}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-green-700"
            >
              View Order →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

**File:** `frontend/src/App.tsx`

Add this route:

```typescript
import QuoteDetail from './pages/customer/QuoteDetail';

// In routes section
<Route path="/quotes/:id" element={<QuoteDetail />} />
```

**File:** `frontend/src/pages/customer/MyQuotes.tsx`

Update the "View Quote" button:

```typescript
// Find the button and update to:
<button
  onClick={() => navigate(`/quotes/${quote.id}`)}
  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
>
  View Quote
</button>
```

### VERIFICATION STEPS
1. ✅ Go to "My Quotes" page
2. ✅ Click "View Quote" button on any quote
3. ✅ Verify: Quote detail page opens (not 404)
4. ✅ Verify: Quote number, dates, status shown correctly
5. ✅ Verify: All items listed in table
6. ✅ Verify: Total price correct
7. ✅ Click "Convert to Order" button
8. ✅ Verify: Redirects to My Orders after conversion

---

## 📊 PART 5: FIX DASHBOARD QUOTE COUNT + ENHANCEMENTS

### CONTEXT
Dashboard shows incorrect active quote count (includes converted quotes).

**File:** `frontend/src/pages/customer/Dashboard.tsx`

Update stats calculation:

```typescript
const [stats, setStats] = useState({
  totalOrders: 0,
  pendingOrders: 0,
  activeQuotes: 0,
  completedOrders: 0
});

useEffect(() => {
  loadStats();
}, []);

const loadStats = async () => {
  try {
    console.log('Loading dashboard stats...');

    // Load orders
    const ordersRes = await api.get('/web-orders/my-orders');
    const orders = ordersRes.data.orders || ordersRes.data || [];
    console.log('Orders loaded:', orders.length);

    // Load quotes
    const quotesRes = await api.get('/quotes/my-quotes');
    const quotes = quotesRes.data.quotes || quotesRes.data || [];
    console.log('Quotes loaded:', quotes.length);

    // Calculate stats
    const activeQuotesCount = quotes.filter(q => !q.convertedToOrderId).length;
    console.log('Active quotes (non-converted):', activeQuotesCount);

    setStats({
      totalOrders: orders.length,
      pendingOrders: orders.filter(o => o.status === 'PENDING').length,
      activeQuotes: activeQuotesCount, // FIXED: Only count non-converted quotes
      completedOrders: orders.filter(o => o.status === 'COMPLETED').length
    });

  } catch (error) {
    console.error('Load stats error:', error);
    toast.error('Failed to load dashboard statistics');
  }
};

// In the JSX, display stats
<div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-gray-500 text-sm font-medium">Total Orders</h3>
    <p className="text-3xl font-bold text-gray-800 mt-2">{stats.totalOrders}</p>
  </div>

  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-gray-500 text-sm font-medium">Pending Orders</h3>
    <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.pendingOrders}</p>
  </div>

  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-gray-500 text-sm font-medium">Active Quotes</h3>
    <p className="text-3xl font-bold text-blue-600 mt-2">{stats.activeQuotes}</p>
  </div>

  <div className="bg-white rounded-lg shadow p-6">
    <h3 className="text-gray-500 text-sm font-medium">Completed Orders</h3>
    <p className="text-3xl font-bold text-green-600 mt-2">{stats.completedOrders}</p>
  </div>
</div>
```

### BONUS: AUTO-SAVE PROGRESS ENHANCEMENT

Add this to `NewOrder.tsx` for automatic draft saving:

```typescript
// Add after state declarations
useEffect(() => {
  // Auto-save draft
  if (blinds.length > 0 || isBlindPartiallyFilled(currentBlind)) {
    const draft = {
      blinds,
      currentBlind,
      timestamp: Date.now()
    };
    localStorage.setItem('order_draft', JSON.stringify(draft));
    console.log('📝 Draft auto-saved');
  }
}, [blinds, currentBlind]);

// Load draft on mount
useEffect(() => {
  const draftStr = localStorage.getItem('order_draft');
  if (draftStr) {
    try {
      const draft = JSON.parse(draftStr);
      // Only restore if less than 24 hours old
      const hoursOld = (Date.now() - draft.timestamp) / (1000 * 60 * 60);
      
      if (hoursOld < 24) {
        if (window.confirm('You have an unsaved draft from ' + new Date(draft.timestamp).toLocaleString() + '. Restore it?')) {
          setBlinds(draft.blinds || []);
          setCurrentBlind(draft.currentBlind || initialBlindState);
          toast.success('Draft restored!');
        } else {
          localStorage.removeItem('order_draft');
        }
      } else {
        localStorage.removeItem('order_draft'); // Remove old drafts
      }
    } catch (e) {
      console.error('Failed to parse draft:', e);
      localStorage.removeItem('order_draft');
    }
  }
}, []); // Run once on mount

// Clear draft when order submitted successfully
const handleSubmitOrder = async () => {
  // ... existing submit logic ...
  // After successful submission:
  localStorage.removeItem('order_draft');
  console.log('✅ Draft cleared after order submission');
};
```

### VERIFICATION STEPS
1. ✅ Create 3 quotes
2. ✅ Convert 1 quote to order
3. ✅ Go to Dashboard
4. ✅ Verify "Active Quotes" shows 2 (NOT 3)
5. ✅ Verify other stats are correct
6. ✅ Test auto-save: Start creating order, refresh page
7. ✅ Verify: Draft restore prompt appears
8. ✅ Accept restore, verify blinds are restored

---

## ✅ FINAL TESTING CHECKLIST

After completing all 5 parts, test the complete workflow:

### End-to-End Order Creation
- [ ] Login as customer
- [ ] Navigate to New Order
- [ ] Fill Blind #1, click "Update & Copy"
- [ ] Verify Location/Width/Drop cleared, others copied
- [ ] Fill Blind #2, click "Update & Continue Adding"
- [ ] Verify all fields cleared
- [ ] Add Blind #3
- [ ] Click "Finish & Review Order"
- [ ] Submit as Order
- [ ] Verify appears in "My Orders" with status PENDING
- [ ] Verify no 500 errors in console

### Quote Workflow
- [ ] Create quote with 2 blinds
- [ ] Save as quote
- [ ] Go to "My Quotes"
- [ ] Click "View Quote"
- [ ] Verify quote detail page loads
- [ ] Click "Convert to Order"
- [ ] Verify redirects to "My Orders"
- [ ] Verify order created with PENDING status

### Admin Inventory
- [ ] Logout, login as admin
- [ ] Click "Inventory" link
- [ ] Verify inventory page loads (not redirect)
- [ ] Verify items display correctly
- [ ] Test search functionality
- [ ] Test category filter

### Dashboard Stats
- [ ] Create 3 quotes
- [ ] Convert 1 to order
- [ ] Go to Dashboard
- [ ] Verify "Active Quotes" = 2 (not 3)

**ALL BUGS FIXED!** ✅