/**
 * BeamSVG – generalized simply supported / cantilever beam diagram.
 *
 * Props:
 *   L        – span label (number, shown as "L = X m")
 *   supports – { left: 'pin'|'fixed'|'free', right: 'roller'|'pin'|'fixed'|'free' }
 *              Default: { left: 'pin', right: 'roller' }
 *   loads    – array of load objects:
 *
 *     UDL (distributed):
 *       { type: 'udl', label, color?, xStart?, xEnd? }
 *       xStart/xEnd: 0–1 fraction of span (default 0 and 1)
 *
 *     Point load:
 *       { type: 'point', label, x, color? }
 *       x: 0–1 fraction of span
 *
 *   divisions – optional [d1, d2, ...] span panel lengths in metres.
 *              When provided, the dimension line shows per-panel labels instead
 *              of a single total length.
 *
 *   overhang  – optional length (metres) the beam extends past the right support.
 *              When > 0, the right support is drawn at x = L/(L+overhang) along
 *              the beam, the free tip is at the right end, and the dimension line
 *              shows two segments: L (span) and overhang (a).
 *
 *   rebarBot  – draw a reinforcement line along the bottom of the beam
 *   rebarTop  – draw a reinforcement line along the top of the beam
 *   intermediateSupports – array of 0–1 fractions: draw pin supports at those positions
 *
 * Layout:
 *   UDL rows stack vertically above the beam (top → bottom order).
 *   Point loads are drawn as a single arrow spanning the full load-area height.
 *   When both UDL and point loads are present, extra vertical space is reserved
 *   above the UDL rows so point-load labels don't collide with UDL arrows.
 */
import { computeBeamLayout } from '../../utils/beamLayout.js'

export default function BeamSVG({
  L = 12,
  supports = { left: 'pin', right: 'roller' },
  loads = [],
  divisions = null,
  overhang = 0,
  rebarBot = false,      // true | [{xStart, xEnd}, ...]  (0–1 fractions of span)
  rebarTop = false,      // true | [{xStart, xEnd}, ...]
  intermediateSupports = [],
  scale = 1,             // display scale factor (keeps viewBox, shrinks rendered size)
  showDimension = true,  // show the bottom dimension line
}) {
  const {
    W, x0, x1, beamLen, beamH,
    udlLoads, pointLoads,
    rowH, rowGap, udlTop,
    beamTop, beamBot, loadAreaTop,
    H,
  } = computeBeamLayout({ loads, supports, showDimension })

  const Ltot = L + overhang
  // x-position of the right support (may differ from x1 when overhang > 0)
  const xSupRight = overhang > 0 ? x0 + (L / Ltot) * beamLen : x1

  const numArrows  = 10
  const arrowHeadSize = 6

  // ── UDL rows ───────────────────────────────────────────────────────────
  function renderUDL(row, rowIndex) {
    const topY   = udlTop + rowIndex * (rowH + rowGap)
    const botY   = topY + rowH
    const color  = row.color ?? '#2563eb'
    const xStart = x0 + (row.xStart ?? 0) * beamLen
    const xEnd   = x0 + (row.xEnd   ?? 1) * beamLen
    const span   = xEnd - xStart

    const n = Math.max(2, Math.round((span / beamLen) * numArrows))
    const arrowXs = Array.from({ length: n }, (_, i) =>
      xStart + (n === 1 ? span / 2 : (i / (n - 1)) * span)
    )

    return (
      <g key={`udl-${rowIndex}`}>
        <line x1={xStart} y1={topY} x2={xEnd} y2={topY} stroke={color} strokeWidth="1.8" />
        {arrowXs.map((ax, i) => (
          <g key={i}>
            <line x1={ax} y1={topY} x2={ax} y2={botY} stroke={color} strokeWidth="1.4" />
            <polygon
              points={`${ax},${botY} ${ax - arrowHeadSize / 2},${botY - arrowHeadSize} ${ax + arrowHeadSize / 2},${botY - arrowHeadSize}`}
              fill={color}
            />
          </g>
        ))}
        {row.label && (
          <text x={xEnd + 10} y={topY + rowH / 2 + 4} fontSize="12" fill={color} fontWeight="500">
            {row.magnitude != null
              ? `${row.label} = ${row.magnitude % 1 === 0 ? row.magnitude : row.magnitude.toFixed(1)}`
              : row.label}
          </text>
        )}
      </g>
    )
  }

  // ── Point loads ────────────────────────────────────────────────────────
  function renderPointLoad(load, idx) {
    const ax    = x0 + load.x * beamLen
    const color = load.color ?? '#dc2626'
    const topY  = loadAreaTop
    const hs    = 9

    return (
      <g key={`pt-${idx}`}>
        <line x1={ax} y1={topY} x2={ax} y2={beamTop} stroke={color} strokeWidth="2.5" />
        <polygon
          points={`${ax},${beamTop} ${ax - hs / 2},${beamTop - hs} ${ax + hs / 2},${beamTop - hs}`}
          fill={color}
        />
        {load.label && (
          <text x={ax} y={topY - 4} textAnchor="middle" fontSize="12" fill={color} fontWeight="600">
            {load.magnitude != null
              ? `${load.label} = ${load.magnitude % 1 === 0 ? load.magnitude : load.magnitude.toFixed(1)}`
              : load.label}
          </text>
        )}
      </g>
    )
  }

  // ── Support shapes ─────────────────────────────────────────────────────
  // All support y-coordinates reference beamBot (bottom of beam)
  function renderSupport(type, x, side) {
    const triH = 22
    const triW = 13
    const groundW = 16

    if (type === 'pin') {
      return (
        <g>
          <polygon
            points={`${x},${beamBot} ${x - triW},${beamBot + triH} ${x + triW},${beamBot + triH}`}
            fill="none" stroke="#374151" strokeWidth="1.8"
          />
          <circle cx={x} cy={beamBot} r="3.5" fill="#374151" />
          <line x1={x - groundW} y1={beamBot + triH + 1} x2={x + groundW} y2={beamBot + triH + 1}
            stroke="#374151" strokeWidth="1.8" />
        </g>
      )
    }
    if (type === 'roller') {
      return (
        <g>
          <polygon
            points={`${x},${beamBot} ${x - triW},${beamBot + triH} ${x + triW},${beamBot + triH}`}
            fill="none" stroke="#374151" strokeWidth="1.8"
          />
          <circle cx={x} cy={beamBot} r="3.5" fill="#374151" />
          <circle cx={x - 7} cy={beamBot + triH + 4} r="3.5" fill="none" stroke="#374151" strokeWidth="1.5" />
          <circle cx={x}     cy={beamBot + triH + 4} r="3.5" fill="none" stroke="#374151" strokeWidth="1.5" />
          <circle cx={x + 7} cy={beamBot + triH + 4} r="3.5" fill="none" stroke="#374151" strokeWidth="1.5" />
          <line x1={x - groundW} y1={beamBot + triH + 8} x2={x + groundW} y2={beamBot + triH + 8}
            stroke="#374151" strokeWidth="1.8" />
        </g>
      )
    }
    if (type === 'fixed') {
      // Wall: hatched rectangle on outer side, spanning full beam height + margin
      const wallW = 12
      const wallH = beamH + 20
      const wallX = side === 'left' ? x - wallW : x
      const wallTop = beamTop - 10

      const hatches = []
      for (let i = 0; i < 5; i++) {
        const hy = wallTop + 4 + i * (wallH - 8) / 4
        if (side === 'left') {
          hatches.push(<line key={i} x1={wallX} y1={hy} x2={wallX - 7} y2={hy + 7} stroke="#374151" strokeWidth="1.2" />)
        } else {
          hatches.push(<line key={i} x1={wallX + wallW} y1={hy} x2={wallX + wallW + 7} y2={hy + 7} stroke="#374151" strokeWidth="1.2" />)
        }
      }
      return (
        <g>
          <rect x={wallX} y={wallTop} width={wallW} height={wallH} fill="#d1d5db" stroke="#374151" strokeWidth="1.5" />
          {hatches}
        </g>
      )
    }
    // 'free' – nothing
    return null
  }

  // ── Dimension line ─────────────────────────────────────────────────────
  const dimY = beamBot + (supports.left === 'fixed' ? 30 : 40)

  // Normalise rebarBot/rebarTop: boolean true → full span, array → use as-is
  const rebarBotSegs = !rebarBot ? [] : rebarBot === true ? [{ xStart: 0, xEnd: 1 }] : rebarBot
  const rebarTopSegs = !rebarTop ? [] : rebarTop === true ? [{ xStart: 0, xEnd: 1 }] : rebarTop

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * scale} height={H * scale} style={{ fontFamily: 'sans-serif' }}>

      {udlLoads.map((row, i) => renderUDL(row, i))}
      {pointLoads.map((load, i) => renderPointLoad(load, i))}

      {/* Beam rectangle */}
      <rect x={x0} y={beamTop} width={beamLen} height={beamH}
        fill="#e8e8e8" stroke="#1a1a2e" strokeWidth="1.5" />

      {/* Rebar lines */}
      {rebarBotSegs.map((seg, i) => (
        <line key={`rb${i}`}
          x1={x0 + seg.xStart * beamLen + 4} y1={beamBot - 5}
          x2={x0 + seg.xEnd   * beamLen - 4} y2={beamBot - 5}
          stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" />
      ))}
      {rebarTopSegs.map((seg, i) => (
        <line key={`rt${i}`}
          x1={x0 + seg.xStart * beamLen + 4} y1={beamTop + 5}
          x2={x0 + seg.xEnd   * beamLen - 4} y2={beamTop + 5}
          stroke="#1a1a2e" strokeWidth="3" strokeLinecap="round" />
      ))}

      {renderSupport(supports.left  ?? 'pin',    x0,         'left')}
      {renderSupport(supports.right ?? 'roller',  xSupRight,  'right')}

      {/* Intermediate supports */}
      {intermediateSupports.map((frac, i) => (
        <g key={`isup${i}`}>{renderSupport('roller', x0 + frac * beamLen, 'mid')}</g>
      ))}

      {/* Dimension line */}
      {showDimension && (overhang > 0 ? (
        // Two segments: span L (A→B) and overhang a (B→C)
        <>
          {/* Span L */}
          <line x1={x0}         y1={dimY} x2={xSupRight} y2={dimY} stroke="#6b7280" strokeWidth="1.2" />
          <line x1={x0}         y1={dimY - 5} x2={x0}         y2={dimY + 5} stroke="#6b7280" strokeWidth="1.2" />
          <line x1={xSupRight}  y1={dimY - 5} x2={xSupRight}  y2={dimY + 5} stroke="#6b7280" strokeWidth="1.2" />
          <text x={(x0 + xSupRight) / 2} y={dimY + 14} textAnchor="middle" fontSize="12" fill="#374151">
            {L} m
          </text>
          {/* Overhang a */}
          <line x1={xSupRight} y1={dimY} x2={x1} y2={dimY} stroke="#6b7280" strokeWidth="1.2" />
          <line x1={x1}        y1={dimY - 5} x2={x1} y2={dimY + 5} stroke="#6b7280" strokeWidth="1.2" />
          <text x={(xSupRight + x1) / 2} y={dimY + 14} textAnchor="middle" fontSize="12" fill="#374151">
            {overhang} m
          </text>
        </>
      ) : divisions ? (() => {
        const elems = []
        let cx = 0
        const tick = (sx) => [
          <line key={`dt${cx}`} x1={sx} y1={dimY - 5} x2={sx} y2={dimY + 5} stroke="#6b7280" strokeWidth="1.2" />,
        ]
        elems.push(...tick(x0))
        divisions.forEach((d, i) => {
          const sx = x0 + (cx / L) * beamLen
          const ex = x0 + ((cx + d) / L) * beamLen
          elems.push(
            <line key={`dl${i}`} x1={sx} y1={dimY} x2={ex} y2={dimY} stroke="#6b7280" strokeWidth="1.2" />,
            <text key={`dlt${i}`} x={(sx + ex) / 2} y={dimY + 14} textAnchor="middle" fontSize="12" fill="#374151">
              {d} m
            </text>,
            <line key={`dtr${i}`} x1={ex} y1={dimY - 5} x2={ex} y2={dimY + 5} stroke="#6b7280" strokeWidth="1.2" />,
          )
          cx += d
        })
        return elems
      })() : (() => {
        // Split dimension line at each intermediate support position
        const breakFracs = [0, ...[...intermediateSupports].sort((a, b) => a - b), 1]
        const numSegs = breakFracs.length - 1
        const fSize = numSegs >= 4 ? 9 : 11
        const elems = []
        breakFracs.forEach((frac, i) => {
          const sx = x0 + frac * beamLen
          elems.push(
            <line key={`dt${i}`} x1={sx} y1={dimY - 5} x2={sx} y2={dimY + 5}
              stroke="#6b7280" strokeWidth="1.2" />
          )
          if (i < numSegs) {
            const nextFrac = breakFracs[i + 1]
            const ex = x0 + nextFrac * beamLen
            const segM = (nextFrac - frac) * L
            const label = segM % 1 === 0 ? `${segM}` : segM.toFixed(1)
            elems.push(
              <line key={`dl${i}`} x1={sx} y1={dimY} x2={ex} y2={dimY}
                stroke="#6b7280" strokeWidth="1.2" />,
              <text key={`dlt${i}`} x={(sx + ex) / 2} y={dimY + 14}
                textAnchor="middle" fontSize={fSize} fill="#374151">
                {label} m
              </text>
            )
          }
        })
        return elems
      })())}
    </svg>
  )
}
