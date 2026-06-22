import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, proxy /api to the sync gateway so cookies are same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_SYNC_URL ?? "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
