"use client";
import { useState } from "react";
import { Camera, List, X, Bell } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import Sidebar from "@/components/Sidebar";

export default function AppShell({
  // nav
  activeSection,
  onNavigate,
  itemCount,
  onSignOut,
  onHelp,
  // top action bar
  onScan,
  onAddItem,
  onPrintTags,
  printing,
  hasSelection,
  selectedCount,
  visibleCount,
  onPams,
  pamsLoading,
  pamsLatestName,
  // main content
  children,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  function navigate(id) {
    setDrawerOpen(false);
    onNavigate(id);
  }

  const printLabel = printing
    ? "Generating…"
    : hasSelection
    ? `Print Selected (${selectedCount})`
    : `Print Tags (${visibleCount})`;

  return (
    <div className="flex h-screen overflow-hidden bg-brand-light">
      {/* ── Sidebar: desktop (fixed) ────────────────────────────── */}
      <aside className="hidden md:flex md:flex-shrink-0">
        <div className="fixed inset-y-0 left-0 z-30 w-64">
          <Sidebar
            activeSection={activeSection}
            onNavigate={navigate}
            itemCount={itemCount}
            onSignOut={onSignOut}
            onHelp={onHelp}
          />
        </div>
      </aside>

      {/* ── Sidebar: mobile drawer ──────────────────────────────── */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 md:hidden">
            <Sidebar
              activeSection={activeSection}
              onNavigate={navigate}
              itemCount={itemCount}
              onSignOut={onSignOut}
              onHelp={onHelp}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </>
      )}

      {/* ── Main column ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        {/* Top action bar */}
        <header className="z-20 flex shrink-0 items-center justify-between border-b border-border bg-white px-4 py-3 shadow-sm">
          {/* Left: hamburger (mobile) + primary actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              variant="ghost"
              size="icon"
              className="md:hidden"
            >
              <List size={20} />
            </Button>
            <Button onClick={onScan}>
              <Camera size={16} className="mr-1.5" aria-hidden="true" />
              Scan Item
            </Button>
            <Button
              onClick={onAddItem}
              variant="outline"
              className="hidden sm:flex"
            >
              + New Item
            </Button>
          </div>

          {/* Right: secondary actions */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onPrintTags}
              disabled={printing}
              variant="ghost"
              className="hidden sm:flex text-brand-darkest/70"
            >
              {printLabel}
            </Button>
            <Button
              onClick={onPams}
              disabled={pamsLoading}
              variant="ghost"
              className="hidden md:flex text-brand-darkest/70"
              title={pamsLatestName ? `Latest: ${pamsLatestName}` : "PAMS export (.xls)"}
            >
              PAMS
            </Button>
            <Button variant="ghost" size="icon" className="text-brand-darkest/50">
              <Bell size={18} aria-hidden="true" />
            </Button>
          </div>
        </header>

        {/* Scrollable section content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
