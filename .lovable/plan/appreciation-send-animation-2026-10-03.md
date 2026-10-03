# Appreciation Send Animation

## Goal
Add the exact 7.4-second letter-and-dove sequence inside the existing Home appreciation card, without changing its existing send path, privacy rules, member picker, or Received/Sent lists.

## Implementation
- Preserve the composer at rest in a fixed 700 × 740 coordinate stage, scaled to its available width on desktop and mobile.
- Drive every animated layer from one requestAnimationFrame clock and pure timeline calculations: paper lift, aligned thirds, envelope, wax seal, dove pickup, feather, and confirmation.
- Save immediately through the existing appreciation-letter flow; let the animation continue independently and show the specified retry state after the dove exits if saving fails.
- Add semantic illustration tokens for paper, envelope, wax, dove, feather, borders, and shadows; use no raw colors in components.
- Support preview-only `?t=` frozen frames and `?demo=dove` replay with sample content and no database writes.
- Respect reduced motion, screen-reader announcements, disabled controls during playback, and focus movement to the final action.

## Verification
- Confirm clean preview compilation and no runtime or console errors.
- Inspect frozen frames at 0, 1500, 2300, 3000, 4000, 4700, 5600, 6800, and 7400 on desktop and mobile.
- Verify demo replay, reduced motion, member picker at rest, immediate real send behavior, final focus, and Received/Sent placement.
- Confirm the existing appreciation table has no animation test rows; do not publish.
