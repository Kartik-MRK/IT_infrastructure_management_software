-- ============================================================================
-- ITIMS Database Setup & Update Queries
-- ============================================================================
-- Purpose: Complete SQL queries for setting up and updating the database
--          with the 3-tier RBAC system (admin/operator/viewer)
-- 
-- Instructions:
-- 1. Run these queries in Supabase SQL Editor (Dashboard → SQL Editor)
-- 2. Execute sections in order (top to bottom)
-- 3. Check for "Success" message after each query
-- ============================================================================

-- ============================================================================
-- SECTION 1: DROP EXISTING CONFLICTING POLICIES (IF UPDATING EXISTING DB)
-- ============================================================================
-- Run this section ONLY if you're updating an existing database
-- Skip this if setting up for the first time

-- Drop old policies that might conflict
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;

-- ============================================================================
-- SECTION 2: UPDATE PROFILES TABLE STRUCTURE
-- ============================================================================
-- Add new columns if they don't exist

-- Add full_name column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'full_name'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN full_name TEXT;
    END IF;
END $$;

-- Add gender column (if not exists)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = 'gender'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN gender TEXT;
    END IF;
END $$;

-- Update existing NULL full_name values with email
UPDATE public.profiles 
SET full_name = COALESCE(full_name, email)
WHERE full_name IS NULL OR full_name = '';

-- Set full_name to NOT NULL after filling in missing values
ALTER TABLE public.profiles ALTER COLUMN full_name SET NOT NULL;

-- Add gender constraint (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_gender_check'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_gender_check 
        CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'));
    END IF;
END $$;

-- ============================================================================
-- SECTION 3: UPDATE ROLE SYSTEM (2-tier → 3-tier)
-- ============================================================================
-- Change from admin/user to admin/operator/viewer

-- Step 1: Drop old role constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Step 2: Update existing 'user' roles to 'viewer'
UPDATE public.profiles 
SET role = 'viewer' 
WHERE role = 'user';

-- Step 3: Add new 3-tier role constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'operator', 'viewer'));

-- Step 4: Set default role to 'viewer' for new signups
ALTER TABLE public.profiles 
ALTER COLUMN role SET DEFAULT 'viewer';

-- ============================================================================
-- SECTION 4: UPDATE TRIGGER FUNCTION FOR NEW USERS
-- ============================================================================
-- Update the trigger to handle full_name and gender from signup metadata

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, gender, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),  -- Use email as fallback
    COALESCE(NEW.raw_user_meta_data->>'gender', 'prefer_not_to_say'),
    'viewer'  -- Default role for all new signups
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists (drop and recreate to update)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- SECTION 5: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Policy 2: Users can update their own profile
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = id);

-- Policy 3: Admins can view ALL profiles (for User Management dashboard)
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Policy 4: Admins can update ANY profile (for role management)
CREATE POLICY "Admins can update any profile" 
ON public.profiles 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- ============================================================================
-- SECTION 6: CREATE ADMIN ACCOUNT
-- ============================================================================
-- IMPORTANT: First sign up with admin@gmail.com through the UI, 
-- then run this query to promote the account to admin role

-- Promote admin@gmail.com to admin role
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'kartik.itims@gmail.com';

-- Verify admin account was created
SELECT id, email, full_name, role, created_at 
FROM public.profiles 
WHERE email = 'kartik.itims@gmail.com';

-- ============================================================================
-- SECTION 7: VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify everything is set up correctly

-- Check all columns in profiles table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Check all constraints on profiles table
SELECT conname AS constraint_name, 
       pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.profiles'::regclass;

-- View all RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Count users by role
SELECT role, COUNT(*) as count
FROM public.profiles
GROUP BY role
ORDER BY role;

-- View all users with their details
SELECT id, email, full_name, gender, role, created_at
FROM public.profiles
ORDER BY created_at DESC;

-- ============================================================================
-- SECTION 8: USEFUL ADMIN QUERIES
-- ============================================================================
-- Queries for common admin tasks

-- Promote a user to admin
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'user@example.com';

-- Change user to operator
-- UPDATE public.profiles SET role = 'operator' WHERE email = 'user@example.com';

-- Change user to viewer
-- UPDATE public.profiles SET role = 'viewer' WHERE email = 'user@example.com';

-- View admins only
-- SELECT * FROM public.profiles WHERE role = 'admin';

-- View operators only
-- SELECT * FROM public.profiles WHERE role = 'operator';

-- View viewers only
-- SELECT * FROM public.profiles WHERE role = 'viewer';

-- Update user's full name
-- UPDATE public.profiles SET full_name = 'New Name' WHERE email = 'user@example.com';

-- Update user's gender
-- UPDATE public.profiles SET gender = 'male' WHERE email = 'user@example.com';

-- Delete a user profile (CASCADE will delete auth.users entry)
-- DELETE FROM auth.users WHERE email = 'user@example.com';

-- ============================================================================
-- SECTION 9: BULK OPERATIONS
-- ============================================================================
-- Useful for managing multiple users at once

-- Set default gender for all users without one
UPDATE public.profiles 
SET gender = 'prefer_not_to_say' 
WHERE gender IS NULL;

-- Promote multiple users to operator role
-- UPDATE public.profiles 
-- SET role = 'operator' 
-- WHERE email IN ('user1@example.com', 'user2@example.com', 'user3@example.com');

-- Demote all operators to viewers (useful for testing)
-- UPDATE public.profiles SET role = 'viewer' WHERE role = 'operator';

-- ============================================================================
-- SECTION 10: ANALYTICS QUERIES
-- ============================================================================
-- Queries for monitoring and reporting

-- User registration stats by day
SELECT DATE(created_at) as registration_date, 
       COUNT(*) as new_users
FROM public.profiles
GROUP BY DATE(created_at)
ORDER BY registration_date DESC;

-- User distribution by role and gender
SELECT role, gender, COUNT(*) as count
FROM public.profiles
GROUP BY role, gender
ORDER BY role, gender;

-- Recently updated profiles
SELECT email, full_name, role, updated_at
FROM public.profiles
ORDER BY updated_at DESC
LIMIT 10;

-- Users who joined in the last 7 days
SELECT email, full_name, role, created_at
FROM public.profiles
WHERE created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;

-- ============================================================================
-- SECTION 11: TROUBLESHOOTING QUERIES
-- ============================================================================

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'profiles';

-- Test RLS policies (run as different users to verify)
-- This will show what the current user can see
-- SELECT * FROM public.profiles;

-- Check trigger functions
SELECT tgname as trigger_name, 
       proname as function_name,
       pg_get_functiondef(pg_proc.oid) as function_definition
FROM pg_trigger
JOIN pg_proc ON pg_trigger.tgfoid = pg_proc.oid
WHERE tgrelid = 'auth.users'::regclass;

-- Find users with missing data
SELECT 
  email,
  CASE WHEN full_name IS NULL OR full_name = '' THEN 'Missing' ELSE 'OK' END as full_name_status,
  CASE WHEN gender IS NULL THEN 'Missing' ELSE 'OK' END as gender_status,
  CASE WHEN role IS NULL THEN 'Missing' ELSE 'OK' END as role_status
FROM public.profiles;

-- ============================================================================
-- SECTION 12: RESET QUERIES (USE WITH CAUTION!)
-- ============================================================================
-- Only use these if you need to completely reset the database

-- WARNING: This will delete ALL user profiles (uncomment to use)
-- DELETE FROM public.profiles;

-- WARNING: This will delete ALL users including auth (uncomment to use)
-- DELETE FROM auth.users;

-- Recreate profiles table from scratch (uncomment to use)
-- DROP TABLE IF EXISTS public.profiles CASCADE;
-- Then run the CREATE TABLE statement from DATABASE_SCHEMA.md

-- ============================================================================
-- EXECUTION CHECKLIST
-- ============================================================================
-- 
-- [ ] Section 1: Drop old policies (if updating existing DB)
-- [ ] Section 2: Update profiles table structure
-- [ ] Section 3: Update role system to 3-tier
-- [ ] Section 4: Update trigger function
-- [ ] Section 5: Create RLS policies
-- [ ] Section 6: Create admin account (after UI signup)
-- [ ] Section 7: Run verification queries
-- 
-- Expected Results:
-- - profiles table has: id, email, full_name (NOT NULL), gender, role, avatar_url, created_at, updated_at
-- - Role constraint: CHECK (role IN ('admin', 'operator', 'viewer'))
-- - Gender constraint: CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say'))
-- - 4 RLS policies active
-- - Trigger function handles full_name and gender metadata
-- - Admin account exists with role = 'admin'
--
-- ============================================================================
-- END OF SQL QUERIES
-- ============================================================================
-- 
-- Next Steps:
-- 1. Test signup with new fields (full name, gender)
-- 2. Log in as admin and access User Management
-- 3. Create test users with different roles
-- 4. Verify role-based access control
-- 
-- Documentation: See TESTING_CHECKLIST.md for detailed testing steps
-- ============================================================================
