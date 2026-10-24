# NHS OS: security advisory remediation on PR #21

On October 23, the exact review branch dependency gate identified newly published advisories affecting body-parser 2.3.0 (high), Miniflare's nested undici 7.29.1 (high), and Nodemailer 10.1.0 (moderate). Prior passing audits preceded the advisory refresh.

Pinned safe compatible changes:
- Override body-parser to 2.4.0, the patched 2.x version for GHSA-27r3-jxmh-p828.
- Override nested Miniflare undici to 7.30.1, patched for GHSA-xjj6-f33q-929c, GHSA-f72v-6w45-q472, and GHSA-4qv8-2p9j-2685.
- Raise Nodemailer to ^10.2.1, containing the addressparser fixes in 10.1.4 or later.
- Retain wrangler 4.151.0, OpenNext 1.20.9, and Next.js 16.4.3.

One temporary GitHub Actions workflow refreshes the lockfile strictly on draft review branch, installs dependencies from that lockfile, verifies the exact versions, runs npm audit (high+), and commits only package-lock.json. Remove the temporary workflow after successful regeneration. Never merge/deploy until all existing browser, security and Cloudflare checks pass and the owner visually approves the change.

References: GitHub advisories GHSA-27r3-jxmh-p828, GHSA-xjj6-f33q-929c and GHSA-8c8m-p3m8-cjg8.
