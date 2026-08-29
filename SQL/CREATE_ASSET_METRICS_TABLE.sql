-- ============================================
-- CREATE ASSET METRICS TABLE
-- ============================================
-- This table stores real-time monitoring metrics for assets
-- Different asset types have different relevant metrics

-- Drop existing table if needed (WARNING: This will delete all data)
-- DROP TABLE IF EXISTS public.asset_metrics CASCADE;

-- Create asset_metrics table
CREATE TABLE IF NOT EXISTS public.asset_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    
    -- Hardware metrics (for type='hardware')
    cpu_usage DECIMAL(5,2) CHECK (cpu_usage >= 0 AND cpu_usage <= 100), -- Percentage 0-100
    memory_usage DECIMAL(5,2) CHECK (memory_usage >= 0 AND memory_usage <= 100), -- Percentage 0-100
    disk_usage DECIMAL(5,2) CHECK (disk_usage >= 0 AND disk_usage <= 100), -- Percentage 0-100
    temperature DECIMAL(5,2), -- Celsius
    
    -- Software metrics (for type='software')
    is_operational BOOLEAN DEFAULT true, -- Is software working correctly?
    last_error TEXT, -- Last error message if any
    uptime_hours DECIMAL(10,2), -- Hours since last restart
    
    -- Network metrics (for type='network')
    bandwidth_usage_mbps DECIMAL(10,2), -- Megabits per second
    packet_loss_percent DECIMAL(5,2) CHECK (packet_loss_percent >= 0 AND packet_loss_percent <= 100),
    latency_ms DECIMAL(8,2), -- Milliseconds
    active_connections INTEGER,
    
    -- Infrastructure metrics (for type='infrastructure')
    service_status VARCHAR(20) CHECK (service_status IN ('healthy', 'degraded', 'down')),
    response_time_ms DECIMAL(8,2), -- Response time in milliseconds
    error_rate_percent DECIMAL(5,2) CHECK (error_rate_percent >= 0 AND error_rate_percent <= 100),
    availability_percent DECIMAL(5,2) CHECK (availability_percent >= 0 AND availability_percent <= 100),
    
    -- Common fields
    health_status VARCHAR(20) NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy', 'warning', 'critical')),
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_asset_metrics_asset_id ON public.asset_metrics(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_metrics_health_status ON public.asset_metrics(health_status);
CREATE INDEX IF NOT EXISTS idx_asset_metrics_last_updated ON public.asset_metrics(last_updated DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE public.asset_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: All authenticated users can view metrics
CREATE POLICY "Anyone authenticated can view asset metrics"
ON public.asset_metrics
FOR SELECT
TO authenticated
USING (true);

-- Policy: Only system (service role) can insert metrics
-- This will be used by the simulator script
CREATE POLICY "Service role can insert metrics"
ON public.asset_metrics
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Policy: Only system (service role) can update metrics
CREATE POLICY "Service role can update metrics"
ON public.asset_metrics
FOR UPDATE
TO authenticated
USING (true);

-- Policy: Admins can delete metrics
CREATE POLICY "Admins can delete metrics"
ON public.asset_metrics
FOR DELETE
TO authenticated
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================
-- FUNCTION: Update last_updated timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_asset_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp update
DROP TRIGGER IF EXISTS set_asset_metrics_timestamp ON public.asset_metrics;
CREATE TRIGGER set_asset_metrics_timestamp
    BEFORE UPDATE ON public.asset_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_asset_metrics_timestamp();

-- ============================================
-- FUNCTION: Auto-determine health status based on thresholds
-- ============================================

CREATE OR REPLACE FUNCTION determine_health_status()
RETURNS TRIGGER AS $$
BEGIN
    -- For hardware
    IF NEW.cpu_usage IS NOT NULL OR NEW.memory_usage IS NOT NULL THEN
        IF (NEW.cpu_usage > 90 OR NEW.memory_usage > 90) THEN
            NEW.health_status = 'critical';
        ELSIF (NEW.cpu_usage > 75 OR NEW.memory_usage > 75) THEN
            NEW.health_status = 'warning';
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

-- Create trigger for health status determination
DROP TRIGGER IF EXISTS set_health_status ON public.asset_metrics;
CREATE TRIGGER set_health_status
    BEFORE INSERT OR UPDATE ON public.asset_metrics
    FOR EACH ROW
    EXECUTE FUNCTION determine_health_status();

-- ============================================
-- VIEW: Latest metrics for each asset
-- ============================================

CREATE OR REPLACE VIEW asset_latest_metrics AS
SELECT DISTINCT ON (asset_id)
    am.*,
    a.name as asset_name,
    a.type as asset_type,
    a.status as asset_status
FROM public.asset_metrics am
JOIN public.assets a ON am.asset_id = a.id
ORDER BY asset_id, last_updated DESC;

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================

-- Initialize metrics for existing hardware assets
INSERT INTO public.asset_metrics (
    asset_id, 
    cpu_usage, 
    memory_usage, 
    disk_usage, 
    temperature,
    health_status
)
SELECT 
    id,
    RANDOM() * 60 + 20, -- CPU 20-80%
    RANDOM() * 50 + 30, -- Memory 30-80%
    RANDOM() * 40 + 40, -- Disk 40-80%
    RANDOM() * 20 + 40, -- Temp 40-60°C
    'healthy'
FROM public.assets
WHERE type = 'hardware'
ON CONFLICT DO NOTHING;

-- Initialize metrics for existing software assets
INSERT INTO public.asset_metrics (
    asset_id,
    is_operational,
    uptime_hours,
    health_status
)
SELECT 
    id,
    true,
    RANDOM() * 720, -- 0-720 hours (30 days)
    'healthy'
FROM public.assets
WHERE type = 'software'
ON CONFLICT DO NOTHING;

-- Initialize metrics for existing network assets
INSERT INTO public.asset_metrics (
    asset_id,
    bandwidth_usage_mbps,
    packet_loss_percent,
    latency_ms,
    active_connections,
    health_status
)
SELECT 
    id,
    RANDOM() * 800 + 100, -- 100-900 Mbps
    RANDOM() * 1, -- 0-1% packet loss
    RANDOM() * 30 + 5, -- 5-35ms latency
    FLOOR(RANDOM() * 50 + 10)::INTEGER, -- 10-60 connections
    'healthy'
FROM public.assets
WHERE type = 'network'
ON CONFLICT DO NOTHING;

-- Initialize metrics for existing infrastructure assets
INSERT INTO public.asset_metrics (
    asset_id,
    service_status,
    response_time_ms,
    error_rate_percent,
    availability_percent,
    health_status
)
SELECT 
    id,
    'healthy',
    RANDOM() * 200 + 50, -- 50-250ms response time
    RANDOM() * 0.5, -- 0-0.5% error rate
    99 + RANDOM() * 1, -- 99-100% availability
    'healthy'
FROM public.assets
WHERE type = 'infrastructure'
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check table structure
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'asset_metrics'
-- ORDER BY ordinal_position;

-- Count metrics by asset type
-- SELECT 
--     a.type,
--     COUNT(am.id) as metric_count
-- FROM public.assets a
-- LEFT JOIN public.asset_metrics am ON a.id = am.asset_id
-- GROUP BY a.type;

-- View latest metrics
-- SELECT * FROM asset_latest_metrics;

-- Check health status distribution
-- SELECT 
--     health_status,
--     COUNT(*) as count
-- FROM public.asset_metrics
-- GROUP BY health_status;
