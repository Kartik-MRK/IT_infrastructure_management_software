-- ============================================
-- FIX ASSET METRICS TABLE FOR UPSERT
-- ============================================
-- This adds a unique constraint on asset_id so that
-- upsert operations can work properly in simulate_metrics.py
-- and hardware_test.py

-- Add unique constraint to asset_id
-- This ensures only one metric row per asset (the latest)
ALTER TABLE public.asset_metrics
ADD CONSTRAINT asset_metrics_asset_id_unique UNIQUE (asset_id);

-- Verify the constraint was added
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.asset_metrics'::regclass
AND conname = 'asset_metrics_asset_id_unique';
