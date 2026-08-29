# Manual Test Cases: Asset Management
# ITIMS - Asset Management Module

**Module:** Asset Management  
**Test Date:** ___________  
**Tester Name:** ___________  
**Build Version:** ___________

---

## TEST-AST-001: Create Hardware Asset (Admin)

**Requirement:** Admin can create new hardware assets  
**Priority:** High  
**Test Type:** Functional

### Preconditions
- Logged in as admin@itims.com
- Navigate to Assets page → Add Asset button

### Test Steps
1. Click "Add New Asset" button
2. Enter asset details:
   - **Name:** Dell PowerEdge R740
   - **Type:** Hardware
   - **Status:** Active
   - **Description:** Production database server
   - **Serial Number:** SRV-2024-001
   - **Location:** Data Center A, Rack 5
   - **Purchase Date:** 2024-01-15
   - **Warranty Expiry:** 2027-01-15
   - **Cost:** $5,500.00
3. Click "Create Asset" button

### Expected Result
- Asset is created successfully
- Success message displayed
- Asset appears in asset list
- All entered data is saved correctly

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

### Notes/Defects
_[Any observations or bug IDs]_

---

## TEST-AST-002: Create Asset with Missing Required Fields

**Requirement:** System validates required fields  
**Priority:** High  
**Test Type:** Negative Testing

### Preconditions
- Logged in as admin@itims.com
- On Add Asset form

### Test Steps
1. Click "Add New Asset"
2. Leave "Name" field empty
3. Select Type: Hardware
4. Select Status: Active
5. Click "Create Asset"

### Expected Result
- Error message: "Name is required"
- Form does not submit
- Asset is not created
- User remains on form to correct

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-003: View Asset List (All Roles)

**Requirement:** All authenticated users can view asset list  
**Priority:** High  
**Test Type:** Functional

### Preconditions
- Logged in as any user (admin, operator, or viewer)
- At least 5 assets exist in system

### Test Steps
1. Navigate to Assets page
2. Observe asset list display
3. Check pagination (if >10 assets)
4. Verify asset cards show:
   - Asset name
   - Type badge
   - Status badge
   - Location
   - Serial number

### Expected Result
- All assets displayed in grid/list view
- Asset information visible and correct
- Pagination works if many assets
- Loading state shown during fetch

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-004: View Asset Details

**Requirement:** Users can view detailed asset information  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as any user
- Asset "Dell PowerEdge R740" exists

### Test Steps
1. Navigate to Assets page
2. Click on "Dell PowerEdge R740" asset card
3. Observe asset details page

### Expected Result
- Details page opens
- Shows all asset information:
  - Name, Type, Status
  - Description, Serial Number
  - Location, Purchase Date, Warranty
  - Cost, Assigned User
  - Creator, Created Date
- "Edit" button visible (if admin/operator)
- "Delete" button visible (if admin)

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-005: Edit Asset (Admin)

**Requirement:** Admin can edit any asset  
**Priority:** High  
**Test Type:** Functional

### Preconditions
- Logged in as admin@itims.com
- Asset exists with ID asset-123

### Test Steps
1. Navigate to asset details page
2. Click "Edit Asset" button
3. Modify fields:
   - Status: Active → Maintenance
   - Location: Data Center A → Data Center B
4. Click "Update Asset"

### Expected Result
- Asset updated successfully
- Success message shown
- Changes reflected immediately
- Updated_at timestamp changed

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-006: Edit Own Asset (Operator)

**Requirement:** Operator can edit assets they created  
**Priority:** High  
**Test Type:** Functional

### Preconditions
- Logged in as operator@itims.com
- Asset created by operator@itims.com exists

### Test Steps
1. Navigate to own asset
2. Click "Edit Asset"
3. Change Location field
4. Click "Update"

### Expected Result
- Update successful
- Changes saved
- Success message displayed

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-007: Cannot Edit Others' Assets (Operator)

**Requirement:** Operator cannot edit assets created by others  
**Priority:** High  
**Test Type:** Security / RBAC

### Preconditions
- Logged in as operator@itims.com
- Asset created by admin@itims.com exists

### Test Steps
1. Navigate to asset created by admin
2. Observe page/buttons

### Expected Result
- Edit button is NOT visible OR
- Edit button is disabled OR
- Clicking Edit shows "Unauthorized" error
- Asset cannot be modified

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-008: Viewer Cannot Create Asset

**Requirement:** Viewer role cannot create assets  
**Priority:** High  
**Test Type:** Security / RBAC

### Preconditions
- Logged in as viewer@itims.com
- On Assets page

### Test Steps
1. Navigate to Assets page
2. Look for "Add New Asset" button

### Expected Result
- "Add New Asset" button is NOT visible
- No way to access asset creation form
- Attempting direct URL access returns 403 Forbidden

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-009: Delete Asset (Admin Only)

**Requirement:** Only admin can delete assets  
**Priority:** High  
**Test Type:** Functional

### Preconditions
- Logged in as admin@itims.com
- Test asset exists (not critical asset)

### Test Steps
1. Navigate to asset details
2. Click "Delete Asset" button
3. Confirm deletion in modal/prompt
4. Verify deletion

### Expected Result
- Confirmation prompt appears
- After confirmation, asset deleted
- Success message shown
- Asset no longer in list
- Redirect to assets page

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-010: Filter Assets by Type

**Requirement:** Users can filter assets by type  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as any user
- Assets of multiple types exist (hardware, software, network)

### Test Steps
1. Navigate to Assets page
2. Click filter dropdown
3. Select "Type: Hardware"
4. Observe results

### Expected Result
- Only hardware assets displayed
- Filter badge shows "Hardware"
- Count updated
- Can clear filter to show all

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-011: Filter Assets by Status

**Requirement:** Users can filter assets by status  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as any user
- Assets with different statuses exist

### Test Steps
1. Navigate to Assets page
2. Select Status filter: "Maintenance"
3. Observe filtered results

### Expected Result
- Only assets with "Maintenance" status shown
- Filter applied correctly
- Count matches filtered results

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-012: Search Assets by Name

**Requirement:** Users can search assets by name  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as any user
- Multiple assets exist

### Test Steps
1. Navigate to Assets page
2. Enter "Dell" in search box
3. Observe search results

### Expected Result
- Assets with "Dell" in name displayed
- Search is case-insensitive
- Real-time or on-submit search works
- Clear search returns all assets

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-013: Assign Asset to User

**Requirement:** Admin can assign assets to users  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as admin@itims.com
- Asset and target user exist

### Test Steps
1. Edit asset
2. Select "Assigned To" dropdown
3. Choose user (e.g., operator@itims.com)
4. Save asset

### Expected Result
- Asset assigned to selected user
- Assignment saved in database
- Shows user name on asset card
- User can see "My Assets" filter

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-014: Create Software Asset with License Info

**Requirement:** Software assets support license details  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as admin@itims.com

### Test Steps
1. Click "Add New Asset"
2. Enter details:
   - Name: Microsoft Office 365
   - Type: Software
   - Status: Active
   - Description: Enterprise license for 50 users
   - Serial Number: XXXXX-XXXXX-XXXXX
   - Purchase Date: 2024-01-01
   - Warranty Expiry: 2025-01-01
   - Cost: $2,500
3. Save asset

### Expected Result
- Software asset created
- All fields saved correctly
- Asset type badge shows "Software"

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-015: Create Network Asset

**Requirement:** System supports network asset type  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as operator@itims.com

### Test Steps
1. Create new asset
2. Set Type: Network
3. Enter details:
   - Name: Cisco Catalyst 9300
   - Status: Active
   - Location: Data Center A, Rack 1
   - Serial Number: FCW2234A001

### Expected Result
- Network asset created successfully
- Type badge shows "Network"

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-016: Create Peripheral Asset

**Requirement:** System supports peripheral devices  
**Priority:** Low  
**Test Type:** Functional

### Preconditions
- Logged in as operator@itims.com

### Test Steps
1. Create new asset
2. Set Type: Peripherals
3. Enter:
   - Name: HP LaserJet Pro M404dn
   - Status: Active
   - Location: Office Floor 2

### Expected Result
- Peripheral asset created
- Metrics may include printer-specific fields

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-017: View Asset Summary Dashboard

**Requirement:** Dashboard shows asset statistics  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Logged in as any user
- Multiple assets exist

### Test Steps
1. Navigate to Dashboard or Assets Summary
2. Observe statistics

### Expected Result
- Total asset count displayed
- Breakdown by type (hardware, software, network)
- Breakdown by status (active, maintenance, retired)
- Visual charts/graphs

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-018: Asset Pagination

**Requirement:** Asset list supports pagination  
**Priority:** Low  
**Test Type:** Functional

### Preconditions
- More than 10 assets exist
- Logged in as any user

### Test Steps
1. Navigate to Assets page
2. Observe pagination controls
3. Click "Next Page"
4. Click "Previous Page"

### Expected Result
- Shows 10 assets per page (or configured limit)
- Page controls work correctly
- Page number displayed
- Can jump to specific page

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-019: Asset Data Validation

**Requirement:** System validates asset data formats  
**Priority:** Medium  
**Test Type:** Validation

### Preconditions
- Logged in as admin@itims.com
- On create asset form

### Test Steps
1. Enter invalid data:
   - Cost: "abc" (non-numeric)
   - Purchase Date: "invalid-date"
   - Serial Number: (very long string, >100 chars)
2. Try to submit

### Expected Result
- Validation errors shown
- Form does not submit
- Clear error messages
- Fields highlighted in red

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## TEST-AST-020: Asset Status Transitions

**Requirement:** Asset status can be changed through valid transitions  
**Priority:** Medium  
**Test Type:** Functional

### Preconditions
- Asset with status "Active" exists
- Logged in as admin@itims.com

### Test Steps
1. Edit asset
2. Change status: Active → Maintenance
3. Save
4. Edit again
5. Change status: Maintenance → Retired
6. Save

### Expected Result
- All transitions work smoothly
- Status updated in database
- Status badge updated in UI
- History/audit log records changes (if implemented)

### Actual Result
_[To be filled during test execution]_

### Status
- [ ] PASS  
- [ ] FAIL  
- [ ] BLOCKED

---

## Summary

**Total Test Cases:** 20  
**Executed:** ___  
**Passed:** ___  
**Failed:** ___  
**Blocked:** ___  
**Pass Rate:** ___%

### Critical Issues Found
1. _[Issue description]_
2. _[Issue description]_

### Recommendations
_[Tester recommendations]_

---

**Tester Signature:** ________________  
**Date:** ________________
