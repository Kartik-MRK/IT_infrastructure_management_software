-- =============================================================================
-- Phase 8: Statistical Anomaly Detection & Telemetry Simulation Suite
-- Database Migration Script for Supabase PostgreSQL 17
-- =============================================================================

BEGIN;

-- 1. Create public.telemetry_history table for time-series metrics
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

-- 2. Create public.anomaly_rules table for threshold customization
CREATE TABLE IF NOT EXISTS public.anomaly_rules (
    id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_name              TEXT        NOT NULL,
    z_score_threshold      NUMERIC(3,1) NOT NULL DEFAULT 3.0,
    cpu_hard_ceiling       NUMERIC(5,2) NOT NULL DEFAULT 95.0,
    mem_hard_ceiling       NUMERIC(5,2) NOT NULL DEFAULT 92.0,
    error_hard_ceiling     NUMERIC(5,2) NOT NULL DEFAULT 10.0,
    auto_create_incident   BOOLEAN     NOT NULL DEFAULT true,
    is_active              BOOLEAN     NOT NULL DEFAULT true,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.anomaly_rules (rule_name, z_score_threshold, cpu_hard_ceiling, mem_hard_ceiling, error_hard_ceiling, auto_create_incident)
VALUES ('Standard Enterprise Z-Score & Hard Ceiling Rule', 3.0, 95.0, 92.0, 10.0, true)
ON CONFLICT DO NOTHING;

-- 3. Stored Procedure: Ingest Telemetry Sample and Evaluate Anomaly (Z-Score + Ceilings)
CREATE OR REPLACE FUNCTION public.ingest_and_evaluate_telemetry(
    p_asset_id             UUID,
    p_cpu                  NUMERIC,
    p_mem                  NUMERIC,
    p_disk                 NUMERIC,
    p_latency              NUMERIC DEFAULT 5.0,
    p_error_rate           NUMERIC DEFAULT 0.0,
    p_bandwidth            NUMERIC DEFAULT 100.0,
    p_auto_incident        BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
    v_mean_cpu NUMERIC := 0.0;
    v_std_cpu NUMERIC := 0.0;
    v_z_cpu NUMERIC := 0.0;

    v_mean_mem NUMERIC := 0.0;
    v_std_mem NUMERIC := 0.0;
    v_z_mem NUMERIC := 0.0;

    v_is_anomaly BOOLEAN := false;
    v_max_z NUMERIC := 0.0;
    v_reasons TEXT[] := '{}';
    v_history_count INT := 0;
    v_inserted_id UUID;
    v_asset_name TEXT;
    v_admin_id UUID;
    v_incident_id UUID;
BEGIN
    -- Clamp percentage values
    p_cpu := LEAST(100.0, GREATEST(0.0, p_cpu));
    p_mem := LEAST(100.0, GREATEST(0.0, p_mem));
    p_disk := LEAST(100.0, GREATEST(0.0, p_disk));
    p_error_rate := LEAST(100.0, GREATEST(0.0, p_error_rate));

    -- Get historical mean and stddev over last 50 samples
    SELECT 
        COUNT(*),
        COALESCE(AVG(cpu_usage), p_cpu),
        COALESCE(STDDEV_POP(cpu_usage), 0.0),
        COALESCE(AVG(memory_usage), p_mem),
        COALESCE(STDDEV_POP(memory_usage), 0.0)
    INTO
        v_history_count,
        v_mean_cpu,
        v_std_cpu,
        v_mean_mem,
        v_std_mem
    FROM (
        SELECT cpu_usage, memory_usage 
        FROM public.telemetry_history 
        WHERE asset_id = p_asset_id 
        ORDER BY recorded_at DESC 
        LIMIT 50
    ) sub;

    -- Compute Z-Scores if we have historical variance
    IF v_std_cpu > 1.0 THEN
        v_z_cpu := ABS(p_cpu - v_mean_cpu) / v_std_cpu;
        IF v_z_cpu > 3.0 THEN
            v_is_anomaly := true;
            v_reasons := array_append(v_reasons, format('CPU Z-Score %.1fσ above rolling mean (%.1f%% vs avg %.1f%%)', v_z_cpu, p_cpu, v_mean_cpu));
        END IF;
    END IF;

    IF v_std_mem > 1.0 THEN
        v_z_mem := ABS(p_mem - v_mean_mem) / v_std_mem;
        IF v_z_mem > 3.0 THEN
            v_is_anomaly := true;
            v_reasons := array_append(v_reasons, format('Memory Z-Score %.1fσ above rolling mean (%.1f%% vs avg %.1f%%)', v_z_mem, p_mem, v_mean_mem));
        END IF;
    END IF;

    -- Hard Safety Ceilings
    IF p_cpu >= 95.0 THEN
        v_is_anomaly := true;
        v_reasons := array_append(v_reasons, format('CPU reached emergency ceiling (%.1f%% >= 95%%)', p_cpu));
    END IF;

    IF p_mem >= 92.0 THEN
        v_is_anomaly := true;
        v_reasons := array_append(v_reasons, format('Memory reached critical exhaustion ceiling (%.1f%% >= 92%%)', p_mem));
    END IF;

    IF p_error_rate >= 10.0 THEN
        v_is_anomaly := true;
        v_reasons := array_append(v_reasons, format('Service error rate exceeded critical threshold (%.1f%% >= 10%%)', p_error_rate));
    END IF;

    v_max_z := ROUND(GREATEST(v_z_cpu, v_z_mem), 2);

    -- Insert into telemetry_history
    INSERT INTO public.telemetry_history (
        asset_id, cpu_usage, memory_usage, disk_usage, latency_ms, error_rate_percent, bandwidth_usage_mbps, is_anomaly, anomaly_score, anomaly_reasons, recorded_at
    ) VALUES (
        p_asset_id, p_cpu, p_mem, p_disk, p_latency, p_error_rate, p_bandwidth, v_is_anomaly, v_max_z, v_reasons, now()
    ) RETURNING id INTO v_inserted_id;

    -- Update current asset_metrics
    UPDATE public.asset_metrics SET
        cpu_usage = p_cpu,
        memory_usage = p_mem,
        disk_usage = p_disk,
        bandwidth_usage_mbps = p_bandwidth,
        latency_ms = p_latency,
        health_status = CASE 
            WHEN v_is_anomaly OR p_cpu >= 90.0 OR p_mem >= 90.0 THEN 'warning'
            WHEN p_cpu >= 95.0 OR p_mem >= 95.0 THEN 'critical'
            ELSE 'healthy'
        END,
        last_updated = now()
    WHERE asset_id = p_asset_id;

    -- Auto-create Incident if Anomaly detected and no open incident exists for this asset
    IF v_is_anomaly AND p_auto_incident THEN
        SELECT name INTO v_asset_name FROM public.assets WHERE id = p_asset_id;
        SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' LIMIT 1;
        IF v_admin_id IS NULL THEN
            SELECT id INTO v_admin_id FROM public.profiles LIMIT 1;
        END IF;

        -- Check if an active open incident exists for this asset
        IF NOT EXISTS (
            SELECT 1 FROM public.incidents 
            WHERE asset_id = p_asset_id AND status IN ('open', 'in_progress')
        ) THEN
            INSERT INTO public.incidents (
                title, description, severity, status, category, asset_id, reported_by
            ) VALUES (
                format('[AUTOMATED] Anomaly Detected on %s (Score: %sσ)', COALESCE(v_asset_name, 'Asset'), v_max_z),
                format('Automated SRE Outlier Engine detected anomalous metric deviations:%s%s', E'\n- ', array_to_string(v_reasons, E'\n- ')),
                CASE WHEN p_cpu >= 95.0 OR p_mem >= 95.0 OR v_max_z >= 4.0 THEN 'critical' ELSE 'high' END,
                'open',
                'performance',
                p_asset_id,
                v_admin_id
            ) RETURNING id INTO v_incident_id;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'telemetry_id', v_inserted_id,
        'is_anomaly', v_is_anomaly,
        'anomaly_score', v_max_z,
        'anomaly_reasons', to_jsonb(v_reasons),
        'auto_incident_id', v_incident_id,
        'cpu_usage', p_cpu,
        'memory_usage', p_mem
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Stored Procedure: Fetch Telemetry History for Sparklines
CREATE OR REPLACE FUNCTION public.get_asset_telemetry_history(
    p_asset_id   UUID,
    p_limit      INT DEFAULT 30
)
RETURNS TABLE (
    id                   UUID,
    cpu_usage            NUMERIC,
    memory_usage         NUMERIC,
    disk_usage           NUMERIC,
    latency_ms           NUMERIC,
    error_rate_percent   NUMERIC,
    bandwidth_usage_mbps NUMERIC,
    is_anomaly           BOOLEAN,
    anomaly_score        NUMERIC,
    recorded_at          TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        th.id,
        th.cpu_usage,
        th.memory_usage,
        th.disk_usage,
        th.latency_ms,
        th.error_rate_percent,
        th.bandwidth_usage_mbps,
        th.is_anomaly,
        th.anomaly_score,
        th.recorded_at
    FROM public.telemetry_history th
    WHERE th.asset_id = p_asset_id
    ORDER BY th.recorded_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Stored Procedure: System Anomaly Overview
CREATE OR REPLACE FUNCTION public.get_system_anomaly_overview()
RETURNS JSONB AS $$
DECLARE
    v_total_samples BIGINT;
    v_anomaly_count BIGINT;
    v_affected_assets BIGINT;
    v_recent_anomalies JSONB;
BEGIN
    SELECT COUNT(*) INTO v_total_samples FROM public.telemetry_history;
    SELECT COUNT(*) INTO v_anomaly_count FROM public.telemetry_history WHERE is_anomaly = true;
    SELECT COUNT(DISTINCT asset_id) INTO v_affected_assets FROM public.telemetry_history WHERE is_anomaly = true;

    SELECT COALESCE(jsonb_agg(sub), '[]'::jsonb) INTO v_recent_anomalies
    FROM (
        SELECT 
            th.id,
            th.asset_id,
            ast.name AS asset_name,
            th.cpu_usage,
            th.memory_usage,
            th.anomaly_score,
            th.anomaly_reasons,
            th.recorded_at
        FROM public.telemetry_history th
        JOIN public.assets ast ON ast.id = th.asset_id
        WHERE th.is_anomaly = true
        ORDER BY th.recorded_at DESC
        LIMIT 10
    ) sub;

    RETURN jsonb_build_object(
        'total_telemetry_samples', v_total_samples,
        'total_anomalies_detected', v_anomaly_count,
        'affected_assets_count', v_affected_assets,
        'recent_anomalies', v_recent_anomalies
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Enable RLS
ALTER TABLE public.telemetry_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomaly_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read telemetry history" ON public.telemetry_history;
CREATE POLICY "Authenticated users can read telemetry history"
    ON public.telemetry_history FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert telemetry history" ON public.telemetry_history;
CREATE POLICY "Authenticated users can insert telemetry history"
    ON public.telemetry_history FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can read anomaly rules" ON public.anomaly_rules;
CREATE POLICY "Authenticated users can read anomaly rules"
    ON public.anomaly_rules FOR SELECT TO authenticated USING (true);

-- 7. Seed Initial Baseline Telemetry for Active Assets
DO $$
DECLARE
    r RECORD;
    i INT;
    v_base_cpu NUMERIC;
    v_base_mem NUMERIC;
    v_base_disk NUMERIC;
    v_base_lat NUMERIC;
BEGIN
    FOR r IN SELECT id, type FROM public.assets WHERE is_active = true LOOP
        v_base_cpu := CASE WHEN r.type = 'hardware' THEN 35.0 WHEN r.type = 'network' THEN 22.0 ELSE 18.0 END;
        v_base_mem := CASE WHEN r.type = 'hardware' THEN 65.0 WHEN r.type = 'network' THEN 40.0 ELSE 30.0 END;
        v_base_disk := 48.0;
        v_base_lat := 2.5;

        -- Seed 20 historical points with minor gaussian-like jitter
        FOR i IN 1..20 LOOP
            INSERT INTO public.telemetry_history (
                asset_id,
                cpu_usage,
                memory_usage,
                disk_usage,
                latency_ms,
                error_rate_percent,
                bandwidth_usage_mbps,
                is_anomaly,
                anomaly_score,
                recorded_at
            ) VALUES (
                r.id,
                ROUND((v_base_cpu + (random() * 8.0 - 4.0))::NUMERIC, 2),
                ROUND((v_base_mem + (random() * 6.0 - 3.0))::NUMERIC, 2),
                ROUND((v_base_disk + (random() * 2.0 - 1.0))::NUMERIC, 2),
                ROUND((v_base_lat + (random() * 1.5 - 0.7))::NUMERIC, 2),
                0.0,
                ROUND((50.0 + random() * 100.0)::NUMERIC, 2),
                false,
                0.0,
                now() - ((21 - i) * INTERVAL '5 minutes')
            );
        END LOOP;
    END LOOP;
END $$;

COMMIT;
