import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: false,
  treeshake: true,
  platform: "node",
  target: "node18",
  outDir: "dist",
});
