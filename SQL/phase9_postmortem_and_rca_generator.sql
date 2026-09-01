-- =============================================================================
-- Phase 9: Automated Post-Mortem & Root Cause Analysis (RCA) Generator
-- Database Migration Script for Supabase PostgreSQL 17
-- =============================================================================

BEGIN;

-- 1. Create public.incident_postmortems table
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

-- 2. Stored Procedure: Auto-generate Post-Mortem Draft on Incident Resolution
CREATE OR REPLACE FUNCTION public.generate_incident_postmortem_draft(
    p_incident_id UUID,
    p_author_id   UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_inc RECORD;
    v_asset_name TEXT := 'Unknown Asset';
    v_reporter_name TEXT := 'System Operator';
    v_assignee_name TEXT := 'Unassigned';
    v_duration_min INT := 0;
    v_mttd_min INT := 0;
    v_mttr_min INT := 0;
    v_timeline JSONB := '[]'::jsonb;
    v_existing_id UUID;
    v_postmortem_id UUID;
    v_created_ts TIMESTAMPTZ;
    v_responded_ts TIMESTAMPTZ;
    v_resolved_ts TIMESTAMPTZ;
    v_now_ts TIMESTAMPTZ := now();
    v_impact JSONB;
BEGIN
    -- 1. Fetch incident record
    SELECT * INTO v_inc FROM public.incidents WHERE id = p_incident_id;
    IF v_inc IS NULL THEN
        RAISE EXCEPTION 'Incident % not found', p_incident_id;
    END IF;

    -- 2. Fetch associated asset name
    IF v_inc.asset_id IS NOT NULL THEN
        SELECT name INTO v_asset_name FROM public.assets WHERE id = v_inc.asset_id;
    END IF;

    -- 3. Fetch reporter & assignee names
    IF v_inc.reported_by IS NOT NULL THEN
        SELECT COALESCE(full_name, email) INTO v_reporter_name FROM public.profiles WHERE id = v_inc.reported_by;
    END IF;
    IF v_inc.assigned_to IS NOT NULL THEN
        SELECT COALESCE(full_name, email) INTO v_assignee_name FROM public.profiles WHERE id = v_inc.assigned_to;
    END IF;

    v_created_ts := COALESCE(v_inc.reported_at, v_inc.created_at, v_now_ts);
    v_responded_ts := v_inc.first_responded_at;
    v_resolved_ts := COALESCE(v_inc.resolved_at, v_inc.updated_at, v_now_ts);

    -- Compute duration and milestones
    v_duration_min := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_resolved_ts - v_created_ts)) / 60.0));
    IF v_responded_ts IS NOT NULL THEN
        v_mttd_min := GREATEST(0, ROUND(EXTRACT(EPOCH FROM (v_responded_ts - v_created_ts)) / 60.0));
    END IF;
    v_mttr_min := v_duration_min;

    -- 4. Construct chronological timeline
    v_timeline := jsonb_build_array(
        jsonb_build_object(
            'timestamp', v_created_ts,
            'event_type', 'incident_detected',
            'title', 'Incident Detected & Ticket Created',
            'description', format('Incident reported by %s with severity %s.', v_reporter_name, upper(v_inc.severity)),
            'actor', v_reporter_name
        )
    );

    IF v_responded_ts IS NOT NULL THEN
        v_timeline := v_timeline || jsonb_build_object(
            'timestamp', v_responded_ts,
            'event_type', 'first_response',
            'title', 'Technician Acknowledged Incident',
            'description', format('Initial response recorded in %s minutes. SLA %s.', v_mttd_min, CASE WHEN v_inc.sla_response_breached THEN 'BREACHED' ELSE 'MET' END),
            'actor', v_assignee_name
        );
    END IF;

    IF v_inc.status IN ('resolved', 'closed') THEN
        v_timeline := v_timeline || jsonb_build_object(
            'timestamp', v_resolved_ts,
            'event_type', 'incident_resolved',
            'title', 'Incident Mitigated & Resolved',
            'description', format('Total outage duration: %s minutes. SLA %s. Notes: %s', v_duration_min, CASE WHEN v_inc.sla_resolution_breached THEN 'BREACHED' ELSE 'MET' END, COALESCE(v_inc.resolution_notes, 'Mitigation verified.')),
            'actor', v_assignee_name
        );
    END IF;

    -- 5. Construct impact summary
    v_impact := jsonb_build_object(
        'duration_minutes', v_duration_min,
        'total_affected_assets', 1,
        'sla_breached', (COALESCE(v_inc.sla_response_breached, false) OR COALESCE(v_inc.sla_resolution_breached, false)),
        'severity', v_inc.severity,
        'category', COALESCE(v_inc.category, 'infrastructure'),
        'mttd_minutes', v_mttd_min,
        'mttr_minutes', v_mttr_min,
        'primary_asset', v_asset_name
    );

    -- 6. Check if post-mortem already exists
    SELECT id INTO v_existing_id FROM public.incident_postmortems WHERE incident_id = p_incident_id;

    IF v_existing_id IS NOT NULL THEN
        -- Update existing draft's timeline and impact without overwriting user-edited 5-Whys
        UPDATE public.incident_postmortems SET
            impact_summary = v_impact,
            timeline_events = v_timeline,
            updated_at = now()
        WHERE id = v_existing_id
        RETURNING id INTO v_postmortem_id;
    ELSE
        -- Insert new post-mortem draft
        INSERT INTO public.incident_postmortems (
            incident_id,
            title,
            executive_summary,
            impact_summary,
            timeline_events,
            root_cause_analysis,
            immediate_resolution_steps,
            preventative_action_items,
            author_id,
            status
        ) VALUES (
            p_incident_id,
            format('Post-Mortem: %s', v_inc.title),
            format('On %s, an incident occurred on %s affecting operations for %s minutes. The issue was identified as %s and mitigated.', 
                   to_char(v_created_ts, 'YYYY-MM-DD HH24:MI UTC'), v_asset_name, v_duration_min, v_inc.title),
            v_impact,
            v_timeline,
            jsonb_build_object(
                'methodology', '5_whys',
                'whys', jsonb_build_array(
                    format('Why 1: %s malfunctioned or experienced high error rates.', v_asset_name),
                    'Why 2: [Investigate immediate trigger / resource exhaustion]',
                    'Why 3: [Investigate configuration / traffic overload]',
                    'Why 4: [Investigate process / testing gap]',
                    'Why 5: [Investigate systemic root cause]'
                ),
                'root_cause_statement', format('Root cause pending detailed SRE review on %s.', v_asset_name)
            ),
            COALESCE(v_inc.resolution_notes, 'Service restored to nominal operational parameters.'),
            jsonb_build_array(
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'task_description', format('Implement telemetry alert threshold for %s', v_asset_name),
                    'owner', v_assignee_name,
                    'status', 'pending',
                    'priority', 'high',
                    'due_date', (CURRENT_DATE + INTERVAL '7 days')::TEXT
                ),
                jsonb_build_object(
                    'id', gen_random_uuid(),
                    'task_description', 'Update runbook & standard operating procedures',
                    'owner', v_assignee_name,
                    'status', 'pending',
                    'priority', 'medium',
                    'due_date', (CURRENT_DATE + INTERVAL '14 days')::TEXT
                )
            ),
            p_author_id,
            'draft'
        ) RETURNING id INTO v_postmortem_id;
    END IF;

    -- Return full postmortem document
    RETURN (
        SELECT to_jsonb(p) 
        FROM public.incident_postmortems p 
        WHERE p.id = v_postmortem_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Enable RLS
ALTER TABLE public.incident_postmortems ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read postmortems" ON public.incident_postmortems;
CREATE POLICY "Authenticated users can read postmortems"
    ON public.incident_postmortems FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can create/update postmortems" ON public.incident_postmortems;
CREATE POLICY "Authenticated users can create/update postmortems"
    ON public.incident_postmortems FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;
