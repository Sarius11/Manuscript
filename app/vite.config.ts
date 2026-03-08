import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "renderer"),
      "@core": resolve(__dirname, "core"),
      "@types": resolve(__dirname, "types")
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
