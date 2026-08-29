# Manual Test Cases: Metrics & Monitoring
# ITIMS - Metrics & Monitoring Module

**Module:** Metrics & Monitoring  
**Test Date:** ___________  
**Tester Name:** ___________

---

## TEST-MTR-001: View Asset Metrics Dashboard

**Requirement:** Users can view metrics for hardware assets  
**Priority:** High

### Preconditions
- Logged in as any user
- Hardware asset with metrics exists

### Test Steps
1. Navigate to Assets page
2. Click on a hardware asset
3. View Metrics tab/section

### Expected Result
- Metrics displayed:
  - CPU Usage (%)
  - Memory Usage (%)
  - Disk Usage (%)
  - Temperature (°C)
  - Health Status
- Visual gauges or charts
- Last Updated timestamp

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-002: Metrics Auto-Refresh

**Requirement:** Metrics update periodically  
**Priority:** Medium

### Preconditions
- Viewing asset metrics page
- Backend simulation running

### Test Steps
1. Open asset metrics
2. Note current metrics
3. Wait 30 seconds
4. Observe if metrics update

### Expected Result
- Metrics refresh automatically
- New data loaded without page refresh
- "Last Updated" timestamp changes
- Loading indicator during refresh

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-003: Critical CPU Usage Alert

**Requirement:** System generates alert when CPU > 90%  
**Priority:** Critical

### Preconditions
- Asset with CPU usage > 90% exists
- Metrics collected

### Test Steps
1. Navigate to Alerts page
2. Check for CPU alert

### Expected Result
- Alert generated with severity "Critical"
- Message: "Critical - CPU: XX.X%"
- Asset name and details shown
- Timestamp of alert
- Red/critical color coding

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-004: Critical Memory Usage Alert

**Requirement:** System generates alert when Memory > 90%  
**Priority:** Critical

### Test Steps
1. Check alerts for asset with high memory
2. Verify alert details

### Expected Result
- Alert shows "Memory: XX.X%"
- Severity: Critical
- Properly categorized

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-005: High Temperature Alert

**Requirement:** Alert when temperature > 75°C  
**Priority:** High

### Test Steps
1. Asset with temp > 75°C
2. Check alerts

### Expected Result
- Alert: "Temp: XX.X°C"
- Critical severity
- Asset flagged

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-006: High Disk Usage Alert

**Requirement:** Alert when disk > 80%  
**Priority:** High

### Test Steps
1. Asset with disk usage > 80%
2. Verify alert generated

### Expected Result
- Alert message includes "Disk: XX.X%"
- Warning or critical severity

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-007: View All Alerts

**Requirement:** Users can view all system alerts  
**Priority:** High

### Test Steps
1. Navigate to Alerts page
2. View alert list

### Expected Result
- All alerts displayed
- Sorted by severity (critical first)
- Shows: Asset, Message, Severity, Time
- Color coding by severity
- Count of alerts shown

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-008: Filter Alerts by Severity

**Requirement:** Users can filter alerts  
**Priority:** Medium

### Test Steps
1. On Alerts page
2. Apply filter: Severity = "Critical"
3. Observe results

### Expected Result
- Only critical alerts shown
- Filter badge displayed
- Count updated

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-009: Healthy Asset - No Alerts

**Requirement:** Healthy assets don't generate alerts  
**Priority:** Medium

### Preconditions
- Asset with all metrics in healthy range:
  - CPU < 80%
  - Memory < 80%
  - Temp < 70°C
  - Disk < 75%

### Test Steps
1. Check alerts for this asset
2. Verify no alerts exist

### Expected Result
- No alerts for healthy asset
- Health status = "Healthy"
- Asset marked with green/healthy indicator

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-010: Warning Level Metrics

**Requirement:** System shows warnings before critical  
**Priority:** Medium

### Preconditions
- Asset with metrics in warning range:
  - CPU 80-90%
  - Memory 80-90%

### Test Steps
1. View asset metrics
2. Check health status
3. Check alerts

### Expected Result
- Health status = "Warning"
- Warning-level alert generated
- Yellow/orange color coding

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-011: Software Asset Metrics

**Requirement:** Software assets have appropriate metrics  
**Priority:** Medium

### Test Steps
1. View software asset
2. Check metrics section

### Expected Result
- Shows: Operational status, Last check, Errors
- No hardware-specific metrics (CPU, temp)

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-012: Network Asset Metrics

**Requirement:** Network assets show network-specific metrics  
**Priority:** Medium

### Test Steps
1. View network asset (router/switch)
2. Check metrics

### Expected Result
- Shows: Packet loss %, Latency, Uptime
- Network-specific visualizations

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-013: Peripheral Device Metrics

**Requirement:** Peripherals show device-specific metrics  
**Priority:** Medium

### Preconditions
- Peripheral asset exists (printer)

### Test Steps
1. View peripheral asset
2. Check metrics

### Expected Result
- Shows: Connection status, Print status
- Peripheral-specific fields:
  - Paper jam status
  - Toner level
  - Device errors

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-014: Alert for Disconnected Peripheral

**Requirement:** Alert when peripheral disconnected  
**Priority:** High

### Test Steps
1. Peripheral with connection_status = "disconnected"
2. Check alerts

### Expected Result
- Alert: "Device Disconnected"
- Severity: Critical or Warning
- Asset identified

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-015: Alert for Printer Offline

**Requirement:** Alert for offline printers  
**Priority:** Medium

### Test Steps
1. Printer with print_status = "offline"
2. Check alerts

### Expected Result
- Alert: "Offline" or "Printer Offline"
- Appropriate severity

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-016: Asset Summary Statistics

**Requirement:** Dashboard shows asset health summary  
**Priority:** High

### Test Steps
1. Navigate to Dashboard
2. View asset summary section

### Expected Result
- Total assets count
- Healthy assets count/percentage
- Warning assets count
- Critical assets count
- Visual breakdown (pie chart/cards)

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-017: Historical Metrics (if implemented)

**Requirement:** View historical metrics data  
**Priority:** Low

### Test Steps
1. View asset metrics
2. Select "History" or date range
3. Observe historical data

### Expected Result
- Chart showing metrics over time
- Can select date range
- Trend visualization

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-018: Multiple Critical Conditions

**Requirement:** Asset with multiple issues shows all in alert  
**Priority:** Medium

### Preconditions
- Asset with:
  - CPU > 90%
  - Memory > 90%
  - Temp > 75°C

### Test Steps
1. Check alert for this asset
2. Verify message

### Expected Result
- Alert message lists all critical conditions
- E.g., "Critical - CPU: 95%, Memory: 92%, Temp: 80°C"

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-019: Asset in Maintenance Status

**Requirement:** Assets in maintenance generate warnings  
**Priority:** Medium

### Test Steps
1. Asset with status = "Maintenance"
2. Check alerts

### Expected Result
- Warning alert: "Asset status: maintenance"
- Severity: Warning
- Indicates asset is offline for maintenance

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-020: Damaged Asset Alert

**Requirement:** Damaged assets flagged in alerts  
**Priority:** High

### Test Steps
1. Asset with status = "Damaged"
2. Check alerts

### Expected Result
- Alert: "Asset status: damaged"
- Warning severity
- Clearly visible

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-021: No Alerts When All Healthy

**Requirement:** Alert page shows "No alerts" when system healthy  
**Priority:** Low

### Preconditions
- All assets healthy
- No critical/warning conditions

### Test Steps
1. Navigate to Alerts page
2. Observe display

### Expected Result
- Message: "No alerts" or "All systems healthy"
- Count = 0
- Friendly/positive message

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-MTR-022: Alert Timestamp Accuracy

**Requirement:** Alerts show accurate timestamps  
**Priority:** Medium

### Test Steps
1. View alert
2. Check timestamp vs system time

### Expected Result
- Timestamp matches actual time of alert
- Format: readable date/time
- Time zone correct

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## Summary
**Total:** 22 | **Executed:** ___ | **Passed:** ___ | **Failed:** ___ | **Pass Rate:** ___%

**Tester:** _______________  
**Date:** _______________
