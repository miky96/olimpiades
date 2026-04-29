/**
 * Inicialització singleton del client Firebase.
 * Les credencials es llegeixen de variables d'entorn Vite (VITE_FIREBASE_*).
 *
 * Cache persistent (offline + sync diferit):
 * - Activem `persistentLocalCache` perquè Firestore guardi documents i
 *   col·leccions en IndexedDB. Això habilita lectures offline transparents
 *   i, sobretot, una **queue d'escriptures** que es replica al servidor
 *   quan el dispositiu torna a tenir connectivitat.
 * - Usem `persistentMultipleTabManager` per evitar problemes si l'usuari
 *   obre l'app en més d'una pestanya alhora.
 * - Si l'entorn no suporta IndexedDB (per exemple, navegació privada en
 *   alguns navegadors), fem fallback silenciós a `getFirestore` sense
 *   cache: l'app segueix funcionant online.
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    app = initializeApp(firebaseConfig);
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    const app = getFirebaseApp();
    // `initializeFirestore` ens permet activar ignoreUndefinedProperties
    // i el cache persistent en IndexedDB.
    try {
      db = initializeFirestore(app, {
        ignoreUndefinedProperties: true,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch (err) {
      // Si Firestore ja estava inicialitzat (HMR de Vite) o IndexedDB no
      // està disponible, caiem a getFirestore sense cache persistent.
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn(
          "[firebase] persistentLocalCache no disponible, usant cache en memòria.",
          err
        );
      }
      db = getFirestore(app);
    }
    if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    }
  }
  return db;
}

export function getAuthInstance(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
    if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    }
  }
  return auth;
}
