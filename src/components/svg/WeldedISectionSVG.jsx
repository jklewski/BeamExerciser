/**
 * WeldedISectionSVG – draws a welded plate-girder / welded I-section with dimension labels.
 *
 * Props (all mm):
 *   hw  – web height (between flanges)
 *   tw  – web plate thickness
 *   bf  – flange width
 *   tf  – flange plate thickness
 *   a   – weld throat (a-measure); leg = a√2
 */
export default function WeldedISectionSVG({ hw = 620, tw = 6, bf = 200, tf = 10, a = 5 }) {
  const W = 260, H = 285

  // Scale so bf → 120 px and h_total → 200 px, then snap thin parts to min px
  const h_total = hw + 2 * tf
  const scaleX  = 120 / bf
  const scaleY  = 200 / h_total

  const bf_px  = bf  * scaleX                              // ≈ 120
  const tf_px  = Math.max(tf * scaleY, 7)                  // min 7 px
  const tw_px  = Math.max(tw * scaleX, 4)                  // min 4 px
  const hw_px  = hw  * scaleY
  const leg_px = Math.max(a * Math.SQRT2 * scaleY, 7)      // weld leg, min 7 px
  const h_draw = 2 * tf_px + hw_px

  // Section centre-x and top-y (leave 50 px left margin for hw label)
  const cx   = 50 + bf_px / 2
  const topY = (H - h_draw) / 2

  const tfBot  = topY + tf_px
  const bfTop  = topY + tf_px + hw_px
  const bfBot  = bfTop + tf_px

  const flL = cx - bf_px / 2
  const flR = cx + bf_px / 2
  const wbL = cx - tw_px / 2
  const wbR = cx + tw_px / 2

  const fill = '#1e3a5f'
  const dc   = '#6b7280'
  const fs   = 10

  // Two-headed dimension arrow (same helper as IPESection)
  function Arr({ x1, y1, x2, y2 }) {
    const dx = x2 - x1, dy = y2 - y1
    const len = Math.hypot(dx, dy)
    if (len < 1) return null
    const ux = dx / len, uy = dy / len, hs = 5
    return (
      <g>
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={dc} strokeWidth="1" />
        <polygon
          points={`${x2},${y2} ${x2-ux*hs-uy*hs*.5},${y2-uy*hs+ux*hs*.5} ${x2-ux*hs+uy*hs*.5},${y2-uy*hs-ux*hs*.5}`}
          fill={dc}
        />
      </g>
    )
  }

  // Thin flange tick: two parallel tick marks + connecting line + text
  function TfLabel({ y1, y2, x, label }) {
    const mid = (y1 + y2) / 2
    return (
      <g>
        <line x1={x - 4} y1={y1} x2={x + 10} y2={y1} stroke={dc} strokeWidth=".8" />
        <line x1={x - 4} y1={y2} x2={x + 10} y2={y2} stroke={dc} strokeWidth=".8" />
        <line x1={x + 6} y1={y1} x2={x + 6}  y2={y2} stroke={dc} strokeWidth=".8" />
        <text x={x + 14} y={mid + 3.5} fontSize={fs} fill={dc}>{label}</text>
      </g>
    )
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: 'sans-serif' }}>

      {/* ── Plates ── */}
      <rect x={flL} y={topY}  width={bf_px} height={tf_px} fill={fill} />
      <rect x={wbL} y={tfBot} width={tw_px} height={hw_px} fill={fill} />
      <rect x={flL} y={bfTop} width={bf_px} height={tf_px} fill={fill} />

      {/* ── Weld fillets – right-angle triangle at each of the 4 corners ── */}
      <polygon points={`${wbL-leg_px},${tfBot} ${wbL},${tfBot} ${wbL},${tfBot+leg_px}`} fill={fill} />
      <polygon points={`${wbR+leg_px},${tfBot} ${wbR},${tfBot} ${wbR},${tfBot+leg_px}`} fill={fill} />
      <polygon points={`${wbL-leg_px},${bfTop} ${wbL},${bfTop} ${wbL},${bfTop-leg_px}`} fill={fill} />
      <polygon points={`${wbR+leg_px},${bfTop} ${wbR},${bfTop} ${wbR},${bfTop-leg_px}`} fill={fill} />

      {/* ── hw – left side, between flanges ── */}
      <Arr x1={flL-14} y1={tfBot + hw_px/2 - 8} x2={flL-14} y2={tfBot} />
      <Arr x1={flL-14} y1={tfBot + hw_px/2 + 8} x2={flL-14} y2={bfTop} />
      <text
        x={flL - 26} y={tfBot + hw_px / 2 + 4}
        textAnchor="middle" fontSize={fs} fill={dc}
        transform={`rotate(-90,${flL-26},${tfBot + hw_px/2 + 4})`}
      >
        {hw}
      </text>

      {/* ── tf – top and bottom flanges, right side ── */}
      <TfLabel y1={topY} y2={tfBot} x={flR + 4} label={tf} />
      <TfLabel y1={bfTop} y2={bfBot} x={flR + 4} label={tf} />

      {/* ── bf – below section ── */}
      <line x1={flL} y1={bfBot+10} x2={flR} y2={bfBot+10}
        stroke={dc} strokeWidth=".8" strokeDasharray="3,2" />
      <Arr x1={cx - bf_px/4} y1={bfBot+10} x2={flL} y2={bfBot+10} />
      <Arr x1={cx + bf_px/4} y1={bfBot+10} x2={flR} y2={bfBot+10} />
      <text x={cx} y={bfBot+22} textAnchor="middle" fontSize={fs} fill={dc}>{bf}</text>

      {/* ── tw – leader line from web edge to right ── */}
      <line
        x1={wbR} y1={tfBot + hw_px * 0.5}
        x2={flR + 38} y2={tfBot + hw_px * 0.5}
        stroke={dc} strokeWidth=".9" strokeDasharray="3,2"
      />
      <text x={flR + 40} y={tfBot + hw_px * 0.5 + 4} fontSize={fs} fill={dc}>tw={tw}</text>

      {/* ── Weld label – diagonal leader from top-right weld corner ── */}
      <line
        x1={wbR + leg_px * 0.5} y1={tfBot + leg_px * 0.5}
        x2={flR - 8} y2={topY - 13}
        stroke={dc} strokeWidth=".9"
      />
      <text x={flR - 6} y={topY - 15} textAnchor="start" fontSize={fs} fill={dc}>a={a}</text>

    </svg>
  )
}
