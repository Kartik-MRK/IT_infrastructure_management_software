-- =============================================================================
-- IT Infrastructure Management System (ITIMS)
-- Phase 3: Configuration Management Database (CMDB) & Dependency Mapping
-- Engine: PostgreSQL 17 | Supabase Platform
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. ASSET RELATIONSHIPS TABLE (Graph Dependency Model)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.asset_relationships (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_asset_id   UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    child_asset_id    UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    relationship_type TEXT        NOT NULL CHECK (relationship_type IN ('hosts', 'connects_to', 'depends_on', 'backs_up')),
    description       TEXT,
    created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Prevent duplicate edges of the same type between the same assets
    CONSTRAINT uq_asset_relationship UNIQUE (parent_asset_id, child_asset_id, relationship_type),
    
    -- Prevent self-referencing loops
    CONSTRAINT ck_no_self_loop CHECK (parent_asset_id <> child_asset_id)
);

COMMENT ON TABLE public.asset_relationships IS 'Graph edges representing architectural dependencies and connections between IT assets';

-- Performance indexes for fast bidirectional graph traversal
CREATE INDEX IF NOT EXISTS idx_asset_rel_parent ON public.asset_relationships (parent_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_child ON public.asset_relationships (child_asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_rel_type ON public.asset_relationships (relationship_type);
CREATE INDEX IF NOT EXISTS idx_asset_rel_composite ON public.asset_relationships (parent_asset_id, child_asset_id);


-- -----------------------------------------------------------------------------
-- 2. POSTGRESQL RECURSIVE CTE: BLAST RADIUS CALCULATION
-- Calculates all downstream services and assets that will be impacted
-- if a specific root asset fails or enters maintenance.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_blast_radius(root_asset_id UUID, max_depth INT DEFAULT 5)
RETURNS TABLE (
    asset_id UUID,
    asset_name TEXT,
    asset_type TEXT,
    asset_status TEXT,
    depth INT,
    impact_level TEXT,
    relationship_type TEXT,
    path UUID[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
WITH RECURSIVE downstream_graph AS (
    -- Anchor Member: Immediate direct dependencies
    SELECT 
        CASE 
            WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
            WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
            ELSE r.child_asset_id
        END AS target_asset_id,
        1 AS depth,
        r.relationship_type,
        ARRAY[root_asset_id, 
            CASE 
                WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
                WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
                ELSE r.child_asset_id
            END
        ] AS path
    FROM public.asset_relationships r
    WHERE (
        (r.relationship_type IN ('hosts', 'connects_to') AND r.parent_asset_id = root_asset_id)
        OR (r.relationship_type = 'depends_on' AND r.child_asset_id = root_asset_id)
    )

    UNION ALL

    -- Recursive Member: Cascading downstream impact
    SELECT 
        CASE 
            WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
            WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
            ELSE r.child_asset_id
        END AS target_asset_id,
        dg.depth + 1,
        r.relationship_type,
        dg.path || CASE 
            WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
            WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
            ELSE r.child_asset_id
        END
    FROM public.asset_relationships r
    JOIN downstream_graph dg ON (
        (r.relationship_type IN ('hosts', 'connects_to') AND r.parent_asset_id = dg.target_asset_id)
        OR (r.relationship_type = 'depends_on' AND r.child_asset_id = dg.target_asset_id)
    )
    WHERE dg.depth < max_depth
      -- Cycle Prevention: Do not revisit any asset already in the current traversal path
      AND NOT (
          CASE 
              WHEN r.relationship_type IN ('hosts', 'connects_to') THEN r.child_asset_id
              WHEN r.relationship_type = 'depends_on' THEN r.parent_asset_id
              ELSE r.child_asset_id
          END = ANY(dg.path)
      )
)
SELECT DISTINCT ON (a.id)
    a.id AS asset_id,
    a.name AS asset_name,
    a.type AS asset_type,
    a.status AS asset_status,
    dg.depth,
    CASE 
        WHEN dg.depth = 1 THEN 'DIRECT_IMPACT'
        WHEN dg.depth = 2 THEN 'SECONDARY_IMPACT'
        ELSE 'TERTIARY_IMPACT'
    END AS impact_level,
    dg.relationship_type,
    dg.path
FROM downstream_graph dg
JOIN public.assets a ON a.id = dg.target_asset_id
ORDER BY a.id, dg.depth ASC;
$$;

COMMENT ON FUNCTION public.calculate_blast_radius(UUID, INT) IS 'Calculates downstream cascading outage impact using recursive graph traversal in PostgreSQL';


-- -----------------------------------------------------------------------------
-- 3. AUDIT TRIGGER ON ASSET RELATIONSHIPS
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_audit_asset_relationships ON public.asset_relationships;
CREATE TRIGGER trg_audit_asset_relationships
    AFTER INSERT OR UPDATE OR DELETE ON public.asset_relationships
    FOR EACH ROW EXECUTE FUNCTION public.log_table_changes();


-- -----------------------------------------------------------------------------
-- 4. ROW-LEVEL SECURITY (RLS) FOR ASSET RELATIONSHIPS
-- -----------------------------------------------------------------------------
ALTER TABLE public.asset_relationships ENABLE ROW LEVEL SECURITY;

-- Everyone authenticated can view asset relationships
DROP POLICY IF EXISTS "View asset relationships policy" ON public.asset_relationships;
CREATE POLICY "View asset relationships policy"
    ON public.asset_relationships FOR SELECT
    TO authenticated
    USING (true);

-- Users with assets:update or assets:create can create relationships
DROP POLICY IF EXISTS "Create asset relationships policy" ON public.asset_relationships;
CREATE POLICY "Create asset relationships policy"
    ON public.asset_relationships FOR INSERT
    TO authenticated
    WITH CHECK (
        public.has_permission('assets:update')
        OR public.has_permission('assets:create')
    );

-- Users with assets:update or assets:delete can delete relationships
DROP POLICY IF EXISTS "Delete asset relationships policy" ON public.asset_relationships;
CREATE POLICY "Delete asset relationships policy"
    ON public.asset_relationships FOR DELETE
    TO authenticated
    USING (
        public.has_permission('assets:delete')
        OR public.has_permission('assets:update')
    );

COMMIT;
