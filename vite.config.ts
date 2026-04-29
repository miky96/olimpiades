import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

/**
 * Configuració Vite + PWA.
 *
 * Estratègia:
 * - `registerType: 'autoUpdate'` → el service worker s'actualitza sol en
 *   segon pla; l'usuari veu la versió nova al següent reload.
 * - `injectRegister: 'auto'` → vite-plugin-pwa injecta el codi de registre
 *   del SW directament al bundle. No hem de tocar main.tsx.
 *
 * Important: NO afegim cap regla de runtimeCaching per a peticions a
 * Firebase (firestore.googleapis.com, identitytoolkit, securetoken,
 * firebaseinstallations…). El SDK de Firestore ja gestiona el seu propi
 * cache offline mitjançant IndexedDB i les escriptures diferides; si
 * Workbox interceptés aquestes peticions trencaria streams i la queue
 * d'escriptures.
 *
 * El SW només cachea l'app shell (HTML/JS/CSS/icones/fonts) generats al
 * build. La resta passa per la xarxa amb fallback al cache de Firestore.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.ico",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
      ],
      manifest: {
        name: "Olimpiades",
        short_name: "Olimpiades",
        description:
          "Gestió d'olimpíades: temporades, esdeveniments, assistència i classificació.",
        lang: "ca",
        dir: "ltr",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        theme_color: "#0ea5e9",
        background_color: "#020617",
        categories: ["sports", "productivity"],
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precachejem totes les sortides de build excepte mapes font.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}"],
        // SPA: qualsevol navegació desconeguda → index.html (offline-first).
        navigateFallback: "/index.html",
        // Excloem rutes que mai han de servir HTML cachejat.
        navigateFallbackDenylist: [
          /^\/__\//, // hooks de Firebase Auth (popup/redirect)
          /^\/api\//,
        ],
        // No incloem cap runtimeCaching per a Firebase: el seu propi
        // sistema de persistència és el responsable.
        runtimeCaching: [
          // Cachegem fonts de Google amb estratègia stale-while-revalidate
          // perquè la primera visita offline tingui tipografia decent.
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-stylesheets",
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-webfonts",
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 any
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // En dev, deixem el SW actiu per poder provar l'experiència
        // offline amb `npm run dev` quan calgui (per defecte vite-plugin-pwa
        // el desactiva en dev).
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Donem prioritat a les fonts .ts/.tsx sobre els .js/.jsx stale que
    // puguin quedar al repo (resultat de `tsc -b` antic). Així els canvis al
    // codi font TypeScript es reflecteixen sempre sense dependre del .js
    // compilat.
    extensions: [".mjs", ".mts", ".ts", ".tsx", ".js", ".jsx", ".json"],
  },
  server: {
    port: 5173,
  },
});
