/**
 * FigureRenderer – maps a figure spec { type, props } to the right SVG component.
 *
 * Supported types:
 *   'beam'            → BeamSVG
 *   'column'          → ColumnSVG
 *   'moment-diagram'  → MomentDiagramSVG
 *   'steel-section'   → SteelSectionSVG  (also 'ipe-section', 'hollow-rect')
 *   'glulam-section'  → GlulamSection
 *   'rect-section'    → RectSection
 *   'welded-i-section'→ WeldedISectionSVG
 *   'concrete-uls'    → ConcreteULSSVG
 */
import BeamSVG           from './BeamSVG.jsx'
import ColumnSVG         from './ColumnSVG.jsx'
import MomentDiagramSVG  from './MomentDiagramSVG.jsx'
import SteelSectionSVG   from './SteelSectionSVG.jsx'
import GlulamSection     from './GlulamSection.jsx'
import RectSection       from './RectSection.jsx'
import WeldedISectionSVG from './WeldedISectionSVG.jsx'
import ConcreteULSSVG    from './ConcreteULSSVG.jsx'

const REGISTRY = {
  'beam':             BeamSVG,
  'column':           ColumnSVG,
  'moment-diagram':   MomentDiagramSVG,
  'steel-section':    SteelSectionSVG,
  'ipe-section':      SteelSectionSVG,
  'hollow-rect':      SteelSectionSVG,
  'glulam-section':   GlulamSection,
  'rect-section':     RectSection,
  'welded-i-section': WeldedISectionSVG,
  'concrete-uls':     ConcreteULSSVG,
}

export default function FigureRenderer({ figure }) {
  const Component = REGISTRY[figure.type]
  if (!Component) {
    return (
      <div style={{ color: '#dc2626', fontSize: '0.85rem', padding: '0.5rem' }}>
        Unknown figure type: <code>{figure.type}</code>
      </div>
    )
  }
  return <Component {...figure.props} />
}
