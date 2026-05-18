"use client";

import {
  doc,
  collection,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

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
