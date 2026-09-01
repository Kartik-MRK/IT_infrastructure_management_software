-- =============================================================================
-- IT Infrastructure Management Software — Complete Database Schema (Phase 2)
-- =============================================================================
-- Project : Kartik-MRK's Project (odgxypyknkqlcasvomej) · ap-southeast-2
-- Engine  : PostgreSQL 17  |  Supabase Platform
-- Architecture: Enterprise RBAC, ABAC, Audit Logging (CDC), Soft-Deletes & RLS
-- =============================================================================

-- =============================================================================
-- SECTION 1 — TABLES & CATALOGS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1 departments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.departments (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT        NOT NULL UNIQUE,
    code        TEXT        NOT NULL UNIQUE,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.departments IS 'Enterprise organizational units for asset and user scoping';

-- -----------------------------------------------------------------------------
-- 1.2 permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
    id          TEXT        PRIMARY KEY,
    category    TEXT        NOT NULL,
    description TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.permissions IS 'Master catalog of granular application permissions';

-- -----------------------------------------------------------------------------
-- 1.3 roles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id             TEXT        PRIMARY KEY,
    name           TEXT        NOT NULL,
    description    TEXT,
    is_system_role BOOLEAN     NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS 'Enterprise persona definitions mapped to granular permissions';

-- -----------------------------------------------------------------------------
-- 1.4 role_permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id       TEXT        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id TEXT        NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Maps enterprise roles to granular permission keys';

-- -----------------------------------------------------------------------------
-- 1.5 profiles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id             UUID        NOT NULL,
    email          TEXT        NOT NULL,
    full_name      TEXT        NOT NULL,
    gender         TEXT,
    role           TEXT        DEFAULT 'viewer'::text,
    department_id  UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
    employee_id    TEXT        UNIQUE,
    phone_number   TEXT,
    avatar_url     TEXT,
    is_active      BOOLEAN     NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ DEFAULT now(),
    updated_at     TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT profiles_pkey            PRIMARY KEY (id),
    CONSTRAINT profiles_email_key       UNIQUE (email),
    CONSTRAINT profiles_id_fkey         FOREIGN KEY (id)
                                            REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT profiles_role_check      CHECK (role = ANY (ARRAY[
                                            'it_admin'::text,
                                            'security_auditor'::text,
                                            'infrastructure_engineer'::text,
                                            'helpdesk_operator'::text,
                                            'asset_custodian'::text,
                                            'financial_auditor'::text,
                                            'employee_requester'::text,
                                            'admin'::text,
                                            'operator'::text,
                                            'viewer'::text
                                        ])),
    CONSTRAINT profiles_gender_check    CHECK (gender = ANY (ARRAY[
                                            'male'::text,
                                            'female'::text,
                                            'other'::text,
                                            'prefer_not_to_say'::text
                                        ]))
);

COMMENT ON TABLE public.profiles IS 'Extended user profiles with enterprise RBAC and department scoping';

-- -----------------------------------------------------------------------------
-- 1.6 assets
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assets (
    id              UUID        NOT NULL DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    type            TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'active'::text,
    description     TEXT,
    serial_number   TEXT,
    location        TEXT,
    purchase_date   DATE,
    warranty_expiry DATE,
    cost            NUMERIC(12, 2),
    department_id   UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
    assigned_to     UUID,
    created_by      UUID        NOT NULL,
    deleted_at      TIMESTAMPTZ DEFAULT NULL,
    is_active       BOOLEAN     NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT assets_pkey              PRIMARY KEY (id),
    CONSTRAINT assets_assigned_to_fkey  FOREIGN KEY (assigned_to)
                                            REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT assets_created_by_fkey   FOREIGN KEY (created_by)
                                            REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT assets_type_check        CHECK (type = ANY (ARRAY[
                                            'hardware'::text,
                                            'software'::text,
                                            'network'::text,
                                            'infrastructure'::text,
                                            'peripherals'::text
                                        ])),
    CONSTRAINT assets_status_check      CHECK (status = ANY (ARRAY[
                                            'active'::text,
                                            'maintenance'::text,
                                            'retired'::text,
                                            'damaged'::text,
                                            'in_use'::text
                                        ]))
);

COMMENT ON TABLE public.assets IS 'IT assets with lifecycle status, soft-delete, and department scoping';

-- -----------------------------------------------------------------------------
-- 1.7 asset_metrics
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_metrics (
    id                   UUID          NOT NULL DEFAULT gen_random_uuid(),
    asset_id             UUID          NOT NULL,

    cpu_usage            NUMERIC(5, 2),
    memory_usage         NUMERIC(5, 2),
    disk_usage           NUMERIC(5, 2),
    temperature          NUMERIC(5, 2),
    is_operational       BOOLEAN       DEFAULT true,
    last_error           TEXT,
    uptime_hours         NUMERIC(10, 2),

    bandwidth_usage_mbps NUMERIC(10, 2),
    packet_loss_percent  NUMERIC(5, 2),
    latency_ms           NUMERIC(8, 2),
    active_connections   INTEGER,

    service_status       VARCHAR(20),
    response_time_ms     NUMERIC(8, 2),
    error_rate_percent   NUMERIC(5, 2),
    availability_percent NUMERIC(5, 2),

    print_status         VARCHAR(20),
    connection_status    VARCHAR(20),
    usage_hours          NUMERIC(10, 2),
    peripheral_error     TEXT,

    health_status        VARCHAR(20)   NOT NULL DEFAULT 'healthy'::character varying,

    last_updated         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT asset_metrics_pkey                       PRIMARY KEY (id),
    CONSTRAINT asset_metrics_asset_id_fkey              FOREIGN KEY (asset_id)
                                                            REFERENCES public.assets (id) ON DELETE CASCADE,
    CONSTRAINT asset_metrics_cpu_usage_check            CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
    CONSTRAINT asset_metrics_memory_usage_check         CHECK (memory_usage >= 0 AND memory_usage <= 100),
    CONSTRAINT asset_metrics_disk_usage_check           CHECK (disk_usage >= 0 AND disk_usage <= 100),
    CONSTRAINT asset_metrics_packet_loss_percent_check  CHECK (packet_loss_percent >= 0 AND packet_loss_percent <= 100)
);

-- -----------------------------------------------------------------------------
-- 1.8 incidents
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    id               UUID        NOT NULL DEFAULT gen_random_uuid(),
    title            TEXT        NOT NULL,
    description      TEXT        NOT NULL,
    severity         TEXT        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'open'::text,
    category         TEXT,
    asset_id         UUID,
    department_id    UUID        REFERENCES public.departments(id) ON DELETE SET NULL,
    reported_by      UUID        NOT NULL,
    assigned_to      UUID,
    resolved_by      UUID,
    priority         INTEGER     DEFAULT 5,
    resolution_notes TEXT,
    resolved_at      TIMESTAMPTZ,
    deleted_at       TIMESTAMPTZ DEFAULT NULL,
    is_active        BOOLEAN     NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT incidents_pkey              PRIMARY KEY (id),
    CONSTRAINT incidents_asset_id_fkey     FOREIGN KEY (asset_id)
                                               REFERENCES public.assets (id) ON DELETE SET NULL,
    CONSTRAINT incidents_reported_by_fkey  FOREIGN KEY (reported_by)
                                               REFERENCES public.profiles (id) ON DELETE CASCADE,
    CONSTRAINT incidents_assigned_to_fkey  FOREIGN KEY (assigned_to)
                                               REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT incidents_resolved_by_fkey  FOREIGN KEY (resolved_by)
                                               REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT incidents_severity_check    CHECK (severity = ANY (ARRAY[
                                               'low'::text,
                                               'medium'::text,
                                               'high'::text,
                                               'critical'::text
                                           ])),
    CONSTRAINT incidents_status_check      CHECK (status = ANY (ARRAY[
                                               'open'::text,
                                               'in_progress'::text,
                                               'resolved'::text,
                                               'closed'::text
                                           ]))
);

-- -----------------------------------------------------------------------------
-- 1.9 audit_logs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name   TEXT        NOT NULL,
    record_id    UUID        NOT NULL,
    action       TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE')),
    old_values   JSONB,
    new_values   JSONB,
    performed_by UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- SECTION 2 — FUNCTIONS & TRIGGERS
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 
        FROM public.profiles p
        JOIN public.role_permissions rp ON rp.role_id = p.role
        WHERE p.id = auth.uid() 
          AND rp.permission_id = required_permission
          AND p.is_active = true
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_permissions(user_uuid UUID)
RETURNS TABLE (permission_id TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT rp.permission_id
    FROM public.profiles p
    JOIN public.role_permissions rp ON rp.role_id = p.role
    WHERE p.id = user_uuid
      AND p.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.log_table_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec_id UUID;
    acting_user UUID;
BEGIN
    acting_user := auth.uid();
    
    IF (TG_OP = 'INSERT') THEN
        rec_id := NEW.id;
        INSERT INTO public.audit_logs (table_name, record_id, action, new_values, performed_by)
        VALUES (TG_TABLE_NAME, rec_id, 'INSERT', to_jsonb(NEW), acting_user);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        rec_id := NEW.id;
        IF (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) THEN
            INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, performed_by)
            VALUES (TG_TABLE_NAME, rec_id, 'SOFT_DELETE', to_jsonb(OLD), to_jsonb(NEW), acting_user);
        ELSE
            INSERT INTO public.audit_logs (table_name, record_id, action, old_values, new_values, performed_by)
            VALUES (TG_TABLE_NAME, rec_id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), acting_user);
        END IF;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        rec_id := OLD.id;
        INSERT INTO public.audit_logs (table_name, record_id, action, old_values, performed_by)
        VALUES (TG_TABLE_NAME, rec_id, 'DELETE', to_jsonb(OLD), acting_user);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- =============================================================================
-- SECTION 3 — ROW-LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_metrics    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Departments readable by authenticated users"
    ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permissions readable by authenticated users"
    ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Roles readable by authenticated users"
    ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Role permissions readable by authenticated users"
    ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Public profiles viewable by authenticated users"
    ON public.profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (public.has_permission('admin:manage_users'))
    WITH CHECK (public.has_permission('admin:manage_users'));

CREATE POLICY "Admins can delete profiles"
    ON public.profiles FOR DELETE TO authenticated
    USING (public.has_permission('admin:manage_users'));

CREATE POLICY "View assets policy"
    ON public.assets FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create assets policy"
    ON public.assets FOR INSERT TO authenticated
    WITH CHECK (public.has_permission('assets:create'));

CREATE POLICY "Update assets policy"
    ON public.assets FOR UPDATE TO authenticated
    USING (public.has_permission('assets:update') OR (created_by = auth.uid() AND public.has_permission('assets:create')))
    WITH CHECK (public.has_permission('assets:update') OR (created_by = auth.uid() AND public.has_permission('assets:create')));

CREATE POLICY "Delete assets policy"
    ON public.assets FOR DELETE TO authenticated
    USING (public.has_permission('assets:delete') OR (created_by = auth.uid() AND public.has_permission('assets:create')));

CREATE POLICY "View metrics policy"
    ON public.asset_metrics FOR SELECT TO authenticated USING (true);

CREATE POLICY "View incidents policy"
    ON public.incidents FOR SELECT TO authenticated USING (true);

CREATE POLICY "Create incidents policy"
    ON public.incidents FOR INSERT TO authenticated
    WITH CHECK (public.has_permission('incidents:create'));

CREATE POLICY "Update incidents policy"
    ON public.incidents FOR UPDATE TO authenticated
    USING (public.has_permission('incidents:update_status') OR reported_by = auth.uid() OR assigned_to = auth.uid())
    WITH CHECK (public.has_permission('incidents:update_status') OR reported_by = auth.uid() OR assigned_to = auth.uid());

CREATE POLICY "Delete incidents policy"
    ON public.incidents FOR DELETE TO authenticated
    USING (public.has_permission('incidents:delete'));

CREATE POLICY "Audit logs viewable by auditors and admins"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (public.has_permission('security:view_audit_logs'));

-- -----------------------------------------------------------------------------
-- 1.10 asset_relationships (CMDB Graph Dependency Mapping)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_relationships (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_asset_id   UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    child_asset_id    UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    relationship_type TEXT        NOT NULL CHECK (relationship_type IN ('hosts', 'connects_to', 'depends_on', 'backs_up')),
    description       TEXT,
    created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_asset_relationship UNIQUE (parent_asset_id, child_asset_id, relationship_type),
    CONSTRAINT ck_no_self_loop CHECK (parent_asset_id <> child_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_rel_parent ON public.asset_relationships (parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_child ON public.asset_relationships (child_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_type ON public.asset_relationships (relationship_type);
CREATE INDEX IF NOT EXISTS idx_asset_rel_composite ON public.asset_relationships (parent_asset_id, child_asset_id);

-- Recursive Blast Radius Function
CREATE OR REPLACE FUNCTION public.calculate_blast_radius(root_asset_id UUID, max_depth INT DEFAULT 5)
RETURNS TABLE (
    asset_id UUID,
    asset_name TEXT,
    asset_type TEXT,
    asset_status TEXT,
    depth INT,
    impact_level TEXT,
    relationship_type TEXT,
    path UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH RECURSIVE downstream_graph AS (
    SELECT 
        CASE 
            WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
            WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
            ELSE r.child_asset_id
        END AS target_asset_id,
        1 AS depth,
        r.relationship_type,
        ARRAY[root_asset_id, 
            CASE 
                WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
                WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
                ELSE r.child_asset_id
            END
        ] AS path
    FROM public.asset_relationships r
    WHERE (
        (r.relationship_type IN ('hosts', 'connects_to') AND r.parent_asset_id = root_asset_id)
        OR (r.relationship_type = 'depends_on' AND r.child_asset_id = root_asset_id)
    )
    UNION ALL
    SELECT 
        CASE 
            WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
            WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
            ELSE r.child_asset_id
        END AS target_asset_id,
        dg.depth + 1,
        r.relationship_type,
        dg.path || CASE 
            WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
            WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
            ELSE r.child_asset_id
        END
    FROM public.asset_relationships r
    JOIN downstream_graph dg ON (
        (r.relationship_type IN ('hosts', 'connects_to') AND r.parent_asset_id = dg.target_asset_id)
        OR (r.relationship_type = 'depends_on' AND r.child_asset_id = dg.target_asset_id)
    )
    WHERE dg.depth < max_depth
      AND NOT (
          CASE 
              WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
              WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
              ELSE r.child_asset_id
          END = ANY(dg.path)
      )
)
SELECT DISTINCT ON (a.id)
    a.id AS asset_id,
    a.name AS asset_name,
    a.type AS asset_type,
    a.status AS asset_status,
    dg.depth,
    CASE 
        WHEN dg.depth = 1 THEN 'DIRECT_IMPACT'
        WHEN dg.depth = 2 THEN 'SECONDARY_IMPACT'
        ELSE 'TERTIARY_IMPACT'
    END AS impact_level,
    dg.relationship_type,
    dg.path
FROM downstream_graph dg
JOIN public.assets a ON a.id = dg.target_asset_id
ORDER BY a.id, dg.depth ASC;
$$;

ALTER TABLE public.asset_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "View asset relationships policy" ON public.asset_relationships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create asset relationships policy" ON public.asset_relationships FOR INSERT TO authenticated WITH CHECK (public.has_permission('assets:update') OR public.has_permission('assets:create'));
CREATE POLICY "Delete asset relationships policy" ON public.asset_relationships FOR DELETE TO authenticated USING (public.has_permission('assets:delete') OR public.has_permission('assets:update'));

-- -----------------------------------------------------------------------------
-- 1.11 software_licenses
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

CREATE INDEX IF NOT EXISTS idx_licenses_asset ON public.software_licenses (software_asset_id);
CREATE INDEX IF NOT EXISTS idx_licenses_type ON public.software_licenses (license_type);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry ON public.software_licenses (expiration_date);
CREATE INDEX IF NOT EXISTS idx_licenses_dept ON public.software_licenses (department_id);

-- -----------------------------------------------------------------------------
-- 1.12 license_allocations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.license_allocations (
    id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id            UUID        NOT NULL REFERENCES public.software_licenses(id) ON DELETE CASCADE,
    allocated_to_asset_id UUID        REFERENCES public.assets(id) ON DELETE CASCADE,
    allocated_to_user_id  UUID        REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes                 TEXT,
    CONSTRAINT ck_allocation_target CHECK (allocated_to_asset_id IS NOT NULL OR allocated_to_user_id IS NOT NULL),
    CONSTRAINT uq_license_asset_alloc UNIQUE (license_id, allocated_to_asset_id)
);

CREATE INDEX IF NOT EXISTS idx_allocations_license ON public.license_allocations (license_id);
CREATE INDEX IF NOT EXISTS idx_allocations_asset ON public.license_allocations (allocated_to_asset_id);
CREATE INDEX IF NOT EXISTS idx_allocations_user ON public.license_allocations (allocated_to_user_id);

-- Stored Function: Get License Compliance Summary
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

ALTER TABLE public.software_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View software licenses policy" ON public.software_licenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create software licenses policy" ON public.software_licenses FOR INSERT TO authenticated WITH CHECK (public.has_permission('assets:create') OR public.has_permission('assets:update'));
CREATE POLICY "Update software licenses policy" ON public.software_licenses FOR UPDATE TO authenticated USING (public.has_permission('assets:update')) WITH CHECK (public.has_permission('assets:update'));
CREATE POLICY "Delete software licenses policy" ON public.software_licenses FOR DELETE TO authenticated USING (public.has_permission('assets:delete') OR public.has_permission('assets:update'));

CREATE POLICY "View license allocations policy" ON public.license_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage license allocations policy" ON public.license_allocations FOR ALL TO authenticated USING (public.has_permission('assets:update') OR public.has_permission('assets:create')) WITH CHECK (public.has_permission('assets:update') OR public.has_permission('assets:create'));

-- -----------------------------------------------------------------------------
-- 1.13 Financial Lifecycle, Depreciation & TCO Functions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_asset_financials(target_asset_id UUID)
RETURNS TABLE (
    asset_id UUID,
    asset_name TEXT,
    asset_type TEXT,
    purchase_cost NUMERIC(12, 2),
    salvage_value NUMERIC(12, 2),
    useful_life_years INT,
    depreciation_method TEXT,
    purchase_date DATE,
    age_months NUMERIC(6, 1),
    age_years NUMERIC(5, 2),
    current_book_value NUMERIC(12, 2),
    accumulated_depreciation NUMERIC(12, 2),
    annual_depreciation NUMERIC(12, 2),
    maintenance_cost_total NUMERIC(12, 2),
    license_cost_total NUMERIC(12, 2),
    total_cost_of_ownership NUMERIC(12, 2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    ast RECORD;
    v_age_days NUMERIC;
    v_age_years NUMERIC;
    v_age_months NUMERIC;
    v_cost NUMERIC(12, 2);
    v_salvage NUMERIC(12, 2);
    v_life INT;
    v_method TEXT;
    v_book_val NUMERIC(12, 2);
    v_accum_dep NUMERIC(12, 2);
    v_annual_dep NUMERIC(12, 2);
    v_maint_cost NUMERIC(12, 2);
    v_lic_cost NUMERIC(12, 2);
    v_tco NUMERIC(12, 2);
    v_rate NUMERIC;
BEGIN
    SELECT * INTO ast FROM public.assets WHERE public.assets.id = target_asset_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_cost := COALESCE(ast.cost, 0.00);
    v_salvage := COALESCE(ast.salvage_value, 0.00);
    v_life := COALESCE(ast.useful_life_years, 5);
    v_method := COALESCE(ast.depreciation_method, 'straight_line');

    IF ast.purchase_date IS NOT NULL THEN
        v_age_days := GREATEST(0, (CURRENT_DATE - ast.purchase_date));
        v_age_years := ROUND(v_age_days / 365.25, 2);
        v_age_months := ROUND((v_age_days / 30.4375), 1);
    ELSE
        v_age_days := 0;
        v_age_years := 0.00;
        v_age_months := 0.0;
    END IF;

    IF v_method = 'straight_line' AND v_cost > v_salvage AND v_life > 0 THEN
        v_annual_dep := ROUND((v_cost - v_salvage) / v_life, 2);
        v_accum_dep := LEAST(v_cost - v_salvage, ROUND(v_annual_dep * v_age_years, 2));
        v_book_val := GREATEST(v_salvage, v_cost - v_accum_dep);
    ELSIF v_method = 'double_declining' AND v_cost > v_salvage AND v_life > 0 THEN
        v_rate := 2.0 / v_life;
        v_book_val := GREATEST(v_salvage, ROUND(v_cost * POWER((1.0 - v_rate), v_age_years), 2));
        v_accum_dep := v_cost - v_book_val;
        v_annual_dep := ROUND(v_cost * v_rate, 2);
    ELSE
        v_book_val := v_cost;
        v_accum_dep := 0.00;
        v_annual_dep := 0.00;
    END IF;

    SELECT COALESCE(SUM(inc.maintenance_cost), 0.00) INTO v_maint_cost
    FROM public.incidents inc
    WHERE inc.asset_id = target_asset_id;

    SELECT COALESCE(SUM(lic.cost_per_seat * lic.total_seats), 0.00) INTO v_lic_cost
    FROM public.software_licenses lic
    WHERE lic.software_asset_id = target_asset_id;

    v_tco := v_cost + v_maint_cost + v_lic_cost;

    RETURN QUERY SELECT
        ast.id AS asset_id,
        ast.name AS asset_name,
        ast.type AS asset_type,
        v_cost AS purchase_cost,
        v_salvage AS salvage_value,
        v_life AS useful_life_years,
        v_method AS depreciation_method,
        ast.purchase_date,
        v_age_months AS age_months,
        v_age_years AS age_years,
        v_book_val AS current_book_value,
        v_accum_dep AS accumulated_depreciation,
        v_annual_dep AS annual_depreciation,
        v_maint_cost AS maintenance_cost_total,
        v_lic_cost AS license_cost_total,
        v_tco AS total_cost_of_ownership;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_executive_financial_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_total_capex NUMERIC(14, 2) := 0.00;
    v_total_book_value NUMERIC(14, 2) := 0.00;
    v_total_accum_dep NUMERIC(14, 2) := 0.00;
    v_total_maint_opex NUMERIC(14, 2) := 0.00;
    v_total_lic_spend NUMERIC(14, 2) := 0.00;
    v_total_tco NUMERIC(14, 2) := 0.00;
    v_asset_count INT := 0;
    v_rec RECORD;
    f RECORD;
    v_by_type JSONB := '{}'::jsonb;
BEGIN
    FOR v_rec IN (
        SELECT ast.id
        FROM public.assets ast
        WHERE ast.is_active = true AND (ast.deleted_at IS NULL)
    ) LOOP
        v_asset_count := v_asset_count + 1;
        FOR f IN (SELECT * FROM public.calculate_asset_financials(v_rec.id)) LOOP
            v_total_capex := v_total_capex + f.purchase_cost;
            v_total_book_value := v_total_book_value + f.current_book_value;
            v_total_accum_dep := v_total_accum_dep + f.accumulated_depreciation;
            v_total_maint_opex := v_total_maint_opex + f.maintenance_cost_total;
            v_total_lic_spend := v_total_lic_spend + f.license_cost_total;
            v_total_tco := v_total_tco + f.total_cost_of_ownership;
        END LOOP;
    END LOOP;

    SELECT jsonb_object_agg(
        sub.type,
        jsonb_build_object(
            'asset_count', sub.cnt,
            'total_cost', sub.total_cost,
            'total_maintenance', sub.total_maint
        )
    ) INTO v_by_type
    FROM (
        SELECT 
            ast.type,
            COUNT(ast.id) AS cnt,
            COALESCE(SUM(ast.cost), 0.00) AS total_cost,
            COALESCE(SUM(inc.maintenance_cost), 0.00) AS total_maint
        FROM public.assets ast
        LEFT JOIN public.incidents inc ON inc.asset_id = ast.id
        WHERE ast.is_active = true AND ast.deleted_at IS NULL
        GROUP BY ast.type
    ) sub;

    RETURN jsonb_build_object(
        'overview', jsonb_build_object(
            'total_assets_tracked', v_asset_count,
            'total_capitalized_investment', v_total_capex,
            'total_current_book_value', v_total_book_value,
            'total_accumulated_depreciation', v_total_accum_dep,
            'total_maintenance_expenditure', v_total_maint_opex,
            'total_software_licensing_spend', v_total_lic_spend,
            'total_infrastructure_tco', v_total_tco,
            'overall_depreciation_percent', CASE WHEN v_total_capex > 0 THEN ROUND((v_total_accum_dep / v_total_capex) * 100, 2) ELSE 0.00 END
        ),
        'by_type', COALESCE(v_by_type, '{}'::jsonb)
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- 1.14 Barcode, QR Code & Physical Asset Auditing
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

    IF p_physical_condition = 'missing' THEN
        v_new_audit_status := 'missing';
    ELSIF p_physical_condition = 'damaged' OR NOT p_location_verified OR NOT p_status_verified THEN
        v_new_audit_status := 'flagged';
    ELSE
        v_new_audit_status := 'verified';
    END IF;

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

-- =============================================================================
-- 1.15 SERVICE LEVEL AGREEMENT (SLA) ENGINE & BREACH TIMERS
-- =============================================================================

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

ALTER TABLE public.incidents
    ADD COLUMN IF NOT EXISTS response_deadline        TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resolution_deadline      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS first_responded_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sla_status               TEXT NOT NULL DEFAULT 'within_sla' CHECK (sla_status IN ('within_sla', 'approaching_breach', 'breached')),
    ADD COLUMN IF NOT EXISTS sla_response_breached    BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS sla_resolution_breached  BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.calculate_incident_sla_deadlines()
RETURNS TRIGGER AS $$
DECLARE
    v_policy RECORD;
    v_base_time TIMESTAMPTZ;
BEGIN
    v_base_time := COALESCE(NEW.reported_at, NEW.created_at, now());

    SELECT * INTO v_policy 
    FROM public.sla_policies 
    WHERE severity = NEW.severity AND is_active = true 
    LIMIT 1;

    IF FOUND THEN
        IF NEW.response_deadline IS NULL OR (TG_OP = 'UPDATE' AND OLD.severity IS DISTINCT FROM NEW.severity) THEN
            NEW.response_deadline := v_base_time + (v_policy.max_response_time_minutes || ' minutes')::INTERVAL;
        END IF;

        IF NEW.resolution_deadline IS NULL OR (TG_OP = 'UPDATE' AND OLD.severity IS DISTINCT FROM NEW.severity) THEN
            NEW.resolution_deadline := v_base_time + (v_policy.max_resolution_time_minutes || ' minutes')::INTERVAL;
        END IF;
    END IF;

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
            AVG(GREATEST(EXTRACT(EPOCH FROM (COALESCE(inc.first_responded_at, inc.resolved_at, now()) - COALESCE(inc.reported_at, inc.created_at))) / 60.0, 0.0)) AS avg_mttd,
            AVG(GREATEST(EXTRACT(EPOCH FROM (inc.resolved_at - COALESCE(inc.reported_at, inc.created_at))) / 60.0, 0.0)) FILTER (WHERE inc.status IN ('resolved', 'closed')) AS avg_mttr
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

