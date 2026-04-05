import { useState, useRef } from 'react'
import FigureRenderer from './components/svg/FigureRenderer.jsx'
import MomentDiagramSVG from './components/svg/MomentDiagramSVG.jsx'
import Toolbox from './components/editor/Toolbox.jsx'
import CanvasDropZone from './components/editor/CanvasDropZone.jsx'
import PropertiesPanel from './components/editor/PropertiesPanel.jsx'
import InteractiveBeamOverlay from './components/editor/InteractiveBeamOverlay.jsx'
import { beamSolverDSM } from './utils/beamSolverDSM.js'

// ── Support constraint helpers ───────────────────────────────────────────────

function restrainsH(type) {
  return type === 'pin' || type === 'fixed'
}

function sanitizeSupports(supports) {
  if (restrainsH(supports.left) && restrainsH(supports.right)) {
    return { ...supports, left: 'roller' }
  }
  return supports
}

function snapFrac(frac, numGridCells) {
  return Math.round(frac * numGridCells) / numGridCells
}

// ── DSM input builder ────────────────────────────────────────────────────────

// Map UI support type → DSM support type.
// Roller and pin both restrain only vertical displacement in beam analysis.
function toDSMSupport(type) {
  if (type === 'roller') return 'pin'
  if (type === 'fixed')  return 'fixed'
  if (type === 'free')   return 'free'
  return 'pin'
}

function computeDiagrams(beamState) {
  const { L, supports, loads = [], intermediateSupports = [] } = beamState

  // Node fractions in sorted order: [0, inner..., 1]
  const innerFracs = [...intermediateSupports].map(s => s.frac).sort((a, b) => a - b)
  const nodeFracs  = [0, ...innerFracs, 1]
  const nodePos    = nodeFracs.map(f => f * L)  // absolute positions in metres

  // Span lengths between consecutive nodes
  const spans = nodePos.slice(1).map((x, i) => x - nodePos[i])

  // DSM support type per node
  const dsmSupports = nodeFracs.map((_, i) => {
    if (i === 0)                   return toDSMSupport(supports.left  ?? 'pin')
    if (i === nodeFracs.length - 1) return toDSMSupport(supports.right ?? 'roller')
    return 'pin'  // intermediate supports are rollers → pin in beam analysis
  })

  // Distributed loads with exact global positions (supports partial-span UDLs)
  const distributedLoads = loads
    .filter(l => l.type === 'udl' && (l.magnitude ?? 0) !== 0)
    .map(l => ({
      q:      l.magnitude,
      xStart: (l.xStart ?? 0) * L,
      xEnd:   (l.xEnd   ?? 1) * L,
    }))

  // Point loads in absolute positions
  const pointLoads = loads
    .filter(l => l.type === 'point' && (l.magnitude ?? 0) !== 0)
    .map(l => ({ x: (l.x ?? 0.5) * L, P: l.magnitude }))

  try {
    const result = beamSolverDSM({ spans, supports: dsmSupports, distributedLoads, pointLoads, EI: 1 })
    result.normalizedDefl = true
    return result
  } catch (err) {
    console.warn('beamSolverDSM error:', err)
    return null
  }
}

// ── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState('beam')

  const [beamState, setBeamState] = useState({
    L: 6,
    supports: { left: 'pin', right: 'roller' },
    loads: [
      { id: 'load-1', type: 'udl',   label: 'q', color: '#2563eb', xStart: 0, xEnd: 1, magnitude: 10 },
      { id: 'load-2', type: 'point', label: 'P', color: '#dc2626', x: 0.4,              magnitude: 20 },
    ],
    intermediateSupports: [],
    numGridCells: 20,
    showDimension: true,
  })

  const [columnState, setColumnState] = useState({
    L: 4,
    N_label: 'N',
    q_label: '',
    support: 'pin',
    topSupport: 'roller',
    showDim: true,
  })

  const [selectedId, setSelectedId] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const beamSvgRef = useRef(null)
  const diagramSvgRef = useRef(null)

  function beamFigure() {
    return {
      type: 'beam',
      props: {
        ...beamState,
        loads: beamState.loads.map(({ id, ...rest }) => rest),
        intermediateSupports: beamState.intermediateSupports.map(s => s.frac),
        numGridCells: undefined,
      },
    }
  }

  function columnFigure() {
    return { type: 'column', props: columnState }
  }

  function handleDrop(elementType) {
    if (elementType === 'inner-support') {
      setBeamState(prev => {
        if (prev.intermediateSupports.length >= 5) return prev
        const snapped = snapFrac(0.5, prev.numGridCells)
        const taken = new Set(prev.intermediateSupports.map(s => s.frac))
        let frac = snapped
        if (taken.has(frac)) {
          for (let d = 1; d <= prev.numGridCells / 2; d++) {
            const a = snapFrac(0.5 + d / prev.numGridCells, prev.numGridCells)
            const b = snapFrac(0.5 - d / prev.numGridCells, prev.numGridCells)
            if (!taken.has(a) && a > 0 && a < 1) { frac = a; break }
            if (!taken.has(b) && b > 0 && b < 1) { frac = b; break }
          }
          if (taken.has(frac)) return prev
        }
        const newSup = { id: `isup-${Date.now()}`, frac }
        return {
          ...prev,
          intermediateSupports: [...prev.intermediateSupports, newSup].sort((a, b) => a.frac - b.frac),
        }
      })
      return
    }
    const newLoad = elementType === 'udl'
      ? { id: `load-${Date.now()}`, type: 'udl',   label: 'q', color: '#2563eb', xStart: 0.1, xEnd: 0.9, magnitude: 10 }
      : { id: `load-${Date.now()}`, type: 'point', label: 'P', color: '#dc2626', x: 0.5,                  magnitude: 10 }
    setBeamState(prev => ({ ...prev, loads: [...prev.loads, newLoad] }))
    setSelectedId(newLoad.id)
  }

  function handleBeamChange(partial) {
    setBeamState(prev => {
      const next = { ...prev, ...partial }
      if (partial.supports) next.supports = sanitizeSupports(next.supports)
      return next
    })
  }

  function handleColumnChange(partial) {
    setColumnState(prev => ({ ...prev, ...partial }))
  }

  function handleLoadChange(loadId, partial) {
    setBeamState(prev => ({
      ...prev,
      loads: prev.loads.map(l => l.id === loadId ? { ...l, ...partial } : l),
    }))
  }

  function handleDeleteLoad(loadId) {
    setBeamState(prev => ({ ...prev, loads: prev.loads.filter(l => l.id !== loadId) }))
    setSelectedId(null)
  }

  function handleSupportChange(side, newType) {
    setBeamState(prev => ({
      ...prev,
      supports: sanitizeSupports({ ...prev.supports, [side]: newType }),
    }))
  }

  function handleInnerSupportMove(isupId, newFrac) {
    setBeamState(prev => {
      const taken = new Set(prev.intermediateSupports.filter(s => s.id !== isupId).map(s => s.frac))
      if (taken.has(newFrac) || newFrac <= 0 || newFrac >= 1) return prev
      return {
        ...prev,
        intermediateSupports: prev.intermediateSupports
          .map(s => s.id === isupId ? { ...s, frac: newFrac } : s)
          .sort((a, b) => a.frac - b.frac),
      }
    })
  }

  function handleInnerSupportRemove(isupId) {
    setBeamState(prev => ({
      ...prev,
      intermediateSupports: prev.intermediateSupports.filter(s => s.id !== isupId),
    }))
    setSelectedId(null)
  }

  function exportSVG(mode) {
    setExportMenuOpen(false)
    const serializer = new XMLSerializer()

    const beamEl  = beamSvgRef.current?.querySelector('svg')
    const diagEl  = diagramSvgRef.current?.querySelector('svg')

    if (!beamEl) return

    if (mode === 'beam') {
      const src = '<?xml version="1.0" encoding="utf-8"?>\n' + serializer.serializeToString(beamEl)
      download(src, 'beam.svg')
      return
    }

    // mode === 'everything': stack beam + diagrams vertically
    const bVB  = beamEl.viewBox.baseVal
    const dVB  = diagEl ? diagEl.viewBox.baseVal : null
    const pad  = 20
    const W    = Math.max(bVB.width, dVB ? dVB.width : 0)
    const H    = bVB.height + (dVB ? dVB.height + pad : 0)

    const combined = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    combined.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    combined.setAttribute('viewBox', `0 0 ${W} ${H}`)
    combined.setAttribute('width', W)
    combined.setAttribute('height', H)
    combined.setAttribute('style', 'font-family: sans-serif;')

    const gBeam = document.createElementNS('http://www.w3.org/2000/svg', 'g')
    gBeam.innerHTML = beamEl.innerHTML
    combined.appendChild(gBeam)

    if (diagEl) {
      const gDiag = document.createElementNS('http://www.w3.org/2000/svg', 'g')
      gDiag.setAttribute('transform', `translate(${(W - dVB.width) / 2}, ${bVB.height + pad})`)
      gDiag.innerHTML = diagEl.innerHTML
      combined.appendChild(gDiag)
    }

    const src = '<?xml version="1.0" encoding="utf-8"?>\n' + serializer.serializeToString(combined)
    download(src, 'beam-diagrams.svg')
  }

  function download(svgStr, filename) {
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const currentFigure = tab === 'beam' ? beamFigure() : columnFigure()
  const dsmResult     = tab === 'beam' ? computeDiagrams(beamState) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f9fafb' }}>
      {/* Header */}
      <div style={{ background: '#1a1a2e', color: '#fff', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <h1 style={{ fontSize: '1.1rem', margin: 0, fontWeight: 600 }}>BeamExerciser</h1>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {['beam', 'column'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelectedId(null) }}
              style={{
                padding: '0.3rem 0.85rem',
                borderRadius: 4,
                border: '1px solid rgba(255,255,255,0.25)',
                background: tab === t ? 'rgba(255,255,255,0.18)' : 'transparent',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: tab === t ? 600 : 400,
                fontSize: '0.875rem',
              }}
            >
              {t === 'beam' ? 'Beam' : 'Column'}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: 'auto', position: 'relative' }}>
          <button
            onClick={() => setExportMenuOpen(v => !v)}
            style={{
              padding: '0.3rem 0.85rem',
              borderRadius: 4,
              border: '1px solid rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.12)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: 500,
            }}
          >
            Export SVG ▾
          </button>
          {exportMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                minWidth: 180,
                zIndex: 100,
                overflow: 'hidden',
              }}
              onMouseLeave={() => setExportMenuOpen(false)}
            >
              {[
                { key: 'beam',       label: 'Beam only',  desc: 'Beam figure with loads' },
                { key: 'everything', label: 'Everything', desc: 'Beam + M / V / deflection' },
              ].map(({ key, label, desc }) => (
                <button
                  key={key}
                  onClick={() => exportSVG(key)}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.55rem 0.85rem',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#111827',
                    borderBottom: key === 'beam' ? '1px solid #f3f4f6' : 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <div style={{ fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{desc}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body: three-column layout */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Toolbox */}
        <Toolbox
          tab={tab}
          innerSupportCount={beamState.intermediateSupports.length}
        />

        {/* Center: scrollable column — beam figure + diagrams */}
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '1.5rem' }}>

          {/* Beam / Column figure with drop zone */}
          <CanvasDropZone
            onDropElement={handleDrop}
            isDragOver={isDragOver}
            setIsDragOver={setIsDragOver}
            disabled={tab !== 'beam'}
          >
            <div ref={beamSvgRef} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.5rem', display: 'inline-block' }}>
              <div style={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}>
                <FigureRenderer figure={currentFigure} />
                {tab === 'beam' && (
                  <InteractiveBeamOverlay
                    beamState={beamState}
                    selectedId={selectedId}
                    onSelectLoad={setSelectedId}
                    onLoadChange={handleLoadChange}
                    onSupportChange={handleSupportChange}
                    onInnerSupportMove={handleInnerSupportMove}
                    onInnerSupportRemove={handleInnerSupportRemove}
                    onBeamChange={handleBeamChange}
                  />
                )}
              </div>
            </div>
          </CanvasDropZone>

          {/* M / V diagrams — only shown for beam tab when solver succeeds */}
          {tab === 'beam' && dsmResult && (
            <div ref={diagramSvgRef} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem 1.5rem', display: 'inline-block' }}>
              <MomentDiagramSVG
                precomputed={dsmResult}
                showMoment
                showShear
                showDeflection
                showPeakAnnotations
              />
            </div>
          )}

        </div>

        {/* Right: Properties */}
        <PropertiesPanel
          tab={tab}
          beamState={beamState}
          columnState={columnState}
          selectedId={selectedId}
          onBeamChange={handleBeamChange}
          onColumnChange={handleColumnChange}
          onLoadChange={handleLoadChange}
          onDeleteLoad={handleDeleteLoad}
          onInnerSupportMove={handleInnerSupportMove}
          onInnerSupportRemove={handleInnerSupportRemove}
        />
      </div>
    </div>
  )
}
