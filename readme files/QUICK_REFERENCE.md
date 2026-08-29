# Quick Reference Card - Alerts, Metrics & Monitoring

## 🚀 Quick Start (3 Steps)

### Step 1: Setup Database
```sql
-- Supabase SQL Editor → New Query
-- Copy/Paste: CREATE_ASSET_METRICS_TABLE.sql
-- Click: RUN
```

### Step 2: Start Backend Services
```powershell
# Terminal 1: Flask API
cd backend; .\venv\Scripts\Activate.ps1; python app.py

# Terminal 2: Metric Simulator
cd backend; python simulate_metrics.py
```

### Step 3: Start Frontend
```powershell
cd frontend; npm run dev
# Open: http://localhost:5173
```

---

## 📡 API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/assets/summary` | JWT | Get asset counts & distribution |
| GET | `/api/alerts` | JWT (Admin) | Get critical/warning alerts |
| GET | `/api/assets/:id/metrics` | JWT | Get real-time metrics for asset |

---

## 🎯 Feature Locations

### Dashboard (`/dashboard`)
- **DashboardMetrics:** 4 summary cards + type distribution
- **AdminAlerts:** Red/yellow banner (admin only)
- **Quick Actions:** Add Asset button

### Asset Details (`/assets/:id`)
- **Metrics Section:** Real-time monitoring data
- **Health Badge:** Healthy/Warning/Critical
- **Auto-refresh:** Every 10 seconds

### Asset Operations
- **Create/Edit/Delete:** Toast notifications
- **Form validation:** Error toasts
- **Permission checks:** Warning toasts

---

## 📊 Metrics by Asset Type

### 💻 Hardware
- CPU Usage (%)
- Memory Usage (%)
- Disk Usage (%)
- Temperature (°C)

### 📀 Software
- Operational Status
- Uptime (hours)
- Last Error

### 🌐 Network
- Bandwidth (Mbps)
- Packet Loss (%)
- Latency (ms)
- Active Connections

### 🏗️ Infrastructure
- Service Status
- Response Time (ms)
- Error Rate (%)
- Availability (%)

---

## 🎨 Color Codes

### Health Status
- 🟢 **Green:** Healthy
- 🟡 **Yellow:** Warning
- 🔴 **Red:** Critical

### Thresholds
| Metric | Warning | Critical |
|--------|---------|----------|
| CPU/Memory | >75% | >90% |
| Temperature | >65°C | >75°C |
| Packet Loss | >2% | >5% |
| Service | Degraded | Down |

---

## ⏱️ Auto-refresh Intervals

- **Dashboard Metrics:** 30 seconds
- **Admin Alerts:** 15 seconds
- **Asset Details Metrics:** 10 seconds
- **Metric Simulator:** 4 seconds

---

## 🔔 Toast Notifications

```jsx
// Import
import toast from 'react-hot-toast';

// Success
toast.success('Operation successful!');

// Error
toast.error('Operation failed!');

// Loading
const id = toast.loading('Processing...');
toast.success('Done!', { id });
```

---

## 🤖 Metric Simulator

### Run
```powershell
cd backend
python simulate_metrics.py
```

### Stop
Press `Ctrl+C`

### Output
```
✓ Asset-Name [type] - Updated (Healthy)
⚠ Asset-Name [type] - Updated (Warning)
❌ Asset-Name [type] - Updated (Critical)
✗ Asset-Name [type] - Failed
```

### Failure Rate
- **5%** probability of critical issues
- **95%** normal operation

---

## 🧪 Quick Test Checklist

1. [ ] Dashboard shows real metrics (not 0)
2. [ ] Admin sees alert banner
3. [ ] Toast appears on asset create
4. [ ] Asset details show live metrics
5. [ ] Metrics auto-update
6. [ ] Simulator console shows updates
7. [ ] Health colors change correctly

---

## 🐛 Quick Fixes

### Problem: Metrics show 0
**Fix:** Run CREATE_ASSET_METRICS_TABLE.sql

### Problem: No toast notifications
**Fix:** Check if `<Toaster />` in App.jsx

### Problem: Alerts not showing
**Fix:** Verify user role is 'admin'

### Problem: Simulator fails
**Fix:** Check SUPABASE_ANON_KEY in .env

---

## 📁 Key Files

### Database
- `CREATE_ASSET_METRICS_TABLE.sql`

### Backend
- `backend/app.py` (endpoints)
- `backend/simulate_metrics.py` (simulator)

### Frontend Components
- `frontend/src/components/DashboardMetrics.jsx`
- `frontend/src/components/AdminAlerts.jsx`

### Frontend Pages
- `frontend/src/pages/Dashboard.jsx`
- `frontend/src/pages/Asset/Details.jsx`
- `frontend/src/pages/Asset/Form.jsx`
- `frontend/src/pages/Asset/List.jsx`

### Documentation
- `ALERTS_METRICS_MONITORING_GUIDE.md` (detailed)
- `IMPLEMENTATION_SUMMARY.md` (overview)
- `QUICK_REFERENCE.md` (this file)

---

## 🎯 Component Props

### DashboardMetrics
- **No props required**
- Fetches data automatically
- Auto-refreshes every 30s

### AdminAlerts
- **No props required**
- Only renders for admin users
- Auto-refreshes every 15s

---

## 🔐 Security Notes

- All endpoints require JWT token
- Admin alerts require 'admin' role
- RLS policies enforce database security
- Simulator uses anon key (safe)
- CORS limited to localhost:5173

---

## 📞 Support

**Documentation:**
- Full Guide: `ALERTS_METRICS_MONITORING_GUIDE.md`
- Summary: `IMPLEMENTATION_SUMMARY.md`
- This Card: `QUICK_REFERENCE.md`

**Common Issues:**
See "🐛 Quick Fixes" section above

---

## ✅ Success Indicators

- ✓ Dashboard loads without errors
- ✓ Metrics display real numbers
- ✓ Toasts appear on actions
- ✓ Admin sees alerts
- ✓ Asset details show metrics
- ✓ Simulator runs without errors
- ✓ Colors change with values

---

**Status:** ✅ All features implemented and ready!

**Quick Start Time:** ~5 minutes (database + start services)

**Last Updated:** 2025-11-04
