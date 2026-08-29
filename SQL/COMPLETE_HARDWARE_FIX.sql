-- ============================================
-- COMPLETE HARDWARE HEALTH STATUS FIX
-- ============================================
-- This script will:
-- 1. Verify the asset_metrics table structure is correct
-- 2. Fix the health status trigger to check ALL hardware metrics
-- 3. Re-evaluate all existing hardware metrics
-- 4. Show verification results

-- ============================================
-- STEP 1: Verify Table Structure
-- ============================================
-- Check that health_status column exists and is properly configured
DO $$ 
BEGIN
    -- Ensure health_status column exists with correct constraints
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_metrics' 
        AND column_name = 'health_status'
    ) THEN
        ALTER TABLE public.asset_metrics 
        ADD COLUMN health_status VARCHAR(20) NOT NULL DEFAULT 'healthy' 
        CHECK (health_status IN ('healthy', 'warning', 'critical'));
        
        RAISE NOTICE 'Added health_status column';
    ELSE
        RAISE NOTICE 'health_status column already exists';
    END IF;
END $$;

-- ============================================
-- STEP 2: Drop Old Trigger
-- ============================================
DROP TRIGGER IF EXISTS set_health_status ON public.asset_metrics;

-- ============================================
-- STEP 3: Create New Trigger Function with ALL Hardware Metrics
-- ============================================
CREATE OR REPLACE FUNCTION determine_health_status()
RETURNS TRIGGER AS $$
BEGIN
    -- ========================================
    -- HARDWARE ASSETS: Check CPU, Memory, Temperature, AND Disk Usage
    -- ========================================
    IF NEW.cpu_usage IS NOT NULL OR NEW.memory_usage IS NOT NULL 
       OR NEW.temperature IS NOT NULL OR NEW.disk_usage IS NOT NULL THEN
        
        -- CRITICAL: Any hardware metric exceeds critical threshold
        IF (COALESCE(NEW.cpu_usage, 0) > 90 
            OR COALESCE(NEW.memory_usage, 0) > 90 
            OR COALESCE(NEW.temperature, 0) > 75 
            OR COALESCE(NEW.disk_usage, 0) > 80) THEN
            NEW.health_status = 'critical';
            RETURN NEW;
        END IF;
        
        -- WARNING: Any hardware metric exceeds warning threshold
        IF (COALESCE(NEW.cpu_usage, 0) > 75 
            OR COALESCE(NEW.memory_usage, 0) > 75 
            OR COALESCE(NEW.temperature, 0) > 65 
            OR COALESCE(NEW.disk_usage, 0) > 70) THEN
            NEW.health_status = 'warning';
            RETURN NEW;
        END IF;
        
        -- HEALTHY: All hardware metrics are within normal range
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
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Create Trigger
-- ============================================
CREATE TRIGGER set_health_status
    BEFORE INSERT OR UPDATE ON public.asset_metrics
    FOR EACH ROW
    EXECUTE FUNCTION determine_health_status();

-- ============================================
-- STEP 5: Force Re-evaluation of ALL Existing Metrics
-- ============================================
-- This will trigger the new health_status calculation for all rows
UPDATE public.asset_metrics 
SET last_updated = NOW()
WHERE asset_id IN (SELECT id FROM public.assets);

-- ============================================
-- STEP 6: VERIFICATION - Show Current Hardware Status
-- ============================================
SELECT 
    '==================== HARDWARE ASSETS STATUS ====================' as info;

SELECT 
    a.name as "Asset Name",
    a.type as "Type",
    ROUND(am.cpu_usage::numeric, 2) as "CPU %",
    ROUND(am.memory_usage::numeric, 2) as "Memory %",
    ROUND(am.temperature::numeric, 2) as "Temp °C",
    ROUND(am.disk_usage::numeric, 2) as "Disk %",
    am.health_status as "Health Status",
    am.last_updated as "Last Updated"
FROM public.assets a
JOIN public.asset_metrics am ON a.id = am.asset_id
WHERE a.type = 'hardware'
ORDER BY 
    CASE am.health_status 
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'healthy' THEN 3
    END,
    a.name;

-- ============================================
-- STEP 7: Show Critical Threshold Rules
-- ============================================
SELECT 
    '==================== CRITICAL THRESHOLDS ====================' as info;

SELECT 
    'Hardware' as "Asset Type",
    'CPU > 90% OR Memory > 90% OR Temperature > 75°C OR Disk > 80%' as "Critical If",
    'CPU > 75% OR Memory > 75% OR Temperature > 65°C OR Disk > 70%' as "Warning If";

-- ============================================
-- STEP 8: Count Assets by Health Status
-- ============================================
SELECT 
    '==================== HEALTH STATUS SUMMARY ====================' as info;

SELECT 
    am.health_status as "Status",
    COUNT(*) as "Count",
    STRING_AGG(a.name, ', ' ORDER BY a.name) as "Assets"
FROM public.asset_metrics am
JOIN public.assets a ON a.id = am.asset_id
WHERE a.type = 'hardware'
GROUP BY am.health_status
ORDER BY 
    CASE am.health_status 
        WHEN 'critical' THEN 1
        WHEN 'warning' THEN 2
        WHEN 'healthy' THEN 3
    END;

-- ============================================
-- FINAL MESSAGE
-- ============================================
SELECT 
    '✅ COMPLETE! Hardware health status trigger is now fixed.' as info;
SELECT 
    '✅ The trigger now checks ALL hardware metrics: CPU, Memory, Temperature, AND Disk Usage.' as info;
SELECT 
    '✅ All existing metrics have been re-evaluated with the new logic.' as info;
SELECT 
    '✅ Any hardware with critical values will now show health_status = ''critical''.' as info;
