// Shared item-image helpers. Photos live in Firebase Storage at
// item-images/<ItemID>.jpg (uploaded in-app via the Manage modal) and are
// served by the public media endpoint so a plain <img> works without an
// async getDownloadURL per card.
const STORAGE_BUCKET = "inventoryapp-2e86b.firebasestorage.app";

// Valid PAMS Storage locations. `code` MUST exist as a 3-char Storage
// location in PAMS (PAMS codes are Building/Floor/Room digits — 2-char
// codes like "WH" are invalid). `label` is what the manager sees.
// First entry is the default for items with no storage set.
export const PAMS_STORAGES = [
  { code: "WHS", label: "Warehouse" },
  { code: "DOE", label: "DOE" },
];
export const STORAGE_CODES = PAMS_STORAGES.map((s) => s.code);
export const DEFAULT_STORAGE = PAMS_STORAGES[0].code;
export const storageLabel = (code) =>
  PAMS_STORAGES.find((s) => s.code === code)?.label || code;

/**
 * Public image URL for an item.
 * @param {string} id        item ID
 * @param {number} [version] item.photoVersion — appended to bust the
 *                           browser cache after a new upload (same path).
 */
export const imgUrl = (id, version) => {
  const path = encodeURIComponent(`item-images/${id}.jpg`);
  const v = version ? `&v=${version}` : "";
  return `https://firebasestorage.googleapis.com/v0/b/${STORAGE_BUCKET}/o/${path}?alt=media${v}`;
};

// Inline SVG so the fallback needs no network request / static asset.
export const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'>
       <rect width='100%' height='100%' fill='#e5e7eb'/>
       <text x='50%' y='50%' font-family='sans-serif' font-size='22'
             fill='#6b7280' text-anchor='middle' dy='.3em'>No Image</text>
     </svg>`
  );
