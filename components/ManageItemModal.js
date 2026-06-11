"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { removeUnusedUnits, deleteItemCompletely } from "@/lib/assets";
import { uploadItemPhoto } from "@/lib/photo";
import {
  imgUrl,
  FALLBACK_IMG,
  PAMS_STORAGES,
  STORAGE_CODES,
  DEFAULT_STORAGE,
} from "@/lib/items";
import { selectAllProps } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
      setSyncPams(!next);
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
    e.target.value = "";
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Item</DialogTitle>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{name}</span> · {inStock} in stock
            {item.tracked ? ` · ${out} out` : ""}
          </p>
        </DialogHeader>

        {/* PAMS / Storage */}
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Reorder via PAMS
              </p>
              <p className="text-xs text-muted-foreground">
                {item.tracked
                  ? "Unavailable — tracked equipment isn't a PAMS consumable."
                  : "Include this consumable in the nightly PAMS file."}
              </p>
            </div>
            <button
              onClick={toggleSyncPams}
              role="switch"
              aria-checked={syncPams && !item.tracked}
              disabled={item.tracked}
              className={`relative h-7 w-12 shrink-0 rounded-full transition disabled:opacity-40 ${
                syncPams && !item.tracked ? "bg-primary" : "bg-muted"
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
              <p className="text-sm font-semibold text-foreground">Storage</p>
              <p className="text-xs text-muted-foreground">
                Where it&apos;s stored (sent to PAMS with the quantity).
              </p>
            </div>
            <select
              value={storageLoc}
              onChange={(e) => changeStorage(e.target.value)}
              className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {PAMS_STORAGES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Photo */}
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold text-foreground">Photo</p>
          <p className="text-xs text-muted-foreground">
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
                className={`block cursor-pointer rounded-lg py-2 text-center text-sm font-semibold text-primary-foreground ${
                  busy ? "bg-primary/60" : "bg-primary hover:bg-primary/80"
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
            <p className="mt-2 text-sm font-medium text-primary">
              {photoMsg}
            </p>
          )}
        </div>

        {/* Threshold */}
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold text-foreground">
            Low threshold
          </p>
          <p className="text-xs text-muted-foreground">
            Alert/reorder when In Stock drops below this.
          </p>
          <div className="mt-3 flex gap-2">
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              value={threshold}
              disabled={busy}
              onChange={(e) =>
                setThreshold(Math.max(0, Math.floor(+e.target.value || 0)))
              }
              {...selectAllProps}
              className="w-24 text-lg tabular-nums"
            />
            <Button
              onClick={handleSaveThreshold}
              disabled={busy}
              className="flex-1"
            >
              {busy ? "Working…" : "Save"}
            </Button>
          </div>
          {thresholdMsg && (
            <p className="mt-2 text-sm font-medium text-primary">
              {thresholdMsg}
            </p>
          )}
        </div>

        {/* Remove spare units */}
        {item.tracked && (
          <div className="rounded-xl border p-4">
            <p className="text-sm font-semibold text-foreground">
              Remove spare units
            </p>
            <p className="text-xs text-muted-foreground">
              Fixes an over-create. Only removes in-warehouse units.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                value={removeN}
                disabled={busy}
                onChange={(e) =>
                  setRemoveN(Math.max(1, Math.floor(+e.target.value || 1)))
                }
                {...selectAllProps}
                className="w-24 text-lg tabular-nums"
              />
              <Button
                onClick={handleRemove}
                disabled={busy}
                variant="secondary"
                className="flex-1"
              >
                {busy ? "Working…" : "Remove"}
              </Button>
            </div>
            {msg && (
              <p className="mt-2 text-sm font-medium text-primary">{msg}</p>
            )}
          </div>
        )}

        {/* Danger zone */}
        <div className="rounded-xl border border-accent/30 bg-accent/10 p-4">
          <p className="text-sm font-semibold text-foreground">Danger zone</p>
          <p className="text-xs text-foreground">
            Deletes the item and all its units. Blocked if any unit is checked out.
          </p>
          <Button
            onClick={handleDelete}
            disabled={busy}
            variant="destructive"
            className="mt-3 w-full"
          >
            {busy ? "Working…" : "Delete this item"}
          </Button>
        </div>

        {error && (
          <div className="rounded-lg bg-accent/10 px-3 py-2 text-sm font-medium text-foreground">
            {error}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}