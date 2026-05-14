"use client";

function Section({ title, children }) {
  return (
    <div className="border-t py-4 first:border-t-0 first:pt-0">
      <h3 className="text-base font-bold text-brand-darkest">{title}</h3>
      <div className="mt-1 space-y-1 text-sm text-brand-darkest/70">{children}</div>
    </div>
  );
}

export default function HelpModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-brand-darkest">Help &amp; Guide</h2>
          <button
            onClick={onClose}
            className="rounded-md bg-brand-surface px-3 py-1.5 text-sm font-semibold text-brand-darkest/80 active:bg-brand-surface"
          >
            Close
          </button>
        </div>

        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          <Section title="What this app is for">
            <p>
              A simple way to track inventory: how much of each item you have,
              get alerted when something runs low, scan QR tags with your
              phone, and (for equipment) track what's checked out and where.
            </p>
          </Section>

          <Section title="Two kinds of items">
            <p>
              <b>Consumables</b> — things you use up and reorder (paper,
              envelopes, pads). You track a single count and a low-stock
              threshold. One QR label per item.
            </p>
            <p>
              <b>Tracked equipment</b> — individual units that go out to a
              site and come back (laptops, walkie-talkies). Each unit gets its
              own QR tag and is checked in/out with history.
            </p>
            <p>
              An item is one or the other. Use <b>Add units</b> on a card to
              turn it into tracked equipment.
            </p>
          </Section>

          <Section title="Adding items & tags">
            <p>
              <b>Add New Item</b> (top bar) — enter Item ID, name, threshold,
              unit, storage. In Stock starts at 0; you count it in by scanning.
            </p>
            <p>
              <b>Print item tag</b> (on a card) — one reusable QR label for a
              consumable. <b>Add units → Print unit tags</b> — a unique QR per
              equipment unit. <b>Print Item Tags (N)</b> in the top bar prints
              tags for everything currently shown (use search/filters to make a
              small batch).
            </p>
          </Section>

          <Section title="Scanning">
            <p>
              Tap <b>Scan Item</b> and point the phone at a QR tag.
            </p>
            <p>
              <b>Consumable / item tag</b> → type the total you counted and
              Save. (Type the real total — it replaces the number.)
            </p>
            <p>
              <b>Equipment unit tag</b> → Check Out to a location, or Check In.
              The location stays selected so you can scan a batch to one site.
            </p>
          </Section>

          <Section title="Locations & Tracking">
            <p>
              <b>Locations</b> — manage the list of sites equipment can be
              checked out to (deactivate old ones; history is kept).
            </p>
            <p>
              <b>Tracking</b> — see what's currently out, grouped by location,
              and look up any unit's full in/out history by its tag ID.
            </p>
          </Section>

          <Section title="Low-stock alerts">
            <p>
              Set a <b>Low Threshold</b> (Manage on a card). When In Stock
              drops below it, the card turns red and an email alert is sent to
              the manager.
            </p>
          </Section>

          <Section title="Reordering through PAMS">
            <p>
              PAMS is still used for vendor ordering. For a consumable you
              reorder, open <b>Manage</b> and turn on{" "}
              <b>Reorder via PAMS</b> and pick its Storage.
            </p>
            <p>
              Every night the app builds a PAMS file of those items.{" "}
              <b>Download PAMS file</b> (top bar) and import it in PAMS:
              Category = <b>Consumable</b>, check{" "}
              <i>"update the selected columns"</i>, select{" "}
              <b>BasicQuantity\Storage\Section\Shelf</b>, leave{" "}
              <i>"clear stock"</i> unchecked.
            </p>
            <p>
              <b>Important:</b> the item must be in PAMS's <b>Consumable</b>{" "}
              (non-tracking) category. Equipment-category items are rejected by
              PAMS — re-categorize them in PAMS first. Use{" "}
              <b>Export Error Data</b> after an import as your PAMS cleanup
              to-do list.
            </p>
          </Section>

          <Section title="Managing & removing">
            <p>
              <b>Manage</b> (on a card) — set threshold, add a photo, change
              storage, toggle Reorder via PAMS, remove over-created spare
              units, or delete an item entirely. Deleting is blocked while
              units are checked out, and never removes the item from PAMS.
            </p>
          </Section>

          <Section title="Tips">
            <p>
              Use the search box and the <b>Low stock only</b> /{" "}
              <b>Uncounted (0) only</b> filters to work through the catalog
              quickly. On phones, the <b>☰</b> menu holds the extra actions.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
