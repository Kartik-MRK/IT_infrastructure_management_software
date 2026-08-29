# Alerts, Dashboard Metrics, and Real-time Monitoring Setup Guide

## 🎯 Overview

This guide covers the complete implementation of:
1. **Toast Notifications** - Real-time success/error feedback
2. **Dashboard Metrics** - Live asset statistics and distribution
3. **Admin Alerts** - Critical issue notifications for administrators
4. **Real-time Asset Monitoring** - Live metrics for hardware, software, network, and infrastructure assets
5. **Metric Simulator** - Automated script to generate realistic monitoring data

---

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ React frontend running (`npm run dev`)
- ✅ Flask backend running (`python app.py`)
- ✅ Supabase database configured
- ✅ Assets table populated with sample data
- ✅ Admin account created

---

## 🗄️ Step 1: Create Asset Metrics Table

### Run SQL Script

1. Open **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy and paste the entire content of `CREATE_ASSET_METRICS_TABLE.sql`
3. Click **RUN**

### What This Creates:

**Table: `asset_metrics`**
- 📊 Hardware metrics: CPU, memory, disk usage, temperature
- 💻 Software metrics: Operational status, uptime, error logs
- 🌐 Network metrics: Bandwidth, packet loss, latency, connections
- 🏗️ Infrastructure metrics: Service status, response time, error rate, availability

**Features:**
- ✅ Automatic health status calculation (healthy/warning/critical)
- ✅ Row-level security (RLS) policies
- ✅ Auto-update timestamps with triggers
- ✅ View for latest metrics per asset
- ✅ Sample data initialization

### Verification:

```sql
-- Check table created
SELECT COUNT(*) FROM asset_metrics;

-- View latest metrics
SELECT * FROM asset_latest_metrics;

-- Check health distribution
SELECT health_status, COUNT(*) 
FROM asset_metrics 
GROUP BY health_status;
```

---

## 🔔 Step 2: Toast Notifications

### Already Installed:
- ✅ `react-hot-toast` package installed
- ✅ `<Toaster />` component added to `App.jsx`
- ✅ All asset CRUD operations updated with toast notifications

### Usage in Your Code:

```jsx
import toast from 'react-hot-toast';

// Success notification
toast.success('Asset created successfully!');

// Error notification
toast.error('Failed to delete asset');

// Loading notification
const loadingToast = toast.loading('Saving...');
// ... operation ...
toast.success('Saved!', { id: loadingToast });

// Custom notification
toast('Custom message', {
  icon: '👍',
  duration: 4000
});
```

### Test Notifications:

1. Navigate to `/assets`
2. Click **"Add New Asset"**
3. Fill form and submit → See success toast
4. Try editing an asset → See success toast
5. Try deleting an asset → See success toast
6. Try submitting invalid data → See error toast

---

## 📊 Step 3: Dashboard Metrics

### Components Created:

**`frontend/src/components/DashboardMetrics.jsx`**
- Real-time asset statistics
- Auto-refreshes every 30 seconds
- Shows total assets, active, maintenance, issues
- Displays asset distribution by type (hardware, software, network, infrastructure)

### API Endpoint:

**`GET /api/assets/summary`**
```json
{
  "summary": {
    "total": 15,
    "by_status": {
      "active": 8,
      "in_use": 4,
      "maintenance": 2,
      "retired": 1,
      "damaged": 0
    },
    "by_type": {
      "hardware": 7,
      "software": 4,
      "network": 2,
      "infrastructure": 2
    }
  }
}
```

### Features:
- 📈 4 summary cards with icons
- 🎨 Color-coded by status (green, yellow, red)
- 🔄 Auto-refresh every 30 seconds
- 📱 Responsive grid layout
- ⚡ Fast loading with skeleton screens

---

## 🚨 Step 4: Admin Alerts

### Components Created:

**`frontend/src/components/AdminAlerts.jsx`**
- Shows critical and warning alerts
- Only visible to admin users
- Auto-refreshes every 15 seconds
- Links to affected assets

### API Endpoint:

**`GET /api/alerts`** (Admin only)
```json
{
  "alerts": [
    {
      "id": "...",
      "severity": "critical",
      "asset_id": "...",
      "asset_name": "Server-01",
      "asset_type": "hardware",
      "message": "Critical CPU usage: 95.2%",
      "timestamp": "2025-11-04T10:30:00Z"
    }
  ],
  "count": 5
}
```

### Alert Types:

**Critical (Red):**
- Hardware: CPU/Memory > 90%
- Software: Not operational
- Network: Packet loss > 5%
- Infrastructure: Service down

**Warning (Yellow):**
- Hardware: CPU/Memory > 75%
- Network: Packet loss > 2%
- Infrastructure: Service degraded
- Assets in maintenance/damaged status

### Test Alerts:

1. Log in as admin
2. Dashboard shows alert banner (if issues exist)
3. Click **"View"** to go to asset details
4. Click **"Refresh"** to update alerts

---

## 📡 Step 5: Real-time Asset Metrics

### Asset Details Page Enhanced

Each asset type now shows relevant metrics:

### Hardware Assets:
- 🖥️ **CPU Usage** (with progress bar)
- 💾 **Memory Usage** (with progress bar)
- 💿 **Disk Usage**
- 🌡️ **Temperature**
- Color-coded (green < 75%, yellow < 90%, red ≥ 90%)

### Software Assets:
- ✅ **Operational Status** (Working/Not Working)
- ⏱️ **Uptime** (in hours)
- ❌ **Last Error** (if any)

### Network Assets:
- 📶 **Bandwidth Usage** (Mbps)
- 📉 **Packet Loss** (percentage)
- ⚡ **Latency** (milliseconds)
- 🔗 **Active Connections** (count)

### Infrastructure Assets:
- 🏥 **Service Status** (Healthy/Degraded/Down)
- ⏳ **Response Time** (milliseconds)
- ⚠️ **Error Rate** (percentage)
- ✅ **Availability** (percentage)

### API Endpoint:

**`GET /api/assets/:id/metrics`**
```json
{
  "metrics": {
    "id": "...",
    "asset_id": "...",
    "cpu_usage": 45.2,
    "memory_usage": 62.8,
    "health_status": "healthy",
    "last_updated": "2025-11-04T10:30:00Z"
  }
}
```

### Features:
- 🔄 Auto-refresh every 10 seconds
- 🎨 Color-coded health indicators
- 📊 Progress bars for usage metrics
- ⚡ Live status updates

---

## 🤖 Step 6: Metric Simulator

### Python Script: `backend/simulate_metrics.py`

This script automatically generates and updates realistic metrics for all assets.

### Features:

1. **Realistic Data Generation:**
   - Hardware: CPU 20-75%, Memory 30-75% (normal)
   - Software: 95% uptime probability
   - Network: Packet loss 0-1.5%, Latency 5-50ms
   - Infrastructure: 95% healthy status probability

2. **Failure Simulation:**
   - 5% probability of critical issues
   - Random error messages for software
   - High CPU/memory during failures
   - Service degradation/downtime

3. **Auto-Update:**
   - Updates every 4 seconds
   - Connects directly to Supabase
   - Uses anon key for security
   - Handles all asset types

### Requirements:

Install Python dependencies:

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install supabase python-dotenv
```

### Environment Variables:

Ensure your `backend/.env` has:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
```

### Run Simulator:

```powershell
cd backend
python simulate_metrics.py
```

### Expected Output:

```
============================================================
ASSET METRICS SIMULATOR
============================================================
Supabase URL: https://xxxxx.supabase.co
Update Interval: 4 seconds
Failure Probability: 5.0%
============================================================

============================================================
Simulation cycle at 2025-11-04 10:30:00
============================================================
✓ Dell OptiPlex 7090           [hardware       ] - Updated
✓ MacBook Pro 16"              [hardware       ] - Updated
✓ Microsoft Office 365         [software       ] - Updated
⚠ Cisco Switch 24-Port         [network        ] - Updated
❌ AWS EC2 Instance            [infrastructure ] - Updated

Waiting 4 seconds before next cycle...
```

### Symbols:
- ✓ = Healthy
- ⚠ = Warning
- ❌ = Critical
- ✗ = Failed to update

### Stop Simulator:

Press `Ctrl+C` to stop the script.

---

## 🧪 Testing Checklist

### ✅ Toast Notifications

- [ ] Asset creation shows success toast
- [ ] Asset update shows success toast
- [ ] Asset deletion shows success toast
- [ ] Invalid operations show error toast
- [ ] Toasts auto-dismiss after 3-4 seconds
- [ ] Multiple toasts stack properly

### ✅ Dashboard Metrics

- [ ] Dashboard loads metrics on page load
- [ ] Shows correct total asset count
- [ ] Active count = active + in_use
- [ ] Maintenance count accurate
- [ ] Issues count = damaged + retired
- [ ] Type distribution correct (hardware, software, etc.)
- [ ] Metrics auto-refresh every 30 seconds
- [ ] Loading skeleton shows while fetching

### ✅ Admin Alerts

- [ ] Alert banner only visible to admin users
- [ ] Shows "All Systems Operational" when no issues
- [ ] Critical alerts displayed in red banner
- [ ] Warning alerts displayed in yellow banner
- [ ] Each alert shows asset name and message
- [ ] "View →" link navigates to asset details
- [ ] Alerts auto-refresh every 15 seconds
- [ ] Manual refresh button works

### ✅ Asset Metrics Display

**Hardware:**
- [ ] CPU usage shows with progress bar
- [ ] Memory usage shows with progress bar
- [ ] Disk usage displays
- [ ] Temperature displays
- [ ] Color changes based on thresholds
- [ ] Critical values (>90%) show in red

**Software:**
- [ ] Operational status shows (Working/Not Working)
- [ ] Uptime hours display
- [ ] Last error shows when not operational

**Network:**
- [ ] Bandwidth usage displays
- [ ] Packet loss shows with color coding
- [ ] Latency displays
- [ ] Active connections count shows

**Infrastructure:**
- [ ] Service status displays (Healthy/Degraded/Down)
- [ ] Response time displays
- [ ] Error rate shows
- [ ] Availability percentage displays

**General:**
- [ ] Health status badge shows (Healthy/Warning/Critical)
- [ ] Last updated timestamp displays
- [ ] Metrics auto-refresh every 10 seconds
- [ ] Shows "No metrics available" when metrics missing

### ✅ Metric Simulator

- [ ] Script connects to Supabase successfully
- [ ] Updates all assets in database
- [ ] Generates realistic metrics for each type
- [ ] 5% failure rate working (occasional critical issues)
- [ ] Console output shows update status
- [ ] Updates visible in frontend immediately
- [ ] Script recovers from errors gracefully
- [ ] Can stop with Ctrl+C

---

## 🔧 Troubleshooting

### Issue: Toast notifications not showing

**Fix:**
1. Check if `<Toaster />` is in `App.jsx`
2. Verify `react-hot-toast` is installed: `npm list react-hot-toast`
3. Check browser console for errors
4. Clear browser cache and reload

### Issue: Dashboard metrics showing 0

**Fix:**
1. Verify assets exist in database: `SELECT COUNT(*) FROM assets;`
2. Check backend is running on port 5000
3. Verify JWT token is valid (check browser DevTools → Network tab)
4. Check CORS settings in backend `app.py`

### Issue: Admin alerts not visible

**Fix:**
1. Confirm user role is 'admin': `SELECT role FROM profiles WHERE email = 'your-email';`
2. Check `/api/alerts` endpoint works (test in Postman with JWT token)
3. Verify RLS policies allow admin to read metrics
4. Check browser console for errors

### Issue: Asset metrics not showing

**Fix:**
1. Confirm `asset_metrics` table exists: `SELECT * FROM asset_metrics LIMIT 1;`
2. Run metric simulator to generate data
3. Check `/api/assets/:id/metrics` endpoint works
4. Verify asset has metrics: `SELECT * FROM asset_metrics WHERE asset_id = 'your-asset-id';`

### Issue: Metric simulator fails to connect

**Fix:**
1. Verify `.env` file has correct `SUPABASE_URL` and `SUPABASE_ANON_KEY`
2. Check if `supabase` package is installed: `pip list | grep supabase`
3. Test Supabase connection in Python:
   ```python
   from supabase import create_client
   import os
   from dotenv import load_dotenv
   
   load_dotenv()
   supabase = create_client(os.getenv('SUPABASE_URL'), os.getenv('SUPABASE_ANON_KEY'))
   response = supabase.table('assets').select('id').limit(1).execute()
   print(response.data)
   ```
4. Check firewall/network settings

### Issue: Metrics not auto-refreshing

**Fix:**
1. Check browser console for errors
2. Verify `useEffect` cleanup function not causing issues
3. Test manual refresh by clicking buttons
4. Check if browser tab is active (some browsers pause intervals in background tabs)

---

## 📁 Files Created/Modified

### New Files:
1. `CREATE_ASSET_METRICS_TABLE.sql` - Database schema for metrics
2. `frontend/src/components/DashboardMetrics.jsx` - Metrics dashboard component
3. `frontend/src/components/AdminAlerts.jsx` - Alert banner component
4. `backend/simulate_metrics.py` - Metric simulation script

### Modified Files:
1. `frontend/src/App.jsx` - Added Toaster component
2. `frontend/src/pages/Dashboard.jsx` - Integrated metrics and alerts
3. `frontend/src/pages/Asset/Form.jsx` - Added toast notifications
4. `frontend/src/pages/Asset/List.jsx` - Added toast notifications
5. `frontend/src/pages/Asset/Details.jsx` - Added metrics display and toast notifications
6. `backend/app.py` - Added `/api/assets/summary`, `/api/alerts`, `/api/assets/:id/metrics` endpoints

---

## 🚀 Quick Start Commands

### 1. Setup Database:
```sql
-- Run in Supabase SQL Editor
-- Copy content from CREATE_ASSET_METRICS_TABLE.sql
```

### 2. Install Dependencies:
```powershell
# Frontend
cd frontend
npm install react-hot-toast

# Backend Python
cd backend
pip install supabase python-dotenv
```

### 3. Start Services:
```powershell
# Terminal 1: Backend
cd backend
.\venv\Scripts\Activate.ps1
python app.py

# Terminal 2: Frontend
cd frontend
npm run dev

# Terminal 3: Metric Simulator
cd backend
python simulate_metrics.py
```

### 4. Test:
1. Open http://localhost:5173
2. Login as admin
3. See dashboard with metrics and alerts
4. Navigate to asset details to see real-time metrics
5. Create/edit/delete assets to see toast notifications

---

## 🎉 Success Indicators

You'll know everything is working when:

1. ✅ Dashboard shows real asset counts (not 0)
2. ✅ Toast notifications appear on CRUD operations
3. ✅ Admin sees alert banner (if issues exist)
4. ✅ Asset details show live metrics with progress bars
5. ✅ Metrics auto-refresh every few seconds
6. ✅ Metric simulator console shows successful updates
7. ✅ Health status changes color based on thresholds
8. ✅ No errors in browser console or terminal

---

## 📊 Monitoring Dashboard Layout

```
+------------------------------------------------------------------+
|                      ITIMS Dashboard                              |
+------------------------------------------------------------------+
|                                                                   |
|  🚨 Critical Alerts (2) - Admin Only               [Refresh]     |
|  ├─ Server-01: Critical CPU usage 95%              [View →]      |
|  └─ Database-Main: Service down                    [View →]      |
|                                                                   |
+------------------------------------------------------------------+
|                                                                   |
|  📊 Dashboard Metrics                                            |
|  ┌──────────┬──────────┬──────────┬──────────┐                  |
|  │ Total: 15│ Active: 8│ Maint: 2 │ Issues: 1│                  |
|  └──────────┴──────────┴──────────┴──────────┘                  |
|                                                                   |
|  Asset Distribution by Type:                                     |
|  ├─ 💻 Hardware: 7                                               |
|  ├─ 📀 Software: 4                                               |
|  ├─ 🌐 Network: 2                                                |
|  └─ 🏗️ Infrastructure: 2                                         |
|                                                                   |
+------------------------------------------------------------------+
```

---

## 🔒 Security Notes

1. **JWT Authentication:** All API endpoints require valid JWT token
2. **Role-Based Access:** Admin alerts only visible to admin role
3. **RLS Policies:** Database enforces row-level security
4. **Anon Key Usage:** Metric simulator uses anon key (not service key) for safety
5. **CORS:** Backend only allows requests from `http://localhost:5173`

---

## 📚 Additional Resources

- **React Hot Toast Docs:** https://react-hot-toast.com/
- **Supabase Python Docs:** https://supabase.com/docs/reference/python
- **Flask JWT Extended:** https://flask-jwt-extended.readthedocs.io/

---

**Status:** ✅ **All Features Implemented and Ready for Testing!**

**Next Steps:** Run through the testing checklist and start the metric simulator to see live data updates in action! 🎉
