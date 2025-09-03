# Project Overview

- Purpose: HKUST Smart AC mobile client and API docs for dorm AC control with prepaid minutes.
- Objective: Ship an Expo React Native app where students can check AC status, toggle power, schedule timers, track consumption, and manage prepaid balance; maintain clear API specs.
- Scope: `apps/mobile/` (Expo RN app using Expo Router) and `Doc/` (REST API documentation).
- Key Features: ON/OFF, timer, real-time usage, balance, billing cycle, top-up history, emergency mode.
- Auth & Protocols: CAS login → short-lived bearer token; HTTPS JSON API with standard headers.
- Out of Scope: Payments processing and hardware integration beyond provided API.

# Repository Guidelines

## Project Structure & Module Organization
- Monorepo (PNPM): root `pnpm-workspace.yaml` and `package.json` with workspace scripts.
- Apps: `apps/mobile/` (Expo React Native app), `apps/api/` (Express API, TypeScript).
- App routes: `apps/mobile/app/` using Expo Router (files mirror routes).
- UI: `apps/mobile/components/` (PascalCase components), `apps/mobile/constants/` (config), `apps/mobile/hooks/` (reusable hooks).
- Assets: `apps/mobile/assets/` (images, fonts).
- Shared config: `packages/tsconfig/` (base tsconfig).
- Docs: update or add specs under `Doc/`.

## Build, Test, and Development Commands
From repo root (PNPM):
- `pnpm dev`: run all workspace `dev` scripts in parallel.
- `pnpm dev:mobile`: run Expo app (`apps/mobile`).
- `pnpm dev:api`: run API server (`apps/api`).
- `pnpm build`: build all workspaces (where applicable).
- `pnpm lint`: lint all workspaces (where applicable).

From `apps/mobile/`:
- `pnpm dev` or `pnpm start`: start Expo dev server (QR/device/simulator).
- `pnpm android` | `pnpm ios` | `pnpm web`: launch specific platforms.
- `pnpm lint`: run ESLint checks (uses `eslint-config-expo`).
- `pnpm reset-project`: interactive reset of app scaffolding (moves/deletes `app/`, `components/`, `hooks/`, `constants/`, `scripts/`). Use with care.

From `apps/api/`:
- `pnpm dev`: start API in watch mode via `tsx`.
- `pnpm build` / `pnpm start`: compile and run built server.

## Coding Style & Naming Conventions
- Language: TypeScript (`strict` mode). Path alias: `@/*` → project root.
- Formatting/Lint: ESLint only; fix issues as reported. Prefer `npm run lint -- --fix` for safe autofixes.
- Components: PascalCase filenames and exports (e.g., `ThemedText.tsx`).
- Hooks: camelCase starting with `use` (e.g., `useColorScheme.ts`).
- Routes: use `.tsx` and keep folder/file names descriptive; colocate route-specific UI under the same folder when practical.
 - Mobile Auth: Supabase client at `apps/mobile/src/lib/supabase.ts` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.

## Testing Guidelines
- No test runner is configured yet. If adding tests, prefer Jest + React Native Testing Library.
- Place tests next to sources as `*.test.ts(x)`.
- Aim for meaningful coverage on new/changed code; target ≥70% lines for new modules.
- Keep tests deterministic; avoid real network or timers without mocks.

## Commit & Pull Request Guidelines
- Commits: write clear, imperative messages. If no existing pattern fits, use Conventional Commits (e.g., `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- PRs: include problem statement, what changed, how to validate (commands/screenshots), and related issues (e.g., `Closes #123`). Keep PRs focused and small.

## Security & Configuration Tips
- Secrets: do not commit API keys or credentials. Prefer platform env/config and secure stores.
- Assets/licenses: verify rights for images/fonts in `assets/`.
- Mobile builds: keep `app.json` tidy; update bundle identifiers and icons when preparing releases.
 - Environment: copy `.env.example` to `.env` files per app; never expose `SUPABASE_JWT_SECRET` to the mobile client.
