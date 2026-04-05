import { useState, useEffect, useRef } from 'react'

// ── SVG geometry (aligned with BeamSVG / MomentDiagramSVG) ───────────────────
const W       = 520
const x0      = 70
const x1      = 450
const beamLen = 380
const H       = 180
const midY    = 90
const halfH   = 70

// ── Coordinate transforms ─────────────────────────────────────────────────────
function toSvgX(xM, Ltot)            { return x0 + (xM / Ltot) * beamLen }
function toSvgY(y, maxVal, invert)   { return invert ? midY + (y / maxVal) * halfH : midY - (y / maxVal) * halfH }
function fromSvgX(sx, Ltot)          { return (sx - x0) / beamLen * Ltot }
function fromSvgY(sy, maxVal, invert){ return invert ? (sy - midY) / halfH * maxVal : (midY - sy) / halfH * maxVal }

// ── Initial state ─────────────────────────────────────────────────────────────
function makePoint(id, x, y) {
  return {
    id,
    x,
    y,
    yExit: null,
    leftType:  'linear',
    rightType: 'linear',
    smooth: false,
    leftHandle:  { dx: -30, dy: 0 },
    rightHandle: { dx:  30, dy: 0 },
  }
}

function makeInitialPoints(Ltot) {
  return [
    makePoint('p-start', 0,    0),
    makePoint('p-end',   Ltot, 0),
  ]
}

// ── Path builder ──────────────────────────────────────────────────────────────
function buildPath(sorted, Ltot, maxVal, invert) {
  if (sorted.length < 1) return ''
  const sx = p => toSvgX(p.x, Ltot).toFixed(2)
  const sy = v => toSvgY(v, maxVal, invert).toFixed(2)

  let d = `M ${sx(sorted[0])} ${sy(sorted[0].y)}`

  for (let i = 0; i < sorted.length - 1; i++) {
    const p = sorted[i]
    const q = sorted[i + 1]

    const pDepSvgY = p.yExit !== null ? sy(p.yExit) : sy(p.y)

    // Jump to departure y when discontinuous
    if (p.yExit !== null) {
      d += ` M ${sx(p)} ${pDepSvgY}`
    }

    const useBez = p.rightType === 'bezier' || q.leftType === 'bezier'

    if (useBez) {
      const pSvgX = toSvgX(p.x, Ltot)
      const pDepY = p.yExit !== null ? toSvgY(p.yExit, maxVal, invert) : toSvgY(p.y, maxVal, invert)
      const qSvgX = toSvgX(q.x, Ltot)
      const qSvgY = toSvgY(q.y, maxVal, invert)

      const cp1x = p.rightType === 'bezier' ? pSvgX + p.rightHandle.dx : pSvgX
      const cp1y = p.rightType === 'bezier' ? pDepY + p.rightHandle.dy : pDepY
      const cp2x = q.leftType  === 'bezier' ? qSvgX + q.leftHandle.dx  : qSvgX
      const cp2y = q.leftType  === 'bezier' ? qSvgY + q.leftHandle.dy  : qSvgY

      d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)} ${cp2x.toFixed(2)} ${cp2y.toFixed(2)} ${qSvgX.toFixed(2)} ${qSvgY.toFixed(2)}`
    } else {
      d += ` L ${sx(q)} ${sy(q.y)}`
    }
  }

  return d
}

// ── Revealed answer path ──────────────────────────────────────────────────────
function buildRevealPath(xs, vals, Ltot, maxVal, invert) {
  if (!xs || xs.length === 0) return ''
  const pts = xs.map((x, i) =>
    `${toSvgX(x, Ltot).toFixed(2)} ${toSvgY(vals[i], maxVal, invert).toFixed(2)}`
  )
  return `M ${pts[0]} ` + pts.slice(1).map(p => `L ${p}`).join(' ')
}

// ── Button style helper ───────────────────────────────────────────────────────
function btnStyle(active, enabled = true) {
  return {
    padding: '0.22rem 0.55rem',
    fontSize: '0.72rem',
    border: `1px solid ${active ? '#2563eb' : '#d1d5db'}`,
    borderRadius: 4,
    background: active ? '#2563eb' : '#fff',
    color: active ? '#fff' : enabled ? '#374151' : '#9ca3af',
    cursor: enabled ? 'pointer' : 'default',
    opacity: enabled ? 1 : 0.5,
    userSelect: 'none',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SplineEditor({ Ltot, maxVal, label, revealed, nodes = [], pointLoadXs = [], startValue, invertY = false }) {
  const [points,    setPoints]    = useState(() => makeInitialPoints(Ltot))
  const [selectedId, setSelectedId] = useState(null)
  const [dragging,  setDragging]  = useState(null)
  const svgRef = useRef(null)

  // Reset when beam changes
  useEffect(() => {
    setPoints(makeInitialPoints(Ltot))
    setSelectedId(null)
    setDragging(null)
  }, [Ltot])

  // ── Coordinate helper (needs live ref to SVG element) ──────────────────────
  function clientToSvg(e) {
    const rect = svgRef.current.getBoundingClientRect()
    return {
      svgX: (e.clientX - rect.left) / rect.width  * W,
      svgY: (e.clientY - rect.top)  / rect.height * H,
    }
  }

  // ── Global mouse tracking ──────────────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return

    function onMove(e) {
      const { svgX, svgY } = clientToSvg(e)

      if (dragging.type === 'point') {
        setPoints(prev => {
          const sorted = [...prev].sort((a, b) => a.x - b.x)
          const idx    = sorted.findIndex(p => p.id === dragging.id)
          const minX   = idx > 0                  ? sorted[idx - 1].x + 0.001 : 0
          const maxX   = idx < sorted.length - 1  ? sorted[idx + 1].x - 0.001 : Ltot
          const newX   = Math.max(minX, Math.min(maxX, fromSvgX(svgX, Ltot)))
          const newY   = Math.max(-maxVal, Math.min(maxVal, fromSvgY(svgY, maxVal, invertY)))
          return prev.map(p => p.id === dragging.id ? { ...p, x: newX, y: newY } : p)
            .sort((a, b) => a.x - b.x)
        })
      }

      if (dragging.type === 'exitPoint') {
        const newY = Math.max(-maxVal, Math.min(maxVal, fromSvgY(svgY, maxVal, invertY)))
        setPoints(prev => prev.map(p =>
          p.id === dragging.id ? { ...p, yExit: newY } : p
        ))
      }

      if (dragging.type === 'handle') {
        setPoints(prev => prev.map(p => {
          if (p.id !== dragging.id) return p
          const kSvgX  = toSvgX(p.x, Ltot)
          const kSvgY  = dragging.side === 'right' && p.yExit !== null
            ? toSvgY(p.yExit, maxVal, invertY) : toSvgY(p.y, maxVal, invertY)
          const hx = Math.max(0, Math.min(W, svgX))
          const hy = Math.max(0, Math.min(H, svgY))
          const dx = hx - kSvgX
          const dy = hy - kSvgY
          if (dragging.side === 'right') {
            return { ...p,
              rightHandle: { dx, dy },
              leftHandle: p.smooth ? { dx: -dx, dy: -dy } : p.leftHandle,
            }
          } else {
            return { ...p,
              leftHandle: { dx, dy },
              rightHandle: p.smooth ? { dx: -dx, dy: -dy } : p.rightHandle,
            }
          }
        }))
      }
    }

    function onUp() { setDragging(null) }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  }, [dragging, Ltot, maxVal, invertY])

  // ── Keyboard delete ────────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!selectedId) return
      const sorted = [...points].sort((a, b) => a.x - b.x)
      if (sorted[0].id === selectedId || sorted[sorted.length - 1].id === selectedId) return
      setPoints(prev => prev.filter(p => p.id !== selectedId))
      setSelectedId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, points])

  // ── Mouse event handlers ───────────────────────────────────────────────────
  function handleSvgMouseDown(e) {
    // Only fire on the SVG background itself (not on child elements)
    if (e.target !== svgRef.current && !e.target.dataset.bg) return
    const { svgX, svgY } = clientToSvg(e)
    if (svgX < x0 - 5 || svgX > x1 + 5) return

    const xM  = Math.max(0, Math.min(Ltot, fromSvgX(svgX, Ltot)))
    const yVal = fromSvgY(svgY, maxVal, invertY)
    const newPt = makePoint(`p-${Date.now()}`, xM, yVal)
    setPoints(prev => [...prev, newPt].sort((a, b) => a.x - b.x))
    setSelectedId(newPt.id)
    setDragging({ type: 'point', id: newPt.id })
  }

  function handleKnotMouseDown(e, ptId) {
    e.stopPropagation()
    setSelectedId(ptId)
    setDragging({ type: 'point', id: ptId })
  }

  function handleHandleMouseDown(e, ptId, side) {
    e.stopPropagation()
    setDragging({ type: 'handle', id: ptId, side })
  }

  function handleExitMouseDown(e, ptId) {
    e.stopPropagation()
    setSelectedId(ptId)
    setDragging({ type: 'exitPoint', id: ptId })
  }

  function handleKnotDblClick(e, ptId) {
    e.stopPropagation()
    const sorted = [...points].sort((a, b) => a.x - b.x)
    if (sorted[0].id === ptId || sorted[sorted.length - 1].id === ptId) return
    setPoints(prev => prev.filter(p => p.id !== ptId))
    setSelectedId(null)
  }

  // ── Toolbar actions ────────────────────────────────────────────────────────
  const sel    = points.find(p => p.id === selectedId)
  const sorted = [...points].sort((a, b) => a.x - b.x)
  const selIdx = sel ? sorted.findIndex(p => p.id === sel.id) : -1
  const hasLeft  = selIdx > 0
  const hasRight = selIdx < sorted.length - 1 && selIdx !== -1
  const isEndpoint = selIdx === 0 || selIdx === sorted.length - 1

  function update(id, patch) {
    setPoints(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p))
  }

  function toggleLeftType()  { if (sel && hasLeft)  update(sel.id, { leftType:  sel.leftType  === 'linear' ? 'bezier' : 'linear' }) }
  function toggleRightType() { if (sel && hasRight) update(sel.id, { rightType: sel.rightType === 'linear' ? 'bezier' : 'linear' }) }
  function toggleSmooth()    { if (sel && !sel.yExit) update(sel.id, { smooth: !sel.smooth }) }
  function toggleJump() {
    if (!sel) return
    if (sel.yExit !== null) {
      update(sel.id, { yExit: null })
    } else {
      update(sel.id, { yExit: sel.y + maxVal * 0.15, smooth: false })
    }
  }
  function deleteSelected() {
    if (!sel || isEndpoint) return
    setPoints(prev => prev.filter(p => p.id !== sel.id))
    setSelectedId(null)
  }

  function setStart() {
    if (startValue === undefined || startValue === null) return
    setPoints(prev => {
      const sorted = [...prev].sort((a, b) => a.x - b.x)
      const firstId = sorted[0].id
      return prev.map(p => p.id === firstId ? { ...p, y: startValue } : p)
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const sortedPts = [...points].sort((a, b) => a.x - b.x)
  const splinePath  = buildPath(sortedPts, Ltot, maxVal, invertY)
  const revealPath  = revealed
    ? buildRevealPath(revealed.xs, revealed.vals, Ltot, maxVal, invertY)
    : ''

  return (
    <div style={{ userSelect: 'none' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width={W}
        height={H}
        style={{ display: 'block', cursor: dragging ? 'grabbing' : 'crosshair', touchAction: 'none' }}
        onMouseDown={handleSvgMouseDown}
      >
        {/* Background hit area */}
        <rect data-bg="1" x={x0} y={0} width={beamLen} height={H} fill="transparent" />

        {/* Vertical lines at node (support) positions */}
        {nodes.map((xm, i) => (
          <line key={i}
            x1={toSvgX(xm, Ltot)} y1={2}
            x2={toSvgX(xm, Ltot)} y2={H - 2}
            stroke="#e5e7eb" strokeWidth="1" />
        ))}

        {/* Zero axis */}
        <line x1={x0} y1={midY} x2={x1} y2={midY} stroke="#9ca3af" strokeWidth="1.5" />

        {/* ±maxVal dashed lines */}
        {[-maxVal, maxVal].map(v => (
          <line key={v}
            x1={x0} y1={toSvgY(v, maxVal, invertY)}
            x2={x1} y2={toSvgY(v, maxVal, invertY)}
            stroke="#f97316" strokeWidth="1" strokeDasharray="5 3" />
        ))}

        {/* Axis labels */}
        <text x={x0 - 8} y={midY + 4} textAnchor="end" fontSize="11" fill="#6b7280">{label}</text>
        <text x={x0 - 6} y={toSvgY(maxVal, maxVal, invertY)  + 4} textAnchor="end" fontSize="9" fill="#f97316">{maxVal}</text>
        <text x={x0 - 6} y={toSvgY(-maxVal, maxVal, invertY) + 4} textAnchor="end" fontSize="9" fill="#f97316">-{maxVal}</text>

        {/* Node tick marks + x labels */}
        {nodes.map((xm, i) => (
          <g key={i}>
            <line x1={toSvgX(xm, Ltot)} y1={midY - 5}
                  x2={toSvgX(xm, Ltot)} y2={midY + 5}
                  stroke="#6b7280" strokeWidth="1.5" />
            <text x={toSvgX(xm, Ltot)} y={midY + 16}
                  textAnchor="middle" fontSize="9" fill="#6b7280">{xm}m</text>
          </g>
        ))}

        {/* Point load markers on the axis */}
        {pointLoadXs.map((xm, i) => {
          const sx = toSvgX(xm, Ltot)
          return (
            <g key={i}>
              <line x1={sx} y1={midY - 10} x2={sx} y2={midY + 10}
                stroke="#dc2626" strokeWidth="1.5" />
              <polygon points={`${sx},${midY + 10} ${sx - 4},${midY + 4} ${sx + 4},${midY + 4}`}
                fill="#dc2626" />
            </g>
          )
        })}

        {/* Student spline */}
        {splinePath && (
          <path d={splinePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" />
        )}

        {/* Revealed answer overlay */}
        {revealPath && (
          <path d={revealPath} fill="none" stroke="#16a34a" strokeWidth="2.5"
            opacity="0.85" strokeLinejoin="round" />
        )}

        {/* Handles + knots */}
        {sortedPts.map((p, idx) => {
          const isSel   = p.id === selectedId
          const kSvgX   = toSvgX(p.x, Ltot)
          const kSvgY   = toSvgY(p.y, maxVal, invertY)
          const depSvgY = p.yExit !== null ? toSvgY(p.yExit, maxVal, invertY) : kSvgY
          const hasLN   = idx > 0
          const hasRN   = idx < sortedPts.length - 1

          return (
            <g key={p.id}>
              {/* Left bezier handle (shown when selected, has left neighbour, leftType=bezier) */}
              {isSel && hasLN && p.leftType === 'bezier' && (
                <>
                  <line x1={kSvgX} y1={kSvgY}
                        x2={kSvgX + p.leftHandle.dx} y2={kSvgY + p.leftHandle.dy}
                        stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
                  <circle cx={kSvgX + p.leftHandle.dx} cy={kSvgY + p.leftHandle.dy}
                    r="5" fill="#fff" stroke="#64748b" strokeWidth="1.5"
                    style={{ cursor: 'grab' }}
                    onMouseDown={e => handleHandleMouseDown(e, p.id, 'left')} />
                </>
              )}

              {/* Right bezier handle */}
              {isSel && hasRN && p.rightType === 'bezier' && (
                <>
                  <line x1={kSvgX} y1={depSvgY}
                        x2={kSvgX + p.rightHandle.dx} y2={depSvgY + p.rightHandle.dy}
                        stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 2" />
                  <circle cx={kSvgX + p.rightHandle.dx} cy={depSvgY + p.rightHandle.dy}
                    r="5" fill="#fff" stroke="#64748b" strokeWidth="1.5"
                    style={{ cursor: 'grab' }}
                    onMouseDown={e => handleHandleMouseDown(e, p.id, 'right')} />
                </>
              )}

              {/* Knot circle (arrival y) */}
              <circle cx={kSvgX} cy={kSvgY} r="6"
                fill={isSel ? '#2563eb' : '#fff'}
                stroke="#2563eb" strokeWidth="2"
                style={{ cursor: 'grab' }}
                onMouseDown={e => handleKnotMouseDown(e, p.id)}
                onDoubleClick={e => handleKnotDblClick(e, p.id)}
              />

              {/* Exit circle + connector (departure y when discontinuous) */}
              {p.yExit !== null && (
                <>
                  <line x1={kSvgX} y1={kSvgY} x2={kSvgX} y2={depSvgY}
                    stroke="#f97316" strokeWidth="1" strokeDasharray="3 2" />
                  <circle cx={kSvgX} cy={depSvgY} r="6"
                    fill={isSel ? '#f97316' : '#fff'}
                    stroke="#f97316" strokeWidth="2"
                    style={{ cursor: 'grab' }}
                    onMouseDown={e => handleExitMouseDown(e, p.id)}
                  />
                </>
              )}
            </g>
          )
        })}
      </svg>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '0.3rem', padding: '0.4rem 0', flexWrap: 'wrap', alignItems: 'center' }}>
        <button style={btnStyle(sel?.leftType === 'bezier', !!sel && hasLeft)}
          onClick={toggleLeftType}
          title="Toggle left segment type">
          {sel?.leftType === 'bezier' ? '← Bez' : '← Lin'}
        </button>
        <button style={btnStyle(sel?.rightType === 'bezier', !!sel && hasRight)}
          onClick={toggleRightType}
          title="Toggle right segment type">
          {sel?.rightType === 'bezier' ? 'Bez →' : 'Lin →'}
        </button>
        <button style={btnStyle(sel?.smooth, !!sel && !sel?.yExit)}
          onClick={toggleSmooth}
          title="Toggle smooth / cusp">
          {sel?.smooth ? 'Smooth' : 'Cusp'}
        </button>
        <button style={btnStyle(sel?.yExit !== null, !!sel)}
          onClick={toggleJump}
          title="Toggle discontinuity (jump)">
          {sel?.yExit !== null ? '⌇ Jump' : '⌇ Cont'}
        </button>
        <div style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 0.15rem' }} />
        <button style={btnStyle(false, !!sel && !isEndpoint)}
          onClick={deleteSelected}
          title="Delete selected point">
          ✕ Delete
        </button>
        {startValue !== undefined && startValue !== null && (
          <>
            <div style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 0.15rem' }} />
            <button style={btnStyle(false, true)}
              onClick={setStart}
              title="Set the left endpoint to the correct starting value">
              Set start
            </button>
          </>
        )}
        {!sel && (
          <span style={{ fontSize: '0.72rem', color: '#9ca3af', marginLeft: '0.25rem' }}>
            Click grid to add a point
          </span>
        )}
      </div>
    </div>
  )
}
