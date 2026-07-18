import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Electron loads the production UI from file://; asset URLs must therefore
  // be relative to dist/index.html rather than rooted at /assets.
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
