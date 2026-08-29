-- ============================================================================
-- DEBUG: Check User Profile and Role
-- ============================================================================
-- Run this in Supabase SQL Editor to verify everything is correct
-- ============================================================================

-- Check if your user exists and has admin role
SELECT 
  id,
  email,
  full_name,
  gender,
  role,
  created_at,
  updated_at
FROM public.profiles
WHERE email = 'kartik.itims@gmail.com';

-- Expected result:
-- email: kartik.itims@gmail.com
-- role: admin (THIS MUST BE 'admin')

-- If role is NOT 'admin', run this:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'kartik.itims@gmail.com';

-- Check all profiles and their roles
SELECT email, full_name, role FROM public.profiles ORDER BY created_at DESC;

-- Check RLS policies are active
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Test if you can see your own profile (this should work)
-- Note: This simulates what the frontend does
-- SELECT * FROM public.profiles WHERE id = auth.uid();
