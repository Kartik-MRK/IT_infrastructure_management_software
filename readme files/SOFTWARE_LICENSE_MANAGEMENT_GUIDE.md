# 📜 Software License Management (SAM) & Seat Compliance Guide

## Overview

This guide details the architecture, relational database design, seat allocation workflows, and real-time compliance calculation engine for the **Software License Management (SAM) & Seat Compliance** module in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Solution

In enterprise IT departments:
- Organizations purchase multi-seat software licenses (e.g. 50 seats of JetBrains All Products, 250 seats of Microsoft 365, 8 Core licenses of SQL Server Enterprise).
- IT administrators must track **which exact workstations/servers and employees** are using each seat.
- Unmonitored seat usage leads to **unbudgeted true-up penalties** during vendor audits (over-allocation) or **wasted budget** on unused shelfware.
- Surprise license expirations cause sudden production outages.

**The Solution**: A normalized relational licensing engine in PostgreSQL 17 that tracks license keys, seat pools, hardware/user allocations, renewal deadlines, and real-time over-allocation risk status.

---

## 🏗️ 1. Relational Database Schema

All license data is managed inside the single Supabase PostgreSQL database (`odgxypyknkqlcasvomej`):

### 1.1 `public.software_licenses` Table
```sql
CREATE TABLE IF NOT EXISTS public.software_licenses (
    id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    software_asset_id  UUID           NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    license_name       TEXT           NOT NULL,
    license_key        TEXT,
    license_type       TEXT           NOT NULL CHECK (license_type IN ('per_seat', 'site_license', 'per_core', 'subscription', 'open_source', 'oem')),
    total_seats        INTEGER        NOT NULL DEFAULT 1 CHECK (total_seats >= 0),
    cost_per_seat      NUMERIC(12, 2) DEFAULT 0.00,
    purchase_date      DATE,
    expiration_date    DATE,
    vendor             TEXT,
    department_id      UUID           REFERENCES public.departments(id) ON DELETE SET NULL,
    created_by         UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);
```

### 1.2 `public.license_allocations` Table
```sql
CREATE TABLE IF NOT EXISTS public.license_allocations (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id            UUID        NOT NULL REFERENCES public.software_licenses(id) ON DELETE CASCADE,
    allocated_to_asset_id UUID        REFERENCES public.assets(id) ON DELETE CASCADE,
    allocated_to_user_id  UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes                 TEXT,
    CONSTRAINT ck_allocation_target CHECK (allocated_to_asset_id IS NOT NULL OR allocated_to_user_id IS NOT NULL),
    CONSTRAINT uq_license_asset_alloc UNIQUE (license_id, allocated_to_asset_id)
);
```

---

## ⚡ 2. Automated Compliance & Risk Calculation Engine

PostgreSQL evaluates real-time seat compliance via [`public.get_license_compliance_summary()`](file:///e:/College_Documents/GITHUB/IT_infrastructure_management_software/SQL/schema.sql):

### Compliance Status Rules:
| Status | Condition | Severity / UI Badge |
| :--- | :--- | :--- |
| `COMPLIANT` | $\text{Allocated Seats} < 0.90 \times \text{Total Seats}$ and Not Expired | 🟢 Emerald |
| `WARNING_90_PERCENT` | $0.90 \times \text{Total Seats} \le \text{Allocated Seats} \le \text{Total Seats}$ | 🟡 Amber Warning |
| `OVER_ALLOCATED` | $\text{Allocated Seats} > \text{Total Seats}$ (Audit Risk!) | 🔴 Rose Pulsing Outline |
| `EXPIRED` | $\text{Expiration Date} < \text{Current Date}$ | ⛔ Red Critical |

---

## 📡 3. Backend REST API Endpoints

| HTTP Method | Endpoint | Description | Access Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/licenses` | List all licenses with real-time seat utilization | Authenticated |
| `POST` | `/api/licenses` | Register a new software license | `it_admin` / `infrastructure_engineer` / `asset_custodian` |
| `GET` | `/api/licenses/<id>` | Get single license with full allocation list | Authenticated |
| `PUT` | `/api/licenses/<id>` | Update license capacity, key, or renewal date | `it_admin` / `infrastructure_engineer` / `asset_custodian` |
| `DELETE` | `/api/licenses/<id>` | Delete software license | `it_admin` / `asset_custodian` |
| `POST` | `/api/licenses/<id>/allocate` | Allocate seat to hardware workstation or employee | `it_admin` / `infrastructure_engineer` / `asset_custodian` |
| `DELETE` | `/api/licenses/allocations/<id>` | Reclaim / revoke an allocated seat | `it_admin` / `infrastructure_engineer` / `asset_custodian` |
| `GET` | `/api/licenses/compliance-summary` | High-level license compliance metrics for dashboards | Authenticated |

---

## 🎨 4. Frontend Visual Components

- **`LicenseCard.jsx`**:
  - Displays license name, vendor, license model badge.
  - Masked license key preview with click-to-reveal and one-click copy.
  - Real-time seat progress bar (Green `< 80%`, Yellow `80-99%`, Red `≥ 100%`).
  - Days until expiration countdown badge.
  - Collapsible list of allocated hardware devices and users with one-click **"Reclaim Seat"** buttons.
- **`CreateLicenseModal.jsx`**:
  - Modal form to register new software license pools with seat counts and renewal dates.
- **`AllocateSeatModal.jsx`**:
  - Modal allowing operators to select target hardware devices or employee profiles to assign a seat.
- **`Details.jsx` Integration**:
  - Embedded Software Licensing & Seat Compliance card displayed directly when inspecting `software` assets.
