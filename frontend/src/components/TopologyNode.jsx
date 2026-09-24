import { memo } from 'react'
import { Handle, Position } from 'reactflow'

// Emoji rendered at a different size and baseline on every OS, which made a
// row of nodes look misaligned. Stroke icons inherit currentColor and size.
const TYPE_ICONS = {
  hardware: (
    <><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></>
  ),
  software: (
    <><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></>
  ),
  network: (
    <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></>
  ),
  infrastructure: (
    <><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" /></>
  ),
  peripherals: (
    <><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>
  ),
}

const FALLBACK_ICON = (
  <><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></>
)

function TopologyNode({ data, selected }) {
  const isRoot = !!data.isRoot
  const glyph = TYPE_ICONS[data.type] || FALLBACK_ICON

  return (
    /* Styles for this node live in TopologyGraph's single <style> block —
       a scoped block here would be duplicated once per node on the canvas. */
    <div
      className="topo-node"
      data-root={isRoot}
      data-impact={!isRoot && data.impactLevel ? data.impactLevel : undefined}
      data-selected={selected || undefined}
    >
      <Handle type="target" position={Position.Top} className="topo-handle" />

      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <svg className="topo-glyph" width="13" height="13" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {glyph}
          </svg>
          <span className="topo-type">{data.type}</span>
        </div>

        {isRoot && <span className="topo-tag" data-kind="root">Root</span>}
        {/* Was animate-pulse. Thirty nodes throbbing out of phase made the
            canvas unreadable — the ring and the tag already say "impacted". */}
        {data.impactLevel && !isRoot && <span className="topo-tag" data-kind="impact">Impacted</span>}
      </div>

      <div className="topo-label">{data.label}</div>

      <div className="topo-foot">
        <span className="topo-status" data-status={data.status || 'active'}>
          {(data.status || 'active').replace(/_/g, ' ')}
        </span>
        {data.depth != null && <span className="topo-depth">Depth {data.depth}</span>}
      </div>

      <Handle type="source" position={Position.Bottom} className="topo-handle" data-kind="source" />
    </div>
  )
}

export default memo(TopologyNode)
