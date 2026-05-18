// Firebase v9+ modular SDK.
// NOTE: Firebase web config is not a secret — it identifies the project and is
// safe to ship in client code. Firestore is protected by security rules, not
// by hiding these values.
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBFinZruBY-4yA5wX2k2_YltyzTTS1ovOA",
  authDomain: "inventoryapp-2e86b.firebaseapp.com",
  projectId: "inventoryapp-2e86b",
  storageBucket: "inventoryapp-2e86b.firebasestorage.app",
  messagingSenderId: "475573656311",
  appId: "1:475573656311:web:47c47bc4d7427e6ec351f2",
};

// Avoid re-initializing on Next.js fast-refresh / repeated imports.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
