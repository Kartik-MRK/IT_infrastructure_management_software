# Manual Test Cases: Incident Management
# ITIMS - Incident Management Module

**Module:** Incident Management  
**Test Date:** ___________  
**Tester Name:** ___________

---

## TEST-INC-001: Report New Incident (All Users)

**Requirement:** Any authenticated user can report incidents  
**Priority:** Critical

### Preconditions
- Logged in as any user (viewer, operator, admin)
- Navigate to Incidents → Report Incident

### Test Steps
1. Click "Report Incident" button
2. Fill form:
   - Title: "Database Server Unresponsive"
   - Description: "Production database not responding to connections"
   - Severity: Critical
   - Category: Infrastructure
   - Asset: (Select asset-db-001)
3. Click "Submit"

### Expected Result
- Incident created with status "Open"
- Success message displayed
- Incident ID generated
- Reporter set to current user
- Incident appears in incidents list

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-002: View Incident List

**Requirement:** Users can view all incidents  
**Priority:** High

### Test Steps
1. Navigate to Incidents page
2. Observe list display

### Expected Result
- All incidents displayed
- Shows: Title, Severity, Status, Reported By, Date
- Sorted by date (newest first)
- Severity badges color-coded (red=critical, yellow=high, etc.)

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-003: View Incident Details

**Requirement:** Users can view detailed incident information  
**Priority:** High

### Test Steps
1. Click on an incident from list
2. View details page

### Expected Result
- Shows all incident information
- Reporter name and date
- Assigned user (if any)
- Resolution notes (if resolved)
- Asset details (if linked)
- Timeline/history

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-004: Admin Assigns Incident to Operator

**Requirement:** Admin can assign incidents  
**Priority:** High

### Preconditions
- Logged in as admin
- Open incident exists

### Test Steps
1. Open incident details
2. Click "Assign"
3. Select operator from dropdown
4. Save assignment

### Expected Result
- Incident assigned to operator
- Status may change to "In Progress"
- Assignee shown on incident card
- Operator receives notification (if implemented)

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-005: Operator Updates Incident Status

**Requirement:** Assigned operator can update status  
**Priority:** High

### Preconditions
- Logged in as operator
- Incident assigned to operator

### Test Steps
1. Open assigned incident
2. Change status: Open → In Progress
3. Add progress notes
4. Save

### Expected Result
- Status updated
- Notes saved
- Updated timestamp recorded

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-006: Resolve Incident with Resolution Notes

**Requirement:** Assignee can resolve incidents  
**Priority:** Critical

### Preconditions
- Logged in as assigned operator/admin
- Incident status "In Progress"

### Test Steps
1. Open incident
2. Change status to "Resolved"
3. Enter resolution notes: "Restarted database service, optimized queries"
4. Save

### Expected Result
- Status → Resolved
- Resolved timestamp set
- Resolved by set to current user
- Resolution notes saved
- Incident marked complete

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-007: Close Resolved Incident

**Requirement:** Incidents can be closed after resolution  
**Priority:** Medium

### Test Steps
1. Open resolved incident
2. Change status to "Closed"
3. Save

### Expected Result
- Status → Closed
- Incident archived/read-only
- Cannot be reopened (or requires special permission)

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-008: Filter Incidents by Status

**Requirement:** Users can filter by status  
**Priority:** Medium

### Test Steps
1. Go to Incidents page
2. Apply filter: Status = "Open"
3. Observe results

### Expected Result
- Only open incidents shown
- Count updated
- Filter badge displayed

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-009: Filter Incidents by Severity

**Requirement:** Users can filter by severity  
**Priority:** Medium

### Test Steps
1. Apply filter: Severity = "Critical"
2. Observe results

### Expected Result
- Only critical severity incidents shown
- Properly filtered

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-010: Reporter Can Update Own Incident

**Requirement:** Reporter can update incidents they created  
**Priority:** High

### Preconditions
- Logged in as incident reporter

### Test Steps
1. Open own incident
2. Edit description or add notes
3. Save

### Expected Result
- Updates saved successfully
- Cannot change assigned_to (unless admin)

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-011: Unauthorized User Cannot Update Others' Incidents

**Requirement:** RBAC prevents unauthorized updates  
**Priority:** High

### Preconditions
- Logged in as viewer
- Viewing incident reported by someone else

### Test Steps
1. Try to edit incident
2. Observe permissions

### Expected Result
- Edit button not visible OR disabled OR
- Attempting update returns 403 Forbidden
- Incident remains unchanged

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-012: Delete Incident (Admin Only)

**Requirement:** Only admin can delete incidents  
**Priority:** Medium

### Preconditions
- Logged in as admin

### Test Steps
1. Open incident
2. Click "Delete" button
3. Confirm deletion

### Expected Result
- Incident deleted from system
- Removed from list
- Cannot be recovered (unless soft delete)

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-013: Incident Linked to Asset

**Requirement:** Incidents can be associated with assets  
**Priority:** Medium

### Test Steps
1. Create incident
2. Select asset from dropdown
3. Submit incident
4. View incident details

### Expected Result
- Asset linked to incident
- Asset name/details shown in incident
- Can click to view asset details

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-014: Search Incidents by Title

**Requirement:** Users can search incidents  
**Priority:** Low

### Test Steps
1. Enter search term in search box
2. Observe filtered results

### Expected Result
- Incidents matching search shown
- Search works on title/description
- Case-insensitive

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-015: View Incident Statistics

**Requirement:** Dashboard shows incident stats  
**Priority:** Medium

### Test Steps
1. Navigate to Dashboard/Incidents Summary
2. View statistics

### Expected Result
- Total incidents count
- Breakdown by status
- Breakdown by severity
- Charts/graphs displayed

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-016: Incident Priority Setting

**Requirement:** Admin can set incident priority (0-10)  
**Priority:** Medium

### Preconditions
- Logged in as admin

### Test Steps
1. Edit incident
2. Set priority to 9
3. Save

### Expected Result
- Priority saved
- Higher priority incidents highlighted
- Sorting by priority works

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-017: Reopen Closed Incident

**Requirement:** Admin can reopen incidents if needed  
**Priority:** Low

### Preconditions
- Logged in as admin
- Closed incident exists

### Test Steps
1. Open closed incident
2. Change status back to "Open" or "In Progress"
3. Save

### Expected Result
- Incident reopened
- Status updated
- History recorded

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-018: Incident Validation - Missing Required Fields

**Requirement:** System validates incident data  
**Priority:** High

### Test Steps
1. Try to create incident without title
2. Try to submit

### Expected Result
- Validation error shown
- Form does not submit
- Required fields highlighted

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-019: Incident Timestamps

**Requirement:** System tracks incident timestamps  
**Priority:** Medium

### Test Steps
1. Create incident → Note reported_at time
2. Resolve incident → Note resolved_at time
3. View incident details

### Expected Result
- reported_at set on creation
- resolved_at set on resolution
- Timestamps accurate and displayed

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## TEST-INC-020: Bulk Incident Operations

**Requirement:** Admin can perform bulk actions  
**Priority:** Low

### Preconditions
- Multiple incidents exist
- Logged in as admin

### Test Steps
1. Select multiple incidents
2. Apply bulk action (e.g., assign all to operator)
3. Execute

### Expected Result
- All selected incidents updated
- Success confirmation
- Changes reflected immediately

### Actual Result: _____________

### Status: [ ] PASS [ ] FAIL [ ] BLOCKED

---

## Summary
**Total:** 20 | **Executed:** ___ | **Passed:** ___ | **Failed:** ___ | **Pass Rate:** ___%

**Tester:** _______________  
**Date:** _______________
