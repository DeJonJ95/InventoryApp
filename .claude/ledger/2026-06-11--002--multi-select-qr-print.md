# Step 002: Multi-select batch printing for rack labeling

## Context
User needs to select specific items (e.g. "toner-cyan", "toner-magenta", "toner-black") and print QR labels only for those — rather than printing every visible item or printing one-at-a-time. This is for first-time rack labeling.

## Result
**pass** — `next build` compiles clean.

Changes to `app/page.js`:
- Added `selectedItems` state (Set) + `toggleSelection`, `clearSelection`, `selectAllVisible` helpers
- Each card gets a checkbox button (overlaid top-left of photo) using Phosphor `Square`/`CheckSquare` icons
- Filter bar shows "Select All" / "Clear" + selection count ("3 selected")
- Header and mobile-menu print buttons show "Print Selected (N)" when selection is active, "Print Tags (N)" otherwise
- `handlePrintTags` resolves selected items (by ID lookup against full `items`) when no explicit list is passed
- Selection clears automatically after successful print
- Per-card "Item Tag" / "Unit Tags" buttons are unchanged

## Next
None — this is complete.