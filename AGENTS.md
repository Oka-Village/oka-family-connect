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
- The four discovery pages share the reusable dealt-hand pattern; keep recommendation presentation client-side so visual shuffling never changes backend rules.
- Appreciation read receipts must go through the authenticated server function and its service-only database function; never add a broad member update policy.
- Appreciation send motion uses one requestAnimationFrame timeline; keep persistence immediate and independent from decorative playback.
- Home spaces live at /home/reflection, /home/inspiration, /home/appreciation and share the Postcard pieces in postcard.tsx; old /home?space= links redirect there, and kept/pinned cards reuse favorites rather than new tables.
- Written reflections live in the owner-only reflections table (RLS member_id = auth.uid() for all operations, no staff read); question text is stored on the row so entries survive deck changes.
- The /onboarding-chat prototype keeps answers only in component state plus sessionStorage; it must never write to the backend or a member's profile.
- The chat prototype's introduction is isolated in onboarding-intro and shares session-only progress with the conversation so restarting replays both without changing live onboarding.
- Facilitator draft validation rules live in a browser-safe module with focused tests; keep submission local-only so prototype acknowledgments never create binding acceptance.
- Direct admin edits reuse the existing listing forms and admin profile editor; presentation gates never replace database authorization, and listing ownership is never reassigned by an edit.
- Membership access uses the browser-safe member-access helper with verified payment access and its UTC launch boundary, mirrored by public.is_full_member() for RLS; all callers pass server-verified membership state, defaulting to no payment access. AppShell resolves access before mounting its child Outlet, while stored status is guarded against self-upgrade. Shared private images require ownership or an authorized content reference, not blanket signed-in reads.
- A root MembershipBoundary resolves payment access before mounting any signed-in public or protected content; verified entitlements are owner-readable, service-write-only memberships, recorded atomically with payments after Stripe verification. Payment never changes member_status; founding and monthly checkout share the server-only verifier, and affiliate attribution remains independent of payment redirects.
- Payment exemptions use staff roles only, never stored full status or computed launch access; the root boundary verifies the session and recorded membership before mounting member content. Shared database payment exemptions must not be tightened while the old live publish lacks the payment UI; synchronize that enforcement with the eventual paid-flow publish.
- Member content tables apply restrictive paid-access SELECT policies in addition to existing owner/privacy policies; caller-scoped SECURITY DEFINER payment checks avoid recursion without widening read access.
- New-flow Google signups use a server-issued encrypted HttpOnly pre-OAuth timestamp; useProfile awaits authenticated initialization before reading content. Only the caller's account/profile created after that marker can become limited; existing accounts, staff and unmarked signups remain untouched so the shared full default preserves old-live behavior.
