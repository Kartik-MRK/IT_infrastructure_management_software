# 💰 Financial Lifecycle, Total Cost of Ownership (TCO) & Automated Depreciation Guide

## Overview

This guide details the accounting formulas, database architecture, stored functions, REST API endpoints, and executive dashboards for the **Financial Asset Lifecycle, Total Cost of Ownership (TCO) & Automated Depreciation** engine in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In enterprise IT and datacenter infrastructure:
- Capital assets (servers, networking switches, workstations, SAN arrays) **depreciate over time**.
- Incident repairs, hardware replacement parts, vendor SLA support contracts, and software licensing fees compound into heavy **Operational Expenditures (OpEx)**.
- Without an integrated **TCO Engine**, finance and engineering leaders cannot evaluate whether an aging server costs more in recurring incident repairs than replacing it with modern energy-efficient hardware.

**The Solution**: An automated financial engine implemented in PostgreSQL 17 that calculates straight-line & declining-balance depreciation schedules, tracks repair OpEx from incidents, and computes real-time **Total Cost of Ownership (TCO)** for every infrastructure asset and across the entire organization.

---

## 📐 1. Depreciation Accounting Models

### 1.1 Straight-Line Depreciation
Spreads asset depreciation evenly over its operational lifetime:
$$\text{Annual Depreciation} = \frac{\text{Purchase Cost} - \text{Salvage Value}}{\text{Useful Life (Years)}}$$

$$\text{Current Book Value} = \text{Purchase Cost} - (\text{Annual Depreciation} \times \text{Asset Age in Years})$$

### 1.2 Double Declining Balance (DDB)
Accelerated depreciation method for rapidly depreciating compute hardware:
$$\text{Depreciation Rate} = \frac{2}{\text{Useful Life (Years)}}$$

$$\text{Current Book Value} = \max\left(\text{Salvage Value}, \text{Purchase Cost} \times (1 - \text{Depreciation Rate})^{\text{Age}}\right)$$

---

## 🧮 2. Total Cost of Ownership (TCO) Formula

$$\text{TCO} = \text{CapEx (Initial Cost)} + \sum(\text{Incident Maintenance Costs}) + \sum(\text{Software License Costs})$$

### TCO Health Burden Grading:
- 🟢 **`HEALTHY`**: Maintenance OpEx $< 30\%$ of initial purchase CapEx.
- 🟡 **`ELEVATED_MAINTENANCE`**: Maintenance OpEx between $30\%$ and $60\%$ of CapEx.
- 🔴 **`REPLACEMENT_RECOMMENDED`**: Maintenance OpEx $\ge 60\%$ of initial purchase CapEx (economically unviable to keep maintaining).

---

## 🏛️ 3. Relational Schema & Stored Functions

### 3.1 Database Enhancements
- `public.assets`:
  - `salvage_value NUMERIC(12, 2) DEFAULT 0.00`
  - `useful_life_years INTEGER DEFAULT 5`
  - `depreciation_method TEXT CHECK (depreciation_method IN ('straight_line', 'double_declining', 'none'))`
- `public.incidents`:
  - `maintenance_cost NUMERIC(12, 2) DEFAULT 0.00` (records repair parts, vendor dispatch, labor fees)

### 3.2 PostgreSQL Stored Functions
- **`public.calculate_asset_financials(target_asset_id UUID)`**:
  - Computes exact age in months/years, straight-line / DDB depreciation, accumulated depreciation, incident maintenance total, attached license costs, and Total Cost of Ownership.
- **`public.get_executive_financial_summary()`**:
  - Aggregates organization-wide CapEx, current Net Book Value, accumulated depreciation, maintenance spend, and breakdown by asset type.

---

## 📡 4. Backend REST API Endpoints

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/assets/<asset_id>/financials` | Returns single asset financial breakdown, 5-year depreciation schedule, maintenance incident history, and health verdict. |
| `GET` | `/api/financials/executive-summary` | Returns organization-wide CapEx vs Net Book Value, total maintenance OpEx, and TCO breakdown by asset type. |
| `GET` | `/api/financials/depreciation-forecast` | Returns 5-year forward projected depreciation curves for IT budget forecasting. |

---

## 🎨 5. Frontend Visual Components

- **`FinancialSummaryCard.jsx`**:
  - Embedded in the Asset Details Overview tab.
  - Displays Purchase CapEx, Net Book Value, Maintenance OpEx, Total TCO, and Depreciation Status progress bar.
  - Collapsible **5-Year Depreciation Amortization Schedule** table.
  - Collapsible **Incident Repair & Maintenance History** breakdown.
- **`ExecutiveFinancialWidget.jsx`**:
  - Embedded in the Executive Dashboard.
  - Displays Total Capitalized Asset Value, Net Book Value, Total Maintenance OpEx, Total Infrastructure TCO, Capital Depreciation Ratio meter, and Category-wise Capital Allocation cards.
