/**
 * SteelSectionSVG – draws any steel cross-section from sections.js with dimension labels.
 *
 * Pass the section object (or its spread props) directly:
 *   { type: 'steel-section', props: { ...IPE_SECTIONS['IPE360'] } }
 *   { type: 'steel-section', props: { ...VKR_SECTIONS['VKR120x60-6.3'] } }
 *   { type: 'steel-section', props: { ...UPE_SECTIONS['UPE200'] } }
 *
 * Shape is auto-detected from the props:
 *   has t (no tf)         → hollow rectangular / square (VKR / KKR)
 *   has R2 or evc         → channel section (UPE)
 *   otherwise             → I-beam (IPE / HEA / HEB / HEM)
 */
export default function SteelSectionSVG(props) {
  const svgW = 220
  const svgH = 260
  const pad  = 40

  const steel  = '#1e3a5f'
  const hollow = '#b0c4d8'
  const dim    = '#6b7280'
  const fs     = 10

  function Arr({ x1, y1, x2, y2 }) {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1) return null
    const ux = dx / len, uy = dy / len, hs = 5
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={dim} strokeWidth="1" />
        <polygon
          points={`${x2},${y2} ${x2-ux*hs-uy*hs*.5},${y2-uy*hs+ux*hs*.5} ${x2-ux*hs+uy*hs*.5},${y2-uy*hs-ux*hs*.5}`}
          fill={dim}
        />
      </g>
    )
  }

  // ── Detect section type ──────────────────────────────────────────────────
  if ('t' in props && !('tf' in props)) {
    return <HollowRect {...props} svgW={svgW} svgH={svgH} pad={pad} fill={hollow} steel={steel} dim={dim} fs={fs} Arr={Arr} />
  }
  if ('R2' in props || 'evc' in props) {
    return <Channel    {...props} svgW={svgW} svgH={svgH} pad={pad} fill={steel}  dim={dim}   fs={fs} Arr={Arr} />
  }
  return       <IBeam      {...props} svgW={svgW} svgH={svgH} pad={pad} fill={steel}  dim={dim}   fs={fs} Arr={Arr} />
}

// ── I-beam (IPE / HEA / HEB / HEM) ──────────────────────────────────────────
function IBeam({ h, b, tf, tw, svgW, svgH, pad, fill, dim, fs, Arr }) {
  const scale  = Math.min((svgH - pad * 2) / h, (svgW - pad * 2) / b)
  const sH = h * scale, sB = b * scale, sTf = tf * scale, sTw = tw * scale

  const cx      = svgW / 2
  const topY    = (svgH - sH) / 2
  const flangeX = cx - sB / 2
  const webX    = cx - sTw / 2

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} style={{ fontFamily: 'sans-serif' }}>
      <rect x={flangeX} y={topY}              width={sB}  height={sTf}           fill={fill} />
      <rect x={webX}    y={topY + sTf}        width={sTw} height={sH - 2 * sTf} fill={fill} />
      <rect x={flangeX} y={topY + sH - sTf}  width={sB}  height={sTf}           fill={fill} />

      {/* h – left */}
      <line x1={flangeX-10} y1={topY} x2={flangeX-10} y2={topY+sH} stroke={dim} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={flangeX-10} y1={topY+sH/2+8} x2={flangeX-10} y2={topY+sH} />
      <Arr x1={flangeX-10} y1={topY+sH/2-8} x2={flangeX-10} y2={topY} />
      <text x={flangeX-22} y={topY+sH/2+4} textAnchor="middle" fontSize={fs} fill={dim}
        transform={`rotate(-90,${flangeX-22},${topY+sH/2+4})`}>h={h}</text>

      {/* b – top */}
      <line x1={flangeX} y1={topY-10} x2={flangeX+sB} y2={topY-10} stroke={dim} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={cx-15} y1={topY-10} x2={flangeX}    y2={topY-10} />
      <Arr x1={cx+15} y1={topY-10} x2={flangeX+sB} y2={topY-10} />
      <text x={cx} y={topY-15} textAnchor="middle" fontSize={fs} fill={dim}>b={b}</text>

      {/* tf – right */}
      <line x1={flangeX+sB+8} y1={topY} x2={flangeX+sB+8} y2={topY+sTf} stroke={dim} strokeWidth=".8" />
      <Arr x1={flangeX+sB+8} y1={topY+sTf/2+5} x2={flangeX+sB+8} y2={topY+sTf} />
      <Arr x1={flangeX+sB+8} y1={topY+sTf/2-5} x2={flangeX+sB+8} y2={topY} />
      <text x={flangeX+sB+18} y={topY+sTf/2+4} textAnchor="start" fontSize={fs} fill={dim}>tf={tf}</text>

      {/* tw – bottom */}
      <line x1={webX} y1={topY+sH+10} x2={webX+sTw} y2={topY+sH+10} stroke={dim} strokeWidth=".8" />
      <Arr x1={cx-5} y1={topY+sH+10} x2={webX}     y2={topY+sH+10} />
      <Arr x1={cx+5} y1={topY+sH+10} x2={webX+sTw} y2={topY+sH+10} />
      <text x={cx} y={topY+sH+22} textAnchor="middle" fontSize={fs} fill={dim}>tw={tw}</text>
    </svg>
  )
}

// ── Hollow rectangular / square (VKR / KKR) ─────────────────────────────────
function HollowRect({ h, b, t, svgW, svgH, pad, fill, steel, dim, fs, Arr }) {
  const scale = Math.min((svgH - pad * 2) / h, (svgW - pad * 2) / b)
  const sH = h * scale, sB = b * scale, sT = Math.max(t * scale, 4)

  const cx    = svgW / 2
  const rectX = cx - sB / 2
  const rectY = (svgH - sH) / 2

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} style={{ fontFamily: 'sans-serif' }}>
      <rect x={rectX}      y={rectY}      width={sB}        height={sH}        fill={fill}    stroke={steel} strokeWidth="1.8" />
      <rect x={rectX + sT} y={rectY + sT} width={sB-2*sT}   height={sH-2*sT}   fill="#f8fafc" stroke={steel} strokeWidth="1" />

      {/* t – right wall */}
      <line x1={rectX+sB} y1={rectY+sH/2} x2={rectX+sB+18} y2={rectY+sH/2} stroke={dim} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={rectX+sB+18} y1={rectY+sH/2} x2={rectX+sB}    y2={rectY+sH/2} />
      <Arr x1={rectX+sB+18} y1={rectY+sH/2} x2={rectX+sB-sT} y2={rectY+sH/2} />
      <text x={rectX+sB+22} y={rectY+sH/2+4} fontSize={fs} fill={dim} textAnchor="start">t={t}</text>

      {/* h – left */}
      <line x1={rectX-10} y1={rectY} x2={rectX-10} y2={rectY+sH} stroke={dim} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={rectX-10} y1={rectY+sH/2+8} x2={rectX-10} y2={rectY+sH} />
      <Arr x1={rectX-10} y1={rectY+sH/2-8} x2={rectX-10} y2={rectY} />
      <text x={rectX-22} y={rectY+sH/2+4} textAnchor="middle" fontSize={fs} fill={dim}
        transform={`rotate(-90,${rectX-22},${rectY+sH/2+4})`}>h={h}</text>

      {/* b – top */}
      <line x1={rectX} y1={rectY-10} x2={rectX+sB} y2={rectY-10} stroke={dim} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={cx-12} y1={rectY-10} x2={rectX}      y2={rectY-10} />
      <Arr x1={cx+12} y1={rectY-10} x2={rectX+sB}   y2={rectY-10} />
      <text x={cx} y={rectY-15} textAnchor="middle" fontSize={fs} fill={dim}>b={b}</text>
    </svg>
  )
}

// ── Channel section (UPE) ────────────────────────────────────────────────────
function Channel({ h, b, tf, tw, svgW, svgH, pad, fill, dim, fs, Arr }) {
  const scale = Math.min((svgH - pad * 2) / h, (svgW - pad * 2) / b)
  const sH = h * scale, sB = b * scale, sTf = tf * scale, sTw = tw * scale

  const cx      = svgW / 2
  const topY    = (svgH - sH) / 2
  // Align web to left side of section
  const webX    = cx - sB / 2
  const flangeX = webX

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} width={svgW} height={svgH} style={{ fontFamily: 'sans-serif' }}>
      {/* Top flange */}
      <rect x={flangeX} y={topY}             width={sB}  height={sTf}           fill={fill} />
      {/* Web (left side) */}
      <rect x={webX}    y={topY + sTf}       width={sTw} height={sH - 2 * sTf} fill={fill} />
      {/* Bottom flange */}
      <rect x={flangeX} y={topY+sH - sTf}   width={sB}  height={sTf}           fill={fill} />

      {/* h – left */}
      <line x1={flangeX-10} y1={topY} x2={flangeX-10} y2={topY+sH} stroke={dim} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={flangeX-10} y1={topY+sH/2+8} x2={flangeX-10} y2={topY+sH} />
      <Arr x1={flangeX-10} y1={topY+sH/2-8} x2={flangeX-10} y2={topY} />
      <text x={flangeX-22} y={topY+sH/2+4} textAnchor="middle" fontSize={fs} fill={dim}
        transform={`rotate(-90,${flangeX-22},${topY+sH/2+4})`}>h={h}</text>

      {/* b – top */}
      <line x1={flangeX} y1={topY-10} x2={flangeX+sB} y2={topY-10} stroke={dim} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={flangeX+sB/2-12} y1={topY-10} x2={flangeX}    y2={topY-10} />
      <Arr x1={flangeX+sB/2+12} y1={topY-10} x2={flangeX+sB} y2={topY-10} />
      <text x={flangeX+sB/2} y={topY-15} textAnchor="middle" fontSize={fs} fill={dim}>b={b}</text>

      {/* tf – right side, top flange */}
      <line x1={flangeX+sB+8} y1={topY} x2={flangeX+sB+8} y2={topY+sTf} stroke={dim} strokeWidth=".8" />
      <Arr x1={flangeX+sB+8} y1={topY+sTf/2+5} x2={flangeX+sB+8} y2={topY+sTf} />
      <Arr x1={flangeX+sB+8} y1={topY+sTf/2-5} x2={flangeX+sB+8} y2={topY} />
      <text x={flangeX+sB+18} y={topY+sTf/2+4} textAnchor="start" fontSize={fs} fill={dim}>tf={tf}</text>

      {/* tw – bottom, web */}
      <line x1={webX} y1={topY+sH+10} x2={webX+sTw} y2={topY+sH+10} stroke={dim} strokeWidth=".8" />
      <Arr x1={webX+sTw/2-5} y1={topY+sH+10} x2={webX}      y2={topY+sH+10} />
      <Arr x1={webX+sTw/2+5} y1={topY+sH+10} x2={webX+sTw}  y2={topY+sH+10} />
      <text x={webX+sTw/2} y={topY+sH+22} textAnchor="middle" fontSize={fs} fill={dim}>tw={tw}</text>
    </svg>
  )
}
