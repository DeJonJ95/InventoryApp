"use client";

import { useState } from "react";
import { removeUnusedUnits, deleteItemCompletely } from "../lib/assets";
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

  const [removeN, setRemoveN] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

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
