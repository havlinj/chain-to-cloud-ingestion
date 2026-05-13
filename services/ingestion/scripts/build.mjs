import * as esbuild from "esbuild";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const serviceDir = path.resolve(rootDir, "..");
const outFile = path.join(serviceDir, "dist", "handler.mjs");

await mkdir(path.dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [path.join(serviceDir, "src", "handler.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: outFile,
  external: [],
  minify: true,
  sourcemap: true,
  logLevel: "info",
});

console.log(`Built ${outFile}`);
