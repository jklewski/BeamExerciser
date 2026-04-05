export default function CanvasDropZone({ children, onDropElement, isDragOver, setIsDragOver, disabled }) {
  function handleDragOver(e) {
    if (disabled) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }

  function handleDragLeave() {
    setIsDragOver(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    const raw = e.dataTransfer.getData('application/structural-element')
    if (!raw) return
    const { elementType } = JSON.parse(raw)
    onDropElement(elementType)
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        outline: isDragOver ? '2px dashed #3b82f6' : '2px dashed transparent',
        outlineOffset: -8,
        borderRadius: 8,
        transition: 'outline-color 0.1s',
        background: isDragOver ? '#eff6ff' : 'transparent',
      }}
    >
      {children}
    </div>
  )
}
