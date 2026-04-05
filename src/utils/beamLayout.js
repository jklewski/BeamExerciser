/**
 * computeBeamLayout – shared geometry constants for BeamSVG and InteractiveBeamOverlay.
 *
 * Mirrors the inline layout computation from BeamSVG.jsx so both the renderer
 * and the interactive overlay stay in sync without duplicating logic.
 */
export function computeBeamLayout({ loads = [], supports = {}, showDimension = true }) {
  const W = 520
  const x0 = 70       // left beam end x
  const x1 = 450      // right beam end x
  const beamLen = x1 - x0
  const beamH = 22    // visual height of beam rectangle

  const udlLoads   = loads.filter(l => l.type === 'udl')
  const pointLoads = loads.filter(l => l.type === 'point')

  const rowH   = 28   // height per UDL row
  const rowGap = 2
  const topPad = 18   // space above first load row

  // When mixing UDL + point loads, reserve extra space above UDL rows so
  // the point-load label has room to breathe.
  const ptLabelH = (pointLoads.length > 0 && udlLoads.length > 0) ? 18 : 0

  const numUdlRows = udlLoads.length + (pointLoads.length > 0 && udlLoads.length === 0 ? 1 : 0)

  // UDL rows start below the point-load label reserve area
  const udlTop = topPad + ptLabelH

  // beamTop sits just below the last UDL row's arrow tips (+ 4 px gap)
  const lastRowBot = numUdlRows > 0
    ? udlTop + (numUdlRows - 1) * (rowH + rowGap) + rowH
    : udlTop
  const beamTop = lastRowBot + (numUdlRows > 0 ? 4 : 0)
  const beamBot = beamTop + beamH
  const loadAreaTop = topPad  // y where point-load arrows start

  const supportH = (supports.left === 'fixed' || supports.right === 'fixed') ? 35 : 45
  const H = beamBot + supportH + (showDimension ? 50 : 10)

  return {
    W, x0, x1, beamLen, beamH,
    udlLoads, pointLoads,
    rowH, rowGap, topPad,
    ptLabelH, numUdlRows, udlTop,
    lastRowBot, beamTop, beamBot, loadAreaTop,
    supportH, H,
  }
}
