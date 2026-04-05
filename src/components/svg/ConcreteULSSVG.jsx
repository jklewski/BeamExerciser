/**
 * ConcreteULSSVG – proportional three-panel concrete beam ULS figure.
 *
 * Props (mm / MPa):
 *   b       – section width (mm)
 *   h       – section height (mm)
 *   cover   – nominal cover to stirrup face (mm)
 *   n_bot   – number of bottom (tension) bars
 *   dia_bot – diameter of bottom bars (mm)
 *   n_top   – number of top (compression) bars  (0 = none)
 *   dia_top – diameter of top bars (mm)
 *   fc      – concrete cylinder strength (MPa)
 *   fy      – steel yield strength (MPa)
 */
export default function ConcreteULSSVG({
  b          = 200,
  h          = 400,
  cover      = 30,
  n_bot      = 3,
  dia_bot    = 20,
  n_top      = 0,
  dia_top    = 10,
  fc         = 25,
  fy         = 500,
  sectionOnly = false,
  label       = null,
}) {
  // ── Derived geometry ───────────────────────────────────────────────────
  const d_p  = cover + dia_top / 2
  const A_s  = n_bot * Math.PI * (dia_bot / 2) ** 2
  const A_sp = n_top > 0 ? n_top * Math.PI * (dia_top / 2) ** 2 : 0

  // Bar x-positions in mm from left edge (evenly spaced between covers)
  function barXPos(n, dia) {
    if (n <= 0) return []
    const xMin = cover + dia / 2
    const xMax = b - cover - dia / 2
    if (n === 1) return [b / 2]
    return Array.from({ length: n }, (_, i) => xMin + i * (xMax - xMin) / (n - 1))
  }

  // Max bars per layer (EC2: clear ≥ max(20 mm, dia))
  const c_clear = Math.max(20, dia_bot)
  const nmax     = Math.max(1, Math.floor((b - 2 * (dia_bot + cover)) / (2 * dia_bot)))
  const n_bot_L1 = Math.min(n_bot, nmax)   // fill layer 1 first
  const n_bot_L2 = Math.max(0, n_bot - n_bot_L1)

  // Layer y-depths from top (layer 1 = closest to bottom face)
  const yBotL1 = h - cover - dia_bot / 2
  const yBotL2 = yBotL1 - dia_bot - c_clear   // EC2 min clear spacing between layers

  // Effective depth: weighted average of both layers
  const d = Math.round(n_bot_L2 > 0
    ? (n_bot_L1 * yBotL1 + n_bot_L2 * yBotL2) / n_bot
    : yBotL1)

  // All bottom bars as { x, y } pairs
  const barsBot = [
    ...barXPos(n_bot_L1, dia_bot).map(x => ({ x, y: yBotL1 })),
    ...barXPos(n_bot_L2, dia_bot).map(x => ({ x, y: yBotL2 })),
  ]

  const xBarsTop = barXPos(n_top, dia_top)
  const yBarTop  = cover + dia_top / 2

  // ── Material ───────────────────────────────────────────────────────────
  const eps_cu = 3.5e-3
  const E_cm   = 30000
  const eps_c1 = 0.7 * Math.pow(fc, 0.31) * 1e-3
  const k_sar  = 1.05 * E_cm * eps_c1 / fc
  const E_s    = 200000

  // Sargin parabolic concrete stress (compression, MPa)
  function sigC(eps) {
    if (eps <= 0) return 0
    const n = Math.min(eps, eps_cu) / eps_c1
    return fc * (k_sar * n - n * n) / ((k_sar - 2) * n + 1)
  }

  // Force-equilibrium residual at neutral axis depth xc
  function residual(xc) {
    let F_c = 0
    const M = 120
    for (let i = 0; i < M; i++) {
      const y = xc * (i + 0.5) / M
      F_c += sigC(eps_cu * y / xc) * b * (xc / M)
    }
    const eps_sp = eps_cu * (xc - d_p) / xc
    const eps_s  = eps_cu * (d   - xc) / xc
    return F_c
      + Math.min(eps_sp * E_s, fy) * A_sp
      - Math.min(eps_s  * E_s, fy) * A_s
  }

  // Bisection: find x_na ∈ [d_p + 1, d − 1]
  let x_lo = d_p + 1, x_hi = d - 1
  for (let i = 0; i < 60; i++) {
    const xm = (x_lo + x_hi) / 2
    if (residual(x_lo) * residual(xm) <= 0) x_hi = xm
    else x_lo = xm
  }
  const x_na = (x_lo + x_hi) / 2

  const eps_s_uls  = eps_cu * (d   - x_na) / x_na
  const eps_sp_uls = eps_cu * (x_na - d_p) / x_na
  const sig_s_uls  = Math.min(eps_s_uls  * E_s, fy)
  const sig_sp_uls = Math.min(eps_sp_uls * E_s, fy)

  // ── Proportional SVG layout ────────────────────────────────────────────
  const MAX_W = 90    // max section width in px
  const MAX_H = 175   // max section height in px
  const sc     = Math.min(MAX_W / b, MAX_H / h)   // mm → px
  const sec_w  = b * sc
  const sec_h  = h * sc

  const topY   = 28
  const p1left = 32                   // left edge of section rect
  const p1right = p1left + sec_w
  const p2z    = p1right + 85         // zero-stress axis
  const p3z    = p2z + 150            // zero-strain axis
  const SVG_W  = sectionOnly ? Math.ceil(p1right + 30) : Math.ceil(p3z + 88)
  const SVG_H  = Math.ceil(topY + sec_h + 30)

  const tY  = (y_mm) => topY  + y_mm * sc     // mm depth  → SVG y
  const tX1 = (x_mm) => p1left + x_mm * sc    // mm offset → SVG x (section)

  // Stress profile (compression block, extends right from p2z)
  const sigScPx  = 70 / fc                     // px / MPa  (compression)
  const sigScT   = 45 / fy                     // px / MPa  (tension bar, fixed max)
  const N_pts    = 50
  const stressPts = Array.from({ length: N_pts + 1 }, (_, i) => {
    const y_mm = x_na * i / N_pts
    return `${(p2z + sigC(eps_cu * (x_na - y_mm) / x_na) * sigScPx).toFixed(1)},${tY(y_mm).toFixed(1)}`
  })
  const stressPoly = [`${p2z},${topY}`, ...stressPts, `${p2z},${tY(x_na)}`].join(' ')

  // Strain (compression negative = left, tension positive = right)
  const eps_top    = -eps_cu
  const eps_bot    = eps_cu * (h - x_na) / x_na
  const strainMax  = Math.max(eps_cu, eps_s_uls) * 1.1
  const strainScPx = 60 / strainMax
  const tX3 = (eps) => p3z + eps * strainScPx

  // ── Colours ────────────────────────────────────────────────────────────
  const dc       = '#6b7280'
  const blk      = '#374151'
  const compClr  = '#1e3a5f'
  const tensClr  = '#b91c1c'
  const fs       = 9

  // ── Helpers ────────────────────────────────────────────────────────────
  function VBrace({ x, y1, y2, label, side = 'left' }) {
    const mid  = (y1 + y2) / 2
    const tx   = side === 'left' ? x - 6 : x + 6
    const anch = side === 'left' ? 'end' : 'start'
    return (
      <g>
        <line x1={x - 4} y1={y1} x2={x + 4} y2={y1} stroke={dc} strokeWidth={0.7} />
        <line x1={x - 4} y1={y2} x2={x + 4} y2={y2} stroke={dc} strokeWidth={0.7} />
        <line x1={x}     y1={y1} x2={x}     y2={y2} stroke={dc} strokeWidth={0.7} />
        <text x={tx} y={mid + 3.5} textAnchor={anch} fontSize={8} fill={dc}>{label}</text>
      </g>
    )
  }

  function PanelAxis({ x0, y1, y2 }) {
    return (
      <g>
        <line x1={x0} y1={y1 - 5} x2={x0} y2={y2 + 5} stroke={dc} strokeWidth={0.8} />
        <line x1={x0 - 3} y1={y1} x2={x0 + 3} y2={y1} stroke={dc} strokeWidth={0.8} />
        <line x1={x0 - 3} y1={y2} x2={x0 + 3} y2={y2} stroke={dc} strokeWidth={0.8} />
      </g>
    )
  }

  const botY = topY + sec_h

  return (
    <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} width={SVG_W} height={SVG_H}
      style={{ fontFamily: 'sans-serif', overflow: 'visible' }}>

      {/* Titles */}
      {label && (
        <text x={p1left + sec_w / 2} y={14} textAnchor="middle" fontSize={fs + 1}
          fontWeight="bold" fill={blk}>{label}</text>
      )}
      {!label && <text x={p1left + sec_w / 2} y={14} textAnchor="middle" fontSize={fs} fill={dc}>Tvärsnitt</text>}
      {!sectionOnly && <text x={p2z + 35} y={14} textAnchor="middle" fontSize={fs} fill={dc}>Spänning</text>}
      {!sectionOnly && <text x={p3z + 10} y={14} textAnchor="middle" fontSize={fs} fill={dc}>Töjning</text>}

      {/* ══ PANEL 1: Cross-section ══════════════════════════════════════ */}

      <rect x={p1left} y={topY} width={sec_w} height={sec_h}
        fill="#d1dce8" stroke={blk} strokeWidth={1.5} />

      {/* Compression zone tint — only in full mode */}
      {!sectionOnly && (
        <rect x={p1left + 1} y={topY + 1}
          width={sec_w - 2} height={Math.max(0, tY(x_na) - topY - 1)}
          fill="rgba(30,58,95,0.10)" />
      )}

      {/* Neutral axis — only in full mode */}
      {!sectionOnly && (
        <line x1={p1left - 6} y1={tY(x_na)} x2={p1right + 6} y2={tY(x_na)}
          stroke={dc} strokeWidth={0.9} strokeDasharray="3,2" />
      )}

      {/* Bottom bars (tension) */}
      {barsBot.map(({ x, y }, i) => (
        <circle key={`bt${i}`} cx={tX1(x)} cy={tY(y)}
          r={Math.max(2, dia_bot * sc / 2)} fill={blk} />
      ))}

      {/* Top bars (compression) */}
      {xBarsTop.map((xb, i) => (
        <circle key={`tp${i}`} cx={tX1(xb)} cy={tY(yBarTop)}
          r={Math.max(1.5, dia_top * sc / 2)} fill={blk} />
      ))}

      {/* h brace – left */}
      <VBrace x={p1left - 18} y1={topY} y2={botY} label={`h=${h}`} />

      {/* b dimension – below */}
      <line x1={p1left}  y1={botY + 8} x2={p1right} y2={botY + 8} stroke={dc} strokeWidth={0.7} />
      <line x1={p1left}  y1={botY + 5} x2={p1left}  y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <line x1={p1right} y1={botY + 5} x2={p1right} y2={botY + 11} stroke={dc} strokeWidth={0.7} />
      <text x={p1left + sec_w / 2} y={botY + 20}
        textAnchor="middle" fontSize={8} fill={dc}>b={b}</text>

      {/* d brace – right (hidden in section-only / problem description) */}
      {!sectionOnly && (
        <VBrace x={p1right + 18} y1={topY} y2={tY(d)} label={`d=${d}`} side="right" />
      )}

      {/* ══ PANEL 2: Stress ═════════════════════════════════════════════ */}

      {!sectionOnly && <PanelAxis x0={p2z} y1={topY} y2={botY} />}

      {!sectionOnly && (
        <>
          {/* Compression block */}
          <polygon points={stressPoly} fill="rgba(30,58,95,0.22)" stroke={compClr} strokeWidth={1.2} />

          {/* x brace */}
          <VBrace x={p2z - 18} y1={topY} y2={tY(x_na)} label="x" />

          {/* x value */}
          <text x={p2z + 4} y={tY(x_na) + 11} fontSize={8} fill={compClr}>
            x={x_na.toFixed(0)} mm
          </text>

          {/* Compression steel stress tick */}
          {n_top > 0 && (
            <>
              <line x1={p2z} y1={tY(yBarTop)} x2={p2z + sig_sp_uls * sigScT} y2={tY(yBarTop)}
                stroke={compClr} strokeWidth={2} />
              <circle cx={p2z + sig_sp_uls * sigScT} cy={tY(yBarTop)} r={2.5} fill={compClr} />
              <text x={p2z + sig_sp_uls * sigScT + 3} y={tY(yBarTop) - 3}
                fontSize={7.5} fill={compClr}>{sig_sp_uls.toFixed(0)} MPa</text>
            </>
          )}

          {/* Tension steel stress bar (extends left) */}
          <line x1={p2z} y1={tY(d)} x2={p2z - sig_s_uls * sigScT} y2={tY(d)}
            stroke={tensClr} strokeWidth={2} />
          <circle cx={p2z - sig_s_uls * sigScT} cy={tY(d)} r={2.5} fill={tensClr} />
          <text x={p2z - sig_s_uls * sigScT - 3} y={tY(d) - 4}
            textAnchor="end" fontSize={7.5} fill={tensClr}>{sig_s_uls.toFixed(0)} MPa</text>
        </>
      )}

      {/* ══ PANEL 3: Strain ═════════════════════════════════════════════ */}

      {!sectionOnly && <PanelAxis x0={p3z} y1={topY} y2={botY} />}

      {!sectionOnly && (
        <>
          {/* Strain polygon (compression = left of p3z, tension = right) */}
          <polygon
            points={[
              `${p3z},${topY}`,
              `${tX3(eps_top)},${topY}`,
              `${tX3(eps_bot)},${botY}`,
              `${p3z},${botY}`,
            ].join(' ')}
            fill="rgba(30,58,95,0.10)" stroke="none"
          />
          <line
            x1={tX3(eps_top)} y1={topY}
            x2={tX3(eps_bot)} y2={botY}
            stroke={compClr} strokeWidth={1.5}
          />

          {/* Neutral axis marker */}
          <circle cx={p3z} cy={tY(x_na)} r={2.5} fill={dc} />

          {/* ε_cu label at top */}
          <text x={tX3(eps_top)} y={topY - 4}
            textAnchor="middle" fontSize={7.5} fill={compClr}>ε_cu</text>
          <text x={tX3(eps_top)} y={topY - 4 + 9}
            textAnchor="middle" fontSize={7} fill={dc}>{(eps_cu * 1000).toFixed(1)}‰</text>

          {/* ε_s marker at tension steel level */}
          <line x1={p3z} y1={tY(d)} x2={tX3(eps_s_uls)} y2={tY(d)}
            stroke={tensClr} strokeWidth={1} strokeDasharray="2,2" />
          <circle cx={tX3(eps_s_uls)} cy={tY(d)} r={2} fill={tensClr} />
          <text x={tX3(eps_s_uls) + 3} y={tY(d) + 3}
            fontSize={7.5} fill={tensClr}>ε_s</text>
          <text x={tX3(eps_s_uls) + 3} y={tY(d) + 12}
            fontSize={7} fill={tensClr}>{(eps_s_uls * 1000).toFixed(2)}‰</text>
        </>
      )}

    </svg>
  )
}
