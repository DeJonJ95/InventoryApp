"use client";

import { useState } from "react";
import {
  useLocations,
  addLocation,
  setLocationActive,
} from "@/lib/locations";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Locations</DialogTitle>
          <DialogDescription>
            Sites units can be checked out to. Deactivate instead of deleting to
            keep history intact.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="mt-4 flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New location name"
            disabled={busy}
          />
          <Button type="submit" disabled={busy}>
            Add
          </Button>
        </form>
        {error && (
          <p className="mt-2 text-sm font-medium text-foreground">{error}</p>
        )}

        <div className="mt-4 flex-1 overflow-y-auto">
          {locations.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
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
                    ? "text-foreground"
                    : "text-muted-foreground line-through"
                }`}
              >
                {loc.name}
              </span>
              <Button
                onClick={() => setLocationActive(loc.id, !loc.active)}
                variant="outline"
                size="sm"
              >
                {loc.active ? "Deactivate" : "Reactivate"}
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}