import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = fileURLToPath(new URL("../dist/", import.meta.url));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(new URL("../public/", import.meta.url), dist, { recursive: true });

await Promise.all([
  build({ entryPoints: [fileURLToPath(new URL("../src/background/service-worker.ts", import.meta.url))], outfile: fileURLToPath(new URL("../dist/background/service-worker.js", import.meta.url)), bundle: true, format: "esm", platform: "browser", target: "chrome120", sourcemap: true }),
  build({ entryPoints: [fileURLToPath(new URL("../src/content/content.ts", import.meta.url))], outfile: fileURLToPath(new URL("../dist/content/content.js", import.meta.url)), bundle: true, format: "iife", platform: "browser", target: "chrome120", sourcemap: true }),
  build({ entryPoints: [fileURLToPath(new URL("../src/content/page-bridge.ts", import.meta.url))], outfile: fileURLToPath(new URL("../dist/content/page-bridge.js", import.meta.url)), bundle: true, format: "iife", platform: "browser", target: "chrome120", sourcemap: true }),
  build({ entryPoints: [fileURLToPath(new URL("../src/popup/popup.ts", import.meta.url))], outfile: fileURLToPath(new URL("../dist/popup/popup.js", import.meta.url)), bundle: true, format: "iife", platform: "browser", target: "chrome120", sourcemap: true }),
]);

console.log(`Built extension to ${root}dist`);
