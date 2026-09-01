import { memo } from 'react'
import { Handle, Position } from 'reactflow'

const TYPE_ICONS = {
  hardware: '🖥️',
  software: '💻',
  network: '🌐',
  infrastructure: '☁️',
  peripherals: '🖨️'
}

const STATUS_COLORS = {
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
  in_use: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  maintenance: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  damaged: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
  retired: 'bg-gray-500/20 text-gray-400 border-gray-500/40'
}

const IMPACT_COLORS = {
  DIRECT_IMPACT: 'ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)] border-rose-500',
  SECONDARY_IMPACT: 'ring-2 ring-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)] border-amber-500',
  TERTIARY_IMPACT: 'ring-2 ring-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)] border-yellow-500'
}

function TopologyNode({ data, selected }) {
  const isRoot = data.isRoot
  const impactClass = data.impactLevel ? IMPACT_COLORS[data.impactLevel] || '' : ''
  const statusClass = STATUS_COLORS[data.status] || STATUS_COLORS.active
  const icon = TYPE_ICONS[data.type] || '📦'

  return (
    <div
      className={`relative min-w-[200px] max-w-[260px] rounded-xl px-4 py-3 border transition-all duration-300 font-sans ${
        isRoot
          ? 'bg-slate-900/95 border-purple-500/80 shadow-[0_0_25px_rgba(168,85,247,0.35)] ring-2 ring-purple-500/60'
          : 'bg-slate-900/90 border-slate-700/70 hover:border-slate-500 shadow-lg'
      } ${impactClass} ${selected ? 'ring-2 ring-cyan-400' : ''}`}
    >
      {/* Target connection point (top) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2.5 !h-2.5 !bg-cyan-400 !border-slate-900"
      />

      {/* Header with Type Icon & Role Badge */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-base leading-none">{icon}</span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {data.type}
          </span>
        </div>
        {isRoot && (
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-purple-500/25 text-purple-300 border border-purple-500/40">
            Root Asset
          </span>
        )}
        {data.impactLevel && !isRoot && (
          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-full bg-rose-500/25 text-rose-300 border border-rose-500/40 animate-pulse">
            Impacted
          </span>
        )}
      </div>

      {/* Asset Label / Name */}
      <div className="text-sm font-semibold text-white tracking-tight truncate mb-2">
        {data.label}
      </div>

      {/* Status & Role Footer */}
      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-800/80">
        <span className={`px-2 py-0.5 text-[10px] font-medium rounded-md border ${statusClass}`}>
          {data.status}
        </span>
        {data.depth && (
          <span className="text-[10px] text-slate-400 font-mono">
            Depth {data.depth}
          </span>
        )}
      </div>

      {/* Source connection point (bottom) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2.5 !h-2.5 !bg-purple-400 !border-slate-900"
      />
    </div>
  )
}

export default memo(TopologyNode)
