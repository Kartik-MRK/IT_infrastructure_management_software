import React, { useState, useEffect, useCallback, useMemo } from 'react'
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

const nodeTypes = {
  custom: TopologyNode
}

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
      
      const res = await fetch(`http://localhost:5000/api/assets/${assetId}/topology`, { headers })
      if (res.ok) {
        const data = await res.json()
        
        // Format edges with smooth curves, styling, and arrow markers
        const formattedEdges = (data.edges || []).map(edge => ({
          ...edge,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 14,
            height: 14,
            color: edge.style?.stroke || '#a855f7'
          },
          labelStyle: {
            fill: '#cbd5e1',
            fontSize: 10,
            fontFamily: 'Space Grotesk, sans-serif',
            fontWeight: 600
          },
          labelBgStyle: {
            fill: '#0f172a',
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

  if (loading) {
    return (
      <div className="h-[420px] flex items-center justify-center bg-slate-950/80 rounded-2xl border border-slate-800">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-space text-slate-400">Loading Topology Graph...</span>
        </div>
      </div>
    )
  }

  if (!nodes || nodes.length === 0) {
    return (
      <div className="h-[320px] flex flex-col items-center justify-center bg-slate-950/60 rounded-2xl border border-slate-800/80 p-6 text-center">
        <span className="text-4xl mb-3">🕸️</span>
        <h4 className="text-base font-semibold text-slate-200 font-space">No Dependencies Mapped Yet</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-md">
          This asset is currently isolated. Connect it to parent hosts, network switches, or downstream microservices to visualize the architectural blast radius.
        </p>
      </div>
    )
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl font-space">
      {/* Controls Bar Header */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-2 text-xs text-slate-300 font-semibold">
          <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span>{nodes.length} Nodes</span>
          <span className="text-slate-600">•</span>
          <span>{edges.length} Dependencies</span>
        </div>

        <button
          onClick={() => setSimulateOutage(!simulateOutage)}
          className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
            simulateOutage
              ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-[0_0_15px_rgba(244,63,94,0.4)]'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <span>{simulateOutage ? '💥 Simulating Failure' : '⚡ Simulate Outage'}</span>
        </button>
      </div>

      {/* Outage Simulation Banner */}
      {simulateOutage && blastData && (
        <div className="absolute top-4 right-4 z-10 bg-rose-950/90 backdrop-blur-md border border-rose-500/50 px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
              Blast Radius: {blastData.summary.total_impacted} Downstream Assets
            </div>
            <div className="text-[11px] text-rose-200/80">
              Risk Level: <span className="font-bold underline">{blastData.risk_level}</span> ({blastData.summary.direct_impact} Direct, {blastData.summary.secondary_impact} Secondary)
            </div>
          </div>
        </div>
      )}

      {/* React Flow Canvas */}
      <div className="h-[460px] w-full">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={(evt, node) => onNodeClick && onNodeClick(node.id)}
          fitView
          attributionPosition="bottom-left"
        >
          <Background color="#334155" gap={20} size={1} />
          <Controls className="!bg-slate-900 !border-slate-800 !fill-slate-300 [&>button]:!border-slate-800 [&>button:hover]:!bg-slate-800" />
          <MiniMap
            nodeColor={node => {
              if (node.data?.isRoot) return '#a855f7'
              if (node.data?.impactLevel) return '#f43f5e'
              return '#38bdf8'
            }}
            className="!bg-slate-900/90 !border-slate-800 rounded-xl overflow-hidden"
          />
        </ReactFlow>
      </div>
    </div>
  )
}
