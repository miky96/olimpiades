/**
 * Inicialització singleton del client Firebase.
 * Les credencials es llegeixen de variables d'entorn Vite (VITE_FIREBASE_*).
 */
import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, initializeFirestore, connectFirestoreEmulator, } from "firebase/firestore";
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
};
let app;
let db;
let auth;
export function getFirebaseApp() {
    if (!app) {
        app = initializeApp(firebaseConfig);
    }
    return app;
}
export function getDb() {
    if (!db) {
        const app = getFirebaseApp();
        // `initializeFirestore` ens permet activar ignoreUndefinedProperties,
        // perquè els camps opcionals (name, comment, groupId…) puguin passar-se
        // com `undefined` sense que el SDK llenci excepció.
        try {
            db = initializeFirestore(app, { ignoreUndefinedProperties: true });
        }
        catch {
            // Si Firestore ja estava inicialitzat (p. ex. HMR de Vite), caiem a getFirestore.
            db = getFirestore(app);
        }
        if (import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true") {
            connectFirestoreEmulator(db, "127.0.0.1", 8080);
        }
    }
    return db;
}
export function getAuthInstance() {
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
