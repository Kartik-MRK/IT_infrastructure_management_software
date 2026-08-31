-- =============================================================================
-- IT Infrastructure Management Software — Complete Database Schema
-- =============================================================================
-- Project : Kartik-MRK's Project (odgxypyknkqlcasvomej) · ap-southeast-2
-- Engine  : PostgreSQL 17  |  Supabase Platform
-- Generated: 2026-08-30 (audited directly from the live instance)
--
-- Running this script on a blank Supabase project will fully reproduce:
--   • Tables, columns, defaults, NOT NULL constraints
--   • Primary keys, unique constraints, check constraints, foreign keys
--   • Indexes (non-PK)
--   • Functions & triggers (including the auth.users signup trigger)
--   • Row-Level Security (RLS) enable + all policies
--   • The asset_latest_metrics view
-- =============================================================================


-- =============================================================================
-- SECTION 1 — TABLES
-- Order: profiles → assets → asset_metrics → incidents
-- (profiles must exist before assets; assets before asset_metrics / incidents)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1.1  profiles
--      Extended user profiles linked to auth.users, with RBAC roles.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID        NOT NULL,
    email       TEXT        NOT NULL,
    full_name   TEXT        NOT NULL,
    gender      TEXT,
    role        TEXT        DEFAULT 'viewer'::text,
    avatar_url  TEXT,
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT profiles_pkey            PRIMARY KEY (id),
    CONSTRAINT profiles_email_key       UNIQUE (email),
    CONSTRAINT profiles_id_fkey         FOREIGN KEY (id)
                                            REFERENCES auth.users (id) ON DELETE CASCADE,
    CONSTRAINT profiles_role_check      CHECK (role = ANY (ARRAY[
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

COMMENT ON TABLE public.profiles IS 'Extended user profiles with RBAC (admin/operator/viewer)';

-- ---------------------------------------------------------------------------
-- 1.2  assets
--      All IT assets managed in the system.
-- ---------------------------------------------------------------------------
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
    assigned_to     UUID,
    created_by      UUID        NOT NULL,
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

COMMENT ON TABLE public.assets IS 'IT assets managed in the system';

-- ---------------------------------------------------------------------------
-- 1.3  asset_metrics
--      Time-series operational metrics for each asset.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_metrics (
    id                   UUID          NOT NULL DEFAULT gen_random_uuid(),
    asset_id             UUID          NOT NULL,

    -- Core health / compute metrics
    cpu_usage            NUMERIC(5, 2),
    memory_usage         NUMERIC(5, 2),
    disk_usage           NUMERIC(5, 2),
    temperature          NUMERIC(5, 2),
    is_operational       BOOLEAN       DEFAULT true,
    last_error           TEXT,
    uptime_hours         NUMERIC(10, 2),

    -- Network metrics
    bandwidth_usage_mbps NUMERIC(10, 2),
    packet_loss_percent  NUMERIC(5, 2),
    latency_ms           NUMERIC(8, 2),
    active_connections   INTEGER,

    -- Service / infrastructure metrics
    service_status       VARCHAR(20),
    response_time_ms     NUMERIC(8, 2),
    error_rate_percent   NUMERIC(5, 2),
    availability_percent NUMERIC(5, 2),

    -- Peripheral-specific metrics
    print_status         VARCHAR(20),
    connection_status    VARCHAR(20),
    usage_hours          NUMERIC(10, 2),
    peripheral_error     TEXT,

    -- Computed health indicator (set by trigger)
    health_status        VARCHAR(20)   NOT NULL DEFAULT 'healthy'::character varying,

    -- Timestamps
    last_updated         TIMESTAMPTZ   NOT NULL DEFAULT now(),
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT now(),

    CONSTRAINT asset_metrics_pkey                       PRIMARY KEY (id),
    CONSTRAINT asset_metrics_asset_id_fkey              FOREIGN KEY (asset_id)
                                                            REFERENCES public.assets (id) ON DELETE CASCADE,

    -- Range checks
    CONSTRAINT asset_metrics_cpu_usage_check            CHECK (cpu_usage >= 0 AND cpu_usage <= 100),
    CONSTRAINT asset_metrics_memory_usage_check         CHECK (memory_usage >= 0 AND memory_usage <= 100),
    CONSTRAINT asset_metrics_disk_usage_check           CHECK (disk_usage >= 0 AND disk_usage <= 100),
    CONSTRAINT asset_metrics_packet_loss_percent_check  CHECK (packet_loss_percent >= 0 AND packet_loss_percent <= 100),
    CONSTRAINT asset_metrics_error_rate_percent_check   CHECK (error_rate_percent >= 0 AND error_rate_percent <= 100),
    CONSTRAINT asset_metrics_availability_percent_check CHECK (availability_percent >= 0 AND availability_percent <= 100),

    -- Enum-style checks
    CONSTRAINT asset_metrics_service_status_check       CHECK (service_status::text = ANY (ARRAY[
                                                            'healthy', 'degraded', 'down'
                                                        ])),
    CONSTRAINT asset_metrics_health_status_check        CHECK (health_status::text = ANY (ARRAY[
                                                            'healthy', 'warning', 'critical'
                                                        ])),
    CONSTRAINT asset_metrics_print_status_check         CHECK (print_status::text = ANY (ARRAY[
                                                            'online', 'offline', 'paper_jam', 'low_toner', 'error'
                                                        ])),
    CONSTRAINT asset_metrics_connection_status_check    CHECK (connection_status::text = ANY (ARRAY[
                                                            'connected', 'disconnected', 'intermittent'
                                                        ]))
);

-- ---------------------------------------------------------------------------
-- 1.4  incidents
--      IT incident tracking and management.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.incidents (
    id               UUID        NOT NULL DEFAULT gen_random_uuid(),
    title            TEXT        NOT NULL,
    description      TEXT        NOT NULL,
    severity         TEXT        NOT NULL,
    status           TEXT        NOT NULL DEFAULT 'open'::text,
    category         TEXT,
    asset_id         UUID,
    reported_by      UUID        NOT NULL,
    assigned_to      UUID,
    resolved_by      UUID,
    reported_at      TIMESTAMPTZ DEFAULT now(),
    resolved_at      TIMESTAMPTZ,
    resolution_notes TEXT,
    priority         INTEGER     DEFAULT 0,
    created_at       TIMESTAMPTZ DEFAULT now(),
    updated_at       TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT incidents_pkey               PRIMARY KEY (id),
    CONSTRAINT incidents_asset_id_fkey      FOREIGN KEY (asset_id)
                                                REFERENCES public.assets (id) ON DELETE SET NULL,
    CONSTRAINT incidents_reported_by_fkey   FOREIGN KEY (reported_by)
                                                REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT incidents_assigned_to_fkey   FOREIGN KEY (assigned_to)
                                                REFERENCES public.profiles (id) ON DELETE SET NULL,
    CONSTRAINT incidents_resolved_by_fkey   FOREIGN KEY (resolved_by)
                                                REFERENCES public.profiles (id) ON DELETE SET NULL,

    CONSTRAINT incidents_severity_check     CHECK (severity = ANY (ARRAY[
                                                'critical'::text, 'high'::text, 'medium'::text, 'low'::text
                                            ])),
    CONSTRAINT incidents_status_check       CHECK (status = ANY (ARRAY[
                                                'open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text
                                            ])),
    CONSTRAINT incidents_category_check     CHECK (category = ANY (ARRAY[
                                                'hardware'::text, 'software'::text, 'network'::text,
                                                'infrastructure'::text, 'peripherals'::text,
                                                'security'::text, 'other'::text
                                            ])),
    CONSTRAINT incidents_priority_check     CHECK (priority >= 0 AND priority <= 10)
);

COMMENT ON TABLE public.incidents IS 'IT incident tracking and management';


-- =============================================================================
-- SECTION 2 — INDEXES
-- (Primary-key indexes are created automatically by the constraints above)
-- =============================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_email      ON public.profiles (email);
CREATE INDEX IF NOT EXISTS idx_profiles_role       ON public.profiles (role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles (created_at DESC);

-- assets
CREATE INDEX IF NOT EXISTS idx_assets_type        ON public.assets (type);
CREATE INDEX IF NOT EXISTS idx_assets_status      ON public.assets (status);
CREATE INDEX IF NOT EXISTS idx_assets_name        ON public.assets (name);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON public.assets (assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_created_by  ON public.assets (created_by);
CREATE INDEX IF NOT EXISTS idx_assets_created_at  ON public.assets (created_at DESC);

-- asset_metrics
CREATE INDEX IF NOT EXISTS idx_asset_metrics_asset_id      ON public.asset_metrics (asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_metrics_health_status ON public.asset_metrics (health_status);
CREATE INDEX IF NOT EXISTS idx_asset_metrics_last_updated  ON public.asset_metrics (last_updated DESC);

-- incidents
CREATE INDEX IF NOT EXISTS idx_incidents_status      ON public.incidents (status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity    ON public.incidents (severity);
CREATE INDEX IF NOT EXISTS idx_incidents_category    ON public.incidents (category);
CREATE INDEX IF NOT EXISTS idx_incidents_asset_id    ON public.incidents (asset_id);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_by ON public.incidents (reported_by);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON public.incidents (assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_at ON public.incidents (reported_at DESC);


-- =============================================================================
-- SECTION 3 — VIEWS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1  asset_latest_metrics
--      Returns the most-recent metric row per asset, joined with asset info.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.asset_latest_metrics AS
SELECT DISTINCT ON (am.asset_id)
    am.id,
    am.asset_id,
    am.cpu_usage,
    am.memory_usage,
    am.disk_usage,
    am.temperature,
    am.is_operational,
    am.last_error,
    am.uptime_hours,
    am.bandwidth_usage_mbps,
    am.packet_loss_percent,
    am.latency_ms,
    am.active_connections,
    am.service_status,
    am.response_time_ms,
    am.error_rate_percent,
    am.availability_percent,
    am.health_status,
    am.last_updated,
    am.created_at,
    a.name   AS asset_name,
    a.type   AS asset_type,
    a.status AS asset_status
FROM public.asset_metrics am
JOIN public.assets a ON am.asset_id = a.id
ORDER BY am.asset_id, am.last_updated DESC;


-- =============================================================================
-- SECTION 4 — FUNCTIONS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 4.1  handle_new_user
--      Called by the auth.users trigger: creates a profile row for every
--      new signup.  All new users start as 'viewer'.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, gender, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'gender', 'prefer_not_to_say'),
    'viewer'  -- All new users start as viewer by default
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4.2  handle_updated_at / handle_asset_updated_at / handle_incident_updated_at
--      Generic timestamp bump triggers (kept as separate functions to match
--      the live schema exactly).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_asset_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_incident_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4.3  update_asset_metrics_timestamp
--      Bumps last_updated on every metric row update.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_asset_metrics_timestamp()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4.4  handle_incident_resolution
--      Automatically sets/clears resolved_at when incident status changes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_incident_resolution()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Set resolved_at timestamp when incident is resolved or closed
  IF (NEW.status = 'resolved' OR NEW.status = 'closed')
     AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at = NOW();
  END IF;

  -- Clear resolved_at if status changes back to open/in_progress
  IF (NEW.status = 'open' OR NEW.status = 'in_progress')
     AND OLD.status IN ('resolved', 'closed') THEN
    NEW.resolved_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4.5  determine_health_status
--      BEFORE INSERT/UPDATE trigger function on asset_metrics.
--      Computes health_status from the incoming metric values depending on
--      which asset-type metrics are present.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.determine_health_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- ========================================
    -- HARDWARE ASSETS: Check CPU, Memory, Temperature, AND Disk Usage
    -- ========================================
    IF NEW.cpu_usage IS NOT NULL OR NEW.memory_usage IS NOT NULL
       OR NEW.temperature IS NOT NULL OR NEW.disk_usage IS NOT NULL THEN

        IF (COALESCE(NEW.cpu_usage, 0) > 90
            OR COALESCE(NEW.memory_usage, 0) > 90
            OR COALESCE(NEW.temperature, 0) > 75
            OR COALESCE(NEW.disk_usage, 0) > 80) THEN
            NEW.health_status = 'critical';
            RETURN NEW;
        END IF;

        IF (COALESCE(NEW.cpu_usage, 0) > 75
            OR COALESCE(NEW.memory_usage, 0) > 75
            OR COALESCE(NEW.temperature, 0) > 65
            OR COALESCE(NEW.disk_usage, 0) > 70) THEN
            NEW.health_status = 'warning';
            RETURN NEW;
        END IF;

        NEW.health_status = 'healthy';
        RETURN NEW;
    END IF;

    -- ========================================
    -- PERIPHERALS: Check connection and operational status
    -- ========================================
    IF NEW.connection_status IS NOT NULL OR NEW.print_status IS NOT NULL THEN
        -- Critical if disconnected or in error state
        IF NEW.connection_status = 'disconnected'
           OR NEW.print_status IN ('offline', 'error', 'paper_jam') THEN
            NEW.health_status = 'critical';
            RETURN NEW;
        END IF;

        -- Warning if intermittent connection or low toner
        IF NEW.connection_status = 'intermittent'
           OR NEW.print_status = 'low_toner' THEN
            NEW.health_status = 'warning';
            RETURN NEW;
        END IF;

        NEW.health_status = 'healthy';
        RETURN NEW;
    END IF;

    -- ========================================
    -- SOFTWARE ASSETS: Check operational status
    -- ========================================
    IF NEW.is_operational IS NOT NULL THEN
        IF NEW.is_operational = false THEN
            NEW.health_status = 'critical';
        ELSE
            NEW.health_status = 'healthy';
        END IF;
        RETURN NEW;
    END IF;

    -- ========================================
    -- NETWORK ASSETS: Check packet loss
    -- ========================================
    IF NEW.packet_loss_percent IS NOT NULL THEN
        IF NEW.packet_loss_percent > 5 THEN
            NEW.health_status = 'critical';
        ELSIF NEW.packet_loss_percent > 2 THEN
            NEW.health_status = 'warning';
        ELSE
            NEW.health_status = 'healthy';
        END IF;
        RETURN NEW;
    END IF;

    -- ========================================
    -- INFRASTRUCTURE ASSETS: Check service status
    -- ========================================
    IF NEW.service_status IS NOT NULL THEN
        IF NEW.service_status = 'down' THEN
            NEW.health_status = 'critical';
        ELSIF NEW.service_status = 'degraded' THEN
            NEW.health_status = 'warning';
        ELSE
            NEW.health_status = 'healthy';
        END IF;
        RETURN NEW;
    END IF;

    -- Default: If no metrics available, keep as healthy
    NEW.health_status = 'healthy';
    RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4.6  is_admin
--      Helper used in RLS policies to check whether the current user is admin.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$;


-- =============================================================================
-- SECTION 5 — TRIGGERS
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 5.1  auth.users -> profiles  (signup hook)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5.2  profiles — updated_at bump
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 5.3  assets — updated_at bump
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER set_asset_updated_at
    BEFORE UPDATE ON public.assets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_asset_updated_at();

-- ---------------------------------------------------------------------------
-- 5.4  asset_metrics — last_updated bump + health status computation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER set_asset_metrics_timestamp
    BEFORE UPDATE ON public.asset_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.update_asset_metrics_timestamp();

CREATE OR REPLACE TRIGGER set_health_status
    BEFORE INSERT OR UPDATE ON public.asset_metrics
    FOR EACH ROW
    EXECUTE FUNCTION public.determine_health_status();

-- ---------------------------------------------------------------------------
-- 5.5  incidents — updated_at bump + auto-resolve timestamp
-- ---------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER set_incident_updated_at
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_incident_updated_at();

CREATE OR REPLACE TRIGGER set_incident_resolution_time
    BEFORE UPDATE ON public.incidents
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_incident_resolution();


-- =============================================================================
-- SECTION 6 — ROW-LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on every user-facing table
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents     ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- 6.1  profiles policies
-- ---------------------------------------------------------------------------

-- Any authenticated user can read all profiles
CREATE POLICY "Public profiles are viewable by authenticated users"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (true);

-- Profiles are only ever created by the signup trigger, never by the client
CREATE POLICY "Profiles created by trigger only"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (false);

-- Users can update their own profile, but cannot escalate their own role
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    );

-- Admins can update any profile (including role changes)
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
    WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );

-- Admins can delete profiles
CREATE POLICY "Admins can delete profiles"
    ON public.profiles FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );


-- ---------------------------------------------------------------------------
-- 6.2  assets policies
-- ---------------------------------------------------------------------------

-- Everyone authenticated can view all assets
CREATE POLICY "Authenticated users can view all assets"
    ON public.assets FOR SELECT
    TO authenticated
    USING (true);

-- Admins and Operators can create assets
CREATE POLICY "Admins and Operators can create assets"
    ON public.assets FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role = ANY (ARRAY['admin'::text, 'operator'::text])
        )
    );

-- Admins can update any asset
CREATE POLICY "Admins can update any asset"
    ON public.assets FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Operators can update only assets they created
CREATE POLICY "Operators can update own assets"
    ON public.assets FOR UPDATE
    TO authenticated
    USING (
        created_by = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'operator')
    )
    WITH CHECK (
        created_by = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'operator')
    );

-- Admins can delete any asset
CREATE POLICY "Admins can delete any asset"
    ON public.assets FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Operators can delete only assets they created
CREATE POLICY "Operators can delete own assets"
    ON public.assets FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'operator')
    );


-- ---------------------------------------------------------------------------
-- 6.3  asset_metrics policies
-- ---------------------------------------------------------------------------

-- Anyone authenticated can read metrics
CREATE POLICY "Anyone authenticated can view asset metrics"
    ON public.asset_metrics FOR SELECT
    TO authenticated
    USING (true);

-- Authenticated users (service role equivalent) can insert metrics
CREATE POLICY "Service role can insert metrics"
    ON public.asset_metrics FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated users can update metrics
CREATE POLICY "Service role can update metrics"
    ON public.asset_metrics FOR UPDATE
    TO authenticated
    USING (true);

-- Only admins can delete metric records
CREATE POLICY "Admins can delete metrics"
    ON public.asset_metrics FOR DELETE
    TO authenticated
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    );


-- ---------------------------------------------------------------------------
-- 6.4  incidents policies
-- ---------------------------------------------------------------------------

-- Anyone authenticated can view all incidents
CREATE POLICY "Authenticated users can view all incidents"
    ON public.incidents FOR SELECT
    TO authenticated
    USING (true);

-- Any authenticated user can create an incident (reporter = themselves)
CREATE POLICY "Authenticated users can create incidents"
    ON public.incidents FOR INSERT
    TO authenticated
    WITH CHECK (reported_by = auth.uid());

-- Admins can update any incident
CREATE POLICY "Admins can update any incident"
    ON public.incidents FOR UPDATE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Reporters, assignees, and operators can update incidents
CREATE POLICY "Operators can update assigned incidents"
    ON public.incidents FOR UPDATE
    TO authenticated
    USING (
        reported_by = auth.uid()
        OR assigned_to = auth.uid()
        OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'operator')
    );

-- Admins can delete any incident
CREATE POLICY "Admins can delete any incident"
    ON public.incidents FOR DELETE
    TO authenticated
    USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );


-- =============================================================================
-- SECTION 7 — SEED DATA / DEFAULT TEST USERS
-- =============================================================================

-- Ensure pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insert or update default test viewer account (guest.viewer@itims.local / GuestViewer123!)
DO $$
DECLARE
  test_viewer_id uuid := '40530982-1bf7-4a22-b146-3785943db944';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'guest.viewer@itims.local') THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmed_at
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      test_viewer_id,
      'authenticated',
      'authenticated',
      'guest.viewer@itims.local',
      crypt('GuestViewer123!', gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Guest Viewer","gender":"prefer_not_to_say"}',
      NOW(),
      NOW(),
      NOW()
    );

    -- Insert corresponding identity
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      test_viewer_id,
      jsonb_build_object(
        'sub', test_viewer_id::text,
        'email', 'guest.viewer@itims.local',
        'full_name', 'Guest Viewer',
        'gender', 'prefer_not_to_say',
        'email_verified', true,
        'phone_verified', false
      ),
      'email',
      test_viewer_id::text,
      NOW(),
      NOW(),
      NOW()
    );
  END IF;

  -- Ensure profile exists with role viewer
  INSERT INTO public.profiles (id, email, full_name, gender, role)
  VALUES (
    test_viewer_id,
    'guest.viewer@itims.local',
    'Guest Viewer',
    'prefer_not_to_say',
    'viewer'
  )
  ON CONFLICT (id) DO UPDATE
  SET role = 'viewer', full_name = 'Guest Viewer';
END $$;


-- =============================================================================
-- END OF SCHEMA
-- =============================================================================
