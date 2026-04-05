/**
 * solveBeam – reactions, M(x), V(x) and extremes for a simply-supported beam.
 *
 * Works in any consistent unit system (SI: N/m, N → N·m  or  kN/m, kN → kNm).
 *
 * @param {number}  L            – span (distance between supports)
 * @param {Array}   udl          – [{ q, xStart?, xEnd? }]  distributed loads
 * @param {Array}   pointLoads   – [{ P, x }]               point loads
 * @param {number}  [overhang]   – beam extension past right support (default 0)
 * @param {number}  [nSamples]   – sampling density for finding extremes (default 300)
 *
 * @returns {{ R_A, R_B, M_at, V_at, M_max, M_min, V_max }}
 *   M_at / V_at  – functions (x) → value
 *   M_max        – maximum (most positive) moment
 *   M_min        – minimum (most negative) moment  — hogging if < 0
 *   V_max        – maximum absolute shear
 */
export function solveBeam({ L, udl = [], pointLoads = [], overhang = 0, nSamples = 300 }) {
  const Ltot = L + overhang

  // ── Reactions (pin at x=0, roller at x=L) ────────────────────────────────
  let totalLoad = 0, momentAboutA = 0
  for (const { q, xStart = 0, xEnd = Ltot } of udl) {
    const len = xEnd - xStart
    totalLoad    += q * len
    momentAboutA += q * len * (xStart + len / 2)
  }
  for (const { P, x } of pointLoads) {
    totalLoad    += P
    momentAboutA += P * x
  }
  const R_B = momentAboutA / L
  const R_A = totalLoad - R_B

  // ── M(x) and V(x) ─────────────────────────────────────────────────────────
  function M_at(x) {
    let M = R_A * x
    for (const { q, xStart = 0, xEnd = Ltot } of udl) {
      if (x > xStart) {
        const a = Math.min(x, xEnd) - xStart
        M -= q * a * (x - xStart - a / 2)
      }
    }
    for (const { P, x: xP } of pointLoads) {
      if (x > xP) M -= P * (x - xP)
    }
    if (overhang > 0 && x > L) M += R_B * (x - L)
    return M
  }

  function V_at(x) {
    let V = R_A
    for (const { q, xStart = 0, xEnd = Ltot } of udl) {
      if (x > xStart) V -= q * (Math.min(x, xEnd) - xStart)
    }
    for (const { P, x: xP } of pointLoads) {
      if (x > xP) V -= P
    }
    if (overhang > 0 && x > L) V += R_B
    return V
  }

  // ── Sample to find extremes ────────────────────────────────────────────────
  // Include key x-values: supports, load positions, just before/after point loads
  const eps = 1e-9
  const keyXs = [
    0, L, Ltot,
    ...pointLoads.flatMap(({ x }) => [x - eps, x + eps]),
  ]
  const grid = Array.from({ length: nSamples + 1 }, (_, i) => i * Ltot / nSamples)
  const allXs = [...new Set([...grid, ...keyXs])].sort((a, b) => a - b)

  const mVals = allXs.map(M_at)
  const vVals = allXs.map(V_at)

  const M_max = Math.max(...mVals)
  const M_min = Math.min(...mVals)
  const V_max = Math.max(...vVals.map(Math.abs))

  return { R_A, R_B, M_at, V_at, M_max, M_min, V_max }
}
