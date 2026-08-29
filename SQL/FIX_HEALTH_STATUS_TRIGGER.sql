-- ============================================
-- FIX: Update health status trigger to check ALL hardware metrics
-- ============================================
-- Problem: Original trigger only checked cpu_usage and memory_usage
-- Missing: temperature and disk_usage checks
-- Result: Hardware with high temp/disk but normal CPU/RAM was marked 'healthy'

-- Drop existing trigger
DROP TRIGGER IF EXISTS set_health_status ON public.asset_metrics;

-- Recreate function with COMPLETE hardware checks
CREATE OR REPLACE FUNCTION determine_health_status()
RETURNS TRIGGER AS $$
BEGIN
    -- For hardware - check ALL metrics (CPU, Memory, Temperature, Disk)
    IF NEW.cpu_usage IS NOT NULL OR NEW.memory_usage IS NOT NULL 
       OR NEW.temperature IS NOT NULL OR NEW.disk_usage IS NOT NULL THEN
        
        -- Critical: ANY metric exceeds critical threshold
        IF (NEW.cpu_usage > 90 OR NEW.memory_usage > 90 
            OR NEW.temperature > 75 OR NEW.disk_usage > 80) THEN
            NEW.health_status = 'critical';
        
        -- Warning: ANY metric exceeds warning threshold
        ELSIF (NEW.cpu_usage > 75 OR NEW.memory_usage > 75 
               OR NEW.temperature > 65 OR NEW.disk_usage > 70) THEN
            NEW.health_status = 'warning';
        
        -- Healthy: All metrics are normal
        ELSE
            NEW.health_status = 'healthy';
        END IF;
    END IF;
    
    -- For software
    IF NEW.is_operational IS NOT NULL THEN
        IF NEW.is_operational = false THEN
            NEW.health_status = 'critical';
        ELSE
            NEW.health_status = 'healthy';
        END IF;
    END IF;
    
    -- For network
    IF NEW.packet_loss_percent IS NOT NULL THEN
        IF NEW.packet_loss_percent > 5 THEN
            NEW.health_status = 'critical';
        ELSIF NEW.packet_loss_percent > 2 THEN
            NEW.health_status = 'warning';
        ELSE
            NEW.health_status = 'healthy';
        END IF;
    END IF;
    
    -- For infrastructure
    IF NEW.service_status IS NOT NULL THEN
        IF NEW.service_status = 'down' THEN
            NEW.health_status = 'critical';
        ELSIF NEW.service_status = 'degraded' THEN
            NEW.health_status = 'warning';
        ELSE
            NEW.health_status = 'healthy';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER set_health_status
    BEFORE INSERT OR UPDATE ON public.asset_metrics
    FOR EACH ROW
    EXECUTE FUNCTION determine_health_status();

-- ============================================
-- VERIFICATION: Check current critical hardware
-- ============================================

-- This should show hardware with high temp/disk that were incorrectly marked 'healthy'
SELECT 
    a.name,
    a.type,
    am.cpu_usage,
    am.memory_usage,
    am.temperature,
    am.disk_usage,
    am.health_status as old_health_status,
    CASE 
        WHEN (am.cpu_usage > 90 OR am.memory_usage > 90 OR am.temperature > 75 OR am.disk_usage > 80) 
        THEN 'critical'
        WHEN (am.cpu_usage > 75 OR am.memory_usage > 75 OR am.temperature > 65 OR am.disk_usage > 70) 
        THEN 'warning'
        ELSE 'healthy'
    END as should_be
FROM public.assets a
JOIN public.asset_metrics am ON a.id = am.asset_id
WHERE a.type = 'hardware'
ORDER BY am.last_updated DESC;

-- ============================================
-- FORCE UPDATE: Re-evaluate all existing metrics
-- ============================================

-- This will trigger the new health_status calculation for all rows
UPDATE public.asset_metrics 
SET last_updated = NOW()
WHERE asset_id IN (SELECT id FROM public.assets WHERE type = 'hardware');
