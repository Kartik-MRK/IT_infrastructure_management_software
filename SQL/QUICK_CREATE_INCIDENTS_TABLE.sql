-- ============================================
-- QUICK INCIDENTS TABLE CREATION
-- Run this in Supabase SQL Editor
-- ============================================

-- Create incidents table (simplified version)
CREATE TABLE IF NOT EXISTS public.incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  category TEXT,
  
  -- Asset relationship (optional)
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  
  -- User relationships
  reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL NOT NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional metadata
  resolution_notes TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority >= 0 AND priority <= 10),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_incidents_status ON public.incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON public.incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_reported_by ON public.incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON public.incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_asset_id ON public.incidents(asset_id);

-- Enable Row Level Security
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- 1. Anyone authenticated can view incidents
CREATE POLICY "Anyone can view incidents"
  ON public.incidents
  FOR SELECT
  TO authenticated
  USING (true);

-- 2. Authenticated users can create incidents
CREATE POLICY "Users can create incidents"
  ON public.incidents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reported_by);

-- 3. Users can update incidents they reported or are assigned to
CREATE POLICY "Users can update their incidents"
  ON public.incidents
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = reported_by 
    OR auth.uid() = assigned_to
  );

-- 4. Only admins can delete incidents (will be handled by service key in backend)
CREATE POLICY "Service role can delete incidents"
  ON public.incidents
  FOR DELETE
  TO service_role
  USING (true);

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

-- Success message
DO $$ 
BEGIN 
  RAISE NOTICE '✅ Incidents table created successfully!';
END $$;
