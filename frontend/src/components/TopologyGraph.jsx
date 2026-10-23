import { useState, useEffect, useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType
} from 'reactflow'
import 'reactflow/dist/style.css'
import TopologyNode from './TopologyNode'
import { API_BASE_URL } from '../config/api'

const nodeTypes = {
  custom: TopologyNode
}

// The graph canvas is an instrument surface, not a document surface — it stays
// dark on purpose, the way a map or an editor does. Declaring its own scale
// here (instead of borrowing slate utilities) is what makes that a decision
// rather than an accident. React Flow needs real colour values, not vars.
const CANVAS = {
  ground: '#0b0f19',
  grid:   '#1f2937',
  panel:  '#111827',
  line:   '#273244',
  text:   '#e5e9f0',
  soft:   '#aab4c5',
  brand:  '#8b5cf6',
  info:   '#38bdf8',
  danger: '#f43f5e',
}

// The loading and empty states render instead of the canvas, so they carry
// their own copy of the shell treatment.
const FALLBACK_CSS = `
  .topo-fallback {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 11px;
    border-radius: 16px;
    background: ${CANVAS.ground};
    border: 1px solid var(--line);
  }
`

export default function TopologyGraph({ assetId, onNodeClick }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [loading, setLoading] = useState(true)
  const [blastData, setBlastData] = useState(null)
  const [simulateOutage, setSimulateOutage] = useState(false)

  const fetchTopology = useCallback(async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('flask_jwt_token')
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const res = await fetch(`${API_BASE_URL}/assets/${assetId}/topology`, { headers })
      if (res.ok) {
        const data = await res.json()

        const formattedEdges = (data.edges || []).map(edge => ({
          ...edge,
          type: 'smoothstep',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: edge.style?.stroke || CANVAS.brand
          },
          labelStyle: {
            fill: CANVAS.soft,
            fontSize: 10,
            fontWeight: 600
          },
          labelBgStyle: {
            fill: CANVAS.ground,
            fillOpacity: 0.9,
            rx: 6,
            ry: 6
          }
        }))

        setNodes(data.nodes || [])
        setEdges(formattedEdges)
        setBlastData(data.blast_radius)
      }
    } catch (err) {
      console.error('Failed to fetch topology:', err)
    } finally {
      setLoading(false)
    }
  }, [assetId, setNodes, setEdges])

  useEffect(() => {
    if (assetId) {
      fetchTopology()
    }
  }, [assetId, fetchTopology])

  // Toggle simulate outage view
  const displayNodes = useMemo(() => {
    if (!simulateOutage || !blastData) return nodes

    // Map impacted node IDs
    const impactedMap = new Map()
    for (const item of blastData.impacted_assets || []) {
      impactedMap.set(item.asset_id, item)
    }

    return nodes.map(n => {
      if (impactedMap.has(n.id)) {
        const impact = impactedMap.get(n.id)
        return {
          ...n,
          data: {
            ...n.data,
            impactLevel: impact.impact_level,
            depth: impact.depth
          }
        }
      }
      return n
    })
  }, [nodes, simulateOutage, blastData])

  // Every edge used to march its dashes forever. Constant motion the user
  // cannot switch off is noise; the march now runs only while an outage is
  // being simulated, where it reads as failure propagating downstream.
  const displayEdges = useMemo(
    () => edges.map(e => ({ ...e, animated: simulateOutage })),
    [edges, simulateOutage]
  )

  if (loading) {
    return (
      <div className="topo-fallback" style={{ height: 420 }}>
        <span
          className="animate-spin-fast rounded-full"
          style={{ width: 26, height: 26, border: `2px solid ${CANVAS.line}`, borderTopColor: CANVAS.brand }}
        />
        <span className="text-[12.5px]" style={{ color: CANVAS.soft }}>Resolving dependency graph…</span>
        <style>{FALLBACK_CSS}</style>
      </div>
    )
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="topo-fallback" style={{ height: 320, padding: 24, textAlign: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={CANVAS.soft} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="5" r="2.5" /><circle cx="5" cy="19" r="2.5" /><circle cx="19" cy="19" r="2.5" />
          <path d="M12 7.5v4M12 11.5L6.6 16.8M12 11.5l5.4 5.3" />
        </svg>
        <h4 className="text-[14px] font-semibold m-0" style={{ color: CANVAS.text }}>No dependencies mapped</h4>
        <p className="text-[12px] m-0 max-w-md" style={{ color: CANVAS.soft }}>
          This asset is isolated. Link it to parent hosts, switches or downstream services to see what an outage
          here would take with it.
        </p>
        <style>{FALLBACK_CSS}</style>
      </div>
    )
  }

  return (
    <div className="topo-shell">
      <div className="topo-bar">
        <div className="flex items-center gap-2 text-[11.5px] font-semibold" style={{ color: CANVAS.text }}>
          <span className="tnum">{nodes.length} nodes</span>
          <span style={{ color: CANVAS.line }} aria-hidden="true">·</span>
          <span className="tnum">{edges.length} dependencies</span>
        </div>

        <button
          type="button"
          onClick={() => setSimulateOutage(!simulateOutage)}
          className="topo-btn"
          data-on={simulateOutage}
          aria-pressed={simulateOutage}
        >
          {simulateOutage ? 'Stop simulation' : 'Simulate outage'}
        </button>
      </div>

      {simulateOutage && blastData && (
        <div className="topo-blast" role="status">
          <div className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: CANVAS.danger }}>
            Blast radius — {blastData.summary?.total_impacted ?? 0} downstream assets
          </div>
          <div className="text-[11px] mt-0.5" style={{ color: CANVAS.soft }}>
            Risk {blastData.risk_level || 'unknown'} · {blastData.summary?.direct_impact ?? 0} direct
            {' · '}{blastData.summary?.secondary_impact ?? 0} secondary
          </div>
        </div>
      )}

      <div style={{ height: 460, width: '100%' }}>
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(evt, node) => onNodeClick && onNodeClick(node.id)}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color={CANVAS.grid} gap={20} size={1} />
          <Controls className="topo-controls" />
          <MiniMap
            className="topo-minimap"
            maskColor="rgba(11, 15, 25, 0.7)"
            nodeColor={node => {
              if (node.data?.isRoot) return CANVAS.brand
              if (node.data?.impactLevel) return CANVAS.danger
              return CANVAS.info
            }}
          />
        </ReactFlow>
      </div>

      <style>{`
        .topo-shell {
          position: relative;
          width: 100%;
          border-radius: 16px;
          overflow: hidden;
          background: ${CANVAS.ground};
          border: 1px solid var(--line);
        }

        .topo-bar {
          position: absolute; top: 14px; left: 14px; z-index: 10;
          display: flex; align-items: center; gap: 12px;
          padding: 7px 11px;
          border-radius: 11px;
          background: rgba(17, 24, 39, 0.9);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          border: 1px solid ${CANVAS.line};
        }

        .topo-btn {
          padding: 4px 10px;
          border-radius: 8px;
          font-size: 11.5px; font-weight: 600;
          cursor: pointer;
          color: ${CANVAS.text};
          background: ${CANVAS.panel};
          border: 1px solid ${CANVAS.line};
          transition:
            transform var(--t-press) var(--ease-out),
            background-color var(--t-press) var(--ease-out),
            border-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .topo-btn:hover { border-color: ${CANVAS.soft}; }
        }
        /* Every pressable gets press feedback — this one had none. */
        .topo-btn:active { transform: scale(0.97); }
        .topo-btn[data-on='true'] {
          color: #fff;
          background: ${CANVAS.danger};
          border-color: ${CANVAS.danger};
        }

        .topo-blast {
          position: absolute; top: 14px; right: 14px; z-index: 10;
          padding: 8px 13px;
          border-radius: 11px;
          background: rgba(24, 10, 16, 0.92);
          -webkit-backdrop-filter: blur(8px);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(244, 63, 94, 0.45);
          opacity: 1;
          transform: translateY(0);
          transition:
            opacity var(--t-pop) var(--ease-out),
            transform var(--t-pop) var(--ease-out);
        }
        @starting-style {
          .topo-blast { opacity: 0; transform: translateY(-5px); }
        }

        .topo-fallback {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 11px;
          border-radius: 16px;
          background: ${CANVAS.ground};
          border: 1px solid var(--line);
        }

        /* ── Nodes (rendered by TopologyNode) ──────────────────────────
           Defined here so the rules exist once, not once per node. */
        .topo-shell .topo-node {
          position: relative;
          min-width: 200px; max-width: 260px;
          padding: 11px 13px;
          border-radius: 12px;
          background: ${CANVAS.panel};
          border: 1px solid ${CANVAS.line};
          /* Only border and shadow transition — React Flow owns transform
             on the wrapper, and animating it here would fight dragging. */
          transition:
            border-color var(--t-press) var(--ease-out),
            box-shadow var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .topo-shell .topo-node:hover { border-color: ${CANVAS.soft}; }
        }
        .topo-shell .topo-node[data-root='true'] {
          border-color: ${CANVAS.brand};
          box-shadow: 0 0 0 1px ${CANVAS.brand};
        }
        .topo-shell .topo-node[data-selected] {
          border-color: ${CANVAS.info};
          box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.4);
        }
        /* Impact severity steps down in ring weight, so three levels are
           distinguishable without three near-identical yellows. */
        .topo-shell .topo-node[data-impact='DIRECT_IMPACT'] {
          border-color: ${CANVAS.danger};
          box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.55);
        }
        .topo-shell .topo-node[data-impact='SECONDARY_IMPACT'] {
          border-color: #f59e0b;
          box-shadow: 0 0 0 1.5px rgba(245, 158, 11, 0.4);
        }
        .topo-shell .topo-node[data-impact='TERTIARY_IMPACT'] {
          border-color: #a16207;
          box-shadow: 0 0 0 1px rgba(161, 98, 7, 0.4);
        }

        .topo-shell .topo-glyph { flex-shrink: 0; color: ${CANVAS.info}; }
        .topo-shell .topo-node[data-root='true'] .topo-glyph { color: ${CANVAS.brand}; }

        .topo-shell .topo-type {
          font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${CANVAS.soft};
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .topo-shell .topo-tag {
          flex-shrink: 0;
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 9px; font-weight: 700; letter-spacing: 0.07em;
          text-transform: uppercase;
        }
        .topo-shell .topo-tag[data-kind='root'] {
          color: #d8b4fe;
          background: rgba(139, 92, 246, 0.22);
          border: 1px solid rgba(139, 92, 246, 0.45);
        }
        .topo-shell .topo-tag[data-kind='impact'] {
          color: #fda4af;
          background: rgba(244, 63, 94, 0.22);
          border: 1px solid rgba(244, 63, 94, 0.45);
        }

        .topo-shell .topo-label {
          margin-bottom: 8px;
          font-size: 13px; font-weight: 600; letter-spacing: -0.01em;
          color: ${CANVAS.text};
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .topo-shell .topo-foot {
          display: flex; align-items: center; justify-content: space-between; gap: 8px;
          padding-top: 7px;
          border-top: 1px solid ${CANVAS.line};
        }

        .topo-shell .topo-status {
          padding: 2px 7px;
          border-radius: 6px;
          font-size: 10px; font-weight: 600;
          text-transform: capitalize;
          color: ${CANVAS.soft};
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid ${CANVAS.line};
        }
        .topo-shell .topo-status[data-status='active'],
        .topo-shell .topo-status[data-status='in_use'] {
          color: #6ee7b7; background: rgba(16, 185, 129, 0.16); border-color: rgba(16, 185, 129, 0.35);
        }
        .topo-shell .topo-status[data-status='maintenance'] {
          color: #fcd34d; background: rgba(245, 158, 11, 0.16); border-color: rgba(245, 158, 11, 0.35);
        }
        .topo-shell .topo-status[data-status='damaged'] {
          color: #fda4af; background: rgba(244, 63, 94, 0.16); border-color: rgba(244, 63, 94, 0.35);
        }

        .topo-shell .topo-depth {
          font-family: 'JetBrains Mono', ui-monospace, monospace;
          font-size: 10px;
          font-variant-numeric: tabular-nums;
          color: ${CANVAS.soft};
        }

        .topo-shell .topo-handle {
          width: 9px !important; height: 9px !important;
          background: ${CANVAS.info} !important;
          border: 2px solid ${CANVAS.ground} !important;
        }
        .topo-shell .topo-handle[data-kind='source'] { background: ${CANVAS.brand} !important; }

        /* ── React Flow chrome ─────────────────────────────────────── */
        .topo-shell .topo-controls button {
          background: ${CANVAS.panel} !important;
          border-color: ${CANVAS.line} !important;
          fill: ${CANVAS.soft} !important;
          transition: background-color var(--t-press) var(--ease-out);
        }
        @media (hover: hover) and (pointer: fine) {
          .topo-shell .topo-controls button:hover { background: #1b2334 !important; }
        }
        .topo-shell .topo-controls button:active { transform: scale(0.94); }

        .topo-shell .topo-minimap {
          background: ${CANVAS.panel} !important;
          border: 1px solid ${CANVAS.line} !important;
          border-radius: 10px;
          overflow: hidden;
        }

        @media (prefers-reduced-motion: reduce) {
          .topo-blast { transition-duration: 1ms; }
        }
      `}</style>
    </div>
  )
}
