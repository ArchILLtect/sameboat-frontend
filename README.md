[![Frontend CI](https://github.com/sameboat-platform/frontend/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/sameboat-platform/frontend/actions/workflows/frontend-ci.yml)

# SameBoat Frontend (Vite + React + TS)

## Overview

SameBoat Frontend is a lightweight Vite + React 19 single-page application scaffold. It focuses on fast local iteration (HMR), strict TypeScript, and a minimal baseline you can extend (routing, API clients, state management) without vendor lock-in.

### Planning Artifacts

-   Week 3 Progress Checklist: `docs/week-3-plan-checklist.md`
-   Week 4 Draft Plan: `docs/week-4-plan-draft.md`
-   Changelog: `CHANGELOG.md` (see [Unreleased] section for in-flight changes)

### Versioning

Pre-1.0 releases use `0.x.y`; breaking changes may occur between minor bumps. Each meaningful change should append a line under `[Unreleased]` in the changelog; on tagging a release, move those lines into a dated section.

## Tech Stack

| Layer            | Choice                             | Notes                                                           |
| ---------------- | ---------------------------------- | --------------------------------------------------------------- |
| Build dev server | Vite 7                             | HMR + fast SWC transforms                                       |
| UI library       | React 19 + Chakra UI (selective)   | React for core + incremental Chakra adoption (cards, forms)     |
| Transpilation    | SWC via `@vitejs/plugin-react-swc` | Faster than Babel for local dev                                 |
| Language         | TypeScript ^5.8.0 (strict)         | `noUncheckedSideEffectImports`, `verbatimModuleSyntax` enforced |
| Linting          | ESLint flat config                 | React Hooks + React Refresh plugins                             |
| CI               | GitHub Actions                     | Node 20, type-check + build                                     |

## Project Structure

```
src/
  main.tsx          # Entry – mounts <App />
  App.tsx           # App shell (wraps providers + routes)
    routes/           # Route configuration + ProtectedRoute + layout transitions
    state/auth/       # Auth context store (bootstrap, login/logout/refresh, error mapping)
    pages/            # Page-level React components
    components/       # Reusable UI bits (AuthForm, FormField, Footer, UserSummary, RuntimeDebugPanel, GlobalRouteTransition)
    lib/              # Shared utilities (api.ts, health.ts)
    theme.ts          # Chakra theme customization (dark-mode default, brand tokens)
public/             # Static assets served at root (/favicon, /vite.svg)
```

Add components under `src/components/` and import into pages or `App.tsx`.

## Development Workflow

1. Install deps: `npm install`
2. Start dev server: `npm run dev` (default http://localhost:5173)
3. Type-first build: `npm run build` (runs `tsc -b && vite build`)
4. Preview production bundle: `npm run preview`
5. Lint before commit: `npm run lint`

## Environment Variables

All variables must be prefixed with `VITE_` for exposure to the client bundle.

| Variable                    | Purpose                                       | Notes                                       |
| --------------------------- | --------------------------------------------- | ------------------------------------------- |
| `VITE_API_BASE_URL`         | Override backend origin (dev)                 | Fallback to relative `/` (proxy) when unset |
| `VITE_DEBUG_AUTH`           | Enable verbose auth console diagnostics       | Any truthy value enables extra logs         |
| `VITE_DEBUG_AUTH_BOOTSTRAP` | Additional bootstrap heartbeat logs           | Aids diagnosing early 401 noise             |
| `VITE_HEALTH_REFRESH_MS`    | Interval (ms) between health pings            | Defaults to `30000`; must be > 1000         |
| `VITE_APP_VERSION`          | Build/app version string                      | Shown in footer when present                |
| `VITE_COMMIT_HASH`          | Git commit hash (fallback if version missing) | Truncated to 7 chars in footer              |
| `VITE_FEEDBACK_URL`         | External feedback / issue link                | Defaults to repo issue creation URL         |

You can create a `.env.example` enumerating these for contributors. Local overrides belong in `.env.local` (git‑ignored).

## API Layer

`src/lib/api.ts` exports a small generic `api<T>` wrapper around `fetch`.
All requests automatically include `credentials: 'include'` so the backend's
`SBSESSION` (httpOnly) cookie-based session flows transparently.
Structured error JSON (shape: `{ error, message }`) is surfaced via `err.cause`.

Example:

```ts
const health = await api<HealthResponse>("/api/actuator/health");
```

Add narrowers / runtime guards in `src/lib/*` (e.g., `health.ts`).

## Authentication System

The authentication layer uses a React Context (`AuthProvider`) that performs exactly one bootstrap fetch to `/api/me` to hydrate the session user (cookie-based). React 19 StrictMode double-mount is neutralized via a module-level flag ensuring `refresh()` is not called twice.

### Key Points

-   Provider: `AuthProvider` (`src/state/auth/auth-context.tsx`) – wraps the router.
-   Actions: `login`, `register`, `refresh`, `logout`, `clearError`.
-   Status: `status` cycles through `idle | loading | authenticated | error` while `bootstrapped` gates initial redirects.
-   Error Mapping: Server error payload (`{ error, message }`) is normalized in `errors.ts` to friendly messages (e.g. `BAD_CREDENTIALS`, `EMAIL_EXISTS`, `VALIDATION_ERROR`).
-   User Normalization: Responses may return `{ user: {...} }` or raw user; normalization flattens `role` into `roles[]`, surfaces `displayName`.
-   Protected Routes: `ProtectedRoute` blocks redirect until `bootstrapped` true; shows a Chakra spinner with framer-motion transitions.
-   Environment Debug Flags: `VITE_DEBUG_AUTH`, `VITE_DEBUG_AUTH_BOOTSTRAP` toggle verbose logging & heartbeats (useful for analyzing early 401 patterns).

### Forms & UI

-   Forms rewritten using Chakra `FormControl`, `Input`, `FormErrorMessage`, and `Button`.
-   Field-level client validation (email format, password length) surfaces inline errors while backend errors appear in a Chakra `Alert`.
-   Redirect logic preserves original route (`location.state.from`) after successful auth.

### Session Refresh Strategy

1. On first mount: run `refresh()` to attempt session hydration.
2. If unauthenticated (401) during bootstrap: treat as normal (no noisy error state).
3. Post-bootstrap 401s (e.g. expiry): surface mapped error and allow UI to re-auth.
4. A fail-safe timeout flips `bootstrapped` after 5s if the network call hangs.

### Future Store Swap

Because components import only `useAuth()` (wrapper), migrating to Zustand requires only replacing its internals with a store hook matching the same return contract.

## Runtime Debug Panel

`RuntimeDebugPanel` (dev-only) provides an at-a-glance status overlay:

-   Collapsible floating panel (bottom-right) with reduced-motion respect.
-   Displays auth state (`status`, `bootstrapped`, `lastFetched`), active user, and API base.
-   Probes `/actuator/health` & `/api/me` every 15s; maintains last 25 probe history entries.
-   Cumulative error count badge; copy buttons for API base & user ID.
-   Manual refresh & force-refresh controls for diagnosing bootstrap issues.

Remove or disable this panel for production builds (guarded by `import.meta.env.PROD`).

## Testing Workflow

### Tooling

-   Test runner: Vitest (`npm run test`)
-   Environment: jsdom
-   Libraries: `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`

### Running Tests

```bash
npm run test          # Single run
npx vitest watch      # (Optional) Interactive watch mode
```

### Test Locations

All test files live under `src/__tests__/` (`*.test.tsx` for component/routes logic).

### Current Coverage Focus

-   Protected route access & redirect
-   Client-side form validation for login/register (email format + password length)

### Writing New Tests

1. Import the component under test.
2. Wrap with `AuthProvider` + a memory router if route context needed.
3. Mock network as required (e.g. `vi.spyOn(global, 'fetch')` returning a resolved `Response`).
4. Use semantic queries (`getByRole`, `findByText`) over `querySelector`.
5. Assert side-effects (redirect) via `history` (MemoryRouter entries) or presence of destination content.

### Mocking Fetch Example

```ts
vi.spyOn(global, "fetch").mockResolvedValueOnce(
    new Response(
        JSON.stringify({
            id: "u1",
            email: "a@b.com",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
    )
);
```

### Adding Backend Scenario Tests

-   Successful login → redirected to `/me`.
-   BAD_CREDENTIALS response → `<Alert>` shows friendly message.
-   SESSION_EXPIRED path (simulate `/me` 401 after initial bootstrap) → redirect preserved.

### Performance / Stability Tips

-   Keep auth store interactions synchronous except for actual network calls.
-   Use `await waitFor(...)` only for async UI transitions; prefer immediate assertions when possible.
-   Avoid leaking fetch mocks between tests – reset with `vi.restoreAllMocks()` in `afterEach`.

## Quality Gates

-   TypeScript must be clean (build runs `tsc -b`).
-   ESLint must pass (`npm run lint`).
-   CI workflow: `.github/workflows/frontend-ci.yml` – mirrors build locally; keep Node 20 parity.

## Contributing (Quick Summary)

1. Branch from `main` (`feat/*`, `fix/*`).
2. Make changes; keep PRs small & focused.
3. Ensure `npm run lint && npm run build` succeeds.
4. Open PR; CI must be green before merge.

> For extended guidelines see `CONTRIBUTING.md` (to be added).

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Scripts

-   dev – start Vite dev server
-   build – production build
-   preview – preview production build locally
-   test – run Vitest suite

## Repository Migration

This project was migrated from `ArchILLtect/sameboat-frontend` to `sameboat-platform/frontend`.

If you previously cloned the old repository, update your git remote:

```bash
git remote set-url origin https://github.com/sameboat-platform/frontend.git
git fetch origin --prune
```

CI badge & links have been updated to the new organization path.
