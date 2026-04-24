"use client";

import { useEffect, useState } from "react";
import { watchCheckedOut, listAssetHistory } from "../lib/assets";

function fmt(d) {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TrackingModal({ onClose }) {
  const [tab, setTab] = useState("out"); // "out" | "history"

  // Out-by-location (live)
  const [groups, setGroups] = useState([]);
  const [expanded, setExpanded] = useState(null);

  // Unit history (on demand)
  const [assetId, setAssetId] = useState("");
  const [history, setHistory] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => watchCheckedOut(setGroups), []);

  async function lookupHistory(e) {
    e.preventDefault();
    const id = assetId.trim();
    if (!id) return;
    setHistoryError("");
    setHistoryBusy(true);
    setHistory(null);
    try {
      const events = await listAssetHistory(id);
      setHistory(events);
    } catch (err) {
      console.error("History lookup failed:", err);
      setHistoryError("Could not load history. Please try again.");
    } finally {
      setHistoryBusy(false);
    }
  }

  const totalOut = groups.reduce((n, g) => n + g.units.length, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Tracking</h2>
          <button
            onClick={onClose}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-700 active:bg-gray-200"
          >
            Close
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setTab("out")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === "out"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Out by location ({totalOut})
          </button>
          <button
            onClick={() => setTab("history")}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold ${
              tab === "history"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            Unit history
          </button>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto">
          {tab === "out" && (
            <>
              {groups.length === 0 && (
                <p className="py-10 text-center text-sm text-gray-400">
                  Nothing is checked out right now.
                </p>
              )}
              {groups.map((g) => (
                <div key={g.location} className="border-b">
                  <button
                    onClick={() =>
                      setExpanded(expanded === g.location ? null : g.location)
                    }
                    className="flex w-full items-center justify-between py-3 text-left"
                  >
                    <span className="font-semibold text-gray-900">
                      {g.location}
                    </span>
                    <span className="text-sm text-gray-500">
                      {g.units.length} unit{g.units.length === 1 ? "" : "s"} ▾
                    </span>
                  </button>
                  {expanded === g.location && (
                    <ul className="pb-3">
                      {g.units.map((u) => (
                        <li
                          key={u.id}
                          className="flex justify-between py-1 text-sm"
                        >
                          <span className="text-gray-700">{u.itemName}</span>
                          <span className="text-gray-400">{u.id}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </>
          )}

          {tab === "history" && (
            <>
              <form onSubmit={lookupHistory} className="flex gap-2">
                <input
                  value={assetId}
                  onChange={(e) => setAssetId(e.target.value)}
                  placeholder="Unit tag ID (e.g. 100089-0007)"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={historyBusy}
                  className="rounded-lg bg-blue-600 px-4 py-2.5 text-base font-semibold text-white active:bg-blue-700 disabled:opacity-50"
                >
                  {historyBusy ? "…" : "Look up"}
                </button>
              </form>

              {historyError && (
                <p className="mt-3 text-sm font-medium text-red-700">
                  {historyError}
                </p>
              )}

              {history && history.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400">
                  No history for that unit (check the ID).
                </p>
              )}

              {history && history.length > 0 && (
                <ol className="mt-4 space-y-3">
                  {history.map((ev, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                          ev.type === "out" ? "bg-amber-500" : "bg-green-600"
                        }`}
                      />
                      <div className="text-sm">
                        <p className="font-semibold text-gray-900">
                          {ev.type === "out"
                            ? `Checked out → ${ev.location || "?"}`
                            : `Checked in${
                                ev.location ? ` (from ${ev.location})` : ""
                              }`}
                        </p>
                        <p className="text-gray-500">
                          {fmt(ev.at)}
                          {ev.byEmail ? ` · ${ev.byEmail}` : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
