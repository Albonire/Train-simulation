import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 5173 },
  build: { chunkSizeWarningLimit: 1200 },
  test: { include: ["tests/**/*.test.js"], testTimeout: 15000 },
});
