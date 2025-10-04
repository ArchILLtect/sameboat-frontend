# Things To Do (TTD)

## 0.2.0

-   Adopt GitHub CLI for release and project automation (gh install, auth, basic scripts).

## UI/UX

-   Debounce rapid backend health status flips by enforcing a minimum skeleton display duration.
-   Expose backend health refresh interval via `VITE_HEALTH_REFRESH_MS` environment variable.
-   Add a global `<AnimatePresence>` around route transitions for cohesive page motion.
-   Add a small UI control (dropdown or input) in dev mode to adjust the interval live.
-   Persist preferred interval in localStorage for dev tuning.
-   Animate auth form page transitions distinctly (scale + fade) separate from general routes.
-   Add reduced motion support: disable transitions if user prefers reduced motion (respect `prefers-reduced-motion`).
-   Add copy-to-clipboard button for User ID.
-   Lazy-load avatar with generated identicon fallback.
-   Show lastFetched timestamp and manual refresh (leveraging existing auth context).
-   Introduce a compact mobile variant hiding the identifiers section behind a disclosure.
-   Add a layout test to ensure footer positioning (e.g., snapshot with small content).
-   Implement reduced motion media query to disable route transitions.
-   Pause-on-error behavior for health auto-refresh (stop interval after consecutive failures until manual retry).
-   Add additional env var typings & sample `.env.example` for debug / feature flags (e.g. `VITE_DEBUG_AUTH`, `VITE_HEALTH_REFRESH_MS`, future flags).
-   Add sticky top navigation bar (reuse `Layout` / extend `AppShell` with nav actions, responsive collapse if needed).
-   Implement reduced motion guard using `window.matchMedia('(prefers-reduced-motion: reduce)')` before triggering animations.

## Workflow / Tooling

-   Review and iterate `docs/developer-workflow-checklist.md` after first full usage cycle.
-   Wire `changelog:check` into CI as a required status (already present; enforce branch protection rule).
-   Add a coverage threshold to Vitest (fail CI if below baseline; decide initial %).
-   Introduce conventional commit linting (commitlint + husky) to standardize messages.
-   Implement a release automation script (move `[Unreleased]` → new version section, update diff links, bump package version).
-   (Former wording retained conceptually: prior tasks consolidated into explicit phrasing above.)
-   After workflow automation stabilized: begin adding enumerated missing auth & CI tests (see week-3 checklist Completion Blockers) and update blocker section iteratively.
-   Add a custom CI step that fails if no test files were touched for a PR containing `feat:` or `fix:` commits.
-   Script/guard to fail if a `feat:` commit lands without any matching diff in `src/__tests__/` (heuristic; allow override via `[skip-test-guard]`).
-   GitHub Action to auto-assign PR label based on first conventional commit type (feat/fix/docs/chore/refactor/test/perf).
    
### Project Automation

-   Auto-update the Project “Status” field when a linked PR is merged (project workflows; ensure issues close via closing keywords).
-   Automated release creation: script adds tag + creates GitHub Release in one step (use gh CLI once adopted).
-   Script dependency triage or labeling (e.g., label Dependabot PRs by group and auto-add to Project backlog).
-   Scriptable gating: verify CHANGELOG entry before tagging a release; fail CI otherwise.
    
### Dependency / Security Automation

-   Create Dependabot config groups separating critical/security deps from test/tooling deps (distinct PR labels & visibility).
-   Add CI job for dependency audit (e.g. `npm audit --audit-level=moderate` or Snyk) highlighting severity delta between main and PR.
-   Add GitHub Action guard: fail Dependabot PR if it modifies > N (configurable) devDependencies without a CHANGELOG entry under Security or Internal.

## Notes

Add new sections here as areas expand (e.g., Testing, Performance, Accessibility).
