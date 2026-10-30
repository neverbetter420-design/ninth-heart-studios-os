import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

// The app uses OpenNext's default dummy cache: no cache population or skew
// mapping is needed. Its CLI otherwise initializes getPlatformProxy, which
// starts an unnecessary remote AI preview before publishing the built Worker.
// Publish the same bundle/config directly; never expand deployment-token scopes.
const config = readFileSync(new URL("../open-next.config.ts", import.meta.url), "utf8");
if (!/^import \{ defineCloudflareConfig \} from "@opennextjs\/cloudflare";\s*export default defineCloudflareConfig\(\);\s*$/.test(config)) {
  throw new Error("Review deployment cache population before changing OpenNext configuration.");
}
const args = process.argv.slice(2);
if (args.some(arg => arg !== "--dry-run")) throw new Error("Unsupported deployment argument.");
const cli = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const result = spawnSync(process.execPath, [cli, "deploy", ...args], {
  cwd: new URL("..", import.meta.url), stdio: "inherit",
  env: { ...process.env, OPEN_NEXT_DEPLOY: "true" },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
