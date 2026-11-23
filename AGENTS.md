<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- In-app event calls use `@daily-co/daily-js` call-object mode with a custom Campfire UI; keep access, token, and expiry enforcement in `video.functions.ts` so presentation changes cannot weaken room security.
- Shared event links always stop at the event page: the call only opens from an explicit member click, never automatically on arrival; external meeting links take precedence over the built-in room.
- The four discovery pages share the reusable dealt-hand pattern; keep recommendation presentation client-side so visual shuffling never changes backend rules.
- Appreciation read receipts must go through the authenticated server function and its service-only database function; never add a broad member update policy.
- Appreciation send motion uses one requestAnimationFrame timeline; keep persistence immediate and independent from decorative playback.
- Home spaces live at /home/reflection, /home/inspiration, /home/appreciation and share the Postcard pieces in postcard.tsx; old /home?space= links redirect there, and kept/pinned cards reuse favorites rather than new tables.
- Written reflections live in the owner-only reflections table (RLS member_id = auth.uid() for all operations, no staff read); question text is stored on the row so entries survive deck changes.
- The /onboarding-chat prototype keeps answers only in component state plus sessionStorage; it must never write to the backend or a member's profile.
- The chat prototype's introduction is isolated in onboarding-intro and shares session-only progress with the conversation so restarting replays both without changing live onboarding.
- Facilitator draft validation rules live in a browser-safe module with focused tests; submissions go through a public validated server function into an admin-only table and stay labelled non-binding.
- Direct admin edits reuse the existing listing forms and admin profile editor; presentation gates never replace database authorization, and listing ownership is never reassigned by an edit.
- Listing deletion shares one confirmation control across detail/edit pages, scopes requests to the caller's owner ID, and verifies the returned deletion before clearing caches; existing database policies remain the authorization boundary.
- Membership access uses the browser-safe member-access helper with verified payment access and its UTC launch boundary, mirrored by public.is_full_member() for RLS; all callers pass server-verified membership state, defaulting to no payment access. AppShell resolves access before mounting its child Outlet, while stored status is guarded against self-upgrade. Shared private images require ownership or an authorized content reference, not blanket signed-in reads.
- A root MembershipBoundary resolves payment access before mounting any signed-in public or protected content; verified entitlements are owner-readable, service-write-only memberships, recorded atomically with payments after Stripe verification. Payment never changes member_status; founding and monthly checkout share the server-only verifier, and affiliate attribution remains independent of payment redirects.
- Payment exemptions use staff roles only, never stored full status or computed launch access; the root boundary verifies the session and recorded membership before mounting member content. Shared database payment exemptions must not be tightened while the old live publish lacks the payment UI; synchronize that enforcement with the eventual paid-flow publish.
- Member content tables apply restrictive paid-access SELECT policies in addition to existing owner/privacy policies; caller-scoped SECURITY DEFINER payment checks avoid recursion without widening read access.
- New-flow Google signups use a server-issued encrypted HttpOnly pre-OAuth timestamp; useProfile awaits authenticated initialization before reading content. Only the caller's account/profile created after that marker can become limited; existing accounts, staff and unmarked signups remain untouched so the shared full default preserves old-live behavior.
- Free onboarding is the sole root payment-boundary exception; incomplete entry profiles route there without changing AppShell or member-access helpers. The post-onboarding support dialog reuses existing checkout functions, while authenticated trial recording atomically sets a write-once profile timestamp and never grants access.
- Root session verification reads the stored session first and clears it only on a server-confirmed auth failure (isAuthFailure); timeouts and network errors retry and keep members signed in, with no focus refetch, so logins persist like typical web apps.
- Displayed and copied event share URLs use the shared production-origin joinUrl helper, so preview hosts never leak into shared links.
- Personalized event sharing uses the per-account affiliate query and idempotent activation RPC; host-attributed sharing uses an authenticated server function and staff-checked event-scoped database RPC, so no impersonation or broad affiliate read access is needed.
- Notification RPCs live in a client-safe *.functions.ts entry, re-exported from src/server/notifications.ts for server callers; all queries use the verified caller and fail gently until the future tables exist, and the email helper remains inert.
- Event time displays share the pure event-time formatter and EventTime presentation; resolve the viewer timezone only after hydration to keep server-rendered markup stable without changing stored event instants.
- Event edit screens share the browser-safe event-edit helpers; detail updates whitelist editable fields and never write status or ownership, preserving pending review and immediate published edits under existing database authorization.
- Approved events use a distinct unpublished status, never draft; the database guard allows only staff unpublishing and owner republishing, and captures the published schedule for reconfirmation after republication. Restrictive reads keep unpublished rows manager-only even for prior attendees.
- Calendar exports use the browser-safe calendar utility with UTC instants and stable per-event UIDs; export only the RSVP'd occurrence and location already authorized by the event read, because repeated gatherings are separate events and RSVPs.
- Public videos use events.video_url, a shared safe YouTube player and published-only preview RPC; private call links stay separate.
- Event browse/detail/day routes are public and load the whitelisted published-only catalog RPC; never grant anonymous profile/table reads. Public image reads require a published event cover/host reference, while RSVP, locations and host tools retain existing authenticated authorization.
- Open Accounting renders saved figures first and reconciles in the background; My Earnings and Admin Affiliates reconcile Stripe → payments through reconcile.functions.ts (auth, 5-minute throttle in stripe_reconciliation_runs) before reading totals; matching rules live in browser-safe reconcile.ts with tests, and unmatched payments are never assigned by guess. The Stripe webhook saves processing fees in payments.metadata and marks refunded payments at event time.
