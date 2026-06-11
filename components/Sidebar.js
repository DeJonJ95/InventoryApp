"use client";
import {
  House,
  Package,
  Clipboard,
  MapPin,
  ChartBar,
  Gear,
  Question,
  SignOut,
  Cube,
  X,
} from "@phosphor-icons/react";

const NAV_ITEMS = [
  { id: "overview",  label: "Overview",      Icon: House },
  { id: "stock",     label: "Stock Control", Icon: Package },
  { id: "tracking",  label: "Tracking",      Icon: Clipboard },
  { id: "locations", label: "Locations",     Icon: MapPin },
  { id: "reports",   label: "Reports",       Icon: ChartBar },
  { id: "settings",  label: "Settings",      Icon: Gear },
];

export default function Sidebar({ activeSection, onNavigate, itemCount, onSignOut, onHelp, onClose }) {
  return (
    <div className="flex h-full w-64 flex-col bg-brand-darkest text-white">
      {/* Brand block */}
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal">
            <Cube size={20} weight="fill" className="text-white" />
          </span>
          <div>
            <p className="text-sm font-bold leading-none">Inventory</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-white/40">
              Stock Control
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="ml-2 rounded p-1 text-white/40 hover:text-white md:hidden"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-3 py-2" aria-label="Main navigation">
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const active = activeSection === id;
          return (
            <button
              key={id}
              onClick={() => onNavigate(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white/90"
              }`}
            >
              <Icon size={18} weight={active ? "fill" : "regular"} aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {id === "stock" && itemCount > 0 && (
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold tabular-nums">
                  {itemCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom: Help + Sign Out */}
      <div className="space-y-0.5 border-t border-white/10 px-3 py-3">
        <button
          onClick={onHelp}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          <Question size={18} aria-hidden="true" />
          <span>Help</span>
        </button>
        <button
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/40 transition-colors hover:bg-white/10 hover:text-white/70"
        >
          <SignOut size={18} aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
