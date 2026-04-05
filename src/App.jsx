import { useState, useEffect, useRef } from 'react'
import BeamSVG from './components/svg/BeamSVG.jsx'
import SplineEditor from './components/exerciser/SplineEditor.jsx'
import { generateRandomBeam } from './utils/randomBeam.js'
import { beamSolverDSM } from './utils/beamSolverDSM.js'

const BEAM_SVG_W = 520  // native viewBox width of BeamSVG

// ── DSM helpers ───────────────────────────────────────────────────────────────
function toDSMSupport(type) {
  if (type === 'fixed') return 'fixed'
  if (type === 'free')  return 'free'
  return 'pin'
}

function computeDiagrams(beamState) {
  const { L, supports, loads = [], intermediateSupports = [] } = beamState
  const innerFracs  = [...intermediateSupports].map(s => s.frac).sort((a, b) => a - b)
  const nodeFracs   = [0, ...innerFracs, 1]
  const nodePos     = nodeFracs.map(f => f * L)
  const spans       = nodePos.slice(1).map((x, i) => x - nodePos[i])
  const dsmSupports = nodeFracs.map((_, i) => {
    if (i === 0)                    return toDSMSupport(supports.left  ?? 'pin')
    if (i === nodeFracs.length - 1) return toDSMSupport(supports.right ?? 'roller')
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

function niceMax(val, interval = 5) {
  return Math.ceil(val / interval) * interval || interval
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [beamState, setBeamState] = useState(() => generateRandomBeam())
  const [dsmResult, setDsmResult] = useState(null)
  const [revealed,  setRevealed]  = useState(false)

  // Measure beam card content width to scale BeamSVG responsively
  const beamContentRef = useRef(null)
  const [beamContentWidth, setBeamContentWidth] = useState(BEAM_SVG_W)

  useEffect(() => {
    if (!beamContentRef.current) return
    const ro = new ResizeObserver(entries => {
      setBeamContentWidth(entries[0].contentRect.width)
    })
    ro.observe(beamContentRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    setDsmResult(computeDiagrams(beamState))
  }, [beamState])

  function handleNewBeam() {
    setBeamState(generateRandomBeam())
    setRevealed(false)
  }

  // Derived display props
  const vMaxVal = dsmResult ? niceMax(Math.max(...dsmResult.vVals.map(v => Math.abs(v)))) : 20
  const mMaxVal = dsmResult ? niceMax(Math.max(...dsmResult.mVals.map(v => Math.abs(v)))) : 20
  const nodePositions = dsmResult?.nodes ?? [0, beamState.L]

  const pointLoadXs = beamState.loads
    .filter(l => l.type === 'point')
    .map(l => (l.x ?? 0.5) * beamState.L)

  const vStartValue = dsmResult ? dsmResult.vVals[0] : null
  const mStartValue = dsmResult ? dsmResult.mVals[0] : null

  const vRevealed = revealed && dsmResult ? { xs: dsmResult.vXs, vals: dsmResult.vVals } : null
  const mRevealed = revealed && dsmResult ? { xs: dsmResult.mXs, vals: dsmResult.mVals } : null

  const beamFigureProps = {
    L:                    beamState.L,
    supports:             beamState.supports,
    loads:                beamState.loads.map(({ id, ...rest }) => rest),
    intermediateSupports: beamState.intermediateSupports.map(s => s.frac),
    showDimension:        true,
    scale:                Math.min(1, beamContentWidth / BEAM_SVG_W),
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{
        background: '#1a1a2e', color: '#fff',
        padding: '0.6rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
      }}>
        <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em', flex: '1 1 auto' }}>
          BeamExerciser
        </h1>
        <button style={headerBtn(false)} onClick={handleNewBeam}>New Beam</button>
        <button
          style={headerBtn(true, revealed)}
          disabled={revealed}
          onClick={() => setRevealed(true)}
        >
          Reveal Answer
        </button>
      </div>

      {/* Body */}
      <div style={{
        maxWidth: 620, margin: '0 auto',
        padding: '0.75rem 0.5rem',
        display: 'flex', flexDirection: 'column', gap: '0.75rem',
      }}>

        {/* Beam diagram */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Beam</div>
          <div ref={beamContentRef} style={{ width: '100%', overflow: 'hidden' }}>
            <BeamSVG {...beamFigureProps} />
          </div>
        </div>

        {/* Shear force editor */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Shear Force — V(x)</div>
          <SplineEditor
            key={`v-${beamState.L}-${beamState.supports.left}-${beamState.supports.right}`}
            Ltot={beamState.L}
            maxVal={vMaxVal}
            label="V (kN)"
            revealed={vRevealed}
            nodes={nodePositions}
            pointLoadXs={pointLoadXs}
            startValue={vStartValue}
            fillColor="#16a34a"
          />
        </div>

        {/* Bending moment editor */}
        <div style={cardStyle}>
          <div style={sectionLabel}>Bending Moment — M(x)</div>
          <SplineEditor
            key={`m-${beamState.L}-${beamState.supports.left}-${beamState.supports.right}`}
            Ltot={beamState.L}
            maxVal={mMaxVal}
            label="M (kNm)"
            revealed={mRevealed}
            nodes={nodePositions}
            pointLoadXs={pointLoadXs}
            startValue={mStartValue}
            invertY
            fillColor="#2563eb"
          />
        </div>

      </div>
    </div>
  )
}

const headerBtn = (primary = false, disabled = false) => ({
  padding: '0.4rem 0.85rem',
  borderRadius: 5,
  border: primary ? 'none' : '1px solid rgba(255,255,255,0.35)',
  background: primary ? (disabled ? '#4b5563' : '#16a34a') : 'rgba(255,255,255,0.12)',
  color: '#fff',
  cursor: disabled ? 'default' : 'pointer',
  fontSize: '0.85rem',
  fontWeight: 500,
  opacity: disabled ? 0.6 : 1,
  minHeight: 36,
})

const cardStyle = {
  background: '#fff',
  border: '1px solid #e5e7eb',
  borderRadius: 10,
  padding: '0.75rem 0.75rem',
}

const sectionLabel = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
}
