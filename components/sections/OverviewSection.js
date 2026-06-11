"use client";
import {
  Clipboard,
  CheckCircle,
  Warning,
  Truck,
  Package,
} from "@phosphor-icons/react";
import { imgUrl, FALLBACK_IMG } from "@/lib/items";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

export default function OverviewSection({ items, setManageItem }) {
  const lowStockItems = items.filter((i) => {
    const inStock = Number(i.inStock) || 0;
    const threshold = Number(i.lowThreshold) || 0;
    return threshold > 0 && inStock < threshold;
  });

  const stats = [
    { label: "Total Items",  value: items.length, Icon: Clipboard,    chipColor: "bg-brand-darkest" },
    { label: "In Stock",     value: items.reduce((s, i) => s + (Number(i.inStock) || 0), 0), Icon: CheckCircle, chipColor: "bg-brand-teal" },
    { label: "Low Stock",    value: lowStockItems.length, Icon: Warning, chipColor: "bg-brand-gold" },
    { label: "On Order",     value: items.reduce((s, i) => s + (Number(i.onOrder) || 0), 0), Icon: Truck, chipColor: "bg-brand-dark" },
  ];

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Inventory health at a glance
        </p>
      </div>

      {/* Stat cards */}
      {items.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <StatCard key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* Low stock list */}
      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">
          Low Stock
          {lowStockItems.length > 0 && (
            <span className="ml-2 rounded-full bg-accent/20 px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              {lowStockItems.length}
            </span>
          )}
        </h2>

        {lowStockItems.length === 0 ? (
          <Card className="border border-border bg-white">
            <CardContent className="flex flex-col items-center justify-center py-12 text-brand-darkest/40">
              <CheckCircle size={36} className="text-brand-teal/60" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">All items are sufficiently stocked</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lowStockItems.map((item) => {
              const inStock = Number(item.inStock) || 0;
              const threshold = Number(item.lowThreshold) || 0;
              return (
                <Card key={item.id} className="border border-border bg-white shadow-sm">
                  <CardContent className="flex items-center gap-3 p-3">
                    <img
                      src={imgUrl(item.id, item.photoVersion)}
                      alt={item.itemName || item.id}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = FALLBACK_IMG;
                      }}
                      className="h-12 w-12 shrink-0 rounded-md object-cover bg-muted"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {item.itemName || item.id}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-bold text-accent">{inStock}</span>
                        {" "}/ {threshold} units
                      </p>
                    </div>
                    <Button
                      onClick={() => setManageItem(item)}
                      variant="ghost"
                      size="sm"
                      className="shrink-0 text-muted-foreground"
                    >
                      Manage
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty state for no items at all */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-brand-darkest/40">
          <Package size={48} className="text-brand-darkest/30" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold">No items yet</p>
          <p className="mt-1 text-sm">Switch to Stock Control to add your first item.</p>
        </div>
      )}
    </div>
  );
}
