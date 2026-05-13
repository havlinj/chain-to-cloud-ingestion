import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const serviceDir = path.resolve(rootDir, "..");
const buildDir = path.join(serviceDir, "build");
const zipPath = path.join(serviceDir, "ingestion-lambda.zip");

await rm(buildDir, { recursive: true, force: true });
await mkdir(buildDir, { recursive: true });

await cp(path.join(serviceDir, "dist", "handler.mjs"), path.join(buildDir, "handler.mjs"));
await writeFile(
  path.join(buildDir, "package.json"),
  JSON.stringify({ type: "module" }, null, 2),
);

await execFileAsync("zip", ["-r", zipPath, "."], { cwd: buildDir });

console.log(`Packaged ${zipPath}`);
