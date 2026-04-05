/**
 * ColumnSVG – column diagram with loads and supports.
 *
 * Props:
 *   L           – column height in metres (for dimension label)
 *   N_label     – label for axial point load at top; omit to hide
 *   q_label     – label for horizontal UDL; omit to hide
 *   e_label     – label for eccentricity; when set the load is placed outside the column
 *   support     – 'fixed' | 'pin' (default) at base
 *   topSupport  – 'none' (default, free end) | 'roller' (lateral roller on right side)
 *   midSupport  – 'none' (default) | 'roller' (lateral roller at mid-height, right side)
 *   color       – fill color of the column body (default '#e8e8e8')
 *   showDim     – show height dimension line (default true)
 */
export default function ColumnSVG({
  L          = 4,
  N_label    = 'P_d',
  q_label    = 'q_d',
  e_label    = '',
  support    = 'pin',
  topSupport = 'none',
  midSupport = 'none',
  color      = '#e8e8e8',
  showDim    = true,
}) {
  const W = 320
  const H = 460

  // ── Column geometry (slender) ────────────────────────────────────────────
  const colCx    = 130
  const colW     = 14
  const colLeft  = colCx - colW / 2
  const colRight = colCx + colW / 2
  const colTop   = 90
  const colBot   = 390
  const colH     = colBot - colTop   // 300 px → ratio 300/14 ≈ 21

  // ── Axial load ───────────────────────────────────────────────────────────
  // When eccentric: load lands outside the column to the right
  const load_x  = e_label ? colRight + 48 : colCx
  const arrTop  = colTop - 56
  const arrowSz = 8

  // ── UDL ─────────────────────────────────────────────────────────────────
  const n_udl   = 8
  const udl_len = 55
  const udl_clr = '#2563eb'

  // ── Dimension line (right of everything) ────────────────────────────────
  const dimX = e_label ? load_x + 36 : colRight + 52

  // ── Helpers ─────────────────────────────────────────────────────────────
  function PinBelow({ cx, y }) {
    const triH = 20, triHW = 14, baseY = y + triH
    return (
      <g>
        <circle cx={cx} cy={y} r="3.5" fill="#374151" />
        <polygon points={`${cx},${y} ${cx-triHW},${baseY} ${cx+triHW},${baseY}`}
          fill="none" stroke="#374151" strokeWidth="1.8" />
        <line x1={cx-18} y1={baseY+1} x2={cx+18} y2={baseY+1} stroke="#374151" strokeWidth="1.5" />
        {[-12, -4, 4, 12].map(dx => (
          <line key={dx} x1={cx+dx} y1={baseY+1} x2={cx+dx-7} y2={baseY+9}
            stroke="#374151" strokeWidth="1.2" />
        ))}
      </g>
    )
  }

  function RollerSide({ x, y }) {
    const triW = 16, triHH = 12, baseX = x + triW
    return (
      <g>
        <circle cx={x} cy={y} r="3" fill="#374151" />
        <polygon points={`${x},${y} ${baseX},${y-triHH} ${baseX},${y+triHH}`}
          fill="none" stroke="#374151" strokeWidth="1.6" />
        {[-7, 0, 7].map(dy => (
          <circle key={dy} cx={baseX+5} cy={y+dy} r="4"
            fill="none" stroke="#374151" strokeWidth="1.4" />
        ))}
        <line x1={baseX+9} y1={y-16} x2={baseX+9} y2={y+16} stroke="#374151" strokeWidth="1.5" />
        {[-10, -2, 6].map(dy => (
          <line key={dy} x1={baseX+9} y1={y+dy} x2={baseX+16} y2={y+dy-6}
            stroke="#374151" strokeWidth="1.2" />
        ))}
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: 'sans-serif' }}>

      {/* ── UDL ──────────────────────────────────────────────────────── */}
      {q_label && Array.from({ length: n_udl }, (_, i) => {
        const y = colTop + (i + 0.5) * colH / n_udl
        return (
          <g key={i}>
            <line x1={colLeft - udl_len} y1={y} x2={colLeft - 1} y2={y}
              stroke={udl_clr} strokeWidth="1.5" />
            <polygon
              points={`${colLeft},${y} ${colLeft-8},${y-4} ${colLeft-8},${y+4}`}
              fill={udl_clr} />
          </g>
        )
      })}
      {q_label && (
        <text x={colLeft - udl_len - 6} y={colTop + colH / 2 + 4}
          fontSize="12" fill={udl_clr} textAnchor="end" fontWeight="500">
          {q_label}
        </text>
      )}

      {/* ── Column body ───────────────────────────────────────────────── */}
      <rect x={colLeft} y={colTop} width={colW} height={colH}
        fill={color} stroke="#1a1a2e" strokeWidth="1.5" />

      {/* ── Top lateral roller ─────────────────────────────────────── */}
      {topSupport === 'roller' && <RollerSide x={colRight} y={colTop} />}

      {/* ── Mid-height lateral roller ──────────────────────────────── */}
      {midSupport === 'roller' && <RollerSide x={colRight} y={colTop + colH / 2} />}

      {/* ── Axial load ─────────────────────────────────────────────── */}
      {N_label && (
        <>
          <line x1={load_x} y1={arrTop} x2={load_x} y2={colTop}
            stroke="#dc2626" strokeWidth="2" />
          <polygon
            points={`${load_x},${colTop} ${load_x-arrowSz},${colTop-arrowSz*1.7} ${load_x+arrowSz},${colTop-arrowSz*1.7}`}
            fill="#dc2626" />
          <text x={load_x + 7} y={arrTop + 13} fontSize="12" fill="#dc2626" fontWeight="600">
            {N_label}
          </text>

          {/* Eccentricity: horizontal dim from column centre to load point */}
          {e_label && (
            <g>
              {/* dashed horizontal reference at arrow tip level */}
              <line x1={colCx} y1={colTop - 22} x2={load_x} y2={colTop - 22}
                stroke="#374151" strokeWidth="1" strokeDasharray="3,2" />
              <line x1={colCx}  y1={colTop-26} x2={colCx}  y2={colTop-18}
                stroke="#374151" strokeWidth="1" />
              <line x1={load_x} y1={colTop-26} x2={load_x} y2={colTop-18}
                stroke="#374151" strokeWidth="1" />
              <text x={(colCx + load_x) / 2} y={colTop - 29}
                fontSize="10" fill="#374151" textAnchor="middle">
                {e_label}
              </text>
            </g>
          )}
        </>
      )}

      {/* ── Base support ───────────────────────────────────────────── */}
      {support === 'fixed' && (
        <g>
          <rect x={colLeft - 12} y={colBot} width={colW + 24} height={12}
            fill="#d1d5db" stroke="#374151" strokeWidth="1.5" />
          {[-18, -9, 0, 9, 18].map((dx, i) => (
            <line key={i}
              x1={colCx + dx} y1={colBot + 12}
              x2={colCx + dx - 7} y2={colBot + 20}
              stroke="#374151" strokeWidth="1.2" />
          ))}
        </g>
      )}
      {support === 'pin' && <PinBelow cx={colCx} y={colBot} />}

      {/* ── Dimension line ─────────────────────────────────────────── */}
      {showDim && (
        <g>
          <line x1={dimX} y1={colTop} x2={dimX} y2={colBot}
            stroke="#6b7280" strokeWidth="1.2" />
          <line x1={dimX-5} y1={colTop} x2={dimX+5} y2={colTop}
            stroke="#6b7280" strokeWidth="1.2" />
          <line x1={dimX-5} y1={colBot} x2={dimX+5} y2={colBot}
            stroke="#6b7280" strokeWidth="1.2" />
          <text x={dimX + 14} y={colTop + colH / 2 + 4}
            fontSize="12" fill="#374151" textAnchor="middle"
            transform={`rotate(90,${dimX+14},${colTop+colH/2+4})`}>
            {L} m
          </text>
        </g>
      )}
    </svg>
  )
}
