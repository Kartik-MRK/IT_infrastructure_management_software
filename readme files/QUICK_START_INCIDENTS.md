# 🚀 Quick Start Guide - Incident Management System

## Prerequisites
- ✅ Backend running on `http://localhost:5000`
- ✅ Frontend running on `http://localhost:5173`
- ✅ Supabase project configured
- ✅ User authentication working

---

## Step 1: Deploy Database Schema (REQUIRED FIRST!)

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy and Paste SQL**
   - Open file: `CREATE_INCIDENTS_TABLE.sql`
   - Copy ALL 292 lines
   - Paste into SQL Editor

4. **Execute**
   - Click "Run" or press `Ctrl+Enter`
   - Wait for "✓ Success. No rows returned" message

5. **Verify Table Created**
   - Go to "Table Editor" in Supabase
   - Find "incidents" table in list
   - Should have 15 columns (id, title, description, etc.)

---

## Step 2: Restart Backend (if running)

```powershell
# Stop backend if running (Ctrl+C)
# Navigate to backend folder
cd "e:\College_Documents\sem-5\SE Lab\DEM\main\backend"

# Restart
python app.py
```

**Expected Output:**
```
🚀 Flask backend starting...
📊 GET /api/incidents endpoint registered
📊 POST /api/incidents endpoint registered
📊 PUT /api/incidents/:id endpoint registered
```

---

## Step 3: Test Frontend

### 3.1 Report an Incident
1. Open browser: `http://localhost:5173`
2. Log in with your credentials
3. Click **"Report Incident"** in navigation bar
4. Fill out the form:
   - **Title**: "Test Incident"
   - **Description**: "This is a test incident"
   - **Severity**: Critical
   - **Priority**: 8
   - **Category**: Hardware (optional)
   - **Asset**: Select any asset (optional)
5. Click **"Submit Incident"**
6. ✅ You should see: **Toast notification** "Incident reported successfully!"
7. ✅ Check sidebar: Your incident appears in "My Recent Incidents"

### 3.2 View All Incidents (Admin)
1. If you're an **admin**, click **"Manage Incidents"** in navigation
2. ✅ You should see: List of all incidents
3. Try the filters:
   - Search for "Test"
   - Filter by severity: "Critical"
   - Filter by status: "Open"

### 3.3 Update Incident Status (Admin/Assignee)
1. In incident list, find your test incident
2. Change **status dropdown** to "In Progress"
3. ✅ Toast notification: "Incident status updated successfully!"
4. Click **"Mark as Resolved"**
5. ✅ Badge changes to green "resolved"

### 3.4 Test Auto-Refresh
1. Stay on incident list page
2. Open browser DevTools (F12) → Network tab
3. Wait 30 seconds
4. ✅ You should see: New GET request to `/api/incidents`
5. ✅ Console shows no errors

---

## Step 4: Verify Everything Works

### Check Database
```sql
-- Run in Supabase SQL Editor
SELECT 
  title, 
  severity, 
  status, 
  reported_at 
FROM incidents 
ORDER BY reported_at DESC 
LIMIT 5;
```
✅ You should see your test incident

### Check Backend Logs
Backend console should show:
```
📊 GET /api/incidents called
✅ Fetched 1 incidents
```

### Check Frontend
- Navigation shows "Report Incident" (all users)
- Navigation shows "Manage Incidents" (admin only)
- Both pages load without errors
- Toast notifications appear on actions

---

## 🎉 Success Checklist

- [x] `CREATE_INCIDENTS_TABLE.sql` executed successfully
- [x] Backend shows incident endpoints on startup
- [x] Can report new incident via form
- [x] Toast notification appears on submit
- [x] Incident appears in "My Recent Incidents"
- [x] Can view incident list (if admin)
- [x] Can filter incidents by status/severity
- [x] Can update incident status
- [x] Auto-refresh works (30 seconds)
- [x] No console errors in browser

---

## 🐛 Common Issues & Fixes

### Issue 1: "Error creating incident"
**Cause**: incidents table not created
**Fix**: 
1. Go to Supabase → SQL Editor
2. Run `CREATE_INCIDENTS_TABLE.sql`
3. Verify table exists in Table Editor

### Issue 2: "Permission denied"
**Cause**: RLS policies not applied
**Fix**:
1. Go to Supabase → Authentication → Policies
2. Check incidents table has 6 policies
3. Ensure "Enable RLS" is turned ON

### Issue 3: Can't see "Manage Incidents" link
**Expected**: This link only shows for **admins**
**Fix**: Check your user role in profiles table:
```sql
SELECT id, email, role FROM profiles WHERE email = 'your_email@example.com';
```

### Issue 4: Auto-refresh not working
**Fix**:
1. Open DevTools Console (F12)
2. Look for errors
3. Ensure backend is running on port 5000
4. Check CORS settings in app.py

---

## 📧 Optional: Configure Email Alerts

If you want critical incidents to send emails:

### Option 1: Use Gmail SMTP
1. Create `.env` file in backend folder (if not exists)
2. Add:
```env
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
ADMIN_EMAIL=admin@example.com
```
3. In `app.py`, uncomment email sending code in `send_critical_incident_email()`
4. Install: `pip install flask-mail`

### Option 2: Skip for Now
- Email function is a placeholder
- System works without email
- You'll see console logs instead

---

## Next Steps

1. **Test Different User Roles**:
   - Create operator and viewer accounts
   - Test permissions (what they can/can't do)

2. **Create More Incidents**:
   - Try different severities
   - Link to different assets
   - Assign to different users

3. **Monitor Performance**:
   - Check database response times
   - Test with 50+ incidents
   - Verify filters work correctly

4. **Document Your Day 6-7 Work**:
   - See `INCIDENT_MANAGEMENT_IMPLEMENTATION.md` for full details
   - Take screenshots for your report
   - Note any custom changes you made

---

## 📸 Screenshots to Take (for your report)

1. Incident Report form (filled out)
2. "My Recent Incidents" sidebar with incidents
3. Incident List page with filters
4. Incident card showing severity badges
5. Status update in action
6. Toast notification success message
7. Database table showing incident data
8. Backend logs showing API calls

---

## 🎯 You're Done!

Your Incident Management System is now **fully operational**!

**What you've implemented:**
- ✅ Complete backend API (6 endpoints)
- ✅ Database schema with RLS
- ✅ Two frontend pages
- ✅ Real-time auto-refresh
- ✅ Role-based access control
- ✅ Toast notifications
- ✅ Email alert system (ready for SMTP)

**Time to celebrate!** 🎊

---

## Need Help?

Check `INCIDENT_MANAGEMENT_IMPLEMENTATION.md` for:
- Detailed API documentation
- Troubleshooting guide
- Advanced configuration
- Database queries for monitoring
- Future enhancement ideas

**Happy incident managing!** 🚀
