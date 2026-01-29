import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  root: __dirname,
  publicDir: path.join(__dirname, "src", "assets"),
  server: {
    host: true,
    port: 4300,
    strictPort: true
  },
  build: {
    outDir: path.join(__dirname, "..", "..", "dist", "apps", "shell"),
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(__dirname, "src", "main.ts"),
      output: {
        entryFileNames: "shell.bundle.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
        format: "es"
      }
    }
  }
});
