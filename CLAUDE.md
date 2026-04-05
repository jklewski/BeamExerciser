# BeamExerciser — Developer Notes

## Purpose
Educational exercise tool for structural engineering students. A beam is generated randomly and displayed; the student draws the shear force V(x) and bending moment M(x) diagrams freehand using an interactive spline. Clicking "Reveal Answer" overlays the correct computed diagrams.

## Architecture

```
App.jsx
 ├── BeamSVG          (read-only beam figure)
 ├── SplineEditor     (V diagram — student draws here)
 └── SplineEditor     (M diagram — student draws here)
```

Single-column layout, max-width 580 px. No settings panel, no toolbox.

## Key Files

| File | Role |
|------|------|
| `src/App.jsx` | State, random beam generation, reveal logic |
| `src/utils/randomBeam.js` | `generateRandomBeam()` — produces random valid beamState |
| `src/components/exerciser/SplineEditor.jsx` | Interactive SVG spline editor |
| `src/utils/beamSolverDSM.js` | DSM solver — **do not modify** |
| `src/utils/beamLayout.js` | Shared SVG geometry — **do not modify** |
| `src/components/svg/BeamSVG.jsx` | Beam renderer — **do not modify** |
| `src/components/svg/MomentDiagramSVG.jsx` | M/V/deflection renderer — not used in this app but kept |

## SVG Coordinate Conventions

All beam-related SVGs share these constants (defined as module-level constants in each file):

```js
W = 520        // total viewBox width
x0 = 70        // left beam end (px)
x1 = 450       // right beam end (px)
beamLen = 380  // x1 - x0
```

SplineEditor additionally:
```js
H = 180   // viewBox height
midY = 90 // zero axis y-position
halfH = 70 // usable half-height for ±maxVal
```

Transforms:
```js
toSvgX(xM)   = x0 + (xM / Ltot) * beamLen
toSvgY(y)    = midY - (y / maxVal) * halfH
fromSvgX(sx) = (sx - x0) / beamLen * Ltot
fromSvgY(sy) = (midY - sy) / halfH * maxVal
```

## SplineEditor State Model

Each point:
```js
{
  id: string,
  x: number,          // metres along beam (0..Ltot)
  y: number,          // arriving value (from left segment)
  yExit: number|null, // departing value (null = continuous)
  leftType:  'linear'|'bezier',
  rightType: 'linear'|'bezier',
  smooth: boolean,    // true = C1 continuity (handles mirror each other)
  leftHandle:  { dx, dy },  // SVG pixel offset from knot — NOT data units
  rightHandle: { dx, dy },
}
```

- Points are always kept sorted by `x`.
- The two endpoint points (first and last by x) cannot be deleted.
- Bezier handles are in **SVG pixel space**, not data units. A `dx=30` handle looks the same visual size regardless of `maxVal` or `Ltot`.
- When `smooth=true`: dragging one handle mirrors the other via `newLeft = {dx: -dx, dy: -dy}`.
- Discontinuous points (`yExit !== null`) have two draggable circles: blue (arrival `y`) and orange (departure `yExit`).

## Random Beam Generation (`randomBeam.js`)

Config pool:
```js
{ left: 'pin',   right: 'roller', intermediates: [] }    // simply supported
{ left: 'fixed', right: 'free',   intermediates: [] }    // cantilever
{ left: 'fixed', right: 'roller', intermediates: [] }    // propped cantilever
{ left: 'pin',   right: 'roller', intermediates: [0.5] } // two-span
```

Lengths: `[4, 5, 6, 8, 10, 12]` m  
UDL magnitudes: `[5, 10, 15, 20]` kN/m  
Point load magnitudes: `[10, 15, 20, 25, 30]` kN  

Solvability is verified by running the DSM solver; invalid beams are regenerated (max 10 attempts).

## Sign Convention (inherited from beamSolverDSM)

- Positive M = sagging (tension in bottom face) → plots **downward** in MomentDiagramSVG
- Positive V = upward shear on left face of cut
- Positive deflection = downward

In SplineEditor, `toSvgY` maps positive values **upward** on screen (structural convention: positive shear/moment above the zero line).

## Deployment

GitHub Actions workflow: `.github/workflows/deploy.yml`  
Vite base: `/BeamExerciser/`  
Live URL: `https://jklewski.github.io/BeamExerciser/`
