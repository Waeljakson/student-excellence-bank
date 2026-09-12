import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/student-excellence-bank/",
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
