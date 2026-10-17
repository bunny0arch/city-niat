# MissionControl AI — Option B redesign plan

## Direction

Adopt the supplied light editorial operations workspace reference: warm ivory surfaces, ink typography, thin dividers, restrained cobalt accent, compact navigation, prominent mission context, central React Flow canvas, and contextual inspector.

## Preserve

- Existing React Flow canvas and node/edge interactions.
- Task CRUD, mission CRUD, status updates, position persistence, dependency validation, edge deletion, reset-sample behavior.
- Existing Gemini/backend API request and response shapes.
- Existing secondary tabs and supported task metadata.
- Health polling and status feedback.

## Implement

1. Replace the dark visual token layer with a light editorial token system.
2. Recompose Header as a compact global bar with brand, search, mission switcher, health status, and account affordance.
3. Recompose Sidebar as a restrained workspace rail with mission summary and navigation.
4. Restyle WorkflowCanvas controls, React Flow background, minimap, edges, and selection state.
5. Restyle task nodes as compact workflow components with status, priority, progress, and dependency cues.
6. Recompose InspectorPanel as a contextual right inspector with details, metadata, actions, and AI-ready assist area.
7. Improve modals, empty/loading/error states, focus states, reduced-motion behavior, and responsive layouts.
8. Add a front-end login route/surface at `/login` without changing backend auth contracts; use a clearly labeled local workspace session until a real auth endpoint exists.
9. Run build, lint, browser checks, and responsive screenshots; fix regressions.

## Verification

- `npm run build`
- `npm run lint`
- Start Vite and inspect desktop/mobile through Playwright.
- Exercise task selection, drag, connect, edge delete, add/edit task, mission switcher, tabs, and login navigation.
