# ⚡ High-Density Virtualized Data Tables & Quick Filters Guide

## Overview

This guide details the technical implementation, customizable density controls, column visibility management, keyboard navigation shortcuts, SRE filter presets, and multi-select bulk operations for the **High-Density Virtualized Data Tables & Quick Filters** in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In enterprise IT and data center environments:
- IT administrators and SREs manage thousands of physical and virtual assets.
- Standard pagination causes sluggish context switching, while fixed tables force horizontal scrolling and display unwanted columns.
- Power users need Excel-like speed, instant multi-field fuzzy search, quick keyboard shortcuts (`/`, `j`, `k`, `Enter`), and multi-select bulk lifecycle operations.

**The Solution**:
1. **Three Dynamic Density Modes**:
   - `Compact` (28px row height): Maximum information density for high-throughput operational review.
   - `Normal` (44px row height): Balanced operational view.
   - `Comfortable` (60px row height): Roomy touch-friendly presentation.
2. **Persistent Column Customization**:
   - Toggle visibility for Name, Type, Status, Location, Serial Number, Purchase Cost, Creator, and Created Date.
   - Saved automatically in `localStorage`.
3. **Power-User Keyboard Navigation Engine**:
   - `/`: Focus search input.
   - `j` / `ArrowDown`: Move highlight down.
   - `k` / `ArrowUp`: Move highlight up.
   - `Enter`: Navigate directly to asset details.
   - `x`: Toggle row selection.
   - `Escape`: Deselect all / blur search.
4. **SRE Quick Filter Presets & Fuzzy Search**:
   - 1-Click presets: `All Assets`, `🔥 Degraded / Issues`, `🖥️ Hardware & Infra`, `📦 Software`, `🌐 Network`.
   - Real-time client-side multi-field fuzzy filter.
5. **Multi-Select Floating Bulk Action Dock**:
   - Multi-select checkboxes + "Select All" toggle.
   - Bulk status transition (`active`, `in_use`, `maintenance`, `retired`, `damaged`).
   - 1-Click CSV and JSON data exports.
   - Bulk deletion.

---

## ⌨️ Power-User Keyboard Shortcuts

| Key / Combination | Action | Description |
| :--- | :--- | :--- |
| `/` | **Focus Search** | Instantly focuses the quick filter input from anywhere on the table |
| `j` or `↓` | **Navigate Down** | Moves row highlight down with auto-focus |
| `k` or `↑` | **Navigate Up** | Moves row highlight up |
| `x` | **Toggle Selection** | Selects / deselects the currently highlighted asset row |
| `Enter` | **Open Details** | Navigates directly to the highlighted asset's details page |
| `Escape` | **Clear / Blur** | Clears active search or deselects all selected items |

---

## 📡 Backend Bulk REST API Endpoints

| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/assets/bulk-status` | Batch update lifecycle status for multiple asset IDs | Authenticated (Operator / Admin) |
| `POST` | `/api/assets/bulk-delete` | Batch delete selected assets | Authenticated (Admin) |

### Request Payload Example (`POST /api/assets/bulk-status`):
```json
{
  "asset_ids": [
    "c686cae8-d6e3-4d40-84a1-b8d9ba8eeec0",
    "905c9fc2-63db-4ec6-8968-3e5e34749f7b"
  ],
  "status": "maintenance"
}
```

---

## 🎨 Component Architecture

1. **`AssetDataTable.jsx`**:
   - Self-contained high-density table engine.
   - Handles multi-column sorting (Name, Type, Status, Cost, Date Added).
   - Manages client-side export generation using standard Blob APIs (RFC 4180 CSV & formatted JSON).
   - Manages floating bottom bulk actions dock.
2. **`Asset/List.jsx`**:
   - Provides seamless toggle between High-Density Table View ⚡ and Card Grid View 🔲.
   - Displays real-time summary statistics cards (Total, Operational, Maintenance, Hardware counts).
