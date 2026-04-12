// Shared item-image helpers. Images live in a Cloudflare R2 public bucket,
// keyed by Firestore document ID: <BUCKET_URL>/<ItemID>.jpg
export const BUCKET_URL =
  "https://pub-c8b9128325ac48f293c617df50a02063.r2.dev";

export const imgUrl = (id) => `${BUCKET_URL}/${encodeURIComponent(id)}.jpg`;

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
