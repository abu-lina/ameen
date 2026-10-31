# dua-app

React + Next.js + Payload + Tailwind CSS self-hosted project.

## Payload Data Integrity

For user-facing mutations, validate and allowlist every submitted field on the
server and return structured errors the UI can display. Grant anonymous create
only through narrow collection access, and protect server-owned workflow fields
with field-level `create` and `update` access. Enforce relationship eligibility
and other durable invariants at the collection boundary, not only in a Server
Action.

Preserve the document ID type generated in `payload-types.ts`; do not assume IDs
are numeric. User-facing Local API calls must set `overrideAccess: false` and
pass the authenticated `user` when one exists.

Model content images as upload relationships to the existing Media collection.

## Project Structure

This project uses Next.js route groups to separate the frontend app from the
Payload admin/API routes:

- `src/app/(frontend)/` - Application pages
- `src/app/(payload)/` - Payload CMS admin panel and API routes (do not modify)
- `src/collections/` - Payload data collection definitions
- `src/globals/` - Payload CMS globals, if needed
- `src/payload.config.ts` - Payload configuration
- `src/payload-types.ts` - Auto-generated TypeScript types

## Key Files

- `src/app/(frontend)/layout.tsx` - Root layout component
- `src/app/(frontend)/page.tsx` - Home page component
- `src/app/(frontend)/not-found.tsx` - Custom not-found page for missing routes/records
- `src/app/(frontend)/styles.css` - Global styles and Tailwind CSS import
- `src/lib/payload.ts` - Shared Payload utilities (findBySlug, findByField)
- `src/payload.config.ts` - Payload config (collections, plugins, db, etc.)
- `next.config.ts` - Next.js configuration (includes Payload wrapper)
- `package.json` - Dependencies and scripts
- `.mise.toml` - Toolchain versions (Node.js, pnpm)

## Styling

This project uses **Tailwind CSS v4** for frontend styling. Tailwind and its
PostCSS plugin are already installed and configured, and Tailwind is loaded by
the `@import "tailwindcss"` directive in `src/app/(frontend)/styles.css`.

Use Tailwind utility classes directly in JSX for application UI.

## Database

Payload uses PostgreSQL via `@payloadcms/db-postgres`. The connection string is
read from `DATABASE_URL`. The Payload secret is read from `PAYLOAD_SECRET`.

## Auth Modeling

Keep two authorization concerns distinct:

- Payload Admin auth (`admins` collection, email/password) controls who can
  manage CMS/admin content.
- App auth (`users` collection) controls reviewer login and app-level accounts.

The `admins` collection is configured as `admin.user` and is exclusively for CMS
editors. Never use `admins` for public signup or grant app users Payload Admin
access.

## Payload Implementation Workflow

When adding Payload-backed functionality:

1. Inspect the existing `src/payload.config.ts`, `src/collections/`, and
   frontend routes before changing code.
2. Add or update collection/global definitions under `src/collections/` or
   `src/globals/`.
3. Register them in the existing `collections` or `globals` arrays in
   `src/payload.config.ts`. Keep the config shape intact.
4. Query Payload from server components/routes with `getPayload({ config })`.
5. Keep user-facing pages in `src/app/(frontend)/`.
6. Do not directly edit `src/app/(payload)/`; it is managed by Payload.

## Routing

Frontend pages live in `src/app/(frontend)/`. Pages are defined by creating
`page.tsx` files:

- `src/app/(frontend)/page.tsx` - `/`
- `src/app/(frontend)/about/page.tsx` - `/about`
- `src/app/(frontend)/blog/[slug]/page.tsx` - `/blog/:slug`

The Payload admin panel is available at `/admin`.

Use `findBySlug()` from `src/lib/payload.ts` for slug lookups and call
`notFound()` when no document exists.

## Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `PAYLOAD_SECRET` - Secret for Payload auth/encryption
- `SITE_URL` - Public URL of the site (optional, defaults to `http://localhost:3000`)

## Important

- The dev server listens on `$PORT` (default 3000)
- Use `pnpm install` to add new dependencies
- Do not modify files under `src/app/(payload)/` - they are managed by Payload
- Toolchain versions are managed by `.mise.toml`, not installed manually
- This is Next.js App Router + React 19 + Payload 4 + Tailwind CSS v4;
  check `package.json` before adding or using other dependencies.
