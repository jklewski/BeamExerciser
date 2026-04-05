/**
 * beamSolverDSM – Direct Stiffness Method solver for Euler-Bernoulli beams.
 * Pure JS, no external dependencies. Handles statically indeterminate beams
 * (continuous spans, fixed supports, interior supports).
 *
 * @param {object}           opts
 * @param {number[]}         opts.spans          Span lengths in metres [L0, L1, ...]
 * @param {string[]}         opts.supports       'pin'|'fixed'|'free' per node (n+1 entries)
 * @param {number[]}         [opts.udls]         UDL in kN/m per span, positive = downward.
 *                                               Each entry covers that span fully.
 *                                               Kept for backwards compatibility.
 * @param {{q,xStart,xEnd}[]} [opts.distributedLoads]
 *                                               Distributed loads with global positions (m).
 *                                               Supports partial-span loading. Takes precedence
 *                                               over opts.udls when both are supplied.
 * @param {{x,P}[]}          [opts.pointLoads]   Point loads: x = global pos (m), P = kN downward
 * @param {number|number[]}  [opts.EI]           Flexural stiffness in kNm², scalar or per span.
 *                                               If omitted the solver uses EI=1 (normalised) and
 *                                               deflection output is suppressed.
 *
 * @returns {{
 *   nodes:     number[],        node x-coordinates (m)
 *   reactions: {x,Fy,M}[],     reactions at each node (kN upward, kNm CCW)
 *   Ltot:      number,          total beam length (m)
 *   mXs:       number[],        x positions for moment diagram
 *   mVals:     number[],        M values (kNm), sagging = positive
 *   vXs:       number[],        x positions for shear diagram (eps-pairs at point loads)
 *   vVals:     number[],        V values (kN)
 *   deflXs:    number[]|null,   x positions for deflection (null if EI omitted)
 *   deflVals:  number[]|null,   v values (m), downward = positive (null if EI omitted)
 *   peaks:     {Vmax,Mmax,vmax}
 * }}
 */
export function beamSolverDSM({ spans, supports, udls, distributedLoads, pointLoads = [], EI = null }) {
  // ── Setup ──────────────────────────────────────────────────────────────────
  const nEl    = spans.length
  const nNodes = nEl + 1
  const nDOF   = 2 * nNodes

  const nodes = [0]
  for (let i = 0; i < nEl; i++) nodes.push(nodes[i] + spans[i])
  const Ltot = nodes[nNodes - 1]

  // Build unified distributed-load list.
  // If distributedLoads is provided use it directly; otherwise convert per-span udls.
  const dLoads = []
  if (distributedLoads && distributedLoads.length > 0) {
    for (const dl of distributedLoads) dLoads.push(dl)
  } else if (udls && udls.length === nEl) {
    for (let e = 0; e < nEl; e++) {
      if (udls[e]) dLoads.push({ q: udls[e], xStart: nodes[e], xEnd: nodes[e + 1] })
    }
  }

  const hasEI = EI !== null
  const EIe   = !hasEI           ? new Array(nEl).fill(1)
              : Array.isArray(EI) ? EI
              :                    new Array(nEl).fill(Number(EI))

  // ── Global stiffness matrix ────────────────────────────────────────────────
  const K = Array.from({ length: nDOF }, () => new Array(nDOF).fill(0))
  for (let e = 0; e < nEl; e++) {
    const L = spans[e], ei = EIe[e]
    const L2 = L * L, L3 = L2 * L
    const ke = [
      [ 12/L3,   6/L2, -12/L3,   6/L2],
      [  6/L2,   4/L,   -6/L2,   2/L ],
      [-12/L3,  -6/L2,  12/L3,  -6/L2],
      [  6/L2,   2/L,   -6/L2,   4/L ],
    ]
    const d = [2*e, 2*e+1, 2*e+2, 2*e+3]
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        K[d[i]][d[j]] += ei * ke[i][j]
  }

  // ── Equivalent nodal load vector ───────────────────────────────────────────
  const F = new Array(nDOF).fill(0)

  // Distributed load FEF — exact integrals of Hermite shape functions over [a, b].
  //
  // For a UDL q over local [a, b] on element of span L, the fixed-end forces are:
  //   F1 = -q ∫[a,b] H1 dx = -q[(b-a) - (b³-a³)/L² + (b⁴-a⁴)/(2L³)]
  //   F2 = -q ∫[a,b] H2 dx = -q[(b²-a²)/2 - 2(b³-a³)/(3L) + (b⁴-a⁴)/(4L²)]
  //   F3 = -q ∫[a,b] H3 dx = -q[(b³-a³)/L² - (b⁴-a⁴)/(2L³)]
  //   F4 = -q ∫[a,b] H4 dx = -q[-(b³-a³)/(3L) + (b⁴-a⁴)/(4L²)]
  //
  // When a=0, b=L these reduce to the standard full-span values ±qL/2, ±qL²/12.
  for (const { q, xStart, xEnd } of dLoads) {
    for (let e = 0; e < nEl; e++) {
      const a = Math.max(0, xStart - nodes[e])
      const b = Math.min(spans[e], xEnd - nodes[e])
      if (b <= a + 1e-12) continue
      const L  = spans[e]
      const L2 = L * L, L3 = L2 * L
      const a2 = a*a, a3 = a2*a, a4 = a3*a
      const b2 = b*b, b3 = b2*b, b4 = b3*b
      F[2*e]     -= q * ((b - a)   - (b3 - a3) / L2      + (b4 - a4) / (2 * L3))
      F[2*e + 1] -= q * ((b2 - a2) / 2 - 2 * (b3 - a3) / (3 * L) + (b4 - a4) / (4 * L2))
      F[2*e + 2] -= q * ((b3 - a3) / L2 - (b4 - a4) / (2 * L3))
      F[2*e + 3] -= q * (-(b3 - a3) / (3 * L) + (b4 - a4) / (4 * L2))
    }
  }

  // Point load fixed-end forces
  for (const { x: xP, P } of pointLoads) {
    let e = nEl - 1
    for (let i = 0; i < nEl; i++) {
      if (xP <= nodes[i + 1] + 1e-12) { e = i; break }
    }
    const a = xP - nodes[e]
    const b = nodes[e + 1] - xP
    const L = spans[e], L2 = L * L, L3 = L2 * L
    F[2*e]     -= P * b * b * (3*a + b) / L3
    F[2*e + 1] -= P * a * b * b          / L2
    F[2*e + 2] -= P * a * a * (3*b + a) / L3
    F[2*e + 3] += P * a * a * b          / L2
  }

  // ── Boundary conditions & solve ────────────────────────────────────────────
  const constrained = new Set()
  for (let i = 0; i < nNodes; i++) {
    const s = supports[i]
    if (s === 'pin'   || s === 'fixed') constrained.add(2 * i)
    if (s === 'fixed')                  constrained.add(2 * i + 1)
  }

  const freeDOFs = []
  for (let i = 0; i < nDOF; i++) if (!constrained.has(i)) freeDOFs.push(i)

  const u = new Array(nDOF).fill(0)
  if (freeDOFs.length > 0) {
    const Kff = freeDOFs.map(i => freeDOFs.map(j => K[i][j]))
    const Ff  = freeDOFs.map(i => F[i])
    const uf  = gaussSolve(Kff, Ff)
    freeDOFs.forEach((dof, k) => { u[dof] = uf[k] })
  }

  // Reactions: R = K·u − F
  const R = new Array(nDOF).fill(0)
  for (let i = 0; i < nDOF; i++) {
    for (let j = 0; j < nDOF; j++) R[i] += K[i][j] * u[j]
    R[i] -= F[i]
  }

  // ── Precompute element left-boundary values (equilibrium from left) ─────────
  const V_left = new Array(nEl)
  const M_left = new Array(nEl)

  V_left[0] = R[0]
  M_left[0] = -R[1]

  for (let e = 1; e < nEl; e++) {
    // V at left of element e = sum of upward reactions at nodes 0..e minus all loads to the left
    let V = 0
    for (let k = 0; k <= e; k++) V += R[2 * k]
    for (const { q, xStart, xEnd } of dLoads) {
      const ls = Math.max(xStart, 0)
      const le = Math.min(xEnd, nodes[e])
      if (le > ls) V -= q * (le - ls)
    }
    for (const { x: xP, P } of pointLoads) if (xP < nodes[e]) V -= P
    V_left[e] = V

    // M at left of element e = M at right end of element e-1
    const Le = spans[e - 1]
    let M = M_left[e - 1] + V_left[e - 1] * Le
    for (const { q, xStart, xEnd } of dLoads) {
      const a = Math.max(0, xStart - nodes[e - 1])
      const b = Math.min(Le, xEnd - nodes[e - 1])
      if (b > a) {
        const loaded   = b - a
        const centroid = a + loaded / 2
        M -= q * loaded * (Le - centroid)
      }
    }
    for (const { x: xP, P } of pointLoads) {
      if (xP > nodes[e - 1] && xP < nodes[e]) M -= P * (Le - (xP - nodes[e - 1]))
    }
    M_left[e] = M
  }

  // ── M(x) and V(x) via equilibrium ──────────────────────────────────────────
  function getElem(x) {
    for (let e = 0; e < nEl; e++) if (x <= nodes[e + 1] + 1e-12) return e
    return nEl - 1
  }

  function M_at(x) {
    const e  = getElem(x)
    const xi = x - nodes[e]
    let M = M_left[e] + V_left[e] * xi
    for (const { q, xStart, xEnd } of dLoads) {
      const a = Math.max(0, xStart - nodes[e])
      const b = Math.min(xEnd - nodes[e], xi)
      if (b > a) {
        const loaded   = b - a
        const centroid = a + loaded / 2
        M -= q * loaded * (xi - centroid)
      }
    }
    for (const { x: xP, P } of pointLoads)
      if (xP > nodes[e] && xP < x) M -= P * (xi - (xP - nodes[e]))
    return M
  }

  function V_at(x) {
    const e  = getElem(x)
    const xi = x - nodes[e]
    let V = V_left[e]
    for (const { q, xStart, xEnd } of dLoads) {
      const a = Math.max(0, xStart - nodes[e])
      const b = Math.min(xEnd - nodes[e], xi)
      if (b > a) V -= q * (b - a)
    }
    for (const { x: xP, P } of pointLoads)
      if (xP > nodes[e] && xP < x) V -= P
    return V
  }

  // ── Build output sample arrays ─────────────────────────────────────────────
  const PTS = 60
  const eps = 1e-9

  // Include distributed-load boundary positions so partial-load kinks are captured
  const dLoadBounds = dLoads.flatMap(dl => [dl.xStart, dl.xEnd])
    .filter(x => x > 0 && x < Ltot)
    .map(x => +x.toFixed(9))

  const base = []
  for (let e = 0; e < nEl; e++)
    for (let k = 0; k <= PTS; k++)
      base.push(+(nodes[e] + (k / PTS) * spans[e]).toFixed(9))

  const mXs  = [...new Set([...base, ...dLoadBounds])].sort((a, b) => a - b)
  const mVals = mXs.map(M_at)

  // vXs: eps-pairs at point load positions AND distributed-load boundaries
  const vXs = [...new Set([
    ...mXs,
    ...pointLoads.flatMap(pl => [+(pl.x - eps).toFixed(9), +(pl.x + eps).toFixed(9)]),
    ...dLoadBounds.flatMap(x  => [+(x - eps).toFixed(9),   +(x + eps).toFixed(9)]),
  ])].sort((a, b) => a - b)
  const vVals = vXs.map(V_at)

  // ── Deflection via trapezoid double-integration of M/EI ───────────────────
  let deflXs = null, deflVals = null
  if (hasEI) {
    const DPTS = 80
    deflXs  = []
    deflVals = []
    for (let e = 0; e < nEl; e++) {
      const L  = spans[e]
      const ei = EIe[e]
      const dx = L / DPTS
      let a = u[2 * e + 1]
      let v = u[2 * e]
      deflXs.push(nodes[e])
      deflVals.push(-v)
      for (let k = 0; k < DPTS; k++) {
        const x0 = nodes[e] + k * dx
        const x1 = x0 + dx
        const M0 = M_at(x0)
        const M1 = M_at(x1)
        const a1 = a + dx * (M0 + M1) / (2 * ei)
        v = v + dx * (a + a1) / 2
        a = a1
        deflXs.push(x1)
        deflVals.push(-v)
      }
    }
  }

  // ── Reactions output ────────────────────────────────────────────────────────
  const reactions = nodes.map((x, i) => ({ x, Fy: R[2 * i], M: R[2 * i + 1] }))

  const peaks = {
    Vmax: Math.max(...vVals.map(Math.abs)),
    Mmax: Math.max(...mVals.map(Math.abs)),
    vmax: deflVals ? Math.max(...deflVals.map(Math.abs)) : null,
  }

  return { nodes, reactions, Ltot, mXs, mVals, vXs, vVals, deflXs, deflVals, peaks }
}

// ── Gaussian elimination with partial pivoting ────────────────────────────────
function gaussSolve(A, b) {
  const n = b.length
  const M = A.map((row, i) => [...row, b[i]])
  for (let col = 0; col < n; col++) {
    let maxRow = col
    for (let row = col + 1; row < n; row++)
      if (Math.abs(M[row][col]) > Math.abs(M[maxRow][col])) maxRow = row
    ;[M[col], M[maxRow]] = [M[maxRow], M[col]]
    if (Math.abs(M[col][col]) < 1e-14) continue
    for (let row = col + 1; row < n; row++) {
      const f = M[row][col] / M[col][col]
      for (let k = col; k <= n; k++) M[row][k] -= f * M[col][k]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = M[i][n]
    for (let j = i + 1; j < n; j++) x[i] -= M[i][j] * x[j]
    x[i] /= M[i][i]
  }
  return x
}
