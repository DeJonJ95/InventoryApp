/**
 * One-time bulk seed of the `items` collection from the PAMS catalog
 * (scripts/pams_seed.json, generated from Item_Export_for_import.xls).
 *
 * Seeds CATALOG ONLY: Item ID, Item Name, Unit. All quantities start at 0
 * (the PAMS export's stock/threshold data is unmaintained — the manager
 * counts items in via the scanner as bins get tagged).
 *
 * Safe to re-run: existing items are skipped, never overwritten, so it
 * won't clobber counts the manager has already entered.
 *
 * Usage (run from the InventoryApp dir after `npm install`):
 *   node scripts/importPams.mjs <manager-email> <manager-password>
 * or set PAMS_IMPORT_EMAIL / PAMS_IMPORT_PASSWORD env vars.
 *
 * Auth: uses the client SDK + the manager's login, so it works under the
 * locked Firestore rules with no service-account setup.
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBFinZruBY-4yA5wX2k2_YltyzTTS1ovOA",
  authDomain: "inventoryapp-2e86b.firebaseapp.com",
  projectId: "inventoryapp-2e86b",
  storageBucket: "inventoryapp-2e86b.firebasestorage.app",
  messagingSenderId: "475573656311",
  appId: "1:475573656311:web:47c47bc4d7427e6ec351f2",
};

const email = process.argv[2] || process.env.PAMS_IMPORT_EMAIL;
const password = process.argv[3] || process.env.PAMS_IMPORT_PASSWORD;
if (!email || !password) {
  console.error(
    "Usage: node scripts/importPams.mjs <email> <password>  (or set PAMS_IMPORT_EMAIL / PAMS_IMPORT_PASSWORD)"
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const seed = JSON.parse(
  await readFile(join(here, "pams_seed.json"), "utf-8")
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

await signInWithEmailAndPassword(auth, email, password);
console.log(`Signed in as ${email}. Seed catalog: ${seed.length} items.`);

// One read of the collection → skip anything that already exists.
const existingSnap = await getDocs(collection(db, "items"));
const existing = new Set(existingSnap.docs.map((d) => d.id));
const toCreate = seed.filter((it) => !existing.has(it.id));
console.log(
  `${existing.size} already in Firestore. Creating ${toCreate.length} new; skipping ${seed.length - toCreate.length}.`
);

const CHUNK = 400; // under Firestore's 500-write batch limit
let written = 0;
for (let i = 0; i < toCreate.length; i += CHUNK) {
  const batch = writeBatch(db);
  for (const it of toCreate.slice(i, i + CHUNK)) {
    batch.set(doc(db, "items", it.id), {
      itemName: it.itemName,
      inStock: 0,
      lowThreshold: 0,
      onOrder: 0,
      usingQty: 0,
      unit: it.unit || "EACH",
      storage: "",
      section: "",
      shelf: "",
      description: "",
      largeUnit: "",
      largeUnitConversionRatio: 0,
    });
  }
  await batch.commit();
  written += Math.min(CHUNK, toCreate.length - i);
  console.log(`  committed ${written}/${toCreate.length}`);
}

console.log("Done.");
process.exit(0);
