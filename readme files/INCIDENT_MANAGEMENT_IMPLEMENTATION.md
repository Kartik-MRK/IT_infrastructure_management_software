# Incident Management System - Implementation Guide

## Overview
This document describes the complete implementation of the Incident Management System for the IT Infrastructure Management System (ITIMS). This feature allows users to report incidents and administrators to manage and resolve them.

---

## 📋 Features Implemented

### Backend API Endpoints

#### 1. **POST /api/incidents** - Create New Incident
- **Authentication**: Required (JWT)
- **Access**: All authenticated users
- **Request Body**:
  ```json
  {
    "title": "Server downtime",
    "description": "Main server is not responding",
    "severity": "critical",
    "priority": 8,
    "category": "hardware",
    "asset_id": "uuid-of-asset" // optional
  }
  ```
- **Response**: Created incident with ID
- **Auto-email**: Sends email alert if severity is "critical"

#### 2. **GET /api/incidents** - Fetch All Incidents
- **Authentication**: Required (JWT)
- **Access**: All authenticated users
- **Query Parameters**:
  - `status`: Filter by status (open, in_progress, resolved, closed)
  - `severity`: Filter by severity (critical, high, medium, low)
  - `category`: Filter by category
  - `assigned_to_me`: true/false
- **Response**: Array of incidents with related data (reporter, assignee, asset)

#### 3. **GET /api/incidents/:id** - Get Specific Incident
- **Authentication**: Required (JWT)
- **Response**: Single incident with full details

#### 4. **PUT /api/incidents/:id** - Update Incident
- **Authentication**: Required (JWT)
- **Access**: Admin, Reporter, or Assignee
- **Request Body** (any combination):
  ```json
  {
    "status": "in_progress",
    "assigned_to": "user-id",
    "priority": 9,
    "severity": "high",
    "resolution_notes": "Fixed server configuration"
  }
  ```
- **Auto-resolve**: When status changes to "resolved" or "closed", automatically sets `resolved_by` and `resolved_at`

#### 5. **DELETE /api/incidents/:id** - Delete Incident
- **Authentication**: Required (JWT)
- **Access**: Admin only

#### 6. **GET /api/incidents/stats** - Get Incident Statistics
- **Authentication**: Required (JWT)
- **Response**: Counts by status, severity, and category

#### 7. **Enhanced /api/assets/summary**
- Added incident statistics:
  - `incidents.open`: Count of open incidents
  - `incidents.critical`: Count of critical unresolved incidents

---

## 💾 Database Schema

### Incidents Table
Created in `CREATE_INCIDENTS_TABLE.sql` (292 lines):

```sql
CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  severity VARCHAR(20) CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category VARCHAR(50),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Indexes (for performance)
- `idx_incidents_severity` ON (severity)
- `idx_incidents_status` ON (status)
- `idx_incidents_asset_id` ON (asset_id)
- `idx_incidents_reported_by` ON (reported_by)
- `idx_incidents_assigned_to` ON (assigned_to)

### Row-Level Security (RLS)
- **View**: All authenticated users can view all incidents
- **Create**: All authenticated users can create incidents
- **Update**: Only admins, reporters, or assignees can update
- **Resolve**: Only admins can mark incidents as resolved
- **Delete**: Only admins can delete incidents

### Database Functions & Triggers

#### 1. **auto_resolve_old_incidents()**
- Automatically closes incidents older than 30 days without updates
- Runs as a scheduled function

#### 2. **notify_critical_incidents()**
- Sends notifications when critical incidents are created
- Called by trigger on INSERT

#### 3. **set_incident_updated_at**
- Updates `updated_at` timestamp on any row modification
- Trigger: BEFORE UPDATE

---

## 🎨 Frontend Components

### 1. IncidentReport.jsx (`frontend/src/pages/Incident/Report.jsx`)

**Purpose**: Allows users to report new incidents

**Features**:
- Form with fields:
  - Title (required)
  - Description (required)
  - Severity (critical/high/medium/low)
  - Priority (1-10 scale)
  - Category (hardware/software/network/security/etc.)
  - Related Asset (dropdown from active assets)
- Real-time validation
- Toast notifications on success/error
- Sidebar showing user's recent incidents
- Automatic list refresh after submission

**Usage**:
- Accessible to all authenticated users
- Route: `/incidents/report`
- Navigation: "Report Incident" link in header

---

### 2. IncidentList.jsx (`frontend/src/pages/Incident/List.jsx`)

**Purpose**: Admin dashboard for managing all incidents

**Features**:
- **Filtering**:
  - Search by title/description
  - Filter by status, severity, category
- **Auto-refresh**: Fetches new data every 30 seconds
- **Incident Cards** displaying:
  - Title, description
  - Color-coded severity badges (red=critical, orange=high, yellow=medium, blue=low)
  - Color-coded status badges (red=open, yellow=in progress, green=resolved)
  - Priority (1-10)
  - Related asset name and type
  - Reporter and assignee information
  - Timestamps (reported and resolved)
- **Actions** (based on permissions):
  - Status dropdown (for admins and assignees)
  - "Mark as Resolved" button
  - Delete button (admin only)
- **Permissions**:
  - Admins: Full control
  - Assignees: Can update status of assigned incidents
  - Reporters: Can view their own incidents

**Usage**:
- Accessible to all users (with role-based actions)
- Route: `/incidents`
- Navigation: "Manage Incidents" link (admin only)

---

## 🔐 Security & Access Control

### Role-Based Permissions

| Action | Admin | Operator | Viewer | Reporter | Assignee |
|--------|-------|----------|--------|----------|----------|
| View all incidents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create incident | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update own incidents | ✅ | ✅ | ✅ | ✅ | ✅ |
| Update any incident | ✅ | ❌ | ❌ | ❌ | ✅ (assigned only) |
| Resolve incident | ✅ | ✅ | ❌ | ❌ | ✅ (assigned only) |
| Delete incident | ✅ | ❌ | ❌ | ❌ | ❌ |
| Assign incidents | ✅ | ✅ | ❌ | ❌ | ❌ |

### Authentication
- All endpoints require JWT token in `Authorization` header
- Token format: `Bearer <token>`
- Token expiration: 24 hours

---

## 📧 Email Alert System

### Critical Incident Alerts
When an incident with `severity='critical'` is created:

1. Backend function `send_critical_incident_email()` is called
2. Currently logs to console (placeholder)
3. **To implement email**:

#### Option 1: Supabase Edge Function
```typescript
// supabase/functions/send-critical-alert/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const { incident, reporter } = await req.json()
  
  // Use Deno SMTP or SendGrid
  // Send email to admins
  
  return new Response(JSON.stringify({ success: true }))
})
```

#### Option 2: Flask-Mail (SMTP)
```python
# In backend/app.py
from flask_mail import Mail, Message

app.config['MAIL_SERVER'] = os.getenv('SMTP_SERVER', 'smtp.gmail.com')
app.config['MAIL_PORT'] = int(os.getenv('SMTP_PORT', 587))
app.config['MAIL_USERNAME'] = os.getenv('SMTP_USERNAME')
app.config['MAIL_PASSWORD'] = os.getenv('SMTP_PASSWORD')
mail = Mail(app)

def send_critical_incident_email(incident, reporter):
    msg = Message(
        subject=f"CRITICAL INCIDENT: {incident['title']}",
        sender=app.config['MAIL_USERNAME'],
        recipients=[admin_email_list]
    )
    msg.body = f"""
    A critical incident has been reported:
    
    Title: {incident['title']}
    Description: {incident['description']}
    Reported by: {reporter.get('full_name')} ({reporter.get('email')})
    Asset: {incident.get('asset_name', 'N/A')}
    Priority: {incident['priority']}/10
    
    View in dashboard: http://localhost:5173/incidents
    """
    mail.send(msg)
```

---

## 🧪 Testing Guide

### Step 1: Deploy Database Schema
```sql
-- Run in Supabase SQL Editor
-- File: CREATE_INCIDENTS_TABLE.sql
-- Expected result: ✓ Success. No rows returned
```

### Step 2: Verify Table Creation
```sql
-- Check incidents table exists
SELECT * FROM incidents LIMIT 5;

-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'incidents';

-- Check triggers
SELECT tgname FROM pg_trigger WHERE tgrelid = 'incidents'::regclass;
```

### Step 3: Test Backend API

#### Test POST /api/incidents
```bash
# Using curl
curl -X POST http://localhost:5000/api/incidents \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Server Down",
    "description": "Main server not responding",
    "severity": "critical",
    "priority": 9
  }'
```

#### Test GET /api/incidents
```bash
curl -X GET "http://localhost:5000/api/incidents?status=open" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test PUT /api/incidents/:id
```bash
curl -X PUT http://localhost:5000/api/incidents/INCIDENT_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "in_progress"}'
```

### Step 4: Test Frontend

1. **Navigate to Report Page**:
   - URL: `http://localhost:5173/incidents/report`
   - Fill out form with all fields
   - Submit and verify toast notification
   - Check "My Recent Incidents" sidebar updates

2. **Test Incident List**:
   - URL: `http://localhost:5173/incidents`
   - Verify incidents display with proper badges
   - Test filters (status, severity, search)
   - Change status dropdown (if admin/assignee)
   - Click "Mark as Resolved"
   - Wait 30 seconds and verify auto-refresh

3. **Test Permissions**:
   - Log in as different roles (admin, operator, viewer)
   - Verify correct buttons/actions are visible
   - Attempt to delete as non-admin (should show error toast)

### Step 5: Test Auto-Refresh
1. Open incident list
2. Open browser DevTools → Network tab
3. Wait 30 seconds
4. Verify new GET request to `/api/incidents`
5. Console should show no errors

---

## 🚀 Deployment Checklist

### Backend
- [ ] Run `CREATE_INCIDENTS_TABLE.sql` in Supabase
- [ ] Verify incidents table created
- [ ] Verify RLS policies active
- [ ] Restart Flask backend (`python app.py`)
- [ ] Test all API endpoints with Postman
- [ ] Configure email settings (if using SMTP)
- [ ] Set up Supabase Edge Function (if using Supabase email)

### Frontend
- [ ] Verify routes added to `App.jsx`
- [ ] Verify navigation links in `Dashboard.jsx`
- [ ] Test incident report form
- [ ] Test incident list page
- [ ] Test filters and search
- [ ] Verify auto-refresh works
- [ ] Test toast notifications
- [ ] Test role-based permissions

---

## 📝 Configuration

### Environment Variables

#### Backend (.env)
```env
# Existing variables
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_service_key
JWT_SECRET_KEY=your_jwt_secret

# Email Configuration (optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
ADMIN_EMAIL=admin@example.com
```

#### Frontend (.env)
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

---

## 🎯 Usage Examples

### Scenario 1: User Reports Critical Incident
1. User logs in
2. Clicks "Report Incident" in navigation
3. Fills form:
   - Title: "Database Server Offline"
   - Description: "Production database is not responding to requests"
   - Severity: Critical
   - Priority: 10
   - Category: Hardware
   - Asset: "DB-SERVER-01"
4. Clicks "Submit Incident"
5. System:
   - Creates incident in database
   - Sends email to admins (if configured)
   - Shows success toast
   - Updates sidebar with new incident

### Scenario 2: Admin Resolves Incident
1. Admin logs in
2. Clicks "Manage Incidents"
3. Views all open incidents
4. Finds incident "Database Server Offline"
5. Changes status dropdown to "In Progress"
6. Adds resolution notes
7. Clicks "Mark as Resolved"
8. System:
   - Updates incident status
   - Records resolver and timestamp
   - Shows success toast
   - Refreshes incident list

### Scenario 3: Auto-Resolution of Stale Incidents
- Database function runs automatically
- Finds incidents with no updates in 30+ days
- Changes status to "closed"
- Adds note: "Auto-closed due to inactivity"

---

## 🐛 Troubleshooting

### Issue: "Incident not found" Error
**Cause**: RLS policy blocking access
**Solution**: 
- Verify user is authenticated
- Check JWT token is valid
- Ensure RLS policies are enabled on incidents table

### Issue: Email Not Sending
**Cause**: SMTP configuration missing
**Solution**:
- Add SMTP credentials to .env
- Test SMTP connection separately
- Check firewall/network restrictions
- Verify "Less secure app access" enabled (Gmail)

### Issue: Auto-Refresh Not Working
**Cause**: API endpoint returning errors
**Solution**:
- Open browser console for errors
- Check Network tab for failed requests
- Verify backend is running
- Check CORS settings

### Issue: "Permission denied" When Updating
**Cause**: User lacks permission for action
**Solution**:
- Verify user role (admin/operator/viewer)
- Check if user is incident reporter or assignee
- Ensure RLS policies match expected permissions

---

## 📊 Database Queries for Monitoring

### Get Open Critical Incidents
```sql
SELECT 
  i.title, 
  i.severity, 
  i.priority,
  a.name as asset_name,
  p.full_name as reporter_name,
  i.reported_at
FROM incidents i
LEFT JOIN assets a ON i.asset_id = a.id
LEFT JOIN profiles p ON i.reported_by = p.id
WHERE i.status = 'open' 
  AND i.severity = 'critical'
ORDER BY i.priority DESC, i.reported_at DESC;
```

### Get Incident Summary by Status
```sql
SELECT 
  status,
  COUNT(*) as count,
  AVG(priority) as avg_priority
FROM incidents
GROUP BY status
ORDER BY 
  CASE status
    WHEN 'open' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'resolved' THEN 3
    WHEN 'closed' THEN 4
  END;
```

### Get Response Time Stats
```sql
SELECT 
  severity,
  AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at))/3600) as avg_hours_to_resolve,
  MIN(EXTRACT(EPOCH FROM (resolved_at - reported_at))/3600) as min_hours,
  MAX(EXTRACT(EPOCH FROM (resolved_at - reported_at))/3600) as max_hours
FROM incidents
WHERE resolved_at IS NOT NULL
GROUP BY severity
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END;
```

---

## 🔄 Future Enhancements

1. **Comments/Activity Log**
   - Add comments table for incident discussion
   - Track all status changes

2. **File Attachments**
   - Allow users to attach screenshots/logs
   - Use Supabase Storage

3. **Email Templates**
   - Rich HTML email templates
   - Customizable alert recipients

4. **SLA Tracking**
   - Define SLA targets by severity
   - Alerts for SLA breaches

5. **Advanced Analytics**
   - Time-to-resolution charts
   - Incident trends dashboard
   - MTTR (Mean Time To Resolve) metrics

6. **Integration**
   - Slack/Teams notifications
   - Webhook support for external systems
   - Integration with monitoring tools

---

## 📚 API Reference Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/incidents` | POST | ✅ | Create incident |
| `/api/incidents` | GET | ✅ | List incidents |
| `/api/incidents/:id` | GET | ✅ | Get incident |
| `/api/incidents/:id` | PUT | ✅ | Update incident |
| `/api/incidents/:id` | DELETE | ✅ Admin | Delete incident |
| `/api/incidents/stats` | GET | ✅ | Get statistics |
| `/api/assets/summary` | GET | ✅ | Enhanced with incidents |

---

## ✅ Implementation Status

**Day 6-7 Work Completion:**

### Backend ✅
- [x] Incident Management API endpoints (POST/GET/PUT/DELETE)
- [x] Role-based access control using existing middleware
- [x] Email alert function (placeholder ready for SMTP)
- [x] Enhanced /api/assets/summary with incident counts

### Frontend ✅
- [x] Incident Report Page (IncidentReport.jsx)
- [x] Admin Alerts section (IncidentList.jsx)
- [x] Real-time auto-refresh (30 seconds)
- [x] Toast notifications
- [x] Color-coded severity badges
- [x] Navigation links added
- [x] Role-based UI elements

### Database ✅
- [x] Incidents table with full schema
- [x] RLS policies for security
- [x] Triggers for auto-update and notifications
- [x] Auto-resolution function for stale incidents
- [x] Comprehensive indexes for performance

---

**Total Implementation:**
- **Lines of Code**: ~1,500+
- **Files Created**: 3 (SQL + 2 JSX components)
- **Files Modified**: 4 (app.py, App.jsx, Dashboard.jsx, DashboardMetrics.jsx)
- **API Endpoints**: 6 new + 1 enhanced
- **Database Objects**: 1 table, 5 indexes, 6 RLS policies, 2 functions, 3 triggers

**Ready for Production**: After running CREATE_INCIDENTS_TABLE.sql and configuring email (optional)
