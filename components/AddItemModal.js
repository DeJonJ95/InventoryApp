"use client";

import { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { PAMS_STORAGES, DEFAULT_STORAGE } from "../lib/items";
import { selectAllProps } from "../lib/ui";

/**
 * Create a new item profile. Doc ID = Item ID = PAMS BarCode.
 * In Stock starts at 0 (the manager counts it in later via the scanner).
 *
 * @param {() => void} onClose  Close the modal.
 */
export default function AddItemModal({ onClose }) {
  const [itemId, setItemId] = useState("");
  const [itemName, setItemName] = useState("");
  const [lowThreshold, setLowThreshold] = useState(0);
  const [unit, setUnit] = useState("EACH");
  const [storage, setStorage] = useState(DEFAULT_STORAGE);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    const id = itemId.trim();
    const name = itemName.trim();
    if (!id || !name) {
      setError("Item ID and Item Name are required.");
      return;
    }

    setSaving(true);
    try {
      const ref = doc(db, "items", id);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        setError(`Item ID "${id}" already exists.`);
        return;
      }
      await setDoc(ref, {
        itemName: name,
        inStock: 0,
        lowThreshold: Math.max(0, Math.floor(Number(lowThreshold) || 0)),
        onOrder: 0,
        usingQty: 0,
        unit: unit.trim() || "EACH",
        storage,
        section: "",
        shelf: "",
        description: "",
        largeUnit: "",
        largeUnitConversionRatio: 0,
        syncToPams: true, // new items are usually reorderable consumables
      });
      onClose(); // real-time grid listener picks up the new item automatically
    } catch (err) {
      console.error("Failed to create item:", err);
      setError("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-t-2xl bg-white p-6 sm:rounded-2xl"
      >
        <h2 className="text-xl font-bold text-gray-900">Add New Item</h2>
        <p className="mt-1 text-sm text-gray-500">
          In Stock starts at 0 — scan and count it in afterward.
        </p>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-gray-700">
            Item ID <span className="text-red-600">*</span>
          </span>
          <input
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            disabled={saving}
            autoFocus
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
          <span className="mt-1 block text-xs text-gray-400">
            Becomes the QR code / PAMS BarCode. Cannot be changed later.
          </span>
        </label>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-700">
            Item Name <span className="text-red-600">*</span>
          </span>
          <input
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50"
          />
        </label>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Low Threshold
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={lowThreshold}
              onChange={(e) => setLowThreshold(e.target.value)}
              {...selectAllProps}
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Unit</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-medium text-gray-700">Storage</span>
          <select
            value={storage}
            onChange={(e) => setStorage(e.target.value)}
            disabled={saving}
            className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            {PAMS_STORAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-lg bg-gray-200 py-3 text-base font-semibold text-gray-800 active:bg-gray-300 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white active:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Add Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
