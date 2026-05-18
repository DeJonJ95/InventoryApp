"use client";

import { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

export async function addLocation(name) {
  const clean = name.trim();
  if (!clean) throw new Error("Enter a location name.");
  await addDoc(collection(db, "locations"), {
    name: clean,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function setLocationActive(id, active) {
  await updateDoc(doc(db, "locations", id), { active });
}

/** One-shot fetch of active locations (for the scanner picker). */
export async function listActiveLocations() {
  const snap = await getDocs(
    query(collection(db, "locations"), where("active", "==", true))
  );
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Live list of all locations (for the admin modal). */
export function useLocations() {
  const [locations, setLocations] = useState([]);
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "locations"), orderBy("name")),
      (snap) =>
        setLocations(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => console.error("Locations subscription error:", err)
    );
    return () => unsub();
  }, []);
  return locations;
}
