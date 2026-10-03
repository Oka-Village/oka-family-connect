# Oka “A Hand of Cards” redesign

## Goal
Apply the supplied visual direction across the existing app without changing its features, permissions, credit rules, event access, or Campfire video security.

## What will change
- Update the global visual system with the brief’s cream, canvas, brown, terracotta, sage, sand, and golden roles; remove pure-white text and surfaces.
- Replace the desktop sidebar with the compact top navigation and avatar menu; keep a five-item mobile bar with “You” as the account entry.
- Build a reusable “dealt hand” experience for Events, Directory, Skills, and Houses:
  - three fanned recommendations with one highlighted front card;
  - Shuffle interaction and back-card promotion;
  - smoothly animated dealing with reduced-motion fallback;
  - compact mobile fan with swipe support.
- Restyle the content below each fan into the brief’s simple grids, filter rows, hover movement, and section-label hierarchy.
- Preserve existing event calendar, proposals, skill sessions, home stays, profiles, credits, affiliates, admin tools, auth, and all empty/error states while bringing them into the same visual language.
- Keep the Campfire room’s dark, custom Daily interface intact; only align its surrounding entry surfaces where needed.

## Screen rollout
1. Shared tokens, typography, shadows, navigation, menus, buttons, cards, and empty states.
2. Events and event details, including the calendar and virtual-event sharing controls.
3. Directory and member profiles.
4. Skills, sessions, offerings, and request flows.
5. Houses, stays, listings, and booking flows.
6. Profile, Credits, Invite & earn, landing/invite pages, onboarding, and Admin.

## Technical details
- Implement the fan as shared React components with page-specific card renderers and existing query results.
- Recommendations will use available live records and rotate through them locally; no seed data or business-rule changes.
- Keep URL-based filters and existing pagination intact.
- Use only semantic Tailwind tokens from `src/styles.css`; no component-level hardcoded colors.
- Preserve current route-level guards and server-side authorization.
- Verify desktop and mobile layouts, fan interactions, filters, navigation, major authenticated routes, and the production build signal.

## Acceptance checks
- Events, Directory, Skills, and Houses each open with a functioning three-card fan and Shuffle action when enough records exist.
- Smaller result sets and empty states remain graceful.
- Desktop top navigation and mobile bottom navigation expose all existing destinations through the specified primary tabs and account menu.
- No pure white appears in app styling.
- Existing core flows still work and the build passes.
