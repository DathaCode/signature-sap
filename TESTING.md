# Signature Shades Warehouse Management System - Testing Documentation

## Testing Overview

This document outlines comprehensive testing procedures for the Signature Shades warehouse management system.

---

## 1. Unit Tests

### Backend Unit Tests

#### Excel Parser Tests
```bash
# Test Excel parsing from Row 13
docker exec signatureshades-api-local npm test -- excel-parser.test.ts

# Test cases:
- ✓ Parses Excel file starting from Row 13
- ✓ Extracts all 12 required columns
- ✓ Handles empty cells gracefully
- ✓ Validates data types
```

#### Business Logic Tests
```bash
# Test dimension calculations
docker exec signatureshades-api-local npm test -- calculations.test.ts

# Test cases:
- ✓ Width calculation: Original - 28mm
- ✓ Drop calculation: Original + 150mm
- ✓ Handles edge cases (negative results, very large numbers)
```

#### Inventory Service Tests
```bash
# Test inventory deduction logic
docker exec signatureshades-api-local npm test -- inventory.test.ts

# Test cases:
- ✓ Deducts correct quantities
- ✓ Prevents negative inventory
- ✓ Creates audit trail entries
- ✓ Handles concurrent deductions
```

### Frontend Unit Tests

#### Form Validation Tests
```bash
# Run frontend unit tests
docker exec signatureshades-web-local npm test

# Test cases:
- ✓ Validates required fields
- ✓ File upload validation (.xlsm only)
- ✓ Quantity input validation (positive numbers)
```

---

## 2. Integration Tests

### Order Processing Integration
```bash
# Test complete order flow
1. Upload Excel file → Verify parsing
2. Check inventory → Verify availability check
3. Confirm order → Verify deduction
4. Generate worksheets → Verify data accuracy
```

### Database Integration
```bash
# Test database operations
1. Create inventory item → Verify in DB
2. Adjust quantity → Verify transaction record
3. Delete item → Verify soft delete
```

---

## 3. End-to-End Test Scenarios

### 🧪 Test Scenario 1: Complete Order Workflow

**Objective**: Test the full order processing pipeline from Excel upload to worksheet download.

**Steps**:
1. ✅ Navigate to http://localhost:3000
2. ✅ Click "Upload Order" button
3. ✅ Upload sample .xlsm file (Signature Format v20.xlsm)
4. ✅ **Verify** parsed data displays in preview table
5. ✅ **Verify** calculated width = Original - 28mm
6. ✅ **Verify** calculated drop = Original + 150mm
7. ✅ **Verify** duplicate fabrics highlighted in yellow
8. ✅ **Verify** inventory availability indicators (green/red badges)
9. ✅ **Verify** "Confirm Order" button enabled if sufficient stock
10. ✅ Click "Confirm Order"
11. ✅ **Verify** success message appears
12. ✅ Navigate to "Worksheets" tab
13. ✅ **Verify** Fabric Cut Worksheet has 12 columns
14. ✅ **Verify** Tube Cut Worksheet has 5 columns
15. ✅ Click "Download CSV" → **Verify** file downloads correctly
16. ✅ Open CSV → **Verify** format and data accuracy
17. ✅ Click "Download PDF" → **Verify** file downloads
18. ✅ Open PDF → **Verify** company header, table formatting, yellow highlighting
19. ✅ Navigate to "Inventory Dashboard"
20. ✅ **Verify** material quantities decreased correctly

**Expected Results**:
- All calculations accurate
- Inventory deducted atomically
- Worksheets formatted correctly
- Downloads work without errors

---

### 🧪 Test Scenario 2: Inventory Management

**Objective**: Test inventory CRUD operations and quantity adjustments.

**Steps**:
1. ✅ Navigate to "Inventory Dashboard"
2. ✅ **Verify** summary cards display correct counts
3. ✅ Click "Add New Item" button
4. ✅ Fill form:
   - Category: Fabric
   - Name: "Test Fabric Red"
   - Color: "Crimson"
   - Quantity: 5000
   - Min Stock Alert: 1000
5. ✅ Click "Add Item"
6. ✅ **Verify** item appears in table
7. ✅ **Verify** status badge shows "In Stock"
8. ✅ Click "Adjust Quantity" icon
9. ✅ Select "Add Stock", enter 2000mm, note: "Received shipment"
10. ✅ Click "Confirm Adjustment"
11. ✅ **Verify** new balance: 7000mm
12. ✅ Click "View History" icon
13. ✅ **Verify** transaction history shows:
    - Initial stock: +5000mm
    - Adjustment: +2000mm
    - New balance: 7000mm
14. ✅ Click "Adjust Quantity" again
15. ✅ Select "Remove Stock", enter 6500mm
16. ✅ **Verify** new balance preview: 500mm
17. ✅ **Verify** status changes to "Low Stock" (below 1000mm)
18. ✅ Confirm adjustment
19. ✅ **Verify** low stock badge appears
20. ✅ **Verify** "Low Stock Alerts" summary card increments

**Expected Results**:
- All CRUD operations work correctly
- Audit trail is complete
- Low stock detection works
- UI updates reactively

---

### 🧪 Test Scenario 3: Error Handling

**Objective**: Test application resilience to invalid inputs and edge cases.

**Steps**:
1. ✅ Upload invalid file type (.xlsx instead of .xlsm)
   - **Expect**: Error message "Invalid file format"
2. ✅ Upload Excel with missing columns
   - **Expect**: Error message specifying missing column
3. ✅ Upload order requiring 10,000mm fabric when only 5,000mm available
   - **Expect**: Red badge, "Insufficient inventory" message, "Confirm Order" disabled
4. ✅ Try to create duplicate inventory item (same category, name, color)
   - **Expect**: Error "Item already exists"
5. ✅ Try to adjust quantity to negative value
   - **Expect**: Error "Cannot adjust quantity below zero"
6. ✅ Try to delete inventory item with pending order
   - **Expect**: Error "Cannot delete item with active orders"
7. ✅ Upload Excel with 0mm width
   - **Expect**: Calculate 0 - 28 = -28mm, flag as invalid or handle gracefully
8. ✅ Test concurrent order confirmations (open 2 tabs, confirm same order twice)
   - **Expect**: One succeeds, one fails with "Order already confirmed"

**Expected Results**:
- All error messages clear and helpful
- No crashes or undefined behavior
- Data integrity maintained

---

## 4. Performance Tests

### Load Testing
```bash
# Test with large Excel files
1. Upload Excel with 100 rows
   - Expected: Parse in < 5 seconds
   - Expected: Preview renders without lag

2. Generate PDF with 100+ items
   - Expected: Complete in < 3 seconds
   - Expected: File size reasonable (< 5MB)

3. Inventory dashboard with 500+ items
   - Expected: Initial load < 2 seconds
   - Expected: Search/filter responsive (< 500ms)
```

### Concurrent Users
```bash
# Test multiple simultaneous operations
1. Open 3 browser tabs
2. Each tab: Upload order, confirm simultaneously
3. Verify inventory deducted correctly (no race conditions)
4. Verify all audit trails accurate
```

---

## 5. Mobile Responsiveness Tests

### Device Testing Matrix

| Device | Resolution | Status |
|--------|------------|--------|
| iPhone SE | 375px | ✅ Test tables scroll horizontally |
| iPhone 12 | 390px | ✅ Test forms are usable |
| iPad | 768px | ✅ Test multi-column layouts |
| Desktop | 1920px | ✅ Test full layout |

**Test Checklist**:
- ✅ Navigation menu accessible on mobile
- ✅ Tables scroll horizontally without breaking layout
- ✅ Buttons large enough to tap (min 44x44px)
- ✅ Forms don't overlap on small screens
- ✅ Modal dialogs fit in viewport
- ✅ File upload works on mobile

---

## 6. Docker Environment Tests

### Local Development
```bash
# Test hot-reload
1. Start: docker-compose up -d
2. Edit backend/src/server.ts → Add console.log
3. Verify: Backend container restarts automatically
4. Verify: Log appears in docker-compose logs -f backend

5. Edit frontend/src/App.tsx → Change title
6. Verify: Browser hot-reloads automatically
7. Verify: Title changes without full page reload
```

### Production Build
```bash
# Test production builds
1. Build: docker-compose -f docker-compose.prod.yml build
2. Verify: All stages complete without errors
3. Verify: Image sizes reasonable (backend < 500MB, frontend < 50MB)
4. Run: docker-compose -f docker-compose.prod.yml up -d
5. Verify: All services start successfully
6. Verify: Health check passes at /health
7. Verify: Nginx routes /api to backend
8. Verify: Nginx serves frontend from /
```

---

## 7. Database Tests

### Migrations
```bash
# Test Prisma migrations
1. Run: docker exec signatureshades-api-local npx prisma migrate dev
2. Verify: Migration completes without errors
3. Verify: All tables created
4. Verify: Indexes created

# Test rollback
1. Run: docker exec signatureshades-api-local npx prisma migrate reset
2. Verify: Database reset successfully
3. Verify: Seed data recreated
```

### Data Integrity
```bash
# Test foreign key constraints
1. Create order with items
2. Try to delete inventory item used in order
3. Verify: Deletion blocked or fails gracefully

# Test transaction atomicity
1. Confirm order (deducts multiple inventory items)
2. Simulate failure mid-transaction
3. Verify: Either all items deducted or none
```

---

## 8. Security Tests

### Input Validation
```bash
# Test SQL injection prevention
- Input: "'; DROP TABLE orders; --" in customer name
- Expected: Sanitized, no SQL execution

# Test XSS prevention
- Input: "<script>alert('XSS')</script>" in fabric name
- Expected: Escaped, script not executed
```

### File Upload Security
```bash
# Test file type validation
- Upload: .exe file renamed to .xlsm
- Expected: Rejected based on content, not just extension

# Test file size limits
- Upload: 100MB Excel file
- Expected: Rejected with "File too large" error
```

---

## 9. Backup & Recovery Tests

### Backup Script
```bash
# Test backup.sh
1. Run: ./backup.sh
2. Verify: Database dump created in ./backups/
3. Verify: Uploads folder archived
4. Verify: Old backups (>7 days) deleted
5. Verify: Backup naming includes timestamp
```

### Recovery
```bash
# Test database restore
1. Create test order
2. Run backup
3. Delete order
4. Restore from backup
5. Verify: Order reappears with same data
```

---

## 10. Deployment Tests

### Deploy Script
```bash
# Test deploy.sh
1. Make code change
2. Commit to GitHub
3. Run: ./deploy.sh
4. Verify: Latest code pulled
5. Verify: Containers rebuilt
6. Verify: Migrations run
7. Verify: Health check passes
8. Verify: No downtime > 30 seconds
```

### CI/CD Pipeline
```bash
# Test GitHub Actions
1. Push to main branch
2. Verify: Workflow triggered
3. Verify: SSH connection successful
4. Verify: deploy.sh executed on server
5. Verify: Deployment status reported
```

---

## Test Results Checklist

Before marking Phase 7 complete, verify:

- [ ] Local development works with `docker-compose up`
- [ ] Hot-reload functions for both frontend and backend
- [ ] Excel upload and parsing works correctly
- [ ] Inventory deduction works correctly (atomic transactions)
- [ ] CSV downloads work with correct format
- [ ] PDF downloads work with highlighting and formatting
- [ ] All 3 E2E test scenarios pass completely
- [ ] Mobile responsiveness verified on 4+ screen sizes
- [ ] Production build completes without errors
- [ ] Nginx reverse proxy routes correctly
- [ ] Backup script creates valid backups
- [ ] Deploy script executes without errors
- [ ] Documentation is complete and accurate
- [ ] No console errors in browser
- [ ] No uncaught exceptions in backend logs

---

## Troubleshooting Common Issues

### Issue: Docker containers won't start
```bash
# Solution:
1. Check Docker Desktop is running
2. Check ports not in use: netstat -an | findstr "3000 5000 5432"
3. Restart Docker Desktop
4. Run: docker-compose down -v && docker-compose up -d
```

### Issue: Prisma client not found
```bash
# Solution:
docker exec signatureshades-api-local npx prisma generate
docker-compose restart backend
```

### Issue: Frontend can't connect to backend
```bash
# Solution:
1. Verify VITE_API_URL in .env
2. Check backend logs: docker-compose logs backend
3. Verify CORS_ORIGIN includes frontend URL
```

### Issue: Hot-reload not working
```bash
# Solution:
1. Verify volume mounts in docker-compose.yml
2. Check file change detection in Windows: enable WSL2
3. Restart containers: docker-compose restart
```

---

## Performance Benchmarks

**Target Performance Metrics**:
- Excel parsing (50 rows): < 2 seconds
- Order confirmation: < 1 second
- PDF generation (50 items): < 2 seconds
- CSV generation (100 items): < 1 second
- Inventory dashboard load (500 items): < 2 seconds
- Search/filter response: < 500ms
- API response time (avg): < 200ms

---

**Last Updated**: Phase 7 Completion
**Test Coverage Target**: > 80% for critical paths
