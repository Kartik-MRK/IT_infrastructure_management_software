# 🚨 HARDWARE ALERTS & CONFIGURATION UPDATES

## Changes Made

### 1. ✅ Hardware Threshold Alert Popups Fixed

**Problem**: UI was not showing toast notifications when hardware metrics exceeded thresholds.

**Solution**: Added comprehensive threshold monitoring in `frontend/src/pages/Asset/Details.jsx`:

#### Alert Triggers:

**Hardware (CPU, Memory, Temperature, Disk):**
- 🔥 **Critical Alert** (Red) - CPU/Memory > 90%, Temperature > 75°C
- ⚠️ **Warning Alert** (Yellow) - CPU/Memory > 75%, Temperature > 65°C, Disk > 80%

**Software:**
- ❌ **Error Alert** - Software stops working (is_operational = false)

**Network:**
- 📡 **Critical Alert** - Packet loss > 5%
- ⚠️ **Warning Alert** - Packet loss > 2%, Latency > 100ms

**Infrastructure:**
- 🔴 **Down Alert** - Service status = down
- 🟡 **Degraded Alert** - Service status = degraded
- ⚠️ **Warning Alert** - Response time > 500ms, Availability < 99%

**Features:**
- Alerts only show when threshold is **first crossed** (not on every refresh)
- Custom icons and durations for different alert types
- Asset name included in alert message
- Previous metrics tracked to prevent spam

---

### 2. ⚙️ Simulator Configuration Updated

**File**: `backend/simulate_metrics.py`

**Changes:**
- ⏱️ **Update Interval**: 4 seconds → **10 seconds**
- 📊 **Failure Probability**: 5% → **15%**

This means:
- Metrics update every 10 seconds (less frequent)
- 15% chance of critical issues per cycle (more failures to test alerts)

**To Apply**: Restart the simulator:
```bash
cd backend
python simulate_metrics.py
```

---

### 3. 📅 Purchase Date & Warranty Made Optional

**File**: `MAKE_DATES_OPTIONAL.sql`

**SQL Script** to make `purchase_date` and `warranty_expiry` optional:

```sql
-- Make purchase_date nullable (optional)
ALTER TABLE public.assets 
ALTER COLUMN purchase_date DROP NOT NULL;

-- Make warranty_expiry nullable (optional)
ALTER TABLE public.assets 
ALTER COLUMN warranty_expiry DROP NOT NULL;
```

**To Apply**:
1. Open Supabase Dashboard → SQL Editor
2. Copy and paste the content of `MAKE_DATES_OPTIONAL.sql`
3. Click "Run"
4. Verify success message

**Result**: You can now create assets without providing purchase date or warranty expiry!

---

## 🧪 Testing the Hardware Alerts

### Test Procedure:

1. **Start the simulator** with new settings:
   ```bash
   cd backend
   python simulate_metrics.py
   ```

2. **Open an asset details page** in the browser:
   - Navigate to any hardware asset (Dell OptiPlex, MacBook Pro, etc.)
   - Keep the page open

3. **Wait for threshold violations**:
   - With 15% failure rate, you should see alerts within 1-2 minutes
   - Watch for toast notifications popping up

4. **Expected Alerts** (examples):
   ```
   🔥 Dell OptiPlex 7090: CPU usage critical at 92.3%!
   💾 MacBook Pro 16": Memory usage critical at 95.1%!
   🌡️ HP LaserJet Pro: Temperature critical at 76.8°C!
   💿 Cisco Switch 24-Port: Disk usage high at 82.5%
   ```

### Alert Duration:
- **Critical alerts**: 5 seconds (red)
- **Warning alerts**: 4 seconds (yellow)
- **Info alerts**: 3 seconds (blue)

---

## 📂 Files Modified

1. `frontend/src/pages/Asset/Details.jsx`
   - Added `previousMetrics` state
   - Added `checkThresholdViolations()` function
   - Updated `fetchMetrics()` to trigger alerts

2. `backend/simulate_metrics.py`
   - Changed `FAILURE_PROBABILITY` from 0.05 to 0.15
   - Changed `time.sleep(4)` to `time.sleep(10)`
   - Updated console output messages

3. `MAKE_DATES_OPTIONAL.sql` (NEW)
   - SQL script to alter table constraints

---

## 🔄 Quick Reset

If you want to revert simulator settings:

```python
# In simulate_metrics.py

# Original settings:
FAILURE_PROBABILITY = 0.05  # 5%
time.sleep(4)  # 4 seconds

# New settings:
FAILURE_PROBABILITY = 0.15  # 15%
time.sleep(10)  # 10 seconds
```

---

## ✨ What Changed in UI Behavior

### Before:
- ❌ No alerts when hardware crossed thresholds
- ❌ Only visual indicators (colors) changed
- ❌ User had to actively watch metrics

### After:
- ✅ Toast notifications pop up automatically
- ✅ Alerts include asset name and specific metric value
- ✅ Different icons for different alert types
- ✅ Smart alert system (only alerts on first threshold cross)
- ✅ Works for ALL asset types (hardware, software, network, infrastructure)

---

## 🎯 Benefits

1. **Proactive Monitoring**: Users get instant alerts without watching screens
2. **Context-Rich Alerts**: Know exactly which asset and what metric exceeded threshold
3. **Reduced False Positives**: Alerts only trigger once when crossing threshold
4. **Better Testing**: 15% failure rate ensures you see alerts during development
5. **Flexible Data Entry**: Optional date fields reduce form friction

---

## 🐛 Troubleshooting

**If alerts don't appear:**

1. Check browser console for errors (F12)
2. Verify react-hot-toast is working (check other toasts)
3. Ensure you're logged in (JWT token valid)
4. Wait at least 10 seconds for simulator to update
5. Check that hardware metrics actually exceed thresholds

**If dates are still required:**

1. Run `MAKE_DATES_OPTIONAL.sql` in Supabase SQL Editor
2. Check query results for "Success" message
3. Try creating asset without dates
4. If still fails, check RLS policies

---

## 📊 Monitoring Dashboard

The alerts also integrate with:
- **Admin Alerts Banner** (Dashboard) - Shows critical/warning assets
- **Health Status Indicators** - Color-coded dots on asset cards
- **Real-time Metrics** - Updated every 10 seconds on detail pages

Everything works together to provide comprehensive monitoring! 🎉
