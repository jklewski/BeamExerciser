/**
 * MomentDiagramSVG – renders V(x), M(x) and optionally v(x) for a beam.
 *
 * Two modes:
 *
 * 1. Analytic (statically determinate beams):
 *    Provide L, supports, udl, pointLoads, overhang – M and V are computed
 *    internally using direct equilibrium.
 *
 * 2. Precomputed (statically indeterminate beams, from beamSolverDSM):
 *    Provide precomputed = { mXs, mVals, vXs, vVals, deflXs?, deflVals?, Ltot, nodes? }
 *    The drawing is identical in both modes.
 *
 * Props (analytic mode):
 *   L          – span in metres
 *   overhang   – optional overhang past right support (default 0)
 *   supports   – { left, right } 'pin'|'roller'|'fixed'|'free'
 *   udl        – [{ q, xStart?, xEnd? }]
 *   pointLoads – [{ P, x }]
 *   divisions  – optional panel lengths for tick labels
 *
 * Props (precomputed mode):
 *   precomputed – { mXs, mVals, vXs, vVals, Ltot, nodes?, deflXs?, deflVals? }
 *
 * Display options (all default to their natural state):
 *   showMoment     – show M(x) diagram (default true)
 *   showShear      – show V(x) diagram (default false)
 *   showDeflection – show v(x) diagram; requires deflXs/deflVals in precomputed (default false)
 *   showPeakAnnotations – annotate peak values (default true)
 *
 * Sign convention:
 *   Positive M = sagging → plots downward (tension face)
 *   Positive V = as computed from equilibrium (left-face positive upward)
 *   Positive v = downward deflection → plots downward (consistent with M)
 */
export default function MomentDiagramSVG({
  // analytic props
  L = 0,
  overhang = 0,
  supports = { left: 'pin', right: 'roller' },
  udl = [],
  pointLoads = [],
  divisions = null,
  // display options
  showMoment = true,
  showShear = false,
  showDeflection = false,
  showPeakAnnotations = true,
  // DSM precomputed data
  precomputed = null,
}) {
  const Ltot = precomputed?.Ltot ?? (L + overhang)

  // ── Analytic solver (statically determinate) ──────────────────────────────
  let R_A = 0, M_A = 0, R_B = 0
  if (!precomputed) {
    let totalLoad = 0, momentAboutA = 0
    for (const load of udl) {
      const q_i  = load.q
      const xs   = load.xStart ?? 0
      const xe   = load.xEnd   ?? Ltot
      const len  = xe - xs
      totalLoad    += q_i * len
      momentAboutA += q_i * len * (xs + len / 2)
    }
    for (const { P, x } of pointLoads) {
      totalLoad    += P
      momentAboutA += P * x
    }
    const leftFixed  = supports?.left  === 'fixed'
    const rightFixed = supports?.right === 'fixed'
    if (leftFixed) {
      R_A = totalLoad; M_A = -momentAboutA; R_B = 0
    } else if (rightFixed) {
      R_A = 0; M_A = 0; R_B = 0
    } else {
      R_B = momentAboutA / L
      R_A = totalLoad - R_B
      M_A = 0
    }
  }

  function M_analytic(x) {
    let M = M_A + R_A * x
    for (const load of udl) {
      const q_i = load.q, xs = load.xStart ?? 0, xe = load.xEnd ?? Ltot
      if (x > xs) { const a = Math.min(x, xe) - xs; M -= q_i * a * (x - xs - a / 2) }
    }
    for (const { P, x: xP } of pointLoads) { if (x > xP) M -= P * (x - xP) }
    if (overhang > 0 && x > L) M += R_B * (x - L)
    return M
  }

  function V_analytic(x) {
    let V = R_A
    for (const load of udl) {
      const q_i = load.q, xs = load.xStart ?? 0, xe = load.xEnd ?? Ltot
      if (x > xs) V -= q_i * (Math.min(x, xe) - xs)
    }
    for (const { P, x: xP } of pointLoads) { if (x > xP) V -= P }
    if (overhang > 0 && x > L) V += R_B
    return V
  }

  // ── Sample arrays ──────────────────────────────────────────────────────────
  let mXs, mVals, vXs, vVals
  if (precomputed) {
    ;({ mXs, mVals, vXs, vVals } = precomputed)
  } else {
    const N    = 100
    const grid = Array.from({ length: N + 1 }, (_, i) => (i / N) * Ltot)
    const keyXs = [0, Ltot, ...pointLoads.map(pl => pl.x)]
    if (overhang > 0) keyXs.push(L)
    if (divisions) { let cx = 0; divisions.forEach(d => { cx += d; keyXs.push(cx) }) }
    mXs = [...new Set([...grid, ...keyXs])].sort((a, b) => a - b)
    const eps = 1e-6
    vXs = [...new Set([
      ...mXs,
      ...pointLoads.flatMap(({ x: xP }) => [xP - eps, xP + eps]),
      ...(overhang > 0 ? [L - eps, L + eps] : []),
    ])].sort((a, b) => a - b)
    mVals = mXs.map(M_analytic)
    vVals = vXs.map(V_analytic)
  }

  // ── Deflection data ────────────────────────────────────────────────────────
  const deflXs   = (showDeflection && precomputed?.deflXs)  || null
  const deflVals = (showDeflection && precomputed?.deflVals) || null
  const hasDefl  = !!(deflXs && deflVals && deflVals.length > 0)

  // ── Support node x-positions (metres) ─────────────────────────────────────
  // In precomputed mode, nodes array from DSM. In analytic mode, [0, L].
  const supportXm = precomputed?.nodes ?? [0, L + overhang]

  // ── Geometry ───────────────────────────────────────────────────────────────
  const W = 520
  const x0 = 70, x1 = 450, beamLen = x1 - x0
  const topPad     = 28
  const divLabelH  = divisions ? 18 : 0

  const M_pos   = Math.max(0, ...mVals)
  const M_neg   = Math.min(0, ...mVals)
  const M_range = (M_pos - M_neg) || 1

  // Moment panel: only allocate height when shown
  const mH      = showMoment ? 110 : 0
  const M_scale = mH > 0 ? mH / M_range : 0
  const mAboveH = mH > 0 ? (-M_neg) * M_scale : 0
  const mBelowH = mH > 0 ? M_pos   * M_scale : 0

  const beamY = topPad + divLabelH + mAboveH

  // Shear panel
  const gap        = 36
  const vH         = 80
  const shearBaseY = beamY + mBelowH + gap + vH / 2

  // Deflection panel
  const dflH     = 60
  const gap2     = 30
  const dflBaseY = showShear
    ? shearBaseY + vH / 2 + gap2 + dflH / 2
    : beamY + mBelowH + gap + dflH / 2

  const H = hasDefl
    ? dflBaseY + dflH / 2 + 28
    : showShear
      ? shearBaseY + vH / 2 + 22
      : beamY + mBelowH + (showMoment ? 30 : 16)

  const toSvgX = x => x0 + (x / Ltot) * beamLen
  const toSvgY = M => beamY + M * M_scale

  // ── SVG paths ──────────────────────────────────────────────────────────────
  const mPath = [
    `M ${x0},${beamY}`,
    ...mXs.map((x, i) => `L ${toSvgX(x).toFixed(1)},${toSvgY(mVals[i]).toFixed(1)}`),
    `L ${x1},${beamY} Z`,
  ].join(' ')

  const V_abs   = Math.max(...vVals.map(Math.abs)) || 1
  const V_scale = (vH / 2) / V_abs
  const vPath = [
    `M ${x0},${shearBaseY}`,
    ...vXs.map((x, i) => `L ${toSvgX(x).toFixed(1)},${(shearBaseY - vVals[i] * V_scale).toFixed(1)}`),
    `L ${x1},${shearBaseY} Z`,
  ].join(' ')

  const dfl_abs   = hasDefl ? (Math.max(...deflVals.map(Math.abs)) || 1) : 1
  const dfl_scale = (dflH / 2) / dfl_abs
  const deflPath  = hasDefl ? [
    `M ${x0},${dflBaseY}`,
    ...deflXs.map((x, i) => `L ${toSvgX(x).toFixed(1)},${(dflBaseY + deflVals[i] * dfl_scale).toFixed(1)}`),
    `L ${x1},${dflBaseY} Z`,
  ].join(' ') : ''

  // ── Peak annotations ───────────────────────────────────────────────────────
  const M_abs_max = Math.max(...mVals.map(Math.abs))
  const M_peak_i  = mVals.findIndex(m => Math.abs(m) === M_abs_max)
  const M_peak    = mVals[M_peak_i]
  const M_peak_sx = toSvgX(mXs[M_peak_i])
  const M_peak_sy = toSvgY(M_peak)

  const M_sec_val  = M_peak >= 0 ? M_neg : M_pos
  const showSecond = M_pos > 0.5 && M_neg < -0.5 && Math.abs(M_sec_val) > 0.1 * M_abs_max
  const M_sec_i    = M_peak >= 0 ? mVals.indexOf(M_neg) : mVals.indexOf(M_pos)
  const M_sec_sx   = showSecond ? toSvgX(mXs[M_sec_i]) : 0
  const M_sec_sy   = showSecond ? toSvgY(M_sec_val)     : 0

  const V_max_i = vVals.indexOf(Math.max(...vVals))
  const V_min_i = vVals.indexOf(Math.min(...vVals))

  const defl_abs_max = hasDefl ? Math.max(...deflVals.map(Math.abs)) : 0
  const defl_peak_i  = hasDefl ? deflVals.findIndex(v => Math.abs(v) === defl_abs_max) : 0
  const defl_peak    = hasDefl ? deflVals[defl_peak_i] : 0
  const defl_peak_sx = hasDefl ? toSvgX(deflXs[defl_peak_i]) : 0
  const defl_peak_sy = hasDefl ? dflBaseY + defl_peak * dfl_scale : 0

  // ── Support marker helper ──────────────────────────────────────────────────
  function SupportMarks({ baseY }) {
    const s = 4.5  // half-width of triangle
    return supportXm.map((xm, i) => {
      const sx = toSvgX(xm)
      return (
        <polygon key={i}
          points={`${sx},${baseY} ${sx - s},${baseY + s * 1.7} ${sx + s},${baseY + s * 1.7}`}
          fill="#374151" />
      )
    })
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ fontFamily: 'sans-serif' }}>

      {/* ── Division tick marks ── */}
      {divisions && (() => {
        const elems = []
        let cx = 0
        elems.push(<line key="tk0" x1={x0} y1={beamY - 5} x2={x0} y2={beamY + 3} stroke="#9ca3af" strokeWidth="1" />)
        divisions.forEach((d, i) => {
          const midSx = toSvgX(cx + d / 2)
          elems.push(
            <text key={`tl${i}`} x={midSx} y={beamY - divLabelH + 12} textAnchor="middle" fontSize="10" fill="#9ca3af">
              {d} m
            </text>
          )
          cx += d
          const ex = toSvgX(cx)
          elems.push(<line key={`tk${i}`} x1={ex} y1={beamY - 5} x2={ex} y2={beamY + 3} stroke="#9ca3af" strokeWidth="1" />)
        })
        return elems
      })()}

      {/* ── Support B tick (overhang beams) ── */}
      {overhang > 0 && (
        <line x1={toSvgX(L)} y1={beamY - 6} x2={toSvgX(L)} y2={beamY + 6}
          stroke="#6b7280" strokeWidth="1.5" />
      )}

      {/* ── Beam reference line + label ── */}
      <line x1={x0} y1={beamY} x2={x1} y2={beamY} stroke="#374151" strokeWidth="2" />
      {showMoment && (
        <text x={x0 - 6} y={beamY + 4} textAnchor="end" fontSize="10" fill="#374151">M</text>
      )}

      {/* ── Support markers on beam baseline ── */}
      <SupportMarks baseY={beamY} />

      {/* ── Zero line (only when both sagging and hogging) ── */}
      {showMoment && M_pos > 0 && M_neg < 0 && (
        <line x1={x0} y1={beamY} x2={x1} y2={beamY}
          stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,3" />
      )}

      {/* ── Moment diagram ── */}
      {showMoment && (
        <path d={mPath} fill="#bfdbfe" stroke="#2563eb" strokeWidth="1.5"
          fillRule="evenodd" opacity="0.92" />
      )}

      {/* ── Peak moment annotations ── */}
      {showMoment && showPeakAnnotations && (
        <>
          <line x1={M_peak_sx} y1={M_peak_sy}
            x2={M_peak_sx} y2={M_peak_sy + (M_peak >= 0 ? 12 : -12)}
            stroke="#1d4ed8" strokeWidth="1" strokeDasharray="3,2" />
          <text x={M_peak_sx} y={M_peak_sy + (M_peak >= 0 ? 24 : -14)}
            textAnchor="middle" fontSize="11" fill="#1d4ed8" fontWeight="600">
            {M_peak.toFixed(1)} kNm
          </text>
          {showSecond && (
            <>
              <line x1={M_sec_sx} y1={M_sec_sy}
                x2={M_sec_sx} y2={M_sec_sy + (M_sec_val >= 0 ? 12 : -12)}
                stroke="#1d4ed8" strokeWidth="1" strokeDasharray="3,2" />
              <text x={M_sec_sx} y={M_sec_sy + (M_sec_val >= 0 ? 24 : -14)}
                textAnchor="middle" fontSize="11" fill="#1d4ed8" fontWeight="600">
                {M_sec_val.toFixed(1)} kNm
              </text>
            </>
          )}
        </>
      )}

      {/* ── Shear force diagram ── */}
      {showShear && (
        <g>
          <line x1={x0} y1={shearBaseY} x2={x1} y2={shearBaseY}
            stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,3" />
          <text x={x0 - 6} y={shearBaseY + 4}         textAnchor="end" fontSize="10" fill="#9ca3af">0</text>
          <text x={x0 - 6} y={shearBaseY - vH/2 + 10} textAnchor="end" fontSize="10" fill="#374151">V</text>
          <SupportMarks baseY={shearBaseY} />
          <path d={vPath} fill="#fef3c7" stroke="#d97706" strokeWidth="1.5"
            fillRule="evenodd" opacity="0.92" />
          <text x={toSvgX(vXs[V_max_i])} y={shearBaseY - vVals[V_max_i] * V_scale - 5}
            textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="600">
            {vVals[V_max_i].toFixed(1)} kN
          </text>
          <text x={toSvgX(vXs[V_min_i])} y={shearBaseY - vVals[V_min_i] * V_scale + 15}
            textAnchor="middle" fontSize="11" fill="#b45309" fontWeight="600">
            {vVals[V_min_i].toFixed(1)} kN
          </text>
        </g>
      )}

      {/* ── Deflection diagram ── */}
      {hasDefl && (
        <g>
          <line x1={x0} y1={dflBaseY} x2={x1} y2={dflBaseY}
            stroke="#9ca3af" strokeWidth="1" strokeDasharray="4,3" />
          <text x={x0 - 6} y={dflBaseY + 4}           textAnchor="end" fontSize="10" fill="#9ca3af">0</text>
          <text x={x0 - 6} y={dflBaseY - dflH/2 + 10} textAnchor="end" fontSize="10" fill="#374151">v</text>
          <SupportMarks baseY={dflBaseY} />
          <path d={deflPath} fill="#d1fae5" stroke="#059669" strokeWidth="1.5"
            fillRule="evenodd" opacity="0.92" />
          <line x1={defl_peak_sx} y1={defl_peak_sy}
            x2={defl_peak_sx} y2={defl_peak_sy + (defl_peak >= 0 ? 12 : -12)}
            stroke="#059669" strokeWidth="1" strokeDasharray="3,2" />
          <text x={defl_peak_sx} y={defl_peak_sy + (defl_peak >= 0 ? 24 : -14)}
            textAnchor="middle" fontSize="11" fill="#065f46" fontWeight="600">
            {precomputed?.normalizedDefl ? 'shape' : `${(defl_peak * 1000).toFixed(2)} mm`}
          </text>
        </g>
      )}
    </svg>
  )
}
