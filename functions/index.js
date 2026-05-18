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

admin.initializeApp();
const db = admin.firestore();

const resendApiKey = defineSecret("RESEND_API_KEY");

// ── Hardcoded settings ──────────────────────────────────────────────────────
const MANAGER_EMAIL = "dejonj95@gmail.com";
const FROM_EMAIL = "onboarding@resend.dev";
const SCHEDULE_TZ = "America/Detroit";

// ── Helpers ─────────────────────────────────────────────────────────────────

// RFC-4180 CSV field escaping: wrap in quotes if it contains comma, quote,
// or newline; double any embedded quotes.
function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

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

// ── Function 1: daily CSV sync for the legacy PAMS system ───────────────────
exports.pamsDailySync = onSchedule(
  {
    schedule: "59 23 * * *", // 11:59 PM daily
    timeZone: SCHEDULE_TZ,
    region: "us-central1",
  },
  async () => {
    const snap = await db.collection("items").get();

    const headers = [
      "Item ID",
      "Item Name",
      "In Stock",
      "Low Threshold",
      "On Order",
      "Using Qty",
    ];

    const rows = [headers.join(",")];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      rows.push(
        [
          csvEscape(doc.id),
          csvEscape(str(d.itemName)),
          csvEscape(num(d.inStock)),
          csvEscape(num(d.lowThreshold)),
          csvEscape(num(d.onOrder)),
          csvEscape(num(d.usingQty)),
        ].join(",")
      );
    });

    // Trailing newline keeps line-based legacy parsers happy.
    const csv = rows.join("\r\n") + "\r\n";

    const fileName = `exports/pams_sync_${isoDateInTz(SCHEDULE_TZ)}.csv`;
    await admin
      .storage()
      .bucket()
      .file(fileName)
      .save(csv, {
        contentType: "text/csv",
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
