# Repository Guidelines

## Project Structure & Module Organization
- Root files: `README.md` (product vision), `GAMEPLAN.md` (build spec), `MINTLIFY-*` strategy docs.
- Worker source lives under `src/worker.ts`; configuration sits in `wrangler.toml`.
- Database schema is defined in `schema.sql`. Keep migrations additive—no destructive edits without user approval.
- Future admin/front-end work should live under `apps/` (create as needed) or Cloudflare Pages repos; keep this repo focused on the Worker + shared assets.

## Build, Test, and Development Commands
- `wrangler d1 create collective-vision-feedback`: create remote D1 db (run once; update `wrangler.toml`).
- `wrangler d1 execute collective-vision-feedback --file=schema.sql --local`: apply schema to local preview DB.
- `wrangler dev`: run the Worker + D1 preview locally.
- `wrangler deploy`: ship the Worker to production. Confirm `route` / `zone_name` first.

## Coding Style & Naming Conventions
- TypeScript in `src/` uses 2-space indentation, semi-colons optional but be consistent.
- Favor small utility functions; keep Worker handlers pure and modular.
- Configuration/env bindings are PascalCase (`Env.DB`), database columns snake_case to match D1 schema.
- Comment only when logic isn’t self-explanatory; prefer descriptive function names over verbose comments.

## Testing Guidelines
- No automated test suite yet; rely on `wrangler dev` + manual API hits (`curl`/`HTTPie`) and schema validation.
- When adding logic-heavy modules, include lightweight unit tests under `__tests__/` using `vitest` (add devDependency) and wire via `npm test`.
- Document manual verification steps in PR descriptions until automated tests exist.

## Commit & Pull Request Guidelines
- Follow conventional, descriptive commits (e.g., `feat: add moderation endpoints`, `fix: sanitize widget inputs`).
- Each PR should:
  - Reference relevant sections of `GAMEPLAN.md`.
  - Describe behavior changes and manual/automated tests run.
  - Attach screenshots or curl logs for UI/API updates when helpful.

## Architecture & Security Notes
- Worker depends on a D1 binding named `DB`; never check in real credentials or `wrangler secret` outputs.
- Keep CORS permissive for public endpoints but revisit before adding admin APIs (likely need token/JWT).
- Embed widget (`/widget.js`) is a distribution surface—avoid breaking changes without versioning the script or creating feature flags.
