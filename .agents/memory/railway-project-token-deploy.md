---
name: Railway deploy via project-scoped token
description: How to drive Railway CLI/GraphQL with a project-scoped RAILWAY_TOKEN (not an account token), the free-plan ceiling that blocks new services, and the Nixpacks/pnpm-monorepo build pitfalls that follow.
---

A Railway **project token** (as opposed to an account/API token) only authorizes operations already scoped to its one linked project/environment:
- `whoami` and `list` (account-level) always fail "Unauthorized" — expected, not a broken token. Use `railway status` to confirm identity/project instead.
- Almost all raw GraphQL mutations against `backboard.railway.app/graphql/v2` (`serviceCreate`, `serviceConnect` for a GitHub source, `serviceInstanceUpdate`, reading another service's `variables`/`serviceInstance`) return **"Not Authorized"** even though the equivalent *CLI* commands work fine with the same token. The CLI apparently goes through an allowed internal path the raw API does not expose to project tokens — always prefer the CLI over raw GraphQL when a project token is all you have.
- CLI commands confirmed to work with a project token: `railway status`, `railway variable list/set --service <name>`, `railway service delete --service <name>`, `railway service list --json`, `railway up --service <name>`, `railway logs --service <name> --build|--deployment`.
- `railway add --service <name>` and `railway link` are interactive/account-flavored and often fail outright ("Project not found. Run `railway link`") or need a real TTY. Wrapping the piped input in `script -qc "..." /dev/null` (allocates a pty) lets a piped `ESC` byte reach the raw-mode "Enter a variable" prompt so `add` completes and creates an empty service.
- Connecting a **GitHub repo as a service's source** (`serviceConnect`/`railway service source connect`) needs account-level GitHub App permission a project token doesn't have — always "Not Authorized". Workaround: leave the service source empty and deploy via `railway up` (tarball upload of the local working directory) instead of a GitHub-connected source.

**Free plan note:** a project's Free-plan service quota counts *all* services including ones stuck in `FAILED` status with 0 replicas — deleting unused failed services frees quota for a new one. Before deleting someone's existing services, check their variables (`railway variable list --service <name> --json`) first in case any hold a unique secret not duplicated elsewhere.

**Nixpacks + pnpm monorepo build pitfalls** (all discovered building/deploying a Node worker from a pnpm-workspace repo):
1. `railway up` from the repo **root** (not a subpackage dir) is required so the full pnpm workspace is uploaded — deploying from a subpackage dir breaks `workspace:*` dependency resolution.
2. A `railway.json` `build.buildCommand` only overrides Nixpacks' **build** phase, not its separate **install** phase — Nixpacks still runs its own auto-detected `pnpm i --frozen-lockfile` first regardless. To change the install step, set the `NIXPACKS_INSTALL_CMD` env var on the service directly (not via railway.json).
3. Corepack inside Nixpacks' build image (old Node 18 + old corepack) fails with `Cannot find matching keyid` when it tries to auto-fetch "latest stable" pnpm — a signature-verification bug with newer pnpm releases on stale corepack. Skip corepack entirely: `npm install -g pnpm@<version pinned to match local>` works.
4. If no `buildCommand` is set, Nixpacks falls back to the **root** `package.json`'s `"build"` script — in a monorepo that can trigger a full `pnpm -r run build`/typecheck across every package (including unrelated ones with pre-existing errors) even though you only wanted to deploy one small service. Set an explicit no-op buildCommand (e.g. `"true"`) for services that don't need a build step (e.g. a `tsx`-run worker).
5. Nixpacks' default Node runtime was too old for `@supabase/supabase-js`'s realtime client (needs Node's native `WebSocket`, added in Node 22) — set `NIXPACKS_NODE_VERSION=22` as a service env var to fix `Node.js detected but native WebSocket not found`.

**Why:** each of these produced a distinct, non-obvious build failure that took a full failed-deploy cycle to diagnose; the fixes are all env vars/config, not code changes.

**How to apply:** when deploying any pnpm-monorepo Node service to Railway via `railway up` + Nixpacks, proactively set `NIXPACKS_INSTALL_CMD` (pnpm install, no corepack), an explicit `buildCommand` (no-op if the service needs no build step), and `NIXPACKS_NODE_VERSION` if the service uses Node 22+-only APIs — don't wait to hit each failure serially.
