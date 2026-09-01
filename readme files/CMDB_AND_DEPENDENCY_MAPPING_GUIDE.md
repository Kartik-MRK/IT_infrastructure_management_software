# 🌐 CMDB & Dependency Mapping (Graph Topology + Blast Radius) Guide

## Overview

This guide explains the architecture, database modeling, recursive graph calculation algorithms, and frontend visual components for the **Configuration Management Database (CMDB) & Dependency Mapping** module in the IT Infrastructure Management System (ITIMS).

---

## 🎯 The Enterprise Problem & Solution

In modern enterprise architectures, IT assets do not exist in isolation:
- A physical server hosts multiple virtual machines and databases.
- Databases support mission-critical APIs and web portals.
- Network switches interconnect entire server racks.

**The Problem**: If a core switch or host hypervisor fails or is taken down for maintenance, operators without a CMDB cannot tell which customer-facing business services will go down.

**The Solution**: A unified graph dependency model in PostgreSQL 17 with sub-millisecond **Recursive CTE Blast Radius calculations** and an interactive **React Flow Topology Graph**.

---

## 🏗️ 1. Native PostgreSQL Graph Schema

Rather than running a separate, costly Neo4j database, all dependency edges are managed in PostgreSQL with full ACID guarantees:

### `public.asset_relationships` Table:
```sql
CREATE TABLE IF NOT EXISTS public.asset_relationships (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_asset_id   UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    child_asset_id    UUID        NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
    relationship_type TEXT        NOT NULL CHECK (relationship_type IN ('hosts', 'connects_to', 'depends_on', 'backs_up')),
    description       TEXT,
    created_by        UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT uq_asset_relationship UNIQUE (parent_asset_id, child_asset_id, relationship_type),
    CONSTRAINT ck_no_self_loop CHECK (parent_asset_id <> child_asset_id)
);
```

### Relationship Types & Semantics:
| Relationship Type | Description | Example | Downstream Outage Consequence |
| :--- | :--- | :--- | :--- |
| `hosts` | Parent physically/virtually runs Child | `Dell PowerEdge` ➔ `PostgreSQL DB` | If Parent fails, Child immediately dies. |
| `connects_to` | Network/port connectivity | `Cisco Switch` ➔ `App Server` | If Switch fails, Server loses network connectivity. |
| `depends_on` | Upstream service dependency | `Billing API` ➔ `Payment Gateway` | If Target fails, Caller cannot complete transactions. |
| `backs_up` | Redundant failover or backup | `Storage SAN` ➔ `Backup Appliance` | If Primary fails, redundancy is lost. |

---

## ⚡ 2. Sub-millisecond Recursive CTE: Blast Radius Calculation

When an asset fails or enters scheduled maintenance, PostgreSQL automatically calculates all cascading downstream affected services using a recursive Common Table Expression (CTE) with cycle prevention:

```sql
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
      -- Cycle Prevention: Do not revisit any asset already in traversal path
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
```

---

## 📡 3. REST API Endpoints

| HTTP Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/assets/<asset_id>/relationships` | Fetch direct upstream and downstream dependencies |
| `POST` | `/api/assets/<asset_id>/relationships` | Map a new dependency edge |
| `DELETE` | `/api/assets/relationships/<relationship_id>` | Remove a dependency edge |
| `GET` | `/api/assets/<asset_id>/blast-radius` | Compute downstream blast radius with risk scoring |
| `GET` | `/api/assets/<asset_id>/topology` | Return React Flow-ready `{ nodes, edges, blast_radius }` |
| `GET` | `/api/assets/topology` | Return global infrastructure graph |

---

## 🎨 4. Frontend Visual Components (React Flow)

- **`TopologyGraph.jsx`**: High-performance node-link canvas with smoothstep bezier connections, zoom, pan, and minimap.
- **`TopologyNode.jsx`**: Custom node rendering asset type icons, operational status indicators, and pulsing blast radius outlines.
- **⚡ Simulate Outage Mode**: An interactive button that instantly models downtime, highlights cascading downstream nodes in red, and presents an impact severity banner (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`).
- **`AddRelationshipModal.jsx`**: Modal for authorized operators to map dependencies with direction control (`This Asset ➔ Target` vs `Target ➔ This Asset`).
