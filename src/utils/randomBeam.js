import { beamSolverDSM } from './beamSolverDSM.js'

// ── Config pool ───────────────────────────────────────────────────────────────
const CONFIGS = [
  { left: 'pin',   right: 'roller', intermediates: [] },       // simply supported
  { left: 'fixed', right: 'free',   intermediates: [] },       // cantilever
  { left: 'fixed', right: 'roller', intermediates: [] },       // propped cantilever
  { left: 'pin',   right: 'roller', intermediates: [0.5] },    // two-span continuous
]

const LENGTHS     = [4, 5, 6, 8, 10, 12]
const UDL_MAGS    = [5, 10, 15, 20]
const POINT_MAGS  = [10, 15, 20, 25, 30]
const POINT_FRACS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75]
const UDL_STARTS  = [0, 0, 0, 0.25, 0.5]   // weighted toward full-span

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

// ── Internal solver (mirrors computeDiagrams in App.jsx) ─────────────────────
function solve(beamState) {
  const { L, supports, loads = [], intermediateSupports = [] } = beamState
  const innerFracs  = [...intermediateSupports].map(s => s.frac).sort((a, b) => a - b)
  const nodeFracs   = [0, ...innerFracs, 1]
  const nodePos     = nodeFracs.map(f => f * L)
  const spans       = nodePos.slice(1).map((x, i) => x - nodePos[i])
  const dsmSupports = nodeFracs.map((_, i) => {
    if (i === 0)                    return supports.left  === 'fixed' ? 'fixed' : 'pin'
    if (i === nodeFracs.length - 1) return supports.right === 'fixed' ? 'fixed'
                                         : supports.right === 'free'  ? 'free'  : 'pin'
    return 'pin'
  })
  const distributedLoads = loads
    .filter(l => l.type === 'udl' && (l.magnitude ?? 0) !== 0)
    .map(l => ({ q: l.magnitude, xStart: (l.xStart ?? 0) * L, xEnd: (l.xEnd ?? 1) * L }))
  const pointLoads = loads
    .filter(l => l.type === 'point' && (l.magnitude ?? 0) !== 0)
    .map(l => ({ x: (l.x ?? 0.5) * L, P: l.magnitude }))
  try {
    return beamSolverDSM({ spans, supports: dsmSupports, distributedLoads, pointLoads, EI: 1 })
  } catch {
    return null
  }
}

// ── Fallback beam (always valid) ──────────────────────────────────────────────
const FALLBACK = {
  L: 6,
  supports: { left: 'pin', right: 'roller' },
  loads: [
    { id: 'load-fb-1', type: 'udl',   label: 'q', color: '#2563eb', xStart: 0, xEnd: 1, magnitude: 10 },
  ],
  intermediateSupports: [],
  numGridCells: 20,
  showDimension: true,
}

// ── Main generator ────────────────────────────────────────────────────────────
export function generateRandomBeam(attempt = 0) {
  if (attempt >= 10) return FALLBACK

  const config = pick(CONFIGS)
  const L      = pick(LENGTHS)

  const loads = []
  const numLoads = Math.floor(Math.random() * 3) + 1  // 1–3 loads

  for (let i = 0; i < numLoads; i++) {
    const isUDL = i === 0 || Math.random() < 0.5

    if (isUDL) {
      const xStart = pick(UDL_STARTS)
      const xEnd   = xStart > 0 ? 1 : pick([0.5, 0.75, 1, 1, 1])
      loads.push({
        id:        `load-${i}-${Date.now()}`,
        type:      'udl',
        label:     'q',
        color:     '#2563eb',
        magnitude: pick(UDL_MAGS),
        xStart,
        xEnd,
      })
    } else {
      loads.push({
        id:        `load-${i}-${Date.now()}`,
        type:      'point',
        label:     'P',
        color:     '#dc2626',
        magnitude: pick(POINT_MAGS),
        x:         pick(POINT_FRACS),
      })
    }
  }

  const beam = {
    L,
    supports: { left: config.left, right: config.right },
    loads,
    intermediateSupports: config.intermediates.map((frac, i) => ({ id: `isup-${i}`, frac })),
    numGridCells: 20,
    showDimension: true,
  }

  // Solvability guard
  const result = solve(beam)
  if (!result || result.peaks.Mmax === 0) return generateRandomBeam(attempt + 1)

  return beam
}
