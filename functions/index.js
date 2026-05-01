/**
 * Firebase Cloud Functions (2nd gen) for the Inventory Dashboard.
 *
 * ── Configuration ──────────────────────────────────────────────────────────
 *  RESEND_API_KEY   (secret)  Resend API key for the low-stock email alert.
 *                             Set it before deploy with:
 *                               firebase functions:secrets:set RESEND_API_KEY
 *
 *  Hardcoded constants below (edit to taste):
 *   - MANAGER_EMAIL  Recipient of restock alerts.
 *   - FROM_EMAIL     Verified Resend sender. For quick tests you may use
 *                    "onboarding@resend.dev"; for production use an address
 *                    on a domain you've verified in the Resend dashboard.
 *   - SCHEDULE_TZ    IANA timezone for the daily job + filename date.
 *
 *  Firestore document shape (collection: "items", doc ID = Item ID):
 *   { itemName: string, inStock: number, lowThreshold: number,
 *     onOrder: number, usingQty: number }
 * ───────────────────────────────────────────────────────────────────────────
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { Resend } = require("resend");
const XLSX = require("xlsx");

admin.initializeApp();
const db = admin.firestore();

const resendApiKey = defineSecret("RESEND_API_KEY");

// ── Hardcoded settings ──────────────────────────────────────────────────────
const MANAGER_EMAIL = "dejonj95@gmail.com";
const FROM_EMAIL = "onboarding@resend.dev";
const SCHEDULE_TZ = "America/Detroit";

// ── Helpers ─────────────────────────────────────────────────────────────────

// YYYY-MM-DD in the configured timezone (en-CA yields ISO-style date).
function isoDateInTz(tz) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const num = (v) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
const str = (v) => (v == null ? "" : String(v));

// ── Function 1: daily PAMS sync (.xlsx — PAMS rejects .csv) ─────────────────
exports.pamsDailySync = onSchedule(
  {
    schedule: "59 23 * * *", // 11:59 PM daily
    timeZone: SCHEDULE_TZ,
    region: "us-central1",
  },
  async () => {
    const snap = await db.collection("items").get();

    // Exact PAMS bulk-import schema (Item_Export_for_import.xls), 10 columns.
    // One row per item (single storage location model). Low Threshold /
    // On Order / Using Qty are app-internal and intentionally NOT in this
    // format — PAMS' 10-column import does not carry them.
    const headers = [
      "ItemName",
      "BarCode",
      "BasicUnit",
      "BasicQuantity",
      "LargeUnit",
      "LargeUnitConversionRatio",
      "Storage",
      "Section",
      "Shelf",
      "Description",
    ];

    // Native cell types (numbers as numbers) so PAMS's importer reads
    // quantities correctly.
    const aoa = [headers];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      aoa.push([
        str(d.itemName),
        doc.id, // BarCode == Item ID
        str(d.unit) || "EACH",
        num(d.inStock), // BasicQuantity == on-hand
        str(d.largeUnit),
        num(d.largeUnitConversionRatio),
        str(d.storage),
        str(d.section),
        str(d.shelf),
        str(d.description),
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    // Sheet name mirrors the PAMS import template ("sheet0").
    XLSX.utils.book_append_sheet(wb, ws, "sheet0");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const fileName = `exports/pams_sync_${isoDateInTz(SCHEDULE_TZ)}.xlsx`;
    await admin
      .storage()
      .bucket()
      .file(fileName)
      .save(buf, {
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        resumable: false,
        metadata: { cacheControl: "no-store" },
      });

    logger.info(
      `PAMS sync wrote ${snap.size} item(s) to gs://<bucket>/${fileName}`
    );
  }
);

// ── Function 2: low-stock threshold email alert ─────────────────────────────
exports.lowStockAlert = onDocumentUpdated(
  {
    document: "items/{itemId}",
    region: "us-central1",
    secrets: [resendApiKey],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const afterStock = num(after.inStock);
    const afterThreshold = num(after.lowThreshold);
    const beforeStock = num(before.inStock);
    const beforeThreshold = num(before.lowThreshold);

    const nowLow = afterStock < afterThreshold;
    const wasOk = beforeStock >= beforeThreshold;

    // Fire only on the OK → low transition, so we don't re-alert on every
    // edit while the item is already below threshold.
    if (!(nowLow && wasOk)) return;

    const itemId = event.params.itemId;
    const itemName = str(after.itemName) || itemId;

    const resend = new Resend(resendApiKey.value());
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: MANAGER_EMAIL,
        subject: `RESTOCK ALERT: ${itemName}`,
        text:
          `The stock for ${itemName} (ID: ${itemId}) has dropped to ` +
          `${afterStock}. The minimum threshold is ${afterThreshold}.`,
      });
      logger.info(`Sent restock alert for ${itemId} (stock=${afterStock})`);
    } catch (err) {
      logger.error(`Failed to send restock alert for ${itemId}`, err);
      throw err; // let the platform retry transient Resend failures
    }
  }
);
