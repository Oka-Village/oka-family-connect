# Footer loading and navigation fixes

## Changes
- Keep the footer hidden during initial authentication and page loading, then mount it only after the active page has committed.
- Add a quiet branded loading screen for authenticated pages so the footer never appears above an empty area.
- Replace the footer text wordmark with the shared Oka logo linking to Home.
- Match footer links to Home, Events, Members, Skills, Houses, Collections, and Invite a friend.

## Verification
- Check initial signed-in loading, page navigation, footer placement, logo link, and all footer destinations on desktop and mobile.
- Confirm the preview has no build, runtime, or console errors. Do not publish.
