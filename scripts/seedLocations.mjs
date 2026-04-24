/**
 * One-time seed of the `locations` collection from the poll-location list
 * (scripts/locations_seed.json, extracted from CagePacking.xls — 156 unique
 * sites). Each becomes an active checkout location.
 *
 * Safe to re-run: existing locations (matched case-insensitively by name)
 * are skipped, so it won't create duplicates.
 *
 * Usage (from the InventoryApp dir, after `npm install`):
 *   node scripts/seedLocations.mjs <manager-email> <manager-password>
 * or set PAMS_IMPORT_EMAIL / PAMS_IMPORT_PASSWORD.
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
  serverTimestamp,
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
    "Usage: node scripts/seedLocations.mjs <email> <password>  (or set PAMS_IMPORT_EMAIL / PAMS_IMPORT_PASSWORD)"
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const names = JSON.parse(
  await readFile(join(here, "locations_seed.json"), "utf-8")
);

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

await signInWithEmailAndPassword(auth, email, password);
console.log(`Signed in as ${email}. Seed list: ${names.length} locations.`);

const existingSnap = await getDocs(collection(db, "locations"));
const existing = new Set(
  existingSnap.docs.map((d) => (d.data().name || "").trim().toLowerCase())
);
const toCreate = names.filter((n) => !existing.has(n.trim().toLowerCase()));
console.log(
  `${existing.size} already present. Creating ${toCreate.length}; skipping ${names.length - toCreate.length}.`
);

const CHUNK = 400;
let written = 0;
for (let i = 0; i < toCreate.length; i += CHUNK) {
  const batch = writeBatch(db);
  for (const name of toCreate.slice(i, i + CHUNK)) {
    batch.set(doc(collection(db, "locations")), {
      name,
      active: true,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
  written += Math.min(CHUNK, toCreate.length - i);
  console.log(`  committed ${written}/${toCreate.length}`);
}

console.log("Done.");
process.exit(0);
