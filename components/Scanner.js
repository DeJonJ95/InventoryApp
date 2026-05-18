"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { imgUrl, FALLBACK_IMG } from "../lib/items";

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

    const itemId = decodedText.trim();
    setNotFoundId("");
    setLoadingItem(true);
    try {
      const snap = await getDoc(doc(db, "items", itemId));
      if (!snap.exists()) {
        setNotFoundId(itemId);
        return;
      }
      const data = snap.data();
      setActiveItem({ id: snap.id, ...data });
      setDraftStock(Number(data.inStock) || 0);
      setDraftOnOrder(Number(data.onOrder) || 0);
      setDraftUsingQty(Number(data.usingQty) || 0);
    } catch (err) {
      console.error("Failed to fetch scanned item:", err);
      setNotFoundId(itemId);
    } finally {
      setLoadingItem(false);
    }
  }, []);

  // Resume scanning for the next item.
  const resumeScanning = useCallback(() => {
    setActiveItem(null);
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
      {loadingItem && !activeItem && (
        <SubModal>
          <p className="text-center text-gray-700">Looking up item…</p>
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
          <h3 className="mt-3 text-center text-xl font-bold text-gray-900">
            {activeItem.itemName || activeItem.id}
          </h3>
          <p className="mt-1 text-center text-sm text-gray-500">
            Current: {Number(activeItem.inStock) || 0} · Threshold:{" "}
            {Number(activeItem.lowThreshold) || 0}
          </p>

          <div className="mt-5 flex items-center justify-center gap-6">
            <button
              onClick={() => setDraftStock((n) => Math.max(0, n - 1))}
              disabled={saving}
              className="h-16 w-16 rounded-full bg-gray-200 text-3xl font-bold text-gray-800 active:bg-gray-300 disabled:opacity-50"
              aria-label="Decrease stock"
            >
              −
            </button>
            <span className="min-w-[3ch] text-center text-4xl font-bold tabular-nums text-gray-900">
              {draftStock}
            </span>
            <button
              onClick={() => setDraftStock((n) => n + 1)}
              disabled={saving}
              className="h-16 w-16 rounded-full bg-gray-200 text-3xl font-bold text-gray-800 active:bg-gray-300 disabled:opacity-50"
              aria-label="Increase stock"
            >
              +
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-600">
                On Order
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
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-lg tabular-nums disabled:opacity-50"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-600">
                Using Qty
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
