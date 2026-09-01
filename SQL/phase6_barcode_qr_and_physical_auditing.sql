-- =============================================================================
-- IT Infrastructure Management System (ITIMS)
-- Phase 6: Barcode, QR Code & Physical Asset Auditing
-- Engine: PostgreSQL 17 | Supabase Platform
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ADD AUDIT TRACKING FIELDS TO ASSETS
-- -----------------------------------------------------------------------------
ALTER TABLE public.assets 
    ADD COLUMN IF NOT EXISTS last_audited_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS audit_status TEXT DEFAULT 'pending' CHECK (audit_status IN ('verified', 'flagged', 'missing', 'pending'));

CREATE INDEX IF NOT EXISTS idx_assets_audit_status ON public.assets (audit_status);
CREATE INDEX IF NOT EXISTS idx_assets_last_audited ON public.assets (last_audited_at);

COMMENT ON COLUMN public.assets.last_audited_at IS 'Timestamp of the most recent verified physical inventory audit';
COMMENT ON COLUMN public.assets.audit_status IS 'Physical audit compliance state: verified, flagged (discrepancy), missing, or pending';


-- -----------------------------------------------------------------------------
-- 2. CREATE ASSET AUDITS TABLE (PHYSICAL VERIFICATION LOGS)
-- -----------------------------------------------------------------------------
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

CREATE INDEX IF NOT EXISTS idx_audits_asset ON public.asset_audits (asset_id);
CREATE INDEX IF NOT EXISTS idx_audits_auditor ON public.asset_audits (auditor_id);
CREATE INDEX IF NOT EXISTS idx_audits_time ON public.asset_audits (audited_at DESC);
CREATE INDEX IF NOT EXISTS idx_audits_condition ON public.asset_audits (physical_condition);

COMMENT ON TABLE public.asset_audits IS 'Historical ledger of verified physical scans, condition checks, and location audits';


-- -----------------------------------------------------------------------------
-- 3. STORED FUNCTION: RECORD PHYSICAL AUDIT & SYNC ASSET STATE
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_asset_physical_audit(
    p_asset_id UUID,
    p_auditor_id UUID,
    p_location_verified BOOLEAN,
    p_observed_location TEXT,
    p_status_verified BOOLEAN,
    p_observed_status TEXT,
    p_physical_condition TEXT,
    p_scan_method TEXT,
    p_notes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_audit_id UUID;
    v_new_audit_status TEXT;
    v_asset RECORD;
BEGIN
    SELECT * INTO v_asset FROM public.assets WHERE id = p_asset_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Asset with ID % not found', p_asset_id;
    END IF;

    -- Determine new audit status
    IF p_physical_condition = 'missing' THEN
        v_new_audit_status := 'missing';
    ELSIF p_physical_condition = 'damaged' OR NOT p_location_verified OR NOT p_status_verified THEN
        v_new_audit_status := 'flagged';
    ELSE
        v_new_audit_status := 'verified';
    END IF;

    -- Insert Audit Record
    INSERT INTO public.asset_audits (
        asset_id,
        auditor_id,
        location_verified,
        observed_location,
        status_verified,
        observed_status,
        physical_condition,
        scan_method,
        notes
    ) VALUES (
        p_asset_id,
        p_auditor_id,
        p_location_verified,
        p_observed_location,
        p_status_verified,
        p_observed_status,
        p_physical_condition,
        p_scan_method,
        p_notes
    ) RETURNING id INTO v_audit_id;

    -- Update Asset State
    UPDATE public.assets
    SET 
        last_audited_at = now(),
        audit_status = v_new_audit_status,
        updated_at = now()
    WHERE id = p_asset_id;

    RETURN jsonb_build_object(
        'audit_id', v_audit_id,
        'asset_id', p_asset_id,
        'audit_status', v_new_audit_status,
        'audited_at', now()
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. STORED FUNCTION: GET PHYSICAL AUDIT COMPLIANCE SUMMARY
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_physical_audit_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_total_assets INT := 0;
    v_audited_90_days INT := 0;
    v_verified INT := 0;
    v_flagged INT := 0;
    v_missing INT := 0;
    v_pending INT := 0;
    v_compliance_percent NUMERIC(5, 2) := 0.00;
BEGIN
    SELECT COUNT(*) INTO v_total_assets 
    FROM public.assets 
    WHERE is_active = true AND deleted_at IS NULL;

    SELECT 
        COUNT(*) FILTER (WHERE last_audited_at >= (now() - INTERVAL '90 days')),
        COUNT(*) FILTER (WHERE audit_status = 'verified'),
        COUNT(*) FILTER (WHERE audit_status = 'flagged'),
        COUNT(*) FILTER (WHERE audit_status = 'missing'),
        COUNT(*) FILTER (WHERE audit_status = 'pending' OR audit_status IS NULL)
    INTO 
        v_audited_90_days,
        v_verified,
        v_flagged,
        v_missing,
        v_pending
    FROM public.assets
    WHERE is_active = true AND deleted_at IS NULL;

    IF v_total_assets > 0 THEN
        v_compliance_percent := ROUND((v_audited_90_days::NUMERIC / v_total_assets::NUMERIC) * 100, 2);
    END IF;

    RETURN jsonb_build_object(
        'total_assets', v_total_assets,
        'audited_last_90_days', v_audited_90_days,
        'audit_compliance_percent', v_compliance_percent,
        'verified_count', v_verified,
        'flagged_count', v_flagged,
        'missing_count', v_missing,
        'pending_count', v_pending
    );
END;
$$;


-- -----------------------------------------------------------------------------
-- 5. RLS SECURITY POLICIES FOR ASSET AUDITS
-- -----------------------------------------------------------------------------
ALTER TABLE public.asset_audits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View asset audits policy" ON public.asset_audits 
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create asset audits policy" ON public.asset_audits 
    FOR INSERT TO authenticated WITH CHECK (
        public.has_permission('assets:update') 
        OR public.has_permission('assets:create')
        OR auth.uid() = auditor_id
    );

CREATE POLICY "Manage asset audits policy" ON public.asset_audits 
    FOR ALL TO authenticated USING (
        public.has_permission('assets:delete')
    );

COMMIT;
