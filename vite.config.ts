import fs from "fs";
import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import pkg from "./package.json" with { type: "json" };

const httpsConfig = fs.existsSync(path.resolve(__dirname, ".certs/cert.pem"))
  ? {
      key: fs.readFileSync(path.resolve(__dirname, ".certs/key.pem")),
      cert: fs.readFileSync(path.resolve(__dirname, ".certs/cert.pem")),
    }
  : undefined;

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      events: "events",
    },
  },
  optimizeDeps: {
    include: [
      "pouchdb",
      "pouchdb-find",
      "pouchdb-adapter-indexeddb",
      "events",
    ],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-css",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-files",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      manifest: false, // We provide our own manifest.json in public/
    }),
  ],
  server: {
    https: httpsConfig,
    host: true,
    proxy: {
      "/couchdb": {
        target: "http://localhost:5984",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/couchdb/, ""),
      },
    },
  },
  preview: {
    https: httpsConfig,
    host: true,
    proxy: {
      "/couchdb": {
        target: "http://localhost:5984",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/couchdb/, ""),
      },
    },
  },
});
