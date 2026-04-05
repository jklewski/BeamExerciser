const SUPPORT_OPTIONS = ['pin', 'roller', 'fixed', 'free']
const SUPPORT_OPTIONS_NO_H = ['roller', 'free']  // excludes horizontally-restraining types

function restrainsH(type) {
  return type === 'pin' || type === 'fixed'
}

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#6b7280',
  marginBottom: 2,
  fontWeight: 500,
}

const inputStyle = {
  width: '100%',
  padding: '0.3rem 0.5rem',
  border: '1px solid #d1d5db',
  borderRadius: 4,
  fontSize: '0.85rem',
  boxSizing: 'border-box',
}

const sectionStyle = {
  marginBottom: '1rem',
}

function Field({ label, children }) {
  return (
    <div style={sectionStyle}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

function SupportSelect({ value, onChange, options = SUPPORT_OPTIONS }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
      {options.map(o => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  )
}

export default function PropertiesPanel({
  tab,
  beamState,
  columnState,
  selectedId,
  onBeamChange,
  onColumnChange,
  onLoadChange,
  onDeleteLoad,
  onInnerSupportMove,
  onInnerSupportRemove,
}) {
  const panelStyle = {
    width: 210,
    minWidth: 210,
    background: '#fff',
    borderLeft: '1px solid #e5e7eb',
    padding: '1rem',
    overflowY: 'auto',
    fontSize: '0.85rem',
  }

  const headingStyle = {
    fontSize: '0.8rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#374151',
    marginBottom: '0.75rem',
  }

  const dividerStyle = {
    border: 'none',
    borderTop: '1px solid #f3f4f6',
    margin: '0.75rem 0',
  }

  // ── Beam: inner support selected ─────────────────────────────────────────
  if (tab === 'beam' && selectedId) {
    const isupIdx = beamState.intermediateSupports.findIndex(s => s.id === selectedId)
    if (isupIdx !== -1) {
      const sup = beamState.intermediateSupports[isupIdx]
      const step = 1 / (beamState.numGridCells ?? 10)
      return (
        <div style={panelStyle}>
          <div style={headingStyle}>Inner Support</div>
          <div style={{ color: '#6b7280', fontSize: '0.78rem', marginBottom: '0.75rem' }}>
            Roller (vertical only)
          </div>

          <Field label="Position (0–1)">
            <input
              type="number" min={step} max={1 - step} step={step}
              style={inputStyle}
              value={sup.frac.toFixed(3)}
              onChange={e => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v)) onInnerSupportMove(sup.id, v)
              }}
            />
          </Field>

          <Field label={`Position (m)`}>
            <input
              type="number" readOnly style={{ ...inputStyle, background: '#f9fafb', color: '#6b7280' }}
              value={(sup.frac * beamState.L).toFixed(2)}
            />
          </Field>

          <hr style={dividerStyle} />

          <button
            onClick={() => onInnerSupportRemove(sup.id)}
            style={{
              width: '100%', padding: '0.4rem',
              background: '#fef2f2', color: '#dc2626',
              border: '1px solid #fca5a5', borderRadius: 4,
              cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
            }}
          >
            Remove Support
          </button>
        </div>
      )
    }
  }

  // ── Beam: load selected ──────────────────────────────────────────────────
  if (tab === 'beam' && selectedId) {
    const load = beamState.loads.find(l => l.id === selectedId)
    if (!load) return <div style={panelStyle} />

    const isUDL = load.type === 'udl'

    return (
      <div style={panelStyle}>
        <div style={headingStyle}>{isUDL ? 'Distributed Load' : 'Point Load'}</div>

        <Field label="Label">
          <input
            style={inputStyle}
            value={load.label ?? ''}
            onChange={e => onLoadChange(selectedId, { label: e.target.value })}
          />
        </Field>

        <Field label="Magnitude">
          <input
            type="number"
            style={inputStyle}
            value={load.magnitude ?? ''}
            onChange={e => onLoadChange(selectedId, { magnitude: parseFloat(e.target.value) || 0 })}
          />
        </Field>

        {isUDL ? (
          <>
            <Field label="Start (0–1)">
              <input
                type="number" min="0" max="1" step="0.05"
                style={inputStyle}
                value={load.xStart ?? 0}
                onChange={e => onLoadChange(selectedId, { xStart: parseFloat(e.target.value) })}
              />
            </Field>
            <Field label="End (0–1)">
              <input
                type="number" min="0" max="1" step="0.05"
                style={inputStyle}
                value={load.xEnd ?? 1}
                onChange={e => onLoadChange(selectedId, { xEnd: parseFloat(e.target.value) })}
              />
            </Field>
          </>
        ) : (
          <Field label="Position (0–1)">
            <input
              type="number" min="0" max="1" step="0.05"
              style={inputStyle}
              value={load.x ?? 0.5}
              onChange={e => onLoadChange(selectedId, { x: parseFloat(e.target.value) })}
            />
          </Field>
        )}

        <Field label="Color">
          <input
            type="color"
            style={{ ...inputStyle, padding: 2, height: 34, cursor: 'pointer' }}
            value={load.color ?? '#2563eb'}
            onChange={e => onLoadChange(selectedId, { color: e.target.value })}
          />
        </Field>

        <hr style={dividerStyle} />

        <button
          onClick={() => onDeleteLoad(selectedId)}
          style={{
            width: '100%',
            padding: '0.4rem',
            background: '#fef2f2',
            color: '#dc2626',
            border: '1px solid #fca5a5',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '0.85rem',
            fontWeight: 500,
          }}
        >
          Delete Load
        </button>
      </div>
    )
  }

  // ── Beam: global properties ──────────────────────────────────────────────
  if (tab === 'beam') {
    return (
      <div style={panelStyle}>
        <div style={headingStyle}>Beam</div>

        <Field label="Span L (m)">
          <input
            type="number" min="0.5" step="0.5"
            style={inputStyle}
            value={beamState.L}
            onChange={e => onBeamChange({ L: parseFloat(e.target.value) || 1 })}
          />
        </Field>

        <Field label="Left support">
          <SupportSelect
            value={beamState.supports.left}
            options={restrainsH(beamState.supports.right) ? SUPPORT_OPTIONS_NO_H : SUPPORT_OPTIONS}
            onChange={v => onBeamChange({ supports: { ...beamState.supports, left: v } })}
          />
        </Field>

        <Field label="Right support">
          <SupportSelect
            value={beamState.supports.right}
            onChange={v => onBeamChange({ supports: { ...beamState.supports, right: v } })}
          />
        </Field>

        <hr style={dividerStyle} />

        <Field label="Grid divisions">
          <input
            type="number" min="2" max="20" step="1"
            style={inputStyle}
            value={beamState.numGridCells ?? 10}
            onChange={e => onBeamChange({ numGridCells: Math.max(2, parseInt(e.target.value) || 10) })}
          />
        </Field>

        <hr style={dividerStyle} />

        <div style={{ color: '#9ca3af', fontSize: '0.78rem', lineHeight: 1.5 }}>
          Click a load or support in the diagram to edit it. Drag items from the toolbox onto the canvas.
        </div>
      </div>
    )
  }

  // ── Column: global properties ────────────────────────────────────────────
  return (
    <div style={panelStyle}>
      <div style={headingStyle}>Column</div>

      <Field label="Height L (m)">
        <input
          type="number" min="0.5" step="0.5"
          style={inputStyle}
          value={columnState.L}
          onChange={e => onColumnChange({ L: parseFloat(e.target.value) || 1 })}
        />
      </Field>

      <Field label="Axial load label">
        <input
          style={inputStyle}
          value={columnState.N_label}
          onChange={e => onColumnChange({ N_label: e.target.value })}
        />
      </Field>

      <Field label="UDL label">
        <input
          style={inputStyle}
          value={columnState.q_label}
          onChange={e => onColumnChange({ q_label: e.target.value })}
        />
      </Field>

      <Field label="Base support">
        <SupportSelect
          value={columnState.support}
          onChange={v => onColumnChange({ support: v })}
        />
      </Field>

      <Field label="Top support">
        <select
          value={columnState.topSupport}
          onChange={e => onColumnChange({ topSupport: e.target.value })}
          style={inputStyle}
        >
          <option value="none">none</option>
          <option value="roller">roller</option>
        </select>
      </Field>
    </div>
  )
}
