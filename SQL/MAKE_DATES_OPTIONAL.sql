-- ============================================
-- MAKE PURCHASE DATE AND WARRANTY OPTIONAL
-- ============================================
-- This script removes the NOT NULL constraint from purchase_date and warranty_expiry columns
-- Making these fields optional when creating/updating assets

-- Check current table structure
-- SELECT column_name, is_nullable, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'assets' AND column_name IN ('purchase_date', 'warranty_expiry');

-- Make purchase_date nullable (optional)
ALTER TABLE public.assets 
ALTER COLUMN purchase_date DROP NOT NULL;

-- Make warranty_expiry nullable (optional)
ALTER TABLE public.assets 
ALTER COLUMN warranty_expiry DROP NOT NULL;

-- Verify the changes
SELECT column_name, is_nullable, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'assets' 
AND column_name IN ('purchase_date', 'warranty_expiry')
ORDER BY column_name;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Successfully made purchase_date and warranty_expiry optional!';
    RAISE NOTICE 'You can now create assets without providing these dates.';
END $$;
