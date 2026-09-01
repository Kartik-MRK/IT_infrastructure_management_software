-- =============================================================================
-- IT Infrastructure Management System (ITIMS)
-- Phase 4: Software License Management & Seat Compliance
-- Engine: PostgreSQL 17 | Supabase Platform
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. SOFTWARE LICENSES TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.software_licenses (
    id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    software_asset_id  UUID           NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    license_name       TEXT           NOT NULL,
    license_key        TEXT,
    license_type       TEXT           NOT NULL CHECK (license_type IN ('per_seat', 'site_license', 'per_core', 'subscription', 'open_source', 'oem')),
    total_seats        INTEGER        NOT NULL DEFAULT 1 CHECK (total_seats >= 0),
    cost_per_seat      NUMERIC(12, 2) DEFAULT 0.00,
    purchase_date      DATE,
    expiration_date    DATE,
    vendor             TEXT,
    department_id      UUID           REFERENCES public.departments(id) ON DELETE SET NULL,
    created_by         UUID           REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.software_licenses IS 'Enterprise software licenses with seat pools, vendor contracts, and renewal dates';

CREATE INDEX IF NOT EXISTS idx_licenses_asset ON public.software_licenses (software_asset_id);
CREATE INDEX IF NOT EXISTS idx_licenses_type ON public.software_licenses (license_type);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON public.software_licenses (expiration_date);
CREATE INDEX IF NOT EXISTS idx_licenses_dept ON public.software_licenses (department_id);


-- -----------------------------------------------------------------------------
-- 2. LICENSE ALLOCATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.license_allocations (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id            UUID        NOT NULL REFERENCES public.software_licenses(id) ON DELETE CASCADE,
    allocated_to_asset_id UUID        REFERENCES public.assets(id) ON DELETE CASCADE,
    allocated_to_user_id  UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes                 TEXT,
    
    -- Ensure an allocation is assigned to at least one entity
    CONSTRAINT ck_allocation_target CHECK (allocated_to_asset_id IS NOT NULL OR allocated_to_user_id IS NOT NULL),
    
    -- Prevent duplicate seat allocation of the same license to the same hardware asset
    CONSTRAINT uq_license_asset_alloc UNIQUE (license_id, allocated_to_asset_id)
);

COMMENT ON TABLE public.license_allocations IS 'Individual seat allocations binding licenses to hardware devices or users';

CREATE INDEX IF NOT EXISTS idx_allocations_license ON public.license_allocations (license_id);
CREATE INDEX IF NOT EXISTS idx_allocations_asset ON public.license_allocations (allocated_to_asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON public.license_allocations (allocated_to_user_id);


-- -----------------------------------------------------------------------------
-- 3. STORED FUNCTION: GET LICENSE COMPLIANCE SUMMARY
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_license_compliance_summary()
RETURNS TABLE (
    license_id UUID,
    license_name TEXT,
    software_asset_id UUID,
    software_asset_name TEXT,
    license_type TEXT,
    total_seats INT,
    allocated_seats BIGINT,
    available_seats BIGINT,
    utilization_percent NUMERIC(5, 2),
    expiration_date DATE,
    days_until_expiration INT,
    compliance_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    l.id AS license_id,
    l.license_name,
    l.software_asset_id,
    a.name AS software_asset_name,
    l.license_type,
    l.total_seats,
    COALESCE(COUNT(la.id), 0) AS allocated_seats,
    (l.total_seats - COALESCE(COUNT(la.id), 0)) AS available_seats,
    CASE 
        WHEN l.total_seats = 0 THEN 100.00
        ELSE ROUND((COALESCE(COUNT(la.id), 0)::NUMERIC / l.total_seats::NUMERIC) * 100, 2)
    END AS utilization_percent,
    l.expiration_date,
    CASE 
        WHEN l.expiration_date IS NULL THEN NULL
        ELSE (l.expiration_date - CURRENT_DATE)
    END AS days_until_expiration,
    CASE 
        WHEN l.expiration_date IS NOT NULL AND l.expiration_date < CURRENT_DATE THEN 'EXPIRED'
        WHEN l.total_seats > 0 AND COALESCE(COUNT(la.id), 0) > l.total_seats THEN 'OVER_ALLOCATED'
        WHEN l.total_seats > 0 AND (COALESCE(COUNT(la.id), 0)::NUMERIC / l.total_seats::NUMERIC) >= 0.90 THEN 'WARNING_90_PERCENT'
        ELSE 'COMPLIANT'
    END AS compliance_status
FROM public.software_licenses l
JOIN public.assets a ON a.id = l.software_asset_id
LEFT JOIN public.license_allocations la ON la.license_id = l.id
GROUP BY l.id, l.license_name, l.software_asset_id, a.name, l.license_type, l.total_seats, l.expiration_date;
$$;

COMMENT ON FUNCTION public.get_license_compliance_summary() IS 'Aggregates seat utilization, renewal deadlines, and over-allocation risk status';


-- -----------------------------------------------------------------------------
-- 4. AUDIT TRIGGERS
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_software_licenses ON public.software_licenses;
CREATE TRIGGER trg_audit_software_licenses
    AFTER INSERT OR UPDATE OR DELETE ON public.software_licenses
    FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

DROP TRIGGER IF EXISTS trg_audit_license_allocations ON public.license_allocations;
CREATE TRIGGER trg_audit_license_allocations
    AFTER INSERT OR UPDATE OR DELETE ON public.license_allocations
    FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();


-- -----------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.software_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_allocations ENABLE ROW LEVEL SECURITY;

-- Software licenses policies
DROP POLICY IF EXISTS "View software licenses policy" ON public.software_licenses;
CREATE POLICY "View software licenses policy"
    ON public.software_licenses FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Create software licenses policy" ON public.software_licenses;
CREATE POLICY "Create software licenses policy"
    ON public.software_licenses FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_permission('assets:create')
        OR public.has_permission('assets:update')
    );

DROP POLICY IF EXISTS "Update software licenses policy" ON public.software_licenses;
CREATE POLICY "Update software licenses policy"
    ON public.software_licenses FOR UPDATE
    TO authenticated
    USING (
        public.has_permission('assets:update')
    )
    WITH CHECK (
        public.has_permission('assets:update')
    );

DROP POLICY IF EXISTS "Delete software licenses policy" ON public.software_licenses;
CREATE POLICY "Delete software licenses policy"
    ON public.software_licenses FOR DELETE
    TO authenticated
    USING (
        public.has_permission('assets:delete')
        OR public.has_permission('assets:update')
    );

-- License allocations policies
DROP POLICY IF EXISTS "View license allocations policy" ON public.license_allocations;
CREATE POLICY "View license allocations policy"
    ON public.license_allocations FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Manage license allocations policy" ON public.license_allocations;
CREATE POLICY "Manage license allocations policy"
    ON public.license_allocations FOR ALL
    TO authenticated
    USING (
        public.has_permission('assets:update')
        OR public.has_permission('assets:create')
    )
    WITH CHECK (
        public.has_permission('assets:update')
        OR public.has_permission('assets:create')
    );

COMMIT;
