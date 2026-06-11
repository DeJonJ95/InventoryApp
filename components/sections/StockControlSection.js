"use client";
import {
  MagnifyingGlass,
  Package,
  Clipboard,
  CheckCircle,
  Warning,
  Truck,
  Camera,
  Spinner,
  Circle,
  CheckSquare,
  Square,
  Tag,
  DotsThree,
  Plus,
} from "@phosphor-icons/react";
import { imgUrl, FALLBACK_IMG } from "@/lib/items";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

function StatCard({ label, value, Icon, chipColor }) {
  return (
    <Card className="border border-border bg-white shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${chipColor}`}>
            <Icon size={16} aria-hidden="true" className="text-white" />
          </span>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
        </div>
        <p className="mt-3 text-3xl font-extrabold tabular-nums text-foreground">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function statusInfo(inStock, lowThreshold) {
  if (inStock === 0) return { label: "Out of Stock", cls: "bg-destructive text-destructive-foreground" };
  if (lowThreshold > 0 && inStock < lowThreshold) return { label: "Low Stock", cls: "bg-accent text-accent-foreground" };
  return { label: "In Stock", cls: "bg-brand-teal text-white" };
}

export default function StockControlSection({
  items,
  visibleItems,
  loading,
  error,
  query,
  setQuery,
  lowOnly,
  setLowOnly,
  uncountedOnly,
  setUncountedOnly,
  selectedItems,
  toggleSelection,
  selectAllVisible,
  clearSelection,
  hasSelection,
  onScan,
  scannerOpen,
  setUnitsItem,
  printItemTags,
  printing,
  setManageItem,
}) {
  const stats = [
    { label: "Total Items",  value: items.length, Icon: Clipboard,    chipColor: "bg-brand-darkest" },
    { label: "In Stock",     value: items.reduce((s, i) => s + (Number(i.inStock) || 0), 0), Icon: CheckCircle, chipColor: "bg-brand-teal" },
    { label: "Low Stock",    value: items.filter((i) => (Number(i.inStock) || 0) < (Number(i.lowThreshold) || 0)).length, Icon: Warning, chipColor: "bg-brand-gold" },
    { label: "On Order",     value: items.reduce((s, i) => s + (Number(i.onOrder) || 0), 0), Icon: Truck, chipColor: "bg-brand-dark" },
  ];

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Stock Control</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage and track all inventory items
          </p>
        </div>
        {!loading && !error && items.length > 0 && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{items.length}</span> items
          </p>
        )}
      </div>

      {/* Stat cards */}
      {!loading && !error && items.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* Search + filter row */}
      {!loading && !error && items.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[200px] flex-1">
            <MagnifyingGlass
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or ID…"
              className="pl-9"
            />
          </div>
          <Button
            onClick={() => setLowOnly((v) => !v)}
            variant={lowOnly ? "default" : "outline"}
            className={lowOnly ? "bg-accent text-accent-foreground hover:bg-accent/80" : ""}
          >
            <Warning size={16} className="mr-1.5" aria-hidden="true" />
            Low Stock
          </Button>
          <Button
            onClick={() => setUncountedOnly((v) => !v)}
            variant={uncountedOnly ? "default" : "outline"}
          >
            <Circle size={16} className="mr-1.5" aria-hidden="true" />
            Uncounted
          </Button>

          {visibleItems.length !== items.length && (
            <span className="text-sm font-medium text-muted-foreground">
              Showing {visibleItems.length} of {items.length}
            </span>
          )}

          {visibleItems.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              {hasSelection && (
                <span className="font-medium text-accent">{selectedItems.size} selected</span>
              )}
              <button
                onClick={selectAllVisible}
                className="font-medium text-muted-foreground hover:text-foreground"
              >
                Select All
              </button>
              {hasSelection && (
                <button
                  onClick={clearSelection}
                  className="font-medium text-muted-foreground hover:text-foreground"
                >
                  Clear
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
          <Spinner className="animate-spin" size={36} aria-label="Loading" role="status" />
          <p className="mt-3 text-base font-medium">Loading inventory…</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center justify-center py-24 text-brand-gold">
          <Warning size={36} aria-hidden="true" />
          <p className="mt-3 text-base font-medium">{error}</p>
        </div>
      )}

      {/* Empty collection */}
      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
          <Package size={48} className="text-brand-darkest/30" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold">No items yet</p>
          <p className="mt-1 text-sm">Tap Scan or Add New Item to get started.</p>
        </div>
      )}

      {/* No search match */}
      {!loading && !error && items.length > 0 && visibleItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
          <MagnifyingGlass size={36} className="text-brand-darkest/30" aria-hidden="true" />
          <p className="mt-3 text-base font-medium">No items match</p>
          <p className="mt-1 text-sm">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Mobile floating scan button */}
      {!scannerOpen && (
        <Button
          onClick={onScan}
          aria-label="Scan item"
          size="icon"
          className="fixed bottom-6 right-6 z-30 h-14 w-14 rounded-full shadow-lg sm:hidden"
        >
          <Camera size={24} />
        </Button>
      )}

      {/* Item grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visibleItems.map((item) => {
          const inStock = Number(item.inStock) || 0;
          const lowThreshold = Number(item.lowThreshold) || 0;
          const onOrder = Number(item.onOrder) || 0;
          const status = statusInfo(inStock, lowThreshold);
          const isSelected = selectedItems.has(item.id);

          return (
            <Card key={item.id} className="overflow-hidden border border-border bg-white shadow-sm transition-shadow hover:shadow-md">
              {/* Image area */}
              <div className="relative">
                <img
                  src={imgUrl(item.id, item.photoVersion)}
                  alt={item.itemName || item.id}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = FALLBACK_IMG;
                  }}
                  className="h-36 w-full object-cover bg-muted"
                />
                {/* Status badge */}
                <span
                  className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.cls}`}
                >
                  {status.label}
                </span>
                {/* Tracked badge */}
                {item.tracked && (
                  <span className="absolute right-2.5 top-2.5 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    Tracked
                  </span>
                )}
                {/* Select checkbox */}
                <button
                  onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                  aria-label={isSelected ? `Deselect ${item.itemName || item.id}` : `Select ${item.itemName || item.id}`}
                  className="absolute left-2.5 bottom-2.5 flex h-6 w-6 items-center justify-center rounded-md bg-white/80 shadow-sm backdrop-blur-sm hover:bg-white"
                >
                  {isSelected ? (
                    <CheckSquare size={16} weight="fill" className="text-accent" />
                  ) : (
                    <Square size={16} className="text-brand-darkest/50" />
                  )}
                </button>
              </div>

              <CardContent className="p-3 sm:p-4">
                <h2 className="truncate text-sm font-bold text-foreground">
                  {item.itemName || item.id}
                </h2>
                <p className="truncate text-xs text-muted-foreground">{item.id}</p>

                {/* Stock level row */}
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-2xl font-extrabold tabular-nums text-foreground">
                    {inStock}
                  </span>
                  <span className="text-xs text-muted-foreground">units in stock</span>
                </div>

                {/* On order + tracked out row */}
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{onOrder} on order</span>
                  {item.tracked && (
                    <span>{Number(item.usingQty) || 0} out</span>
                  )}
                  {item.syncToPams === true && item.tracked !== true && (
                    <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                      PAMS
                    </Badge>
                  )}
                </div>

                {lowThreshold > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Threshold: <span className="font-semibold">{lowThreshold}</span>
                  </p>
                )}

                {/* Footer actions */}
                <div className="mt-3 flex items-center gap-2">
                  <Button
                    onClick={() => setUnitsItem(item)}
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-1.5"
                  >
                    <Plus size={14} aria-hidden="true" />
                    Add Units
                  </Button>
                  <Button
                    onClick={() => printItemTags(item)}
                    disabled={printing}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title={item.tracked ? "Print unit tags" : "Print item tag"}
                  >
                    <Tag size={14} aria-hidden="true" />
                  </Button>
                  <Button
                    onClick={() => setManageItem(item)}
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    title="Manage item"
                  >
                    <DotsThree size={16} aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
