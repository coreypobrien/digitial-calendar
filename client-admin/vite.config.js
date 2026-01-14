import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/admin/" : "/",
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3000"
    }
  },
  build: {
    outDir: "dist"
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.js"
  }
}));
