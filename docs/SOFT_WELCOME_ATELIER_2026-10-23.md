# NHS OS — Soft Welcome Atelier (review branch, October 23 2026)

## Approved direction
Dark, elegant administrative environment meets a warm ivory, champagne and dusty-rose client welcome. The original protected NHS brand logo is unchanged. Canvas backgrounds, atmospheric textures and animation are decorative and must not obscure interactive content.

## Review scope
1. Client welcome: real client first name and live project/approval CTA, warm ivory focal hero, reduced-motion entrance.
2. Project journey: seven canonical statuses (Discovery, Content, Design, Build, Review, Launch, Care Plan) and accessible expanders with phase guidance. **Position is not proof a milestone is completed.**
3. Design gallery: enlarge already-authorized project images using a native dialog and optionally compare two current project files. Signed URLs and RLS-scoped file queries are unchanged. The gallery does not invent preview assets or make decisions on behalf of the client.
4. Muse: prominent but unobtrusive admin-only link to the existing /muse workspace. No new AI integration or automated suggestions are implied.
5. Notifications: existing confirmed action-success events and optional error events, accessible live regions and manual dismiss.
6. Mobile: four role-aware quick destinations, preserving the full drawer and existing sign-out controls. Safe-area support, keyboard focus states and reduced motion.

## Explicit exclusions
No changes to Supabase schema, RLS, user roles, files, signed-URL creation, migrations, scanner providers, automations, payments, client approvals or deployed Cloudflare Workers. No data is seeded and no email is sent.

## Release gate
Draft PR only until the owner reviews desktop and mobile visual previews and the exact-head CI passes. Verify client role isolation, gallery from real permitted files, nested project routing, seven-stage disclosure, drawer/quick navigation, dynamic personalized CTA, dialog keyboard dismissal, and focus outlines. Keep the unrelated draft Lead Finder 2.0 release blocked and independent.
