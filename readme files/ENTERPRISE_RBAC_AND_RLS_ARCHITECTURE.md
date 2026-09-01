# 🛡️ Enterprise RBAC, ABAC & RLS Architecture Guide

## Overview

This document provides a comprehensive technical overview of the **Enterprise Role-Based & Attribute-Based Access Control (RBAC/ABAC)**, **Granular Permissions Catalog**, **Sub-millisecond Row-Level Security (RLS)**, and **Change Data Capture (CDC) Audit Logging** implemented in the IT Infrastructure Management System (ITIMS).

---

## 🏛️ Architecture & Normalized Schema

The system replaces hardcoded 3-tier string roles (`admin`, `operator`, `viewer`) with a fully normalized, relational authorization and organizational model.

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   departments   │       │      roles      │       │   permissions   │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (UUID, PK)   │       │ id (TEXT, PK)   │       │ id (TEXT, PK)   │
│ name (TEXT)     │       │ name (TEXT)     │       │ category (TEXT) │
│ code (TEXT)     │       │ description     │       │ description     │
└────────┬────────┘       └────────┬────────┘       └────────┬────────┘
         │                         │                         │
         │                         └───────────┬─────────────┘
         │                                     ▼
         │                         ┌───────────────────────┐
         │                         │   role_permissions    │
         │                         ├───────────────────────┤
         │                         │ role_id (FK)          │
         │                         │ permission_id (FK)    │
         │                         └───────────────────────┘
         ▼
┌─────────────────┐
│    profiles     │ ◄── Linked to auth.users (id = auth.uid())
├─────────────────┤
│ id (UUID, PK)   │
│ email (TEXT)    │
│ role (FK/TEXT)  │
│ department_id   │
│ is_active (BOOL)│
└─────────────────┘
```

---

## 🏢 1. Organizational Departments

Department multi-tenancy and scoping enables granular asset ownership and filtering across enterprise units:

| ID / Code | Department Name | Description |
| :--- | :--- | :--- |
| `ENG` | **Engineering** | Software engineering, devops, and infrastructure platforms. |
| `OPS` | **IT Operations** | Datacenter management, sysadmins, and network operations. |
| `SEC` | **Security & Compliance** | Cybersecurity, SOC, compliance, and internal auditing. |
| `FIN` | **Finance & Procurement** | Asset purchasing, depreciation tracking, and vendor accounting. |
| `HR` | **Human Resources** | Personnel onboarding, offboarding, and identity lifecycle. |
| `EXEC` | **Executive Leadership** | High-level KPI dashboards and reporting. |

---

## 👥 2. Enterprise Personas & Role Catalog

| Role ID | Persona Name | Default Scope & Responsibilities |
| :--- | :--- | :--- |
| `it_admin` | **Global IT Administrator** | Full read/write/delete access across all assets, incidents, users, roles, and audit logs. |
| `security_auditor` | **Security & Compliance Auditor** | Read-only access across infrastructure, full access to CDC audit logs and compliance views. |
| `infrastructure_engineer` | **Infrastructure & Systems Engineer** | Full lifecycle control over assets, CMDB dependencies, and incident resolution. |
| `helpdesk_operator` | **Helpdesk & Operations Operator** | Triage, assign, and update incident tickets; view operational telemetry. |
| `asset_custodian` | **Asset Custodian** | Create, update, tag, and decommission physical & software assets. |
| `financial_auditor` | **Financial & Procurement Auditor** | Read-only access to asset costs, purchase dates, and warranty depreciations. |
| `employee_requester` | **Employee / Requester** | Submit incident tickets and view assigned hardware/software assets. |

### Legacy Aliases (Zero Regression)
For full backward compatibility with legacy scripts and tokens:
- `admin` ➔ maps to `it_admin`
- `operator` ➔ maps to `infrastructure_engineer`
- `viewer` ➔ maps to `employee_requester`

---

## 🔑 3. Master Permissions Catalog (18 Granular Keys)

| Category | Permission ID | Description |
| :--- | :--- | :--- |
| **Assets** | `assets:read_all` | View all IT assets across all departments |
| | `assets:create` | Create new hardware, software, or network assets |
| | `assets:update` | Update asset configurations, locations, and statuses |
| | `assets:delete` | Soft-delete or decommission assets |
| **Incidents** | `incidents:read_all` | View all operational incidents and outage tickets |
| | `incidents:create` | File new incident reports |
| | `incidents:update_status` | Transition incident status (open ➔ in_progress ➔ resolved) |
| | `incidents:assign` | Assign incident tickets to engineers |
| | `incidents:resolve` | Close and provide resolution notes for incidents |
| | `incidents:delete` | Purge or remove incident records |
| **Security** | `security:view_audit_logs` | Inspect Change Data Capture (CDC) audit trail |
| | `security:manage_policies` | Configure security and access control policies |
| **Finance** | `finance:view_costs` | View purchase prices and warranty information |
| | `finance:manage_budgets` | Allocate asset procurement budgets |
| **Admin** | `admin:manage_users` | Create, update, and manage user accounts |
| | `admin:manage_roles` | Modify role-to-permission mappings |
| | `admin:manage_departments` | Create and restructure organizational departments |
| | `admin:system_config` | Modify global system parameters and mail alerts |

---

## ⚡ 4. High-Performance $O(1)$ RLS Security Functions

Instead of executing slow per-row subqueries on `profiles`, PostgreSQL evaluates authorization in `< 0.2ms` via indexed `STABLE SECURITY DEFINER` functions:

```sql
CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles p
        JOIN public.role_permissions rp ON rp.role_id = p.role
        WHERE p.id = auth.uid() 
          AND rp.permission_id = required_permission
          AND p.is_active = true
    );
$$;
```

---

## 📜 5. Automated Change Data Capture (CDC) Audit Logging

Every database mutation (`INSERT`, `UPDATE`, `DELETE`, `SOFT_DELETE`) on user-facing tables is automatically captured by the PostgreSQL trigger function `public.log_table_changes()`:

### Audit Log Schema (`public.audit_logs`):
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `table_name TEXT NOT NULL` (`assets`, `incidents`, `profiles`, `asset_relationships`)
- `record_id UUID NOT NULL`
- `action TEXT NOT NULL` (`INSERT`, `UPDATE`, `DELETE`, `SOFT_DELETE`)
- `old_values JSONB` (State snapshot before change)
- `new_values JSONB` (State snapshot after change)
- `performed_by UUID REFERENCES auth.users(id)`
- `performed_at TIMESTAMPTZ NOT NULL DEFAULT now()`

---

## 🔌 6. Backend API Endpoints for RBAC

| Method | Endpoint | Description | Access Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/roles` | List all available enterprise roles and permissions | Authenticated |
| `GET` | `/api/departments` | List all organization departments | Authenticated |
| `GET` | `/api/audit-logs` | Retrieve CDC audit trail (supports `table_name`, `record_id`, `limit`) | `security_auditor` / `it_admin` |
| `GET` | `/api/users` | List all registered users with departments | `it_admin` |
| `PUT` | `/api/users/<id>/role` | Promote/demote user enterprise persona | `it_admin` |
| `PUT` | `/api/users/<id>` | Update user profile and assigned department | Self or `it_admin` |
