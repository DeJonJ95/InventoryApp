"use client";

import { ref, uploadBytes } from "firebase/storage";
import { doc, updateDoc } from "firebase/firestore";
import { storage, db } from "./firebase";

/**
 * Upload (or replace) an item's photo. Stored at item-images/<id>.jpg;
 * the item's photoVersion is bumped so the cached <img> refreshes.
 *
 * @param {string} itemId
 * @param {File} file  an image file (from a file/camera input)
 */
export async function uploadItemPhoto(itemId, file) {
  if (!file) throw new Error("Pick a photo first.");
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Image is too large (max 8 MB).");
  }

  await uploadBytes(ref(storage, `item-images/${itemId}.jpg`), file, {
    contentType: file.type,
  });
  // Cache-bust: same path every time, so the URL needs a version token.
  await updateDoc(doc(db, "items", itemId), { photoVersion: Date.now() });
}
