import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    plugins: [react()],
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
