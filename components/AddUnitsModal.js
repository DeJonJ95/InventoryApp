"use client";

import { useState } from "react";
import { createTrackedUnits } from "../lib/assets";
import { generateInventoryTagsPdf } from "../lib/printTags";
import { selectAllProps } from "../lib/ui";

/**
 * Create N individually-tracked units for an item, then immediately
 * download the printable tag sheet for just those new units.
 *
 * @param {{id:string,itemName?:string}} item  the parent item
 * @param {() => void} onClose
 */
export default function AddUnitsModal({ item, onClose }) {
  const [count, setCount] = useState(1);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const name = item.itemName || item.id;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await createTrackedUnits(item.id, name, count);
      // Hand the new units straight to the tag PDF so the manager can
      // print and stick them now.
      await generateInventoryTagsPdf(created);
      onClose();
    } catch (err) {
      console.error("Create units failed:", err);
      setError(err.message || "Could not create units. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6"
      >
        <h2 className="text-xl font-bold text-brand-darkest">Add Tracked Units</h2>
        <p className="mt-1 text-sm text-brand-darkest/50">
          For <span className="font-semibold">{name}</span>. Each unit gets its
          own tag for individual check-in/out.
        </p>

        <label className="mt-5 block">
          <span className="text-sm font-medium text-brand-darkest/80">
            How many units?
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={count}
            autoFocus
            disabled={busy}
            onChange={(e) =>
              setCount(Math.max(1, Math.floor(+e.target.value || 1)))
            }
            {...selectAllProps}
            className="mt-1 w-full rounded-lg border border-brand-surface px-3 py-3 text-2xl font-bold tabular-nums focus:border-brand-teal focus:outline-none disabled:opacity-50"
          />
          <span className="mt-1 block text-xs text-brand-darkest/40">
            Adds this many to In Stock and generates a tag sheet to print.
          </span>
        </label>

        {error && (
          <p className="mt-4 rounded-lg bg-brand-gold/10 px-3 py-2 text-sm font-medium text-brand-darkest">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-lg bg-brand-surface py-3 text-base font-semibold text-brand-darkest active:bg-brand-surface/80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="flex-1 rounded-lg bg-brand-teal py-3 text-base font-semibold text-white active:bg-brand-teal2 disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create & Print Tags"}
          </button>
        </div>
      </form>
    </div>
  );
}
