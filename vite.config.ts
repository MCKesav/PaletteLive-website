import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    // Enable code splitting for better caching & faster loads (SEO: Core Web Vitals)
    rollupOptions: {
      output: {
        manualChunks: undefined, // let Vite auto-split
      },
    },
    // Generate source maps for debugging, but don't ship them
    sourcemap: false,
    // Minify for smallest possible bundle
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});
