"use client";

import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// ── Exact Avery 5160 Address Label dimensions ──────────────────────────────
// US Letter (215.9 × 279.4 mm), 3 columns × 10 rows = 30 labels per page.
//
//              Left margin: 4.7625 mm (0.1875″)
//              Top  margin: 12.7   mm (0.5″)
//     Label size: 66.675 × 25.4 mm (2.625″ × 1″)
//   Horizontal pitch: 69.85 mm (label + 3.175 mm gap between columns)
//     Vertical pitch: 25.4  mm (0 gap — labels stack directly)
// ────────────────────────────────────────────────────────────────────────────
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN_X = 4.7625;
const MARGIN_Y = 12.7;
const COLS = 3;
const ROWS = 10;
const PER_PAGE = COLS * ROWS;
const LABEL_W = 66.675;
const LABEL_H = 25.4;
const H_PITCH = 69.85; // center-to-center horizontal
const V_PITCH = 25.4;  // center-to-center vertical

const QR_SIZE = 15; // mm (leaves ~10.4 mm below for ID + name)

function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Truncate to N chars at a word boundary, adding "…" if cut. */
function truncate(str, max) {
  if (str.length <= max) return str;
  const cut = str.slice(0, max);
  const last = cut.lastIndexOf(" ");
  return (last > 0 ? cut.slice(0, last) : cut) + "…";
}

/**
 * Render a printable sheet of QR tags for the given items and trigger a
 * browser download of the PDF.
 *
 * Each label (66.675 × 25.4 mm) gets a QR code, the item ID, and the item
 * name — sized and positioned for clean printing on Avery 5160 address-label
 * sheets (or any compatible 3×10 label stock).
 *
 * @param {Array<{id:string,itemName?:string}>} sourceItems items to tag
 * @returns {Promise<number>} number of tags generated
 * @throws {code:"empty"} if no items were passed
 */
export async function generateInventoryTagsPdf(sourceItems) {
  if (!sourceItems || sourceItems.length === 0) {
    const err = new Error("No items to print.");
    err.code = "empty";
    throw err;
  }

  const items = sourceItems
    .map((it) => ({ id: it.id, itemName: it.itemName || "" }))
    .sort((a, b) => a.id.localeCompare(b.id));

  // Pre-render all QR codes (PNG data URIs) before laying out the PDF.
  const qrByIndex = await Promise.all(
    items.map((it) =>
      QRCode.toDataURL(it.id, { margin: 1, width: 256 })
    )
  );

  const doc = new jsPDF({ unit: "mm", format: "letter" });

  items.forEach((item, i) => {
    const slot = i % PER_PAGE;
    if (i > 0 && slot === 0) doc.addPage();

    const col = slot % COLS;
    const row = Math.floor(slot / COLS);

    // Exact label bounding box on the physical sheet.
    const labelX = MARGIN_X + col * H_PITCH;
    const labelY = MARGIN_Y + row * V_PITCH;
    const centerX = labelX + LABEL_W / 2;

    // ── QR code ─────────────────────────────────────────────
    doc.addImage(
      qrByIndex[i],
      "PNG",
      centerX - QR_SIZE / 2,
      labelY + 1,
      QR_SIZE,
      QR_SIZE
    );

    // ── Item ID (bold, center below QR) ─────────────────────
    let textY = labelY + QR_SIZE + 3.2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.text(item.id, centerX, textY, { align: "center" });

    // ── Item Name (normal, one line, truncated to fit) ──────
    if (item.itemName) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      const displayName = truncate(item.itemName, 38);
      textY += 3.2;
      doc.text(displayName, centerX, textY, { align: "center" });
    }
  });

  const fileName =
    items.length === 1
      ? `inventory_tag_${items[0].id}.pdf`
      : `inventory_tags_${todayStamp()}.pdf`;
  doc.save(fileName);
  return items.length;
}
