"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { imgUrl, FALLBACK_IMG } from "../lib/items";
import { checkOutAsset, checkInAsset } from "../lib/assets";
import { listActiveLocations } from "../lib/locations";
import { selectAllProps } from "../lib/ui";

const READER_ID = "qr-reader-region";

/**
 * Full-screen QR scanner modal.
 * QR payload is expected to be a Firestore `items` document ID.
 *
 * @param {() => void} onClose  Close the whole scanner overlay.
 */
export default function Scanner({ onClose }) {
  const scannerRef = useRef(null);
  // Tracks whether the camera engine is live, so cleanup never double-stops.
  const runningRef = useRef(false);

  const [cameraError, setCameraError] = useState("");
  const [loadingItem, setLoadingItem] = useState(false);
  const [activeItem, setActiveItem] = useState(null); // { id, ...data } or null
  const [draftStock, setDraftStock] = useState(0);
  const [draftOnOrder, setDraftOnOrder] = useState(0);
  const [draftUsingQty, setDraftUsingQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notFoundId, setNotFoundId] = useState("");

  // Asset (individually-tracked unit) flow
  const [activeAsset, setActiveAsset] = useState(null); // {id,...} or null
  const [locations, setLocations] = useState([]);
  // Sticky across scans so a batch check-out to one site needs one pick.
  const [selectedLocation, setSelectedLocation] = useState("");
  const [assetBusy, setAssetBusy] = useState(false);
  const [assetError, setAssetError] = useState("");

  useEffect(() => {
    listActiveLocations()
      .then(setLocations)
      .catch((err) => console.error("Failed to load locations:", err));
  }, []);

  // Pause the camera and load the scanned item into the sub-modal.
  const handleDecoded = useCallback(async (decodedText) => {
    const inst = scannerRef.current;
    if (!inst) return;

    // Pause first so we never queue a second scan while fetching.
    try {
      inst.pause(true);
    } catch {
      /* pause throws only if already paused — safe to ignore */
    }

    const code = decodedText.trim();
    setNotFoundId("");
    setAssetError("");
    setLoadingItem(true);
    try {
      // An asset tag (individually-tracked unit) takes priority over an
      // item-level (bin) code.
      const aSnap = await getDoc(doc(db, "assets", code));
      if (aSnap.exists()) {
        setActiveAsset({ id: aSnap.id, ...aSnap.data() });
        return;
      }
      const snap = await getDoc(doc(db, "items", code));
      if (!snap.exists()) {
        setNotFoundId(code);
        return;
      }
      const data = snap.data();
      setActiveItem({ id: snap.id, ...data });
      setDraftStock(Number(data.inStock) || 0);
      setDraftOnOrder(Number(data.onOrder) || 0);
      setDraftUsingQty(Number(data.usingQty) || 0);
    } catch (err) {
      console.error("Failed to fetch scanned code:", err);
      setNotFoundId(code);
    } finally {
      setLoadingItem(false);
    }
  }, []);

  // Resume scanning for the next item.
  const resumeScanning = useCallback(() => {
    setActiveItem(null);
    setActiveAsset(null);
    setAssetError("");
    setNotFoundId("");
    const inst = scannerRef.current;
    if (inst && runningRef.current) {
      try {
        inst.resume();
      } catch (err) {
        console.error("Failed to resume camera:", err);
      }
    }
  }, []);

  const saveUpdate = useCallback(async () => {
    if (!activeItem) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "items", activeItem.id), {
        inStock: draftStock,
        onOrder: draftOnOrder,
        usingQty: draftUsingQty,
      });
      resumeScanning();
    } catch (err) {
      console.error("Failed to save stock update:", err);
      alert("Could not save the update. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [activeItem, draftStock, draftOnOrder, draftUsingQty, resumeScanning]);

  const doCheckOut = useCallback(async () => {
    if (!activeAsset) return;
    setAssetError("");
    setAssetBusy(true);
    try {
      await checkOutAsset(activeAsset.id, selectedLocation);
      resumeScanning(); // keeps selectedLocation sticky for the next scan
    } catch (err) {
      console.error("Check-out failed:", err);
      setAssetError(err.message || "Could not check out. Try again.");
    } finally {
      setAssetBusy(false);
    }
  }, [activeAsset, selectedLocation, resumeScanning]);

  const doCheckIn = useCallback(async () => {
    if (!activeAsset) return;
    setAssetError("");
    setAssetBusy(true);
    try {
      await checkInAsset(activeAsset.id);
      resumeScanning();
    } catch (err) {
      console.error("Check-in failed:", err);
      setAssetError(err.message || "Could not check in. Try again.");
    } finally {
      setAssetBusy(false);
    }
  }, [activeAsset, resumeScanning]);

  // Start the camera on mount; tear it down on unmount.
  useEffect(() => {
    let cancelled = false;
    const instance = new Html5Qrcode(READER_ID, /* verbose */ false);
    scannerRef.current = instance;

    instance
      .start(
        { facingMode: "environment" }, // rear camera
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleDecoded,
        () => {
          /* per-frame "no code found" — intentionally ignored */
        }
      )
      .then(() => {
        if (cancelled) {
          // Unmounted before start resolved — stop immediately.
          instance.stop().catch(() => {});
          return;
        }
        runningRef.current = true;
      })
      .catch((err) => {
        console.error("Camera start failed:", err);
        if (!cancelled) {
          setCameraError(
            "Unable to access the camera. Check browser permissions and that the page is served over HTTPS."
          );
        }
      });

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      scannerRef.current = null;
      if (!inst) return;
      const cleanup = runningRef.current
        ? inst.stop()
        : Promise.resolve();
      cleanup
        .then(() => inst.clear())
        .catch(() => {
          /* already stopped/cleared */
        })
        .finally(() => {
          runningRef.current = false;
        });
    };
  }, [handleDecoded]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-lg font-semibold">Scan Item</span>
        <button
          onClick={onClose}
          className="rounded-md bg-white/15 px-4 py-2 text-base font-medium active:bg-white/30"
        >
          Close
        </button>
      </div>

      {/* Camera viewport */}
      <div className="relative flex flex-1 items-center justify-center">
        <div id={READER_ID} className="w-full max-w-md" />

        {cameraError && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-lg bg-white p-5 text-center">
            <p className="text-red-600">{cameraError}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-md bg-gray-800 px-5 py-2 text-white"
            >
              Go Back
            </button>
          </div>
        )}

        {!cameraError && !activeItem && !notFoundId && (
          <p className="absolute bottom-8 left-0 right-0 text-center text-sm text-white/80">
            Point the camera at an item QR code
          </p>
        )}
      </div>

      {/* "Not found" sub-modal */}
      {notFoundId && (
        <SubModal>
          <p className="text-center text-lg font-semibold text-gray-900">
            No item found
          </p>
          <p className="mt-1 text-center text-sm text-gray-500 break-all">
            Code: {notFoundId}
          </p>
          <button
            onClick={resumeScanning}
            className="mt-5 w-full rounded-lg bg-gray-800 py-3 text-base font-semibold text-white active:bg-gray-700"
          >
            Scan Again
          </button>
        </SubModal>
      )}

      {/* Loading sub-modal */}
      {loadingItem && !activeItem && !activeAsset && (
        <SubModal>
          <p className="text-center text-gray-700">Looking up code…</p>
        </SubModal>
      )}

      {/* Asset check-in/out sub-modal */}
      {activeAsset && (
        <SubModal>
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-blue-600">
            Tracked unit
          </p>
          <h3 className="text-center text-xl font-bold text-gray-900">
            {activeAsset.itemName || activeAsset.itemId}
          </h3>
          <p className="mt-0.5 text-center text-sm text-gray-500">
            {activeAsset.id}
          </p>

          {activeAsset.status === "checked_out" ? (
            <>
              <div className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-sm text-gray-600">Currently checked out to</p>
                <p className="text-lg font-bold text-gray-900">
                  {activeAsset.location || "unknown"}
                </p>
              </div>
              {assetError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {assetError}
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={resumeScanning}
                  disabled={assetBusy}
                  className="flex-1 rounded-lg bg-gray-200 py-3 text-base font-semibold text-gray-800 active:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={doCheckIn}
                  disabled={assetBusy}
                  className="flex-1 rounded-lg bg-green-600 py-3 text-base font-semibold text-white active:bg-green-700 disabled:opacity-50"
                >
                  {assetBusy ? "Working…" : "Check In"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-4 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
                <p className="text-sm font-semibold text-gray-800">
                  Check out to
                </p>
                <select
                  value={selectedLocation}
                  disabled={assetBusy}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-base disabled:opacity-50"
                >
                  <option value="">Select a location…</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.name}>
                      {l.name}
                    </option>
                  ))}
                </select>
                {locations.length === 0 && (
                  <p className="mt-2 text-xs text-amber-700">
                    No locations yet — add some under Locations first.
                  </p>
                )}
                {selectedLocation && (
                  <p className="mt-2 text-xs text-gray-500">
                    Stays selected for the next scans — scan a batch to the same
                    site without re-picking.
                  </p>
                )}
              </div>
              {assetError && (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {assetError}
                </p>
              )}
              <div className="mt-5 flex gap-3">
                <button
                  onClick={resumeScanning}
                  disabled={assetBusy}
                  className="flex-1 rounded-lg bg-gray-200 py-3 text-base font-semibold text-gray-800 active:bg-gray-300 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={doCheckOut}
                  disabled={assetBusy || !selectedLocation}
                  className="flex-1 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white active:bg-blue-700 disabled:opacity-50"
                >
                  {assetBusy ? "Working…" : "Check Out"}
                </button>
              </div>
            </>
          )}
        </SubModal>
      )}

      {/* Item / stock-adjust sub-modal */}
      {activeItem && (
        <SubModal>
          <img
            src={imgUrl(activeItem.id)}
            alt={activeItem.itemName || activeItem.id}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = FALLBACK_IMG;
            }}
            className="mx-auto h-32 w-32 rounded-lg object-cover"
          />
          <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-blue-600">
            Updating
          </p>
          <h3 className="text-center text-xl font-bold text-gray-900">
            {activeItem.itemName || activeItem.id}
          </h3>
          <p className="mt-0.5 text-center text-sm text-gray-500">
            ID {activeItem.id} · was {Number(activeItem.inStock) || 0} in stock ·
            threshold {Number(activeItem.lowThreshold) || 0}
          </p>

          {/* In Stock — primary count, typeable */}
          <div className="mt-5 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-gray-800">
              In Stock — total now in this bin
            </p>
            <p className="text-xs text-gray-500">
              Count everything in the container/bundle and type the total.
            </p>
            <div className="mt-3 flex items-center justify-center gap-4">
              <button
                onClick={() => setDraftStock((n) => Math.max(0, n - 1))}
                disabled={saving}
                className="h-14 w-14 shrink-0 rounded-full bg-white text-3xl font-bold text-gray-800 shadow active:bg-gray-100 disabled:opacity-50"
                aria-label="Decrease by one"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draftStock}
                disabled={saving}
                onChange={(e) =>
                  setDraftStock(Math.max(0, Math.floor(+e.target.value || 0)))
                }
                {...selectAllProps}
                className="w-28 rounded-lg border border-gray-300 bg-white py-2 text-center text-4xl font-bold tabular-nums text-gray-900 disabled:opacity-50"
              />
              <button
                onClick={() => setDraftStock((n) => n + 1)}
                disabled={saving}
                className="h-14 w-14 shrink-0 rounded-full bg-white text-3xl font-bold text-gray-800 shadow active:bg-gray-100 disabled:opacity-50"
                aria-label="Increase by one"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                On Order
              </span>
              <span className="block text-xs text-gray-400">
                Ordered, not yet in
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draftOnOrder}
                disabled={saving}
                onChange={(e) =>
                  setDraftOnOrder(Math.max(0, Math.floor(+e.target.value || 0)))
                }
                {...selectAllProps}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-lg tabular-nums disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">In Use</span>
              <span className="block text-xs text-gray-400">
                Checked out / in use
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draftUsingQty}
                disabled={saving}
                onChange={(e) =>
                  setDraftUsingQty(Math.max(0, Math.floor(+e.target.value || 0)))
                }
                {...selectAllProps}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-lg tabular-nums disabled:opacity-50"
              />
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={resumeScanning}
              disabled={saving}
              className="flex-1 rounded-lg bg-gray-200 py-3 text-base font-semibold text-gray-800 active:bg-gray-300 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={saveUpdate}
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-600 py-3 text-base font-semibold text-white active:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save Update"}
            </button>
          </div>
        </SubModal>
      )}
    </div>
  );
}

function SubModal({ children }) {
  return (
    <div className="fixed inset-0 z-10 flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl">
        {children}
      </div>
    </div>
  );
}
