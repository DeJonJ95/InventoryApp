"use client";
import { FileXls, DownloadSimple, Clock } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ReportsSection({ pams, items }) {
  const totalTracked = items.filter((i) => i.tracked).length;
  const totalPams = items.filter((i) => i.syncToPams && !i.tracked).length;

  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Exports and sync history
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* PAMS export card */}
        <Card className="border border-border bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal">
                <FileXls size={18} className="text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">PAMS Export</p>
                <p className="text-xs text-muted-foreground">Nightly .xls sync</p>
              </div>
            </div>

            <div className="mt-4 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Items synced</span>
                <span className="font-semibold tabular-nums">{totalPams}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tracked units</span>
                <span className="font-semibold tabular-nums">{totalTracked}</span>
              </div>
              {pams.latest && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Latest file</span>
                  <span className="max-w-[140px] truncate text-right font-medium text-foreground">
                    {pams.latest.name}
                  </span>
                </div>
              )}
            </div>

            <Button
              onClick={pams.download}
              disabled={pams.loading || !pams.latest}
              className="mt-4 w-full gap-2"
              variant="outline"
            >
              <DownloadSimple size={16} aria-hidden="true" />
              {pams.loading ? "Loading…" : pams.latest ? "Download Latest" : "No export yet"}
            </Button>
          </CardContent>
        </Card>

        {/* Nightly sync schedule card */}
        <Card className="border border-border bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-darkest">
                <Clock size={18} className="text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Sync Schedule</p>
                <p className="text-xs text-muted-foreground">Cloud Function cron</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Runs at</span>
                <span className="font-semibold">11:59 PM daily</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Timezone</span>
                <span className="font-semibold">America/Detroit</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Format</span>
                <span className="font-semibold">.xls (biff8)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
