# CreatorGear Public

A separate public discovery site for creator profiles and the gear they use. It reads published data from the existing CreatorGear Supabase project; it does not own or duplicate the database and does not modify the admin application.

## Current status

**Foundation implemented; database integration and deployment are not verified.** The Vite/React application, home page, creator and gear directories, name search, Supabase browser client, and loading/empty/error/unconfigured states are in place. Creator and product list queries are wired to the documented tables and `published` status. No production deployment or live database access has been checked.

## Features and routes

- `/` — discovery landing page.
- `/creators` — searches and lists published creators.
- `/products` — searches and lists published products and their product type.
- Unknown paths show a not-found page.

Creator and product detail pages, creator-to-gear association views, product retailer/affiliate links, pagination beyond the first 60 rows, and cross-search are TODOs. There is no authentication UI; database visibility must be enforced by Supabase RLS.

## Stack and structure

React 19, TypeScript, Vite 8, React Router 7, Supabase JS 2, and oxlint.

```text
src/
  App.tsx          routes, directory queries and page UI
  main.tsx         browser entry and router
  style.css        responsive light visual theme
  types.ts         selected row shapes
  lib/supabase.ts  public-key Supabase client
public/            static assets (initially empty)
```

## Prerequisites and local setup

Install a Node.js version compatible with the installed Vite release and npm. From this folder:

```sh
npm install
Copy-Item .env.example .env.local
npm run dev
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` to the Supabase project URL and its public anon/publishable key. These are browser-visible values. Never use a service-role key. `.env.local` is ignored by Git. Without both values, directories show a setup message instead of attempting a request.

## Commands

- `npm run dev` — local Vite development server.
- `npm run lint` — Oxlint source check.
- `npm run build` — TypeScript project check followed by production Vite build.
- `npm run preview` — preview the built static site locally.

Validation performed for this initial setup: `npm run build` passed (TypeScript and Vite production bundle), and `npm run lint` completed successfully. A live Supabase request, browser route check, and production deployment were not performed.

## Data and public access assumptions

The admin repository documents `creators` (`id`, `name`, `slug`, `bio`, `country_name`, `follower_count`, `status`), `products` (`id`, `name`, `slug`, `description`, `image_url`, `product_type_id`, `status`), and `product_types`. It also documents `creator_gear` relationships and a publish action. These names are documented by the admin project; the actual remote schema was not introspected during this setup.

The directories filter creators/products to `status = published`. The product query reads the related `product_types.name` relationship. Public read RLS policies, relationship metadata, and representative rows must be verified against the Supabase project. If anonymous reads are not allowed, the page will show a query error; do not weaken RLS simply to make the UI work. Do not assume a published creator makes every associated product or affiliate link public.

Affiliate URLs are not currently queried or rendered. No click tracking is implemented.

## Rendering and deployment

The current output is a client-rendered Vite static bundle; no server-side rendering, prerendering, or dynamic metadata exists. A Render Static Site is the intended host, but no Render configuration or live deployment has been made. Before deployment, configure the build command `npm run build`, publish directory `dist`, the two public environment variables, and a rewrite from application paths to `/index.html` for browser routing. Validate refreshes, HTTPS, routes, and Supabase access on the deployed site before claiming launch readiness. Connect a custom domain only when supplied and configured.

## Security and privacy

Only a public Supabase key belongs in browser configuration. RLS is the real public-data boundary; client-side status filtering is an additional query constraint, not authorization. Search input is passed as a PostgREST `ilike` filter and should be reviewed for escaping and query behavior before broad release. No analytics or personal-data collection is included. Affiliate disclosure and safe retailer-link behavior are pending until affiliate links are designed into the site.

## Known limitations and prioritized TODOs

- [ ] Verify actual Supabase schema, foreign-key relationship names, anonymous SELECT grants, and RLS policies with the project owner/database.
- [ ] Exercise directory queries against representative published and unpublished rows; confirm all related public eligibility rules.
- [ ] Add creator and product detail routes with eligible gear associations.
- [ ] Establish public affiliate-link eligibility, validation, disclosure, and safe outbound behavior before rendering links.
- [ ] Add pagination and cross-entity search after expected data volume is known.
- [ ] Add route-specific SEO, canonical metadata, sitemap, robots policy, and structured data based on verified content.
- [ ] Add accessible interaction and responsive visual review across real browsers/devices.
- [ ] Configure and verify Render deployment, client-side rewrite, HTTPS, domain, rollback, and live flows.
- [ ] Decide whether analytics is wanted and assess privacy/consent requirements first.

## Completed in this setup

- [x] Created a separate public project folder beside `silver_admin`.
- [x] Added React/TypeScript/Vite app shell and routes for home, creator directory, gear directory, and not-found.
- [x] Connected directory pages to the configured Supabase browser client with published-status filters and graceful request states.
- [x] Added safe placeholder environment template and ignored local environment files.
- [x] Recorded current design, assumptions, decisions, validations, and remaining work in both root documents.

## Troubleshooting

- **Setup message appears:** create `.env.local` from `.env.example` and fill the public project URL/key.
- **Directory reports a query error:** inspect browser network/console details, confirm table/column/relationship names in the live schema, and review anonymous grants and RLS. Do not put a privileged key in the browser.
- **Refresh on a nested route returns 404 after hosting:** configure the host to serve `/index.html` for app routes.
- **Build fails:** run `npm install`, then `npm run build`; ensure Node supports the installed Vite version.

See [ARCHITECTURE.md](ARCHITECTURE.md) for data flow, security boundaries, decisions, risks, and architectural roadmap.

