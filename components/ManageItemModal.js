"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { removeUnusedUnits, deleteItemCompletely } from "../lib/assets";
import { uploadItemPhoto } from "../lib/photo";
import {
  imgUrl,
  FALLBACK_IMG,
  PAMS_STORAGES,
  STORAGE_CODES,
  DEFAULT_STORAGE,
} from "../lib/items";
import { selectAllProps } from "../lib/ui";

/**
 * Correct/clean up an item: remove spare over-created units, or delete
 * the item entirely when it's no longer carried.
 *
 * @param {object} item  the item ({id, itemName, tracked, inStock, usingQty})
 * @param {() => void} onClose
 */
export default function ManageItemModal({ item, onClose }) {
  const name = item.itemName || item.id;
  const inStock = Number(item.inStock) || 0;
  const out = Number(item.usingQty) || 0;

  const [syncPams, setSyncPams] = useState(item.syncToPams === true);
  const [storageLoc, setStorageLoc] = useState(
    STORAGE_CODES.includes(item.storage) ? item.storage : DEFAULT_STORAGE
  );
  const [removeN, setRemoveN] = useState(1);
  const [threshold, setThreshold] = useState(Number(item.lowThreshold) || 0);
  const [thresholdMsg, setThresholdMsg] = useState("");
  const [photoMsg, setPhotoMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function toggleSyncPams() {
    const next = !syncPams;
    setSyncPams(next);
    setError("");
    try {
      await updateDoc(doc(db, "items", item.id), { syncToPams: next });
    } catch (err) {
      setSyncPams(!next); // revert on failure
      setError(err.message || "Could not update PAMS setting.");
    }
  }

  async function changeStorage(value) {
    const prev = storageLoc;
    setStorageLoc(value);
    setError("");
    try {
      await updateDoc(doc(db, "items", item.id), { storage: value });
    } catch (err) {
      setStorageLoc(prev);
      setError(err.message || "Could not update storage.");
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    setError("");
    setPhotoMsg("");
    setBusy(true);
    try {
      await uploadItemPhoto(item.id, file);
      setPhotoMsg("Photo saved.");
    } catch (err) {
      setError(err.message || "Could not upload photo.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveThreshold() {
    setError("");
    setThresholdMsg("");
    setBusy(true);
    try {
      await updateDoc(doc(db, "items", item.id), {
        lowThreshold: Math.max(0, Math.floor(Number(threshold) || 0)),
      });
      setThresholdMsg("Saved.");
    } catch (err) {
      setError(err.message || "Could not save threshold.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError("");
    setMsg("");
    setBusy(true);
    try {
      const removed = await removeUnusedUnits(item.id, removeN);
      setMsg(`Removed ${removed} spare unit${removed === 1 ? "" : "s"}.`);
    } catch (err) {
      setError(err.message || "Could not remove units.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${name}" and all its tracked units? This cannot be undone. (Does not remove it from PAMS.)`
      )
    ) {
      return;
    }
    setError("");
    setBusy(true);
    try {
      await deleteItemCompletely(item.id);
      onClose();
    } catch (err) {
      setError(err.message || "Could not delete item.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Manage Item</h2>
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          <span className="font-semibold">{name}</span> · {inStock} in stock
          {item.tracked ? ` · ${out} out` : ""}
        </p>

        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                Reorder via PAMS
              </p>
              <p className="text-xs text-gray-500">
                {item.tracked
                  ? "Unavailable — tracked equipment isn't a PAMS consumable. PAMS rejects equipment in the supplies import."
                  : "Include this consumable in the nightly PAMS file. Only for vendor-reordered supplies, never equipment."}
              </p>
            </div>
            <button
              onClick={toggleSyncPams}
              role="switch"
              aria-checked={syncPams && !item.tracked}
              disabled={item.tracked}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${
                syncPams && !item.tracked ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition ${
                  syncPams && !item.tracked ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <div>
              <p className="text-sm font-semibold text-gray-800">Storage</p>
              <p className="text-xs text-gray-500">
                Where it's stored (sent to PAMS with the quantity).
              </p>
            </div>
            <select
              value={storageLoc}
              onChange={(e) => changeStorage(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-base focus:border-blue-500 focus:outline-none"
            >
              {PAMS_STORAGES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-800">Photo</p>
          <p className="text-xs text-gray-500">
            Take or choose a picture of this item.
          </p>
          <div className="mt-3 flex items-center gap-3">
            <img
              src={imgUrl(item.id, item.photoVersion)}
              alt={name}
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = FALLBACK_IMG;
              }}
              className="h-16 w-16 rounded-lg object-cover"
            />
            <label className="flex-1">
              <span
                className={`block cursor-pointer rounded-lg py-2.5 text-center text-base font-semibold text-white ${
                  busy ? "bg-blue-300" : "bg-blue-600 active:bg-blue-700"
                }`}
              >
                {busy ? "Working…" : "Take / choose photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                disabled={busy}
                onChange={handlePhoto}
                className="hidden"
              />
            </label>
          </div>
          {photoMsg && (
            <p className="mt-2 text-sm font-medium text-green-700">
              {photoMsg}
            </p>
          )}
        </div>

        <div className="mt-5 rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-semibold text-gray-800">
            Low threshold
          </p>
          <p className="text-xs text-gray-500">
            Alert/reorder when In Stock drops below this.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={threshold}
              disabled={busy}
              onChange={(e) =>
                setThreshold(Math.max(0, Math.floor(+e.target.value || 0)))
              }
              {...selectAllProps}
              className="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-lg tabular-nums disabled:opacity-50"
            />
            <button
              onClick={handleSaveThreshold}
              disabled={busy}
              className="flex-1 rounded-lg bg-blue-600 py-2.5 text-base font-semibold text-white active:bg-blue-700 disabled:opacity-50"
            >
              {busy ? "Working…" : "Save threshold"}
            </button>
          </div>
          {thresholdMsg && (
            <p className="mt-2 text-sm font-medium text-green-700">
              {thresholdMsg}
            </p>
          )}
        </div>

        {item.tracked && (
          <div className="mt-5 rounded-xl border border-gray-200 p-4">
            <p className="text-sm font-semibold text-gray-800">
              Remove spare units
            </p>
            <p className="text-xs text-gray-500">
              Fixes an over-create. Only removes in-warehouse units — never
              ones checked out.
            </p>
            <div className="mt-3 flex gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={removeN}
                disabled={busy}
                onChange={(e) =>
                  setRemoveN(Math.max(1, Math.floor(+e.target.value || 1)))
                }
                {...selectAllProps}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2.5 text-lg tabular-nums disabled:opacity-50"
              />
              <button
                onClick={handleRemove}
                disabled={busy}
                className="flex-1 rounded-lg bg-gray-800 py-2.5 text-base font-semibold text-white active:bg-gray-700 disabled:opacity-50"
              >
                {busy ? "Working…" : "Remove"}
              </button>
            </div>
            {msg && (
              <p className="mt-2 text-sm font-medium text-green-700">{msg}</p>
            )}
          </div>
        )}

        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Danger zone</p>
          <p className="text-xs text-red-600">
            Deletes the item and all its units. Blocked if any unit is checked
            out. Does not remove it from PAMS.
          </p>
          <button
            onClick={handleDelete}
            disabled={busy}
            className="mt-3 w-full rounded-lg bg-red-600 py-2.5 text-base font-semibold text-white active:bg-red-700 disabled:opacity-50"
          >
            {busy ? "Working…" : "Delete this item"}
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
