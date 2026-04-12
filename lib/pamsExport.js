"use client";

import { useCallback, useEffect, useState } from "react";
import { ref, listAll, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

const EXPORTS_PREFIX = "exports";

/**
 * Find the most recent PAMS CSV in Storage and return a temporary,
 * downloadable URL for it.
 *
 * Filenames are pams_sync_YYYY-MM-DD.csv, so lexical sort == chronological
 * sort — the greatest name is the newest export.
 *
 * @returns {Promise<{ name: string, url: string } | null>}
 *          null when no export has been generated yet.
 */
export async function getLatestPamsExport() {
  const { items } = await listAll(ref(storage, EXPORTS_PREFIX));
  if (items.length === 0) return null;

  const latest = items.reduce((a, b) => (a.name > b.name ? a : b));
  const url = await getDownloadURL(latest);
  return { name: latest.name, url };
}

/**
 * React hook wrapping getLatestPamsExport for use in a button.
 *
 * Usage:
 *   const { loading, error, download } = useLatestPamsExport();
 *   <button onClick={download} disabled={loading}>Download PAMS CSV</button>
 */
export function useLatestPamsExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState(null); // { name, url } | null

  // Resolve the newest file up front so the button can show its name /
  // disable itself when nothing exists yet.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getLatestPamsExport()
      .then((res) => {
        if (!cancelled) setLatest(res);
      })
      .catch((err) => {
        console.error("Failed to look up PAMS export:", err);
        if (!cancelled) setError("Could not reach the export storage.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch a fresh signed URL at click time (download URLs can expire) and
  // trigger the browser download.
  const download = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const res = await getLatestPamsExport();
      if (!res) {
        setError("No export has been generated yet. Try after 11:59 PM.");
        return;
      }
      setLatest(res);
      // Anchor with download attr → browser saves the file instead of
      // navigating to it.
      const a = document.createElement("a");
      a.href = res.url;
      a.download = res.name;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      console.error("PAMS download failed:", err);
      setError("Download failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, latest, download };
}
