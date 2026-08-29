-- ============================================
-- ADD PERIPHERALS ASSET TYPE
-- ============================================
-- This script will:
-- 1. Add 'peripherals' to asset type enum/check constraint
-- 2. Update the health status trigger to handle peripherals
-- 3. Add sample peripheral assets (monitors, printers, etc.)
-- 4. Add metrics columns for peripherals

-- ============================================
-- STEP 1: Update Assets Table to Allow 'peripherals' Type
-- ============================================

-- First, check if there's a constraint on the type column
DO $$ 
BEGIN
    -- Drop the existing check constraint on type if it exists
    ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS assets_type_check;
    
    -- Add new check constraint with 'peripherals' included
    ALTER TABLE public.assets 
    ADD CONSTRAINT assets_type_check 
    CHECK (type IN ('hardware', 'software', 'network', 'infrastructure', 'peripherals'));
    
    RAISE NOTICE '✓ Added peripherals to asset type constraint';
END $$;

-- ============================================
-- STEP 2: Add Peripherals Metrics Columns to asset_metrics
-- ============================================

-- Add columns for peripheral-specific metrics if they don't exist
DO $$ 
BEGIN
    -- Print status (online/offline)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_metrics' AND column_name = 'print_status'
    ) THEN
        ALTER TABLE public.asset_metrics 
        ADD COLUMN print_status VARCHAR(20) CHECK (print_status IN ('online', 'offline', 'paper_jam', 'low_toner', 'error'));
        RAISE NOTICE '✓ Added print_status column';
    END IF;
    
    -- Connection status (for all peripherals)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_metrics' AND column_name = 'connection_status'
    ) THEN
        ALTER TABLE public.asset_metrics 
        ADD COLUMN connection_status VARCHAR(20) CHECK (connection_status IN ('connected', 'disconnected', 'intermittent'));
        RAISE NOTICE '✓ Added connection_status column';
    END IF;
    
    -- Usage hours (for all peripherals)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_metrics' AND column_name = 'usage_hours'
    ) THEN
        ALTER TABLE public.asset_metrics 
        ADD COLUMN usage_hours DECIMAL(10,2);
        RAISE NOTICE '✓ Added usage_hours column';
    END IF;
    
    -- Error message (for peripherals)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'asset_metrics' AND column_name = 'peripheral_error'
    ) THEN
        ALTER TABLE public.asset_metrics 
        ADD COLUMN peripheral_error TEXT;
        RAISE NOTICE '✓ Added peripheral_error column';
    END IF;
END $$;

-- ============================================
-- STEP 3: Update Health Status Trigger for Peripherals
-- ============================================

DROP TRIGGER IF EXISTS set_health_status ON public.asset_metrics;

CREATE OR REPLACE FUNCTION determine_health_status()
RETURNS TRIGGER AS $$
BEGIN
    -- ========================================
    -- HARDWARE ASSETS: Check CPU, Memory, Temperature, AND Disk Usage
    -- ========================================
    IF NEW.cpu_usage IS NOT NULL OR NEW.memory_usage IS NOT NULL 
       OR NEW.temperature IS NOT NULL OR NEW.disk_usage IS NOT NULL THEN
        
        IF (COALESCE(NEW.cpu_usage, 0) > 90 
            OR COALESCE(NEW.memory_usage, 0) > 90 
            OR COALESCE(NEW.temperature, 0) > 75 
            OR COALESCE(NEW.disk_usage, 0) > 80) THEN
            NEW.health_status = 'critical';
            RETURN NEW;
        END IF;
        
        IF (COALESCE(NEW.cpu_usage, 0) > 75 
            OR COALESCE(NEW.memory_usage, 0) > 75 
            OR COALESCE(NEW.temperature, 0) > 65 
            OR COALESCE(NEW.disk_usage, 0) > 70) THEN
            NEW.health_status = 'warning';
            RETURN NEW;
        END IF;
        
        NEW.health_status = 'healthy';
        RETURN NEW;
    END IF;
    
    -- ========================================
    -- PERIPHERALS: Check connection and operational status
    -- ========================================
    IF NEW.connection_status IS NOT NULL OR NEW.print_status IS NOT NULL THEN
        -- Critical if disconnected or in error state
        IF NEW.connection_status = 'disconnected' 
           OR NEW.print_status IN ('offline', 'error', 'paper_jam') THEN
            NEW.health_status = 'critical';
            RETURN NEW;
        END IF;
        
        -- Warning if intermittent connection or low toner
        IF NEW.connection_status = 'intermittent' 
           OR NEW.print_status = 'low_toner' THEN
            NEW.health_status = 'warning';
            RETURN NEW;
        END IF;
        
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

CREATE TRIGGER set_health_status
    BEFORE INSERT OR UPDATE ON public.asset_metrics
    FOR EACH ROW
    EXECUTE FUNCTION determine_health_status();

-- ============================================
-- STEP 4: Add Sample Peripheral Assets
-- ============================================

-- Get the admin/operator user ID for created_by field
DO $$
DECLARE
  creator_id UUID;
BEGIN
  -- Get first admin or operator user
  SELECT id INTO creator_id 
  FROM public.profiles 
  WHERE role IN ('admin', 'operator') 
  LIMIT 1;
  
  IF creator_id IS NULL THEN
    RAISE NOTICE '⚠️ No admin/operator user found. Please create assets manually.';
    RETURN;
  END IF;
  
  -- Insert peripheral assets (using description field to indicate category)
  INSERT INTO public.assets (name, type, status, description, serial_number, location, purchase_date, warranty_expiry, cost, created_by)
  VALUES 
    ('HP LaserJet Pro M404dn', 'peripherals', 'active', 'Printer - Office laser printer for Floor 2', 'HP-LJ-M404-001', 'Floor 2 - Office 201', '2023-01-15', '2026-01-15', 35000.00, creator_id),
    ('Canon imageRUNNER', 'peripherals', 'active', 'Printer - Multi-function printer with scanner', 'CN-IR-001', 'Floor 3 - Copy Room', '2022-08-20', '2025-08-20', 85000.00, creator_id),
    ('Dell UltraSharp 27"', 'peripherals', 'active', 'Monitor - 4K monitor for design team', 'DL-US-27-001', 'Floor 1 - Desk 15', '2023-06-10', '2026-06-10', 45000.00, creator_id),
    ('LG 24" Monitor', 'peripherals', 'active', 'Monitor - Standard office monitor', 'LG-24-001', 'Floor 2 - Desk 22', '2023-03-05', '2026-03-05', 18000.00, creator_id),
    ('Logitech MX Keys', 'peripherals', 'active', 'Keyboard - Wireless keyboard for developers', 'LG-MXK-001', 'Floor 1 - Desk 8', '2023-09-12', '2025-09-12', 8500.00, creator_id),
    ('HP Wireless Mouse', 'peripherals', 'active', 'Mouse - Standard wireless mouse', 'HP-WM-001', 'Floor 2 - Desk 18', '2023-07-20', '2025-07-20', 1500.00, creator_id),
    ('Epson Document Scanner', 'peripherals', 'active', 'Scanner - High-speed document scanner', 'EP-DS-001', 'Floor 1 - Admin', '2022-11-30', '2025-11-30', 25000.00, creator_id),
    ('Jabra Conference Speaker', 'peripherals', 'active', 'Audio - Bluetooth conference speaker', 'JB-CS-001', 'Conference Room A', '2023-04-18', '2026-04-18', 15000.00, creator_id)
  ON CONFLICT DO NOTHING;
  
  RAISE NOTICE '✓ Created 8 peripheral assets';
END $$;

-- ============================================
-- STEP 5: Initialize Metrics for Peripheral Assets
-- ============================================

INSERT INTO public.asset_metrics (
    asset_id,
    connection_status,
    print_status,
    usage_hours,
    health_status
)
SELECT 
    id,
    'connected',
    CASE 
        WHEN description LIKE '%Printer%' THEN 'online'
        ELSE NULL
    END,
    RANDOM() * 1000, -- Random usage hours
    'healthy'
FROM public.assets
WHERE type = 'peripherals'
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '==================== PERIPHERAL ASSETS ====================' as info;

SELECT 
    a.name as "Asset Name",
    SUBSTRING(a.description FROM '^[^-]+') as "Category",
    a.location as "Location",
    a.status as "Status"
FROM public.assets a
WHERE a.type = 'peripherals'
ORDER BY a.description, a.name;

SELECT '==================== ASSET TYPE SUMMARY ====================' as info;

SELECT 
    type as "Asset Type",
    COUNT(*) as "Count"
FROM public.assets
GROUP BY type
ORDER BY type;

SELECT '✅ COMPLETE! Peripherals asset type has been added.' as info;
SELECT '✅ Added 8 sample peripheral assets (printers, monitors, keyboard, mouse, scanner, speaker).' as info;
SELECT '✅ Health status trigger updated to handle peripheral failures.' as info;
SELECT '✅ Simulator will now generate metrics for all peripheral assets.' as info;
