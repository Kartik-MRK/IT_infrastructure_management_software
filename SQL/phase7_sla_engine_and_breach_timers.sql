-- =============================================================================
-- Phase 7: Service Level Agreement (SLA) Engine & Real-Time Breach Timers
-- Database Migration Script for Supabase PostgreSQL 17
-- =============================================================================

BEGIN;

-- 1. Create public.sla_policies table
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

-- 2. Add SLA columns to public.incidents if not already present
ALTER TABLE public.incidents
    ADD COLUMN IF NOT EXISTS response_deadline        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolution_deadline      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_responded_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_status               TEXT NOT NULL DEFAULT 'within_sla' CHECK (sla_status IN ('within_sla', 'approaching_breach', 'breached')),
    ADD COLUMN IF NOT EXISTS sla_response_breached    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sla_resolution_breached  BOOLEAN NOT NULL DEFAULT false;

-- 3. Seed Default Enterprise SLA Policies
INSERT INTO public.sla_policies (policy_name, severity, max_response_time_minutes, max_resolution_time_minutes, business_hours_only, escalation_email)
VALUES
    ('P1 - Critical Outage SLA', 'critical', 15, 120, false, 'sre-oncall@enterprise.local'),
    ('P2 - High Priority SLA', 'high', 60, 480, false, 'ops-leads@enterprise.local'),
    ('P3 - Medium Priority SLA', 'medium', 240, 1440, true, 'it-support@enterprise.local'),
    ('P4 - Low Priority / Request SLA', 'low', 1440, 4320, true, 'helpdesk@enterprise.local')
ON CONFLICT (severity) DO UPDATE SET
    policy_name = EXCLUDED.policy_name,
    max_response_time_minutes = EXCLUDED.max_response_time_minutes,
    max_resolution_time_minutes = EXCLUDED.max_resolution_time_minutes,
    business_hours_only = EXCLUDED.business_hours_only,
    escalation_email = EXCLUDED.escalation_email;

-- 4. Function & Trigger to automatically compute SLA deadlines on incident insert or severity update
CREATE OR REPLACE FUNCTION public.calculate_incident_sla_deadlines()
RETURNS TRIGGER AS $$
DECLARE
    v_policy RECORD;
    v_base_time TIMESTAMPTZ;
BEGIN
    v_base_time := COALESCE(NEW.reported_at, NEW.created_at, now());

    -- Fetch active policy for the incident severity
    SELECT * INTO v_policy 
    FROM public.sla_policies 
    WHERE severity = NEW.severity AND is_active = true 
    LIMIT 1;

    IF FOUND THEN
        -- Only set deadlines if not manually overridden
        IF NEW.response_deadline IS NULL OR (TG_OP = 'UPDATE' AND OLD.severity IS DISTINCT FROM NEW.severity) THEN
            NEW.response_deadline := v_base_time + (v_policy.max_response_time_minutes || ' minutes')::INTERVAL;
        END IF;

        IF NEW.resolution_deadline IS NULL OR (TG_OP = 'UPDATE' AND OLD.severity IS DISTINCT FROM NEW.severity) THEN
            NEW.resolution_deadline := v_base_time + (v_policy.max_resolution_time_minutes || ' minutes')::INTERVAL;
        END IF;
    END IF;

    -- Evaluate breach status on save
    IF NEW.status = 'resolved' OR NEW.status = 'closed' THEN
        IF NEW.resolved_at IS NOT NULL AND NEW.resolution_deadline IS NOT NULL AND NEW.resolved_at > NEW.resolution_deadline THEN
            NEW.sla_resolution_breached := true;
            NEW.sla_status := 'breached';
        ELSE
            NEW.sla_status := 'within_sla';
        END IF;
    ELSE
        IF NEW.resolution_deadline IS NOT NULL AND now() > NEW.resolution_deadline THEN
            NEW.sla_resolution_breached := true;
            NEW.sla_status := 'breached';
        ELSIF NEW.resolution_deadline IS NOT NULL AND now() > (NEW.resolution_deadline - INTERVAL '30 minutes') THEN
            NEW.sla_status := 'approaching_breach';
        ELSE
            NEW.sla_status := 'within_sla';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_calculate_incident_sla ON public.incidents;
CREATE TRIGGER trg_calculate_incident_sla
    BEFORE INSERT OR UPDATE OF severity, status, resolved_at ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_incident_sla_deadlines();

-- 5. Stored Procedure: Get SLA Compliance Summary
CREATE OR REPLACE FUNCTION public.get_sla_compliance_summary()
RETURNS TABLE (
    total_incidents             BIGINT,
    resolved_incidents          BIGINT,
    resolved_within_sla         BIGINT,
    sla_compliance_percentage   NUMERIC,
    active_breached_count       BIGINT,
    active_approaching_count    BIGINT,
    avg_mttd_minutes            NUMERIC,
    avg_mttr_minutes            NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH metrics AS (
        SELECT
            COUNT(*) AS total_inc,
            COUNT(*) FILTER (WHERE inc.status IN ('resolved', 'closed')) AS res_inc,
            COUNT(*) FILTER (WHERE inc.status IN ('resolved', 'closed') AND inc.sla_resolution_breached = false) AS res_within_sla,
            COUNT(*) FILTER (WHERE inc.status NOT IN ('resolved', 'closed') AND inc.sla_status = 'breached') AS act_breached,
            COUNT(*) FILTER (WHERE inc.status NOT IN ('resolved', 'closed') AND inc.sla_status = 'approaching_breach') AS act_app,
            AVG(EXTRACT(EPOCH FROM (COALESCE(inc.first_responded_at, inc.resolved_at, now()) - inc.created_at)) / 60.0) AS avg_mttd,
            AVG(EXTRACT(EPOCH FROM (inc.resolved_at - inc.created_at)) / 60.0) FILTER (WHERE inc.status IN ('resolved', 'closed')) AS avg_mttr
        FROM public.incidents inc
    )
    SELECT
        m.total_inc,
        m.res_inc,
        m.res_within_sla,
        ROUND(COALESCE((m.res_within_sla::NUMERIC / NULLIF(m.res_inc, 0)) * 100.0, 100.0), 2) AS sla_compliance_percentage,
        m.act_breached,
        m.act_app,
        ROUND(COALESCE(m.avg_mttd, 0.0), 1) AS avg_mttd_minutes,
        ROUND(COALESCE(m.avg_mttr, 0.0), 1) AS avg_mttr_minutes
    FROM metrics m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable RLS on sla_policies
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read SLA policies" ON public.sla_policies;
CREATE POLICY "Authenticated users can read SLA policies"
    ON public.sla_policies FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage SLA policies" ON public.sla_policies;
CREATE POLICY "Admins can manage SLA policies"
    ON public.sla_policies FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('admin', 'it_admin')
        )
    );

-- 7. Update existing incidents to calculate SLA deadlines
UPDATE public.incidents SET severity = severity;

COMMIT;
