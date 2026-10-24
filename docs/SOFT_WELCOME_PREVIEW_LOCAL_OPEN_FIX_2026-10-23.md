# Local preview ZIP repair

The source-generated review artifact used root-relative URLs (`/frames/...` and `/visual.css`), which fail when `index.html` is opened with `file://` instead of hosted at a web server root. Chromium's ZIP virtual directory (`*.zip.cf3`) also cannot reliably resolve the contents of the ZIP as a website.

Updated the generator to write portable relative iframe and CSS paths, to avoid History API updates for local-file previews, to display an explicit extraction warning, and to ship `OPEN_PREVIEW_FIRST.txt` with extraction instructions. The verifier now asserts relative links and the warning, alongside its existing strict checks on the 30 synthetic screens and absence of live connections.

After downloading the artifact from PR #21's successful preview run, extract the ZIP completely, keep `index.html`, `visual.css`, and `frames` together, and open the extracted `index.html` in Chrome or Edge. This is a static visual review, not live NHS OS, and forms, messages, sign-ins, file access and payments remain disabled.

No server deployment, data, auth, logo or client resources are changed.
