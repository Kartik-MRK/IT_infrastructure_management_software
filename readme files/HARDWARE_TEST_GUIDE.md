# 🧪 Hardware Alert Testing Guide

## Quick Start

### 1. Run the Test Injector
```bash
cd backend
python hardware_test.py
```

### 2. What It Does
- Finds ALL hardware assets in database
- Injects CRITICAL values every 5 seconds
- Alternates between 4 scenarios:
  1. 🔥 **Critical CPU**: 91-98% (Normal memory/temp/disk)
  2. 💾 **Critical Memory**: 91-98% (Normal CPU/temp/disk)
  3. 🌡️ **Critical Temperature**: 76-85°C (Normal CPU/memory/disk)
  4. 💥 **EXTREME**: Everything critical at once!

### 3. Expected Output
```
🧪 CRITICAL METRICS INJECTION at 15:23:45
======================================================================
🔥 Dell OptiPlex 7090              | CPU:94.3% MEM:65.2% TEMP:58.1°C DISK:62.5%
🔥 MacBook Pro 16"                 | CPU:62.1% MEM:95.8% TEMP:55.3°C DISK:58.9%
🔥 HP LaserJet Pro                 | CPU:58.3% MEM:61.2% TEMP:79.4°C DISK:60.1%
🔥 Dell Monitor 27"                | CPU:96.7% MEM:97.2% TEMP:81.5°C DISK:88.3%
──────────────────────────────────────────────────────────────────────
✅ Injected 4/4 critical metrics
💡 Open hardware asset pages NOW to see alerts!
──────────────────────────────────────────────────────────────────────
```

## Testing Steps

### Step 1: Start the Injector
```bash
python hardware_test.py
```

### Step 2: Open Browser
1. Navigate to any hardware asset (e.g., Dell OptiPlex 7090)
2. Open DevTools Console (F12 → Console)
3. Keep the page open

### Step 3: Watch for Alerts
**Console will show:**
```
=== THRESHOLD CHECK START ===
Asset: Dell OptiPlex 7090 Type: hardware
Previous metrics: {cpu_usage: 65.2, ...}
New metrics: {cpu_usage: 94.3, ...}
✓ Checking thresholds for hardware: Dell OptiPlex 7090
🔧 Hardware detected - checking CPU, Memory, Temp, Disk
  CPU: 65.2% → 94.3%
  🔥 TRIGGERING CPU CRITICAL ALERT!
```

**Toast will pop up:**
```
🔥 ⚠️ Dell OptiPlex 7090: CPU usage critical at 94.3%!
```

### Step 4: Test Different Scenarios
Wait for multiple cycles (5 seconds each) to see:
- CPU critical alert
- Memory critical alert
- Temperature critical alert
- Extreme (all critical) alert

### Step 5: Verify Admin Dashboard
1. Go to Dashboard (as admin)
2. Check "Admin Alerts" section at top
3. Should show critical hardware assets

## Comparison: Test Injector vs Normal Simulator

| Feature | hardware_test.py | simulate_metrics.py |
|---------|------------------|---------------------|
| **Purpose** | Testing alerts ONLY | Production simulation |
| **Values** | 100% CRITICAL | 15% critical, 85% normal |
| **Interval** | 5 seconds | 10 seconds |
| **Assets** | Hardware only | All types |
| **Use Case** | Debug alert system | Realistic monitoring |

## Troubleshooting

### ❌ No toasts appear
**Check:**
1. Click the purple "🧪 Test Alerts" button - Do toasts work?
2. Console shows "🔥 TRIGGERING CPU CRITICAL ALERT!" ?
3. Is this the SECOND fetch? (First fetch is skipped)

**Solution:** Wait for at least 2 cycles (10 seconds total)

### ❌ Console shows "First fetch - skipping alerts"
**This is NORMAL!** The first fetch after page load is always skipped to prevent spam. Wait 5 more seconds for the second cycle.

### ❌ Console shows "CPU: 94.3% → 94.5%" but no alert
**Cause:** Alert already triggered for this threshold crossing.

**Solution:** The alert only fires when CROSSING the threshold (going from ≤90% to >90%). To see it again:
1. Stop `hardware_test.py`
2. Run `simulate_metrics.py` for 10-20 seconds (gets normal values)
3. Restart `hardware_test.py`

### ❌ Database not updating
**Check:**
1. Is SUPABASE_SERVICE_KEY in .env?
2. Run `python check_metrics.py` to verify DB connection
3. Check Supabase dashboard for any errors

## When to Use Each Script

### Use `hardware_test.py` when:
- ✅ Testing if toast alerts work
- ✅ Debugging threshold detection logic
- ✅ Demonstrating the alert system
- ✅ Verifying admin alerts dashboard
- ✅ Quick testing without waiting for random critical values

### Use `simulate_metrics.py` when:
- ✅ Running the app normally
- ✅ Realistic demo with mixed healthy/critical assets
- ✅ Testing all asset types (hardware, software, network, infrastructure)
- ✅ Long-term monitoring simulation

## Clean Up

After testing, stop `hardware_test.py` and run the normal simulator:
```bash
# Stop test injector (Ctrl+C)

# Run normal simulator
python simulate_metrics.py
```

This will restore normal metric ranges and the system will show mostly healthy assets.

## Pro Tips

1. **Test multiple assets**: Open 2-3 hardware asset pages in different browser tabs simultaneously
2. **Test the test button**: Click "🧪 Test Alerts" first to verify toast system works
3. **Watch the cycle count**: Each cycle guarantees at least 1 critical metric per hardware asset
4. **Check admin dashboard**: Critical alerts appear there too with a 15-second refresh
5. **Use with debugger**: Add breakpoints in `Details.jsx` `checkThresholdViolations()` function

## Expected Behavior Timeline

```
t=0s:   Page loads → First metrics fetch → Skipped (no previous metrics)
t=5s:   Second fetch → Compares to first → ALERT if crossed threshold
t=10s:  Third fetch → No alert (already critical, not crossing)
t=15s:  Fourth fetch → No alert (still critical)

Stop injector, run normal simulator for 20s...

t=40s:  Fetch shows normal values (< 90%)
        
Restart injector...

t=45s:  Fetch shows critical → ALERT again! (crossed from normal to critical)
```

## Remove Test Button

Once testing is complete, remove the test button from `Details.jsx`:

```javascript
// Remove this section:
<button
  onClick={() => {
    toast.success('✅ Toast system working!', { duration: 3000 })
    // ... rest of test button
  }}
>
  🧪 Test Alerts
</button>
```

---

Happy testing! 🎉 The injector guarantees you'll see critical values and can test the alert system reliably.
