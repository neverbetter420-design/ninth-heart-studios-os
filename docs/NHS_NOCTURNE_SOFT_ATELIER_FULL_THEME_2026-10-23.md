# NHS Nocturne: Soft Atelier — Full visual theme correction

The owner repeatedly reviewed Admin Nocturne home and saw the old all-dark dashboard, despite earlier "soft welcome" changes. Root cause: updates were confined to client portal hero and admin client-detail. Admin home had unchanged dark page rules. A preview can be technically functional while visually incorrect.

This revision introduces a last-loaded, scoped **experience palette** applying to the actual Admin Command Center, client welcome, admin project workspace, and shared admin section entrances. Admin home now groups the metrics, next 3 actions, project pulse, activity and lower-priority insights inside one generous **#F9F4EE warm ivory** working surface, readable **#402A39** ink, muted rose accents and champagne fills. The hero is a contained **#392538 plum-to-dusty-rose** welcome with subtle floral arch, rather than full-screen wallpaper. The original dark navigation and unmodified NHS heart/ring/skull-key logo remain.

Client Atelier features a luminous architectural welcome, softly framed project and next-action modules. Project workspace has a warm paper base and dark readable typography. Unrelated dense operational screens retain functional dark surfaces for contrast/readability, but receive understated plum editorial headers.

Functional behavior, links, CRM data, Supabase/Cloudflare configuration, email, automations, billing, file storage and permissions are **unchanged**. No merge or deployment. Review synthetic 30-screen HTML preview generated from latest draft: Admin Nocturne → home; Admin → client-detail; Admin → project; Client Atelier → home. The Chromium tests assert actual painted hero/surface colors and responsive widths, not merely stylesheet presence.
