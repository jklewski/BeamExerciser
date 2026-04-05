/**
 * GlulamSection – rectangular glulam (limträ) cross-section with lamination lines.
 *
 * Props:
 *   b                   – width (mm), used for label and aspect ratio
 *   h                   – height (mm), used for label and aspect ratio
 *   laminationThickness – nominal lamination height in mm (default 45 mm for GL)
 */
export default function GlulamSection({ b = 140, h = 720, laminationThickness = 45 }) {
  const svgW = 200
  const svgH = 280
  const pad  = 42

  const scale  = Math.min((svgH - pad * 2) / h, (svgW - pad * 2) / b)
  const sB     = b * scale
  const sH     = h * scale
  const sLam   = laminationThickness * scale

  const cx    = svgW / 2
  const rectX = cx - sB / 2
  const rectY = (svgH - sH) / 2

  const numLam = Math.round(h / laminationThickness)

  const woodFill   = '#f0d9a0'   // light pine/glulam color
  const grainColor = '#c8a85a'   // slightly darker for lamination lines
  const edgeColor  = '#7a5c2a'   // darker edge
  const dimColor   = '#6b7280'
  const fs         = 10

  // Alternating lamination shading
  const laminations = Array.from({ length: numLam }, (_, i) => {
    const y = rectY + i * sLam
    const lamH = Math.min(sLam, rectY + sH - y)
    return (
      <rect
        key={i}
        x={rectX} y={y}
        width={sB} height={lamH}
        fill={i % 2 === 0 ? woodFill : '#e8cb88'}
        stroke="none"
      />
    )
  })

  function Arr({ x1, y1, x2, y2 }) {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1) return null
    const ux = dx / len, uy = dy / len, hs = 5
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={dimColor} strokeWidth="1" />
        <polygon
          points={`${x2},${y2} ${x2-ux*hs-uy*hs*.5},${y2-uy*hs+ux*hs*.5} ${x2-ux*hs+uy*hs*.5},${y2-uy*hs-ux*hs*.5}`}
          fill={dimColor}
        />
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} style={{ fontFamily: 'sans-serif' }}>

      {/* Lamination fill */}
      {laminations}

      {/* Lamination boundary lines */}
      {Array.from({ length: numLam - 1 }, (_, i) => {
        const ly = rectY + (i + 1) * sLam
        return (
          <line key={i}
            x1={rectX} y1={ly} x2={rectX + sB} y2={ly}
            stroke={grainColor} strokeWidth="0.8"
          />
        )
      })}

      {/* Outer border */}
      <rect x={rectX} y={rectY} width={sB} height={sH}
        fill="none" stroke={edgeColor} strokeWidth="2" />

      {/* h – left side */}
      <line x1={rectX-10} y1={rectY} x2={rectX-10} y2={rectY+sH}
        stroke={dimColor} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={rectX-10} y1={rectY+sH/2+8} x2={rectX-10} y2={rectY+sH} />
      <Arr x1={rectX-10} y1={rectY+sH/2-8} x2={rectX-10} y2={rectY} />
      <text x={rectX-22} y={rectY+sH/2+4} textAnchor="middle" fontSize={fs} fill={dimColor}
        transform={`rotate(-90,${rectX-22},${rectY+sH/2+4})`}>h={h}</text>

      {/* b – top */}
      <line x1={rectX} y1={rectY-10} x2={rectX+sB} y2={rectY-10}
        stroke={dimColor} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={cx-12} y1={rectY-10} x2={rectX}    y2={rectY-10} />
      <Arr x1={cx+12} y1={rectY-10} x2={rectX+sB} y2={rectY-10} />
      <text x={cx} y={rectY-15} textAnchor="middle" fontSize={fs} fill={dimColor}>b={b}</text>

    </svg>
  )
}
