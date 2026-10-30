# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
pnpm dev          # start dev server (uses $PORT, default 3000)
pnpm build        # payload build → next build
pnpm format       # oxfmt formatter
pnpm generate:types       # regenerate payload-types.ts (manual, usually unnecessary)
pnpm generate:importmap   # regenerate import map (manual, only when HMR fails)
```

There is no test runner configured. TypeScript type-checking is the primary static verification:

```bash
pnpm exec tsc --noEmit
```

## Domain Architecture

**still** is an anonymous community card app. Users read, save, and swipe on short reflective thoughts ("cards") without creating an account. A human reviewer approves or rejects submissions before they become public.

### Core data flow

```
Browser (localStorage device library)
  └─ /api/community  (Next.js route handler, single endpoint for all mutations)
       └─ Payload Local API  →  Collections: Cards, Swipes, CardInteractions, CardKeys
```

All client↔server communication goes through `POST /api/community` with an `operation` discriminant (`post`, `interaction`, `owned`, `review-queue`, `review`, `import-legacy`, `reviewer-login`, `logout`). `GET /api/community` returns the approved card feed.

### Identity without accounts

- **Device keys** (`src/lib/card-keys.ts`) — random URL-safe strings stored in `localStorage`. SHA-256 hashes of these keys are persisted on Cards as `managementKeyHash` (primary) or in the CardKeys collection (secondary, for imported accounts).
- **DeviceLibrary** (`src/lib/device-library.ts`) — the localStorage schema: `keys[]`, `history[]` (local swipe choices), `outbox[]` (pending counter events), `draft`.
- **Outbox / flush** — interactions are written to the outbox first, then flushed to the server. The 10-minute undo window (`UNDO_WINDOW_MS`) is enforced both client-side and server-side.
- Reviewer role uses a `users` collection account with `role: 'reviewer'`. Session is a JWT in an `app-session` httpOnly cookie managed by `src/lib/app-auth.ts`.

### Card lifecycle

`pending → approved | rejected`

- Any browser can submit a card (anonymous, key-owned).
- Only a reviewer (not the card's author) can approve/reject via the Review view or Payload Admin.
- `beforeChange` hook in `Cards.ts` re-sets status to `pending` when text/topic changes; enforces reviewer independence.
- `resonateCount` is a virtual field computed from Swipes + CardInteractions on every read.

### CardInteractions vs Swipes

- **Swipes** (`src/collections/Swipes.ts`) — legacy authenticated swipes, owned by a `users` account.
- **CardInteractions** (`src/collections/CardInteractions.ts`) + `src/lib/card-interactions.ts` — current anonymous interaction receipts, keyed by device interaction key. Idempotent and undo-capable. Receipts expire (pruned on every read/write).
- `resonateCount` on a Card = Swipes(resonate) + CardInteractions(resonate) + 1 if approved.

### Frontend components

All UI lives in a single `'use client'` page (`src/app/(frontend)/page.tsx`) with local state. Sub-components:

- `card-text.tsx` — renders card text with basic formatting
- `breathing-moment.tsx` — animated pause screen shown after a resonate swipe
- `resonate-count.tsx` — shared resonate display
- `create-card-dialog.tsx` — submission form with draft persistence
- `review-panel.tsx` — reviewer queue and "My Cards" submission list

### Access control conventions

- `isCMSAdmin(req)` — `req.user?.collection === 'admins'`
- `isReviewer(req)` — `req.user?.collection === 'users' && req.user?.role === 'reviewer'`
- `ownedCardIDs(req)` — parses `req.context.managementHashes` to find cards the current device owns
- `overrideAccess: false` is used on all user-facing Local API calls; access rules are enforced at the collection boundary

### Key invariants

- Never expose raw management keys or hashes to other clients.
- `anonymousCard()` (`src/lib/card-privacy.ts`) strips author/key fields before returning cards to the browser.
- `sec-fetch-site: cross-site` requests are rejected at the API route entry.
- Payload Admin (`/admin`) uses `admins` collection (Figma SSO); never mix with app `users` accounts.
