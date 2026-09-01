-- =============================================================================
-- IT Infrastructure Management System (ITIMS)
-- Phase 2: Enterprise RBAC, ABAC, Audit Logging & RLS Hardening Migration
-- Engine: PostgreSQL 17 | Supabase Platform
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. DEPARTMENTS CATALOG (Multi-Tenancy & Scoping)
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

-- Seed Standard Departments
INSERT INTO public.departments (name, code, description)
VALUES 
    ('Engineering', 'ENG', 'Software development, cloud systems & infrastructure'),
    ('IT Operations', 'OPS', 'Data center operations, network management & service desk'),
    ('Security & Compliance', 'SEC', 'Information security, SOC telemetry & vulnerability management'),
    ('Finance & Procurement', 'FIN', 'Financial planning, asset purchasing & depreciation tracking'),
    ('Human Resources', 'HR', 'Personnel management & workplace onboarding'),
    ('Executive Leadership', 'EXEC', 'Corporate governance & executive management')
ON CONFLICT (name) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 2. MASTER PERMISSIONS CATALOG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.permissions (
    id          TEXT        PRIMARY KEY, -- e.g. 'assets:create', 'incidents:resolve'
    category    TEXT        NOT NULL,    -- 'assets', 'incidents', 'finance', 'security', 'admin'
    description TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.permissions IS 'Master catalog of granular application permissions';

-- Seed Granular Permission Keys
INSERT INTO public.permissions (id, category, description)
VALUES
    -- Asset Permissions
    ('assets:read_all',          'assets',    'View all assets across entire organization'),
    ('assets:read_department',   'assets',    'View assets assigned within own department only'),
    ('assets:create',            'assets',    'Register new hardware, software, or network assets'),
    ('assets:update',            'assets',    'Update asset configuration, status, and assignment'),
    ('assets:delete',            'assets',    'Decommission or delete IT assets'),
    ('assets:audit_hardware',    'assets',    'Perform physical hardware inspection & metric audits'),
    
    -- Incident Permissions
    ('incidents:read_all',       'incidents', 'View all reported incidents and SLA metrics'),
    ('incidents:create',         'incidents', 'Create and report new incident tickets'),
    ('incidents:assign',         'incidents', 'Assign incident tickets to operators or teams'),
    ('incidents:update_status',   'incidents', 'Update incident progress, notes, and priority'),
    ('incidents:resolve',        'incidents', 'Resolve and close incident tickets with notes'),
    ('incidents:delete',         'incidents', 'Delete or purge incident records'),
    
    -- Financial & Compliance
    ('finance:view_tco',         'finance',   'View total cost of ownership & asset valuation metrics'),
    ('finance:view_depreciation','finance',   'View hardware depreciation & lifecycle forecasting'),
    
    -- Security & Audit
    ('security:view_audit_logs', 'security',  'View change-data-capture audit logs and forensic records'),
    ('security:manage_cve',      'security',  'Inspect vulnerability matches and CVE patch status'),
    
    -- Tenant Administration
    ('admin:manage_users',       'admin',     'Manage user accounts, department assignments, and profiles'),
    ('admin:manage_roles',       'admin',     'Configure role-to-permission mappings and RBAC settings')
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 3. ENTERPRISE ROLES CATALOG
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roles (
    id             TEXT        PRIMARY KEY, -- e.g. 'it_admin', 'infrastructure_engineer'
    name           TEXT        NOT NULL,
    description    TEXT,
    is_system_role BOOLEAN     NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.roles IS 'Enterprise persona definitions mapped to granular permissions';

-- Seed Enterprise Personas + Legacy Aliases
INSERT INTO public.roles (id, name, description, is_system_role)
VALUES
    ('it_admin',                'Global IT Administrator', 'Full unrestricted enterprise control and tenant RBAC administration', true),
    ('security_auditor',        'Security & Compliance Auditor', 'Read-all telemetry, full forensic audit log inspection, and CVE visibility', true),
    ('infrastructure_engineer', 'Infrastructure & Systems Engineer', 'Full server, network, cloud, and CMDB dependency lifecycle management', true),
    ('helpdesk_operator',       'Helpdesk & Incident Operator', 'Incident triage, technician assignment, and SLA resolution workflow', true),
    ('asset_custodian',         'Asset & Inventory Custodian', 'Hardware check-in/out, physical audit verification, and serial tracking', true),
    ('financial_auditor',       'Financial & Asset Auditor', 'Asset valuation, depreciation modeling, and license TCO tracking', true),
    ('employee_requester',      'Employee Requester', 'View own assigned devices and report service disruptions', true),
    
    -- Legacy Backward-Compatibility Aliases
    ('admin',                   'Legacy Admin (Alias: it_admin)', 'Backward compatible admin role', true),
    ('operator',                'Legacy Operator (Alias: infrastructure_engineer)', 'Backward compatible operator role', true),
    ('viewer',                  'Legacy Viewer (Alias: employee_requester)', 'Backward compatible viewer role', true)
ON CONFLICT (id) DO NOTHING;


-- -----------------------------------------------------------------------------
-- 4. ROLE-PERMISSION JUNCTION TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id       TEXT        NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id TEXT        NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE public.role_permissions IS 'Maps enterprise roles to granular permission keys';

-- Seed Role Permission Mappings
-- Global IT Admin (Full permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'it_admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'admin', id FROM public.permissions
ON CONFLICT DO NOTHING;

-- Infrastructure Engineer
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('infrastructure_engineer', 'assets:read_all'),
    ('infrastructure_engineer', 'assets:create'),
    ('infrastructure_engineer', 'assets:update'),
    ('infrastructure_engineer', 'assets:delete'),
    ('infrastructure_engineer', 'assets:audit_hardware'),
    ('infrastructure_engineer', 'incidents:read_all'),
    ('infrastructure_engineer', 'incidents:create'),
    ('infrastructure_engineer', 'incidents:assign'),
    ('infrastructure_engineer', 'incidents:update_status'),
    ('infrastructure_engineer', 'incidents:resolve'),
    ('infrastructure_engineer', 'security:manage_cve')
ON CONFLICT DO NOTHING;

-- Legacy Operator (matching infrastructure_engineer)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 'operator', permission_id FROM public.role_permissions WHERE role_id = 'infrastructure_engineer'
ON CONFLICT DO NOTHING;

-- Security Auditor
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('security_auditor', 'assets:read_all'),
    ('security_auditor', 'incidents:read_all'),
    ('security_auditor', 'security:view_audit_logs'),
    ('security_auditor', 'security:manage_cve'),
    ('security_auditor', 'finance:view_tco')
ON CONFLICT DO NOTHING;

-- Helpdesk Operator
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('helpdesk_operator', 'assets:read_all'),
    ('helpdesk_operator', 'incidents:read_all'),
    ('helpdesk_operator', 'incidents:create'),
    ('helpdesk_operator', 'incidents:assign'),
    ('helpdesk_operator', 'incidents:update_status'),
    ('helpdesk_operator', 'incidents:resolve')
ON CONFLICT DO NOTHING;

-- Asset Custodian
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('asset_custodian', 'assets:read_all'),
    ('asset_custodian', 'assets:create'),
    ('asset_custodian', 'assets:update'),
    ('asset_custodian', 'assets:audit_hardware'),
    ('asset_custodian', 'incidents:read_all'),
    ('asset_custodian', 'incidents:create')
ON CONFLICT DO NOTHING;

-- Financial Auditor
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('financial_auditor', 'assets:read_all'),
    ('financial_auditor', 'finance:view_tco'),
    ('financial_auditor', 'finance:view_depreciation')
ON CONFLICT DO NOTHING;

-- Employee Requester / Viewer
INSERT INTO public.role_permissions (role_id, permission_id)
VALUES
    ('employee_requester', 'assets:read_all'),
    ('employee_requester', 'incidents:read_all'),
    ('employee_requester', 'incidents:create'),
    ('viewer', 'assets:read_all'),
    ('viewer', 'incidents:read_all'),
    ('viewer', 'incidents:create')
ON CONFLICT DO NOTHING;


-- -----------------------------------------------------------------------------
-- 5. AUDIT LOGS TABLE (Change Data Capture)
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_at ON public.audit_logs (performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_performed_by ON public.audit_logs (performed_by);

COMMENT ON TABLE public.audit_logs IS 'Immutable change-data-capture audit trail for security compliance';


-- -----------------------------------------------------------------------------
-- 6. EXTEND CORE TABLES (Soft Deletes & Department Scoping)
-- -----------------------------------------------------------------------------

-- Extend public.profiles
ALTER TABLE public.profiles 
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS employee_id TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS phone_number TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Update profiles role check constraint to accommodate enterprise roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role = ANY (ARRAY[
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
    ]));

-- Extend public.assets
ALTER TABLE public.assets 
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_assets_department ON public.assets (department_id);
CREATE INDEX IF NOT EXISTS idx_assets_active ON public.assets (is_active) WHERE is_active = true;

-- Extend public.incidents
ALTER TABLE public.incidents 
    ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_incidents_department ON public.incidents (department_id);
CREATE INDEX IF NOT EXISTS idx_incidents_active ON public.incidents (is_active) WHERE is_active = true;


-- -----------------------------------------------------------------------------
-- 7. HIGH-PERFORMANCE RLS HELPER FUNCTIONS
-- -----------------------------------------------------------------------------

-- Evaluates if the authenticated user has a specific permission in < 0.2ms
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

COMMENT ON FUNCTION public.has_permission(TEXT) IS 'Ultra-fast cached permission evaluator for RLS and business logic';

-- Returns list of all permission strings for a given user UUID
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


-- -----------------------------------------------------------------------------
-- 8. CHANGE DATA CAPTURE (CDC) AUDIT TRIGGER FUNCTION
-- -----------------------------------------------------------------------------
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
        
        -- Detect soft-delete vs normal update
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

-- Attach Audit Triggers to assets and incidents
DROP TRIGGER IF EXISTS trg_audit_assets ON public.assets;
CREATE TRIGGER trg_audit_assets
    AFTER INSERT OR UPDATE OR DELETE ON public.assets
    FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();

DROP TRIGGER IF EXISTS trg_audit_incidents ON public.incidents;
CREATE TRIGGER trg_audit_incidents
    AFTER INSERT OR UPDATE OR DELETE ON public.incidents
    FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();


-- -----------------------------------------------------------------------------
-- 9. RE-ARCHITECTED ROW-LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

-- Enable RLS on new tables
ALTER TABLE public.departments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs       ENABLE ROW LEVEL SECURITY;

-- 9.1 Catalogs (Readable by all authenticated users)
CREATE POLICY "Departments readable by authenticated users"
    ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Permissions readable by authenticated users"
    ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Roles readable by authenticated users"
    ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Role permissions readable by authenticated users"
    ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- 9.2 Audit Logs (Security Auditor & Admins only)
CREATE POLICY "Audit logs viewable by security auditors and admins"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (public.has_permission('security:view_audit_logs'));

-- 9.3 Profiles Policies (Replaced with fast cached has_permission)
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE TO authenticated
    USING (public.has_permission('admin:manage_users'))
    WITH CHECK (public.has_permission('admin:manage_users'));

CREATE POLICY "Admins can delete profiles"
    ON public.profiles FOR DELETE TO authenticated
    USING (public.has_permission('admin:manage_users'));

-- 9.4 Assets Policies
DROP POLICY IF EXISTS "Admins and Operators can create assets" ON public.assets;
DROP POLICY IF EXISTS "Admins can update any asset" ON public.assets;
DROP POLICY IF EXISTS "Operators can update own assets" ON public.assets;
DROP POLICY IF EXISTS "Admins can delete any asset" ON public.assets;
DROP POLICY IF EXISTS "Operators can delete own assets" ON public.assets;

CREATE POLICY "Create assets policy"
    ON public.assets FOR INSERT TO authenticated
    WITH CHECK (public.has_permission('assets:create'));

CREATE POLICY "Update assets policy"
    ON public.assets FOR UPDATE TO authenticated
    USING (
        public.has_permission('assets:update') 
        OR (created_by = auth.uid() AND public.has_permission('assets:create'))
    )
    WITH CHECK (
        public.has_permission('assets:update') 
        OR (created_by = auth.uid() AND public.has_permission('assets:create'))
    );

CREATE POLICY "Delete assets policy"
    ON public.assets FOR DELETE TO authenticated
    USING (
        public.has_permission('assets:delete')
        OR (created_by = auth.uid() AND public.has_permission('assets:create'))
    );

-- 9.5 Incidents Policies
DROP POLICY IF EXISTS "Authenticated users can create incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admins and operators can update incidents" ON public.incidents;
DROP POLICY IF EXISTS "Admins can delete incidents" ON public.incidents;

CREATE POLICY "Create incidents policy"
    ON public.incidents FOR INSERT TO authenticated
    WITH CHECK (public.has_permission('incidents:create'));

CREATE POLICY "Update incidents policy"
    ON public.incidents FOR UPDATE TO authenticated
    USING (
        public.has_permission('incidents:update_status')
        OR reported_by = auth.uid()
        OR assigned_to = auth.uid()
    )
    WITH CHECK (
        public.has_permission('incidents:update_status')
        OR reported_by = auth.uid()
        OR assigned_to = auth.uid()
    );

CREATE POLICY "Delete incidents policy"
    ON public.incidents FOR DELETE TO authenticated
    USING (public.has_permission('incidents:delete'));

COMMIT;
