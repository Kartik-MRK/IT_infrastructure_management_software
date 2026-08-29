-- ============================================================================
-- PROMOTE kartik.itims@gmail.com TO ADMIN
-- ============================================================================
-- Run this AFTER you have signed up through the UI
-- ============================================================================

-- Update the user to admin role with full details
UPDATE public.profiles 
SET role = 'admin', 
    full_name = 'Kartik',
    gender = 'male'
WHERE email = 'kartik.itims@gmail.com';

-- Verify it worked
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

-- ============================================================================
-- Expected Result:
-- email: kartik.itims@gmail.com
-- full_name: Kartik
-- gender: male
-- role: admin
-- ============================================================================
