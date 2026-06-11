# Step 001: Scanner overlay bug — investigation & plan

## Context
The Scanner component's stock-adjust SubModal renders with visual overlap issues on mobile. The camera feed, QR detection highlights (green boxes), and item labels bleed through the modal overlay. Two root causes identified in `components/Scanner.js`.

## Root causes

### 1. SubModal z-index is insufficient (line 499)
`SubModal` uses `z-10` (`fixed inset-0 z-10`), but the Scanner outer div is `z-50` (line 207). Because SubModal is a child of the Scanner div, the `z-10` is relative within that stacking context — but the html5-qrcode library injects `<video>` and `<canvas>` elements with their own inline styles into `#qr-reader-region` (line 222), and these can layer above the `z-10` overlay.

**Fix**: Change SubModal's z-index to `z-50` or higher (e.g. `z-[60]`) to guarantee it layers above everything the library injects.

### 2. Camera video element not hidden when sub-modal is active
When a code is scanned, the camera is paused (`inst.pause(true)` at line 56), but the `<video>` element and its scan-region overlays (green bounding boxes, detection highlights) remain visible. The semi-transparent `bg-black/60` backdrop isn't opaque enough to fully mask them.

**Fix (preferred — two-part)**:
- When any sub-modal is active (`activeItem || activeAsset || notFoundId || loadingItem`), hide the camera viewport entirely by adding a CSS class like `invisible` or `hidden` to the `#qr-reader-region` wrapper, or render a solid black overlay (`bg-black` instead of `bg-black/60`).
- Alternatively, set the camera container to `visibility: hidden` when paused, then restore on `resumeScanning`.

## Recommended changes — `components/Scanner.js`

1. **SubModal** (line 499): Change `z-10` → `z-[60]` to sit above the scanner's `z-50` container.

2. **Camera viewport wrapper** (line 222): Add conditional hiding:
   ```jsx
   const anySubModal = activeItem || activeAsset || notFoundId || loadingItem;
   // ...
   <div id={READER_ID} className={`w-full max-w-md ${anySubModal ? 'invisible' : ''}`} />
   ```

3. **SubModal backdrop** (line 499): Optionally strengthen from `bg-black/60` to `bg-black/80` for better visual separation.

## Result
Plan only — no code changed.

## Next
Apply the three fixes in `components/Scanner.js`, test on mobile device.
