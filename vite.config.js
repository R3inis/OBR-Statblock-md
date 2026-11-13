import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  server: {
    cors: { origin: "https://www.owlbear.rodeo" },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        tokenUI: resolve(import.meta.dirname, "token-ui.html"),
        statView: resolve(import.meta.dirname, "stat-view.html")
      }
    }
  }
});