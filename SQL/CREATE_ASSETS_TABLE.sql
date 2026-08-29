-- ============================================================================
-- ASSET MANAGEMENT TABLE SETUP
-- ============================================================================
-- Create the assets table with all required fields and constraints
-- ============================================================================

-- Drop existing table if needed (for fresh start)
-- DROP TABLE IF EXISTS public.assets CASCADE;

-- Create assets table
CREATE TABLE IF NOT EXISTS public.assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('hardware', 'software', 'network', 'infrastructure', 'other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'retired', 'damaged', 'in_use')),
  description TEXT,
  serial_number TEXT,
  location TEXT,
  purchase_date DATE,
  warranty_expiry DATE,
  cost DECIMAL(12, 2),
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.assets IS 'IT assets managed in the system';
COMMENT ON COLUMN public.assets.type IS 'Asset type: hardware, software, network, infrastructure, other';
COMMENT ON COLUMN public.assets.status IS 'Asset status: active, maintenance, retired, damaged, in_use';
COMMENT ON COLUMN public.assets.assigned_to IS 'User this asset is assigned to';
COMMENT ON COLUMN public.assets.created_by IS 'User who created this asset';

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_asset_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_asset_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_asset_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR ASSETS
-- ============================================================================

-- Enable RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Policy 1: All authenticated users can view all assets
CREATE POLICY "Authenticated users can view all assets"
ON public.assets
FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Admins and Operators can create assets
CREATE POLICY "Admins and Operators can create assets"
ON public.assets
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'operator')
  )
);

-- Policy 3: Admins can update any asset
CREATE POLICY "Admins can update any asset"
ON public.assets
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Operators can update assets they created
CREATE POLICY "Operators can update own assets"
ON public.assets
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'operator'
  )
)
WITH CHECK (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'operator'
  )
);

-- Policy 5: Admins can delete any asset
CREATE POLICY "Admins can delete any asset"
ON public.assets
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 6: Operators can delete assets they created
CREATE POLICY "Operators can delete own assets"
ON public.assets
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'operator'
  )
);

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assets_type ON public.assets(type);
CREATE INDEX IF NOT EXISTS idx_assets_status ON public.assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_created_by ON public.assets(created_by);
CREATE INDEX IF NOT EXISTS idx_assets_assigned_to ON public.assets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assets_created_at ON public.assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_name ON public.assets(name);

-- ============================================================================
-- SEED SAMPLE DATA (OPTIONAL - for testing)
-- ============================================================================

-- First, get the admin user ID (replace with your actual admin email)
DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- Get admin user ID
  SELECT id INTO admin_id FROM public.profiles WHERE email = 'kartik.itims@gmail.com' LIMIT 1;
  
  -- Insert sample assets if admin exists
  IF admin_id IS NOT NULL THEN
    -- Sample Hardware Assets
    INSERT INTO public.assets (name, type, status, description, serial_number, location, created_by, cost) VALUES
    ('Dell OptiPlex 7090', 'hardware', 'active', 'Desktop computer for development', 'DL-7090-001', 'Office - Floor 3', admin_id, 85000.00),
    ('MacBook Pro 16"', 'hardware', 'in_use', 'Laptop for senior developers', 'MBP-16-2023-001', 'Office - Floor 2', admin_id, 250000.00),
    ('HP LaserJet Pro', 'hardware', 'active', 'Network printer', 'HP-LJ-PRO-001', 'Office - Floor 1', admin_id, 35000.00),
    ('Cisco Switch 24-Port', 'network', 'active', '24-port Gigabit switch', 'CS-24P-001', 'Server Room', admin_id, 45000.00),
    ('Dell Monitor 27"', 'hardware', 'active', 'Full HD LED monitor', 'DM-27-001', 'Office - Floor 3', admin_id, 18000.00);
    
    -- Sample Software Assets
    INSERT INTO public.assets (name, type, status, description, serial_number, created_by, cost) VALUES
    ('Microsoft Office 365', 'software', 'active', 'Business Premium license', 'MS365-BP-001', admin_id, 12000.00),
    ('Adobe Creative Cloud', 'software', 'active', 'All Apps license', 'ACC-AA-001', admin_id, 52000.00),
    ('JetBrains IntelliJ IDEA', 'software', 'active', 'Ultimate Edition license', 'JB-IDEA-001', admin_id, 25000.00);
    
    -- Sample Infrastructure
    INSERT INTO public.assets (name, type, status, description, location, created_by, cost) VALUES
    ('AWS EC2 Instance', 'infrastructure', 'active', 't3.medium production server', 'AWS us-east-1', admin_id, 8000.00),
    ('Firebase Project', 'infrastructure', 'active', 'Mobile app backend', 'Google Cloud', admin_id, 5000.00);
    
    RAISE NOTICE 'Sample assets created successfully!';
  ELSE
    RAISE NOTICE 'Admin user not found. Skipping sample data creation.';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'assets'
ORDER BY ordinal_position;

-- Check constraints
SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.assets'::regclass;

-- Check RLS policies
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename = 'assets'
ORDER BY policyname;

-- Count assets by type
SELECT type, COUNT(*) as count
FROM public.assets
GROUP BY type
ORDER BY count DESC;

-- Count assets by status
SELECT status, COUNT(*) as count
FROM public.assets
GROUP BY status
ORDER BY count DESC;

-- View all assets with creator info
SELECT 
  a.id,
  a.name,
  a.type,
  a.status,
  a.location,
  p.full_name as created_by_name,
  p.email as created_by_email,
  a.created_at
FROM public.assets a
LEFT JOIN public.profiles p ON a.created_by = p.id
ORDER BY a.created_at DESC;

-- ============================================================================
-- ROLE SUMMARY FOR ASSETS
-- ============================================================================
--
-- VIEWER (viewer):
-- ✅ Can view all assets (Policy 1)
-- ❌ Cannot create assets
-- ❌ Cannot update assets
-- ❌ Cannot delete assets
--
-- OPERATOR (operator):
-- ✅ Can view all assets (Policy 1)
-- ✅ Can create assets (Policy 2)
-- ✅ Can update assets they created (Policy 4)
-- ✅ Can delete assets they created (Policy 6)
-- ❌ Cannot update/delete others' assets
--
-- ADMINISTRATOR (admin):
-- ✅ Can view all assets (Policy 1)
-- ✅ Can create assets (Policy 2)
-- ✅ Can update ANY asset (Policy 3)
-- ✅ Can delete ANY asset (Policy 5)
--
-- ============================================================================
-- SETUP COMPLETE! 🎉
-- ============================================================================
--
-- Next Steps:
-- 1. Run this SQL in Supabase SQL Editor
-- 2. Verify table and policies are created
-- 3. Check sample data is seeded
-- 4. Test backend API endpoints
-- 5. Build frontend components
--
-- ============================================================================
