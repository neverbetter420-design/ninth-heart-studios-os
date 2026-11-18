# NHS OS | Eight full-frame backgrounds

This pack contains **exactly eight** approved NHS artwork compositions. The original JPEGs are unchanged in `sources/`, with an optimized WebP of each in `app/`.

## Frame integrity

Every decorative image is intended to fit **fully inside** a fixed viewport using `background-size: contain`. No zoom, cropping, edge cut-off or `cover` treatment is allowed. On phones, landscape images necessarily occupy a shorter band; the surrounding space is filled with dark brand color, not a stretched or cropped copy. The entire image stays visible while the glass interface scrolls on top.

Open `preview/index.html` for a source-only illustration. For a true phone view, resize the browser window to a phone width, not just the mock toggle. No live data, Auth, Supabase, service integrations or production deployment is included.

## Integration

Use PR #80's designated draft branch and exact SHA-256 importer. Commit only the eight `app/` WebPs into `public/visuals/`, never a bundled archive into production. The artwork is a candidate collection until room-by-room owner review and viewport QA. Keep the original NHS logo and app functionality intact.
