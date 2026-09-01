# 📋 Incident Post-Mortem & 5-Whys Root Cause Analysis (RCA) Generator Guide

## Overview

This guide details the database architecture, automated timeline reconstruction stored procedure, 5-Whys recursive causality framework, preventative action items lifecycle manager, and export capabilities for the **Incident Post-Mortem & Root Cause Analysis (RCA) Generator** in the IT Infrastructure Management System (ITIMS).

---

## 🎯 Enterprise Problem & Value Proposition

In fast-paced SRE and DevOps environments:
- When an incident is resolved, engineers rarely author comprehensive post-mortems because manually compiling timelines, calculating downtime duration, and assessing SLA breaches takes hours.
- Lessons learned are lost, leading to recurring outages of the same failure mode.
- Preventative action items assigned during debriefs lack tracking and ownership.

**The Solution**:
1. **Automated Post-Mortem Generation (`generate_incident_postmortem_draft`)**: On incident resolution, PostgreSQL automatically extracts the incident timeline, calculates total downtime, determines SLA compliance, assesses impacted assets, and initializes 5-Whys scaffolding.
2. **5-Whys Root Cause Analysis Framework**: Step-by-step recursive inquiry fields (Why 1 through Why 5) leading to a definitive Root Cause Declaration.
3. **Preventative Action Items Checklist**: Interactive task tracking with status transitions (`Pending` 🟡 / `In Progress` 🔵 / `Completed` 🟢), assignees, priorities, and due dates.
4. **Export & Print Ready**: 1-click Markdown export to clipboard and native print formatting for executive debriefs.

---

## 🏛️ 1. Relational Database Schema & Stored Procedure

All post-mortem data is maintained directly within the Supabase PostgreSQL database (`odgxypyknkqlcasvomej`):

### 1.1 `public.incident_postmortems` Table
```sql
CREATE TABLE IF NOT EXISTS public.incident_postmortems (
    id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id                 UUID        NOT NULL UNIQUE REFERENCES public.incidents(id) ON DELETE CASCADE,
    title                       TEXT        NOT NULL,
    executive_summary           TEXT,
    impact_summary              JSONB       NOT NULL DEFAULT '{
        "duration_minutes": 0,
        "total_affected_assets": 1,
        "sla_breached": false,
        "severity": "medium",
        "category": "performance",
        "mttd_minutes": 0,
        "mttr_minutes": 0
    }'::jsonb,
    timeline_events             JSONB       NOT NULL DEFAULT '[]'::jsonb,
    root_cause_analysis         JSONB       NOT NULL DEFAULT '{
        "methodology": "5_whys",
        "whys": ["", "", "", "", ""],
        "root_cause_statement": ""
    }'::jsonb,
    immediate_resolution_steps  TEXT,
    preventative_action_items   JSONB       NOT NULL DEFAULT '[]'::jsonb,
    author_id                   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
    status                      TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'published')),
    published_at                TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_postmortems_incident_id 
    ON public.incident_postmortems(incident_id);

CREATE INDEX IF NOT EXISTS idx_postmortems_status 
    ON public.incident_postmortems(status);
```

### 1.2 `public.generate_incident_postmortem_draft(p_incident_id, p_author_id)` Stored Procedure
- Extracts detection timestamp, technician acknowledgment (`first_responded_at`), and resolution timestamp (`resolved_at`).
- Computes Mean Time to Detect (MTTD) and Mean Time to Resolve (MTTR).
- Reconstructs chronological timeline milestone ladder.
- Populates initial preventative tasks (alert thresholds, runbook updates).
- Inserts or updates the document idempotently.

---

## 📡 2. Backend REST API Endpoints

| HTTP Method | Endpoint | Description | Access |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/incidents/<incident_id>/postmortem/generate` | Generate or refresh automated post-mortem draft | Authenticated |
| `GET` | `/api/incidents/<incident_id>/postmortem` | Retrieve post-mortem (auto-generates draft if missing) | Authenticated |
| `PUT` | `/api/incidents/<incident_id>/postmortem` | Update summary, 5-Whys, action items, or status | Authenticated |
| `GET` | `/api/incidents/<incident_id>/postmortem/export` | Export formatted Markdown document | Authenticated |
| `GET` | `/api/postmortems` | List all post-mortems across infrastructure | Authenticated |

---

## 🔍 3. 5-Whys Root Cause Analysis Methodology

The 5-Whys tool guides engineers to drill past superficial symptoms to uncover root systemic flaws:
- **Why 1**: What was the immediate operational failure observed? (e.g. *API gateway returned 504 Gateway Timeout*).
- **Why 2**: Why did that component fail? (e.g. *Back-end database pool exhausted available connections*).
- **Why 3**: Why was the pool exhausted? (e.g. *A slow unindexed table scan query held locks for 15+ seconds*).
- **Why 4**: Why was an unindexed query running in production? (e.g. *Query was deployed in hotfix without standard CI migration review*).
- **Why 5**: Why was CI migration review bypassed? (e.g. *Emergency hotfix runbook lacked mandatory linter gating*).
- **Root Cause Statement**: *Emergency deployment procedures lacked automated schema index validation in production pipeline.*

---

## 🎨 4. Frontend Visual Components

1. **`PostMortemModal.jsx`**:
   - **Executive Scorecard**: Total outage duration, MTTD, MTTR, primary affected asset, and SLA compliance status.
   - **Timeline Ladder**: Chronological milestone cards with pulsing node connectors.
   - **5-Whys Interactive Canvas**: Inline inputs for each causal tier and final declaration statement.
   - **Action Items Manager**: Dynamic task table allowing adding, removing, owner assignment, due date selection, and status toggles (`pending` 🟡 / `in_progress` 🔵 / `completed` 🟢).
   - **Export & Print**: Fast clipboard Markdown export and native print-to-PDF styles.
2. **`Incident/List.jsx`**:
   - Integrated **"📋 Post-Mortem & RCA"** action button on all resolved and closed incident cards.
