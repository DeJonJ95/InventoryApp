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
import HelpModal from "../components/HelpModal";
import ManageItemModal from "../components/ManageItemModal";

export default function DashboardPage() {
  // undefined = auth state still resolving; null = signed out; object = signed in
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u ?? null));
    return () => unsub();
  }, []);

  if (user === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-brand-light">
        <div className="flex flex-col items-center gap-3 text-brand-darkest/40">
          <span className="animate-spin text-3xl">⏳</span>
          <p className="text-base font-medium">Loading…</p>
        </div>
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [manageItem, setManageItem] = useState(null);
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
  // untracked items get the single reusable item tag (the item ID).
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
    <main className="min-h-screen bg-brand-light pb-24">
      {/* ── Header ──────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-brand-darkest px-4 py-3 text-white shadow-lg sm:px-5 sm:py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-2xl">📦</span>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Inventory
            </h1>
            {!loading && !error && items.length > 0 && (
              <span className="ml-2 hidden rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold sm:inline">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Desktop: action row */}
          <div className="hidden items-center gap-2 md:flex">
            <button
              onClick={() => setScannerOpen(true)}
              className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand-teal/25 transition hover:bg-brand-teal2 hover:shadow-lg active:scale-95"
            >
              Scan Item
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-brand-darkest shadow-md shadow-brand-gold/25 transition hover:bg-amber-400 hover:shadow-lg active:scale-95"
            >
              + New Item
            </button>
            <button
              onClick={() => setLocationsOpen(true)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/20 active:scale-95"
            >
              Locations
            </button>
            <button
              onClick={() => setTrackingOpen(true)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/20 active:scale-95"
            >
              Tracking
            </button>
            <button
              onClick={() => handlePrintTags()}
              disabled={printing}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
            >
              {printing ? '…' : `Print Tags (${visibleItems.length})`}
            </button>
            <button
              onClick={pams.download}
              disabled={pams.loading}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/90 transition hover:bg-white/20 active:scale-95 disabled:opacity-50"
              title={pams.latest ? `Latest: ${pams.latest.name}` : 'PAMS export file (.xls)'}
            >
              PAMS
            </button>
            <button
              onClick={() => setHelpOpen(true)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white/70 transition hover:bg-white/20 active:scale-95"
            >
              Help
            </button>
            <button
              onClick={() => signOut(auth)}
              title={user.email || 'Sign out'}
              className="ml-2 rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-white/50 transition hover:bg-white/15 hover:text-white/80 active:scale-95"
            >
              Sign Out
            </button>
          </div>

          {/* Hamburger: shown below md breakpoint */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="More actions"
            aria-expanded={menuOpen}
            className="rounded-lg bg-white/10 px-3 py-2.5 text-lg font-bold leading-none text-white active:bg-white/20 md:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile/tablet dropdown panel */}
        {menuOpen && (
          <div className="mx-auto mt-3 grid max-w-7xl gap-2 md:hidden">
            <button
              onClick={() => { setMenuOpen(false); setAddOpen(true); }}
              className="rounded-lg bg-brand-gold px-4 py-3 text-base font-semibold text-brand-darkest shadow-md active:bg-amber-500"
            >
              + Add New Item
            </button>
            <button
              onClick={() => { setMenuOpen(false); setLocationsOpen(true); }}
              className="rounded-lg bg-white/10 px-4 py-3 text-base font-semibold text-white active:bg-white/20"
            >
              Locations
            </button>
            <button
              onClick={() => { setMenuOpen(false); setTrackingOpen(true); }}
              className="rounded-lg bg-white/10 px-4 py-3 text-base font-semibold text-white active:bg-white/20"
            >
              Tracking
            </button>
            <button
              onClick={() => { setMenuOpen(false); handlePrintTags(); }}
              disabled={printing}
              className="rounded-lg bg-white/10 px-4 py-3 text-base font-semibold text-white active:bg-white/20 disabled:opacity-50"
            >
              {printing ? 'Generating…' : `Print Item Tags (${visibleItems.length})`}
            </button>
            <button
              onClick={() => { setMenuOpen(false); pams.download(); }}
              disabled={pams.loading}
              className="rounded-lg bg-white/10 px-4 py-3 text-base font-semibold text-white active:bg-white/20 disabled:opacity-50"
            >
              {pams.loading ? '…' : 'Download PAMS file'}
            </button>
            <button
              onClick={() => { setMenuOpen(false); setHelpOpen(true); }}
              className="rounded-lg bg-white/10 px-4 py-3 text-base font-semibold text-white/70 active:bg-white/20"
            >
              Help
            </button>
            <button
              onClick={() => { setMenuOpen(false); signOut(auth); }}
              className="rounded-lg bg-white/5 px-4 py-3 text-base font-semibold text-white/50 active:bg-white/15"
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* ── Stats bar ─────────────────────────────────────────────── */}
        {!loading && !error && items.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: items.length, color: 'from-brand-darkest to-brand-dark', icon: '📋' },
              { label: 'In Stock', value: items.reduce((s, i) => s + (Number(i.inStock) || 0), 0), color: 'from-brand-teal to-brand-teal2', icon: '✅' },
              { label: 'Low Stock', value: items.filter((i) => (Number(i.inStock) || 0) < (Number(i.lowThreshold) || 0)).length, color: 'from-brand-gold to-amber-500', icon: '⚠️' },
              { label: 'On Order', value: items.reduce((s, i) => s + (Number(i.onOrder) || 0), 0), color: 'from-brand-dark to-brand-teal', icon: '🚚' },
            ].map((stat) => (
              <div
                key={stat.label}
                className={`rounded-xl bg-gradient-to-br ${stat.color} p-3 text-white shadow-md sm:p-4`}
              >
                <p className="text-xs font-semibold opacity-80 sm:text-sm">{stat.label}</p>
                <p className="mt-0.5 text-2xl font-extrabold tabular-nums sm:text-3xl">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ── Search + filters ──────────────────────────────────────── */}
        {!loading && !error && items.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-brand-darkest/40">🔍</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or ID…"
                className="w-full rounded-xl border-2 border-brand-surface bg-white py-2.5 pl-9 pr-4 text-base shadow-sm transition focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20"
              />
            </div>
            <button
              onClick={() => setLowOnly((v) => !v)}
              className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                lowOnly
                  ? 'border-brand-gold bg-brand-gold/10 text-brand-darkest shadow-sm'
                  : 'border-brand-surface bg-white text-brand-darkest/60 hover:border-brand-darkest/20'
              }`}
            >
              ⚠️ Low stock
            </button>
            <button
              onClick={() => setUncountedOnly((v) => !v)}
              className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition active:scale-95 ${
                uncountedOnly
                  ? 'border-brand-teal bg-brand-teal/10 text-brand-darkest shadow-sm'
                  : 'border-brand-surface bg-white text-brand-darkest/60 hover:border-brand-darkest/20'
              }`}
            >
              0️⃣ Uncounted
            </button>
            {visibleItems.length !== items.length && (
              <span className="text-sm font-medium text-brand-darkest/50">
                Showing {visibleItems.length} of {items.length}
              </span>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
            <span className="animate-spin text-4xl">⏳</span>
            <p className="mt-3 text-base font-medium">Loading inventory…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-gold">
            <span className="text-4xl">⚠️</span>
            <p className="mt-3 text-base font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
            <span className="text-5xl">📦</span>
            <p className="mt-4 text-lg font-semibold">No items yet</p>
            <p className="mt-1 text-sm">Tap Scan or Add New Item to get started.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
            <span className="text-4xl">🔍</span>
            <p className="mt-3 text-base font-medium">No items match</p>
            <p className="mt-1 text-sm">Try adjusting your search or filters.</p>
          </div>
        )}

        {/* ── Mobile floating scan button ────────────────────────────── */}
        {!scannerOpen && (
          <button
            onClick={() => setScannerOpen(true)}
            className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal text-white shadow-lg shadow-brand-teal/30 transition hover:bg-brand-teal2 hover:shadow-xl active:scale-90 sm:hidden"
            aria-label="Scan item"
          >
            <span className="text-2xl">📷</span>
          </button>
        )}

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleItems.map((item) => {
            const inStock = Number(item.inStock) || 0;
            const lowThreshold = Number(item.lowThreshold) || 0;
            const onOrder = Number(item.onOrder) || 0;
            const isLow = lowThreshold > 0 && inStock < lowThreshold;
            const statusColor = isLow
              ? 'from-brand-gold to-amber-500'
              : onOrder > 0
                ? 'from-brand-teal to-brand-teal2'
                : 'from-brand-teal2 to-brand-teal';

            return (
              <div
                key={item.id}
                className="group overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-brand-surface transition hover:shadow-xl hover:-translate-y-1 active:scale-[0.98]"
              >
                {/* Accent bar at top */}
                <div className={`h-1.5 bg-gradient-to-r ${statusColor}`} />

                <div className="relative">
                  <img
                    src={imgUrl(item.id, item.photoVersion)}
                    alt={item.itemName || item.id}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_IMG;
                    }}
                    className="h-40 w-full bg-brand-surface object-cover sm:h-44"
                  />
                  {isLow && (
                    <span className="absolute left-3 top-3 rounded-full bg-brand-gold px-2.5 py-0.5 text-xs font-bold text-brand-darkest shadow-md">
                      LOW
                    </span>
                  )}
                  {item.tracked && (
                    <span className="absolute right-3 top-3 rounded-full bg-brand-darkest/80 px-2.5 py-0.5 text-xs font-bold text-white backdrop-blur-sm">
                      Tracked
                    </span>
                  )}
                </div>

                <div className="p-4">
                  <h2 className="truncate text-base font-bold text-brand-darkest sm:text-lg">
                    {item.itemName || item.id}
                  </h2>
                  <p className="truncate text-xs font-medium text-brand-darkest/40">
                    {item.id}
                  </p>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-darkest/40">
                        In Stock
                      </p>
                      <p
                        className={`text-3xl font-extrabold tabular-nums ${
                          isLow ? 'text-brand-gold' : 'text-brand-darkest'
                        }`}
                      >
                        {inStock}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-darkest/40">
                        On Order
                      </p>
                      <p className="text-xl font-bold tabular-nums text-brand-teal">
                        {onOrder}
                      </p>
                    </div>
                    {item.tracked && (
                      <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-brand-darkest/40">
                          Out
                        </p>
                        <p className="text-xl font-bold tabular-nums text-brand-darkest/70">
                          {Number(item.usingQty) || 0}
                        </p>
                      </div>
                    )}
                  </div>

                  {lowThreshold > 0 && (
                    <p className="mt-2 text-xs text-brand-darkest/40">
                      Threshold: <span className="font-semibold">{lowThreshold}</span>
                    </p>
                  )}

                  {item.syncToPams === true && item.tracked !== true && (
                    <p className="mt-2 inline-block rounded-full bg-brand-teal/10 px-2.5 py-0.5 text-xs font-semibold text-brand-teal">
                      PAMS Reorder
                    </p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setUnitsItem(item)}
                      className="flex-1 rounded-lg bg-brand-surface py-2 text-sm font-semibold text-brand-darkest transition hover:bg-brand-light active:scale-95"
                    >
                      + Units
                    </button>
                    <button
                      onClick={() => printItemTags(item)}
                      disabled={printing}
                      className="flex-1 rounded-lg bg-brand-surface py-2 text-sm font-semibold text-brand-darkest transition hover:bg-brand-light active:scale-95 disabled:opacity-50"
                    >
                      {item.tracked ? 'Unit Tags' : 'Item Tag'}
                    </button>
                  </div>
                  <button
                    onClick={() => setManageItem(item)}
                    className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-brand-darkest/40 transition hover:bg-brand-surface hover:text-brand-darkest active:scale-95"
                  >
                    Manage →
                  </button>
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
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}
      {manageItem && (
        <ManageItemModal
          item={manageItem}
          onClose={() => setManageItem(null)}
        />
      )}
      {scannerOpen && <Scanner onClose={() => setScannerOpen(false)} />}
    </main>
  );
}
