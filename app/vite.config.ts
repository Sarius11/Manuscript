import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@renderer": resolve(__dirname, "renderer"),
      "@core": resolve(__dirname, "core"),
      "@types": resolve(__dirname, "types"),
      "react-native": "react-native-web"
    }
  },
  server: {
    host: "127.0.0.1",
    port: Number(process.env.VITE_DEV_SERVER_PORT ?? 5173),
    strictPort: true
  }
});
