# 📷 Barcode, QR Code & Physical Asset Auditing Guide

## Overview

This guide details the architecture, relational database tables, in-browser camera barcode/QR scanner, printable asset tag generator, and audit verification workflows for the **Barcode & QR Code Physical Asset Auditing** module in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In enterprise IT departments and datacenter facilities:
- Field technicians and asset custodians performing physical inventory audits must verify hundreds of laptops, servers, switches, and peripherals.
- Manually typing 12+ character alphanumeric serial numbers is slow and prone to typographical errors.
- Unmonitored hardware leads to **ghost assets** (devices moved between floors, offices, or datacenters without update) and undocumented physical damage.

**The Solution**:
1. **Printable / Downloadable Asset Tags**: Instantly generate professional thermal sticker labels (2"x1" / 3"x2" or standard multi-tag sheets) with high-resolution QR codes encoding deep links (`/assets/{id}`), serial numbers, and asset names.
2. **In-Browser Camera Scanner (`html5-qrcode`)**: High-performance camera scanner with laser viewfinder and audio synthesis feedback allowing operators to scan any physical asset tag from a smartphone, tablet, or laptop.
3. **Physical Audit Ledger (`public.asset_audits`)**: Historical log recording verification timestamps, auditor identities, physical conditions (`excellent`, `good`, `fair`, `damaged`, `missing`), and location/status discrepancies.

---

## 🏛️ 1. Relational Database Schema & Stored Procedures

All audit tracking data is stored within the single Supabase PostgreSQL database (`odgxypyknkqlcasvomej`):

### 1.1 `public.assets` Audit Columns
- `last_audited_at TIMESTAMPTZ` — Timestamp of the most recent physical verification.
- `audit_status TEXT DEFAULT 'pending' CHECK (audit_status IN ('verified', 'flagged', 'missing', 'pending'))`

### 1.2 `public.asset_audits` Table
```sql
CREATE TABLE IF NOT EXISTS public.asset_audits (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id           UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    auditor_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    audited_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    location_verified  BOOLEAN     NOT NULL DEFAULT true,
    observed_location  TEXT,
    status_verified    BOOLEAN     NOT NULL DEFAULT true,
    observed_status    TEXT,
    physical_condition TEXT        NOT NULL DEFAULT 'good' CHECK (physical_condition IN ('excellent', 'good', 'fair', 'damaged', 'missing')),
    scan_method        TEXT        NOT NULL DEFAULT 'camera_qr' CHECK (scan_method IN ('camera_qr', 'barcode_128', 'manual', 'nfc')),
    notes              TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.3 PostgreSQL Stored Functions
- **`public.record_asset_physical_audit(...)`**:
  - Inserts audit record into `public.asset_audits`.
  - Automatically assesses discrepancy flags:
    - If `physical_condition = 'missing'`, sets `asset.audit_status = 'missing'`.
    - If `physical_condition = 'damaged'` or `location_verified = false` or `status_verified = false`, sets `asset.audit_status = 'flagged'`.
    - Otherwise sets `asset.audit_status = 'verified'`.
  - Updates `asset.last_audited_at = now()`.
- **`public.get_physical_audit_summary()`**:
  - Calculates total assets, audited in last 90 days, audit compliance percentage, verified count, flagged count, missing count, and pending count.

---

## 📡 2. Backend REST API Endpoints

| HTTP Method | Endpoint | Description | Access Required |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/assets/<asset_id>/audits` | Submit a physical audit verification record | `admin` / `it_admin` / `technician` / `asset_custodian` |
| `GET` | `/api/assets/<asset_id>/audits` | Retrieve historical physical audit timeline for an asset | Authenticated |
| `GET` | `/api/audits/summary` | Retrieve organization-wide physical audit compliance metrics | Authenticated |
| `GET` | `/api/audits/recent` | Retrieve stream of recent physical audits | Authenticated |

---

## 🎨 3. Frontend Visual Components

1. **`AssetTagModal.jsx`**:
   - Printable asset tag preview with company header, QR code, asset name, type, serial number, and location.
   - One-click **"🖨️ Print Sticker"** formatted for thermal label printers.
   - **"⬇️ Download PNG"** high-resolution export.
2. **`QRScannerModal.jsx`**:
   - Camera scanner powered by `html5-qrcode` with laser scan animation and Web Audio synthesizer beep.
   - Automatically parses `/assets/<id>` URLs, raw UUIDs, or JSON payloads.
   - Quick action to open asset record or immediately log a physical audit.
3. **`RecordAuditModal.jsx`**:
   - Checklist modal to verify registered location vs observed location, operational status, physical hardware condition, scan method, and technician notes.
4. **`PhysicalAuditHistory.jsx`**:
   - Audit timeline embedded in Asset Details showing condition badges, auditor details, location change warnings, and technician notes.
5. **`List.jsx` Header Quick-Scan**:
   - **"📷 Scan Tag"** button in the Asset List header for instant camera activation.
