# Review

A review runs automatically when a lane reports done; the owner doesn't start it. Reviews run as parallel subagents with the `reviewer` profile (`.devin/agents/reviewer.md`), one per role, against a single PR. The profile has `read`, `grep` and `glob` only: no exec, write or edit, so a reviewer can't comment, label, push or merge.

Reviewers can't run `gh pr diff`. The foreman runs `scripts/review-bundle <pr>` once. It prints the path of a bundle file holding the diff, the issue's acceptance criteria and the PR-head content of every touched file. Each reviewer reads that file and only the files the diff touches plus their direct imports, and returns a list of findings in the format below. The foreman (or whoever triggered the review) merges them.

Read deny rules in `.devin/foreman.json` cover `~/` paths such as `~/.ssh` and `~/.config/gh`, but they don't block files inside the checkout (#718), so the foreman and reviewers can read `.env*` there. Real secrets must never be in a checkout the foreman runs in.

The foreman asks the owner only for decisions, and every decision request includes a recommendation.

Parallel subagents are for review only. Implementation is one agent per lane.

## Roles

### 1. Security and authorization

Checklist:

- Every new or changed API route and server action checks auth, and the check matches the data it returns (user-scoped vs admin).
- Supabase queries run under RLS for user requests; service-role keys appear only in server-only modules.
- Input from the request (body, params, search params, headers) is validated before use; no string-built SQL or `ilike` on user input.
- No secrets, tokens or raw emails in logs or error responses.
- Rate limiting is present on any endpoint that can be enumerated (login, signup, email check).
- New dependencies: purpose stated, no known advisories (`npm audit`).

Reference: `.github/skills/security-patterns/SKILL.md`.

### 2. Tests versus acceptance criteria

Checklist:

- Each acceptance criterion maps to at least one test by name; list any criterion with no test.
- The first commit on the branch contains tests only and they failed before the implementation (`git log --reverse --stat`).
- Tests assert behaviour, not implementation (no snapshot of internal state, no mocking the unit under test).
- Regression tests hit the actual bug path, not an adjacent happy path.
- No `it.skip` / `describe.skip` added; no widened timeouts without a reason.
- Coverage of new branches (error, empty, loading states) exists.

Reference: `.github/skills/testing-patterns/SKILL.md`.

### 3. Next.js server/client and caching

Checklist:

- Server components stay server components: no hooks or browser APIs; `'use client'` only where interaction needs it, as low in the tree as possible.
- Server-only modules import `'server-only'`; no server code reaches a client bundle.
- Data fetching: correct `cache`, `revalidate` or `dynamic` settings; no accidental full-dynamic root layout.
- Route handlers set the right runtime and don't block on work that belongs in a background job.
- Images, fonts and third-party scripts use the Next primitives.
- No new runtime fetch to an external origin on every render (icons, maps) without caching.

Reference: `node_modules/next/dist/docs/` for the installed version.

### 4. Code reuse and structure

Checklist:

- No reimplementation of something that exists in `src/lib`, `src/utils`, `src/components/ui`, `src/services` or `src/hooks`; name the existing function if so.
- New domain UI lives in `src/features/<domain>/components/`, shared UI in `src/components/`.
- No new abstraction used once. No feature flags, config options or generic parameters the issue didn't ask for.
- Naming matches the glossary (`GLOSSARY.md`).
- Deleted code is deleted, not commented out.
- i18n: new user-facing strings go through `next-intl` with keys in all six locales.

Reference: `.github/skills/engineering-standards/SKILL.md`, `.github/skills/code-review-checklist/SKILL.md`.

## Finding format

One line per finding, no prose around it:

```
<severity> | <file>:<line> | <what is wrong> | <what to do instead>
```

Severity:

- **blocking**: security hole, missing auth, acceptance criterion with no test, data loss, build or type error, server code in a client bundle.
- **should-fix**: wrong caching, duplicated helper, test that doesn't test the bug, missing error/empty state, missing locale key.
- **nit**: naming, ordering, comment wording, formatting the linter didn't catch.

## Merge step

1. Concatenate the four lists.
2. Deduplicate by `<file>:<line>`; keep the highest severity and the clearest wording.
3. Sort: blocking, should-fix, nit. Within a group, by file.
4. Post as one PR review:

```bash
gh pr review <pr> --comment --body-file review.md     # blocking present: --request-changes
```

5. Tell the lane which items to address. Blocking and should-fix must be fixed or argued down in a reply before the PR is marked ready. Nits are the owner's call.

## Reviewer rules

- Read only the bundle and the diff's direct dependencies. Don't review the whole codebase.
- Don't propose rewrites or new features. Findings point at lines in the diff.
- If a checklist item needs information you don't have (for example a DB constraint), say so as a `should-fix` with "verify" in the action column instead of guessing.
- Return nothing but the finding lines. The merger needs no summary.
