/**
 * Inicialització singleton del client Firebase.
 * Les credencials es llegeixen de variables d'entorn Vite (VITE_FIREBASE_*).
 */

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, connectAuthEmulator, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  connectFirestoreEmulator,
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
    // `initializeFirestore` ens permet activar ignoreUndefinedProperties,
    // perquè els camps opcionals (name, comment, groupId…) puguin passar-se
    // com `undefined` sense que el SDK llenci excepció.
    try {
      db = initializeFirestore(app, { ignoreUndefinedProperties: true });
    } catch {
      // Si Firestore ja estava inicialitzat (p. ex. HMR de Vite), caiem a getFirestore.
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
