# 🛰️ Executive Analytics & SRE Command Center Guide

## Overview

This guide details the database architecture, composite infrastructure health calculation model, SRE velocity & reliability telemetry, TCO financial intelligence, and blast radius radar for the **Executive Analytics & SRE Command Center Dashboard** in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In enterprise organizations:
- Executive leadership (CIO, CTO, CFO) requires aggregated high-level business metrics: Total Cost of Ownership (TCO), monthly license spend vs waste, asset depreciation curves, and compliance audit posture.
- Site Reliability Engineers (SREs) and Sysadmins require real-time operational telemetry: composite health scores, MTTR, MTTD, error budget burn rates, open CVE severities, and cascading CMDB blast radius impact.
- Juggling separate tools causes operational friction and delayed response to cascading outages.

**The Solution**:
1. **Composite Infrastructure Health Score (0–100)**:
   - A unified multi-pillar operational index:
     $$\text{Health Index} = \max\Big(0, \min\big(100, 100 - (15 \times \text{CritInc}) - (5 \times \text{HighInc}) - (10 \times \text{CritCVE}) - (3 \times \text{HighCVE}) - (5 \times \text{Anomalies})\big)\Big)$$
   - Real-time tier classification: `EXCELLENT` ($\ge 85$), `DEGRADED` ($65-84$), and `CRITICAL RISK` ($< 65$).
2. **SRE Velocity & Reliability KPIs**:
   - **MTTR (Mean Time to Resolve)**: Computed dynamically from incident resolution durations.
   - **MTTD (Mean Time to Detect)**: Tracked from telemetry alert triggers.
   - **SLA Uptime & Error Budget Remaining (%)**.
3. **Financial & TCO Intelligence**:
   - Total Infrastructure Asset Valuation ($).
   - Monthly Software Spend & Unallocated License Seat Waste ($/mo).
   - Estimated 5-Year Straight-Line Annual Depreciation ($).
4. **Security & Cryptographic Audit Posture**:
   - Live count of Critical and High CVEs.
   - Real-time HMAC-SHA256 Hash-Chained Audit Ledger verification status (`✓ Tamper-Proof` vs `⚠️ Altered`).
   - Merkle Tip Hash seal and total audited block height.
5. **Degraded Infrastructure Blast Radius Radar**:
   - Identifies degraded nodes and performs CMDB recursive topology graph lookups to calculate downstream blast radius node impact counts.
6. **Live Auto-Refresh Controller**:
   - Configurable polling intervals (`Live 10s`, `Live 30s`, `Live 60s`, `Paused`) with manual instant refresh.

---

## 🏛️ 1. PostgreSQL Stored Procedure Architecture

Implemented directly within PostgreSQL 17 on Supabase (`odgxypyknkqlcasvomej`):

```sql
CREATE OR REPLACE FUNCTION public.get_executive_command_center_metrics()
RETURNS JSONB AS $$
...
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Key Output Fields:
| Field | Type | Description |
| :--- | :--- | :--- |
| `composite_health_index` | `INT` | Unified health index from 0 to 100 |
| `health_tier` | `TEXT` | `EXCELLENT` / `DEGRADED` / `CRITICAL_RISK` |
| `sre_reliability` | `JSONB` | `mttr_minutes`, `mttd_minutes`, `sla_uptime_percent`, `error_budget_remaining`, `active_incidents` |
| `financial_tco` | `JSONB` | `total_asset_valuation`, `monthly_software_spend`, `wasted_unallocated_license_spend`, `annual_depreciation_estimate` |
| `security_and_audit` | `JSONB` | `critical_cves`, `high_cves`, `audit_chain_valid`, `audited_blocks_count`, `merkle_tip_hash` |
| `degraded_assets_radar` | `JSONB` | Array of degraded assets with `connected_dependencies_count` (blast radius) |

---

## 📡 2. Backend REST API Endpoints

| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/command-center/metrics` | Retrieve complete executive & SRE command center dataset | Authenticated |

---

## 🎨 3. Frontend Visual Dashboard Integration

1. **`ExecutiveCommandCenter.jsx`**:
   - **Composite Health Score Gauge**: Animated radial score with dynamic color transitions (Emerald, Amber, Rose).
   - **SRE Reliability Scorecard**: Real-time MTTR, MTTD, SLA Uptime, and Error Budget indicators.
   - **Financial TCO Radar**: Asset Valuation, Monthly Software Spend, Wasted Seat savings opportunities.
   - **Security & Cryptographic Audit Posture**: CVE Severity counts + live Tamper-Proof chain seal with 1-click navigation to `/audit-ledger`.
   - **Degraded Infrastructure & Blast Radius Radar**: Interactive card grid of impaired infrastructure nodes showing their downstream dependency impact count.
   - **Auto-Refresh Selector**: 10s / 30s / 60s / Paused with manual refresh trigger.
2. **`Dashboard.jsx`**:
   - Integrated as the primary executive command center widget.
