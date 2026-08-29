-- ============================================================================
-- CLEANUP AND RESET SCRIPT
-- ============================================================================
-- This script will drop both assets and asset_metrics tables
-- Use this to start fresh and run the setup scripts in correct order
-- ============================================================================

-- WARNING: This will delete ALL data in these tables!
-- Make sure you want to do this before running

-- Drop asset_metrics table (must drop first due to foreign key)
DROP TABLE IF EXISTS public.asset_metrics CASCADE;

-- Drop assets table
DROP TABLE IF EXISTS public.assets CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS update_asset_metrics_timestamp() CASCADE;
DROP FUNCTION IF EXISTS determine_health_status() CASCADE;
DROP FUNCTION IF EXISTS public.handle_asset_updated_at() CASCADE;

-- Drop view
DROP VIEW IF EXISTS asset_latest_metrics CASCADE;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check if tables are gone (should return 0 rows)
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('assets', 'asset_metrics');

-- ============================================================================
-- CLEANUP COMPLETE!
-- ============================================================================
--
-- Next Steps:
-- 1. Run CREATE_ASSETS_TABLE.sql first
-- 2. Then run CREATE_ASSET_METRICS_TABLE.sql
-- 3. Verify both tables are created
-- 4. Start backend and metric simulator
--
-- ============================================================================
