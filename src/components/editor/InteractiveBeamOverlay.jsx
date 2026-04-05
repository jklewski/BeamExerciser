import { useRef, useState, useEffect } from 'react'
import { computeBeamLayout } from '../../utils/beamLayout.js'

const SUPPORT_CYCLE    = ['pin', 'roller', 'fixed', 'free']
const SUPPORT_CYCLE_NO_H = ['roller', 'free']

function restrainsH(type) { return type === 'pin' || type === 'fixed' }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)) }

function snapToGrid(frac, numGridCells) {
  return Math.round(frac * numGridCells) / numGridCells
}

// Format a beam fraction as a metre position label, e.g. 0.4 on a 6m beam → "2.4"
function fmtPos(frac, L) {
  const m = frac * L
  return m % 1 === 0 ? `${m}` : m.toFixed(1)
}

export default function InteractiveBeamOverlay({
  beamState,
  selectedId,
  onSelectLoad,
  onLoadChange,
  onSupportChange,
  onInnerSupportMove,
  onInnerSupportRemove,
  onBeamChange,
}) {
  const svgRef = useRef(null)
  const [dragging, setDragging] = useState(null)

  const {
    loads = [],
    supports = {},
    showDimension = true,
    intermediateSupports = [],
    numGridCells = 10,
    L = 6,
  } = beamState

  const layout = computeBeamLayout({ loads, supports, showDimension })
  const { W, x0, x1, beamLen, beamH, beamTop, beamBot, loadAreaTop,
          udlLoads, pointLoads, H, rowH, rowGap, udlTop } = layout

  function clientXToSnappedFrac(clientX) {
    const rect = svgRef.current.getBoundingClientRect()
    const svgX = (clientX - rect.left) / rect.width * W
    return snapToGrid(clamp((svgX - x0) / beamLen, 0, 1), numGridCells)
  }

  useEffect(() => {
    if (!dragging) return

    function onMove(e) {
      const frac = clientXToSnappedFrac(e.clientX)
      if (dragging.type === 'load') {
        const load = loads.find(l => l.id === dragging.loadId)
        if (!load) return
        if (dragging.handle === 'x') {
          onLoadChange(dragging.loadId, { x: frac })
        } else if (dragging.handle === 'xStart') {
          onLoadChange(dragging.loadId, { xStart: Math.min(frac, (load.xEnd ?? 1) - 1 / numGridCells) })
        } else if (dragging.handle === 'xEnd') {
          onLoadChange(dragging.loadId, { xEnd: Math.max(frac, (load.xStart ?? 0) + 1 / numGridCells) })
        }
      } else if (dragging.type === 'isup') {
        onInnerSupportMove(dragging.isupId, frac)
      } else if (dragging.type === 'beam-end') {
        const rect = svgRef.current.getBoundingClientRect()
        const svgX = (e.clientX - rect.left) / rect.width * W
        const newL = Math.round(Math.max(0.5, Math.min(30, (svgX - x0) / dragging.beamScale)) * 2) / 2
        onBeamChange({ L: newL })
      }
    }

    function onUp() { setDragging(null) }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, loads, numGridCells, onLoadChange, onInnerSupportMove])

  function startLoadDrag(e, loadId, handle) {
    e.stopPropagation()
    onSelectLoad(loadId)
    setDragging({ type: 'load', loadId, handle })
  }

  function startIsupDrag(e, isupId) {
    e.stopPropagation()
    onSelectLoad(isupId)
    setDragging({ type: 'isup', isupId })
  }

  function startBeamEndDrag(e) {
    e.stopPropagation()
    onSelectLoad(null)
    setDragging({ type: 'beam-end', beamScale: beamLen / L })
  }

  function cycleSupport(side) {
    const otherType = supports[side === 'left' ? 'right' : 'left'] ?? 'roller'
    const cycle = (side === 'left' && restrainsH(otherType)) ? SUPPORT_CYCLE_NO_H : SUPPORT_CYCLE
    const current = supports[side] ?? (side === 'left' ? 'pin' : 'roller')
    const idx = cycle.indexOf(current)
    onSupportChange(side, cycle[(idx === -1 ? 0 : idx + 1) % cycle.length])
  }

  // Handle circle radius — large enough to fit a short position label inside
  const handleR  = 11
  const hitW     = handleR * 2 + 2
  const supZoneH = 50
  const supZoneW = 40

  // Shared text label rendered inside a handle circle
  function HandleLabel({ x, y, label, isSelected, color }) {
    return (
      <text
        x={x} y={y}
        textAnchor="middle" dominantBaseline="central"
        fontSize="7" fontWeight="600"
        fill={isSelected ? 'white' : color}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {label}
      </text>
    )
  }

  // ── Grid lines ──────────────────────────────────────────────────────────
  function renderGrid() {
    return Array.from({ length: numGridCells - 1 }, (_, k) => {
      const gx = x0 + ((k + 1) / numGridCells) * beamLen
      return (
        <line key={k}
          x1={gx} y1={loadAreaTop - 4} x2={gx} y2={beamBot + 6}
          stroke="#d1d5db" strokeWidth="0.8" strokeDasharray="3 3"
          style={{ pointerEvents: 'none' }}
        />
      )
    })
  }

  // ── Point load handle ────────────────────────────────────────────────────
  function renderPointLoadInteractive(load) {
    const ax = x0 + (load.x ?? 0.5) * beamLen
    const color = load.color ?? '#dc2626'
    const isSelected = load.id === selectedId
    const midY = (loadAreaTop + beamTop) / 2
    const label = fmtPos(load.x ?? 0.5, L)

    return (
      <g key={load.id}>
        <rect
          x={ax - hitW / 2} y={loadAreaTop}
          width={hitW} height={beamTop - loadAreaTop}
          fill="transparent"
          style={{ cursor: 'grab', pointerEvents: 'all' }}
          onMouseDown={e => startLoadDrag(e, load.id, 'x')}
          onClick={e => { e.stopPropagation(); onSelectLoad(load.id) }}
        />
        <circle
          cx={ax} cy={midY} r={handleR}
          fill={isSelected ? color : 'white'}
          stroke={color} strokeWidth={isSelected ? 0 : 2}
          style={{ cursor: 'grab', pointerEvents: 'all' }}
          onMouseDown={e => startLoadDrag(e, load.id, 'x')}
          onClick={e => { e.stopPropagation(); onSelectLoad(load.id) }}
        />
        <HandleLabel x={ax} y={midY} label={label} isSelected={isSelected} color={color} />
        {isSelected && (
          <circle cx={ax} cy={midY} r={handleR + 4}
            fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="3 2" />
        )}
      </g>
    )
  }

  // ── UDL endpoint handles ─────────────────────────────────────────────────
  function renderUDLInteractive(load, rowIndex) {
    const topY   = udlTop + rowIndex * (rowH + rowGap)
    const botY   = topY + rowH
    const midY   = (topY + botY) / 2
    const color  = load.color ?? '#2563eb'
    const xStartPx = x0 + (load.xStart ?? 0) * beamLen
    const xEndPx   = x0 + (load.xEnd   ?? 1) * beamLen
    const isSelected = load.id === selectedId
    const startLabel = fmtPos(load.xStart ?? 0, L)
    const endLabel   = fmtPos(load.xEnd   ?? 1, L)

    return (
      <g key={load.id}>
        {/* Body click zone */}
        <rect
          x={xStartPx} y={topY} width={xEndPx - xStartPx} height={rowH}
          fill="transparent"
          style={{ cursor: 'pointer', pointerEvents: 'all' }}
          onClick={e => { e.stopPropagation(); onSelectLoad(load.id) }}
        />
        {isSelected && (
          <rect
            x={xStartPx} y={topY} width={xEndPx - xStartPx} height={rowH}
            fill={color} fillOpacity="0.08"
            stroke={color} strokeWidth="1" strokeDasharray="4 2"
            style={{ pointerEvents: 'none' }}
          />
        )}
        {/* Left handle (xStart) */}
        <circle
          cx={xStartPx} cy={midY} r={handleR}
          fill={isSelected ? color : 'white'} stroke={color} strokeWidth={2}
          style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
          onMouseDown={e => startLoadDrag(e, load.id, 'xStart')}
          onClick={e => { e.stopPropagation(); onSelectLoad(load.id) }}
        />
        <HandleLabel x={xStartPx} y={midY} label={startLabel} isSelected={isSelected} color={color} />
        {/* Right handle (xEnd) */}
        <circle
          cx={xEndPx} cy={midY} r={handleR}
          fill={isSelected ? color : 'white'} stroke={color} strokeWidth={2}
          style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
          onMouseDown={e => startLoadDrag(e, load.id, 'xEnd')}
          onClick={e => { e.stopPropagation(); onSelectLoad(load.id) }}
        />
        <HandleLabel x={xEndPx} y={midY} label={endLabel} isSelected={isSelected} color={color} />
      </g>
    )
  }

  // ── Intermediate support handle ──────────────────────────────────────────
  // The roller symbol in BeamSVG already marks the position visually.
  // Only an invisible hit area + selection outline is rendered here.
  function renderIsupInteractive(sup) {
    const ax = x0 + sup.frac * beamLen
    const isSelected = sup.id === selectedId

    return (
      <g key={sup.id}>
        <rect
          x={ax - hitW / 2} y={beamTop}
          width={hitW} height={beamH}
          fill={isSelected ? 'rgba(55,65,81,0.08)' : 'transparent'}
          style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
          onMouseDown={e => startIsupDrag(e, sup.id)}
          onClick={e => { e.stopPropagation(); onSelectLoad(sup.id) }}
        />
        {isSelected && (
          <rect
            x={ax - hitW / 2 - 2} y={beamTop - 2}
            width={hitW + 4} height={beamH + 4}
            fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="3 2"
            rx="2" style={{ pointerEvents: 'none' }}
          />
        )}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', overflow: 'visible' }}
      onClick={() => onSelectLoad(null)}
    >
      {renderGrid()}

      {udlLoads.map((load, i) => renderUDLInteractive(load, i))}
      {pointLoads.map(load => renderPointLoadInteractive(load))}
      {intermediateSupports.map(sup => renderIsupInteractive(sup))}

      {/* Left end support click zone */}
      <rect
        x={x0 - supZoneW / 2} y={beamBot}
        width={supZoneW} height={supZoneH}
        fill="transparent"
        style={{ cursor: 'pointer', pointerEvents: 'all' }}
        onClick={e => { e.stopPropagation(); onSelectLoad(null); cycleSupport('left') }}
      />
      {/* Right end support click zone */}
      <rect
        x={x1 - supZoneW / 2} y={beamBot}
        width={supZoneW} height={supZoneH}
        fill="transparent"
        style={{ cursor: 'pointer', pointerEvents: 'all' }}
        onClick={e => { e.stopPropagation(); onSelectLoad(null); cycleSupport('right') }}
      />
      {/* Right beam-end resize handle */}
      <rect
        x={x1 - 5} y={beamTop - 4}
        width={10} height={beamH + 8}
        fill="rgba(55,65,81,0.12)" rx="3"
        style={{ cursor: 'ew-resize', pointerEvents: 'all' }}
        onMouseDown={startBeamEndDrag}
      />
      <line x1={x1 - 2} y1={beamTop + 4} x2={x1 - 2} y2={beamBot - 4}
        stroke="#6b7280" strokeWidth="1" style={{ pointerEvents: 'none' }} />
      <line x1={x1 + 2} y1={beamTop + 4} x2={x1 + 2} y2={beamBot - 4}
        stroke="#6b7280" strokeWidth="1" style={{ pointerEvents: 'none' }} />
    </svg>
  )
}
