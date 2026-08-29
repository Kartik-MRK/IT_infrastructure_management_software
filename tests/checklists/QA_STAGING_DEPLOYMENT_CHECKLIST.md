# QA Staging Deployment Checklist
# ITIMS - Staging Environment Verification

**Project:** IT Infrastructure Management Software  
**Environment:** Staging  
**Deployment Date:** ___________  
**Deployed By:** ___________  
**QA Tester:** ___________

---

## 📋 Pre-Deployment Checklist

### Code Readiness
- [ ] All code merged to staging branch
- [ ] No merge conflicts
- [ ] Code review completed
- [ ] All automated tests passing
- [ ] No critical bugs in backlog
- [ ] Version number updated

### Environment Setup
- [ ] Staging server accessible
- [ ] Domain/subdomain configured
- [ ] SSL certificate installed (HTTPS)
- [ ] Environment variables configured
- [ ] Database connection string set
- [ ] Supabase project configured

---

## 🚀 Deployment Process

### Backend Deployment
- [ ] Backend code deployed to server
- [ ] Python dependencies installed (requirements.txt)
- [ ] Flask app starts successfully
- [ ] No startup errors in logs
- [ ] Health endpoint responds: GET /api/health
- [ ] CORS configured for frontend URL
- [ ] JWT secret key set
- [ ] SMTP credentials configured (if using email)

### Frontend Deployment
- [ ] Frontend built successfully (`npm run build`)
- [ ] Build artifacts generated
- [ ] Frontend deployed to hosting/server
- [ ] Environment variables set (.env)
- [ ] Supabase URL and Anon Key configured
- [ ] API base URL pointing to staging backend
- [ ] Static assets accessible

### Database
- [ ] Supabase project created for staging
- [ ] Database tables created (SQL scripts run)
- [ ] Row Level Security (RLS) policies enabled
- [ ] Database triggers active
- [ ] Sample data loaded (optional)
- [ ] Database backups configured

---

## 🔍 Post-Deployment Verification

### 1. Application Availability

#### Backend API
- [ ] Backend URL accessible
- [ ] GET /api/health returns 200 OK
- [ ] Response time < 1 second
- [ ] No 500 errors in logs

#### Frontend
- [ ] Frontend URL loads
- [ ] No 404 errors
- [ ] No console errors in browser DevTools
- [ ] Favicon loaded
- [ ] Title tag correct

---

### 2. Core Functionality Smoke Tests

#### Authentication
- [ ] Login page loads
- [ ] Can login with test credentials
- [ ] JWT token generated and stored
- [ ] Logout works
- [ ] Cannot access protected routes when logged out
- [ ] Session timeout works

#### Asset Management
- [ ] Assets page loads
- [ ] Asset list displayed
- [ ] Can create new asset (admin/operator)
- [ ] Can view asset details
- [ ] Can edit asset (authorized user)
- [ ] Can delete asset (admin)

#### Incident Management
- [ ] Incidents page loads
- [ ] Incident list displayed
- [ ] Can report new incident
- [ ] Can view incident details
- [ ] Can update incident status
- [ ] Can resolve incident

#### Metrics & Monitoring
- [ ] Metrics displayed for hardware assets
- [ ] Alerts page accessible
- [ ] Alerts generated correctly
- [ ] Dashboard shows statistics

---

### 3. Database Connectivity

- [ ] Backend connects to Supabase
- [ ] Data fetched from database
- [ ] Data written to database
- [ ] Foreign key relationships working
- [ ] RLS policies enforced
- [ ] No database connection errors

---

### 4. API Endpoint Tests

#### Public Endpoints
- [ ] GET /api/health → 200 OK

#### Protected Endpoints (with valid JWT)
- [ ] GET /api/profile → 200 OK
- [ ] GET /api/assets → 200 OK
- [ ] POST /api/assets → 201 Created
- [ ] PUT /api/assets/:id → 200 OK
- [ ] DELETE /api/assets/:id → 200 OK
- [ ] GET /api/incidents → 200 OK
- [ ] POST /api/incidents → 201 Created
- [ ] PUT /api/incidents/:id → 200 OK
- [ ] GET /api/alerts → 200 OK
- [ ] GET /api/assets/:id/metrics → 200 OK
- [ ] GET /api/assets/summary → 200 OK

#### Unauthorized Access
- [ ] Endpoints without token → 401 Unauthorized
- [ ] Invalid token → 422 Unprocessable Entity
- [ ] Expired token → 401 Expired Token

---

### 5. Role-Based Access Control

#### Admin User
- [ ] Can access all endpoints
- [ ] Can create assets
- [ ] Can edit any asset
- [ ] Can delete assets and incidents
- [ ] Can assign incidents

#### Operator User
- [ ] Can create assets
- [ ] Can edit own assets only
- [ ] Cannot delete assets
- [ ] Cannot edit others' assets (403 Forbidden)

#### Viewer User
- [ ] Can view assets (read-only)
- [ ] Cannot create assets (403 Forbidden)
- [ ] Can report incidents
- [ ] Cannot assign incidents

---

### 6. Frontend-Backend Integration

- [ ] Frontend successfully calls backend API
- [ ] CORS configured correctly (no CORS errors)
- [ ] API responses parsed correctly
- [ ] Error responses handled gracefully
- [ ] Loading states work
- [ ] Success/error messages displayed

---

### 7. UI/UX Verification

#### Layout
- [ ] Header/navbar displays correctly
- [ ] Navigation links work
- [ ] Footer present (if applicable)
- [ ] Responsive on desktop (1920x1080, 1366x768)
- [ ] Responsive on tablet (768px width)
- [ ] Responsive on mobile (375px width)

#### Visual Design
- [ ] Consistent styling across pages
- [ ] Colors match design (Tailwind)
- [ ] Fonts loaded correctly
- [ ] Icons displayed
- [ ] Images loaded
- [ ] Buttons styled correctly

#### Forms
- [ ] Input fields styled
- [ ] Validation messages shown
- [ ] Required fields marked
- [ ] Submit buttons enabled/disabled correctly

---

### 8. Performance Checks

#### Page Load Times
- [ ] Login page < 2 seconds
- [ ] Dashboard < 3 seconds
- [ ] Assets list < 2 seconds
- [ ] Incidents list < 2 seconds

#### API Response Times
- [ ] GET requests < 500ms
- [ ] POST requests < 1 second
- [ ] PUT requests < 1 second

#### Browser Performance
- [ ] No memory leaks (test with 10+ page navigations)
- [ ] No excessive network requests
- [ ] No blocking resources

---

### 9. Error Handling

#### Frontend Error Scenarios
- [ ] Network offline → Error message shown
- [ ] API returns 500 → Friendly error displayed
- [ ] API returns 404 → "Not found" message
- [ ] Invalid form data → Validation errors shown
- [ ] Session expired → Redirected to login

#### Backend Error Scenarios
- [ ] Invalid request → 400 Bad Request
- [ ] Unauthorized → 401 Unauthorized
- [ ] Forbidden → 403 Forbidden
- [ ] Not found → 404 Not Found
- [ ] Server error → 500 Internal Server Error

---

### 10. Security Verification

#### Authentication & Authorization
- [ ] JWT tokens required for protected routes
- [ ] Expired tokens rejected
- [ ] RBAC enforced (viewer cannot create assets)
- [ ] Passwords hashed (never sent/logged in plaintext)

#### Data Security
- [ ] No sensitive data in browser console
- [ ] No sensitive data in network tab (except auth headers)
- [ ] HTTPS enforced (if in production-like staging)
- [ ] No SQL injection vulnerabilities
- [ ] No XSS vulnerabilities

#### API Security
- [ ] CORS configured to allow only staging frontend
- [ ] Rate limiting (if implemented)
- [ ] Input sanitization

---

### 11. Data Integrity

#### CRUD Operations
- [ ] Created data persists after page refresh
- [ ] Updated data reflects immediately
- [ ] Deleted data removed from all views
- [ ] No orphaned records

#### Relationships
- [ ] Asset-incident relationships maintained
- [ ] Asset-metrics relationships correct
- [ ] User-asset relationships work
- [ ] Foreign keys enforced

---

### 12. Monitoring & Logging

#### Backend Logs
- [ ] Application logs accessible
- [ ] No error logs on startup
- [ ] API request logs working
- [ ] Error logging configured

#### Frontend Logs
- [ ] Browser console clear of errors
- [ ] Network tab shows successful requests
- [ ] No 404 errors for assets

---

### 13. Environment Variables

#### Backend .env
- [ ] SUPABASE_URL set correctly
- [ ] SUPABASE_SERVICE_KEY set
- [ ] JWT_SECRET_KEY set
- [ ] SMTP credentials (if email enabled)
- [ ] ADMIN_EMAIL set
- [ ] Flask SECRET_KEY set

#### Frontend .env
- [ ] VITE_SUPABASE_URL set
- [ ] VITE_SUPABASE_ANON_KEY set
- [ ] VITE_API_BASE_URL set (pointing to staging backend)

---

### 14. Third-Party Services

#### Supabase
- [ ] Database accessible
- [ ] Authentication working
- [ ] Storage (if used) accessible
- [ ] Real-time (if used) working
- [ ] API rate limits not exceeded

#### Email Service (if configured)
- [ ] SMTP connection successful
- [ ] Test email sent successfully

---

### 15. Regression Testing

#### Critical User Flows
- [ ] User can register account
- [ ] User can login
- [ ] User can create asset
- [ ] User can view asset
- [ ] User can edit asset
- [ ] User can report incident
- [ ] User can view metrics
- [ ] User can see alerts
- [ ] User can logout

#### Previously Fixed Bugs
- [ ] Bug #1: [Description] - Still fixed
- [ ] Bug #2: [Description] - Still fixed
- [ ] Bug #3: [Description] - Still fixed

---

### 16. Browser Compatibility

#### Desktop
- [ ] Chrome (latest) - Works
- [ ] Firefox (latest) - Works
- [ ] Edge (latest) - Works
- [ ] Safari (if available) - Works

#### Mobile
- [ ] Mobile Chrome - Works
- [ ] Mobile Safari - Works
- [ ] Responsive layout correct

---

### 17. Accessibility

- [ ] Keyboard navigation works
- [ ] Focus indicators visible
- [ ] Screen reader compatible (basic test)
- [ ] Color contrast sufficient
- [ ] Alt text for images

---

### 18. Data Migration (if applicable)

- [ ] Old data migrated successfully
- [ ] Data format correct
- [ ] No data loss
- [ ] Relationships preserved

---

### 19. Rollback Plan

- [ ] Previous version documented
- [ ] Rollback procedure documented
- [ ] Database backup taken before deployment
- [ ] Rollback tested (if critical deployment)

---

### 20. Documentation

- [ ] Deployment notes documented
- [ ] Known issues logged
- [ ] Configuration changes documented
- [ ] Changelog updated

---

## 🐛 Issues Found During Deployment

### Critical Issues
| ID | Description | Status | Assigned To |
|----|-------------|--------|-------------|
| 1  | ___________ | [ ] Fixed | ___________ |

### High Priority Issues
| ID | Description | Status | Assigned To |
|----|-------------|--------|-------------|
| 1  | ___________ | [ ] Fixed | ___________ |

### Medium Priority Issues
| ID | Description | Status | Assigned To |
|----|-------------|--------|-------------|
| 1  | ___________ | [ ] Fixed | ___________ |

---

## 📊 Deployment Metrics

- **Deployment Duration:** ______ minutes
- **Downtime (if any):** ______ minutes
- **Issues Found:** ______
- **Critical Issues:** ______
- **Issues Resolved:** ______

---

## ✅ Sign-Off

### Deployment Team

**Developer:** _______________  
**Date:** _______________  
**Status:** [ ] Success [ ] Partial [ ] Failed

**DevOps:** _______________  
**Date:** _______________  
**Status:** [ ] Success [ ] Partial [ ] Failed

### QA Team

**QA Lead:** _______________  
**Date:** _______________  
**Status:** [ ] Approved [ ] Rejected [ ] Conditional

**Notes/Conditions:**  
________________________________________  
________________________________________  
________________________________________

---

## 🚦 Go/No-Go Decision

Based on the checks above:

- [ ] **GO** - Staging environment ready for testing
- [ ] **NO-GO** - Issues must be resolved before proceeding

**Decision Maker:** _______________  
**Date:** _______________  
**Signature:** _______________

---

## Next Steps

- [ ] Notify QA team to begin testing
- [ ] Notify stakeholders of staging availability
- [ ] Schedule UAT (User Acceptance Testing)
- [ ] Monitor staging environment for issues
- [ ] Plan production deployment timeline
