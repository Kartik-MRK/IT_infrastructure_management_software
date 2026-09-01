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
