# ⏱️ Service Level Agreement (SLA) Engine & Real-Time Breach Timers Guide

## Overview

This guide details the architecture, relational database tables, stored triggers, REST API endpoints, and live visual countdown timers for the **Service Level Agreement (SLA) Engine & Real-Time Breach Timers** module in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In enterprise IT operations and Site Reliability Engineering (SRE):
- Incidents without explicit SLA response and resolution targets lead to unprioritized backlogs, delayed response times, and contractual breach penalties.
- On-call engineers and operators lack visual cues regarding how much time remains before an incident breaches SLA commitments.
- Leadership lacks visibility into operational efficiency metrics such as **Mean Time to Detect / Respond (MTTD)**, **Mean Time to Resolve (MTTR)**, and **SLA Attainment Percentage**.

**The Solution**:
1. **Configurable Enterprise SLA Policies (`public.sla_policies`)**: Severity-based maximum response and resolution targets (e.g. Critical 15m/120m, High 60m/480m, Medium 240m/1440m, Low 1440m/4320m) with 24x7 vs business-hours enforcement.
2. **Automated PostgreSQL Deadline Computation**: Stored trigger `trg_calculate_incident_sla` immediately computes `response_deadline` and `resolution_deadline` upon incident creation or severity modification.
3. **Live Animated Visual Countdown Timers (`SLACountdownTimer.jsx`)**: 1-second interval client-side timers with dynamic color-shifting (Cyan -> Pulsing Amber <15m -> Flashing Red on Breach -> Solid Green on Met).
4. **First-Response Acknowledgment Action (`/api/incidents/<id>/acknowledge`)**: One-click technician acknowledgment to stop response timer and verify response SLA adherence.
5. **SLA Reliability Scorecard Widget (`SLAComplianceWidget.jsx`)**: Real-time KPI dashboard tracking SLA attainment %, MTTR, MTTD, and active breach alerts.

---

## 🏛️ 1. Relational Database Schema & Stored Procedures

All SLA tracking and policy enforcement is housed in the single Supabase PostgreSQL database (`odgxypyknkqlcasvomej`):

### 1.1 `public.sla_policies` Table
```sql
CREATE TABLE IF NOT EXISTS public.sla_policies (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_name                 TEXT        NOT NULL,
    severity                    TEXT        NOT NULL UNIQUE CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    max_response_time_minutes   INT         NOT NULL CHECK (max_response_time_minutes > 0),
    max_resolution_time_minutes INT         NOT NULL CHECK (max_resolution_time_minutes > 0),
    business_hours_only         BOOLEAN     NOT NULL DEFAULT false,
    escalation_email            TEXT,
    is_active                   BOOLEAN     NOT NULL DEFAULT true,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 1.2 `public.incidents` SLA Columns
- `response_deadline TIMESTAMPTZ` — Timestamp when incident must receive initial technician response.
- `resolution_deadline TIMESTAMPTZ` — Timestamp when incident must reach `resolved` or `closed` status.
- `first_responded_at TIMESTAMPTZ` — Timestamp when initial response/acknowledgment was recorded.
- `sla_status TEXT NOT NULL DEFAULT 'within_sla' CHECK (sla_status IN ('within_sla', 'approaching_breach', 'breached'))`
- `sla_response_breached BOOLEAN NOT NULL DEFAULT false`
- `sla_resolution_breached BOOLEAN NOT NULL DEFAULT false`

### 1.3 PostgreSQL Trigger & Stored Procedures
- **`public.calculate_incident_sla_deadlines()` Trigger**:
  - Automatically fired `BEFORE INSERT OR UPDATE OF severity, status, resolved_at ON public.incidents`.
  - Calculates `response_deadline` and `resolution_deadline` using active `sla_policies`.
  - Determines real-time breach status upon resolution or approaching expiration.
- **`public.get_sla_compliance_summary()` RPC**:
  - Calculates:
    - `total_incidents`, `resolved_incidents`, `resolved_within_sla`
    - `sla_compliance_percentage` = `(resolved_within_sla / resolved_incidents) * 100`
    - `active_breached_count`, `active_approaching_count`
    - `avg_mttd_minutes` (Mean Time to Detect / Initial Response)
    - `avg_mttr_minutes` (Mean Time to Resolution)

---

## 📡 2. Backend REST API Endpoints

| HTTP Method | Endpoint | Description | Role Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sla/policies` | List all SLA policies ordered by priority | Authenticated |
| `PUT` | `/api/sla/policies/<policy_id>` | Update response/resolution target minutes & escalation rules | `admin` / `it_admin` |
| `POST` | `/api/incidents/<incident_id>/acknowledge` | Acknowledge incident to capture response timestamp & check SLA | Authenticated |
| `GET` | `/api/sla/summary` | Retrieve SLA compliance scorecard, MTTR, and MTTD | Authenticated |

---

## 🎨 3. Frontend Visual Components

1. **`SLACountdownTimer.jsx`**:
   - 1-second interval timer updating live countdowns for response and resolution.
   - States:
     - **Within SLA / Healthy**: Cyan/Emerald badge (`2h 45m left`).
     - **Approaching Breach (< 15 min)**: Pulsing Amber alert badge (`⚠️ 12m to SLA Breach!`).
     - **Breached**: Flashing Crimson badge with overtime tracking (`⛔ BREACHED +42m ago`).
     - **Resolved / Met**: Solid Green badge (`✓ Resolved in 38m (SLA Met)`).
2. **`SLAComplianceWidget.jsx`**:
   - Executive scorecard showing SLA Attainment %, Mean Time to Respond (MTTD), Mean Time to Resolve (MTTR), and active breach alerts.
3. **`SLAPolicyConfigModal.jsx`**:
   - Admin modal to update policy targets and business hours per severity tier.
4. **`Incident/List.jsx`**:
   - Integrated SLA timers into each incident card header.
   - Added **"⚡ Acknowledge (SLA)"** action button to record response timestamp in 1-click.
5. **`Incident/Report.jsx`**:
   - Real-time SLA target preview badge when selecting incident severity.
