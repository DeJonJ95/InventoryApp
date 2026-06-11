# InventoryApp — Code Map

built-at: 2026-06-10 · fingerprint: mtime (YYYY-MM-DD) · verify-stale: `Get-ChildItem app,components,lib,functions -Recurse -File | Select Name,LastWriteTime`

Next.js 14 (App Router) single-page app + Firebase (Auth, Firestore, Storage, Cloud Functions 2nd gen). Internal single-team inventory tool: QR check-in/out of tracked units, nightly PAMS export, low-stock email alerts. Dev: `npm run dev`.

---

## Data model (Cloud Firestore)

```
items        doc id = ItemID (also the QR value for untracked bins + PAMS BarCode)
             { itemName, inStock, lowThreshold, onOrder, usingQty,
               tracked:bool, assetSeq:int, syncToPams:bool, photoVersion:int,
               unit, storage, section, shelf, description, largeUnit, largeUnitConversionRatio }
assets       doc id = `<itemId>-NNNN` (zero-padded seq; doubles as the QR tag value)
             { itemId, itemName, seq, status:"in_stock"|"checked_out", location, createdAt, updatedAt }
assetEvents  append-only audit log (never deleted, even on item delete)
             { assetId, itemId, itemName, type:"in"|"out", location, at, byEmail }
locations    { name, active:bool, createdAt }
```
Relationships: one item → many assets → many assetEvents. `inStock`/`usingQty` on the item are a roll-up of its assets' warehouse/checked-out counts, kept in sync inside transactions.

Storage: `item-images/<ItemID>.jpg` (Firebase Storage). `exports/pams_sync_YYYY-MM-DD.xls` (Cloud Function output).

---

## Files

### App shell (`app/`)
| file | mtime | purpose · key symbols |
|---|---|---|
| `app/page.js` | 2026-06-09 | Auth gate + dashboard. `DashboardPage` (auth state), `InventoryDashboard:62` (grid, stats bar, search/filters, header actions, modal wiring). `visibleItems:80` filter memo; `handlePrintTags:99`, `printItemTags:135`. Real-time `onSnapshot` on `items` at :158. |
| `app/layout.js` | 2026-05-17 | Root layout. |
| `app/globals.css` | 2026-06-09 | Tailwind + brand color tokens (`brand-darkest`, `brand-teal`, `accent`, etc.). |

### Data layer (`lib/`)
| file | mtime | purpose · key symbols |
|---|---|---|
| `lib/firebase.js` | 2026-05-18 | Firebase init; exports `db`, `auth`, `storage`. |
| `lib/items.js` | 2026-05-18 | Image URLs + PAMS storage config. `PAMS_STORAGES:11`, `STORAGE_CODES`, `DEFAULT_STORAGE`, `imgUrl:26` (cache-busts via photoVersion), `FALLBACK_IMG:33` (inline SVG). |
| `lib/assets.js` | 2026-05-18 | **Unit lifecycle — all transactional.** `checkOutAsset:145`, `checkInAsset:185`, `createTrackedUnits:275` (writes N asset docs, bumps assetSeq, +inStock), `removeUnusedUnits:25` (spare-only), `deleteItemCompletely:55` (blocked if any unit checked out), `watchCheckedOut:86`, `listAssetHistory:119`, `checkInMany:225`, `listAssetTags:246`. |
| `lib/locations.js` | 2026-05-18 | `addLocation`, `setLocationActive`, `listActiveLocations` (one-shot), `useLocations` (live hook). |
| `lib/pamsExport.js` | 2026-05-18 | Client side of PAMS: finds newest `exports/*.xls` in Storage + downloads it. `getLatestPamsExport:33`, `useLatestPamsExport:50` hook. |
| `lib/printTags.js` | 2026-06-09 | jsPDF QR tag sheet, Avery-5160 (3×10, 30/page). `generateInventoryTagsPdf:33`. Pre-renders QR PNGs via `qrcode`. |
| `lib/photo.js` | 2026-05-18 | `uploadItemPhoto` → Storage `item-images/<id>.jpg`, bumps `photoVersion`. |
| `lib/ui.js` | 2026-05-18 | `selectAllProps` (select-on-focus for number inputs). |
| `lib/utils.js` | 2026-06-09 | `cn()` Tailwind class merge (clsx + tailwind-merge). |

### Components (`components/`)
| file | mtime | purpose · key symbols |
|---|---|---|
| `Scanner.js` | 2026-06-09 | Full-screen QR scanner (html5-qrcode). `handleDecoded:50` — asset tag → check-in/out sub-modal; item code → stock-adjust sub-modal; else "not found". Sticky `selectedLocation` across scans. Camera lifecycle in `useEffect:156`. |
| `AddItemModal.js` | 2026-06-09 | Create item (id is permanent QR/BarCode). `setDoc` with full default field set incl. `syncToPams:true`. |
| `AddUnitsModal.js` | 2026-06-09 | Create N tracked units → `createTrackedUnits`, then print their tags. |
| `ManageItemModal.js` | 2026-06-09 | Per-item admin: toggle PAMS sync, storage, photo upload, threshold, remove spare units, delete item (danger zone). |
| `TrackingModal.js` | 2026-06-09 | Two tabs: "Out by location" (live `watchCheckedOut`, bulk check-in) + "Unit history" (`listAssetHistory` by tag id). |
| `LocationsModal.js` | 2026-06-09 | Manage location list (add / activate-deactivate). |
| `Login.js` | 2026-06-09 | Firebase email/password sign-in. |
| `HelpModal.js` | 2026-06-09 | In-app usage help. |
| `components/ui/*.jsx` | 2026-06-09 | shadcn-style primitives: button, card, badge, dialog, input, label, select, tabs. |

### Backend (`functions/`)
| file | mtime | purpose · key symbols |
|---|---|---|
| `functions/index.js` | 2026-05-18 | Cloud Functions 2nd gen. `pamsDailySync:60` (cron `59 23 * * *` America/Detroit → binary .xls to Storage). `lowStockAlert:140` (Firestore `onDocumentUpdated` → Resend email). |

### Config (project root)
`firestore.rules` (any authed user = full read/write), `storage.rules`, `firebase.json`, `.firebaserc`, `next.config.js`, `tailwind.config.js`.

---

## Change recipes
- **Add an item field** → `AddItemModal.js` (form + setDoc default) · `ManageItemModal.js` if editable · `functions/index.js` PAMS column array (~:73) if it should reach PAMS · this map's data-model block.
- **New stock transaction** → add to `lib/assets.js`, mirror the `runTransaction` shape in `checkOutAsset` (read asset + item, update both, write an assetEvent).
- **Change the PAMS export format** → `functions/index.js` `headers`/`aoa` (:73–:111). Must stay 10 columns, biff8.
- **Add a header action / modal** → wire state + button in `app/page.js` `InventoryDashboard`, render modal at the bottom (:561+).
- **Touch tag PDF layout** → `lib/printTags.js` grid constants at top (PAGE/COLS/ROWS/CELL).

## Gotchas
- **PAMS export MUST be legacy binary `.xls` (biff8), not `.xlsx`** — PAMS rejects .xlsx despite its own UI text. `functions/index.js:119`.
- **PAMS sync skips tracked items even if `syncToPams` is true** — PAMS Equipment-Tracking items reject the consumables import. `functions/index.js:96`.
- **PAMS Storage code must be a real 3-char PAMS location** (e.g. `WHS`); 2-char codes like "WH" are invalid. `lib/items.js:9`.
- **`lowStockAlert` fires only on the OK→low transition**, not every save below threshold — avoids re-alert spam. `functions/index.js:161`.
- **`assetEvents` are never deleted**, even when an item + its units are deleted — intentional audit trail. `lib/assets.js:55`.
- **`deleteItemCompletely` is blocked if any unit is checked out** — those are physically out and must be checked in first. `lib/assets.js:59`.
- **`inStock` counts warehouse units only**; checked-out units move to `usingQty`. The two are adjusted together inside every check-in/out transaction.
- **Firestore rules are wide-open to any authed user** — single-team model, no per-user ownership. `firestore.rules`.
- **Item ID is permanent** — it's the QR value and PAMS BarCode; there's no rename path. `AddItemModal.js:96`.
- Subscriptions use single-equality `where()` filters and sort client-side specifically to avoid needing composite Firestore indexes. `lib/assets.js:82,117`.
