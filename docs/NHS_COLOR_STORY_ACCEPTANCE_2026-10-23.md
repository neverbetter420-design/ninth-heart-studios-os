# NHS Nocturne + Soft Welcome: Visible Color Story

## User visual feedback
Screenshot of the extracted offline preview at \`frames/admin/client-detail.html\` showed old nearly-black floral workspace, no noticeable change in visual colors, despite approved "dark elegance meets soft welcome" concept. Root cause: PR #21's prior soft-welcome CSS mostly changed \`.nhs-theme-client .atelier-hero\`, while admin client-management page retained dark \`nocturne-management.css\` styles. The preview was showing the genuine admin page, not a stale artifact.

## This corrective pass
The Admin Client Workspace intentionally contrasts a **midnight sidebar** with a **plum-to-rose editorial client header** and a **warm ivory relationship work surface**. Contact sidebar uses champagne tint. Project rows, link text, membership inputs and progress bars are retuned for light backgrounds with readable dark ink and muted-rose accents. The original NHS logo and the protected Canva brand palette remain unchanged; ivory/champagne are functional supporting surfaces, not brand-replacement colors.

The client Atelier destinations gain a subtle warm panel for consistency. Other admin dense tables and scanner operations keep their dark theme: this is a targeted relationship and client-experience design, not an indiscriminate global inversion.

## Exact visual acceptance
Open newly generated \`nhs-nocturne-html-preview\` artifact via extracted \`index.html\`, select **Admin Nocturne → client detail**, and compare dark floral/rose hero against clearly warm ivory contact/projects content. Select **Client Atelier → home** for the matching lighter welcome. An automated Chromium test asserts precise painted backgrounds and non-overflow at narrow widths.

## Security and release
Style only. No migrations, credentials, data, role modifications, automations, permissions, logo edits, or production deployment. This stays on draft PR #21 until verified source-preview and mobile reviews and the user's approval.
