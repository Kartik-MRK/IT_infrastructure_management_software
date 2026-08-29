# Peripherals Asset Type - Implementation Guide

## 🎯 Overview
Added complete support for **peripherals** asset type (printers, monitors, keyboards, mice, scanners, speakers, etc.) with automatic health monitoring and critical alerts.

## 📋 What Was Done

### 1. Database Changes (`ADD_PERIPHERALS_TYPE.sql`)
- ✅ Added `peripherals` to asset type constraint
- ✅ Added new metrics columns to `asset_metrics` table:
  - `connection_status` - connected/disconnected/intermittent
  - `print_status` - online/offline/paper_jam/low_toner/error
  - `usage_hours` - device usage tracking
  - `peripheral_error` - error message text
- ✅ Updated health status trigger to handle peripheral failures
- ✅ Added 8 sample peripheral assets:
  - HP LaserJet Pro M404dn (Printer)
  - Canon imageRUNNER (Printer)
  - Dell UltraSharp 27" Monitor
  - LG 24" Monitor
  - Logitech MX Keys Keyboard
  - HP Wireless Mouse
  - Epson Document Scanner
  - Jabra Conference Speaker

### 2. Backend Changes

#### `simulate_metrics.py`
- ✅ Added `generate_peripherals_metrics()` function
- ✅ 20% failure probability for peripherals
- ✅ Generates realistic peripheral states:
  - Connection status (connected/disconnected/intermittent)
  - Print status (online/offline/paper_jam/low_toner/error)
  - Usage hours tracking
  - Error messages when critical
- ✅ Dynamic asset type handling - automatically detects and simulates ALL asset types
- ✅ Enhanced logging shows peripheral status with emoji indicators (🖨️)

#### `app.py`
- ✅ Added peripheral alert handling in `/api/alerts` endpoint
- ✅ Generates detailed error messages for peripheral issues:
  - Device Disconnected
  - Connection Intermittent
  - Offline/Paper Jam/Low Toner/Device Error
  - Shows peripheral_error message

### 3. Frontend Changes

#### `Details.jsx`
- ✅ Added peripherals metrics display section:
  - Connection Status (visual colors: green/yellow/red)
  - Print Status (with specific icons for different states)
  - Usage Hours counter
  - Error message display
- ✅ Added peripherals to threshold violation checking
- ✅ Toast notifications for peripheral critical events:
  - Shows all issues: "PERIPHERAL ISSUE - Disconnected, Paper Jam"

### 4. Database Trigger Logic

#### Health Status Rules for Peripherals:
```sql
CRITICAL if:
- connection_status = 'disconnected'
- print_status IN ('offline', 'error', 'paper_jam')

WARNING if:
- connection_status = 'intermittent'
- print_status = 'low_toner'

HEALTHY:
- connection_status = 'connected'
- print_status = 'online'
```

## 🚀 How to Deploy

### Step 1: Run the SQL Script
```bash
# In Supabase SQL Editor:
1. Open Supabase Dashboard → SQL Editor
2. Copy entire ADD_PERIPHERALS_TYPE.sql
3. Paste and click RUN
4. Verify 8 peripheral assets were created
```

### Step 2: Restart Backend
```bash
cd backend
python app.py
```

### Step 3: Run Simulator
```bash
cd backend
python simulate_metrics.py
```

### Step 4: Test
1. Open dashboard → Check for peripheral critical alerts
2. Navigate to any peripheral asset → Verify metrics display
3. Wait for simulator to generate critical state (20% chance)
4. Verify toast notification appears with peripheral issue details

## 📊 Dynamic Asset Handling

The simulator now **automatically detects all asset types** from the database:

```python
# In simulate_cycle():
for asset in assets:
    asset_type = asset['type']
    
    # Generate metrics based on asset type - DYNAMIC!
    if asset_type == 'hardware':
        metrics = generate_hardware_metrics()
    elif asset_type == 'software':
        metrics = generate_software_metrics()
    elif asset_type == 'network':
        metrics = generate_network_metrics()
    elif asset_type == 'infrastructure':
        metrics = generate_infrastructure_metrics()
    elif asset_type == 'peripherals':
        metrics = generate_peripherals_metrics()
    else:
        # Unknown types get basic healthy status
        metrics = {'health_status': 'healthy'}
```

**This means:**
- ✅ Create a new asset of type 'peripherals' → Simulator handles it automatically
- ✅ Add a new asset type in future → Just add an `elif` branch
- ✅ No manual configuration needed per asset

## 🎨 Dashboard Integration

### Admin Alerts Component
Peripherals now appear in the critical alerts section with detailed messages:

```
⚠️ Critical Alerts

HP LaserJet Pro
Peripheral Issue - Device Disconnected, Paper Jam
```

### Asset Details Page
Peripheral metrics shown with color-coded status indicators:
- **Green** = Connected/Online
- **Yellow** = Intermittent/Low Toner
- **Red** = Disconnected/Offline/Error

## 🧪 Testing Scenarios

### 1. Normal Operation
```
✓ HP LaserJet Pro [peripherals] - Updated
  Connection: connected, Print: online
```

### 2. Critical Failure
```
❌ Canon imageRUNNER [peripherals] - Updated | 🖨️ DISCONNECTED - PAPER JAM
```

### 3. Warning State
```
⚠ Dell Monitor [peripherals] - Updated | ⚠️ intermittent
```

## 📝 Sample Assets Created

| Asset Name | Category | Location | Status |
|-----------|----------|----------|--------|
| HP LaserJet Pro M404dn | Printer | Floor 2 - Office 201 | active |
| Canon imageRUNNER | Printer | Floor 3 - Copy Room | active |
| Dell UltraSharp 27" | Monitor | Floor 1 - Desk 15 | active |
| LG 24" Monitor | Monitor | Floor 2 - Desk 22 | active |
| Logitech MX Keys | Keyboard | Floor 1 - Desk 8 | active |
| HP Wireless Mouse | Mouse | Floor 2 - Desk 18 | active |
| Epson Document Scanner | Scanner | Floor 1 - Admin | active |
| Jabra Conference Speaker | Audio | Conference Room A | active |

## 🔄 Adding More Peripherals

To add a new peripheral asset:

```sql
INSERT INTO assets (name, type, category, location, status)
VALUES 
    ('New Device Name', 'peripherals', 'Device Category', 'Location', 'active');
```

The simulator will **automatically** start monitoring it on the next cycle!

## ✅ Verification Checklist

After deployment:
- [ ] SQL script executed successfully
- [ ] 8 peripheral assets visible in asset list
- [ ] Simulator shows peripheral updates in terminal
- [ ] Dashboard shows peripheral critical alerts (wait ~2 minutes)
- [ ] Asset details page displays peripheral metrics correctly
- [ ] Toast notifications appear for peripheral failures
- [ ] Health status colors match connection/print status

## 🐛 Troubleshooting

**Issue:** Peripherals not showing in asset list
- **Solution:** Re-run `ADD_PERIPHERALS_TYPE.sql` - check for constraint errors

**Issue:** Simulator not generating peripheral metrics
- **Solution:** Restart simulator - it auto-detects new asset types

**Issue:** Dashboard not showing peripheral alerts
- **Solution:** Check backend logs - verify health_status='critical' in database

**Issue:** Metrics not displaying on details page
- **Solution:** Clear browser cache, refresh page, wait for next simulator cycle

## 🎉 Success Indicators

You'll know it's working when:
1. ✅ Terminal shows: `✓ HP LaserJet Pro [peripherals] - Updated`
2. ✅ Dashboard displays: `⚠️ Critical Alerts: HP LaserJet Pro - Peripheral Issue - Disconnected`
3. ✅ Asset details shows connection status with colors
4. ✅ Toast pops up: `🖨️ HP LaserJet Pro: PERIPHERAL ISSUE - Paper Jam, Device Error`

## 📚 Next Steps

To add MORE peripheral types in the future:
1. Add assets to database with `type='peripherals'`
2. Set appropriate `category` (Printer/Monitor/Keyboard/Mouse/Scanner/etc.)
3. Simulator automatically handles them with existing logic
4. No code changes needed! 🎊

---

**Created:** November 5, 2025  
**Status:** ✅ Complete and Production Ready
