# CreatorGear Public

A separate public discovery site for creator profiles and the gear they use. It reads published data from the existing CreatorGear Supabase project; it does not own or duplicate the database and does not modify the admin application.

## Current status

**Foundation and read-only live API compatibility verified; database security policy and deployment remain unverified.** The Vite/React application includes creator/product directories and profiles with association views. Read-only requests using the existing public key returned HTTP 200 for the queried creator, product, active gear, published filters, and `products → product_types(name)` relationship. The checks inspected response codes and row counts only, not record contents. A local browser smoke check covered the creator directory/profile route and literal wildcard search behavior. RLS configuration/policy rationale, all-row public isolation, other browser flows, and production deployment have not been verified.

## Features and routes

- `/` — discovery landing page.
- `/search?q=...` — cross-searches published creators and products, showing up to 12 matches per type.
- `/creators` — searches and lists published creators (20 per page).
- `/creators/:slug` — published creator profile and active associations to published gear.
- `/products` — searches and lists published products and their product type (20 per page).
- `/products/:slug` — published product detail and active associations to published creators.
- Unknown paths show a not-found page.

Creator and product detail pages, published creator-to-gear association views, directory pagination, cross-search, and route-specific titles/descriptions are implemented. Canonical links are supported when `VITE_SITE_URL` is set to the real public site origin. Creator and product details add client-side Schema.org `Person` and `Product` JSON-LD using fields already loaded for those pages. Production builds conditionally generate `dist/sitemap.xml` from published creator/product slugs and point `dist/robots.txt` to it when a valid site origin and public Supabase configuration are available. Sitemap data is a build-time snapshot and must be regenerated after published slugs change. Since metadata and JSON-LD are client-injected, search-engine rendering and rich-result eligibility remain unverified. Product retailer/affiliate links and complete SEO validation remain TODOs. There is no authentication UI; database visibility must be enforced by Supabase RLS.

## Stack and structure

React 19, TypeScript, Vite 8, React Router 7, Supabase JS 2, and oxlint.

```text
src/
  App.tsx          routes, directory queries and page UI
  main.tsx         browser entry and router
  style.css        responsive light visual theme
  types.ts         selected row shapes
  lib/supabase.ts  public-key Supabase client
scripts/           build-time sitemap generator
public/            static assets (initially empty)
```

## Prerequisites and local setup

Install a Node.js version compatible with the installed Vite release and npm. From this folder:

```sh
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` to the Supabase project URL and its public anon/publishable key. These are browser-visible values. Never use a service-role key. `VITE_SITE_URL` is optional; set it to the eventual public site origin to enable canonical links. Leave it blank until the domain is known. `.env.local` is ignored by Git. Without the Supabase values, directories show a setup message instead of attempting a request.

## Commands

- `npm run dev` — local Vite development server.
- `npm run lint` — Oxlint source check.
- `npm run build` — TypeScript project check, production Vite build, and conditional sitemap/robots generation.
- `npm run preview` — preview the built static site locally.

Validation: `npm run build` and `npm run lint` passed after the initial setup, profile routes, pagination/search, keyboard-accessibility, canonical-link updates, conditional sitemap generation, client-side structured-data changes, and search-pattern escaping. The Render Blueprint YAML parsed successfully and its static-site, publish path, SPA rewrite, and environment-variable entries were checked; Render itself has not validated or deployed it. A local browser smoke check loaded `/creators`, `/products`, and the published `/creators/test-02` detail page. Creator-directory searches for `%`, `_`, and `\\`, a gear-directory search for `%`, and cross-search for `%` returned no matches against the current live published data rather than broadening the result set. The browser interface did not expose document-head script contents, so JSON-LD output has not been directly inspected. The current build exercises the missing-origin sitemap skip path; a configured sitemap fetch and URL set have not been verified. On 2026-10-13 read-only live REST checks returned HTTP 200 for the selected fields, status filters, association table, and product-type relationship (one row per sampled query; contents not inspected). Production deployment and deployed-route behavior have not been tested.

## Data and public access assumptions

The admin repository documents `creators` (`id`, `name`, `slug`, `bio`, `country_name`, `follower_count`, `status`), `products` (`id`, `name`, `slug`, `description`, `image_url`, `product_type_id`, `status`), and `creator_gear` relationships. On 2026-10-13, read-only requests with the configured public key confirmed that the selected creator/product/association columns, published/active status filters, and `products → product_types(name)` relation are accepted by the live REST API. Each check returned HTTP 200 and one row; record values were not displayed or retained. This does not confirm all schema fields or security policies.

The directories filter creators/products to `status = published`; profile association queries filter `creator_gear` to `active` and separately request related records with `published` status. The live API accepted these query shapes and the product-type relation for sampled requests. Because anonymous requests returned rows, effective anonymous read access exists for the sampled endpoints; whether RLS is enabled and which policies/grants caused that access is not verified. Do not assume publication of a creator makes every association or affiliate link public.

For the pending database-side review, [supabase/audit_public_access.sql](supabase/audit_public_access.sql) contains read-only queries for RLS state, policies, schema usage, and table/column grants on the public site's tables. Run it in Supabase SQL Editor using an account allowed to inspect database metadata. It does not change policies or inspect application row contents.

Affiliate URLs are not currently queried or rendered. No click tracking is implemented.

## Rendering and deployment

The current output is a client-rendered Vite static bundle. Document titles, descriptions, canonical links, and JSON-LD are added client-side; the initial HTML does not contain route-specific metadata. A Render Static Site blueprint is prepared in `render.yaml` with the Vite build, `dist` publish directory, client-route rewrite, and variables that must be supplied in Render. No Render service or deployment exists yet. Set `VITE_SITE_URL` to the actual assigned or chosen public origin in Render before building to enable canonical links and sitemap output. Validate direct route refreshes, HTTPS, routes, metadata, and Supabase access on the deployed site before claiming launch readiness. Connect a custom domain only when supplied and configured.

## Security and privacy

Only a public Supabase key belongs in browser configuration. RLS is the real public-data boundary; client-side status filtering is an additional query constraint, not authorization. Directory and cross-search escape backslash, `%`, and `_` so those user-entered characters are literal within the surrounding contains-match pattern. Live checks for creator `%`, `_`, and backslash, gear `%`, and cross-search `%` returned no matches instead of broadening to the current published set. Other unusual search characters and values need further checks. No analytics or personal-data collection is included. Affiliate disclosure and safe retailer-link behavior are pending until affiliate links are designed into the site.

## Known limitations and prioritized TODOs

- [x] Verify selected creator, product, association fields, status filters, and product-type relation against the live REST API (read-only, sampled; 2026-10-13).
- [ ] Inspect RLS enabled state, anonymous SELECT policies/grants, and draft/unpublished isolation using authoritative database settings.
- [ ] Resolve an inconclusive sampled check: anonymous draft queries returned zero creator/product rows, which may mean no drafts exist or that policies hide them.
- [ ] Confirm related-record eligibility and draft/unpublished isolation through approved RLS policy review and representative queries.
- [ ] Establish public affiliate-link eligibility, validation, disclosure, and safe outbound behavior before rendering links.
- [x] Added 20-row paginated creator/product directories and cross-search (up to 12 results per entity type).
- [x] Added client-side route-specific document titles and descriptions.
- [x] Added canonical-link support that uses `VITE_SITE_URL` without inventing a deployment domain.
- [x] Escaped `%`, `_`, and backslash in search terms; live checks for creator `%`, `_`, backslash, gear `%`, and cross-search `%` showed no wildcard-broadened matches in the current data.
- [x] Add conditional sitemap and robots generation from published slugs during production builds; configured output and live URL set remain unverified.
- [x] Add client-side Schema.org `Person` and `Product` JSON-LD on loaded detail pages; rendered output and rich-result eligibility remain unverified.
- [ ] Set `VITE_SITE_URL` after choosing the domain and verify canonical, sitemap, and robots output; validate client-injected JSON-LD and complete SEO checks.
- [ ] Rebuild/redeploy after published creator or product slugs change so the sitemap snapshot stays current.
- [x] Added a skip-to-content link, labeled search controls, live result announcements, and visible keyboard focus styles.
- [ ] Complete accessibility and responsive visual review across real browsers/devices.
- [ ] Configure and verify Render deployment, client-side rewrite, HTTPS, domain, rollback, and live flows.
- [x] Prepare `render.yaml` for a Render static site build, publish folder, SPA rewrite, and public environment variables; account configuration and deployment remain pending.
- [ ] Decide whether analytics is wanted and assess privacy/consent requirements first.

## Completed in this setup

- [x] Created a separate public project folder beside `silver_admin`.
- [x] Added React/TypeScript/Vite app shell, cross-search, paginated creator/product directories and profiles, and not-found route.
- [x] Connected search, directories, and profiles to Supabase with published-status filters, active association filters, counts, and graceful request states.
- [x] Added route-specific client-side page titles and descriptions.
- [x] Added keyboard skip navigation and visible focus treatment.
- [x] Added configurable canonical-link generation for site routes.
- [x] Added safe placeholder environment template and ignored local environment files.
- [x] Prepared a read-only SQL audit for RLS state, policies, schema usage, and grants; it has not been run against the database.
- [x] Recorded current design, assumptions, decisions, validations, and remaining work in both root documents.
- [x] Prepared a Render static-site blueprint without configuring an account, origin, or deployment.

## Troubleshooting

- **Setup message appears:** create `.env.local` from `.env.example` and fill the public project URL/key.
- **Directory reports a query error:** inspect browser network/console details, confirm table/column/relationship names in the live schema, and review anonymous grants and RLS. Do not put a privileged key in the browser.
- **Refresh on a nested route returns 404 after hosting:** configure the host to serve `/index.html` for app routes.
- **Build fails:** run `npm install`, then `npm run build`; ensure Node supports the installed Vite version.

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow, security boundaries, decisions, risks, and architectural roadmap.




