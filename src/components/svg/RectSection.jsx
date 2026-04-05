/**
 * RectSection – draws a rectangular cross-section (concrete, timber, etc.)
 * with b and h dimension labels.
 *
 * Props:
 *   b          – width (mm), shown as label
 *   h          – height (mm), shown as label
 *   rebars     – optional array of { x, y } positions (0–1 fractions of b/h from bottom-left)
 *                e.g. [{ x: 0.2, y: 0.1 }, { x: 0.8, y: 0.1 }] for two bottom rebars
 *   rebarDia   – rebar diameter for display (mm, just a label)
 *   fillColor  – section fill color (default light gray for concrete)
 */
export default function RectSection({
  b = 300,
  h = 500,
  rebars = [],
  rebarDia = null,
  fillColor = '#d1d5db',
}) {
  const svgW = 200
  const svgH = 260
  const pad  = 40

  const scale = Math.min((svgH - pad * 2) / h, (svgW - pad * 2) / b)
  const sB    = b * scale
  const sH    = h * scale

  const cx   = svgW / 2
  const rectX = cx - sB / 2
  const rectY = (svgH - sH) / 2

  const dimColor = '#6b7280'
  const strokeColor = '#374151'
  const fs = 10

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

  const rebarR = Math.max(3, sB * 0.04)

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} style={{ fontFamily: 'sans-serif' }}>

      {/* Section rectangle */}
      <rect x={rectX} y={rectY} width={sB} height={sH}
        fill={fillColor} stroke={strokeColor} strokeWidth="1.8" />

      {/* Rebars */}
      {rebars.map((r, i) => {
        const rx = rectX + r.x * sB
        const ry = rectY + (1 - r.y) * sH  // y=0 is bottom
        return (
          <circle key={i} cx={rx} cy={ry} r={rebarR}
            fill={strokeColor} stroke="none" />
        )
      })}

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
      <Arr x1={cx-15} y1={rectY-10} x2={rectX}    y2={rectY-10} />
      <Arr x1={cx+15} y1={rectY-10} x2={rectX+sB} y2={rectY-10} />
      <text x={cx} y={rectY-15} textAnchor="middle" fontSize={fs} fill={dimColor}>b={b}</text>

    </svg>
  )
}
