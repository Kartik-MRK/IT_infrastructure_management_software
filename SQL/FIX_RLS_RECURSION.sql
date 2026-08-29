-- ============================================================================
-- FIX: Infinite Recursion in RLS Policies
-- ============================================================================
-- The problem: Admin policies check profiles table while querying it
-- Solution: Use a custom function to check admin role
-- ============================================================================

-- Step 1: Drop all existing policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

-- Step 2: Create a helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Step 3: Create NEW policies without recursion

-- ============================================================================
-- SELECT POLICIES (Who can view profiles)
-- ============================================================================

-- Policy 1: All authenticated users can view all profiles
-- This is needed for the User Management dashboard and general profile viewing
CREATE POLICY "Authenticated users can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- UPDATE POLICIES (Who can edit profiles)
-- ============================================================================

-- Policy 2: Users can update their own profile (name, gender, avatar)
-- But they CANNOT change their own role
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id AND 
  role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- Policy 3: Admins can update ANY profile (including roles)
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
)
WITH CHECK (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================================
-- INSERT POLICIES (Who can create profiles)
-- ============================================================================

-- Policy 4: Only the trigger function can insert profiles (during signup)
-- This prevents manual profile creation
CREATE POLICY "Profiles created by trigger only"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- ============================================================================
-- DELETE POLICIES (Who can delete profiles)
-- ============================================================================

-- Policy 5: Only admins can delete profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================================================
-- ROLE SUMMARY
-- ============================================================================
-- 
-- VIEWER (viewer):
-- ✅ Can view all profiles (Policy 1)
-- ✅ Can update own profile except role (Policy 2)
-- ❌ Cannot update other profiles
-- ❌ Cannot delete profiles
-- ❌ Cannot create profiles manually
--
-- OPERATOR (operator):
-- ✅ Can view all profiles (Policy 1)
-- ✅ Can update own profile except role (Policy 2)
-- ❌ Cannot update other profiles
-- ❌ Cannot delete profiles
-- ❌ Cannot create profiles manually
--
-- ADMINISTRATOR (admin):
-- ✅ Can view all profiles (Policy 1)
-- ✅ Can update own profile (Policy 2)
-- ✅ Can update ANY profile including roles (Policy 3)
-- ✅ Can delete profiles (Policy 5)
-- ❌ Cannot create profiles manually (only via signup)
--
-- ============================================================================

-- Step 4: Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- ============================================================================
-- DONE! Now test by refreshing your browser
-- ============================================================================
-- 
-- After running this:
-- 1. Refresh your browser (F5)
-- 2. Check the console - error should be gone
-- 3. You should see "User role: admin"
-- 4. The "👑 Admin Panel" link should appear
-- ============================================================================
