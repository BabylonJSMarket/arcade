import { defineConfig } from "vite";
import path from "path";
import buildDataPlugin from "./src/vite-plugins/build-data";
/// <reference types="vitest" />

const __dirname = process.cwd();

export default defineConfig(({ mode }) => {
  // Common configuration for all modes
  let config = {
    build: {
      outDir: "dist", // Default output directory
      sourcemap: mode === "development", // Generate sourcemap only in development
    },
    server: {
      host: true,
      strictPort: true,
      port: 3003,
    },
    plugins: [buildDataPlugin],
    resolve: {
      alias: [
        {
          find: "~",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
    test: {
      globals: true,
      environment: "jsdom",
      include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
      exclude: ["node_modules", "dist", ".git", ".cache"],
    },
  };
  return config;
});
