# 📈 Statistical Anomaly Detection & Chaos Telemetry Simulation Guide

## Overview

This guide details the mathematical outlier algorithms, PostgreSQL time-series tables, stored procedures, synthetic telemetry simulation scenarios, and interactive frontend SVG sparklines for the **Statistical Anomaly Detection & Chaos Telemetry Simulation** module in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In traditional infrastructure management:
- Incident creation is purely **reactive** — operators only find out after an outage occurs or users start reporting broken services.
- Static threshold alerts generate excessive alert fatigue or fail to catch subtle multi-variable performance degradations.
- Site Reliability Engineers (SREs) lack safe chaos engineering tools to validate monitoring and automated escalation pipelines.

**The Solution**:
1. **Time-Series Metric Ingestion (`public.telemetry_history`)**: Stores continuous metric samples (CPU, RAM, Disk, Latency, Error Rate, Bandwidth).
2. **Rolling Statistical Z-Score Outlier Engine**: Computes rolling population mean ($\mu$) and standard deviation ($\sigma$) over historical baseline windows ($N=50$) to evaluate standard deviation score:
   $$Z = \frac{|x - \mu|}{\sigma}$$
3. **Hard Emergency Safety Ceilings**: Failsafe limits (CPU $\ge 95\%$, RAM $\ge 92\%$, Error Rate $\ge 10\%$).
4. **Proactive Automated Incident Dispatch**: When $Z > 3.0\sigma$ or hard ceilings are breached, the system automatically opens a `critical`/`high` incident with full diagnostic context and SLA deadlines.
5. **Interactive SVG Sparkline Visualizer (`TelemetrySparkline.jsx`)**: Responsive SVG trendlines with gradient fills, threshold guidelines, and pulsing crimson anomaly markers.
6. **Chaos Engineering & Telemetry Simulator (`TelemetrySimulationPanel.jsx`)**: Realistic workload generators simulating CPU throttling surges, gradual memory leaks, DDoS flood surges, and disk exhaustion.

---

## 🏛️ 1. Relational Database Schema & Stored Procedures

All time-series data and statistical computations are executed within the single Supabase PostgreSQL database (`odgxypyknkqlcasvomej`):

### 1.1 `public.telemetry_history` Table
```sql
CREATE TABLE IF NOT EXISTS public.telemetry_history (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id             UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    cpu_usage            NUMERIC(5,2) NOT NULL CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
    memory_usage         NUMERIC(5,2) NOT NULL CHECK (memory_usage >= 0 AND memory_usage <= 100),
    disk_usage           NUMERIC(5,2) NOT NULL CHECK (disk_usage >= 0 AND disk_usage <= 100),
    latency_ms           NUMERIC(7,2) NOT NULL DEFAULT 0.0 CHECK (latency_ms >= 0),
    error_rate_percent   NUMERIC(5,2) NOT NULL DEFAULT 0.0 CHECK (error_rate_percent >= 0 AND error_rate_percent <= 100),
    bandwidth_usage_mbps NUMERIC(8,2) NOT NULL DEFAULT 0.0 CHECK (bandwidth_usage_mbps >= 0),
    is_anomaly           BOOLEAN     NOT NULL DEFAULT false,
    anomaly_score        NUMERIC(5,2) NOT NULL DEFAULT 0.0,
    anomaly_reasons      TEXT[]      DEFAULT '{}',
    recorded_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telemetry_history_asset_time 
    ON public.telemetry_history(asset_id, recorded_at DESC);
```

### 1.2 `public.anomaly_rules` Table
- `rule_name TEXT`
- `z_score_threshold NUMERIC(3,1) DEFAULT 3.0`
- `cpu_hard_ceiling NUMERIC(5,2) DEFAULT 95.0`
- `mem_hard_ceiling NUMERIC(5,2) DEFAULT 92.0`
- `error_hard_ceiling NUMERIC(5,2) DEFAULT 10.0`
- `auto_create_incident BOOLEAN DEFAULT true`

### 1.3 PostgreSQL Stored Procedures
- **`public.ingest_and_evaluate_telemetry(...)`**:
  - Ingests a new sample, computes rolling $\mu$ and $\sigma$ over the last 50 points using `AVG()` and `STDDEV_POP()`.
  - Determines if $Z > 3.0$ or safety ceilings are breached.
  - Updates current `public.asset_metrics`.
  - If anomalous, automatically creates an incident in `public.incidents` (deduplicating against already open incidents for that asset).
- **`public.get_asset_telemetry_history(p_asset_id, p_limit)`**:
  - Fetches the last $N$ time-series samples for sparklines.
- **`public.get_system_anomaly_overview()`**:
  - Aggregates total samples, total anomaly count, affected assets, and recent breach logs.

---

## 📡 2. Backend REST API Endpoints

| HTTP Method | Endpoint | Description | Role Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/assets/<asset_id>/telemetry` | Ingest a metric sample & evaluate Z-Score anomaly | Authenticated |
| `GET` | `/api/assets/<asset_id>/telemetry/history` | Retrieve rolling time-series samples for sparklines | Authenticated |
| `POST` | `/api/telemetry/simulate` | Trigger synthetic chaos simulation tick across assets | Authenticated |
| `GET` | `/api/telemetry/anomalies/summary` | Retrieve system-wide anomaly scorecard | Authenticated |

---

## 🧪 3. Synthetic Chaos Simulation Scenarios

The simulator supports 5 distinct operational modes:
1. 🟢 **Normal Operations**: Generates nominal asset-specific baselines with $\pm 3\%$ natural jitter.
2. 🔴 **CPU Throttling Surge**: Spikes CPU load to $97\text{--}99\%$, driving $Z > 3.5\sigma$ and triggering a `critical` incident.
3. 🟣 **Gradual Memory Leak**: Drifts RAM allocation to $94\text{--}96\%$, surpassing the critical memory exhaustion threshold.
4. 🟡 **DDoS SYN Flood**: Injects $> 1\text{ Gbps}$ bandwidth surge, $200\text{ms+}$ latency spike, and $15\%$ HTTP error rate.
5. 🟠 **Disk Volume Exhaustion**: Drives storage volume to $98\%$ capacity.

---

## 🎨 4. Frontend Visual Components

1. **`TelemetrySparkline.jsx`**:
   - Ultra-responsive SVG curve rendering with gradient fill area underneath.
   - Threshold dashed guideline.
   - Pulsing red dot indicators on anomalous coordinates with hover tooltips showing timestamp, value, and deviation score ($\sigma$).
2. **`TelemetrySimulationPanel.jsx`**:
   - Chaos Engineering drawer allowing operators to select scenarios, choose target assets, and trigger manual or continuous (5-second auto-stream) simulation ticks.
3. **`AssetAnomalyBanner.jsx`**:
   - Dynamic top banner on Asset Details that activates when an anomaly is detected, summarizing diagnostic reasons and linking directly to the auto-generated ticket.
4. **`Asset/Details.jsx`**:
   - Upgraded Real-time Metrics section with live multi-metric SVG sparklines and simulation controls.
