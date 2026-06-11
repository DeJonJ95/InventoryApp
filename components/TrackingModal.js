"use client";

import { useEffect, useState } from "react";
import {
  watchCheckedOut,
  listAssetHistory,
  checkInMany,
} from "@/lib/assets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

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
  const [tab, setTab] = useState("out");

  const [groups, setGroups] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [checkInBusy, setCheckInBusy] = useState(false);

  const [assetId, setAssetId] = useState("");
  const [history, setHistory] = useState(null);
  const [historyBusy, setHistoryBusy] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => watchCheckedOut(setGroups), []);

  async function loadHistory(id) {
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

  function lookupHistory(e) {
    e.preventDefault();
    loadHistory(assetId.trim());
  }

  function viewUnit(u) {
    setAssetId(u.id);
    setTab("history");
    loadHistory(u.id);
  }

  async function checkIn(ids, confirmMsg) {
    if (ids.length === 0 || checkInBusy) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setCheckInBusy(true);
    try {
      const { done, failed } = await checkInMany(ids);
      if (failed > 0) {
        alert(`Checked in ${done}. ${failed} could not be checked in.`);
      }
    } finally {
      setCheckInBusy(false);
    }
  }

  const totalOut = groups.reduce((n, g) => n + g.units.length, 0);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tracking</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="out">Out by location ({totalOut})</TabsTrigger>
            <TabsTrigger value="history">Unit history</TabsTrigger>
          </TabsList>

          <TabsContent value="out" className="mt-4">
            {groups.length === 0 && (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nothing is checked out right now.
              </p>
            )}
            {groups.map((g) => (
              <div key={g.location} className="border-b">
                <div className="flex items-center gap-2 py-3">
                  <button
                    onClick={() =>
                      setExpanded(expanded === g.location ? null : g.location)
                    }
                    className="flex flex-1 items-center justify-between text-left"
                  >
                    <span className="font-semibold text-foreground">
                      {g.location}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {g.units.length} unit
                      {g.units.length === 1 ? "" : "s"} ▾
                    </span>
                  </button>
                  <Button
                    onClick={() =>
                      checkIn(
                        g.units.map((u) => u.id),
                        `Check in all ${g.units.length} unit(s) from ${g.location}?`
                      )
                    }
                    disabled={checkInBusy}
                    size="sm"
                  >
                    {checkInBusy ? "…" : "Check in all"}
                  </Button>
                </div>
                {expanded === g.location && (
                  <ul className="pb-3">
                    {g.units.map((u) => (
                      <li key={u.id} className="flex items-center gap-2 py-1">
                        <button
                          onClick={() => viewUnit(u)}
                          title="View this unit's history"
                          className="flex flex-1 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span className="truncate text-primary underline">
                            {u.itemName}
                          </span>
                          <span className="shrink-0 text-muted-foreground">
                            {u.id} ›
                          </span>
                        </button>
                        <Button
                          onClick={() => checkIn([u.id])}
                          disabled={checkInBusy}
                          variant="outline"
                          size="xs"
                          className="shrink-0"
                        >
                          Check in
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <form onSubmit={lookupHistory} className="flex gap-2">
              <Input
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                placeholder="Unit tag ID (e.g. 100089-0007)"
              />
              <Button type="submit" disabled={historyBusy}>
                {historyBusy ? "…" : "Look up"}
              </Button>
            </form>

            {historyError && (
              <p className="mt-3 text-sm font-medium text-foreground">
                {historyError}
              </p>
            )}

            {history && history.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No history for that unit (check the ID).
              </p>
            )}

            {history && history.length > 0 && (
              <ol className="mt-4 space-y-3">
                {history.map((ev, i) => (
                  <li key={i} className="flex gap-3">
                    <span
                      className={`mt-0.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
                        ev.type === "out" ? "bg-accent" : "bg-primary"
                      }`}
                    />
                    <div className="text-sm">
                      <p className="font-semibold text-foreground">
                        {ev.type === "out"
                          ? `Checked out → ${ev.location || "?"}`
                          : `Checked in${
                              ev.location ? ` (from ${ev.location})` : ""
                            }`}
                      </p>
                      <p className="text-muted-foreground">
                        {fmt(ev.at)}
                        {ev.byEmail ? ` · ${ev.byEmail}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}