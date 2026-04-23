"use client";

import { jsPDF } from "jspdf";
import QRCode from "qrcode";

// US Letter in mm, 3-column x 10-row grid (30 labels/page, Avery-5160 style).
const PAGE_W = 215.9;
const PAGE_H = 279.4;
const MARGIN_X = 10;
const MARGIN_Y = 12;
const COLS = 3;
const ROWS = 10;
const PER_PAGE = COLS * ROWS;

const CELL_W = (PAGE_W - 2 * MARGIN_X) / COLS;
const CELL_H = (PAGE_H - 2 * MARGIN_Y) / ROWS;
const QR_SIZE = 16; // mm

function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Render a printable sheet of QR tags (QR + Item ID + Item Name under each)
 * for the given items and trigger a browser download of the PDF.
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
    const cellX = MARGIN_X + col * CELL_W;
    const cellY = MARGIN_Y + row * CELL_H;
    const centerX = cellX + CELL_W / 2;

    // QR centered near the top of the cell.
    doc.addImage(
      qrByIndex[i],
      "PNG",
      centerX - QR_SIZE / 2,
      cellY + 1.5,
      QR_SIZE,
      QR_SIZE
    );

    // Item ID (bold) directly under the QR.
    let textY = cellY + QR_SIZE + 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(item.id, centerX, textY, { align: "center" });

    // Item Name (normal), wrapped to the cell width, max 2 lines.
    if (item.itemName) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      const lines = doc
        .splitTextToSize(item.itemName, CELL_W - 4)
        .slice(0, 2);
      textY += 3.5;
      doc.text(lines, centerX, textY, { align: "center" });
    }
  });

  const fileName =
    items.length === 1
      ? `inventory_tag_${items[0].id}.pdf`
      : `inventory_tags_${todayStamp()}.pdf`;
  doc.save(fileName);
  return items.length;
}
