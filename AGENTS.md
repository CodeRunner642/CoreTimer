# AGENTS.md — CoreTimer Contributor Guide

## Project Snapshot
- **App**: CoreTimer, a JavaScript web app for guided pelvic floor/core timer workouts.
- **Framework/library**: **React 18** (`react`, `react-dom`) with **Vite 5** and `@vitejs/plugin-react`.
- **Deploy target**: **GitHub Pages** via GitHub Actions.
- **Deployment workflow**: `.github/workflows/static.yml` builds `dist/` and deploys on push to **`main`**.

## Branching & Issue Workflow
1. Start from a GitHub issue.
2. Create a focused branch per issue (from the current integration/default branch used by the repo).
   - Repository evidence:
     - Local branch currently present: `work`.
     - Deployment workflow is triggered by pushes to `main`.
3. Keep changes small and scoped only to what the issue requires.
4. Do **not** refactor unrelated code.
5. Preserve existing app behavior unless the issue explicitly asks for behavior changes.

## Commands (from `package.json`)
Use the actual npm scripts defined in this repo:
- `npm run dev` — start local Vite dev server.
- `npm run build` — production build via Vite (primary required pre-PR check).
- `npm run preview` — preview built app locally.

### Testing/Checks Guidance
- There is currently **no dedicated automated test script** in `package.json` (no `npm test` script).
- Before opening a PR, at minimum run:
  - `npm run build`
- If UI is changed, also run:
  - `npm run dev` for local behavior checks
  - `npm run preview` to sanity-check the production build output

## PR Expectations
Each PR should include:
- Clear summary of what changed and why (linked issue).
- Exact checks run and their outcomes.
- Risks / edge cases / follow-ups.
- Screenshots for UI changes (desktop + mobile/tablet where relevant).

## Review Guidance (CoreTimer-specific)
Reviewers and agents should explicitly verify:
1. **Workout timing accuracy**
   - Interval durations, countdown behavior, transitions between phases.
2. **Phase/repetition count correctness**
   - Correct phase order and rep/set progression.
3. **Mobile/iPad usability**
   - Layout fit, touch targets, orientation behavior, no clipped controls.
4. **Persistence/local storage regressions**
   - Saved settings/session data read/write/reset behavior remains correct.
5. **Accessibility**
   - Keyboard access, focus visibility/order, labels/semantics, color contrast concerns.
6. **Sound/vibration toggle behavior**
   - Toggles reflect true state and are honored throughout workout flow.
7. **Deployment/build breakage**
   - Build passes; no changes that break GitHub Pages artifact generation/deploy flow.
8. **Accidental unrelated changes**
   - Diff remains strictly scoped to the issue.

## Deployment Notes
- GitHub Pages deploy workflow file: `.github/workflows/static.yml`.
- Build artifact path: `dist/`.
- Node version in CI: `22`.
- CI install step currently uses `npm install`.
