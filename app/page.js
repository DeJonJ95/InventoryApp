"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../lib/firebase";
import { imgUrl, FALLBACK_IMG } from "../lib/items";
import { useLatestPamsExport } from "../lib/pamsExport";
import { generateInventoryTagsPdf } from "../lib/printTags";
import Scanner from "../components/Scanner";
import Login from "../components/Login";
import AddItemModal from "../components/AddItemModal";
import AddUnitsModal from "../components/AddUnitsModal";
import { listAssetTags } from "../lib/assets";
import LocationsModal from "../components/LocationsModal";
import TrackingModal from "../components/TrackingModal";

export default function DashboardPage() {
  // undefined = auth state still resolving; null = signed out; object = signed in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return () => unsub();
  }, []);

  if (user === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!user) return <Login />;

  return <InventoryDashboard user={user} />;
}

function InventoryDashboard({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [unitsItem, setUnitsItem] = useState(null);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [uncountedOnly, setUncountedOnly] = useState(false);
  const pams = useLatestPamsExport();

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const inStock = Number(it.inStock) || 0;
      const lowThreshold = Number(it.lowThreshold) || 0;
      if (lowOnly && !(inStock < lowThreshold)) return false;
      if (uncountedOnly && inStock !== 0) return false;
      if (
        q &&
        !it.id.toLowerCase().includes(q) &&
        !(it.itemName || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [items, query, lowOnly, uncountedOnly]);

  // Prints the given list (defaults to the filtered view) so the manager
  // can narrow with search/filters and print small batches at the rack.
  async function handlePrintTags(list) {
    const target = list || visibleItems;
    if (target.length === 0) {
      alert("Nothing to print — adjust the search or filters.");
      return;
    }
    // Guard against an accidental hundreds-of-pages print.
    if (
      target.length > 60 &&
      !window.confirm(
        `This will generate ${target.length} tags (~${Math.ceil(
          target.length / 30
        )} pages). Continue?`
      )
    ) {
      return;
    }
    setPrinting(true);
    try {
      await generateInventoryTagsPdf(
        target.map((it) => ({ id: it.id, itemName: it.itemName }))
      );
    } catch (err) {
      console.error("Tag PDF generation failed:", err);
      alert(
        err.code === "empty"
          ? "There are no items to print tags for."
          : "Could not generate the tag sheet. Please try again."
      );
    } finally {
      setPrinting(false);
    }
  }

  // Card "print" action: tracked items reprint ALL their unique unit tags;
  // untracked items get the single reusable bin tag (the item ID).
  async function printItemTags(item) {
    if (!item.tracked) {
      await handlePrintTags([item]);
      return;
    }
    setPrinting(true);
    try {
      const tags = await listAssetTags(item.id, item.itemName);
      if (tags.length === 0) {
        alert("This item has no units yet. Use Add units first.");
        return;
      }
      await handlePrintTags(tags);
    } catch (err) {
      console.error("Unit tag print failed:", err);
      alert("Could not load this item's unit tags. Please try again.");
    } finally {
      setPrinting(false);
    }
  }

  // Real-time subscription to the items collection. Only mounted while the
  // user is authenticated, so the new Firestore rules won't reject it.
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "items"),
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Firestore subscription error:", err);
        setError("Could not load inventory. Check your connection.");
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <header className="sticky top-0 z-20 border-b bg-white px-4 py-3 shadow-sm sm:px-5 sm:py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            Inventory
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Primary action — always visible */}
            <button
              onClick={() => setScannerOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-base font-semibold text-white shadow active:bg-blue-700 sm:px-5"
            >
              Scan Item
            </button>

            {/* Desktop: full action row */}
            <div className="hidden items-center gap-3 sm:flex">
              <button
                onClick={pams.download}
                disabled={pams.loading}
                title={
                  pams.error ||
                  (pams.latest
                    ? `Latest: ${pams.latest.name}`
                    : "PAMS CSV export")
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-semibold text-gray-800 shadow-sm active:bg-gray-100 disabled:opacity-50"
              >
                {pams.loading ? "…" : "Download CSV"}
              </button>
              <button
                onClick={() => setAddOpen(true)}
                className="rounded-lg bg-green-600 px-5 py-2.5 text-base font-semibold text-white shadow active:bg-green-700"
              >
                Add New Item
              </button>
              <button
                onClick={() => setLocationsOpen(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-semibold text-gray-800 shadow-sm active:bg-gray-100"
              >
                Locations
              </button>
              <button
                onClick={() => setTrackingOpen(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-semibold text-gray-800 shadow-sm active:bg-gray-100"
              >
                Tracking
              </button>
              <button
                onClick={() => handlePrintTags()}
                disabled={printing}
                title="One bin tag per item currently shown (item-level). For individual unit tags, use Add units / Print unit tags on a card."
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-semibold text-gray-800 shadow-sm active:bg-gray-100 disabled:opacity-50"
              >
                {printing
                  ? "Generating…"
                  : `Print Bin Tags (${visibleItems.length})`}
              </button>
              <button
                onClick={() => signOut(auth)}
                title={user.email || "Sign out"}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-base font-semibold text-gray-600 shadow-sm active:bg-gray-100"
              >
                Sign Out
              </button>
            </div>

            {/* Mobile: overflow menu */}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More actions"
              aria-expanded={menuOpen}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xl font-bold leading-none text-gray-700 active:bg-gray-100 sm:hidden"
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile dropdown panel */}
        {menuOpen && (
          <div className="mt-3 grid gap-2 sm:hidden">
            <button
              onClick={() => {
                setMenuOpen(false);
                setAddOpen(true);
              }}
              className="rounded-lg bg-green-600 px-4 py-3 text-base font-semibold text-white active:bg-green-700"
            >
              Add New Item
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setLocationsOpen(true);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800 active:bg-gray-100"
            >
              Locations
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                setTrackingOpen(true);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800 active:bg-gray-100"
            >
              Tracking
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                handlePrintTags();
              }}
              disabled={printing}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800 active:bg-gray-100 disabled:opacity-50"
            >
              {printing
                ? "Generating…"
                : `Print Bin Tags (${visibleItems.length})`}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                pams.download();
              }}
              disabled={pams.loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-800 active:bg-gray-100 disabled:opacity-50"
            >
              {pams.loading ? "…" : "Download CSV"}
            </button>
            <button
              onClick={() => {
                setMenuOpen(false);
                signOut(auth);
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base font-semibold text-gray-600 active:bg-gray-100"
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {!loading && !error && items.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or ID…"
              className="min-w-[220px] flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => setLowOnly((v) => !v)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                lowOnly
                  ? "border-red-600 bg-red-50 text-red-700"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              Low stock only
            </button>
            <button
              onClick={() => setUncountedOnly((v) => !v)}
              className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${
                uncountedOnly
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-gray-300 bg-white text-gray-700"
              }`}
            >
              Uncounted (0) only
            </button>
            <span className="text-sm text-gray-500">
              {visibleItems.length} of {items.length}
            </span>
          </div>
        )}

        {loading && (
          <p className="py-20 text-center text-gray-500">Loading inventory…</p>
        )}

        {error && (
          <p className="py-20 text-center text-red-600">{error}</p>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="py-20 text-center text-gray-500">
            No items in inventory yet.
          </p>
        )}

        {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
          <p className="py-20 text-center text-gray-500">
            No items match the search or filters.
          </p>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((item) => {
            const inStock = Number(item.inStock) || 0;
            const lowThreshold = Number(item.lowThreshold) || 0;
            const onOrder = Number(item.onOrder) || 0;
            const isLow = inStock < lowThreshold;

            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-xl bg-white shadow-sm transition ${
                  isLow ? "border-4 border-red-600" : "border border-gray-200"
                }`}
              >
                <img
                  src={imgUrl(item.id)}
                  alt={item.itemName || item.id}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_IMG;
                  }}
                  className="h-44 w-full bg-gray-100 object-cover"
                />
                <div className="p-4">
                  <h2 className="truncate text-lg font-bold text-gray-900">
                    {item.itemName || item.id}
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Threshold: {lowThreshold}
                  </p>
                  <p className="mt-2 text-base">
                    In stock:{" "}
                    <span
                      className={`text-2xl font-extrabold ${
                        isLow ? "text-red-600" : "text-gray-900"
                      }`}
                    >
                      {inStock}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    On Order:{" "}
                    <span className="font-semibold text-gray-700">
                      {onOrder}
                    </span>
                  </p>
                  {item.tracked && (
                    <p className="mt-1 text-sm text-gray-500">
                      Tracked ·{" "}
                      <span className="font-semibold text-gray-700">
                        {Number(item.usingQty) || 0}
                      </span>{" "}
                      out
                    </p>
                  )}
                  {isLow && (
                    <p className="mt-1 text-sm font-semibold text-red-600">
                      Low stock — reorder
                    </p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setUnitsItem(item)}
                      className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-700 active:bg-gray-100"
                    >
                      Add units
                    </button>
                    <button
                      onClick={() => printItemTags(item)}
                      disabled={printing}
                      title={
                        item.tracked
                          ? "Reprint all unique unit tags for this item"
                          : "One reusable bin tag (the item ID). Same every time by design."
                      }
                      className="flex-1 rounded-lg border border-gray-300 bg-white py-2 text-sm font-semibold text-gray-700 active:bg-gray-100 disabled:opacity-50"
                    >
                      {item.tracked ? "Print unit tags" : "Print bin tag"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {addOpen && <AddItemModal onClose={() => setAddOpen(false)} />}
      {unitsItem && (
        <AddUnitsModal item={unitsItem} onClose={() => setUnitsItem(null)} />
      )}
      {locationsOpen && (
        <LocationsModal onClose={() => setLocationsOpen(false)} />
      )}
      {trackingOpen && (
        <TrackingModal onClose={() => setTrackingOpen(false)} />
      )}
      {scannerOpen && <Scanner onClose={() => setScannerOpen(false)} />}
    </main>
  );
}
