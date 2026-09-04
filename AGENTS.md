

# Go + Next.js + Supabase Web App

Builds full-stack web apps with this stack:

- **Backend**: Go, `net/http` + `chi` router, `sqlc` (generates type-safe Go from raw SQL) + `pgx` (Postgres driver/pool)
- **Database/Auth/Storage**: Supabase (managed Postgres, Supabase Auth for user identity, Supabase Storage for files)
- **Frontend**: Next.js (App Router), calling the Go API as a separate REST service
- **Layout**: monorepo, `apps/web` (Next.js) and `apps/api` (Go) deployed independently
- **Deploy targets (fixed defaults for this project)**: `apps/web` → **Vercel**. `apps/api` → **self-hosted, exposed via Cloudflare Tunnel** (not a PaaS, not a public IP). See `references/deployment.md` before scaffolding any deploy config.

Read this file fully before scaffolding anything. Read a `references/*.md` file the moment you touch that part of the stack — don't guess at sqlc config, RLS behavior, or Next.js data-fetching patterns from memory.

Don't load every reference up front — load the one matching the current task.

## Core architecture decisions (don't relitigate these per-task)

1. **Go API and Next.js are separate services.** Next.js never talks to Postgres directly and never embeds Go code. It calls the Go API over HTTP (JSON), same as any external client.
2. **Supabase Postgres is the only database.** Go connects to it via `pgx` (pooled, using the Supabase connection pooler string in production, direct connection in local dev). No ORM — `sqlc` generates typed query functions from `.sql` files.
3. **Auth is Supabase Auth.** The frontend uses the Supabase JS client for sign-up/sign-in/session management. The Go API does NOT re-implement auth — it verifies the Supabase-issued JWT on incoming requests (see `references/supabase-integration.md`) and trusts the `sub` claim as the user id.
4. **Migrations live in `supabase/migrations`** and are applied via the Supabase CLI, not hand-run SQL. `sqlc` reads the same schema to generate types, so schema changes always start there.
5. **Monorepo, independent deploys.** One git repo, two deployable units. Changes to `apps/api` don't require redeploying `apps/web` and vice versa. See `references/deployment.md` for target platforms.

## Workflow

### New project
1. Confirm project name and whether the user already has a Supabase project (ask for `SUPABASE_URL`/keys, or note they'll add them later) — don't block scaffolding on this, use placeholders in `.env.example`.
2. Read `references/project-structure.md`, scaffold the monorepo skeleton.
3. Read `references/sqlc-pgx.md`, set up an initial migration (e.g. a `users`/domain table) + sqlc config.
4. Read `references/go-api.md`, scaffold the Go service: router, health check endpoint, one real resource (handler + sqlc queries wired together).
5. Read `references/supabase-integration.md`, wire JWT verification middleware into the Go API.
6. Read `references/nextjs-frontend.md`, scaffold Next.js app with Supabase client, a login page, and one page that calls the Go API with the user's access token.
7. Read `references/deployment.md`, add Dockerfiles + env samples for both services.
8. Run the Go service locally (`go build ./...` at minimum) and `next build` for the frontend to confirm both compile before handing back.

### Adding a feature to an existing project (most common ask)
Don't re-scaffold. Identify which layer(s) the feature touches and jump straight to the matching reference:
- New table/column → migration in `supabase/migrations`, regenerate sqlc.
- New API endpoint → `references/go-api.md` + `references/sqlc-pgx.md` for the query.
- New page/UI → `references/nextjs-frontend.md`.
- Auth-gated feature → `references/supabase-integration.md` for both the Go-side check and the frontend session handling.

Always check the existing project's actual file layout and conventions (e.g. `ls apps/api`, look at an existing handler) before adding new code — match what's there rather than imposing the reference's example verbatim if the project has already diverged.

## Non-negotiables

- Never put raw SQL string-building in Go handlers — all queries go through sqlc-generated functions.
- Never let the frontend hold or use the Postgres/service-role key. Only the Go backend (server-side) uses the Supabase service-role key when it needs elevated access; the browser only ever sees the Supabase anon key.
- Every Go API response is JSON with a consistent error shape (see `references/go-api.md`) — no bare `http.Error` strings for API consumers.
- Validate JWTs on every protected Go route via the shared middleware — don't hand-roll auth checks per-handler.
- Run `sqlc generate` after any `.sql` query file change and don't hand-edit generated code.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
