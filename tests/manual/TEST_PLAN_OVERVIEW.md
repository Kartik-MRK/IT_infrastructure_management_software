# Manual Test Plan Overview
# ITIMS (IT Infrastructure Management Software)

**Project:** P03 - IT Infrastructure Management Software  
**Team:** Git Souls  
**Version:** 1.0  
**Last Updated:** November 2025

---

## 1. Test Plan Scope

This manual test plan covers comprehensive testing of the ITIMS application including:

- Asset Management Module
- Incident Management Module  
- Metrics & Monitoring Module
- User Authentication & Authorization (RBAC)
- Alerts & Notifications

---

## 2. Test Environment

### 2.1 Backend
- **Framework:** Flask 3.0.0
- **Database:** Supabase (PostgreSQL)
- **Authentication:** JWT (Flask-JWT-Extended)
- **API:** RESTful

### 2.2 Frontend
- **Framework:** React + Vite
- **UI:** Tailwind CSS
- **State Management:** React Hooks
- **HTTP Client:** Fetch API

### 2.3 Test Data
- Sample assets (hardware, software, network, peripherals)
- Sample user profiles (admin, operator, viewer)
- Sample incidents with various severities
- Sample metrics data

---

## 3. User Roles & Permissions

### Admin
- Full CRUD on assets
- Full CRUD on incidents  
- View all metrics and alerts
- Manage user roles
- Delete any resource

### Operator
- Create assets
- Update own assets
- View all assets
- Report and update incidents
- View metrics and alerts

### Viewer
- View all assets
- Report incidents
- View own incidents
- View metrics (read-only)

---

## 4. Test Approach

### 4.1 Manual Testing Types
1. **Functional Testing** - Verify each feature works as expected
2. **UI/UX Testing** - Ensure usability and visual consistency
3. **Integration Testing** - Test interactions between modules
4. **Security Testing** - Verify RBAC and authentication
5. **Performance Testing** - Check load times and responsiveness

### 4.2 Test Execution
- Tests should be executed in order by module
- Record actual results for each test case
- Screenshot any defects found
- Mark pass/fail status clearly

---

## 5. Test Schedule

### Phase 1: Core Functionality (Week 1)
- Asset Management (Day 1-2)
- Incident Management (Day 3-4)
- Authentication & RBAC (Day 5)

### Phase 2: Advanced Features (Week 2)
- Metrics & Monitoring (Day 1-2)
- Alerts System (Day 3)
- Integration Testing (Day 4-5)

### Phase 3: System Testing (Week 3)
- End-to-end scenarios
- Performance testing
- Security audit
- User acceptance testing

---

## 6. Test Case Tracking

### Test Case ID Format
```
TEST-[MODULE]-[NUMBER]
Example: TEST-AST-001
```

### Modules
- **AST** - Asset Management
- **INC** - Incident Management
- **MTR** - Metrics & Monitoring
- **AUT** - Authentication
- **ALT** - Alerts

### Test Case Status
- ✅ **PASS** - Test executed successfully
- ❌ **FAIL** - Test failed, defect logged
- ⚠️ **BLOCKED** - Cannot execute due to dependency
- ⏭️ **SKIPPED** - Intentionally not executed

---

## 7. Defect Severity Levels

| Severity | Description | Example |
|----------|-------------|---------|
| **Critical** | System crash, data loss | Database connection failure |
| **High** | Major feature broken | Cannot create assets |
| **Medium** | Feature partially working | Sorting doesn't work |
| **Low** | Minor UI issue | Alignment off by 2px |

---

## 8. Test Entry Criteria

- ✅ Development complete for module
- ✅ Code deployed to test environment
- ✅ Test data prepared
- ✅ Test user accounts created
- ✅ Documentation available

---

## 9. Test Exit Criteria

- ✅ All test cases executed
- ✅ 90%+ pass rate achieved
- ✅ Critical and high severity bugs resolved
- ✅ Sign-off from stakeholders

---

## 10. Test Deliverables

1. **Test Cases** (See individual modules)
   - TEST_CASES_ASSET_MANAGEMENT.md
   - TEST_CASES_INCIDENT_MANAGEMENT.md
   - TEST_CASES_METRICS_MONITORING.md

2. **Test Execution Report**
   - Test case results
   - Pass/fail statistics
   - Defect summary

3. **Defect Log**
   - Bug ID, description, severity
   - Steps to reproduce
   - Screenshots

4. **Test Summary Report**
   - Overall quality assessment
   - Recommendations
   - Sign-off

---

## 11. Test Data Requirements

### Users
- **admin@itims.com** (Admin role)
- **operator@itims.com** (Operator role)
- **viewer@itims.com** (Viewer role)

### Assets
- 5+ hardware assets (servers, laptops)
- 3+ software assets (licenses, applications)
- 2+ network assets (routers, switches)
- 2+ peripheral assets (printers, scanners)

### Incidents
- 2 open incidents
- 3 in-progress incidents
- 5 resolved incidents
- Mix of severity levels (critical, high, medium, low)

---

## 12. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Supabase downtime | High | Test with local mock |
| Data corruption | Critical | Backup before testing |
| Role permission bypass | High | Dedicated security tests |
| Slow performance | Medium | Load testing on staging |

---

## 13. Test Tools

- **Browser:** Chrome, Firefox, Edge
- **API Testing:** Postman, curl
- **Screenshots:** Snipping Tool, Lightshot
- **Bug Tracking:** GitHub Issues
- **Test Management:** This document + Excel/Sheets

---

## 14. Communication Plan

- **Daily Standups:** Test progress updates
- **Bug Triage:** Every 2 days
- **Test Status Reports:** Weekly
- **Final Sign-off:** After all phases complete

---

## 15. References

- Architecture Documentation: `/readme files/`
- API Documentation: Backend `app.py`
- Database Schema: `/SQL/DATABASE_SETUP.sql`
- Setup Guide: `/readme files/SETUP.md`

---

## 16. Appendix: Quick Test Checklist

### Pre-Testing
- [ ] Test environment accessible
- [ ] Test users created
- [ ] Sample data loaded
- [ ] Documentation reviewed

### During Testing
- [ ] Follow test cases in order
- [ ] Record all results
- [ ] Screenshot any issues
- [ ] Log defects immediately

### Post-Testing
- [ ] Calculate pass rate
- [ ] Summarize findings
- [ ] Update documentation
- [ ] Obtain sign-off

---

**Prepared by:** QA Team - Git Souls  
**Approved by:** Project Lead  
**Date:** November 2025
