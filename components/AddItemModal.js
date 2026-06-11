"use client";

import { useState } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PAMS_STORAGES, DEFAULT_STORAGE } from "@/lib/items";
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
        syncToPams: true,
      });
      onClose();
    } catch (err) {
      console.error("Failed to create item:", err);
      setError("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add New Item</DialogTitle>
            <DialogDescription>
              In Stock starts at 0 — scan and count it in afterward.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="itemId">
                Item ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="itemId"
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                disabled={saving}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Becomes the QR code / PAMS BarCode. Cannot be changed later.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="itemName">
                Item Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="itemName"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="lowThreshold">Low Threshold</Label>
                <Input
                  id="lowThreshold"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(e.target.value)}
                  {...selectAllProps}
                  disabled={saving}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="storage">Storage</Label>
              <select
                id="storage"
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
                disabled={saving}
                className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
              >
                {PAMS_STORAGES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-foreground">
              {error}
            </div>
          )}

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add Item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}