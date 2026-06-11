"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
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
import AppShell from "@/components/AppShell";
import StockControlSection from "@/components/sections/StockControlSection";
import { Spinner } from "@phosphor-icons/react";

export default function DashboardPage() {
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
  const [activeSection, setActiveSection] = useState("stock");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [unitsItem, setUnitsItem] = useState(null);
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [manageItem, setManageItem] = useState(null);
  const [printing, setPrinting] = useState(false);
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
    if (
      target.length > 60 &&
      !window.confirm(
        `This will generate ${target.length} tags (~${Math.ceil(target.length / 30)} pages). Continue?`
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

  function handleNavigate(id) {
    if (id === "tracking") { setTrackingOpen(true); return; }
    if (id === "locations") { setLocationsOpen(true); return; }
    setActiveSection(id);
  }

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

  function renderSection() {
    switch (activeSection) {
      case "stock":
        return (
          <StockControlSection
            items={items}
            visibleItems={visibleItems}
            loading={loading}
            error={error}
            query={query}
            setQuery={setQuery}
            lowOnly={lowOnly}
            setLowOnly={setLowOnly}
            uncountedOnly={uncountedOnly}
            setUncountedOnly={setUncountedOnly}
            selectedItems={selectedItems}
            toggleSelection={toggleSelection}
            selectAllVisible={selectAllVisible}
            clearSelection={clearSelection}
            hasSelection={hasSelection}
            onScan={() => setScannerOpen(true)}
            scannerOpen={scannerOpen}
            setUnitsItem={setUnitsItem}
            printItemTags={printItemTags}
            printing={printing}
            setManageItem={setManageItem}
          />
        );
      case "overview":
        return <PlaceholderSection title="Overview" subtitle="Summary view coming soon." />;
      case "reports":
        return <PlaceholderSection title="Reports" subtitle="Reports coming soon." />;
      case "settings":
        return <PlaceholderSection title="Settings" subtitle="Settings coming soon." />;
      default:
        return null;
    }
  }

  return (
    <>
      <AppShell
        activeSection={activeSection}
        onNavigate={handleNavigate}
        itemCount={items.length}
        onSignOut={() => signOut(auth)}
        onHelp={() => setHelpOpen(true)}
        onScan={() => setScannerOpen(true)}
        onAddItem={() => setAddOpen(true)}
        onPrintTags={() => handlePrintTags()}
        printing={printing}
        hasSelection={hasSelection}
        selectedCount={selectedItems.size}
        visibleCount={visibleItems.length}
        onPams={pams.download}
        pamsLoading={pams.loading}
        pamsLatestName={pams.latest?.name}
      >
        {renderSection()}
      </AppShell>

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
    </>
  );
}

function PlaceholderSection({ title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-brand-darkest/40">
      <p className="text-xl font-semibold">{title}</p>
      <p className="mt-1 text-sm">{subtitle}</p>
    </div>
  );
}
