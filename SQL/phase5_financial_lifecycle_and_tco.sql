-- =============================================================================
-- IT Infrastructure Management System (ITIMS)
-- Phase 5: Financial Lifecycle, Total Cost of Ownership (TCO) & Depreciation
-- Engine: PostgreSQL 17 | Supabase Platform
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ADD FINANCIAL & DEPRECIATION FIELDS TO ASSETS
-- -----------------------------------------------------------------------------
ALTER TABLE public.assets 
    ADD COLUMN IF NOT EXISTS salvage_value NUMERIC(12, 2) DEFAULT 0.00 CHECK (salvage_value >= 0),
    ADD COLUMN IF NOT EXISTS useful_life_years INTEGER DEFAULT 5 CHECK (useful_life_years > 0),
    ADD COLUMN IF NOT EXISTS depreciation_method TEXT DEFAULT 'straight_line' CHECK (depreciation_method IN ('straight_line', 'double_declining', 'none'));

COMMENT ON COLUMN public.assets.salvage_value IS 'Estimated residual salvage value at end of useful life';
COMMENT ON COLUMN public.assets.useful_life_years IS 'Expected operational useful life in years';
COMMENT ON COLUMN public.assets.depreciation_method IS 'Accounting depreciation model (straight_line, double_declining, none)';


-- -----------------------------------------------------------------------------
-- 2. ADD MAINTENANCE EXPENDITURE COST TO INCIDENTS
-- -----------------------------------------------------------------------------
ALTER TABLE public.incidents
    ADD COLUMN IF NOT EXISTS maintenance_cost NUMERIC(12, 2) DEFAULT 0.00 CHECK (maintenance_cost >= 0);

COMMENT ON COLUMN public.incidents.maintenance_cost IS 'Direct repair cost (replacement hardware parts, vendor dispatch fee, contractor labor)';


-- -----------------------------------------------------------------------------
-- 3. STORED FUNCTION: CALCULATE ASSET FINANCIALS & TCO
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_asset_financials(target_asset_id UUID)
RETURNS TABLE (
    asset_id UUID,
    asset_name TEXT,
    asset_type TEXT,
    purchase_cost NUMERIC(12, 2),
    salvage_value NUMERIC(12, 2),
    useful_life_years INT,
    depreciation_method TEXT,
    purchase_date DATE,
    age_months NUMERIC(6, 1),
    age_years NUMERIC(5, 2),
    current_book_value NUMERIC(12, 2),
    accumulated_depreciation NUMERIC(12, 2),
    annual_depreciation NUMERIC(12, 2),
    maintenance_cost_total NUMERIC(12, 2),
    license_cost_total NUMERIC(12, 2),
    total_cost_of_ownership NUMERIC(12, 2)
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    a RECORD;
    v_age_days NUMERIC;
    v_age_years NUMERIC;
    v_age_months NUMERIC;
    v_cost NUMERIC(12, 2);
    v_salvage NUMERIC(12, 2);
    v_life INT;
    v_method TEXT;
    v_book_val NUMERIC(12, 2);
    v_accum_dep NUMERIC(12, 2);
    v_annual_dep NUMERIC(12, 2);
    v_maint_cost NUMERIC(12, 2);
    v_lic_cost NUMERIC(12, 2);
    v_tco NUMERIC(12, 2);
    v_rate NUMERIC;
BEGIN
    SELECT * INTO a FROM public.assets WHERE id = target_asset_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_cost := COALESCE(a.cost, 0.00);
    v_salvage := COALESCE(a.salvage_value, 0.00);
    v_life := COALESCE(a.useful_life_years, 5);
    v_method := COALESCE(a.depreciation_method, 'straight_line');

    -- Calculate Asset Age
    IF a.purchase_date IS NOT NULL THEN
        v_age_days := GREATEST(0, (CURRENT_DATE - a.purchase_date));
        v_age_years := ROUND(v_age_days / 365.25, 2);
        v_age_months := ROUND((v_age_days / 30.4375), 1);
    ELSE
        v_age_days := 0;
        v_age_years := 0.00;
        v_age_months := 0.0;
    END IF;

    -- Calculate Depreciation
    IF v_method = 'straight_line' AND v_cost > v_salvage AND v_life > 0 THEN
        v_annual_dep := ROUND((v_cost - v_salvage) / v_life, 2);
        v_accum_dep := LEAST(v_cost - v_salvage, ROUND(v_annual_dep * v_age_years, 2));
        v_book_val := GREATEST(v_salvage, v_cost - v_accum_dep);
    ELSIF v_method = 'double_declining' AND v_cost > v_salvage AND v_life > 0 THEN
        v_rate := 2.0 / v_life;
        v_book_val := GREATEST(v_salvage, ROUND(v_cost * POWER((1.0 - v_rate), v_age_years), 2));
        v_accum_dep := v_cost - v_book_val;
        v_annual_dep := ROUND(v_cost * v_rate, 2);
    ELSE
        -- 'none' or zero cost
        v_book_val := v_cost;
        v_accum_dep := 0.00;
        v_annual_dep := 0.00;
    END IF;

    -- Calculate Maintenance Expenditure (OpEx from Incidents)
    SELECT COALESCE(SUM(maintenance_cost), 0.00) INTO v_maint_cost
    FROM public.incidents
    WHERE asset_id = target_asset_id;

    -- Calculate Attached Software License Spend (if applicable)
    SELECT COALESCE(SUM(cost_per_seat * total_seats), 0.00) INTO v_lic_cost
    FROM public.software_licenses
    WHERE software_asset_id = target_asset_id;

    -- Total Cost of Ownership
    v_tco := v_cost + v_maint_cost + v_lic_cost;

    RETURN QUERY SELECT
        a.id AS asset_id,
        a.name AS asset_name,
        a.type AS asset_type,
        v_cost AS purchase_cost,
        v_salvage AS salvage_value,
        v_life AS useful_life_years,
        v_method AS depreciation_method,
        a.purchase_date,
        v_age_months AS age_months,
        v_age_years AS age_years,
        v_book_val AS current_book_value,
        v_accum_dep AS accumulated_depreciation,
        v_annual_dep AS annual_depreciation,
        v_maint_cost AS maintenance_cost_total,
        v_lic_cost AS license_cost_total,
        v_tco AS total_cost_of_ownership;
END;
$$;

COMMENT ON FUNCTION public.calculate_asset_financials(UUID) IS 'Calculates real-time depreciation, current book value, maintenance OpEx, and Total Cost of Ownership';


-- -----------------------------------------------------------------------------
-- 4. STORED FUNCTION: GET EXECUTIVE FINANCIAL SUMMARY
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_executive_financial_summary()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
    v_total_capex NUMERIC(14, 2) := 0.00;
    v_total_book_value NUMERIC(14, 2) := 0.00;
    v_total_accum_dep NUMERIC(14, 2) := 0.00;
    v_total_maint_opex NUMERIC(14, 2) := 0.00;
    v_total_lic_spend NUMERIC(14, 2) := 0.00;
    v_total_tco NUMERIC(14, 2) := 0.00;
    v_asset_count INT := 0;
    v_rec RECORD;
    v_by_type JSONB := '{}'::jsonb;
    v_by_dept JSONB := '{}'::jsonb;
BEGIN
    -- Iterate across all active assets and aggregate financials
    FOR v_rec IN (
        SELECT a.id, a.type, a.department_id, d.name AS dept_name
        FROM public.assets a
        LEFT JOIN public.departments d ON d.id = a.department_id
        WHERE a.is_active = true AND (a.deleted_at IS NULL)
    ) LOOP
        v_asset_count := v_asset_count + 1;
        
        -- Compute financials for this asset
        FOR a IN (SELECT * FROM public.calculate_asset_financials(v_rec.id)) LOOP
            v_total_capex := v_total_capex + a.purchase_cost;
            v_total_book_value := v_total_book_value + a.current_book_value;
            v_total_accum_dep := v_total_accum_dep + a.accumulated_depreciation;
            v_total_maint_opex := v_total_maint_opex + a.maintenance_cost_total;
            v_total_lic_spend := v_total_lic_spend + a.license_cost_total;
            v_total_tco := v_total_tco + a.total_cost_of_ownership;
        END LOOP;
    END LOOP;

    -- Aggregate totals by asset type
    SELECT jsonb_object_agg(
        sub.type,
        jsonb_build_object(
            'asset_count', sub.cnt,
            'total_cost', sub.total_cost,
            'total_maintenance', sub.total_maint
        )
    ) INTO v_by_type
    FROM (
        SELECT 
            a.type,
            COUNT(a.id) AS cnt,
            COALESCE(SUM(a.cost), 0.00) AS total_cost,
            COALESCE(SUM(i.maintenance_cost), 0.00) AS total_maint
        FROM public.assets a
        LEFT JOIN public.incidents i ON i.asset_id = a.id
        WHERE a.is_active = true AND a.deleted_at IS NULL
        GROUP BY a.type
    ) sub;

    RETURN jsonb_build_object(
        'overview', jsonb_build_object(
            'total_assets_tracked', v_asset_count,
            'total_capitalized_investment', v_total_capex,
            'total_current_book_value', v_total_book_value,
            'total_accumulated_depreciation', v_total_accum_dep,
            'total_maintenance_expenditure', v_total_maint_opex,
            'total_software_licensing_spend', v_total_lic_spend,
            'total_infrastructure_tco', v_total_tco,
            'overall_depreciation_percent', CASE WHEN v_total_capex > 0 THEN ROUND((v_total_accum_dep / v_total_capex) * 100, 2) ELSE 0.00 END
        ),
        'by_type', COALESCE(v_by_type, '{}'::jsonb)
    );
END;
$$;

COMMENT ON FUNCTION public.get_executive_financial_summary() IS 'Executive dashboard aggregation for CapEx investment, Net Book Value, maintenance OpEx, and TCO';

COMMIT;
