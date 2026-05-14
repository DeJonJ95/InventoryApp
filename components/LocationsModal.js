"use client";

import { useState } from "react";
import {
  useLocations,
  addLocation,
  setLocationActive,
} from "../lib/locations";

/** Manage the list of checkout locations (schools/sites). */
export default function LocationsModal({ onClose }) {
  const locations = useLocations();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await addLocation(name);
      setName("");
    } catch (err) {
      setError(err.message || "Could not add location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand-darkest">Locations</h2>
          <button
            onClick={onClose}
            className="rounded-md bg-brand-surface px-3 py-1.5 text-sm font-semibold text-brand-darkest/80 active:bg-brand-surface"
          >
            Close
          </button>
        </div>
        <p className="mt-1 text-sm text-brand-darkest/50">
          Sites units can be checked out to. Deactivate instead of deleting to
          keep history intact.
        </p>

        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New location name"
            disabled={busy}
            className="flex-1 rounded-lg border border-brand-surface px-3 py-2.5 text-base focus:border-brand-teal focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-teal px-4 py-2.5 text-base font-semibold text-white active:bg-brand-teal2 disabled:opacity-50"
          >
            Add
          </button>
        </form>
        {error && (
          <p className="mt-2 text-sm font-medium text-brand-darkest">{error}</p>
        )}

        <div className="mt-4 flex-1 overflow-y-auto">
          {locations.length === 0 && (
            <p className="py-8 text-center text-sm text-brand-darkest/40">
              No locations yet.
            </p>
          )}
          {locations.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center justify-between border-b py-3"
            >
              <span
                className={`text-base ${
                  loc.active
                    ? "text-brand-darkest"
                    : "text-brand-darkest/40 line-through"
                }`}
              >
                {loc.name}
              </span>
              <button
                onClick={() => setLocationActive(loc.id, !loc.active)}
                className="rounded-md border border-brand-surface px-3 py-1.5 text-sm font-semibold text-brand-darkest/80 active:bg-brand-surface"
              >
                {loc.active ? "Deactivate" : "Reactivate"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
