function DragTile({ label, elementType, icon, disabled, disabledReason }) {
  function handleDragStart(e) {
    e.dataTransfer.setData(
      'application/structural-element',
      JSON.stringify({ elementType })
    )
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      draggable={!disabled}
      onDragStart={handleDragStart}
      title={disabled ? disabledReason : `Drag to add ${label}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '0.6rem 0.5rem',
        borderRadius: 6,
        border: '1px solid #e5e7eb',
        background: disabled ? '#f9fafb' : '#fff',
        cursor: disabled ? 'not-allowed' : 'grab',
        opacity: disabled ? 0.45 : 1,
        userSelect: 'none',
        transition: 'box-shadow 0.15s',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)' }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
    >
      {icon}
      <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500, textAlign: 'center' }}>{label}</span>
    </div>
  )
}

const PointLoadIcon = () => (
  <svg width="36" height="40" viewBox="0 0 36 40">
    <line x1="18" y1="2" x2="18" y2="28" stroke="#dc2626" strokeWidth="2.2" />
    <polygon points="18,38 12,26 24,26" fill="#dc2626" />
  </svg>
)

const UDLIcon = () => (
  <svg width="36" height="40" viewBox="0 0 36 40">
    <line x1="2" y1="4" x2="34" y2="4" stroke="#2563eb" strokeWidth="1.8" />
    {[7, 15, 22, 29].map(x => (
      <g key={x}>
        <line x1={x} y1="4" x2={x} y2="28" stroke="#2563eb" strokeWidth="1.4" />
        <polygon points={`${x},36 ${x - 4},26 ${x + 4},26`} fill="#2563eb" />
      </g>
    ))}
  </svg>
)

// Inner support icon: a small roller symbol (triangle + circles)
const InnerSupportIcon = () => (
  <svg width="36" height="40" viewBox="0 0 36 40">
    {/* Beam stub */}
    <rect x="4" y="10" width="28" height="8" fill="#e8e8e8" stroke="#1a1a2e" strokeWidth="1.2" />
    {/* Triangle */}
    <polygon points="18,18 10,30 26,30" fill="none" stroke="#374151" strokeWidth="1.6" />
    {/* Roller circles */}
    <circle cx="12" cy="33" r="2.5" fill="none" stroke="#374151" strokeWidth="1.4" />
    <circle cx="18" cy="33" r="2.5" fill="none" stroke="#374151" strokeWidth="1.4" />
    <circle cx="24" cy="33" r="2.5" fill="none" stroke="#374151" strokeWidth="1.4" />
    {/* Ground line */}
    <line x1="6" y1="37" x2="30" y2="37" stroke="#374151" strokeWidth="1.6" />
  </svg>
)

export default function Toolbox({ tab, innerSupportCount = 0 }) {
  const disabled = tab !== 'beam'
  const maxIsup  = innerSupportCount >= 5

  return (
    <div style={{
      width: 130,
      minWidth: 130,
      background: '#f9fafb',
      borderRight: '1px solid #e5e7eb',
      padding: '1rem 0.75rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.5rem',
    }}>
      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#9ca3af',
        marginBottom: '0.25rem',
      }}>
        Loads
      </div>

      <DragTile
        label="Point Load"
        elementType="point-load"
        icon={<PointLoadIcon />}
        disabled={disabled}
        disabledReason="Switch to Beam tab to add loads"
      />
      <DragTile
        label="UDL"
        elementType="udl"
        icon={<UDLIcon />}
        disabled={disabled}
        disabledReason="Switch to Beam tab to add loads"
      />

      <div style={{
        fontSize: '0.72rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: '#9ca3af',
        marginTop: '0.5rem',
        marginBottom: '0.25rem',
      }}>
        Supports
      </div>

      <DragTile
        label="Inner Support"
        elementType="inner-support"
        icon={<InnerSupportIcon />}
        disabled={disabled || maxIsup}
        disabledReason={maxIsup ? 'Maximum 5 inner supports' : 'Switch to Beam tab'}
      />

      {tab === 'beam' && (
        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textAlign: 'center', marginTop: 2 }}>
          {innerSupportCount}/5
        </div>
      )}
    </div>
  )
}
