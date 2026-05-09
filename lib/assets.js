"use client";

import {
  doc,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  runTransaction,
  writeBatch,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { db, auth } from "./firebase";

/**
 * Remove `count` spare (in-warehouse) units from a tracked item — for
 * correcting an over-create (e.g. printed 100, only 50 exist). Only
 * touches in_stock units; checked-out units are never removed. Decrements
 * the item's inStock by however many were actually removed.
 *
 * @returns {Promise<number>} units actually removed
 */
export async function removeUnusedUnits(itemId, count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1) throw new Error("Enter how many to remove.");

  const snap = await getDocs(
    query(collection(db, "assets"), where("itemId", "==", itemId))
  );
  const spare = snap.docs.filter((d) => d.data().status === "in_stock");
  if (spare.length === 0) {
    throw new Error("No spare (in-warehouse) units to remove.");
  }
  const take = Math.min(n, spare.length);

  const batch = writeBatch(db);
  spare.slice(0, take).forEach((d) => batch.delete(d.ref));
  batch.update(doc(db, "items", itemId), { inStock: increment(-take) });
  await batch.commit();
  return take;
}

/**
 * Delete an item entirely (no longer carried) plus all its tracked
 * units. Blocked if any unit is still checked out — those are physically
 * out at a location and must be checked in first. Past assetEvents are
 * left as an audit trail.
 *
 * NOTE: this does NOT remove the item from PAMS — PAMS is the catalog
 * system of record; the item just stops appearing in the nightly CSV.
 * Retire it in PAMS too if it's truly discontinued.
 */
export async function deleteItemCompletely(itemId) {
  const aSnap = await getDocs(
    query(collection(db, "assets"), where("itemId", "==", itemId))
  );
  const out = aSnap.docs.filter((d) => d.data().status === "checked_out");
  if (out.length > 0) {
    throw new Error(
      `${out.length} unit(s) still checked out. Check them all in first.`
    );
  }

  let batch = writeBatch(db);
  let n = 0;
  for (const d of aSnap.docs) {
    batch.delete(d.ref);
    if (++n % 400 === 0) {
      await batch.commit();
      batch = writeBatch(db);
    }
  }
  batch.delete(doc(db, "items", itemId));
  await batch.commit();
}

/**
 * Live subscription to every checked-out unit, grouped by location.
 * Single equality filter → no composite index needed.
 *
 * @param {(groups: Array<{location:string, units:Array}>) => void} cb
 * @returns unsubscribe fn
 */
export function watchCheckedOut(cb) {
  return onSnapshot(
    query(collection(db, "assets"), where("status", "==", "checked_out")),
    (snap) => {
      const byLoc = new Map();
      snap.docs.forEach((d) => {
        const a = d.data();
        const loc = a.location || "(unknown)";
        if (!byLoc.has(loc)) byLoc.set(loc, []);
        byLoc.get(loc).push({
          id: d.id,
          itemName: a.itemName || a.itemId,
          itemId: a.itemId,
        });
      });
      const groups = [...byLoc.entries()]
        .map(([location, units]) => ({
          location,
          units: units.sort((x, y) => x.id.localeCompare(y.id)),
        }))
        .sort((x, y) => x.location.localeCompare(y.location));
      cb(groups);
    },
    (err) => console.error("Checked-out subscription error:", err)
  );
}

/**
 * Full in/out history for one asset, newest first. Sorted client-side so
 * no composite (assetId + at) index is required.
 *
 * @returns {Promise<Array<{type,location,at:Date|null,byEmail}>>}
 */
export async function listAssetHistory(assetId) {
  const snap = await getDocs(
    query(collection(db, "assetEvents"), where("assetId", "==", assetId))
  );
  return snap.docs
    .map((d) => {
      const e = d.data();
      return {
        type: e.type,
        location: e.location || null,
        byEmail: e.byEmail || null,
        at: e.at?.toDate ? e.at.toDate() : null,
      };
    })
    .sort((a, b) => (b.at?.getTime() || 0) - (a.at?.getTime() || 0));
}

function currentEmail() {
  return auth.currentUser?.email || null;
}

/**
 * Check an asset OUT to a location. Atomically: asset → checked_out at
 * `locationName`, parent item inStock--/usingQty++ (warehouse-only count),
 * and an "out" event is logged.
 */
export async function checkOutAsset(assetId, locationName) {
  const loc = (locationName || "").trim();
  if (!loc) throw new Error("Pick a location to check out to.");
  const assetRef = doc(db, "assets", assetId);
  await runTransaction(db, async (tx) => {
    const aSnap = await tx.get(assetRef);
    if (!aSnap.exists()) throw new Error("Asset not found.");
    const a = aSnap.data();
    if (a.status === "checked_out") {
      throw new Error(`Already checked out (at ${a.location || "unknown"}).`);
    }
    const itemRef = doc(db, "items", a.itemId);
    const iSnap = await tx.get(itemRef);
    const i = iSnap.exists() ? iSnap.data() : {};

    tx.update(assetRef, {
      status: "checked_out",
      location: loc,
      updatedAt: serverTimestamp(),
    });
    tx.update(itemRef, {
      inStock: Math.max(0, (Number(i.inStock) || 0) - 1),
      usingQty: (Number(i.usingQty) || 0) + 1,
    });
    tx.set(doc(collection(db, "assetEvents")), {
      assetId,
      itemId: a.itemId,
      itemName: a.itemName || a.itemId,
      type: "out",
      location: loc,
      at: serverTimestamp(),
      byEmail: currentEmail(),
    });
  });
}

/**
 * Check an asset back IN to the warehouse. Reverses the roll-up and logs
 * an "in" event.
 */
export async function checkInAsset(assetId) {
  const assetRef = doc(db, "assets", assetId);
  await runTransaction(db, async (tx) => {
    const aSnap = await tx.get(assetRef);
    if (!aSnap.exists()) throw new Error("Asset not found.");
    const a = aSnap.data();
    if (a.status !== "checked_out") {
      throw new Error("This unit is already in the warehouse.");
    }
    const itemRef = doc(db, "items", a.itemId);
    const iSnap = await tx.get(itemRef);
    const i = iSnap.exists() ? iSnap.data() : {};

    tx.update(assetRef, {
      status: "in_stock",
      location: null,
      updatedAt: serverTimestamp(),
    });
    tx.update(itemRef, {
      inStock: (Number(i.inStock) || 0) + 1,
      usingQty: Math.max(0, (Number(i.usingQty) || 0) - 1),
    });
    tx.set(doc(collection(db, "assetEvents")), {
      assetId,
      itemId: a.itemId,
      itemName: a.itemName || a.itemId,
      type: "in",
      location: a.location || null,
      at: serverTimestamp(),
      byEmail: currentEmail(),
    });
  });
}

/**
 * Check several units back in without scanning (managers only). Each is
 * its own transaction; failures (e.g. already in) are counted, not fatal.
 *
 * @returns {Promise<{done:number, failed:number}>}
 */
export async function checkInMany(assetIds) {
  let done = 0;
  let failed = 0;
  for (const id of assetIds) {
    try {
      await checkInAsset(id);
      done += 1;
    } catch (err) {
      console.error(`Bulk check-in failed for ${id}:`, err);
      failed += 1;
    }
  }
  return { done, failed };
}

/**
 * All asset units for an item, sorted by sequence — ready to hand to
 * generateInventoryTagsPdf() for (re)printing unit tags.
 *
 * @returns {Promise<Array<{id:string,itemName:string}>>}
 */
export async function listAssetTags(itemId, itemName) {
  const snap = await getDocs(
    query(collection(db, "assets"), where("itemId", "==", itemId))
  );
  return snap.docs
    .map((d) => ({
      id: d.id,
      seq: Number(d.data().seq) || 0,
      itemName: d.data().itemName || itemName || itemId,
    }))
    .sort((a, b) => a.seq - b.seq)
    .map(({ id, itemName }) => ({ id, itemName }));
}

const MAX_PER_BATCH = 200; // well under Firestore's 500-write transaction limit

/**
 * Create `count` individually-tracked asset units under an item.
 *
 * Atomically: writes N asset docs (status "in_stock"), marks the item
 * tracked, bumps its asset sequence counter, and adds N to the item's
 * inStock (warehouse-only count → flows to the PAMS CSV unchanged).
 *
 * Asset IDs are `<itemId>-NNNN` (zero-padded sequence) and double as the
 * QR tag value.
 *
 * @returns {Promise<Array<{id:string,itemName:string}>>} created assets,
 *          ready to hand to generateInventoryTagsPdf().
 */
export async function createTrackedUnits(itemId, itemName, count) {
  const n = Math.floor(Number(count));
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("Enter a quantity of 1 or more.");
  }
  if (n > MAX_PER_BATCH) {
    throw new Error(`Create at most ${MAX_PER_BATCH} units at a time.`);
  }

  const itemRef = doc(db, "items", itemId);
  let created = [];

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(itemRef);
    if (!snap.exists()) throw new Error("That item no longer exists.");
    const data = snap.data();

    const startSeq = (Number(data.assetSeq) || 0) + 1;
    created = [];
    for (let i = 0; i < n; i++) {
      const seq = startSeq + i;
      const assetId = `${itemId}-${String(seq).padStart(4, "0")}`;
      tx.set(doc(db, "assets", assetId), {
        itemId,
        itemName,
        seq,
        status: "in_stock",
        location: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      created.push({ id: assetId, itemName });
    }

    tx.update(itemRef, {
      tracked: true,
      assetSeq: startSeq + n - 1,
      inStock: (Number(data.inStock) || 0) + n,
    });
  });

  return created;
}
