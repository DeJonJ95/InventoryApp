"use client";
import { User, Question, SignOut, Info } from "@phosphor-icons/react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function SettingsSection({ userEmail, onHelp, onSignOut }) {
  return (
    <div className="px-4 py-6 sm:px-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Account and app information
        </p>
      </div>

      <div className="max-w-lg space-y-4">
        {/* Account card */}
        <Card className="border border-border bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-darkest">
                <User size={18} className="text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Account</p>
                <p className="text-xs text-muted-foreground">{userEmail || "Signed in"}</p>
              </div>
            </div>
            <Button
              onClick={onSignOut}
              variant="outline"
              className="mt-4 w-full gap-2 text-destructive hover:bg-destructive/5 hover:text-destructive"
            >
              <SignOut size={16} aria-hidden="true" />
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Help card */}
        <Card className="border border-border bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal">
                <Question size={18} className="text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Help</p>
                <p className="text-xs text-muted-foreground">Usage guide and tips</p>
              </div>
            </div>
            <Button
              onClick={onHelp}
              variant="outline"
              className="mt-4 w-full"
            >
              Open Help
            </Button>
          </CardContent>
        </Card>

        {/* About card */}
        <Card className="border border-border bg-white shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-gold">
                <Info size={18} className="text-white" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">About</p>
                <p className="text-xs text-muted-foreground">InventoryApp — Stock Control</p>
              </div>
            </div>
            <div className="mt-4 space-y-1 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Stack</span>
                <span className="font-medium">Next.js 14 + Firebase</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Auth</span>
                <span className="font-medium">Firebase email/password</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sync</span>
                <span className="font-medium">PAMS nightly cron</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
