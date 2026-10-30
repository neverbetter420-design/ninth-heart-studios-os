// Read-only diagnostics. Never print credentials, headers, or response values.
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!/^[a-f0-9]{32}$/.test(account ?? "") || !token) throw new Error("Deployment credentials are missing.");
const root = `/accounts/${account}/workers`;
const service = `${root}/services/ninth-heart-studios-os/environments/production`;
const checks = [
  ["bindings", `${service}/bindings`],
  ["routes", `${service}/routes?show_zonename=true`],
  ["custom domains", `${root}/domains/records?page=0&per_page=5&service=ninth-heart-studios-os&environment=production`],
  ["subdomain", `${service}/subdomain`],
  ["service metadata", service],
  ["schedules", `${root}/scripts/ninth-heart-studios-os/schedules`],
];
let failed = false;
for (const [label, path] of checks) {
  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();
    const codes = (body.errors ?? []).map(error => Number(error.code)).filter(Number.isFinite);
    console.log(`${label}: HTTP ${response.status}; success=${body.success === true}; error codes=${codes.join(",") || "none"}`);
    if (!response.ok || body.success !== true) failed = true;
  } catch {
    console.log(`${label}: request failed (network, timeout, or invalid JSON)`);
    failed = true;
  }
}
if (failed) process.exitCode = 1;
