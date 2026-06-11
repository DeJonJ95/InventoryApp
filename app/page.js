"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { imgUrl, FALLBACK_IMG } from "@/lib/items";
import { useLatestPamsExport } from "@/lib/pamsExport";
import { generateInventoryTagsPdf } from "@/lib/printTags";
import { listAssetTags } from "@/lib/assets";
import Scanner from "@/components/Scanner";
import Login from "@/components/Login";
import AddItemModal from "@/components/AddItemModal";
import AddUnitsModal from "@/components/AddUnitsModal";
import LocationsModal from "@/components/LocationsModal";
import TrackingModal from "@/components/TrackingModal";
import HelpModal from "@/components/HelpModal";
import ManageItemModal from "@/components/ManageItemModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  MagnifyingGlass,
  Package,
  Clipboard,
  CheckCircle,
  Warning,
  Truck,
  Camera,
  List,
  X,
  Spinner,
  Circle,
  CheckSquare,
  Square,
} from "@phosphor-icons/react";

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
          <Spinner className="animate-spin" size={32} aria-label="Loading" role="status" />
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
  const [selectedItems, setSelectedItems] = useState(new Set());
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

  const hasSelection = selectedItems.size > 0;

  function toggleSelection(id) {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedItems(new Set());
  }

  function selectAllVisible() {
    setSelectedItems(new Set(visibleItems.map((it) => it.id)));
  }

  // Prints the given list (defaults to selected items or the filtered view)
  // so the manager can pick a few items at the rack and tag them.
  async function handlePrintTags(list) {
    let target = list;
    if (!target) {
      target = hasSelection
        ? items.filter((it) => selectedItems.has(it.id))
        : visibleItems;
    }
    if (target.length === 0) {
      alert("Nothing to print — adjust the search, filters, or selection.");
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
      clearSelection();
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
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
              Inventory
            </h1>
            <div className="h-6 w-0.5 bg-white/20" aria-hidden="true" />
            <span className="hidden text-sm font-medium text-white/60 sm:inline">
              Stock Control
            </span>
            {!loading && !error && items.length > 0 && (
              <span className="ml-2 hidden rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold sm:inline">
                {items.length} item{items.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Desktop: action row */}
          <div className="hidden items-center gap-2 md:flex">
            <Button onClick={() => setScannerOpen(true)}>
              Scan Item
            </Button>
            <Button
              onClick={() => setAddOpen(true)}
              className="bg-accent text-accent-foreground hover:bg-accent/80"
            >
              + New Item
            </Button>
            <Button
              onClick={() => setLocationsOpen(true)}
              variant="ghost"
              className="bg-white/10 text-white/90 hover:bg-white/20"
            >
              Locations
            </Button>
            <Button
              onClick={() => setTrackingOpen(true)}
              variant="ghost"
              className="bg-white/10 text-white/90 hover:bg-white/20"
            >
              Tracking
            </Button>
            <Button
              onClick={() => handlePrintTags()}
              disabled={printing}
              variant="ghost"
              className="bg-white/10 text-white/90 hover:bg-white/20"
            >
              {printing ? '…' : hasSelection ? `Print Selected (${selectedItems.size})` : `Print Tags (${visibleItems.length})`}
            </Button>
            <Button
              onClick={pams.download}
              disabled={pams.loading}
              variant="ghost"
              className="bg-white/10 text-white/90 hover:bg-white/20"
              title={pams.latest ? `Latest: ${pams.latest.name}` : 'PAMS export file (.xls)'}
            >
              PAMS
            </Button>
            <Button
              onClick={() => setHelpOpen(true)}
              variant="ghost"
              className="bg-white/10 text-white/70 hover:bg-white/20"
            >
              Help
            </Button>
            <Button
              onClick={() => signOut(auth)}
              title={user.email || 'Sign out'}
              variant="ghost"
              className="ml-2 bg-white/5 text-white/50 hover:bg-white/15 hover:text-white/80"
            >
              Sign Out
            </Button>
          </div>

          {/* Hamburger: shown below md breakpoint */}
          <Button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "More actions"}
            aria-expanded={menuOpen}
            variant="ghost"
            className="bg-white/10 text-white hover:bg-white/20 md:hidden"
          >
            {menuOpen ? <X size={20} /> : <List size={20} />}
          </Button>
        </div>

        {/* Mobile/tablet dropdown panel */}
        {menuOpen && (
          <div className="mx-auto mt-3 grid max-w-7xl gap-2 md:hidden">
            <Button
              onClick={() => { setMenuOpen(false); setAddOpen(true); }}
              className="bg-accent text-accent-foreground hover:bg-accent/80"
            >
              + Add New Item
            </Button>
            <Button
              onClick={() => { setMenuOpen(false); setLocationsOpen(true); }}
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              Locations
            </Button>
            <Button
              onClick={() => { setMenuOpen(false); setTrackingOpen(true); }}
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              Tracking
            </Button>
            <Button
              onClick={() => { setMenuOpen(false); handlePrintTags(); }}
              disabled={printing}
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              {printing ? 'Generating…' : hasSelection ? `Print Selected (${selectedItems.size})` : `Print Tags (${visibleItems.length})`}
            </Button>
            <Button
              onClick={() => { setMenuOpen(false); pams.download(); }}
              disabled={pams.loading}
              variant="ghost"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              {pams.loading ? '…' : 'Download PAMS file'}
            </Button>
            <Button
              onClick={() => { setMenuOpen(false); setHelpOpen(true); }}
              variant="ghost"
              className="bg-white/10 text-white/70 hover:bg-white/20"
            >
              Help
            </Button>
            <Button
              onClick={() => { setMenuOpen(false); signOut(auth); }}
              variant="ghost"
              className="bg-white/5 text-white/50 hover:bg-white/15"
            >
              Sign Out
            </Button>
          </div>
        )}
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* ── Stats bar ─────────────────────────────────────────────── */}
        {!loading && !error && items.length > 0 && (
          <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {[
              { label: 'Total', value: items.length, bg: 'bg-brand-darkest', icon: Clipboard },
              { label: 'In Stock', value: items.reduce((s, i) => s + (Number(i.inStock) || 0), 0), bg: 'bg-brand-teal', icon: CheckCircle, primary: true },
              { label: 'Low Stock', value: items.filter((i) => (Number(i.inStock) || 0) < (Number(i.lowThreshold) || 0)).length, bg: 'bg-brand-gold', icon: Warning },
              { label: 'On Order', value: items.reduce((s, i) => s + (Number(i.onOrder) || 0), 0), bg: 'bg-brand-dark', icon: Truck },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.label}
                  className={`${stat.bg} text-white! shadow-sm border-0 ${stat.primary ? 'sm:col-span-1' : ''}`}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                        <Icon size={16} className="text-white/90" aria-hidden="true" />
                      </span>
                      <p className="text-xs font-medium text-white/70 sm:text-sm">{stat.label}</p>
                    </div>
                    <p className={`mt-2 tabular-nums font-extrabold tracking-tight ${stat.primary ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>
                      {stat.value}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ── Search + filters ──────────────────────────────────────── */}
        {!loading && !error && items.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] flex-1">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or ID…"
                className="pl-9"
              />
            </div>
            <Button
              onClick={() => setLowOnly((v) => !v)}
              variant={lowOnly ? 'default' : 'outline'}
              className={lowOnly ? 'bg-accent text-accent-foreground hover:bg-accent/80' : ''}
            >
              <Warning size={16} className="mr-1.5" aria-hidden="true" />
              Low stock
            </Button>
            <Button
              onClick={() => setUncountedOnly((v) => !v)}
              variant={uncountedOnly ? 'default' : 'outline'}
            >
              <Circle size={16} className="mr-1.5" aria-hidden="true" />
              Uncounted
            </Button>
            {visibleItems.length !== items.length && (
              <span className="text-sm font-medium text-brand-darkest/50">
                Showing {visibleItems.length} of {items.length}
              </span>
            )}
            {/* ── Select-all / clear for batch print ────────────── */}
            {visibleItems.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                {hasSelection && (
                  <span className="font-medium text-accent">
                    {selectedItems.size} selected
                  </span>
                )}
                <button
                  onClick={selectAllVisible}
                  className="font-medium text-brand-darkest/50 hover:text-brand-darkest/80"
                >
                  Select All
                </button>
                {hasSelection && (
                  <button
                    onClick={clearSelection}
                    className="font-medium text-brand-darkest/50 hover:text-brand-darkest/80"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
            <Spinner className="animate-spin" size={36} aria-label="Loading" role="status" />
            <p className="mt-3 text-base font-medium">Loading inventory…</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-gold">
            <Warning size={36} className="text-brand-gold" aria-hidden="true" />
            <p className="mt-3 text-base font-medium">{error}</p>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
            <Package size={48} className="text-brand-darkest/30" aria-hidden="true" />
            <p className="mt-4 text-lg font-semibold">No items yet</p>
            <p className="mt-1 text-sm">Tap Scan or Add New Item to get started.</p>
          </div>
        )}

        {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
            <MagnifyingGlass size={36} className="text-brand-darkest/30" aria-hidden="true" />
            <p className="mt-3 text-base font-medium">No items match</p>
            <p className="mt-1 text-sm">Try adjusting your search or filters.</p>
          </div>
        )}

        {/* ── Mobile floating scan button ────────────────────────────── */}
        {!scannerOpen && (
          <Button
            onClick={() => setScannerOpen(true)}
            aria-label="Scan item"
            size="icon"
            className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden"
          >
            <Camera size={24} />
          </Button>
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
              <Card
                key={item.id}
                className="group overflow-hidden hover:shadow-lg hover:-translate-y-0.5"
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
                    className="h-40 w-full bg-muted object-cover sm:h-44"
                  />
                  {isLow && (
                    <Badge className="absolute left-3 top-3 bg-accent text-accent-foreground shadow-sm">
                      LOW
                    </Badge>
                  )}
                  {item.tracked && (
                    <Badge variant="secondary" className="absolute right-3 top-3 backdrop-blur-sm">
                      Tracked
                    </Badge>
                  )}
                  {/* ── Multi-select checkbox ───────────────── */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                    aria-label={selectedItems.has(item.id) ? `Deselect ${item.itemName || item.id}` : `Select ${item.itemName || item.id}`}
                    className="absolute left-2.5 top-2.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-white/80 shadow-sm backdrop-blur-sm hover:bg-white"
                  >
                    {selectedItems.has(item.id) ? (
                      <CheckSquare size={16} weight="fill" className="text-accent" />
                    ) : (
                      <Square size={16} className="text-brand-darkest/50" />
                    )}
                  </button>
                </div>

                <CardContent className="p-3 sm:p-4">
                  <h2 className="truncate text-base font-bold text-foreground sm:text-lg">
                    {item.itemName || item.id}
                  </h2>
                  <p className="truncate text-xs font-medium text-muted-foreground">
                    {item.id}
                  </p>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        In Stock
                      </p>
                      <p
                        className={`text-3xl font-extrabold tabular-nums ${
                          isLow ? 'text-accent' : 'text-foreground'
                        }`}
                      >
                        {inStock}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        On Order
                      </p>
                      <p className="text-xl font-bold tabular-nums text-primary">
                        {onOrder}
                      </p>
                    </div>
                    {item.tracked && (
                      <div className="text-right">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Out
                        </p>
                        <p className="text-xl font-bold tabular-nums text-muted-foreground">
                          {Number(item.usingQty) || 0}
                        </p>
                      </div>
                    )}
                  </div>

                  {lowThreshold > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Threshold: <span className="font-semibold">{lowThreshold}</span>
                    </p>
                  )}

                  {item.syncToPams === true && item.tracked !== true && (
                    <Badge variant="outline" className="mt-2 bg-primary/10 text-primary border-primary/20">
                      PAMS Reorder
                    </Badge>
                  )}

                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() => setUnitsItem(item)}
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      + Units
                    </Button>
                    <Button
                      onClick={() => printItemTags(item)}
                      disabled={printing}
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      {item.tracked ? 'Unit Tags' : 'Item Tag'}
                    </Button>
                  </div>
                  <Button
                    onClick={() => setManageItem(item)}
                    variant="ghost"
                    size="sm"
                    className="mt-2 w-full text-muted-foreground hover:text-foreground"
                  >
                    Manage &rarr;
                  </Button>
                </CardContent>
              </Card>
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
