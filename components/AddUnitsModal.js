"use client";

import { useState } from "react";
import { createTrackedUnits } from "@/lib/assets";
import { generateInventoryTagsPdf } from "@/lib/printTags";
import { selectAllProps } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Tracked Units</DialogTitle>
            <DialogDescription>
              For <span className="font-semibold text-foreground">{name}</span>. Each unit gets its
              own tag for individual check-in/out.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-2">
            <Label htmlFor="unitCount">How many units?</Label>
            <Input
              id="unitCount"
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
              className="text-2xl font-bold tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Adds this many to In Stock and generates a tag sheet to print.
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-foreground">
              {error}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create & Print Tags"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}