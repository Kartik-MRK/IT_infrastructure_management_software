# Asset Management Module - Setup & Testing Guide

## 🎉 Complete Implementation

The Asset Management module has been fully implemented with:
- ✅ Backend API with Flask + Supabase
- ✅ Frontend UI with React + Tailwind CSS
- ✅ Role-Based Access Control (RBAC)
- ✅ CRUD operations (Create, Read, Update, Delete)
- ✅ Search and filter functionality
- ✅ Sample data seeding

---

## 📋 Setup Instructions

### Step 1: Create Assets Table in Supabase

1. Go to Supabase Dashboard → **SQL Editor** → **New Query**
2. Open `CREATE_ASSETS_TABLE.sql` from project root
3. Copy the ENTIRE file
4. Paste and click **RUN**
5. Wait for success message
6. Verify table created: Go to **Table Editor** → You should see `assets` table

**What this does:**
- Creates `assets` table with all fields
- Sets up RLS policies for admin/operator/viewer
- Creates indexes for performance
- Seeds 10 sample assets (if admin user exists)

### Step 2: Verify Backend is Running

The backend has been updated with Asset API endpoints. Make sure it's running:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
python app.py
```

You should see:
```
Running on http://127.0.0.1:5000
```

### Step 3: Verify Frontend is Running

```powershell
cd frontend
npm run dev
```

You should see:
```
Local: http://localhost:5173/
```

### Step 4: Test Asset Management

1. **Log in** with your admin account (kartik.itims@gmail.com)
2. Click **"Assets"** in the navigation bar
3. You should see the Asset List page with sample assets

---

## 🔧 API Endpoints

### Backend Routes (Flask)

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/assets` | All authenticated | Get all assets |
| POST | `/api/assets` | Admin, Operator | Create new asset |
| GET | `/api/assets/<id>` | All authenticated | Get single asset |
| PUT | `/api/assets/<id>` | Admin, Operator (own) | Update asset |
| DELETE | `/api/assets/<id>` | Admin, Operator (own) | Delete asset |

### Request/Response Examples

**Create Asset (POST /api/assets):**
```json
{
  "name": "Dell Laptop",
  "type": "hardware",
  "status": "active",
  "description": "Development laptop",
  "serial_number": "DL123456",
  "location": "Office Floor 3",
  "purchase_date": "2024-01-15",
  "cost": 85000.00,
  "assigned_to": "user-uuid-here"
}
```

**Response:**
```json
{
  "message": "Asset created successfully",
  "asset": {
    "id": "asset-uuid",
    "name": "Dell Laptop",
    ...
  }
}
```

---

## 🎨 Frontend Pages

### 1. Asset List (`/assets`)
- **File:** `frontend/src/pages/AssetList.jsx`
- **Features:**
  - View all assets in table format
  - Search by name, description, serial number
  - Filter by type (hardware, software, network, infrastructure, other)
  - Filter by status (active, in_use, maintenance, damaged, retired)
  - Statistics cards (total, active, maintenance, hardware count)
  - Role-based action buttons (Edit/Delete)

### 2. Add Asset (`/assets/new`)
- **File:** `frontend/src/pages/AssetForm.jsx`
- **Access:** Admin and Operator only
- **Features:**
  - Form with all asset fields
  - Type and status dropdowns
  - Date pickers for purchase/warranty
  - Cost input with currency format
  - Assign to user dropdown
  - Form validation

### 3. View Asset (`/assets/:id`)
- **File:** `frontend/src/pages/AssetDetail.jsx`
- **Features:**
  - Full asset details in organized cards
  - Basic information, dates, assignment, status
  - Edit and Delete buttons (role-based)
  - Creator and assignee information
  - Formatted dates and currency

### 4. Edit Asset (`/assets/:id/edit`)
- **File:** `frontend/src/pages/AssetForm.jsx` (same component)
- **Access:** Admin or Operator (if they created it)
- **Features:**
  - Pre-populated form with existing data
  - Same validation as add form
  - Permission check on load

---

## 🔐 Role-Based Permissions

### 👑 Administrator (admin)
**Full Control:**
- ✅ View all assets
- ✅ Create assets
- ✅ Edit ANY asset
- ✅ Delete ANY asset
- ✅ Assign assets to users
- ✅ See "Add New Asset" button
- ✅ See Edit/Delete buttons on all assets

### ⚙️ Operator (operator)
**Limited Control:**
- ✅ View all assets
- ✅ Create assets
- ✅ Edit assets THEY created
- ✅ Delete assets THEY created
- ❌ Cannot edit/delete others' assets
- ✅ See "Add New Asset" button
- ✅ See Edit/Delete buttons only on their own assets

### 👁️ Viewer (viewer)
**Read-Only:**
- ✅ View all assets
- ❌ Cannot create assets
- ❌ Cannot edit assets
- ❌ Cannot delete assets
- ❌ No "Add New Asset" button
- ❌ No Edit/Delete buttons
- ✅ Can still view asset details

---

## 🧪 Testing Checklist

### Database Setup
- [ ] Run `CREATE_ASSETS_TABLE.sql` in Supabase
- [ ] Verify `assets` table exists
- [ ] Check RLS policies (6 policies should exist)
- [ ] Verify sample data loaded (10 assets)

### Backend API
- [ ] Backend server running on port 5000
- [ ] Test GET /api/assets (returns list)
- [ ] Test POST /api/assets (creates asset - admin/operator only)
- [ ] Test PUT /api/assets/:id (updates asset with permissions)
- [ ] Test DELETE /api/assets/:id (deletes with permissions)

### Frontend UI
- [ ] Frontend running on port 5173
- [ ] Navigate to /assets from dashboard
- [ ] Asset List page loads with data
- [ ] Search works (type in search box)
- [ ] Filters work (type and status dropdowns)
- [ ] Statistics cards show correct counts

### Admin User Testing
- [ ] Log in as admin (kartik.itims@gmail.com)
- [ ] See "Add New Asset" button
- [ ] Click button → Form opens
- [ ] Fill form and submit → Asset created
- [ ] See Edit/Delete buttons on ALL assets
- [ ] Click Edit → Form pre-populated
- [ ] Update asset → Changes saved
- [ ] Click Delete → Confirmation → Asset deleted
- [ ] Click asset name → Detail view opens

### Operator User Testing
- [ ] Create operator user (sign up, then promote role to 'operator')
- [ ] Log in as operator
- [ ] See "Add New Asset" button
- [ ] Create an asset
- [ ] See Edit/Delete buttons ONLY on own assets
- [ ] Try to edit another user's asset → Should fail or button hidden
- [ ] Edit own asset → Works
- [ ] Delete own asset → Works

### Viewer User Testing
- [ ] Create viewer user (default role on signup)
- [ ] Log in as viewer
- [ ] NO "Add New Asset" button
- [ ] NO Edit/Delete buttons on any assets
- [ ] Can view asset list
- [ ] Can click asset to see details
- [ ] Cannot perform any modifications

---

## 🎯 Asset Types and Statuses

### Asset Types:
1. **Hardware** 💻 - Physical equipment (laptops, desktops, monitors, printers)
2. **Software** 📀 - Software licenses (MS Office, Adobe, IDEs)
3. **Network** 🌐 - Network equipment (routers, switches, cables)
4. **Infrastructure** 🏗️ - Cloud resources (AWS, Azure, Firebase)
5. **Other** 📦 - Miscellaneous assets

### Asset Statuses:
1. **Active** ✅ - Fully functional and available
2. **In Use** 🔵 - Currently being used by someone
3. **Maintenance** 🔧 - Under repair or maintenance
4. **Damaged** ❌ - Broken or not working
5. **Retired** ⏸️ - No longer in use

---

## 📊 Sample Data

The setup script creates 10 sample assets:

**Hardware:**
- Dell OptiPlex 7090 (Desktop)
- MacBook Pro 16" (Laptop)
- HP LaserJet Pro (Printer)
- Dell Monitor 27" (Display)

**Software:**
- Microsoft Office 365
- Adobe Creative Cloud
- JetBrains IntelliJ IDEA

**Network:**
- Cisco Switch 24-Port

**Infrastructure:**
- AWS EC2 Instance
- Firebase Project

All assets are created by the admin user (kartik.itims@gmail.com).

---

## 🐛 Troubleshooting

### Issue: "Assets table does not exist"
**Fix:** Run `CREATE_ASSETS_TABLE.sql` in Supabase SQL Editor

### Issue: "Permission denied" when creating asset
**Fix:** 
1. Check user role in database: `SELECT role FROM profiles WHERE email = 'your-email'`
2. Ensure role is 'admin' or 'operator'
3. Check RLS policies are created

### Issue: Operator can edit all assets
**Fix:** RLS policies might not be working. Check:
1. RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'assets'`
2. Policies exist: `SELECT policyname FROM pg_policies WHERE tablename = 'assets'`
3. Re-run RLS section from `CREATE_ASSETS_TABLE.sql`

### Issue: No sample data
**Fix:** The seed script only runs if admin user exists. Check:
1. Admin user exists: `SELECT * FROM profiles WHERE email = 'kartik.itims@gmail.com'`
2. If not, create admin user first
3. Re-run the seed section from `CREATE_ASSETS_TABLE.sql`

### Issue: Search/Filter not working
**Fix:** 
1. Check browser console for errors
2. Refresh page
3. Clear search and filters
4. Check if assets exist in database

---

## 🚀 Next Steps

### Completed ✅
- [x] Database schema
- [x] Backend API endpoints
- [x] RBAC middleware
- [x] Frontend Asset List
- [x] Frontend Asset Form (Add/Edit)
- [x] Frontend Asset Detail View
- [x] Search and filter
- [x] Role-based UI elements
- [x] Sample data seeding

### Future Enhancements 🔮
- [ ] Asset assignment notifications
- [ ] Asset history/audit log
- [ ] Bulk import/export (CSV)
- [ ] Asset QR code generation
- [ ] Warranty expiry alerts
- [ ] Asset depreciation tracking
- [ ] File attachments (images, documents)
- [ ] Advanced reporting and analytics

---

## 📝 Quick Commands

### Run Database Setup
```sql
-- In Supabase SQL Editor
-- Copy and paste entire CREATE_ASSETS_TABLE.sql
```

### Start Backend
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python app.py
```

### Start Frontend
```powershell
cd frontend
npm run dev
```

### Check Asset Count
```sql
SELECT COUNT(*) FROM assets;
```

### View Assets by Type
```sql
SELECT type, COUNT(*) FROM assets GROUP BY type;
```

### View Assets by Creator
```sql
SELECT p.full_name, COUNT(a.*) as asset_count
FROM assets a
JOIN profiles p ON a.created_by = p.id
GROUP BY p.full_name;
```

---

## ✅ Success Criteria

You'll know everything is working when:
1. ✅ Assets table exists in Supabase
2. ✅ Sample assets visible in Asset List
3. ✅ Admin can create, edit, delete all assets
4. ✅ Operator can create and edit own assets
5. ✅ Viewer can only view assets
6. ✅ Search filters assets correctly
7. ✅ Type/Status filters work
8. ✅ Statistics show correct counts
9. ✅ No errors in console
10. ✅ Navigation between pages works smoothly

---

**Status:** ✅ **Asset Management Module Complete!**  
**Total Files Created:** 8  
**Backend Endpoints:** 5  
**Frontend Pages:** 3  
**RBAC Policies:** 6

**Ready for production testing! 🎉**
