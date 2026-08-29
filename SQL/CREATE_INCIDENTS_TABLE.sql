-- ============================================
-- INCIDENT MANAGEMENT TABLE SETUP
-- ============================================
-- Create incidents table for tracking IT issues and problems
-- ============================================

-- Drop existing table if needed (for fresh start)
-- DROP TABLE IF EXISTS public.incidents CASCADE;

-- Create incidents table
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT CHECK (category IN ('hardware', 'software', 'network', 'infrastructure', 'peripherals', 'security', 'other')),
  
  -- Asset relationship (optional - incident may not be asset-specific)
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  
  -- User relationships
  reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  
  -- Timestamps
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional metadata
  resolution_notes TEXT,
  priority INTEGER DEFAULT 0 CHECK (priority >= 0 AND priority <= 10),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.incidents IS 'IT incident tracking and management';
COMMENT ON COLUMN public.incidents.severity IS 'Incident severity: critical, high, medium, low';
COMMENT ON COLUMN public.incidents.status IS 'Incident status: open, in_progress, resolved, closed';
COMMENT ON COLUMN public.incidents.priority IS 'Priority level 0-10 (10 being highest)';
COMMENT ON COLUMN public.incidents.reported_by IS 'User who reported the incident';
COMMENT ON COLUMN public.incidents.assigned_to IS 'User assigned to handle the incident';
COMMENT ON COLUMN public.incidents.resolved_by IS 'User who resolved the incident';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_incident_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_incident_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_incident_updated_at();

-- Auto-set resolved_at when status changes to resolved/closed
CREATE OR REPLACE FUNCTION public.handle_incident_resolution()
RETURNS TRIGGER AS $$
BEGIN
  -- Set resolved_at timestamp when incident is resolved or closed
  IF (NEW.status = 'resolved' OR NEW.status = 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at = NOW();
  END IF;
  
  -- Clear resolved_at if status changes back to open/in_progress
  IF (NEW.status = 'open' OR NEW.status = 'in_progress') AND OLD.status IN ('resolved', 'closed') THEN
    NEW.resolved_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_incident_resolution_time
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_incident_resolution();

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can view all incidents
CREATE POLICY "Authenticated users can view all incidents"
ON public.incidents
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: All authenticated users can create incidents
CREATE POLICY "Authenticated users can create incidents"
ON public.incidents
FOR INSERT
TO authenticated
WITH CHECK (reported_by = auth.uid());

-- Policy 3: Admins can update any incident
CREATE POLICY "Admins can update any incident"
ON public.incidents
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Operators can update incidents they reported or are assigned to
CREATE POLICY "Operators can update assigned incidents"
ON public.incidents
FOR UPDATE
TO authenticated
USING (
  reported_by = auth.uid() OR assigned_to = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'operator'
  )
);

-- Policy 5: Admins can delete any incident
CREATE POLICY "Admins can delete any incident"
ON public.incidents
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_by ON public.incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON public.incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_asset_id ON public.incidents(asset_id);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_at ON public.incidents(reported_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_category ON public.incidents(category);

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'incidents'
ORDER BY ordinal_position;

-- Check constraints
SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.incidents'::regclass;

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'incidents'
ORDER BY policyname;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================

SELECT '✅ INCIDENTS TABLE CREATED SUCCESSFULLY!' as status;
SELECT '✅ RLS policies enabled for secure access' as security;
SELECT '✅ Auto-timestamps and triggers configured' as automation;
SELECT '✅ Ready for incident management API integration' as ready;
